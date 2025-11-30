# Plantão Monitor - Sistema de Gestão de Plantão

Sistema para monitoramento de regras de banco de dados, geração de incidentes e notificações.

## Pré-requisitos

- Node.js (v14+)
- Python (v3.8+)
- PostgreSQL (Rodando localmente)

## Como Rodar Localmente (Passo a Passo)

### 1. Configuração do Banco de Dados
1. Crie um banco de dados no Postgres (ex: `plantao_monitor`).
2. Execute os scripts da pasta `database/migrations` na ordem numérica (001, 002...) para criar as tabelas.
3. Configure o arquivo `.env` na raiz do projeto:
   ```env
   DATABASE_URL=postgres://usuario:senha@localhost:5432/plantao_monitor
   DB_SCHEMA=public
   PORT=8000

# Instalar dependências
npm install

# Rodar a API
npm start
# Ou: node api_qq_monitor.js

Acesse http//localhost:8000 através do terminal

### 2. Configuração do Firebase
...

# **CONFIGURAÇÃO SUPERADMIN**

1. Realize o cadastro via UI na plataforma depois de acessar o link.
2. Acesse o seu Dbeaver e rode o script na pasta `database/seed/002_seeds_admin_user.sql`.
**ATENÇÃO: LEIA O `README_DATABASE.md` antes de rodar as seeds.**

## PYTHON ## 

# Criar e ativar ambiente virtual (Recomendado)
python -m venv .venv
# Windows: .venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# --- TERMINAL A: O orquestrador ---
python src/runner/orquestrador.py

# --- TERMINAL B: O Executor (Worker) ---
python src/runner/executor.py
