// src/controllers/EscalasController.js

const EscalasService = require("../services/EscalasService");
const { asInteger, normalizeDateToISO } = require("../utils/helpers");

/**
 * GET /escalas
 */
exports.getEscalas = async (req, res) => {
    try {
        const data = await EscalasService.getAllEscalas();
        res.json(data);
    } catch (error) {
        console.error("ERROR getEscalas:", error);
        res.status(500).json({ error: "Erro ao buscar escalas" });
    }
};

/**
 * POST /escalas
 */
exports.createEscala = async (req, res) => {
    const { id_usuario, id_role, data_inicio, data_fim } = req.body || {};

    if (!id_usuario || !id_role || !data_inicio || !data_fim) {
        return res.status(400).json({ error: "Campos obrigatórios: id_usuario, id_role, data_inicio, data_fim" });
    }

    const idUsuarioVal = asInteger(id_usuario);
    const idRoleVal = asInteger(id_role); 
    const dataInicioVal = normalizeDateToISO(data_inicio);
    const dataFimVal = normalizeDateToISO(data_fim);
    
    if (!idUsuarioVal || !idRoleVal || !dataInicioVal || !dataFimVal) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    if (new Date(dataFimVal) <= new Date(dataInicioVal)) {
        return res.status(400).json({ error: "Data final deve ser maior que data inicial." });
    }
    
    try {
        const novaEscala = await EscalasService.createEscala({
            idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal
        });
        return res.status(201).json(novaEscala);

    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({ error: "Usuário ou Role não encontrados." });
        }
        console.error("Erro ao inserir escala:", error);
        return res.status(500).json({ error: "Erro interno ao cadastrar escala" });
    }
};

/**
 * DELETE /escalas/:id
 */
exports.deleteEscala = async (req, res) => {
    const idEscala = asInteger(req.params.id);
    if (!idEscala) return res.status(400).json({ error: "ID inválido." });

    try {
        await EscalasService.deleteEscala(idEscala);
        res.json({ message: "Escala removida com sucesso." });
    } catch (error) {
        console.error("Erro deleteEscala:", error);
        res.status(500).json({ error: "Erro ao excluir escala." });
    }
};

/**
 * PUT /escalas/:id
 */
exports.updateEscala = async (req, res) => {
    const idEscala = asInteger(req.params.id);
    const { id_usuario, id_role, data_inicio, data_fim } = req.body || {};

    if (!idEscala) return res.status(400).json({ error: "ID da escala inválido." });

    // 1. Validação e Normalização
    const idUsuarioVal = asInteger(id_usuario);
    const idRoleVal = asInteger(id_role); 
    const dataInicioVal = normalizeDateToISO(data_inicio);
    const dataFimVal = normalizeDateToISO(data_fim);

    if (!idUsuarioVal || !idRoleVal || !dataInicioVal || !dataFimVal) {
        return res.status(400).json({ error: "Dados inválidos. Verifique os campos obrigatórios." });
    }

    if (new Date(dataFimVal) <= new Date(dataInicioVal)) {
        return res.status(400).json({ error: "A data final deve ser posterior à data inicial." });
    }

    try {
        await EscalasService.updateEscala(idEscala, {
            idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal
        });

        res.json({ message: "Escala atualizada com sucesso." });

    } catch (error) {
        if (error.message === 'Escala não encontrada.') {
            return res.status(404).json({ error: error.message });
        }
        if (error.code === "23503") {
            return res.status(409).json({ error: "Usuário ou Role não encontrados." });
        }
        console.error(`Erro updateEscala ${idEscala}:`, error);
        res.status(500).json({ error: "Erro interno ao atualizar escala." });
    }
};
