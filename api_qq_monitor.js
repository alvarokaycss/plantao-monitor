require("dotenv").config(); // carrega .env pra dentro de process
require("./src/db/db"); // Inicializa a conexão com o BD e verifica variáveis de ambiente

const express = require("express");
const cors = require("cors");
const process = require("process");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account-key.json");

// Importação dos Roteadores Modulares (Camada de Rota)
const incidentesRoutes = require('./src/routes/incidentesRoutes');
const auxiliarRoutes = require('./src/routes/auxiliarRoutes');
const kpiRoutes = require('./src/routes/kpiRoutes');
const regrasRoutes = require('./src/routes/regrasRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');
const escalasRoutes = require('./src/routes/escalasRoutes');
const geralRoutes = require('./src/routes/geralRoutes');

const app = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Ligação dos Roteadores ao caminho base (app.use)
app.use("/", auxiliarRoutes); // Rotas auxiliares (/bancos, /roles, etc.)
app.use("/", geralRoutes); // Rotas gerais (/, /qqmonitor, /log_*)
app.use("/incidentes", incidentesRoutes);
app.use("/kpis", kpiRoutes);
app.use("/regras", regrasRoutes);
app.use("/usuarios", usuariosRoutes);
app.use("/escalas", escalasRoutes);

// Configurações básicas e de verificação de variáveis ambiente
const PORT = process.env.PORT || 8000;
const DATABASE_URL = process.env.DATABASE_URL;

// Inicialização do Firebase Admin
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK inicializado!!");
} catch (error) {
    console.error("ERRO ao inicializar Firebase Admin:", error.message);
    process.exit(1);
}

// Start
app.listen(PORT, () => {
    console.log(`API (Plantão Monitor) rodando em http://localhost:${PORT}`);
    console.log(`DB: ${DATABASE_URL ? "Conexao com BD OK!" : "Verificar coxexao com BD"}`);
});