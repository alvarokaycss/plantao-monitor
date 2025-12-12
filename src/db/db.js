// src/db/db.js

const { Pool } = require("pg");
const process = require("process");

// As variáveis de ambiente devem estar disponíveis pois são carregadas pelo api_qq_monitor.js

const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = process.env.DB_SCHEMA ? process.env.DB_SCHEMA.trim() : undefined;

// O Pool de conexões do Postgres
const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Configurações básicas e de verificação de variáveis ambiente
 */
if (!SCHEMA) {
    console.error("ERRO: variável DB_SCHEMA não definida ou está vazia. Verifique seu arquivo .env.");
    process.exit(1);
};

if (!DATABASE_URL) {
    console.error("ERRO: variável DATABASE_URL não definida. Crie um .env na raiz ou defina a variável.");
    process.exit(1);
};

module.exports = {
    pool,
    SCHEMA
};