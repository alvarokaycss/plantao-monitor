// src/services/UsuariosService.ts

import { PoolClient } from 'pg';
import { pool, SCHEMA } from '../db/db';
import { asInteger } from '../utils/helpers';
import { 
    IUsuarioRow, 
    IConfiguracaoNotificacaoRow, 
    IRecursoRow, 
    IUsuarioDetalhesResult, 
    IUpdateUsuarioConfigPayload 
} from '../models/user.model';
import { IUsuariosFiltrosDTO, IUpdateMeuPerfilDTO } from '../dtos/user.dto';

export const selectUsuariosFiltrados = async (filtros: IUsuariosFiltrosDTO = {}): Promise<IUsuarioRow[]> => {
    const { id_perfil, pesquisa, ativo } = filtros;
    const client: PoolClient = await pool.connect();

    try {
        const condicoes: string[] = [];
        const valores: any[] = [];
        let queryIndex = 1;

        if (ativo !== undefined) {
            condicoes.push(`u.ativo = $${queryIndex}`);
            valores.push(ativo);
            queryIndex++;
        }

        const idPerfilVal = asInteger(id_perfil);
        if (idPerfilVal) {
            condicoes.push(`u.id_perfil = $${queryIndex}`);
            valores.push(idPerfilVal);
            queryIndex++;
        }

        if (pesquisa && typeof pesquisa === 'string' && pesquisa.trim().length > 0) {
            condicoes.push(`(u.nome ILIKE $${queryIndex} OR u.email ILIKE $${queryIndex})`);
            valores.push(`%${pesquisa.trim()}%`);
            queryIndex++;
        }

        let q = `
            SELECT u.id_usuario, u.nome, u.email, u.id_perfil, u.ativo, u.data_criacao, p.nome as nome_perfil
            FROM ${SCHEMA}.usuario u
            LEFT JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
        `;

        if (condicoes.length > 0) {
            q += ` WHERE ${condicoes.join(' AND ')}`;
        }

        q += ` ORDER BY u.nome ASC;`;

        const { rows } = await client.query<IUsuarioRow>(q, valores);
        return rows;

    } finally {
        if (client) client.release();
    }
};

export const getUsuarioDetalhes = async (idUsuarioVal: number): Promise<IUsuarioDetalhesResult | null> => {
    const client: PoolClient = await pool.connect();
    try {
        const userQuery = `
            SELECT 
                u.id_usuario, u.email, u.nome, 
                u.notificacao_push_som, u.notificacao_janela_inicio, u.notificacao_janela_fim, 
                u.ativo, u.id_perfil, p.nome as nome_perfil
            FROM ${SCHEMA}.usuario u
            JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
            WHERE u.id_usuario = $1;
        `;
        const userRes = await client.query<IUsuarioRow>(userQuery, [idUsuarioVal]);

        if (userRes.rows.length === 0) {
            return null;
        }
        const usuario = userRes.rows[0];

        const configQuery = `
            SELECT 
                c.id_configuracao_notificacao, 
                c.id_tipo_canal, 
                c.endereco_notificacao, 
                c.habilitado, 
                c.nome_dispositivo, 
                t.nome AS nome_canal
            FROM ${SCHEMA}.configuracoes_notificacao c
            JOIN ${SCHEMA}.tipos_canal_notificacao t ON c.id_tipo_canal = t.id_tipo_canal
            WHERE c.id_usuario = $1
            ORDER BY t.nome;
        `;
        const configRes = await client.query<IConfiguracaoNotificacaoRow>(configQuery, [idUsuarioVal]);

        const recursosQuery = `
            SELECT 
                ur.id_recurso,
                r.chave_recurso,
                r.nome_amigavel
            FROM ${SCHEMA}.usuario_recursos ur
            JOIN ${SCHEMA}.recursos r ON ur.id_recurso = r.id_recurso
            WHERE ur.id_usuario = $1;
        `;
        const recursosRes = await client.query<IRecursoRow>(recursosQuery, [idUsuarioVal]);

        return {
            info: usuario,
            configuracoes: configRes.rows,
            recursos: recursosRes.rows
        };

    } finally {
        if (client) client.release();
    }
};

export const updateUsuarioConfiguracao = async (
    idUsuarioParaConfigurar: number, 
    payload: IUpdateUsuarioConfigPayload
): Promise<number> => {
    const { idPerfilVal, statusAtivo, recursosVal, notificacoesVal } = payload;

    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateUsuarioQuery = `
            UPDATE ${SCHEMA}.usuario 
            SET 
                id_perfil = $1,
                ativo = $2
            WHERE id_usuario = $3
            RETURNING id_usuario;
        `;
        const userResult = await client.query<{ id_usuario: number }>(updateUsuarioQuery, [idPerfilVal, statusAtivo, idUsuarioParaConfigurar]);

        if (userResult.rowCount === 0) {
            throw new Error("Usuário não encontrado para configurar.");
        }

        await client.query(`DELETE FROM ${SCHEMA}.usuario_recursos WHERE id_usuario = $1`, [idUsuarioParaConfigurar]);

        if (recursosVal.length > 0) {
            const insertRecursosQuery = 'INSERT INTO ' + `${SCHEMA}.usuario_recursos` + ' (id_usuario, id_recurso) VALUES ' +
                recursosVal.map((_, index) => `($1, $${index + 2})`).join(', ');
            await client.query(insertRecursosQuery, [idUsuarioParaConfigurar, ...recursosVal]);
        }

        await client.query(`DELETE FROM ${SCHEMA}.configuracoes_notificacao WHERE id_usuario = $1`, [idUsuarioParaConfigurar]);

        if (notificacoesVal.length > 0) {
            const insertNotificacoesQuery = 'INSERT INTO ' + `${SCHEMA}.configuracoes_notificacao` +
                ' (id_usuario, id_tipo_canal, endereco_notificacao, habilitado, nome_dispositivo) VALUES ' +
                notificacoesVal.map((_, i) =>
                    `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`
                ).join(', ');

            const notificacoesValues = notificacoesVal.flatMap(n =>
                [
                    asInteger(n.id_tipo_canal),
                    n.endereco_notificacao,
                    n.habilitado !== false,
                    n.nome_dispositivo || null
                ]
            );

            await client.query(insertNotificacoesQuery, [idUsuarioParaConfigurar, ...notificacoesValues]);
        }

        await client.query('COMMIT');

        return idUsuarioParaConfigurar;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        if (client) client.release();
    }
};

export const deleteUsuario = async (idUsuarioVal: number): Promise<number> => {
    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`DELETE FROM ${SCHEMA}.usuario_recursos WHERE id_usuario = $1`, [idUsuarioVal]);

        await client.query(`DELETE FROM ${SCHEMA}.configuracoes_notificacao WHERE id_usuario = $1`, [idUsuarioVal]);

        await client.query(`DELETE FROM ${SCHEMA}.escala WHERE id_usuario = $1`, [idUsuarioVal]);

        const query = `DELETE FROM ${SCHEMA}.usuario WHERE id_usuario = $1 RETURNING id_usuario`;
        const { rowCount } = await client.query(query, [idUsuarioVal]);

        if (rowCount === 0) {
            throw new Error('Usuário não encontrado.');
        }

        await client.query('COMMIT');
        return idUsuarioVal;

    } catch (error: any) {
        await client.query('ROLLBACK');

        if (error && error.code === '23503') {
            throw new Error('Não é possível excluir o usuário: ele possui registros vinculados em incidentes ou regras.');
        }

        throw error;
    } finally {
        if (client) client.release();
    }
};

export const getAllUsuarios = async (filtros: IUsuariosFiltrosDTO = {}): Promise<IUsuarioRow[]> => {
    const client: PoolClient = await pool.connect();
    try {
        let query = `
            SELECT id_usuario, nome, email, id_perfil, ativo, data_criacao
            FROM ${SCHEMA}.usuario
        `;
        
        const conditions: string[] = [];
        const values: any[] = [];

        if (filtros.ativo !== undefined) {
            values.push(filtros.ativo);
            conditions.push(`ativo = $${values.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY nome ASC;';

        const { rows } = await client.query<IUsuarioRow>(query, values);
        return rows;

    } finally {
        client.release();
    }
};

export const updateMeuPerfil = async (idUsuario: number, dados: IUpdateMeuPerfilDTO): Promise<void> => {
    const client: PoolClient = await pool.connect();
    try {
        await client.query('BEGIN');

        let updateQuery = `UPDATE ${SCHEMA}.usuario SET `;
        const updateValues: any[] = [];
        let idx = 1;

        if (dados.nome !== undefined) {
            updateQuery += `nome = $${idx}, `;
            updateValues.push(dados.nome);
            idx++;
        }
        
        updateQuery += `notificacao_janela_inicio = $${idx}, notificacao_janela_fim = $${idx + 1} `;
        updateValues.push(dados.janela_inicio || null, dados.janela_fim || null);
        idx += 2;

        updateQuery += `WHERE id_usuario = $${idx}`;
        updateValues.push(idUsuario);

        await client.query(updateQuery, updateValues);

        if (dados.celular) {
            const check = await client.query<{ id_configuracao_notificacao: number }>(
                `SELECT id_configuracao_notificacao FROM ${SCHEMA}.configuracoes_notificacao WHERE id_usuario = $1 AND id_tipo_canal = 3`,
                [idUsuario]
            );
            
            if (check.rows.length > 0) {
                await client.query(
                    `UPDATE ${SCHEMA}.configuracoes_notificacao SET endereco_notificacao = $1 WHERE id_configuracao_notificacao = $2`,
                    [dados.celular, check.rows[0].id_configuracao_notificacao]
                );
            } else {
                await client.query(
                    `INSERT INTO ${SCHEMA}.configuracoes_notificacao (id_usuario, id_tipo_canal, endereco_notificacao, habilitado, nome_dispositivo) VALUES ($1, 3, $2, TRUE, 'Celular Pessoal')`,
                    [idUsuario, dados.celular]
                );
            }
        }

        const mapCanais: Record<string, number> = { push: 1, email: 2, whatsapp: 3 };
        if (dados.notificacoes && typeof dados.notificacoes === 'object') {
            for (const [key, enabled] of Object.entries(dados.notificacoes)) {
                const idTipo = mapCanais[key];
                if (idTipo) {
                    await client.query(
                        `UPDATE ${SCHEMA}.configuracoes_notificacao SET habilitado = $1 WHERE id_usuario = $2 AND id_tipo_canal = $3`,
                        [Boolean(enabled), idUsuario, idTipo]
                    );
                }
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
