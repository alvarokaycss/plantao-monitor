// tests/api.test.js

// 1. Mocks de Infraestrutura
jest.mock('firebase-admin', () => {
    return {
        initializeApp: jest.fn(),
        credential: {
            cert: jest.fn(() => 'mock-firebase-credential')
        }
    };
});

jest.mock('../firebase-service-account-key.json', () => {
    return {
        project_id: 'mock-firebase-project-id'
    };
}, { virtual: true });

jest.mock('../src/db/db', () => {
    return {
        pool: {
            query: jest.fn(() => Promise.resolve({ rows: [{ now: '2026-07-01T21:00:00.000Z' }] })),
            connect: jest.fn(() => Promise.resolve({
                query: jest.fn(() => Promise.resolve({ rows: [{ now: '2026-07-01T21:00:00.000Z' }] })),
                release: jest.fn()
            })),
            on: jest.fn()
        },
        SCHEMA: 'test_schema'
    };
});

// 2. Import do app após configurar os mocks
const request = require('supertest');
const { app, server } = require('../api_qq_monitor');

describe('Plantão Monitor API - Testes de Integração Básicos', () => {
    
    // Fecha o servidor HTTP após os testes para liberar a porta se estiver rodando
    afterAll((done) => {
        if (server && server.listening) {
            server.close(done);
        } else {
            done();
        }
    });

    it('Deve carregar a página inicial index.html com status 200 (GET /)', async () => {
        const response = await request(app).get('/');
        
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
    });

    it('Deve responder com sucesso no teste de conexão com o banco (GET /db-test)', async () => {
        const response = await request(app).get('/db-test');
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('OK');
        expect(response.body.message).toContain('Conexão com Banco');
    });

    it('Deve responder com status 200 no webhook de notificação (POST /webhook/notify-update)', async () => {
        const response = await request(app)
            .post('/webhook/notify-update')
            .send({
                mensagem: 'Teste de incidente',
                tipo: 'critical',
                id_incidente: 123
            });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('broadcast_sent');
    });
});
