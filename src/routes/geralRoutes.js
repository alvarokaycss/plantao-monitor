// src/routes/geralRoutes.js

const express = require('express');
const router = express.Router();
const GeralController = require('../controllers/GeralController');
const { checkAuth, checkPermission, R_NENHUM, P_ADMIN_OP } = require('../middleware/authMiddleware'); 

// Rotas Gerais (Públicas)
router.get("/", GeralController.healthCheck); 
router.get("/qqmonitor", GeralController.serveIndex);
// Teste de banco dados
router.get("/db-test", GeralController.dbTest);

// Rotas de Log (Protegidas) - RF15
// Logs geralmente são para Admin/Operator
router.get("/log_execucoes", checkAuth, checkPermission(R_NENHUM, P_ADMIN_OP), GeralController.getLogExecucoes);
router.get("/log_notificacoes", checkAuth, checkPermission(R_NENHUM, P_ADMIN_OP), GeralController.getLogNotificacoes);
router.get("/log_auditoria", checkAuth, checkPermission(R_NENHUM, P_ADMIN_OP), GeralController.getLogAuditoria);


module.exports = router;