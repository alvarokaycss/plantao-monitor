// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';
import admin from 'firebase-admin';
import { pool, SCHEMA } from '../db/db';
import { IUserProfile } from '../models/user.model';
const logger = require('../utils/logger');

// PERMISSÕES DE USUÁRIO (ACESSO ÀS TELAS E ROTAS DA APLICAÇÃO)
export const P_ADMIN: string[] = ['admin'];
export const P_ADMIN_OP: string[] = ['admin', 'operator'];
export const P_TODOS: string[] = ['admin', 'operator', 'viewer'];

// Recursos da Aplicação
export const R_REGRAS: string = 'TELA_REGRAS';
export const R_ESCALAS: string = 'TELA_ESCALAS';
export const R_USUARIOS: string = 'TELA_USUARIOS';
export const R_CONFIGS: string = 'TELA_CONFIGS';
export const R_NENHUM: null = null;

/**
 * Middleware de Autenticação e Provisionamento
 */
export const checkAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).json({ error: "Token ausente." });
    }

    const parts = authorization.split(' ');
    if (parts.length !== 2) {
        return res.status(401).json({ error: "Token mal formatado." });
    }

    const idToken = parts[1];

    try {
        // 1. Valida Token no Firebase
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid } = decodedToken;

        // 2. Consulta Rápida no Postgres (Direto no Pool para otimizar conexões)
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
        const { rows } = await pool.query<IUserProfile>(userQuery, [uid]);

        // CENÁRIO A: Usuário não existe no banco
        if (rows.length === 0) {
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

        // Sucesso: Anexa perfil tipado ao req.user
        (req as any).user = userProfile;
        next();

    } catch (error) {
        logger.error({ err: error }, "Falha na autenticação do Firebase");
        return res.status(403).json({ error: "Falha na autenticação." });
    }
};

/**
 * Middleware de Autorização (AuthZ)
 */
export const checkPermission = (recursoChave: string | null, perfisPermitidos: string[]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void | Response => {
        const user = (req as any).user as IUserProfile | undefined;
        if (!user) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const { perfil_nome, recursos } = user;

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
