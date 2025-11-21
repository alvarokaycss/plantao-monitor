// src/models/AuxiliarService.js

const { pool, SCHEMA } = require("../db/db");
const { TABLES } = require("../utils/helpers");

/**
 * selectAll(tableKey)
 * - tableKey: chave amigável (ex: "usuarios", "regras")
 * - valida e executa SELECT * FROM <table>
 */
exports.selectAll = async (tableKey) => {
    const tableName = TABLES[tableKey];
    if (!tableName) {
        const error = new Error("Tabela não permitida");
        error.code = "TABLE_NOT_ALLOWED";
        throw error;
    }

    const client = await pool.connect();
    try {
        const q = `SELECT * FROM ${SCHEMA}.${tableName} ORDER BY 1;`;
        const { rows } = await client.query(q);
        return rows;
    } finally {
        client.release();
    }
}