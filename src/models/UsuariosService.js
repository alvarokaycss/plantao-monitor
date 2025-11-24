// src/models/UsuariosService.js

const { pool, SCHEMA } = require("../db/db");
const { asInteger } = require("../utils/helpers");

/**
 * Busca usuários com base em filtros (id_perfil, pesquisa por nome/email).
 * @param {object} filtros - { id_perfil, pesquisa }
 * @returns {Array} - Lista de usuários.
 */
exports.selectUsuariosFiltrados = async (filtros = {}) => {
    const { id_perfil, pesquisa } = filtros;
    const client = await pool.connect();
    
    try {
        const condicoes = []; 
        const valores = []; 
        let queryIndex = 1;

        const idPerfilVal = asInteger(id_perfil);
        if (idPerfilVal) {
            condicoes.push(`id_perfil = $${queryIndex}`);
            valores.push(idPerfilVal);
            queryIndex++;
        }

        if (pesquisa && typeof pesquisa === 'string' && pesquisa.trim().length > 0) {
            condicoes.push(`(nome ILIKE $${queryIndex} OR email ILIKE $${queryIndex})`);
            valores.push(`%${pesquisa.trim()}%`);
            queryIndex++;
        }

        let q = `SELECT * FROM ${SCHEMA}.usuario`;
        if (condicoes.length > 0) {
            q += ` WHERE ${condicoes.join(' AND ')}`;
        }
        
        q += ` ORDER BY nome ASC;`; 
        
        const { rows } = await client.query(q, valores);
        return rows;

    } finally {
        if (client) client.release();
    }
}

/**
 * Busca os detalhes de um usuário, incluindo suas configurações de notificação E RECURSOS.
 * @param {number} idUsuarioVal - ID do usuário (próprio ou alvo do Admin).
 * @returns {object} - { info: user, configuracoes: [], recursos: [] }.
 */
exports.getUsuarioDetalhes = async (idUsuarioVal) => {
    const client = await pool.connect();
    try {
        // Query 1: Buscar a informação principal do usuário
        const userQuery = `
            SELECT 
                u.id_usuario, u.email, u.nome, 
                u.notificacao_push_som, u.notificacao_janela_inicio, u.notificacao_janela_fim, 
                u.ativo, u.id_perfil, p.nome as nome_perfil
            FROM ${SCHEMA}.usuario u
            JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
            WHERE u.id_usuario = $1;
        `;
        const userRes = await client.query(userQuery, [idUsuarioVal]);

        if (userRes.rows.length === 0) {
            return null; // Usuário não encontrado
        }
        const usuario = userRes.rows[0];

        // Query 2: Buscar as configurações de notificação (canais)
        const configQuery = `
            SELECT 
                c.id_configuracao_notificacao, 
                c.id_tipo_canal, 
                c.endereco_notificacao, 
                c.habilitado, 
                c.nome_dispositivo, 
                t.nome AS nome_canal
            FROM ${SCHEMA}.configuracoes_notificacao c
            JOIN ${SCHEMA}.tipos_canal_notificacao t ON c.id_tipo_canal = t.id_tipo_canal
            WHERE c.id_usuario = $1
            ORDER BY t.nome;
        `;
        const configRes = await client.query(configQuery, [idUsuarioVal]);
        
        // NOVO: Query 3: Buscar os recursos associados (toggles de tela)
        const recursosQuery = `
            SELECT 
                ur.id_recurso,
                r.chave_recurso,
                r.nome_amigavel
            FROM ${SCHEMA}.usuario_recursos ur
            JOIN ${SCHEMA}.recursos r ON ur.id_recurso = r.id_recurso
            WHERE ur.id_usuario = $1;
        `;
        const recursosRes = await client.query(recursosQuery, [idUsuarioVal]);


        return {
            info: usuario,
            configuracoes: configRes.rows,
            recursos: recursosRes.rows // RETORNA OS RECURSOS AQUI!
        };

    } finally {
        if (client) client.release();
    }
};


/**
 * Atualiza as configurações de um usuário (perfil, ativo, recursos e notificações) em uma transação.
 * (Funcionalidade RF03 de Admin)
 * @param {number} idUsuarioParaConfigurar - ID do usuário alvo.
 * @param {object} payload - Dados de configuração.
 */
exports.updateUsuarioConfiguracao = async (idUsuarioParaConfigurar, payload) => {
    const { idPerfilVal, statusAtivo, recursosVal, notificacoesVal } = payload;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- Passo 1: Atualizar a tabela 'usuario' (perfil e status ativo)
        const updateUsuarioQuery = `
            UPDATE ${SCHEMA}.usuario 
            SET 
                id_perfil = $1,
                ativo = $2
            WHERE id_usuario = $3
            RETURNING id_usuario;
        `;
        const userResult = await client.query(updateUsuarioQuery, [idPerfilVal, statusAtivo, idUsuarioParaConfigurar]);
        
        if (userResult.rowCount === 0) {
            throw new Error("Usuário não encontrado para configurar.");
        }

        // --- Passo 2: Atualizar 'usuario_recursos' (M:N) (Toggles)
        await client.query(`DELETE FROM ${SCHEMA}.usuario_recursos WHERE id_usuario = $1`, [idUsuarioParaConfigurar]);
        
        if (recursosVal.length > 0) {
            const insertRecursosQuery = 'INSERT INTO ' + `${SCHEMA}.usuario_recursos` + ' (id_usuario, id_recurso) VALUES ' + 
                recursosVal.map((id, index) => `($1, $${index + 2})`).join(', ');
            await client.query(insertRecursosQuery, [idUsuarioParaConfigurar, ...recursosVal]);
        }

        // --- Passo 3: Atualizar 'configuracoes_notificacao' (1:N) (Canais)
        await client.query(`DELETE FROM ${SCHEMA}.configuracoes_notificacao WHERE id_usuario = $1`, [idUsuarioParaConfigurar]);

        if (notificacoesVal.length > 0) {
            const insertNotificacoesQuery = 'INSERT INTO ' + `${SCHEMA}.configuracoes_notificacao` + 
                ' (id_usuario, id_tipo_canal, endereco_notificacao, habilitado, nome_dispositivo) VALUES ' + 
                notificacoesVal.map((n, i) => 
                    `($1, $${i*5 + 2}, $${i*5 + 3}, $${i*5 + 4}, $${i*5 + 5})`
                ).join(', ');
            
            const notificacoesValues = notificacoesVal.flatMap(n => 
                [
                    asInteger(n.id_tipo_canal), 
                    n.endereco_notificacao, 
                    n.habilitado !== false, // Default true
                    n.nome_dispositivo || null
                ]
            );
            
            await client.query(insertNotificacoesQuery, [idUsuarioParaConfigurar, ...notificacoesValues]);
        }

        await client.query('COMMIT');
        
        return idUsuarioParaConfigurar;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        if (client) client.release();
    }
};

/**
 * Exclui um usuário e todas as suas relações, em uma transação.
 * Remove: usuario_recursos, configuracoes_notificacao, escala, e referências em outras tabelas.
 * @param {number} idUsuarioVal - ID do usuário a ser excluído.
 * @returns {number} - ID do usuário excluído.
 */
exports.deleteUsuario = async (idUsuarioVal) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Remove associações com Recursos (M:N)
        await client.query(`DELETE FROM ${SCHEMA}.usuario_recursos WHERE id_usuario = $1`, [idUsuarioVal]);

        // 2. Remove configurações de notificação (1:N)
        await client.query(`DELETE FROM ${SCHEMA}.configuracoes_notificacao WHERE id_usuario = $1`, [idUsuarioVal]);

        // 3. Remove escalas do usuário
        await client.query(`DELETE FROM ${SCHEMA}.escala WHERE id_usuario = $1`, [idUsuarioVal]);

        // 4. Tenta excluir o usuário
        const query = `DELETE FROM ${SCHEMA}.usuario WHERE id_usuario = $1 RETURNING id_usuario`;
        const { rowCount } = await client.query(query, [idUsuarioVal]);

        if (rowCount === 0) {
            throw new Error('Usuário não encontrado.');
        }

        await client.query('COMMIT');
        return idUsuarioVal;

    } catch (error) {
        await client.query('ROLLBACK');

        // Trata erro de chave estrangeira (usuário referenciado em incidentes ou regras)
        if (error.code === '23503') {
            throw new Error('Não é possível excluir o usuário: ele possui registros vinculados em incidentes ou regras.');
        }

        throw error;
    } finally {
        if (client) client.release();
    }
};