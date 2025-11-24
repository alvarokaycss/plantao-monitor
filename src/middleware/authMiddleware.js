// src/middleware/authMiddleware.js

const admin = require("firebase-admin");
const { pool, SCHEMA } = require("../db/db");

// PERMISSÕES DE USUÁRIO (ACESSO ÀS TELAS E ROTAS DA APLICAÇÃO)
// Perfis da aplicação
const P_ADMIN = ['admin'];
const P_ADMIN_OP = ['admin', 'operator'];
const P_TODOS = ['admin', 'operator', 'viewer'];
// Recursos da Aplicação
const R_REGRAS = 'TELA_REGRAS';
const R_ESCALAS = 'TELA_ESCALAS';
const R_USUARIOS = 'TELA_USUARIOS';
const R_CONFIGS = 'TELA_CONFIGS';
const R_NENHUM = null; // Para telas de acesso padrão (Incidentes e KPIs)


/**
 * Middleware de Autenticação e Provisionamento
 * Verifica o Token do Firebase, carrega ou cria o usuário no Postgres.
 * Inclui:
 * 1. Provisionamento inicial com ativo=FALSE (segurança).
 * 2. BLOQUEIO DE ACESSO se a flag 'ativo' for FALSE.
 * 3. Configuração automática e idempotente do canal de Email (UPSERT).
 */
const checkAuth = async (req, res, next) => {
    const authorization = req.headers.authorization;

    // 1. Validação inicial de presença (mantida)
    if (!authorization) {
        return res.status(401).json({ error: "Token de autorização ausente." });
    }

    // 2. Extração e verificação do Token (mantida)
    const parts = authorization.split(' ');
    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
        return res.status(401).json({ error: "Token mal formatado. Formato esperado: 'Bearer <token>'" });
    }

    const idToken = parts[1];
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        console.error("Erro ao verificar token Firebase:", error.code);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "Token expirado. Faça login novamente." });
        }
        if (error.code === 'auth/argument-error') {
            return res.status(400).json({ error: "Token inválido ou vazio." });
        }
        return res.status(403).json({ error: "Falha na autorização." });
    }

    const { uid, email, name } = decodedToken;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Inicia a transação para segurança

        // Passo 1: Tenta inserir o usuário (ON CONFLICT DO NOTHING)
        const nomeUsuario = name || email.split('@')[0];
        const insertQuery = `
            INSERT INTO ${SCHEMA}.usuario (uid_firebase, id_perfil, email, nome)
            VALUES ($1, 3, $2, $3)
            ON CONFLICT (uid_firebase) DO NOTHING;
        `;
        await client.query(insertQuery, [uid, email, nomeUsuario]);

        // Passo 2: Busca o perfil e o ID do usuário (incluindo a flag 'ativo')
        const userQuery = `
            SELECT 
                u.id_usuario, u.nome, u.ativo, u.email,
                p.nome AS perfil_nome,
                ARRAY_REMOVE(ARRAY_AGG(r.chave_recurso), NULL) AS recursos
            FROM ${SCHEMA}.usuario u
            JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
            LEFT JOIN ${SCHEMA}.usuario_recursos ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN ${SCHEMA}.recursos r ON ur.id_recurso = r.id_recurso
            WHERE u.uid_firebase = $1
            GROUP BY u.id_usuario, p.nome, u.email;
        `;
        
        const { rows } = await client.query(userQuery, [uid]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            console.error(`[checkAuth] FALHA CRÍTICA: UID ${uid} não encontrado.`);
            return res.status(500).json({ error: "Falha ao provisionar perfil de usuário." });
        }

        const userProfile = rows[0];
        
        // ============================================
        // CHECAGEM CRÍTICA DE ATIVAÇÃO (RF03)
        // ============================================
        if (userProfile.ativo === false) {
            await client.query('ROLLBACK');
            // Retorna um 403 ou 401. 403 é mais descritivo: Acesso negado.
            return res.status(403).json({ 
                error: "Usuário inativo. Seu acesso deve ser aprovado por um administrador.",
                code: "USER_INACTIVE" // Código customizado para o frontend identificar e tratar
            });
        }
        // ============================================


        const idUsuario = userProfile.id_usuario;

        // Passo 3: Configuração Automática de Email (RF04 - UPSERT)
        const canalEmailQuery = `
            SELECT id_tipo_canal 
            FROM ${SCHEMA}.tipos_canal_notificacao 
            WHERE nome ILIKE 'Email';
        `;
        const canalEmailRes = await client.query(canalEmailQuery);
        
        if (canalEmailRes.rows.length > 0) {
            const idTipoCanalEmail = canalEmailRes.rows[0].id_tipo_canal;
            const userEmail = userProfile.email;

            const insertOrUpdateEmailConfig = `
                INSERT INTO ${SCHEMA}.configuracoes_notificacao 
                (id_usuario, id_tipo_canal, endereco_notificacao, habilitado)
                VALUES ($1, $2, $3, FALSE) 
                ON CONFLICT (endereco_notificacao) DO UPDATE 
                SET 
                    id_usuario = EXCLUDED.id_usuario,
                    id_tipo_canal = EXCLUDED.id_tipo_canal,
                    habilitado = configuracoes_notificacao.habilitado
                WHERE configuracoes_notificacao.id_usuario != EXCLUDED.id_usuario 
                RETURNING id_configuracao_notificacao;
            `;
            
            try {
                await client.query(insertOrUpdateEmailConfig, [idUsuario, idTipoCanalEmail, userEmail]);
            } catch (conflictError) {
                console.error(`[checkAuth] Falha não esperada no UPSERT de Email para ${userEmail}:`, conflictError);
            }

        } else {
             console.warn("[checkAuth] Tipo de Canal 'Email' não encontrado na tabela. Pulando configuração automática.");
        }

        await client.query('COMMIT'); // Finaliza a transação
        
        req.user = userProfile;
        next();

    } catch (err) {
        // Se a transação falhou em um ponto anterior, este catch a reverte.
        await client.query('ROLLBACK'); 
        
        // Se o erro foi o 403/USER_INACTIVE que geramos, o erro deve ser lançado ANTES daqui.
        // Se não foi lançado, tratamos como erro interno (500).
        console.error("Erro no middleware checkAuth (DB):", err);
        res.status(500).json({ error: "Erro interno ao processar autorização." });
    } finally {
        if (client) client.release();
    }
};


/**
 * Middleware de Autorização (AuthZ)
 */
const checkPermission = (recursoChave, perfisPermitidos) => {
    return (req, res, next) => {
        // req.user foi anexado pelo middleware checkAuth
        const { perfil_nome, recursos } = req.user;

        // 1. Checagem de Visibilidade (Toggle)
        if (recursoChave && !recursos.includes(recursoChave)) {
            return res.status(403).json({ error: `Acesso negado. Requer o toggle de recurso: ${recursoChave}` });
        }
        
        // 2. Checagem de Ação (Perfil)
        if (!perfisPermitidos.includes(perfil_nome)) {
            return res.status(403).json({ error: `Ação não permitida para o seu perfil (${perfil_nome}). Requer um dos: [${perfisPermitidos.join(', ')}]` });
        }

        // 3. Sucesso
        next();
    };
};

module.exports = {
    checkAuth,
    checkPermission,
    P_ADMIN, P_ADMIN_OP, P_TODOS, 
    R_REGRAS, R_ESCALAS, R_USUARIOS, R_CONFIGS, R_NENHUM
};