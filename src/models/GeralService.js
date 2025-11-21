// src/models/GeralService.js

const { pool, SCHEMA } = require("../db/db");
const { TABLES } = require("../utils/helpers");

/**
 * Função genérica para buscar SELECT * em tabelas auxiliares/log.
 * @param {string} tableKey - Chave da tabela (ex: "log_execucoes").
 * @returns {Array} - Lista de registros.
 */
const selectAll = async (tableKey) => {
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

// Funções de Log (RF15)
exports.getLogExecucoes = () => selectAll("log_execucoes");
exports.getLogNotificacoes = () => selectAll("log_notificacoes");
exports.getLogAuditoria = () => selectAll("log_auditoria");