// src/controllers/RegrasController.js

const RegrasService = require("../models/RegrasService");
const { asInteger } = require("../utils/helpers");

/**
 * GET /regras
 * Lista regras filtradas.
 */
exports.getRegras = async (req, res) => {
    try {
        const { prioridade, nome } = req.query;
        const data = await RegrasService.selectRegrasFiltradas({ prioridade, nome });
        res.json(data);
    } catch (error) {
        console.error("ERROR getRegras:", error);
        res.status(500).json({ error: "Erro ao buscar regras" });
    }
};

/**
 * GET /regras/:id/detalhes
 * Busca detalhes de uma regra específica.
 */
exports.getRegraDetalhes = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);
    
    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra deve ser um número inteiro positivo." });
    }

    try {
        const data = await RegrasService.getRegraDetalhes(idRegraVal);

        if (!data) {
            return res.status(404).json({ error: "Regra não encontrada." });
        }

        // A lógica de calcularStatusRegra (helper) será aplicada no frontend (script.js)
        // ou pode ser aplicada aqui, mas o frontend já faz isso.
        res.json(data);

    } catch (error) {
        console.error(`ERROR getRegraDetalhes (${idRegraVal}):`, error);
        res.status(500).json({ error: "Erro ao buscar detalhes da regra" });
    }
};


/**
 * POST /regras
 * Cria uma nova regra.
 */
exports.createRegra = async (req, res) => {
    const payload = req.body || {};
    const id_usuario_criador = req.user.id_usuario;

    // 1. Validação
    const { id_banco_dados, nome, consulta_sql, intervalo_minutos, qnt_erro_max, prioridade, roles } = payload;

    if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos || !id_usuario_criador) {
        return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos" });
    }
    
    if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "O campo 'roles' é obrigatório e deve ser um array de IDs." });
    }

    // 2. Normalização
    const idBancoVal = asInteger(id_banco_dados);
    const intervaloVal = asInteger(intervalo_minutos);
    const prioridadeVal = asInteger(prioridade) || 3; 
    const qntErroMaxVal = Number(qnt_erro_max) >= 0 ? Number(qnt_erro_max) : 1;
    const rolesVal = roles.map(asInteger).filter(id => id !== null);

    if (!idBancoVal || !intervaloVal || rolesVal.length === 0) {
        return res.status(400).json({ error: "IDs (banco/intervalo/roles) devem ser números inteiros positivos." });
    }
    
    // 3. Chamada ao Service
    try {
        const result = await RegrasService.createRegra({ 
            ...payload, 
            idBancoVal, intervaloVal, qntErroMaxVal, prioridadeVal, rolesVal 
        }, id_usuario_criador);

        return res.status(201).json(result);
    } catch (err) {
        if (err && err.code === "23503") {
            return res.status(409).json({ error: "Falha ao criar regra: id_banco_dados, id_usuario_criador ou um dos IDs em 'roles' não foi encontrado." });
        }
        console.error("Erro ao inserir regra:", err);
        return res.status(500).json({ error: "Erro interno ao cadastrar regra" });
    }
};

/**
 * PUT /regras/:id
 * Atualiza uma regra existente.
 */
exports.updateRegra = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);
    const id_usuario_atualizacao = req.user.id_usuario;
    const payload = req.body || {};

    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra inválido." });
    }

    // 1. Validação (Simplificada, garantindo os campos críticos)
    const { id_banco_dados, nome, consulta_sql, intervalo_minutos, roles } = payload;
    if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos e roles." });
    }

    // 2. Normalização
    const idBancoVal = asInteger(id_banco_dados);
    const intervaloVal = asInteger(intervalo_minutos);
    const prioridadeVal = asInteger(payload.prioridade) || 3;
    const qntErroMaxVal = Number(payload.qnt_erro_max) >= 0 ? Number(payload.qnt_erro_max) : 1;
    const rolesVal = roles.map(asInteger).filter(id => id !== null);

    if (!idBancoVal || !intervaloVal || rolesVal.length === 0) {
        return res.status(400).json({ error: "IDs (banco/intervalo/roles) devem ser números inteiros positivos." });
    }

    // 3. Chamada ao Service
    try {
        await RegrasService.updateRegra(idRegraVal, {
            ...payload, idBancoVal, intervaloVal, qntErroMaxVal, prioridadeVal, rolesVal
        }, id_usuario_atualizacao);

        return res.status(200).json({ message: "Regra atualizada com sucesso.", id_regra: idRegraVal });

    } catch (error) {
        if (error.message === 'Regra não encontrada para atualização.') {
             return res.status(404).json({ error: "Regra não encontrada para atualização." });
        }
        if (error.code === "23503") {
            return res.status(400).json({ error: "Violação de integridade (Banco ou Role inválido)." });
        }
        console.error(`Erro ao atualizar regra ${idRegraVal}:`, error);
        res.status(500).json({ error: "Erro interno ao atualizar regra." });
    }
};

/**
 * PATCH /regras/:id/acoes
 * Agenda ações (Adiar/Silenciar/Cancelar).
 */
exports.updateRegraAcoes = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);
    const idUsuario = req.user.id_usuario;
    const { tipo, inicio, fim } = req.body || {};

    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra inválido." });
    }

    if (tipo !== 'cancelar' && (!inicio || !fim)) {
        return res.status(400).json({ error: "Para agendar, início e fim são obrigatórios." });
    }
    
    try {
        await RegrasService.updateRegraAcoes(idRegraVal, { tipo, inicio, fim }, idUsuario);
        res.json({ message: "Ação da regra atualizada com sucesso." });
        
    } catch (error) {
        if (error.message === 'Regra não encontrada.') {
             return res.status(404).json({ error: "Regra não encontrada." });
        }
        console.error(`Erro no PATCH /regras/${idRegraVal}/acoes:`, error);
        res.status(500).json({ error: "Erro interno ao atualizar ação da regra." });
    }
};

/**
 * DELETE /regras/:id
 * Exclui uma regra.
 */
exports.deleteRegra = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);

    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra inválido." });
    }

    try {
        await RegrasService.deleteRegra(idRegraVal);
        res.json({ message: "Regra excluída com sucesso." });

    } catch (error) {
        if (error.message === 'Regra não encontrada.') {
             return res.status(404).json({ error: "Regra não encontrada." });
        }
        if (error.code === '23503') {
            return res.status(409).json({ 
                error: "Não é possível excluir esta regra pois ela possui histórico (incidentes ou logs). Tente silenciá-la permanentemente." 
            });
        }
        console.error(`Erro ao excluir regra ${idRegraVal}:`, error);
        res.status(500).json({ error: "Erro interno ao excluir regra." });
    }
};