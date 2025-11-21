// src/routes/kpiRoutes.js

const express = require('express');
const router = express.Router();
const KPIController = require('../controllers/KPIController');
const { checkAuth, R_NENHUM, P_TODOS, checkPermission } = require('../middleware/authMiddleware');

// GET /kpis (Todos os usuários logados podem ver)
router.get("/", 
    checkAuth, 
    checkPermission(R_NENHUM, P_TODOS), // Autorização básica para todos os usuários logados
    KPIController.getKPIs
);

module.exports = router;