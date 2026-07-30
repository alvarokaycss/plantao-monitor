// src/models/EscalasService.js

const { pool, SCHEMA } = require("../db/db");

/**
 * Busca todas as escalas com JOIN para trazer os nomes (Resolve o 'undefined')
 */
exports.getAllEscalas = async () => {
    const client = await pool.connect();
    try {
        const q = `
            SELECT 
                e.id_escala,
                e.data_inicio,
                e.data_fim,
                u.id_usuario,
                u.nome AS nome_usuario,  -- Alias fundamental para o front
                u.email AS email_usuario,
                r.id_role,
                r.nome AS nome_role      -- Alias fundamental para o front
            FROM ${SCHEMA}.escala e
            JOIN ${SCHEMA}.usuario u ON e.id_usuario = u.id_usuario
            JOIN ${SCHEMA}.roles r ON e.id_role = r.id_role
            ORDER BY e.data_inicio ASC;
        `;
        const { rows } = await client.query(q);
        return rows;
    } finally {
        client.release();
    }
}

/**
 * Cria uma escala existente.
 */
exports.createEscala = async (payload) => {
    const { idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal } = payload;
    const client = await pool.connect();

    try {
        // Validação de datas
        if (new Date(dataFimVal) <= new Date(dataInicioVal)) {
            throw new Error("A data final deve ser posterior à data inicial.");
        }

        const insertQuery = `
            INSERT INTO ${SCHEMA}.escala (id_usuario, id_role, data_inicio, data_fim)
            VALUES ($1, $2, $3, $4)
            RETURNING id_escala;
        `;
        const values = [idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal];
        
        const { rows } = await client.query(insertQuery, values);
        return rows[0];

    } finally {
        if (client) client.release();
    }
}

/**
 * Deleta uma escala existente.
 */
exports.deleteEscala = async (id) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM ${SCHEMA}.escala WHERE id_escala = $1`, [id]);
    } finally {
        client.release();
    }
}


/**
 * Atualiza uma escala existente.
 */
exports.updateEscala = async (idEscala, payload) => {
    const { idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal } = payload;
    
    const client = await pool.connect();
    try {
        const query = `
            UPDATE ${SCHEMA}.escala 
            SET 
                id_usuario = $1, 
                id_role = $2, 
                data_inicio = $3, 
                data_fim = $4
            WHERE id_escala = $5
            RETURNING id_escala;
        `;
        
        const result = await client.query(query, [
            idUsuarioVal, 
            idRoleVal, 
            dataInicioVal, 
            dataFimVal, 
            idEscala
        ]);
        
        if (result.rowCount === 0) {
            throw new Error('Escala não encontrada.');
        }
        
        return result.rows[0];

    } finally {
        client.release();
    }
};