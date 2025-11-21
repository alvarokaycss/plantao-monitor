// src/routes/usuariosRoutes.js

const express = require('express');
const router = express.Router();
const UsuariosController = require('../controllers/UsuariosController');
const { checkAuth, checkPermission, R_USUARIOS, P_ADMIN, P_TODOS } = require('../middleware/authMiddleware');

// Rotas /usuarios/*
router.use(checkAuth); 

// GET /usuarios (Admin pode listar todos)
router.get("/", 
    checkPermission(R_USUARIOS, P_ADMIN), // Requer recurso TELA_USUARIOS e perfil ADMIN
    UsuariosController.getUsuarios
);

// GET /usuarios/eu/detalhes (Qualquer usuário logado pode ver o próprio perfil)
router.get("/eu/detalhes", 
    checkPermission(R_USUARIOS, P_TODOS), // Requer recurso TELA_USUARIOS (ou P_TODOS se for só a rota)
    UsuariosController.getMeuDetalhe
);

// GET /usuarios/:id/detalhes (Admin pode ver detalhes de qualquer usuário)
router.get("/:id/detalhes", 
    checkPermission(R_USUARIOS, P_ADMIN), 
    UsuariosController.getUsuarioDetalhes
);

// PUT /usuarios/:id/configuracao (Admin pode configurar)
router.put("/:id/configuracao", 
    checkPermission(R_USUARIOS, P_ADMIN), 
    UsuariosController.updateUsuarioConfiguracao
);


module.exports = router;