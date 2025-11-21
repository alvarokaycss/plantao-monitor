// src/routes/regrasRoutes.js

const express = require('express');
const router = express.Router();
const RegrasController = require('../controllers/RegrasController');
const { checkAuth, checkPermission, R_REGRAS, P_ADMIN_OP } = require('../middleware/authMiddleware');

// Aplica autenticação a todas as rotas de Regras
router.use(checkAuth); 

// Rotas de Leitura (Admin e Operator podem ver a lista)
router.get("/", 
    checkPermission(R_REGRAS, P_ADMIN_OP), 
    RegrasController.getRegras
);
router.get("/:id/detalhes", 
    checkPermission(R_REGRAS, P_ADMIN_OP), 
    RegrasController.getRegraDetalhes
);

// Rotas de Manipulação (Admin e Operator podem criar/editar)
router.post("/", 
    checkPermission(R_REGRAS, P_ADMIN_OP), // Assume que Operator também pode criar
    RegrasController.createRegra
);
router.put("/:id", 
    checkPermission(R_REGRAS, P_ADMIN_OP), 
    RegrasController.updateRegra
);
router.patch("/:id/acoes", 
    checkPermission(R_REGRAS, P_ADMIN_OP), 
    RegrasController.updateRegraAcoes
);

// Rota de Exclusão (Admin e Operator podem excluir)
router.delete("/:id", 
    checkPermission(R_REGRAS, P_ADMIN_OP), 
    RegrasController.deleteRegra
);

module.exports = router;