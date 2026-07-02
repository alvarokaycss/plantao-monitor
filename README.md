# 📊 Plantão Monitor

O **Plantão Monitor** automatiza a execução de regras de negócio (queries SQL), detecta anomalias, gera incidentes, notifica plantonistas e oferece um painel em tempo real para gestão de operações críticas.

---

## 🚀 Arquitetura e Tecnologias

O sistema é composto por três partes principais que rodam em paralelo:

1. **Backend (API & WebSockets):**
   - **Node.js** com Express (API REST)
   - **Socket.io** (Comunicação em Tempo Real com o Dashboard)
   - **Firebase Admin SDK** (Autenticação e validação de tokens)
   - **PostgreSQL** (Banco de dados principal)

2. **Runner & Analytics (Motor de Execução):**
   - **Python 3.8+**
   - **Psycopg** (Conexão nativa e de alta performance com PostgreSQL)
   - **Schedule** (Agendamento de verificação de regras)
   - **Requests** (Envio de webhooks de atualização para a API Node)
   - **SMTP (smtplib)** (Disparo de alertas por e-mail para plantonistas)

3. **Frontend:**
   - HTML5, CSS3, JavaScript (Vanilla ES6+)
   - Firebase Client SDK (Autenticação do usuário)
   - Socket.io Client (Atualizações do painel em tempo real)

---

## 📋 Pré-requisitos

Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (v18 ou superior recomendado)
- [Python](https://www.python.org/) (v3.8 ou superior)
- [Docker](https://www.docker.com/) (para subir o banco de dados facilmente)

---

## ⚙️ Configuração e Instalação

### 1. Banco de Dados (PostgreSQL via Docker)
Para rodar um banco de dados limpo e configurado para o projeto, execute:
```bash
docker run --name pg-plantao-monitor -e POSTGRES_PASSWORD=alvaro22 -p 5432:5432 -d postgres
```

### 2. Variáveis de Ambiente (.env)
Crie um arquivo `.env` na raiz do projeto baseado no exemplo abaixo:
```env
# Configuração do Servidor Node.js
PORT=8000
NODE_ENV=development

# Conexão com o Banco de Dados (PostgreSQL)
DATABASE_URL=postgresql://postgres:alvaro22@localhost:5432/postgres
DB_SCHEMA=qq_monitor

# Configuração de SMTP para Notificações por E-mail (Python)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email-smtp@gmail.com
SMTP_PASSWORD=sua-senha-de-app-smtp
```

### 3. Firebase Admin SDK
Para autenticar os usuários no backend, é necessário colocar a chave do Firebase Admin no arquivo:
- `/firebase-service-account-key.json` (na raiz do projeto)

### 4. Executando as Migrations e Seeds
Abra seu cliente de banco de dados (DBeaver ou pgAdmin) conectado ao container do PostgreSQL e execute os scripts na ordem recomendada:

1. **Criar o Schema:**
   ```sql
   CREATE SCHEMA qq_monitor;
   ```
2. **Definir o Schema ativo:**
   ```sql
   SET search_path TO qq_monitor;
   ```
3. **Executar Migrations (em `database/migrations/`):**
   - `001_schema_inicial.sql`
   - `002_adiciona_fila_runner.sql`
   - `003_adiciona_regra_escalonamento.sql`
4. **Executar Seed Inicial (em `database/seed/`):**
   - `001_seeds_iniciais.sql`

---

## 🏃‍♂️ Como Rodar o Projeto

Para rodar a plataforma completa, você precisará de 3 terminais abertos executando cada um dos serviços:

### Terminal 1: Instalação e API / Backend (Node.js)
```bash
# Instalar dependências do Node
npm install

# Iniciar o servidor de desenvolvimento
node api_qq_monitor.js
# ou com nodemon:
npx nodemon api_qq_monitor.js
```
A API iniciará na porta `8000` (http://localhost:8000).

### Terminal 2: Orquestrador (Python)
```bash
# Ativar ambiente virtual
.venv\Scripts\Activate.ps1

# Instalar dependências Python
pip install -r requirements.txt

# Iniciar orquestrador
python src/runner/orquestrador.py
```

### Terminal 3: Executor (Python)
```bash
# Ativar ambiente virtual
.venv\Scripts\Activate.ps1

# Iniciar executor
python src/runner/executor.py
```

---

## 🔑 Ativando seu Usuário (Acesso Admin)
Ao acessar a plataforma pela primeira vez e criar uma conta no login, seu usuário ficará registrado como inativo (`ativo = false`). Para ativá-lo e conceder perfil de **Administrador**, execute a seguinte query no seu banco:

```sql
SET search_path TO qq_monitor;

-- 1. Ativa e define perfil de Admin
UPDATE usuario 
SET 
    ativo = TRUE, 
    id_perfil = 1
WHERE email = 'seu-email-de-cadastro@gmail.com';

-- 2. Concede permissão a todas as telas do sistema
INSERT INTO usuario_recursos (id_usuario, id_recurso)
SELECT 
    (SELECT id_usuario FROM usuario WHERE email = 'seu-email-de-cadastro@gmail.com'),
    id_recurso
FROM recursos
ON CONFLICT (id_usuario, id_recurso) DO NOTHING;
```