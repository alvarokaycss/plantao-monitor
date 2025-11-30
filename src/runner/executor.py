# flake8: noqa
# type: ignore

import time
from db import get_db_connection, DB_SCHEMA

IDLE_TIME_SEC = 5

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
            RETURNING id_fila, id_regra;
        """
        
        cur.execute(query_reserva)
        item = cur.fetchone()
        conn.commit()

        if not item:
            cur.close()
            conn.close()
            return False 

        id_fila, id_regra = item
        print(f"🔨 [Worker] Processando Fila #{id_fila} (Regra {id_regra})...")

        # --- 2. BUSCAR A REGRA ---
        cur.execute(f"SELECT consulta_sql, nome FROM {DB_SCHEMA}.regra WHERE id_regra = %s", (id_regra,))
        regra = cur.fetchone()
        
        sql_execucao = regra[0]
        nome_regra = regra[1]

        # --- 3. EXECUÇÃO DA QUERY ---
        start_time = time.time()
        status_execucao = 'SUCESSO'
        resultado_contagem = 0
        mensagem_erro = None

        try:
            cur.execute(sql_execucao)
            resultado_contagem = cur.rowcount 
            if resultado_contagem == -1: 
                 resultado_contagem = 1 
            
            print(f"   > Regra '{nome_regra}' rodou OK.")
            conn.commit()

        except Exception as err_regra:
            conn.rollback()
            status_execucao = 'FALHA'
            mensagem_erro = str(err_regra)
            print(f"   > Falha na regra: {mensagem_erro}")

        end_time = time.time()
        duracao_ms = int((end_time - start_time) * 1000)

        # --- 4. LOG ---
        cur.execute(f"""
            INSERT INTO {DB_SCHEMA}.log_execucoes_regras 
            (id_regra, data_execucao, duracao_ms, status_execucao, resultado_contagem, mensagem_erro)
            VALUES (%s, NOW(), %s, %s, %s, %s)
        """, (id_regra, duracao_ms, status_execucao, resultado_contagem, mensagem_erro))

        # --- 5. FINALIZAR ---
        cur.execute(f"""
            UPDATE {DB_SCHEMA}.fila_runner 
            SET status = 'CONCLUIDO', data_fim_processamento = NOW(), mensagem_erro = %s
            WHERE id_fila = %s
        """, (mensagem_erro, id_fila))

        conn.commit()
        cur.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ Erro Crítico no Worker: {e}")
        if conn: conn.rollback()
        return False

if __name__ == "__main__":
    print(f"👷 Executor Python Inicializado (Schema: {DB_SCHEMA})! Aguardando ...")
    while True:
        trabalhou = processar_fila()
        if not trabalhou:
            time.sleep(IDLE_TIME_SEC)