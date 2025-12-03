# src/runner/executor.py
# flake8: noqa
# type: ignore

import os
import time
import json
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from db import get_db_connection, DB_SCHEMA

IDLE_TIME_SEC = 5

# --- HELPERS UTILITÁRIOS ---

class DateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def enviar_email_smtp(destinatario, assunto, corpo_html):
    """Envia e-mail real via SMTP (Isolado)"""
    server_host = os.getenv("SMTP_SERVER")
    port = os.getenv("SMTP_PORT")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")

    if not all([server_host, port, user, password]):
        print("    SMTP não configurado. E-mail pulado.")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = user
        msg['To'] = destinatario
        msg['Subject'] = assunto
        msg.attach(MIMEText(corpo_html, 'html'))

        server = smtplib.SMTP(server_host, int(port))
        server.starttls()
        server.login(user, password)
        server.sendmail(user, destinatario, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"    Erro SMTP: {e}")
        return False

def notificar_webhook_dashboard(msg, tipo="INFO", id_incidente=None):
    """Notifica o painel em tempo real (Isolado)"""
    try:
        url = "http://localhost:8000/webhook/notify-update"
        payload = {
            "mensagem": msg,
            "tipo": tipo,
            "id_incidente": id_incidente
        }
        requests.post(url, json=payload, timeout=2)
    except Exception as e:
        print(f"    Erro Webhook: {e}")

# --- FUNÇÕES DE NEGÓCIO ---

def reservar_job(conn):
    cur = conn.cursor()
    query = f"""
        UPDATE {DB_SCHEMA}.fila_runner
        SET status = 'PROCESSANDO', data_inicio_processamento = NOW()
        WHERE id_fila = (
            SELECT id_fila FROM {DB_SCHEMA}.fila_runner
            WHERE status = 'PENDENTE'
            ORDER BY id_fila ASC LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        RETURNING id_fila, id_regra, tentativas;
    """
    cur.execute(query)
    row = cur.fetchone()
    conn.commit()
    return row 

def buscar_regra(conn, id_regra):
    cur = conn.cursor()
    cur.execute(f"""
        SELECT consulta_sql, nome, qnt_erro_max, prioridade 
        FROM {DB_SCHEMA}.regra WHERE id_regra = %s
    """, (id_regra,))
    return cur.fetchone() 

def executar_sql(conn, sql, nome_regra):
    start = time.time()
    cur = conn.cursor()
    
    resultado = {
        "status": "SUCESSO",
        "linhas": 0,
        "erro": None,
        "amostra": None,
        "duracao_ms": 0
    }

    try:
        cur.execute(sql)
        if cur.description:
            rows = cur.fetchall()
            resultado["linhas"] = len(rows)
            if resultado["linhas"] > 0:
                cols = [d[0] for d in cur.description]
                amostra = [dict(zip(cols, r)) for r in rows[:5]]
                resultado["amostra"] = json.dumps(amostra, cls=DateEncoder, ensure_ascii=False)
        else:
            resultado["linhas"] = cur.rowcount
        
        conn.commit()
        print(f"   > Regra '{nome_regra}' OK. Linhas: {resultado['linhas']}")

    except Exception as e:
        conn.rollback()
        resultado["status"] = "FALHA"
        resultado["erro"] = str(e)
        print(f"   > Regra '{nome_regra}' FALHOU: {e}")

    resultado["duracao_ms"] = int((time.time() - start) * 1000)
    return resultado

def gerenciar_incidente(conn, id_regra, nome_regra, prioridade, resultado):
    """
    Retorna um dicionário com metadados do incidente ou None.
    Ex: {'id': 10, 'tipo': 'EXISTENTE'}
    """
    deve_criar = (resultado["status"] == 'FALHA') or (resultado["linhas"] > 0)
    
    if not deve_criar:
        return None

    cur = conn.cursor()
    
    # 4.1 Dedup
    cur.execute(f"""
        SELECT id_incidente FROM {DB_SCHEMA}.incidente 
        WHERE id_regra = %s AND status IN ('ABERTO', 'RECONHECIDO')
    """, (id_regra,))
    existente = cur.fetchone()

    if existente:
        print(f"   ! Incidente já existe (#{existente[0]}).")
        # Retorna metadados, mas NÃO notifica ainda (espera o commit final)
        return {"id": existente[0], "tipo": "EXISTENTE"}

    # 4.2 Criação
    amostra_final = resultado["amostra"]
    if not amostra_final and resultado["erro"]:
        amostra_final = json.dumps({"erro_tecnico": resultado["erro"]})

    print(f"   ! Criando novo incidente...")
    cur.execute(f"""
        INSERT INTO {DB_SCHEMA}.incidente 
        (id_regra, status, prioridade_registro, data_abertura, dados_amostra)
        VALUES (%s, 'ABERTO', %s, NOW(), %s)
        RETURNING id_incidente
    """, (id_regra, prioridade, amostra_final))
    
    novo_id = cur.fetchone()[0]
    conn.commit()

    return {"id": novo_id, "tipo": "CRIADO"}

def processar_notificacoes_email(conn, id_incidente, id_regra, nome_regra, prioridade):
    """Notifica APENAS via E-mail (O Webhook fica para o final)"""
    print(f"   @ Buscando plantonistas (Email)...")
    cur = conn.cursor()
    query = f"""
        SELECT DISTINCT u.id_usuario, cn.id_tipo_canal, cn.endereco_notificacao, tcn.nome
        FROM {DB_SCHEMA}.regra_role rr
        JOIN {DB_SCHEMA}.escala e ON rr.id_role = e.id_role
        JOIN {DB_SCHEMA}.usuario u ON e.id_usuario = u.id_usuario
        JOIN {DB_SCHEMA}.configuracoes_notificacao cn ON u.id_usuario = cn.id_usuario
        JOIN {DB_SCHEMA}.tipos_canal_notificacao tcn ON cn.id_tipo_canal = tcn.id_tipo_canal
        WHERE rr.id_regra = %s AND NOW() BETWEEN e.data_inicio AND e.data_fim AND cn.habilitado = TRUE
    """
    cur.execute(query, (id_regra,))
    destinatarios = cur.fetchall()

    if not destinatarios:
        print("   @ Nenhum plantonista ativo encontrado.")
        return

    for (uid, cid, endereco, canal) in destinatarios:
        status_envio = 'ERRO'
        msg_txt = f"A regra '{nome_regra}' falhou. Incidente #{id_incidente}."
        
        if 'EMAIL' in canal.upper():
            print(f"    Enviando para {endereco}...")
            html = f"""
                <h2>🚨 Alerta de Incidente #{id_incidente}</h2>
                <p><strong>Regra:</strong> {nome_regra}</p>
                <p><strong>Prioridade:</strong> {prioridade}</p>
                <p>Acesse o painel para agir.</p>
            """
            if enviar_email_smtp(endereco, f"[Monitor] Incidente #{id_incidente}", html):
                status_envio = 'ENVIADO'
            else:
                status_envio = 'FALHA_SMTP'
        else:
            status_envio = 'SIMULADO'

        cur.execute(f"""
            INSERT INTO {DB_SCHEMA}.log_notificacoes
            (id_incidente, id_usuario_destinatario, id_tipo_canal, status_envio, destino_envio, conteudo_enviado, data_envio)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (id_incidente, uid, cid, status_envio, endereco, msg_txt))
    
    conn.commit()

def finalizar_job(conn, id_fila, id_regra, resultado, id_incidente, tentativas_atuais, max_erros):
    cur = conn.cursor()
    
    # 6.1 Log de Execução (Onde está o erro, o tempo, etc)
    cur.execute(f"""
        INSERT INTO {DB_SCHEMA}.log_execucoes_regras 
        (id_regra, data_execucao, duracao_ms, status_execucao, resultado_contagem, mensagem_erro, id_incidente_gerado)
        VALUES (%s, NOW(), %s, %s, %s, %s, %s)
    """, (id_regra, resultado["duracao_ms"], resultado["status"], resultado["linhas"], resultado["erro"], id_incidente))

    # 6.2 Atualiza Fila
    sucesso = resultado["status"] == 'SUCESSO'
    
    if sucesso:
        cur.execute(f"UPDATE {DB_SCHEMA}.fila_runner SET status='CONCLUIDO', data_fim_processamento=NOW(), mensagem_erro=NULL WHERE id_fila=%s", (id_fila,))
    else:
        nova_tentativa = tentativas_atuais + 1
        if nova_tentativa < max_erros:
            cur.execute(f"UPDATE {DB_SCHEMA}.fila_runner SET status='PENDENTE', tentativas=%s, mensagem_erro=%s WHERE id_fila=%s", (nova_tentativa, resultado["erro"], id_fila))
        else:
            cur.execute(f"UPDATE {DB_SCHEMA}.fila_runner SET status='FALHA', tentativas=%s, data_fim_processamento=NOW(), mensagem_erro=%s WHERE id_fila=%s", (nova_tentativa, resultado["erro"], id_fila))

    conn.commit()

# --- ORQUESTRADOR PRINCIPAL ---

def processar_fila():
    conn = get_db_connection()
    if not conn: return False

    try:
        # 1. Reserva
        job = reservar_job(conn)
        if not job:
            conn.close()
            return False
        
        id_fila, id_regra, tentativas = job
        tentativas = tentativas or 0
        
        print(f"🔨 [Executor] Job #{id_fila}: Regra {id_regra} (Tentativa {tentativas+1})")

        # 2. Dados da Regra
        dados_regra = buscar_regra(conn, id_regra)
        if not dados_regra:
            with conn.cursor() as c:
                c.execute(f"UPDATE {DB_SCHEMA}.fila_runner SET status='FALHA', mensagem_erro='Regra não existe' WHERE id_fila=%s", (id_fila,))
                conn.commit()
            conn.close()
            return True

        sql, nome, max_erros, prioridade = dados_regra
        max_erros = max_erros or 1
        prioridade = prioridade or 3

        # 3. Execução
        resultado = executar_sql(conn, sql, nome)

        # 4. Incidente
        # info_incidente agora é um dict: {'id': 1, 'tipo': 'CRIADO'}
        info_incidente = gerenciar_incidente(conn, id_regra, nome, prioridade, resultado)
        
        id_incidente = info_incidente["id"] if info_incidente else None

        # 5. Notificação Email (Assíncrono no mundo real, aqui síncrono antes do commit final para garantir envio)
        if id_incidente:
             processar_notificacoes_email(conn, id_incidente, id_regra, nome, prioridade)

        # 6. Finalização (Commit dos Logs e Status da Fila)
        finalizar_job(conn, id_fila, id_regra, resultado, id_incidente, tentativas, max_erros)

        # 7. Só notificamos o Dashboard AGORA, depois que o finalizar_job deu commit.
        # Assim, quando o front vier buscar, os dados JÁ ESTARÃO lá.
        if info_incidente:
            tipo_evento = "INCIDENTE_CRIADO" if info_incidente["tipo"] == "CRIADO" else "INCIDENTE_ATUALIZADO"
            msg_webhook = f"Incidente #{id_incidente} atualizado na regra '{nome}'"
            
            notificar_webhook_dashboard(msg_webhook, tipo_evento, id_incidente)

        conn.close()
        return True

    except Exception as e:
        print(f"❌ Erro Crítico (Main Loop): {e}")
        if conn: conn.rollback(); conn.close()
        return False

if __name__ == "__main__":
    print(f"Executor Iniciado! Schema: {DB_SCHEMA}")
    while True:
        trabalhou = processar_fila()
        if not trabalhou:
            time.sleep(IDLE_TIME_SEC)
