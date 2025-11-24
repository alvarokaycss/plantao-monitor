// src/models/RegrasService.js

const { pool, SCHEMA } = require("../db/db");
const { asInteger, normalizeDateToISO } = require("../utils/helpers");

/**
 * Busca regras com base em filtros (prioridade, nome), incluindo as Roles associadas.
 * @param {object} filtros - { prioridade, nome }
 * @returns {Array} - Lista de regras.
 */
exports.selectRegrasFiltradas = async (filtros = {}) => {
    const { prioridade, nome } = filtros;
    const client = await pool.connect();
    
    try {
        const condicoes = []; 
        const valores = []; 
        let queryIndex = 1;

        const prioridadeVal = asInteger(prioridade);
        if (prioridadeVal) {
            condicoes.push(`prioridade = $${queryIndex}`);
            valores.push(prioridadeVal);
            queryIndex++;
        }

        if (nome && typeof nome === 'string' && nome.trim().length > 0) {
            condicoes.push(`nome ILIKE $${queryIndex}`);
            valores.push(`%${nome.trim()}%`);
            queryIndex++;
        }

        let q = `
            SELECT 
                r.*, 
                ARRAY_REMOVE(ARRAY_AGG(rr.id_role), NULL) AS roles_id 
            FROM ${SCHEMA}.regra r
            LEFT JOIN ${SCHEMA}.regra_role rr ON r.id_regra = rr.id_regra
        `;

        if (condicoes.length > 0) {
            q += ` WHERE ${condicoes.join(' AND ')}`;
        }
        
        q += ` GROUP BY r.id_regra ORDER BY nome ASC;`; 
        
        const { rows } = await client.query(q, valores);
        return rows;

    } finally {
        client.release();
    }
}

/**
 * Busca detalhes de uma regra, incluindo informações de criador/atualizador e o último log.
 * @param {number} idRegraVal - ID da regra.
 * @returns {object} - Detalhes da regra (info e ultimo_log).
 */
exports.getRegraDetalhes = async (idRegraVal) => {
    const client = await pool.connect();
    try {
        const regraQuery = `
            SELECT 
                r.*, 
                criador.nome AS nome_criador, 
                atualizador.nome AS nome_atualizador 
            FROM ${SCHEMA}.regra r 
            LEFT JOIN ${SCHEMA}.usuario criador ON r.id_usuario_criador = criador.id_usuario 
            LEFT JOIN ${SCHEMA}.usuario atualizador ON r.id_usuario_atualizacao = atualizador.id_usuario 
            WHERE r.id_regra = $1;
        `;
        
        const logQuery = `
            SELECT * FROM ${SCHEMA}.log_execucoes_regras 
            WHERE id_regra = $1 
            ORDER BY data_execucao DESC 
            LIMIT 1;
        `;

        const regraRes = await client.query(regraQuery, [idRegraVal]);
        
        if (regraRes.rows.length === 0) return null;
        
        const regra = regraRes.rows[0];
        
        const logRes = await client.query(logQuery, [idRegraVal]);
        const ultimoLog = logRes.rows.length > 0 ? logRes.rows[0] : null;

        return { info: regra, ultimo_log: ultimoLog };

    } finally {
        client.release();
    }
};

/**
 * Cria uma nova regra, incluindo a ligação com as Roles, em uma transação.
 * @param {object} payload - Dados da regra.
 * @param {number} idUsuarioCriadorVal - ID do usuário.
 * @returns {object} - A regra criada.
 */
exports.createRegra = async (payload, idUsuarioCriadorVal) => {
    const { 
        idBancoVal, nome, consulta_sql, intervaloVal, qntErroMaxVal, prioridadeVal, rolesVal,
        descricao, janela_inicio, janela_fim, data_adiar_inicio, data_adiar_fim,
        data_silenciar_inicio, data_silenciar_fim 
    } = payload;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- Passo 1: Inserir na tabela 'regra'
        const insertRegraQuery = `
            INSERT INTO ${SCHEMA}.regra (
                id_banco_dados, nome, consulta_sql, intervalo_minutos, qnt_erro_max, prioridade, 
                id_usuario_criador, descricao, janela_inicio, janela_fim,
                data_adiar_inicio, data_adiar_fim, data_silenciar_inicio, data_silenciar_fim,
                data_criacao
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
            RETURNING *; 
        `;
        const regraValues = [
            idBancoVal, nome, consulta_sql, intervaloVal, qntErroMaxVal, prioridadeVal,
            idUsuarioCriadorVal, 
            descricao || null, 
            janela_inicio || '00:00:00', 
            janela_fim || '23:59:59', 
            normalizeDateToISO(data_adiar_inicio), 
            normalizeDateToISO(data_adiar_fim),
            normalizeDateToISO(data_silenciar_inicio), 
            normalizeDateToISO(data_silenciar_fim)
        ];
        
        const { rows: regraRows } = await client.query(insertRegraQuery, regraValues);
        const novaRegra = regraRows[0];
        const newRegraId = novaRegra.id_regra;

        // --- Passo 2: Inserir na tabela 'regra_role' (M:N)
        const insertRolesQuery = 'INSERT INTO ' + `${SCHEMA}.regra_role` + ' (id_regra, id_role) VALUES ' + 
             rolesVal.map((id, index) => `($1, $${index + 2})`).join(', ');

        await client.query(insertRolesQuery, [newRegraId, ...rolesVal]);

        await client.query('COMMIT');
        
        // Retorna a regra criada E os roles associados (para o frontend)
        return { ...novaRegra, roles: rolesVal };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err; // Lança o erro para o Controller tratar o código de status
    } finally {
        if (client) client.release();
    }
};

/**
 * Atualiza uma regra existente, incluindo a substituição das Roles, em uma transação.
 * @param {number} idRegraVal - ID da regra.
 * @param {object} payload - Dados da regra.
 * @param {number} idUsuarioAtualizacao - ID do usuário que está atualizando.
 * @returns {number} - ID da regra atualizada.
 */
exports.updateRegra = async (idRegraVal, payload, idUsuarioAtualizacao) => {
    const { 
        idBancoVal, nome, consulta_sql, intervaloVal, qntErroMaxVal, prioridadeVal, 
        rolesVal, descricao, janela_inicio, janela_fim, data_adiar_inicio, 
        data_adiar_fim, data_silenciar_inicio, data_silenciar_fim
    } = payload;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Passo A: Atualizar a tabela principal 'regra'
        const updateQuery = `
            UPDATE ${SCHEMA}.regra
            SET
                id_banco_dados = $1, nome = $2, consulta_sql = $3, intervalo_minutos = $4,
                qnt_erro_max = $5, prioridade = $6, descricao = $7, janela_inicio = $8,
                janela_fim = $9, data_adiar_inicio = $10, data_adiar_fim = $11,
                data_silenciar_inicio = $12, data_silenciar_fim = $13,
                id_usuario_atualizacao = $14, data_atualizacao = CURRENT_TIMESTAMP
            WHERE id_regra = $15
            RETURNING id_regra;
        `;

        const values = [
            idBancoVal, nome, consulta_sql, intervaloVal, qntErroMaxVal, prioridadeVal,
            descricao || null,
            janela_inicio || '00:00:00',
            janela_fim || '23:59:59',
            normalizeDateToISO(data_adiar_inicio),
            normalizeDateToISO(data_adiar_fim),
            normalizeDateToISO(data_silenciar_inicio),
            normalizeDateToISO(data_silenciar_fim),
            idUsuarioAtualizacao,
            idRegraVal
        ];

        const result = await client.query(updateQuery, values);
        if (result.rowCount === 0) {
            throw new Error('Regra não encontrada para atualização.');
        }

        // Passo B: Atualizar a relação M:N (Roles) - Limpar e Re-inserir
        await client.query(`DELETE FROM ${SCHEMA}.regra_role WHERE id_regra = $1`, [idRegraVal]);

        if (rolesVal.length > 0) {
            const insertRolesQuery = 'INSERT INTO ' + `${SCHEMA}.regra_role` + ' (id_regra, id_role) VALUES ' + 
                 rolesVal.map((id, index) => `($1, $${index + 2})`).join(', ');
            await client.query(insertRolesQuery, [idRegraVal, ...rolesVal]);
        }

        await client.query('COMMIT');
        return idRegraVal;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        if (client) client.release();
    }
};

/**
 * Atualiza as datas de ações programadas (Adiar/Silenciar).
 * @param {number} idRegraVal - ID da regra.
 * @param {object} payload - Dados da ação.
 * @param {number} idUsuario - ID do usuário.
 */
exports.updateRegraAcoes = async (idRegraVal, payload, idUsuario) => {
    const { tipo, inicio, fim } = payload;
    
    let dataAdiarInicio = null;
    let dataAdiarFim = null;
    let dataSilenciarInicio = null;
    let dataSilenciarFim = null;

    if (tipo === 'adiar') {
        dataAdiarInicio = normalizeDateToISO(inicio);
        dataAdiarFim = normalizeDateToISO(fim);
    } else if (tipo === 'silenciar') {
        dataSilenciarInicio = normalizeDateToISO(inicio);
        dataSilenciarFim = normalizeDateToISO(fim);
    } 
    // Se for 'cancelar', todos os valores são null (limpa)

    const client = await pool.connect();
    try {
        const query = `
            UPDATE ${SCHEMA}.regra
            SET 
                data_adiar_inicio = $1,
                data_adiar_fim = $2,
                data_silenciar_inicio = $3,
                data_silenciar_fim = $4,
                id_usuario_atualizacao = $5,
                data_atualizacao = CURRENT_TIMESTAMP
            WHERE id_regra = $6
        `;

        const values = [
            dataAdiarInicio, dataAdiarFim, dataSilenciarInicio, 
            dataSilenciarFim, idUsuario, idRegraVal
        ];

        const result = await client.query(query, values);
        if (result.rowCount === 0) {
            throw new Error('Regra não encontrada.');
        }
        
    } finally {
        if (client) client.release();
    }
};

/**
 * Exclui uma regra, incluindo a remoção das Roles, em uma transação.
 * @param {number} idRegraVal - ID da regra.
 * @returns {number} - ID da regra excluída.
 */
exports.deleteRegra = async (idRegraVal) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Remove associações com Roles
        await client.query(`DELETE FROM ${SCHEMA}.regra_role WHERE id_regra = $1`, [idRegraVal]);

        // 2. Tenta excluir a regra
        const query = `DELETE FROM ${SCHEMA}.regra WHERE id_regra = $1 RETURNING id_regra`;
        const { rowCount } = await client.query(query, [idRegraVal]);

        if (rowCount === 0) {
            throw new Error('Regra não encontrada.');
        }

        await client.query('COMMIT');
        return idRegraVal;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        if (client) client.release();
    }
};

/**
 * Executa uma consulta SQL em modo de teste (Sandbox).
 * @param {string} consultaSql - A consulta SQL a ser executada.
 * @param {number} idBancoDados - ID do banco de dados alvo.
 * @returns {object} - Resultado do teste (rowCount, rows, error).
 */
exports.testarConsultaSql = async (consultaSql, idBancoDados) => {
    let client;
    let bancoInfo;

    try {
        // 1. Encontrar o banco de dados
        client = await pool.connect();
        
        const bancoQuery = `
            SELECT * FROM ${SCHEMA}.banco_dados 
            WHERE id_banco_dados = $1;
        `;
        const { rows } = await client.query(bancoQuery, [idBancoDados]);
        
        if (rows.length === 0) {
            return { error: `Banco de dados ID ${idBancoDados} não encontrado.` };
        }
        bancoInfo = rows[0];

        // 2. Validação de Segurança (Bloqueio de DML/DDL) - RF05
        const sqlLimpo = consultaSql.trim().toUpperCase();
        if (/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sqlLimpo)) {
            return { error: "Consulta inválida. Apenas consultas SELECT são permitidas no teste." };
        }

        // 3. Execução da Consulta (Usamos um SELECT * para teste)
        // Adicionamos um LIMIT 10 para evitar consultas muito pesadas no teste.
        const queryTeste = `SELECT * FROM (${consultaSql}) AS teste_query LIMIT 10;`;
        
        const resultado = await client.query(queryTeste);

        // 4. Retorno de Sucesso
        return {
            rowCount: resultado.rowCount,
            rows: resultado.rows,
            status: "SUCESSO"
        };

    } catch (error) {
        // 5. Retorno de Erro SQL
        console.error("Erro na execução do teste SQL:", error);
        return {
            error: error.message,
            status: "ERRO"
        };
    } finally {
        if (client) client.release();
    }
};