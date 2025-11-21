// src/routes/incidentesRoutes.js

const express = require('express');
const router = express.Router();
const IncidentesController = require('../controllers/IncidentesController');
const { checkAuth, R_NENHUM, P_TODOS, checkPermission } = require('../middleware/authMiddleware');

// Middleware de autenticação aplicado a todas as rotas de incidentes
router.use(checkAuth); 

// TABELA INCIDENTE
// GET /incidentes (Todos usuários logados podem ver - R_NENHUM)
router.get("/", 
    checkPermission(R_NENHUM, P_TODOS), // Autorização básica (embora checkAuth já seja suficiente)
    IncidentesController.getIncidentes
);

// GET /incidentes/:id/detalhes
router.get("/:id/detalhes", 
    checkPermission(R_NENHUM, P_TODOS),
    IncidentesController.getIncidenteDetalhes
);

// POST /incidentes/:id/ack (Operadores podem reconhecer)
router.post("/:id/ack", 
    checkPermission(R_NENHUM, P_TODOS), // P_TODOS porque operadores (viewer) podem dar ACK. P_ADMIN_OP seria melhor se VIEWER não pudesse.
    IncidentesController.ackIncident
);

// POST /incidentes/:id/close (Operadores podem fechar)
router.post("/:id/close", 
    checkPermission(R_NENHUM, P_TODOS), // Mesma regra do ACK
    IncidentesController.closeIncident
);


module.exports = router;