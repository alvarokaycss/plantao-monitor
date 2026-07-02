// api_qq_monitor.js

require("dotenv").config();
require("./src/db/db");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const process = require("process");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account-key.json");
const logger = require("./src/utils/logger"); 

// Importação das Rotas
const incidentesRoutes = require('./src/routes/incidentesRoutes');
const auxiliarRoutes = require('./src/routes/auxiliarRoutes');
const kpiRoutes = require('./src/routes/kpiRoutes');
const regrasRoutes = require('./src/routes/regrasRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');
const escalasRoutes = require('./src/routes/escalasRoutes');
const geralRoutes = require('./src/routes/geralRoutes');

const app = express();

// MIDDLEWARES DE SEGURANÇA E INFRA

const recursosPermitidos = [
    "'self'",
    "https://www.gstatic.com",
    "https://cdn.socket.io",
    "https://*.firebaseio.com", 
    "https://*.googleapis.com"
];

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            'default-src': ["'self'"],
            'script-src': recursosPermitidos,
            'connect-src': [
                "'self'", 
                "https://www.gstatic.com", 
                "https://cdn.socket.io", 
                "ws://localhost:8000",
                "https://identitytoolkit.googleapis.com",
                "https://securetoken.googleapis.com",
                "https://*.firebaseio.com"
            ],
            'img-src': ["'self'", "data:", "https://*.googleusercontent.com"], 
        },
    })
);

// CORS
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Logger: Registra todas as requisições
app.use(pinoHttp({ 
    logger,
    customSuccessMessage: (req, res) => `${req.method} ${req.url} - ${res.statusCode}`
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// CONFIGURAÇÃO SOCKET.IO 

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use((req, res, next) => {
    req.io = io;
    next();
});

// Webhook Interno (Python)
app.post("/webhook/notify-update", (req, res) => {
    const { mensagem, tipo, id_incidente } = req.body;
    
    logger.info({ tipo, id_incidente }, `[Webhook] Recebido: ${mensagem}`);
    
    io.emit("dashboard_update", { 
        mensagem, 
        tipo,
        id_incidente, 
        timestamp: new Date() 
    });
    
    res.json({ status: "broadcast_sent" });
});

app.use("/", auxiliarRoutes);
app.use("/", geralRoutes);
app.use("/incidentes", incidentesRoutes);
app.use("/kpis", kpiRoutes);
app.use("/regras", regrasRoutes);
app.use("/usuarios", usuariosRoutes);
app.use("/escalas", escalasRoutes);

// INICIALIZAÇÃO

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    logger.info("Firebase Admin SDK inicializado!");
} catch (error) {
    logger.error({ err: error }, "ERRO CRÍTICO ao iniciar Firebase");
    process.exit(1);
}

io.on("connection", (socket) => {
    logger.info(`WebSocket Client conectado: ${socket.id}`);
    
    socket.on("disconnect", () => {
        logger.info(`WebSocket Client desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        logger.info(`API + WebSocket rodando em http://localhost:${PORT}`);
        logger.info(`Seguranca (Helmet) e Logging (Pino) ativos.`);
    });
}

module.exports = { app, server };