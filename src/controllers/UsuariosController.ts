// src/controllers/UsuariosController.ts

import { RequestHandler } from 'express';
import admin from 'firebase-admin';
import * as UsuariosService from '../services/UsuariosService';
import { asInteger } from '../utils/helpers';
import { pool, SCHEMA } from '../db/db';
import { IUserProfile } from '../models/user.model';
import { 
    IRegisterUserDTO, 
    IUpdateUsuarioConfigDTO, 
    IUpdateMeuPerfilDTO, 
    IUsuariosFiltrosDTO 
} from '../dtos/user.dto';
const logger = require('../utils/logger');

export const registerUser: RequestHandler<{}, any, IRegisterUserDTO> = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        res.status(400).json({ error: "Token de identificação é obrigatório." });
        return;
    }

    let decodedToken: admin.auth.DecodedIdToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        res.status(401).json({ error: "Token inválido ou expirado." });
        return;
    }

    const { uid, email, name } = decodedToken;

    if (!email) {
        res.status(400).json({ error: "Token Firebase não possui um e-mail válido." });
        return;
    }

    const nomeUsuario = name || email.split('@')[0];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertUserQuery = `
            INSERT INTO ${SCHEMA}.usuario (uid_firebase, id_perfil, email, nome, ativo)
            VALUES ($1, 3, $2, $3, FALSE)
            ON CONFLICT (email) DO UPDATE SET 
                uid_firebase = EXCLUDED.uid_firebase
            RETURNING id_usuario, ativo;
        `;
        const userRes = await client.query<{ id_usuario: number; ativo: boolean }>(insertUserQuery, [uid, email, nomeUsuario]);
        const newUser = userRes.rows[0];

        const canalEmailQuery = `SELECT id_tipo_canal FROM ${SCHEMA}.tipos_canal_notificacao WHERE nome ILIKE 'Email'`;
        const canalRes = await client.query<{ id_tipo_canal: number }>(canalEmailQuery);

        if (canalRes.rows.length > 0) {
            const idTipoEmail = canalRes.rows[0].id_tipo_canal;
            const configQuery = `
                INSERT INTO ${SCHEMA}.configuracoes_notificacao 
                (id_usuario, id_tipo_canal, endereco_notificacao, habilitado)
                VALUES ($1, $2, $3, FALSE)
                ON CONFLICT (endereco_notificacao) DO NOTHING;
            `;
            await client.query(configQuery, [newUser.id_usuario, idTipoEmail, email]);
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            message: "Cadastro realizado. Aguarde aprovação do administrador.",
            user: newUser
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ err: error }, "Erro no registro de usuário");
        res.status(500).json({ error: "Erro ao registrar usuário." });
    } finally {
        client.release();
    }
};

export const getUsuarios: RequestHandler = async (req, res) => {
    try {
        const { ativo, id_perfil, pesquisa } = req.query;
        const filtros: IUsuariosFiltrosDTO = {};
        
        if (ativo !== undefined && ativo !== '') {
            filtros.ativo = (ativo === 'true');
        }
        if (id_perfil && id_perfil !== '') {
            filtros.id_perfil = String(id_perfil);
        }
        if (pesquisa && typeof pesquisa === 'string' && pesquisa.trim().length > 0) {
            filtros.pesquisa = pesquisa.trim();
        }

        const usuarios = await UsuariosService.selectUsuariosFiltrados(filtros);
        res.json(usuarios);

    } catch (error) {
        logger.error({ err: error }, "Erro ao buscar usuários");
        res.status(500).json({ error: "Erro interno ao listar usuários." });
    }
};

export const getMeuDetalhe: RequestHandler = async (req, res) => {
    const userProfile = req.user as IUserProfile | undefined;

    if (!userProfile || !userProfile.id_usuario) {
        res.status(401).json({ error: "Usuário não autenticado." });
        return;
    }

    const idUsuarioVal = userProfile.id_usuario; 

    try {
        const data = await UsuariosService.getUsuarioDetalhes(idUsuarioVal);
        
        if (!data) {
            res.status(404).json({ error: "Usuário do token não encontrado no banco." });
            return;
        }
        
        res.json(data);

    } catch (error) {
        logger.error({ err: error, idUsuarioVal }, `ERROR getMeuDetalhe (${idUsuarioVal})`);
        res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
    }
};

export const getUsuarioDetalhes: RequestHandler<{ id: string }> = async (req, res) => {
    const idUsuarioVal = asInteger(req.params.id);

    if (!idUsuarioVal) {
        res.status(400).json({ error: "ID de usuário inválido." });
        return;
    }

    try {
        const data = await UsuariosService.getUsuarioDetalhes(idUsuarioVal);

        if (!data) {
            res.status(404).json({ error: "Usuário não encontrado." });
            return;
        }
        
        res.json(data);

    } catch (error) {
        logger.error({ err: error, idUsuarioVal }, `ERROR getUsuarioDetalhes (${idUsuarioVal})`);
        res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
    }
};

export const updateUsuarioConfiguracao: RequestHandler<{ id: string }, any, IUpdateUsuarioConfigDTO> = async (req, res) => {
    const idUsuarioParaConfigurar = asInteger(req.params.id);
    const { id_perfil, ativo, recursos, notificacoes } = req.body || {};

    if (!idUsuarioParaConfigurar) {
        res.status(400).json({ error: "ID de usuário inválido." });
        return;
    }

    const idPerfilVal = asInteger(id_perfil);
    if (!idPerfilVal) {
        res.status(400).json({ error: "id_perfil é obrigatório e deve ser um número inteiro positivo." });
        return;
    }
    
    const statusAtivo = (ativo === undefined) ? true : Boolean(ativo);
    const recursosVal = (Array.isArray(recursos) ? recursos : [])
        .map(asInteger)
        .filter((id): id is number => id !== null);
    
    const notificacoesVal = (Array.isArray(notificacoes) ? notificacoes : []).filter(n => 
        asInteger(n.id_tipo_canal) && n.endereco_notificacao
    );

    try {
        await UsuariosService.updateUsuarioConfiguracao(idUsuarioParaConfigurar, {
            idPerfilVal, statusAtivo, recursosVal, notificacoesVal
        });

        res.status(200).json({ message: "Configurações do usuário atualizadas com sucesso." });

    } catch (err: any) {
        if (err && err.code === "23503") {
            res.status(409).json({ error: "Falha ao configurar usuário: id_perfil ou outro ID referenciado não foi encontrado." });
            return;
        }
        if (err && err.message === "Usuário não encontrado para configurar.") {
            res.status(404).json({ error: "Usuário não encontrado para configuração." });
            return;
        }
        logger.error({ err, idUsuarioParaConfigurar }, `Erro ao configurar usuário ${idUsuarioParaConfigurar}`);
        res.status(500).json({ error: "Erro interno ao configurar usuário" });
    }
};

export const updateMeuPerfil: RequestHandler<{}, any, IUpdateMeuPerfilDTO> = async (req, res) => {
    const userProfile = req.user as IUserProfile | undefined;

    if (!userProfile || !userProfile.id_usuario) {
        res.status(401).json({ error: "Usuário não autenticado." });
        return;
    }

    const idUsuario = userProfile.id_usuario; 
    const { nome, celular, notificacoes, janela_inicio, janela_fim } = req.body || {};

    try {
        const dadosAtualizacao: IUpdateMeuPerfilDTO = {
            nome: nome ? String(nome).trim() : undefined,
            celular: celular ? String(celular).trim() : undefined,
            notificacoes: notificacoes || {},
            janela_inicio: janela_inicio || null,
            janela_fim: janela_fim || null
        };

        await UsuariosService.updateMeuPerfil(idUsuario, dadosAtualizacao);
        res.json({ message: "Perfil atualizado com sucesso." });

    } catch (error) {
        logger.error({ err: error, idUsuario }, "Erro updateMeuPerfil");
        res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
};

export const deleteUsuario: RequestHandler<{ id: string }> = async (req, res) => {
    const idUsuarioParaDeletar = asInteger(req.params.id);

    if (!idUsuarioParaDeletar) {
        res.status(400).json({ error: "ID de usuário inválido." });
        return;
    }

    const userProfile = req.user as IUserProfile | undefined;
    const idUsuarioLogado = userProfile?.id_usuario;

    if (idUsuarioLogado && idUsuarioParaDeletar === idUsuarioLogado) {
        res.status(400).json({ error: "Não é possível excluir seu próprio usuário." });
        return;
    }

    try {
        await UsuariosService.deleteUsuario(idUsuarioParaDeletar);
        res.status(200).json({ message: "Usuário excluído com sucesso." });

    } catch (err: any) {
        if (err && err.message === "Usuário não encontrado.") {
            res.status(404).json({ error: "Usuário não encontrado." });
            return;
        }
        if (err && err.message && err.message.includes("registros vinculados")) {
            res.status(409).json({ error: err.message });
            return;
        }
        logger.error({ err, idUsuarioParaDeletar }, `Erro ao excluir usuário ${idUsuarioParaDeletar}`);
        res.status(500).json({ error: "Erro interno ao excluir usuário" });
    }
};
