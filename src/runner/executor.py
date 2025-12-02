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
            RETURNING id_fila, id_regra, tentativas;
        """
        
        cur.execute(query_reserva)
        item = cur.fetchone()
        conn.commit()

        if not item:
            cur.close(); conn.close()
            return False 

        id_fila, id_regra, tentativas_atuais = item
        # Se tentativas vier None (banco legado), assume 0
        if tentativas_atuais is None: tentativas_atuais = 0
        
        print(f"🔨 [Executor] Processando Fila #{id_fila} (Regra {id_regra}) - Tentativa {tentativas_atuais + 1}...")

        # --- 2. BUSCAR REGRA E CONFIGURAÇÃO DE ERRO ---
        # Buscamos o SQL e o LIMITE DE ERROS da regra
        cur.execute(f"SELECT consulta_sql, nome, qnt_erro_max FROM {DB_SCHEMA}.regra WHERE id_regra = %s", (id_regra,))
        regra = cur.fetchone()
        
        if not regra:
            # Regra sumiu? Falha.
            cur.execute(f"UPDATE {DB_SCHEMA}.fila_runner SET status='FALHA', mensagem_erro='Regra não existe' WHERE id_fila=%s", (id_fila,))
            conn.commit(); cur.close(); conn.close()
            return True

        sql_execucao = regra[0]
        nome_regra = regra[1]
        limite_max_erros = regra[2]
        
        # Fallback: Se limite for None ou 0, assume 1 (tenta uma vez e desiste)
        if limite_max_erros is None or limite_max_erros < 1:
            limite_max_erros = 1

        # --- 3. EXECUTAR ---
        start_time = time.time()
        status_execucao = 'SUCESSO'
        resultado_contagem = 0
        mensagem_erro = None
        sucesso_operacao = False

        try:
            # Executa a regra
            cur.execute(sql_execucao)
            resultado_contagem = cur.rowcount 
            if resultado_contagem == -1: resultado_contagem = 1 
            
            print(f"   > Regra '{nome_regra}' rodou OK.")
            conn.commit() # Commit da regra
            sucesso_operacao = True

        except Exception as err_regra:
            conn.rollback() # Rollback da regra
            status_execucao = 'FALHA'
            mensagem_erro = str(err_regra)
            print(f"   > Falha na regra: {mensagem_erro}")

        end_time = time.time()
        duracao_ms = int((end_time - start_time) * 1000)

        # --- 4. LOG (Sempre grava) ---
        cur.execute(f"""
            INSERT INTO {DB_SCHEMA}.log_execucoes_regras 
            (id_regra, data_execucao, duracao_ms, status_execucao, resultado_contagem, mensagem_erro)
            VALUES (%s, NOW(), %s, %s, %s, %s)
        """, (id_regra, duracao_ms, status_execucao, resultado_contagem, mensagem_erro))

        # --- 5. FINALIZAR (A Lógica de Decisão) ---
        if sucesso_operacao:
            # Sucesso: Marca CONCLUIDO e zera erro
            cur.execute(f"""
                UPDATE {DB_SCHEMA}.fila_runner 
                SET status = 'CONCLUIDO', data_fim_processamento = NOW(), mensagem_erro = NULL
                WHERE id_fila = %s
            """, (id_fila,))
        else:
            # Falha: Verifica se pode tentar de novo
            novas_tentativas = tentativas_atuais + 1
            
            if novas_tentativas < limite_max_erros:
                # RETRY: Volta para PENDENTE, incrementa tentativas
                print(f"    Erro! Tentativa {novas_tentativas}/{limite_max_erros}. Reagendando...")
                cur.execute(f"""
                    UPDATE {DB_SCHEMA}.fila_runner 
                    SET status = 'PENDENTE', tentativas = %s, mensagem_erro = %s
                    WHERE id_fila = %s
                """, (novas_tentativas, mensagem_erro, id_fila))
            else:
                # DESISTE: Marca FALHA
                print(f"    Esgotou tentativas ({novas_tentativas}). Marcando FALHA.")
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
    