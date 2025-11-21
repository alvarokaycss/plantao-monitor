// src/models/IncidentesService.js

const { pool, SCHEMA } = require("../db/db");
const { asInteger } = require("../utils/helpers");

/**
 * Busca incidentes com base em filtros (status, prioridade)
 * @param {object} filtros - { status, prioridade }
 * @returns {Array} - Lista de incidentes.
 */
exports.selectIncidentesFiltrados = async (filtros = {}) => {
    const { status, prioridade } = filtros;
    const client = await pool.connect();

    try {
        const condicoes = []; 
        const valores = []; 
        let queryIndex = 1;

        if (status) {
            const statusValidos = ['ABERTO', 'RECONHECIDO', 'FECHADO'];
            if (statusValidos.includes(status.toUpperCase())) {
                condicoes.push(`status = $${queryIndex}`);
                valores.push(status.toUpperCase());
                queryIndex++;
            }
        }

        const prioridadeVal = asInteger(prioridade);
        if (prioridadeVal) {
            condicoes.push(`prioridade_registro = $${queryIndex}`);
            valores.push(prioridadeVal);
            queryIndex++;
        }

        let q = `
            SELECT 
                i.*, 
                r.nome as nome_regra 
            FROM ${SCHEMA}.incidente i 
            LEFT JOIN ${SCHEMA}.regra r ON i.id_regra = r.id_regra
        `;

        if (condicoes.length > 0) {
            q += ` WHERE ${condicoes.join(' AND ')}`;
        }
        
        q += ` ORDER BY data_abertura DESC;`; 
        
        const { rows } = await client.query(q, valores);
        return rows;

    } finally {
        client.release();
    }
};

/**
 * Busca detalhes de um incidente (com nomes de usuários envolvidos).
 * @param {number} idIncidenteVal - ID do incidente.
 * @returns {object} - Detalhes do incidente.
 */
exports.getIncidenteDetalhes = async (idIncidenteVal) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                i.*,
                r.nome AS nome_regra,
                u_ack.nome AS nome_usuario_ack,
                u_close.nome AS nome_usuario_fechamento
            FROM ${SCHEMA}.incidente i
            LEFT JOIN ${SCHEMA}.regra r ON i.id_regra = r.id_regra
            LEFT JOIN ${SCHEMA}.usuario u_ack ON i.id_usuario_ack = u_ack.id_usuario
            LEFT JOIN ${SCHEMA}.usuario u_close ON i.id_usuario_fechamento = u_close.id_usuario
            WHERE i.id_incidente = $1;
        `;
        
        const { rows } = await client.query(query, [idIncidenteVal]);
        return rows[0];

    } finally {
        client.release();
    }
};

/**
 * Reconhece (ACK) um incidente.
 * @param {number} idIncidenteVal - ID do incidente.
 * @param {number} idUsuarioVal - ID do usuário.
 * @returns {object} - Incidente atualizado.
 */
exports.ackIncident = async (idIncidenteVal, idUsuarioVal) => {
    const client = await pool.connect();
    try {
        const updateQuery = `
            UPDATE ${SCHEMA}.incidente
            SET 
                status = 'RECONHECIDO',
                data_ack = CURRENT_TIMESTAMP,
                id_usuario_ack = $1
            WHERE
                id_incidente = $2
                AND status = 'ABERTO' 
            RETURNING *;
        `;
        
        const { rows } = await client.query(updateQuery, [idUsuarioVal, idIncidenteVal]);
        return rows[0];

    } finally {
        client.release();
    }
};

/**
 * Fecha (CLOSE) um incidente.
 * @param {number} idIncidenteVal - ID do incidente.
 * @param {number} idUsuarioVal - ID do usuário.
 * @param {string} comentarioVal - Comentário do fechamento.
 * @returns {object} - Incidente atualizado.
 */
exports.closeIncident = async (idIncidenteVal, idUsuarioVal, comentarioVal) => {
    const client = await pool.connect();
    try {
        const updateQuery = `
            UPDATE ${SCHEMA}.incidente
            SET 
                status = 'FECHADO',
                data_fechamento = CURRENT_TIMESTAMP,
                id_usuario_fechamento = $1,
                comentario_incidente = $2
            WHERE
                id_incidente = $3
                AND status = 'RECONHECIDO'
            RETURNING *;
        `;
        
        const { rows } = await client.query(updateQuery, [idUsuarioVal, comentarioVal, idIncidenteVal]);
        return rows[0];

    } finally {
        client.release();
    }
};