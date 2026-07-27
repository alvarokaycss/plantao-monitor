// src/db/db.ts

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = process.env.DB_SCHEMA ? process.env.DB_SCHEMA.trim() : undefined;

if (!SCHEMA) {
    console.error("ERRO: variável DB_SCHEMA não definida ou está vazia. Verifique seu arquivo .env.");
    process.exit(1);
}

if (!DATABASE_URL) {
    console.error("ERRO: variável DATABASE_URL não definida. Crie um .env na raiz ou defina a variável.");
    process.exit(1);
}

// Inicializa o Pool de conexões PostgreSQL tipado nativamente pelo @types/pg
export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export const DB_SCHEMA: string = SCHEMA;
export { SCHEMA };
