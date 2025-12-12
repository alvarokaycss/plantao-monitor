// src/controllers/UsuariosController.js

const UsuariosService = require("../models/UsuariosService");
const { asInteger } = require("../utils/helpers");
const admin = require("firebase-admin");
const { pool, SCHEMA } = require("../db/db");

/**
 * POST /auth/register
 * Rota pública (protegida apenas por validação de token Firebase).
 * Cria o usuário no Postgres com status PENDENTE (ativo=false).
 */
exports.registerUser = async (req, res) => {
    const { idToken } = req.body; // O front envia o token recém-criado

    if (!idToken) {
        return res.status(400).json({ error: "Token de identificação é obrigatório." });
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }

    const { uid, email, name } = decodedToken;
    const nomeUsuario = name || email.split('@')[0];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Inserir Usuário (Padrão: ATIVO = FALSE)
        const insertUserQuery = `
            INSERT INTO ${SCHEMA}.usuario (uid_firebase, id_perfil, email, nome, ativo)
            VALUES ($1, 3, $2, $3, FALSE) -- 3 = Viewer, Ativo = FALSE
            ON CONFLICT (uid_firebase) DO UPDATE SET email = EXCLUDED.email -- Apenas atualiza email se já existir
            RETURNING id_usuario, ativo;
        `;
        const userRes = await client.query(insertUserQuery, [uid, email, nomeUsuario]);
        const newUser = userRes.rows[0];

        // Configuração Inicial de Email (Movido do Middleware para cá)
        const canalEmailQuery = `SELECT id_tipo_canal FROM ${SCHEMA}.tipos_canal_notificacao WHERE nome ILIKE 'Email'`;
        const canalRes = await client.query(canalEmailQuery);

        if (canalRes.rows.length > 0) {
            const idTipoEmail = canalRes.rows[0].id_tipo_canal;
            const configQuery = `
                INSERT INTO ${SCHEMA}.configuracoes_notificacao 
                (id_usuario, id_tipo_canal, endereco_notificacao, habilitado)
                VALUES ($1, $2, $3, FALSE) -- Habilitado FALSE por padrão até aprovação
                ON CONFLICT (endereco_notificacao) DO NOTHING;
            `;
            await client.query(configQuery, [newUser.id_usuario, idTipoEmail, email]);
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            message: "Cadastro realizado. Aguarde aprovação do administrador.",
            user: newUser
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro no registro:", error);
        res.status(500).json({ error: "Erro ao registrar usuário." });
    } finally {
        client.release();
    }
};

/**
 * GET /usuarios
 * Lista usuários filtrados. (Admin)
 */
exports.getUsuarios = async (req, res) => {
    try {
        // Captura o query param ?ativo=true ou ?ativo=false
        const { ativo } = req.query;
        
        const filtros = {};
        
        // Converte string 'true'/'false' para boolean real
        if (ativo !== undefined) {
            filtros.ativo = (ativo === 'true');
        }

        const usuarios = await UsuariosService.getAllUsuarios(filtros);
        return res.json(usuarios);

    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        return res.status(500).json({ error: "Erro interno ao listar usuários." });
    }
};

/**
 * GET /usuarios/eu/detalhes
 * Retorna os detalhes do próprio usuário logado.
 */
exports.getMeuDetalhe = async (req, res) => {
    // ID do usuário vem do token via checkAuth
    const idUsuarioVal = req.user.id_usuario; 

    try {
        const data = await UsuariosService.getUsuarioDetalhes(idUsuarioVal);
        
        if (!data) {
            return res.status(404).json({ error: "Usuário do token não encontrado no banco." });
        }
        
        res.json(data);

    } catch (error) {
        console.error(`ERROR getMeuDetalhe (${idUsuarioVal}):`, error);
        res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
    }
};

/**
 * GET /usuarios/:id/detalhes
 * Retorna os detalhes de um usuário específico. (Admin)
 */
exports.getUsuarioDetalhes = async (req, res) => {
    const idUsuarioVal = asInteger(req.params.id);

    if (!idUsuarioVal) {
        return res.status(400).json({ error: "ID de usuário inválido." });
    }

    try {
        const data = await UsuariosService.getUsuarioDetalhes(idUsuarioVal);

        if (!data) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        
        res.json(data);

    } catch (error) {
        console.error(`ERROR getUsuarioDetalhes (${idUsuarioVal}):`, error);
        res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
    }
};

/**
 * PUT /usuarios/:id/configuracao
 * Atualiza o perfil, status e permissões de um usuário.
 */
exports.updateUsuarioConfiguracao = async (req, res) => {
    const idUsuarioParaConfigurar = asInteger(req.params.id);
    const { id_perfil, ativo, recursos, notificacoes } = req.body || {};

    if (!idUsuarioParaConfigurar) {
        return res.status(400).json({ error: "ID de usuário inválido." });
    }

    // 1. Validação e Normalização
    const idPerfilVal = asInteger(id_perfil);
    if (!idPerfilVal) {
        return res.status(400).json({ error: "id_perfil é obrigatório e deve ser um número inteiro positivo." });
    }
    
    const statusAtivo = (ativo === undefined) ? true : Boolean(ativo); // Default true
    const recursosVal = (Array.isArray(recursos) ? recursos : []).map(asInteger).filter(id => id !== null);
    
    // Valida notificações (id_tipo_canal e endereco_notificacao)
    const notificacoesVal = (Array.isArray(notificacoes) ? notificacoes : []).filter(n => 
        asInteger(n.id_tipo_canal) && n.endereco_notificacao
    );

    // 2. Chamada ao Service (Transação)
    try {
        await UsuariosService.updateUsuarioConfiguracao(idUsuarioParaConfigurar, {
            idPerfilVal, statusAtivo, recursosVal, notificacoesVal
        });

        return res.status(200).json({ message: "Configurações do usuário atualizadas com sucesso." });

    } catch (err) {
        if (err && err.code === "23503") {
            return res.status(409).json({ error: "Falha ao configurar usuário: id_perfil ou outro ID referenciado não foi encontrado." });
        }
        if (err.message === "Usuário não encontrado para configurar.") {
            return res.status(404).json({ error: "Usuário não encontrado para configuração." });
        }
        console.error(`Erro ao configurar usuário ${idUsuarioParaConfigurar}:`, err);
        return res.status(500).json({ error: "Erro interno ao configurar usuário" });
    }
};

/**
 * PUT /usuarios/eu/perfil
 * Permite que o usuário edite seus próprios dados (Nome, Celular, Preferências).
 */
exports.updateMeuPerfil = async (req, res) => {
    const idUsuario = req.user.id_usuario; 
    // Extrai novos campos do body
    const { nome, celular, notificacoes, janela_inicio, janela_fim } = req.body;

    try {
        const dadosAtualizacao = {
            nome: nome ? String(nome).trim() : undefined,
            celular: celular ? String(celular).trim() : undefined,
            notificacoes: notificacoes || {},
            janela_inicio: janela_inicio || null,
            janela_fim: janela_fim || null
        };

        await UsuariosService.updateMeuPerfil(idUsuario, dadosAtualizacao);
        res.json({ message: "Perfil atualizado com sucesso." });

    } catch (error) {
        console.error("Erro updateMeuPerfil:", error);
        res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
};

/**
 * DELETE /usuarios/:id
 * Exclui um usuário e todas as suas relações. (Admin - RF03)
 */
exports.deleteUsuario = async (req, res) => {
    const idUsuarioParaDeletar = asInteger(req.params.id);

    if (!idUsuarioParaDeletar) {
        return res.status(400).json({ error: "ID de usuário inválido." });
    }

    // Previne que o usuário delete a si mesmo
    const idUsuarioLogado = req.user.id_usuario;
    if (idUsuarioParaDeletar === idUsuarioLogado) {
        return res.status(400).json({ error: "Não é possível excluir seu próprio usuário." });
    }

    try {
        await UsuariosService.deleteUsuario(idUsuarioParaDeletar);
        return res.status(200).json({ message: "Usuário excluído com sucesso." });

    } catch (err) {
        if (err.message === "Usuário não encontrado.") {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        if (err.message.includes("registros vinculados")) {
            return res.status(409).json({ error: err.message });
        }
        console.error(`Erro ao excluir usuário ${idUsuarioParaDeletar}:`, err);
        return res.status(500).json({ error: "Erro interno ao excluir usuário" });
    }
};