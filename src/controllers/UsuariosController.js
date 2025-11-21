// src/controllers/UsuariosController.js

const UsuariosService = require("../models/UsuariosService");
const { asInteger } = require("../utils/helpers");

/**
 * GET /usuarios
 * Lista usuários filtrados. (Admin)
 */
exports.getUsuarios = async (req, res) => {
    try {
        const { id_perfil, pesquisa } = req.query;
        const data = await UsuariosService.selectUsuariosFiltrados({ id_perfil, pesquisa });
        res.json(data);
    } catch (error) {
        console.error("ERROR getUsuarios:", error);
        res.status(500).json({ error: "Erro ao buscar usuarios" });
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
 * Atualiza o perfil, status e permissões de um usuário. (Admin - RF03)
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