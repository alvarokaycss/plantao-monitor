# flake8: noqa
# type: ignore

import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Caminho Absoluto
base_dir = Path(__file__).resolve().parent
env_path = base_dir.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Pega o SCHEMA do .env
DB_SCHEMA = os.getenv("DB_SCHEMA")

def get_db_connection():
    url = os.getenv("DATABASE_URL")
    if not url:
        print(f" ERRO: DATABASE_URL não encontrada.")
        return None
    try:
        conn = psycopg2.connect(url)
        return conn
    except Exception as e:
        print(f" Erro de Conexão: {e}")
        return None
    