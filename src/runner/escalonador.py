# src/runner/escalonador.py
# flake8: noqa
# type: ignore

from db import get_db_connection, DB_SCHEMA
from executor import enviar_email_smtp, notificar_webhook_dashboard

def processar_escalonamentos():
    conn = get_db_connection()
    if not conn: return

    try:
        cur = conn.cursor()
        
        # 1. BUSCA INCIDENTES PENDENTES DE ESCALONAMENTO
        query = f"""
            SELECT 
                i.id_incidente,
                i.data_abertura,
                i.nivel_escalonamento,
                r.nome as nome_regra,
                re.id_role_destino,
                re.id_tipo_canal,
                re.minutos_apos_abertura,
                roles.nome as nome_role_destino
            FROM {DB_SCHEMA}.incidente i
            JOIN {DB_SCHEMA}.regra r ON i.id_regra = r.id_regra
            JOIN {DB_SCHEMA}.regra_escalonamento re ON re.id_regra = i.id_regra
            JOIN {DB_SCHEMA}.roles roles ON re.id_role_destino = roles.id_role
            WHERE 
                i.status = 'ABERTO'
                AND re.id_escalonamento = (
                    SELECT id_escalonamento 
                    FROM {DB_SCHEMA}.regra_escalonamento 
                    WHERE id_regra = i.id_regra 
                    ORDER BY minutos_apos_abertura ASC 
                    LIMIT 1 OFFSET i.nivel_escalonamento
                )
                AND NOW() >= (i.data_abertura + (re.minutos_apos_abertura || ' minutes')::interval)
        """
        
        cur.execute(query)
        pendentes = cur.fetchall()
        
        if not pendentes:
            return 

        print(f" [Escalonador] Encontrados {len(pendentes)} incidentes para escalar.")

        for inc in pendentes:
            id_incidente = inc['id_incidente']
            role_id = inc['id_role_destino']
            role_nome = inc['nome_role_destino']
            nivel_atual = inc['nivel_escalonamento']
            minutos = inc['minutos_apos_abertura']
            nome_regra = inc['nome_regra']

            print(f"   >>> Escalando Incidente #{id_incidente} (Nível {nivel_atual} -> {nivel_atual + 1}) para Role: {role_nome}")

            # 2. BUSCA PLANTONISTAS (COM VALIDAÇÃO DE JANELA DE HORÁRIO)
            query_plantonistas = f"""
                SELECT DISTINCT u.email, u.nome
                FROM {DB_SCHEMA}.escala e
                JOIN {DB_SCHEMA}.usuario u ON e.id_usuario = u.id_usuario
                JOIN {DB_SCHEMA}.configuracoes_notificacao cn ON u.id_usuario = cn.id_usuario
                WHERE 
                    e.id_role = %s 
                    AND NOW() BETWEEN e.data_inicio AND e.data_fim
                    AND cn.habilitado = TRUE
                    AND cn.id_tipo_canal = 2 -- EMAIL
                    AND (
                        (u.notificacao_janela_inicio IS NULL OR u.notificacao_janela_fim IS NULL)
                        OR
                        (
                            u.notificacao_janela_inicio <= u.notificacao_janela_fim
                            AND CURRENT_TIME BETWEEN u.notificacao_janela_inicio AND u.notificacao_janela_fim
                        )
                        OR
                        (
                            u.notificacao_janela_inicio > u.notificacao_janela_fim
                            AND (
                                CURRENT_TIME >= u.notificacao_janela_inicio
                                OR CURRENT_TIME <= u.notificacao_janela_fim
                            )
                        )
                    )
            """
            cur.execute(query_plantonistas, (role_id,))
            plantonistas = cur.fetchall()

            if not plantonistas:
                print(f"   !!! Ninguém de plantão disponível na Role {role_nome}. Escalonamento adiado.")
                continue 

            # 3. ENVIA NOTIFICAÇÕES
            enviados = 0
            for plantonista in plantonistas:
                email = plantonista['email']
                assunto = f" ESCALONAMENTO: Incidente #{id_incidente} não atendido!"
                corpo = f"""
                    <h2>Atenção {plantonista['nome']}</h2>
                    <p>O incidente <strong>#{id_incidente}</strong> (Regra: {nome_regra}) está aberto há <strong>{minutos} minutos</strong> sem resolução.</p>
                    <p>Você foi acionado via política de escalonamento (Role: {role_nome}).</p>
                    <p>Acesse o painel imediatamente.</p>
                """
                
                if enviar_email_smtp(email, assunto, corpo):
                    enviados += 1
                    cur.execute(f"""
                        INSERT INTO {DB_SCHEMA}.log_notificacoes
                        (id_incidente, id_usuario_destinatario, id_tipo_canal, status_envio, destino_envio, conteudo_enviado, mensagem_erro)
                        VALUES (%s, (SELECT id_usuario FROM {DB_SCHEMA}.usuario WHERE email=%s), 2, 'ENVIADO', %s, 'ESCALONAMENTO', NULL)
                    """, (id_incidente, email, email))

            # 4. ATUALIZA NÍVEL
            if enviados > 0:
                cur.execute(f"""
                    UPDATE {DB_SCHEMA}.incidente
                    SET nivel_escalonamento = nivel_escalonamento + 1, data_ultimo_escalonamento = NOW()
                    WHERE id_incidente = %s
                """, (id_incidente,))
                
                notificar_webhook_dashboard(
                    f"Incidente #{id_incidente} escalado para {role_nome} ({enviados} notificados)", 
                    "ESCALONAMENTO", 
                    id_incidente
                )
                conn.commit()
                print(f"   >>> Sucesso. Nível atualizado.")
            else:
                print("   !!! Falha no envio SMTP.")

    except Exception as e:
        print(f"Erro no Escalonador: {e}")
        conn.rollback()
    finally:
        conn.close()