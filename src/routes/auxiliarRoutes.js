// src/routes/auxiliarRoutes.js

const express = require('express');
const router = express.Router();
const AuxiliarController = require('../controllers/AuxiliarController');
const { checkAuth } = require('../middleware/authMiddleware'); // Necessário para rotas protegidas

// Rotas públicas (usadas até mesmo antes do perfil ser confirmado)
router.get("/perfis", AuxiliarController.getPerfis);
router.get("/bancos", AuxiliarController.getBancos);
router.get("/tipos_canal_notificacao", AuxiliarController.getTiposCanal);
router.get("/recursos", AuxiliarController.getRecursos);
router.get("/usuario_recursos", AuxiliarController.getUsuarioRecursos);
router.get("/configuracoes_notificacao", AuxiliarController.getConfiguracoesNotificacao);


// Rotas protegidas (Requerem autenticação - ex: Roles são usadas para a Regra)
router.get("/roles", checkAuth, AuxiliarController.getRoles);


module.exports = router;