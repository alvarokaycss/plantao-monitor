// src/models/KPIService.js

const { pool, SCHEMA } = require("../db/db");

/**
 * Busca todos os KPIs (Plantonista, Contagens, Métricas) em três consultas paralelas.
 * @returns {object} - O objeto de resposta com todos os dados de KPI.
 */
exports.getKPIsData = async () => {
    // Queries extraídas do bloco original (limpas e em linha única)
    const plantonistaQuery = `
        SELECT u.nome, e.data_inicio, e.data_fim 
        FROM ${SCHEMA}.escala e 
        JOIN ${SCHEMA}.usuario u ON e.id_usuario = u.id_usuario 
        WHERE NOW() BETWEEN e.data_inicio AND e.data_fim 
        ORDER BY e.data_inicio ASC LIMIT 1;
    `;

    const contagensQuery = `
        SELECT 
            COUNT(*) FILTER (WHERE status = 'ABERTO') AS abertos, 
            COUNT(*) FILTER (WHERE status = 'RECONHECIDO') AS reconhecidos 
        FROM ${SCHEMA}.incidente;
    `;

    const metricasQuery = `
        SELECT 
            COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_ack - data_abertura)) / 60)), 0) AS mtta_minutos, 
            COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 60)), 0) AS mttr_minutos 
        FROM ${SCHEMA}.incidente 
        WHERE status IN ('RECONHECIDO', 'FECHADO');
    `;

    const client = await pool.connect();
    try {
        // Executa as três queries em paralelo
        const [plantonistaRes, contagensRes, metricasRes] = await Promise.all([
            client.query(plantonistaQuery),
            client.query(contagensQuery),
            client.query(metricasQuery)
        ]);

        // Mapeia as respostas defensivamente (incluindo tratamento para null)
        const plantonistaRow = (plantonistaRes && plantonistaRes.rows) ? plantonistaRes.rows[0] : null;
        const contagensRow = (contagensRes && contagensRes.rows) ? contagensRes.rows[0] : { abertos: 0, reconhecidos: 0 };
        const metricasRow = (metricasRes && metricasRes.rows) ? metricasRes.rows[0] : { mtta_minutos: 0, mttr_minutos: 0 };

        const resposta = {
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

        return resposta;

    } finally {
        if (client) client.release();
    }
};