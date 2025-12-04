// src/models/KPIService.js

const { pool, SCHEMA } = require("../db/db");

/**
 * Busca todos os KPIs (Plantonista, Contagens, Métricas) em três consultas paralelas.
 * @returns {object} - O objeto de resposta com todos os dados de KPI.
 */
exports.getKPIsData = async () => {
    // 1. Plantonista
    const plantonistaQuery = `
        SELECT u.nome, e.data_inicio, e.data_fim 
        FROM ${SCHEMA}.escala e 
        JOIN ${SCHEMA}.usuario u ON e.id_usuario = u.id_usuario 
        WHERE NOW() BETWEEN e.data_inicio AND e.data_fim 
        ORDER BY e.data_inicio ASC LIMIT 1;
    `;

    // 2. Contagens (Backlog): Mostra TUDO que está pendente (não importa a data), 
    const contagensQuery = `
        SELECT 
            COUNT(*) FILTER (WHERE status = 'ABERTO') AS abertos, 
            COUNT(*) FILTER (WHERE status = 'RECONHECIDO') AS reconhecidos 
        FROM ${SCHEMA}.incidente;
    `;

    // 3. Métricas (Performance)
    // Filtramos apenas incidentes criados nas últimas 72 horas (3 dias)
    const metricasQuery = `
        SELECT 
            COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_ack - data_abertura)) / 60)), 0) AS mtta_minutos, 
            COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 60)), 0) AS mttr_minutos 
        FROM ${SCHEMA}.incidente 
        WHERE 
            status IN ('RECONHECIDO', 'FECHADO') 
            AND data_abertura >= NOW() - INTERVAL '3 DAYS'; -- Janela de 72h
    `;

    const client = await pool.connect();
    try {
        const [plantonistaRes, contagensRes, metricasRes] = await Promise.all([
            client.query(plantonistaQuery),
            client.query(contagensQuery),
            client.query(metricasQuery)
        ]);

        const plantonistaRow = (plantonistaRes && plantonistaRes.rows) ? plantonistaRes.rows[0] : null;
        const contagensRow = (contagensRes && contagensRes.rows) ? contagensRes.rows[0] : { abertos: 0, reconhecidos: 0 };
        const metricasRow = (metricasRes && metricasRes.rows) ? metricasRes.rows[0] : { mtta_minutos: 0, mttr_minutos: 0 };

        return {
            plantonista_atual: plantonistaRow,
            contagens: {
                abertos: Number(contagensRow.abertos || 0),
                reconhecidos: Number(contagensRow.reconhecidos || 0)
            },
            metricas: {
                mtta_minutos: Number(metricasRow.mtta_minutos || 0),
                mttr_minutos: Number(metricasRow.mttr_minutos || 0)
            }
        };

    } finally {
        if (client) client.release();
    }
};