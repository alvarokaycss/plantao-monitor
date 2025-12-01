// src/controllers/GeralController.js

const GeralService = require("../models/GeralService");
const path = require("path");
const pkg = require("../../package.json"); // Assume que package.json está na raiz
const { exec } = require('child_process'); // Utilizada para

/**
 * GET /
 * Health check/status.
 */
exports.healthCheck = (req, res) => {
    res.json({
        ok: true,
        name: pkg && pkg.name ? pkg.name : "shop-api-node",
        env: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
    });
};

/**
 * GET /qqmonitor
 * Rota que inicializa a aplicação servindo o index.html.
 */
exports.serveIndex = (req, res) => {
    // Retorna dois níveis acima (da pasta controllers para a raiz) + /public/index.html
    const filePath = path.join(__dirname, "..", "..", "public", "index.html"); 
    
    res.sendFile(filePath, (error) => {
        if (error) {
            console.error("Erro ao enviar index.html:", error);
            res.status(500).send("Erro ao carregar QQMonitor")
        }
    });
};


// Função utilitária para Logs
const getLogTable = (serviceMethod) => {
    return async (req, res) => {
        try {
            const data = await serviceMethod();
            res.json(data);
        } catch (error) {
            console.error(`ERROR log table:`, error);
            res.status(500).json({ error: "Erro ao buscar logs" });
        }
    };
};

// Função de ping para conexão com banco
exports.dbTest = async (req, res) => {
    try {
        const { pool } = require("../db/db");
        const result = await pool.query('SELECT NOW() as now');
        res.json({ 
            status: "OK", 
            message: "Conexão com Banco bem-sucedida!", 
            time: result.rows[0].now 
        });
    } catch (error) {
        res.status(500).json({ status: "ERRO", error: error.message });
    }
};

exports.gerarRelatorioAnalytics = (req, res) => {
    // Caminho absoluto para o script Python
    const scriptPath = path.join(__dirname, '../../src/analytics/gerar_relatorio.py');
    
    // Comando para rodar
    exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao rodar analytics: ${error.message}`);
            return res.status(500).json({ error: "Falha ao gerar relatório." });
        }
        
        console.log(`Analytics Output: ${stdout}`);
        
        // Retorna o caminho da imagem pública para o front exibir
        // Adiciona um timestamp na URL para evitar cache do navegador
        res.json({ 
            success: true, 
            imageUrl: `/relatorios/analise_performance.png?t=${Date.now()}` 
        });
    });
};

// Função pra consulta fila_runner
exports.runner = async (req, res) => {
    try {
    const data = await GeralService.getFilaRunner();
        res.json({data})
    } catch (error) {
        res.status(500).json({ status: "ERRO", error: error.message });
    }
}

// Exporta as funções de Log (usando o service)
exports.getLogExecucoes = getLogTable(GeralService.getLogExecucoes);
exports.getLogNotificacoes = getLogTable(GeralService.getLogNotificacoes);
exports.getLogAuditoria = getLogTable(GeralService.getLogAuditoria);