# src/runner/executor.py
# flake8: noqa
# type: ignore

import time
import json
from datetime import datetime
from db import get_db_connection, DB_SCHEMA

IDLE_TIME_SEC = 5

class DateEncoder(json.JSONEncoder):
    """Helper para converter datas em JSON para gravar no banco"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def processar_fila():
    conn = get_db_connection()
    if not conn: return False

    try:
        cur = conn.cursor()

        # --- 1. RESERVAR (SKIP LOCKED) ---
        query_reserva = f"""
            UPDATE {DB_SCHEMA}.fila_runner
            SET 
                status = 'PROCESSANDO', 
                data_inicio_processamento = NOW()
            WHERE id_fila = (
                SELECT id_fila
                FROM {DB_SCHEMA}.fila_runner
                WHERE status = 'PENDENTE'
                ORDER BY id_fila ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id_fila, id_regra, tentativas;
        """
        
        cur.execute(query_reserva)
        item = cur.fetchone()
        conn.commit()

        if not item:
            cur.close(); conn.close()
            return False 

        id_fila, id_regra, tentativas_atuais = item
        if tentativas_atuais is None: tentativas_atuais = 0
        
        print(f"🔨 [Executor] Processando Fila #{id_fila} (Regra {id_regra})...")

        # --- 2. BUSCAR DADOS DA REGRA ---
        cur.execute(f"""
            SELECT consulta_sql, nome, qnt_erro_max, prioridade 
            FROM {DB_SCHEMA}.regra WHERE id_regra = %s
        """, (id_regra,))
        regra = cur.fetchone()
        
        if not regra:
            cur.execute(f"UPDATE {DB_SCHEMA}.fila_runner SET status='FALHA', mensagem_erro='Regra não existe' WHERE id_fila=%s", (id_fila,))
            conn.commit(); cur.close(); conn.close()
            return True

        sql_execucao = regra[0]
        nome_regra = regra[1]
        limite_max_erros = regra[2] or 1
        prioridade_regra = regra[3] or 3

        # --- 3. EXECUTAR A REGRA ---
        start_time = time.time()
        status_execucao = 'SUCESSO'
        resultado_contagem = 0
        mensagem_erro = None
        amostra_dados = None # JSON para o detalhe do incidente
        sucesso_operacao = False

        try:
            # Executa a SQL
            cur.execute(sql_execucao)
            
            # Verifica se retornou linhas (SELECT)
            if cur.description:
                rows = cur.fetchall()
                resultado_contagem = len(rows)
                
                # Se trouxe dados, pegamos uma amostra para exibir no detalhe
                if resultado_contagem > 0:
                    # Pega nomes das colunas
                    col_names = [desc[0] for desc in cur.description]
                    # Cria lista de dicionários (limitado a 5 linhas)
                    amostra = [dict(zip(col_names, row)) for row in rows[:5]]
                    amostra_dados = json.dumps(amostra, cls=DateEncoder, ensure_ascii=False)
            else:
                # INSERT/UPDATE/DELETE
                resultado_contagem = cur.rowcount 
            
            print(f"   > Regra '{nome_regra}' rodou. Linhas: {resultado_contagem}")
            conn.commit()
            sucesso_operacao = True

        except Exception as err_regra:
            conn.rollback()
            status_execucao = 'FALHA'
            mensagem_erro = str(err_regra)
            print(f"   > Falha na regra: {mensagem_erro}")

        end_time = time.time()
        duracao_ms = int((end_time - start_time) * 1000)

        # --- 4. GERAÇÃO DE INCIDENTE ---
        id_incidente_gerado = None
        
        # Lógica: Se falhou (Erro SQL) OU se retornou linhas (Regra de Negócio violada) -> Gera Incidente
        deve_gerar_incidente = (status_execucao == 'FALHA') or (resultado_contagem > 0)

        if deve_gerar_incidente:
            try:
                # Monta payload de erro se não tiver amostra de dados (caso de falha técnica)
                if not amostra_dados and mensagem_erro:
                    amostra_dados = json.dumps({"erro_tecnico": mensagem_erro})

                print(f"   ! DETECTADO PROBLEMA. Gerando incidente...")
                
                insert_incidente = f"""
                    INSERT INTO {DB_SCHEMA}.incidente 
                    (id_regra, status, prioridade_registro, data_abertura, dados_amostra)
                    VALUES (%s, 'ABERTO', %s, NOW(), %s)
                    RETURNING id_incidente;
                """
                cur.execute(insert_incidente, (id_regra, prioridade_regra, amostra_dados))
                id_incidente_gerado = cur.fetchone()[0]
                conn.commit()
                print(f"   ! Incidente #{id_incidente_gerado} criado com sucesso.")
            
            except Exception as e_inc:
                print(f"   X Erro ao criar incidente: {e_inc}")
                conn.rollback()

        # --- 5. LOG E FINALIZAÇÃO ---
        
        # Log da execução (Agora vinculando o incidente se houver)
        cur.execute(f"""
            INSERT INTO {DB_SCHEMA}.log_execucoes_regras 
            (id_regra, data_execucao, duracao_ms, status_execucao, resultado_contagem, mensagem_erro, id_incidente_gerado)
            VALUES (%s, NOW(), %s, %s, %s, %s, %s)
        """, (id_regra, duracao_ms, status_execucao, resultado_contagem, mensagem_erro, id_incidente_gerado))

        # Atualiza a Fila
        if sucesso_operacao:
            cur.execute(f"""
                UPDATE {DB_SCHEMA}.fila_runner 
                SET status = 'CONCLUIDO', data_fim_processamento = NOW(), mensagem_erro = NULL
                WHERE id_fila = %s
            """, (id_fila,))
        else:
            # Lógica de Retry simplificada
            novas_tentativas = tentativas_atuais + 1
            if novas_tentativas < limite_max_erros:
                cur.execute(f"""
                    UPDATE {DB_SCHEMA}.fila_runner 
                    SET status = 'PENDENTE', tentativas = %s, mensagem_erro = %s
                    WHERE id_fila = %s
                """, (novas_tentativas, mensagem_erro, id_fila))
            else:
                cur.execute(f"""
                    UPDATE {DB_SCHEMA}.fila_runner 
                    SET status = 'FALHA', tentativas = %s, data_fim_processamento = NOW(), mensagem_erro = %s
                    WHERE id_fila = %s
                """, (novas_tentativas, mensagem_erro, id_fila))

        conn.commit()
        cur.close()
        conn.close()
        return True

    except Exception as e:
        print(f"Erro Crítico no Executor: {e}")
        if conn: conn.rollback()
        return False

if __name__ == "__main__":
    print(f"Executor Iniciado! Schema: {DB_SCHEMA}")
    while True:
        trabalhou = processar_fila()
        if not trabalhou:
            time.sleep(IDLE_TIME_SEC)