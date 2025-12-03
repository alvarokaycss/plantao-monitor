// src/routes/incidentesRoutes.js

const express = require('express');
const router = express.Router();
const IncidentesController = require('../controllers/IncidentesController');
const { checkAuth, R_NENHUM, P_TODOS, P_ADMIN_OP, checkPermission } = require('../middleware/authMiddleware');

// Middleware de autenticação aplicado a todas as rotas de incidentes
router.use(checkAuth); 

// GET /incidentes
router.get("/", 
    checkPermission(R_NENHUM, P_TODOS), 
    IncidentesController.getIncidentes
);

// GET /incidentes/:id/detalhes
router.get("/:id/detalhes", 
    checkPermission(R_NENHUM, P_TODOS),
    IncidentesController.getIncidenteDetalhes
);

// POST /incidentes/:id/ack
router.post("/:id/ack", 
    checkPermission(R_NENHUM, P_ADMIN_OP),
    IncidentesController.ackIncident
);

// POST /incidentes/:id/close
router.post("/:id/close", 
    checkPermission(R_NENHUM, P_ADMIN_OP),
    IncidentesController.closeIncident
);

// POST /incidentes/:id/reexecute
router.post("/:id/reexecute",
    checkPermission(R_NENHUM, P_ADMIN_OP),
    IncidentesController.reexecuteIncident
);

module.exports = router;