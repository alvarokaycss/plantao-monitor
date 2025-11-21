// src/controllers/AuxiliarController.js

const AuxiliarService = require("../models/AuxiliarService");

// Função genérica para lidar com todas as rotas de SELECT *
const getAuxiliarTable = (tableKey) => {
    return async (req, res) => {
        try {
            const data = await AuxiliarService.selectAll(tableKey);
            res.json(data);
        } catch (error) {
            console.error(`ERROR /${tableKey}:`, error);
            if (error.code === "TABLE_NOT_ALLOWED") {
                 return res.status(400).json({ error: `Tabela ${tableKey} não suportada.` });
            }
            res.status(500).json({ error: `Erro ao buscar ${tableKey}` });
        }
    };
};

// Exporta as funções nomeadas para o Router
exports.getPerfis = getAuxiliarTable("perfis");
exports.getBancos = getAuxiliarTable("bancos");
exports.getRoles = getAuxiliarTable("roles");
exports.getTiposCanal = getAuxiliarTable("tipos_canal_notificacao");
exports.getRecursos = getAuxiliarTable("recursos");
exports.getUsuarioRecursos = getAuxiliarTable("usuario_recursos");
exports.getConfiguracoesNotificacao = getAuxiliarTable("configuracoes_notificacao");