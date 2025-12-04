// src/routes/usuariosRoutes.js

const express = require('express');
const router = express.Router();
const UsuariosController = require('../controllers/UsuariosController');
const { checkAuth, checkPermission, R_USUARIOS, P_ADMIN, P_TODOS, R_NENHUM } = require('../middleware/authMiddleware');

// Rota publica de registro de usuário
router.post("/register", UsuariosController.registerUser);

// Rotas /usuarios/*
router.use(checkAuth); 

// GET /usuarios (Admin pode listar todos)
router.get("/", 
    checkPermission(R_USUARIOS, P_ADMIN), // Requer recurso TELA_USUARIOS e perfil ADMIN
    UsuariosController.getUsuarios
);

// GET /usuarios/eu/detalhes (Qualquer usuário logado pode ver o próprio perfil)
router.get("/eu/detalhes", 
    checkPermission(R_NENHUM, P_TODOS),
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

// DELETE /usuarios/:id (Admin pode excluir)
router.delete("/:id", 
    checkPermission(R_USUARIOS, P_ADMIN), 
    UsuariosController.deleteUsuario
);


module.exports = router;