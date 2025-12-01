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
        cur = conn.cursor()
        
        # --- QUERY COM SCHEMA ---
        query = f"""
            INSERT INTO {DB_SCHEMA}.fila_runner (id_regra, status)
            SELECT id_regra, 'PENDENTE'
            FROM {DB_SCHEMA}.regra
            WHERE 
                CURRENT_TIME BETWEEN janela_inicio AND janela_fim
                AND (
                    (data_adiar_inicio IS NULL OR NOW() NOT BETWEEN data_adiar_inicio AND data_adiar_fim)
                    AND
                    (data_silenciar_inicio IS NULL OR NOW() NOT BETWEEN data_silenciar_inicio AND data_silenciar_fim)
                )
                AND (EXTRACT(MINUTE FROM NOW())::int % intervalo_minutos) = 0
            RETURNING id_regra;
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        conn.commit()
        
        if rows:
            ids = [str(r[0]) for r in rows]
            print(f"✅ Regras agendadas: {', '.join(ids)}")
        else:
            print("💤 Nenhuma regra para agora.")
            
        cur.close()
        conn.close()

    except Exception as e:
        print(f" Erro no Orquestrador: {e}")


schedule.every(1).minutes.do(verificar_regras)
print(f"Orquestrador Python Inicializado (Schema: {DB_SCHEMA})...")

while True:
    schedule.run_pending()
    time.sleep(1)
    