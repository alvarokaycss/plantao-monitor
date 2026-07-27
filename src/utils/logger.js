// src/utils/logger.js

const pino = require('pino');

// Configuração do Logger
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    
    redact: {
        paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.senha',
            'req.body.idToken',
            'req.body.token',
            'res.headers["set-cookie"]'
        ],
        censor: '[REDACTED]'
    },

    // Formatação para ambiente de desenvolvimento
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined
});

module.exports = logger;
