// src/models/EscalasService.js

const { pool, SCHEMA } = require("../db/db");
const { asInteger, normalizeDateToISO } = require("../utils/helpers");

/**
 * Busca todas as escalas cadastradas (SELECT * FROM escala).
 * @returns {Array} - Lista de escalas.
 */
exports.getAllEscalas = async () => {
    const client = await pool.connect();
    try {
        // Query original do selectAll, focada na tabela escala
        const q = `SELECT * FROM ${SCHEMA}.escala ORDER BY data_inicio DESC;`; 
        const { rows } = await client.query(q);
        return rows;
    } finally {
        client.release();
    }
}

/**
 * Insere uma nova escala no banco de dados.
 * @param {object} payload - Dados da escala já normalizados.
 * @returns {object} - A escala criada.
 */
exports.createEscala = async (payload) => {
    const { idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal } = payload;
    const client = await pool.connect();

    try {
        const insertQuery = `
            INSERT INTO ${SCHEMA}.escala (id_usuario, id_role, data_inicio, data_fim)
            VALUES ($1, $2, $3, $4)
            RETURNING id_escala, id_usuario, id_role, data_inicio, data_fim;
        `;
        const values = [idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal];
        
        const { rows } = await client.query(insertQuery, values);
        return rows[0];

    } catch (error) {
        throw error;
    } finally {
        if (client) client.release();
    }
}