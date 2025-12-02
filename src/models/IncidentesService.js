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
 * Busca detalhes de um incidente (com nomes de usuários e LOGS DE AUDITORIA).
 */
exports.getIncidenteDetalhes = async (idIncidenteVal) => {
    const client = await pool.connect();
    try {
        // 1. Dados do Incidente
        const queryIncidente = `
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
        const resIncidente = await client.query(queryIncidente, [idIncidenteVal]);
        
        if (resIncidente.rows.length === 0) return null;

        // 2. Logs de Auditoria (Histórico lateral)
        const queryLogs = `
            SELECT 
                l.*,
                u.nome as nome_usuario
            FROM ${SCHEMA}.log_auditoria_alteracoes l
            LEFT JOIN ${SCHEMA}.usuario u ON l.id_usuario = u.id_usuario
            WHERE l.tabela_afetada = 'incidente' 
              AND l.id_registro_afetado = $1
            ORDER BY l.data_alteracao DESC;
        `;
        const resLogs = await client.query(queryLogs, [idIncidenteVal]);

        return {
            ...resIncidente.rows[0],
            historico: resLogs.rows // Array de eventos para a timeline
        };

    } finally {
        client.release();
    }
};

/**
 * Reconhece (ACK) um incidente com LOG DE AUDITORIA.
 */
exports.ackIncident = async (idIncidenteVal, idUsuarioVal) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update
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

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null; // Não encontrou ou status inválido
        }

        const incidenteAtualizado = rows[0];

        // 2. Log Auditoria
        const logQuery = `
            INSERT INTO ${SCHEMA}.log_auditoria_alteracoes
            (id_usuario, acao, tabela_afetada, id_registro_afetado, dados_novos)
            VALUES ($1, 'UPDATE', 'incidente', $2, $3);
        `;
        await client.query(logQuery, [
            idUsuarioVal, 
            idIncidenteVal, 
            JSON.stringify({ status: 'RECONHECIDO', acao: 'ACK' })
        ]);

        await client.query('COMMIT');
        return incidenteAtualizado;

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

/**
 * Fecha (CLOSE) um incidente com LOG DE AUDITORIA.
 */
exports.closeIncident = async (idIncidenteVal, idUsuarioVal, comentarioVal) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update
        const updateQuery = `
            UPDATE ${SCHEMA}.incidente
            SET 
                status = 'FECHADO',
                data_fechamento = CURRENT_TIMESTAMP,
                id_usuario_fechamento = $1,
                comentario_incidente = $2
            WHERE
                id_incidente = $3
                AND status IN ('RECONHECIDO', 'ABERTO') -- Permitir fechar direto de Aberto se necessário, ou restrinja para 'RECONHECIDO'
            RETURNING *;
        `;
        // Nota: O protótipo às vezes permite fechar direto. Ajustei o WHERE para ser mais flexível, ou mantenha só RECONHECIDO se for regra estrita.
        
        const { rows } = await client.query(updateQuery, [idUsuarioVal, comentarioVal, idIncidenteVal]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const incidenteAtualizado = rows[0];

        // 2. Log Auditoria
        const logQuery = `
            INSERT INTO ${SCHEMA}.log_auditoria_alteracoes
            (id_usuario, acao, tabela_afetada, id_registro_afetado, dados_novos)
            VALUES ($1, 'UPDATE', 'incidente', $2, $3);
        `;
        await client.query(logQuery, [
            idUsuarioVal, 
            idIncidenteVal, 
            JSON.stringify({ status: 'FECHADO', comentario: comentarioVal })
        ]);

        await client.query('COMMIT');
        return incidenteAtualizado;

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

/**
 * Reexecuta a regra associada a um incidente.
 */
exports.reexecuteIncident = async (idIncidenteVal, idUsuarioVal) => {
    const client = await pool.connect();
    try {
        // 1. Descobrir qual é a regra do incidente
        const buscaRegra = `SELECT id_regra FROM ${SCHEMA}.incidente WHERE id_incidente = $1`;
        const resRegra = await client.query(buscaRegra, [idIncidenteVal]);
        
        if (resRegra.rows.length === 0) return null; // Incidente não existe
        
        const idRegra = resRegra.rows[0].id_regra;

        // 2. Inserir na fila do Runner
        // Status 'PENDENTE' fará o executor pegar na próxima rodada
        const insertFila = `
            INSERT INTO ${SCHEMA}.fila_runner (id_regra, status, data_agendamento)
            VALUES ($1, 'PENDENTE', NOW())
            RETURNING id_fila;
        `;
        const resFila = await client.query(insertFila, [idRegra]);

        // 3. Log Auditoria (Opcional: registrar que alguém pediu reexecução)
        const logQuery = `
            INSERT INTO ${SCHEMA}.log_auditoria_alteracoes
            (id_usuario, acao, tabela_afetada, id_registro_afetado, dados_novos)
            VALUES ($1, 'INSERT', 'fila_runner', $2, $3);
        `;
        await client.query(logQuery, [
            idUsuarioVal, 
            idIncidenteVal, // Vinculamos ao incidente para aparecer no histórico dele
            JSON.stringify({ msg: 'Solicitou Reexecução', id_fila: resFila.rows[0].id_fila })
        ]);

        return { message: "Reexecução agendada com sucesso.", id_fila: resFila.rows[0].id_fila };

    } finally {
        client.release();
    }
};