// src/routes/escalasRoutes.js

const express = require('express');
const router = express.Router();
const EscalasController = require('../controllers/EscalasController');
const { checkAuth, checkPermission, R_ESCALAS, P_ADMIN_OP } = require('../middleware/authMiddleware');

// Rotas /escalas/*
router.use(checkAuth); 

// GET /escalas (Admin/Operator podem ver a tela de Escalas)
router.get("/", 
    checkPermission(R_ESCALAS, P_ADMIN_OP), 
    EscalasController.getEscalas
);

// POST /escalas (Admin/Operator podem criar)
router.post("/", 
    checkPermission(R_ESCALAS, P_ADMIN_OP), 
    EscalasController.createEscala
);

module.exports = router;