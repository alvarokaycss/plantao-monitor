# src/scheduler/orchestrator.py
# flake8: noqa
# type: ignore

import time
import schedule
from datetime import datetime
from db import get_db_connection, DB_SCHEMA

def verificar_regras():
    print(f"[{datetime.now()}] Verificando regras...")
    
    conn = get_db_connection()
    if not conn: return
    
    try:
        with conn.cursor() as cur:
            
            # --- QUERY ---
            query = f"""
                INSERT INTO {DB_SCHEMA}.fila_runner (id_regra, status)
                SELECT id_regra, 'PENDENTE'
                FROM {DB_SCHEMA}.regra
                WHERE 
                    CURRENT_TIME BETWEEN janela_inicio AND janela_fim
                    AND (data_adiar_inicio IS NULL OR NOW() NOT BETWEEN data_adiar_inicio AND data_adiar_fim)
                    AND (EXTRACT(MINUTE FROM NOW())::int % intervalo_minutos) = 0
                RETURNING id_regra;
            """
            
            cur.execute(query)
            rows = cur.fetchall()
            conn.commit()
            
            if rows:
                ids = [str(r['id_regra']) for r in rows]
                print(f"✅ Regras agendadas: {', '.join(ids)}")
            else:
                print("💤 Nenhuma regra para agora.")
            
    except Exception as e:
        print(f" Erro no Orquestrador: {e}")
        conn.rollback() 
    finally:
        conn.close()


schedule.every(1).minutes.do(verificar_regras)
print(f"Orquestrador Python Inicializado (Schema: {DB_SCHEMA})...")


if __name__ == "__main__":
    # Executa pela primeira vez
    verificar_regras()
    
    while True:
        schedule.run_pending()
        time.sleep(1)