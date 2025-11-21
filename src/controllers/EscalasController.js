// src/controllers/EscalasController.js

const EscalasService = require("../models/EscalasService");
const { asInteger, normalizeDateToISO } = require("../utils/helpers");

/**
 * GET /escalas
 * Lista todas as escalas cadastradas.
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
 * Cria uma nova entrada de escala.
 */
exports.createEscala = async (req, res) => {
    const { id_usuario, id_role, data_inicio, data_fim } = req.body || {};

    // 1. Validação de presença
    if (!id_usuario || !id_role || !data_inicio || !data_fim) {
        return res.status(400).json({ error: "Campos obrigatórios: id_usuario, id_role, data_inicio, data_fim" });
    }

    // 2. Normalização e Validação de Tipos
    const idUsuarioVal = asInteger(id_usuario);
    const idRoleVal = asInteger(id_role); 
    
    if (!idUsuarioVal || !idRoleVal) { 
        return res.status(400).json({ error: "id_usuario e id_role devem ser números inteiros positivos." });
    }

    const dataInicioVal = normalizeDateToISO(data_inicio);
    const dataFimVal = normalizeDateToISO(data_fim);
    
    if (!dataInicioVal || !dataFimVal) {
        return res.status(400).json({ error: "data_inicio ou data_fim inválidas. Use uma data válida." });
    }

    // Validação de regra de negócio (data_fim > data_inicio)
    if (new Date(dataFimVal) <= new Date(dataInicioVal)) {
        return res.status(400).json({ error: "data_fim deve ser maior que data_inicio." });
    }
    
    // 3. Chamada ao Service
    try {
        const novaEscala = await EscalasService.createEscala({
            idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal
        });
        
        return res.status(201).json(novaEscala);

    } catch (error) {
        // Violação de chave estrangeira (code 23503)
        if (error && error.code === "23503") {
            return res.status(409).json({ error: "Usuário (id_usuario) ou Role (id_role) não encontrado." });
        }
        console.error("Erro ao inserir escala:", error);
        return res.status(500).json({ error: "Erro interno ao cadastrar escala" });
    }
};