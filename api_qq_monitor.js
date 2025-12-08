require("dotenv").config();
require("./src/db/db");

const express = require("express");
const cors = require("cors");
const process = require("process");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account-key.json");

// Importação das Rotas
const incidentesRoutes = require('./src/routes/incidentesRoutes');
const auxiliarRoutes = require('./src/routes/auxiliarRoutes');
const kpiRoutes = require('./src/routes/kpiRoutes');
const regrasRoutes = require('./src/routes/regrasRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');
const escalasRoutes = require('./src/routes/escalasRoutes');
const geralRoutes = require('./src/routes/geralRoutes');

const app = express();

// 1. Criação do Servidor HTTP "híbrido" (Express + Socket)
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Apenas para desenvolimento, aqui ficaria o domínio do site
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 2. Injeta o 'io' no request (para usar nos Controllers se precisar)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// 3. Rota Interna para o Python chamar
app.post("/webhook/notify-update", (req, res) => {
    // Agora desestruturamos tudo
    const { mensagem, tipo, id_incidente } = req.body;
    
    console.log(`[Webhook] Evento: ${tipo} | ID: ${id_incidente}`);
    
    // Repassa tudo para o Frontend
    io.emit("dashboard_update", { 
        mensagem, 
        tipo,
        id_incidente, // Importante para o front saber o que atualizar
        timestamp: new Date() 
    });
    
    res.json({ status: "broadcast_sent" });
});
// Por enquanto a rota está pública o ideal seria criar um token de validação
// no .env, e deixar acessível somente para os serviços internos.

// Rotas da Aplicação
app.use("/", auxiliarRoutes);
app.use("/", geralRoutes);
app.use("/incidentes", incidentesRoutes);
app.use("/kpis", kpiRoutes);
app.use("/regras", regrasRoutes);
app.use("/usuarios", usuariosRoutes);
app.use("/escalas", escalasRoutes);

// Firebase
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK inicializado!!");
} catch (error) {
    console.error("ERRO Firebase:", error.message);
    process.exit(1);
}

// 4. Listener do Socket.io (Log de conexões)
io.on("connection", (socket) => {
    console.log(`Cliente WebSocket conectado: ${socket.id}`);
    
    socket.on("disconnect", () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 8000;

// ATENÇÃO: Usamos server.listen em vez de app.listen
server.listen(PORT, () => {
    console.log(`🚀 API + WebSocket rodando em http://localhost:${PORT}`);
});

// Refatorar para websocketService.js (Seguindo padrão MVC)