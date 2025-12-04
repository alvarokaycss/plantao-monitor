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
 */
const checkAuth = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) return res.status(401).json({ error: "Token ausente." });

    const parts = authorization.split(' ');
    if (parts.length !== 2) return res.status(401).json({ error: "Token mal formatado." });

    const idToken = parts[1];

    try {
        // 1. Valida Token no Firebase
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid } = decodedToken;

        // 2. Consulta Rápida no Postgres (SEM TRANSAÇÃO)
        const client = await pool.connect();
        try {
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

            // CENÁRIO A: Usuário não existe no banco
            if (rows.length === 0) {
                // Código específico para o Frontend saber que precisa chamar o /register
                return res.status(404).json({ 
                    error: "Usuário não registrado no sistema interno.",
                    code: "USER_NOT_FOUND_IN_DB" 
                });
            }

            const userProfile = rows[0];

            // CENÁRIO B: Usuário existe mas está inativo (Regra de Negócio)
            if (userProfile.ativo === false) {
                return res.status(403).json({ 
                    error: "Sua conta aguarda aprovação do administrador.",
                    code: "USER_INACTIVE" 
                });
            }

            // Sucesso
            req.user = userProfile;
            next();

        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Auth Error:", error);
        return res.status(403).json({ error: "Falha na autenticação." });
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