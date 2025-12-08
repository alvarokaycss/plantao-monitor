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
 * COM WEBSOCKET REAL-TIME
 */
exports.ackIncident = async (req, res) => {
    const idIncidenteVal = asInteger(req.params.id);
    const idUsuarioVal = req.user.id_usuario; 
    const nomeUsuario = req.user.nome || "Usuário";

    if (!idIncidenteVal || !idUsuarioVal) {
        return res.status(400).json({ error: "ID obrigatório." });
    }

    try {
        const rows = await IncidentesService.ackIncident(idIncidenteVal, idUsuarioVal);

        if (!rows) {
            return res.status(409).json({ error: "Incidente não encontrado ou status inválido para ACK." });
        }
        
        // --- EMITIR EVENTO REAL-TIME ---
        // Avisa todos os clientes conectados para atualizarem suas telas
        if (req.io) {
            req.io.emit("dashboard_update", { 
                mensagem: `Incidente #${idIncidenteVal} reconhecido (ACK) por ${nomeUsuario}.`,
                tipo: "ACK",
                id_incidente: idIncidenteVal
            });
        }

        res.json(rows); 

    } catch (error) {
        console.error(`ERROR ackIncident (${idIncidenteVal}):`, error);
        res.status(500).json({ error: "Erro interno ao reconhecer incidente" });
    }
};

/**
 * POST /incidentes/:id/close
 * Fecha um incidente (muda status para FECHADO).
 * AGORA COM WEBSOCKET REAL-TIME
 */
exports.closeIncident = async (req, res) => {
    const idIncidenteVal = asInteger(req.params.id);
    const idUsuarioVal = req.user.id_usuario;
    const nomeUsuario = req.user.nome || "Usuário";
    const { comentario_incidente } = req.body;
    
    const comentarioVal = (comentario_incidente && String(comentario_incidente).trim()) ? String(comentario_incidente).trim() : null;

    if (!idIncidenteVal || !idUsuarioVal) {
        return res.status(400).json({ error: "ID obrigatório." });
    }

    try {
        const rows = await IncidentesService.closeIncident(idIncidenteVal, idUsuarioVal, comentarioVal);

        if (!rows) {
            return res.status(409).json({ error: "Incidente não encontrado." });
        }
        
        // --- EMITIR EVENTO REAL-TIME ---
        if (req.io) {
            req.io.emit("dashboard_update", { 
                mensagem: `Incidente #${idIncidenteVal} FECHADO por ${nomeUsuario}.`,
                tipo: "CLOSE",
                id_incidente: idIncidenteVal
            });
        }

        res.json(rows); 

    } catch (error) {
        console.error(`ERROR closeIncident (${idIncidenteVal}):`, error);
        res.status(500).json({ error: "Erro interno ao fechar incidente" });
    }
};

/**
 * POST /incidentes/:id/reexecute
 * Agenda a regra do incidente para rodar novamente.
 * AGORA COM WEBSOCKET REAL-TIME
 */
exports.reexecuteIncident = async (req, res) => {
    const idIncidenteVal = asInteger(req.params.id);
    const idUsuarioVal = req.user.id_usuario;
    const nomeUsuario = req.user.nome || "Usuário";

    if (!idIncidenteVal) {
        return res.status(400).json({ error: "ID do incidente inválido." });
    }

    try {
        const result = await IncidentesService.reexecuteIncident(idIncidenteVal, idUsuarioVal);
        
        if (!result) {
            return res.status(404).json({ error: "Incidente não encontrado." });
        }

        // --- EMITIR EVENTO REAL-TIME (Depois alterar para nome da Regra)
        if (req.io) {
            req.io.emit("dashboard_update", { 
                mensagem: `Reexecução solicitada para incidente #${idIncidenteVal} por ${nomeUsuario}.`,
                tipo: "REEXECUTE",
                id_incidente: idIncidenteVal
            });
        }

        res.json(result);

    } catch (error) {
        console.error(`ERROR reexecuteIncident (${idIncidenteVal}):`, error);
        res.status(500).json({ error: "Erro ao agendar reexecução." });
    }
};