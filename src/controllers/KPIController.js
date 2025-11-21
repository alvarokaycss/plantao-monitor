// src/controllers/KPIController.js

const KPIService = require("../models/KPIService");

/**
 * GET /kpis
 * Busca todos os KPIs para o dashboard.
 */
exports.getKPIs = async (req, res) => {
    try {
        const data = await KPIService.getKPIsData();
        res.json(data);
    } catch (error) {
        console.error("ERROR getKPIs:", error);
        res.status(500).json({ error: "Erro ao buscar KPIs" });
    }
};