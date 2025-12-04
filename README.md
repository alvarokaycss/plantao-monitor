# 📊 Plantão Monitor

Sistema Web de Gestão de Plantão e Monitoramento de Banco de Dados.

O **Plantão Monitor** automatiza a execução de regras de negócio (queries SQL), detecta anomalias, gera incidentes, notifica plantonistas e oferece um painel em tempo real para gestão de operações críticas.

---

## 🚀 Tecnologias Utilizadas

**Backend (API & Gestão):**
- **Node.js** com Express
- **Socket.io** (Comunicação Real-Time)
- **Firebase Admin SDK** (Autenticação)
- **PostgreSQL** (Banco de dados principal)

**Runner & Analytics (Motor de Execução):**
- **Python 3.8+**
- **Psycopg** (Conexão com Banco)
- **Pandas & Matplotlib** (Geração de Relatórios/Gráficos)
- **Schedule** (Agendamento de Tarefas)

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla ES6+)
- Firebase Client SDK

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:
- [Node.js](https://nodejs.org/) (v14 ou superior)
- [Python](https://www.python.org/) (v3.8 ou superior)
- [PostgreSQL](https://www.postgresql.org/)
- Conta no [Firebase](https://firebase.google.com/) (Projeto configurado com Authentication)

---

## ⚙️ Configuração e Instalação

### 1. Banco de Dados
1. Crie um banco de dados no PostgreSQL (ex: `plantao_monitor`).
2. Execute os scripts SQL localizados em `database/migrations` na ordem correta:
   - `001_schema_inicial.sql` (Criação de tabelas base)
   - `002_adiciona_fila_runner.sql` (Tabela de fila do Python)
3. (Opcional) Popule com dados iniciais rodando o script em `database/seed/001_seeds_iniciais.sql`.

### 2. Variáveis de Ambiente (.env)
Crie um arquivo `.env` na raiz do projeto e configure as variáveis:

```env
# Configuração do Servidor
PORT=8000
NODE_ENV=development

# Banco de Dados
DATABASE_URL=postgres://usuario:senha@localhost:5432/plantao_monitor
DB_SCHEMA=public

# (Opcional) Configuração de SMTP para envio de e-mails pelo Python
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app