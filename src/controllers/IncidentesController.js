// src/controllers/IncidentesController.js

const IncidentesService = require("../models/IncidentesService");
const { asInteger } = require("../utils/helpers");

/**
 * GET /incidentes
 * Lista incidentes, com filtros opcionais de status e prioridade.
 */
exports.getIncidentes = async (req, res) => {
    try {
        const { status, prioridade } = req.query;
        const data = await IncidentesService.selectIncidentesFiltrados({ status, prioridade });
        res.json(data);
    } catch (error) {
        console.error("ERROR getIncidentes:", error);
        res.status(500).json({ error: "Erro ao buscar incidentes" });
    }
};

/**
 * GET /incidentes/:id/detalhes
 * Retorna os detalhes de um incidente específico.
 */
exports.getIncidenteDetalhes = async (req, res) => {
    const idIncidenteVal = asInteger(req.params.id);

    if (!idIncidenteVal) {
        return res.status(400).json({ error: "ID de incidente inválido." });
    }

    try {
        const data = await IncidentesService.getIncidenteDetalhes(idIncidenteVal);

        if (!data) {
            return res.status(404).json({ error: "Incidente não encontrado." });
        }
        
        res.json(data);
    } catch (error) {
        console.error(`ERROR getIncidenteDetalhes (${idIncidenteVal}):`, error);
        res.status(500).json({ error: "Erro ao buscar detalhes do incidente" });
    }
};


/**
 * POST /incidentes/:id/ack
 * Reconhece um incidente (muda status para RECONHECIDO).
 */
exports.ackIncident = async (req, res) => {
    const idIncidenteVal = asInteger(req.params.id);
    const idUsuarioVal = req.user.id_usuario; // ID do usuário vem do checkAuth (req.user)

    if (!idIncidenteVal || !idUsuarioVal) {
        return res.status(400).json({ error: "ID do incidente e id_usuario_ack são obrigatórios e devem ser inteiros." });
    }

    try {
        const rows = await IncidentesService.ackIncident(idIncidenteVal, idUsuarioVal);

        if (!rows) {
            return res.status(409).json({ error: "Incidente não encontrado ou já estava Reconhecido/Fechado." });
        }
        
        res.json(rows); // Retorna o incidente atualizado

    } catch (error) {
        if (error && error.code === "23503") {
            return res.status(404).json({ error: "Usuário (id_usuario_ack) não encontrado." });
        }
        console.error(`ERROR ackIncident (${idIncidenteVal}):`, error);
        res.status(500).json({ error: "Erro interno ao reconhecer incidente" });
    }
};

/**
 * POST /incidentes/:id/close
 * Fecha um incidente (muda status para FECHADO).
 */
exports.closeIncident = async (req, res) => {
    const idIncidenteVal = asInteger(req.params.id);
    const idUsuarioVal = req.user.id_usuario;
    const { comentario_incidente } = req.body;
    
    const comentarioVal = (comentario_incidente && String(comentario_incidente).trim()) ? String(comentario_incidente).trim() : null;

    if (!idIncidenteVal || !idUsuarioVal) {
        return res.status(400).json({ error: "ID do incidente e id_usuario_fechamento são obrigatórios." });
    }

    try {
        const rows = await IncidentesService.closeIncident(idIncidenteVal, idUsuarioVal, comentarioVal);

        if (!rows) {
            return res.status(409).json({ error: "Incidente não encontrado ou não estava 'Reconhecido' (deve-se dar ACK primeiro)." });
        }
        
        res.json(rows); // Retorna o incidente atualizado

    } catch (error) {
        if (error && error.code === "23503") {
            return res.status(404).json({ error: "Usuário (id_usuario_fechamento) não encontrado." });
        }
        console.error(`ERROR closeIncident (${idIncidenteVal}):`, error);
        res.status(500).json({ error: "Erro interno ao fechar incidente" });
    }
};