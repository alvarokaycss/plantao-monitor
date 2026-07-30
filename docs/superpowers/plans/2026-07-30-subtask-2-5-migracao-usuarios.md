# Sub-tarefa 2.5: Migração do Módulo de Usuários e Refatoração Arquitetural (`src/dtos/`, `src/models/`, `src/services/`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar a estrutura de arquitetura em camadas (`src/dtos/`, `src/models/` para interfaces de banco, `src/services/` para execução SQL e `src/types/` para tipos ambientes/globais) e realizar a migração estrita para TypeScript do módulo de usuários (`UsuariosService.ts` e `UsuariosController.ts`), validando zero regressões via `testing-advisor` e Jest.

**Architecture:** 
1. `src/dtos/user.dto.ts` guarda os Data Transfer Objects de requisição/resposta HTTP (`IRegisterUserDTO`, `IUpdateUsuarioConfigDTO`, `INotificacaoItemDTO`, `IUpdateMeuPerfilDTO`, `IUsuariosFiltrosDTO`).
2. `src/models/user.model.ts` guarda as interfaces puras das entidades e tabelas do banco de dados (`IUsuarioRow`, `IConfiguracaoNotificacaoRow`, `IRecursoRow`, `IUsuarioDetalhesResult`, `IUserProfile`).
3. `src/types/` guarda declarações de tipo ambientes do TypeScript (`express.d.ts` e `helpers.d.ts`).
4. `src/services/UsuariosService.ts` implementa as consultas e transações no PostgreSQL (`pool.query<T>` / `client.query<T>`).
5. `src/controllers/UsuariosController.ts` implementa os handlers HTTP com `RequestHandler` e `logger.error`.

**Tech Stack:** TypeScript (v5.8), Node.js (ES2022 / Node16 module resolution), Express (`RequestHandler`), `pg` (`PoolClient`), Pino Logger, Jest (`ts-jest`).

## Global Constraints

- Respeitar estritamente a nova organização de diretórios: DTOs em `src/dtos/`, Schemas/Entidades de Banco em `src/models/`, Serviços de execução em `src/services/` e Declarações Ambientes em `src/types/`.
- Não reescrever o arquivo `src/utils/helpers.js`.
- Manter o comportamento das transações SQL em blocos `try/catch/finally` garantindo `client.release()` nos blocos `finally`.
- Substituir todas as ocorrências de `console.error` por `logger.error({ err: error }, "Mensagem descritiva")`.

---

### Task 1: Criar a camada de DTOs HTTP (`src/dtos/user.dto.ts`)

**Files:**
- Create: `src/dtos/user.dto.ts`
- Remove: `src/types/user.ts` (substituído por DTOs e Models dedicados)
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: N/A.
- Produces: `IRegisterUserDTO`, `INotificacaoItemDTO`, `IUpdateUsuarioConfigDTO`, `IUpdateMeuPerfilDTO`, `IUsuariosFiltrosDTO`.

- [ ] **Step 1: Criar o arquivo `src/dtos/user.dto.ts`**

```typescript
// src/dtos/user.dto.ts

/**
 * DTO para o corpo da requisição de registro (POST /auth/register)
 */
export interface IRegisterUserDTO {
    idToken: string;
}

/**
 * Estrutura de cada item de notificação configurado para um usuário
 */
export interface INotificacaoItemDTO {
    id_tipo_canal: number;
    endereco_notificacao: string;
    habilitado?: boolean;
    nome_dispositivo?: string;
}

/**
 * DTO para atualização das configurações do usuário pelo Admin (PUT /usuarios/:id/configuracao)
 */
export interface IUpdateUsuarioConfigDTO {
    id_perfil: number;
    ativo?: boolean;
    recursos?: number[];
    notificacoes?: INotificacaoItemDTO[];
}

/**
 * DTO para atualização do perfil do próprio usuário logado (PUT /usuarios/eu/perfil)
 */
export interface IUpdateMeuPerfilDTO {
    nome?: string;
    celular?: string;
    notificacoes?: Record<string, boolean>;
    janela_inicio?: string | null;
    janela_fim?: string | null;
}

/**
 * DTO para filtros de busca de usuários (GET /usuarios)
 */
export interface IUsuariosFiltrosDTO {
    id_perfil?: number | string;
    pesquisa?: string;
    ativo?: boolean;
}
```

- [ ] **Step 2: Remover o arquivo genérico `src/types/user.ts`**

Run: `Remove-Item -Path "src/types/user.ts" -Force -ErrorAction SilentlyContinue`

---

### Task 2: Criar os Schemas de Entidade do Banco em `src/models/user.model.ts`

**Files:**
- Create: `src/models/user.model.ts`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `INotificacaoItemDTO` de `src/dtos/user.dto.ts`.
- Produces: `IUserProfile`, `IUsuarioRow`, `IConfiguracaoNotificacaoRow`, `IRecursoRow`, `IUsuarioDetalhesResult`, `IUpdateUsuarioConfigPayload`.

- [ ] **Step 1: Criar o arquivo `src/models/user.model.ts`**

```typescript
// src/models/user.model.ts

import { INotificacaoItemDTO } from '../dtos/user.dto';

/**
 * Perfil do usuário carregado no middleware de autenticação (checkAuth)
 */
export interface IUserProfile {
    id_usuario: number;
    nome: string;
    email: string;
    ativo: boolean;
    perfil_nome: 'admin' | 'operator' | 'viewer';
    recursos: string[];
}

/**
 * Linha da tabela `usuario` no PostgreSQL
 */
export interface IUsuarioRow {
    id_usuario: number;
    uid_firebase?: string;
    nome: string;
    email: string;
    id_perfil: number;
    ativo: boolean;
    data_criacao?: Date;
    notificacao_push_som?: boolean;
    notificacao_janela_inicio?: string | null;
    notificacao_janela_fim?: string | null;
    nome_perfil?: string;
}

/**
 * Linha da tabela `configuracoes_notificacao` com join de `tipos_canal_notificacao`
 */
export interface IConfiguracaoNotificacaoRow {
    id_configuracao_notificacao: number;
    id_tipo_canal: number;
    endereco_notificacao: string;
    habilitado: boolean;
    nome_dispositivo: string | null;
    nome_canal: string;
}

/**
 * Linha da tabela `usuario_recursos` com join de `recursos`
 */
export interface IRecursoRow {
    id_recurso: number;
    chave_recurso: string;
    nome_amigavel: string;
}

/**
 * Resultado completo dos detalhes de um usuário
 */
export interface IUsuarioDetalhesResult {
    info: IUsuarioRow;
    configuracoes: IConfiguracaoNotificacaoRow[];
    recursos: IRecursoRow[];
}

/**
 * Payload interno para transação de atualização de configuração
 */
export interface IUpdateUsuarioConfigPayload {
    idPerfilVal: number;
    statusAtivo: boolean;
    recursosVal: number[];
    notificacoesVal: INotificacaoItemDTO[];
}
```

---

### Task 3: Atualizar Declarações de Tipos Ambientes (`src/types/express.d.ts` e `src/types/helpers.d.ts`) e `authMiddleware.ts`

**Files:**
- Modify: `src/types/express.d.ts`
- Create: `src/types/helpers.d.ts`
- Modify: `src/middleware/authMiddleware.ts`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `IUserProfile` de `src/models/user.model.ts`.
- Produces: Ambient Types para `Express.Request` e `helpers.js`.

- [ ] **Step 1: Atualizar `src/types/express.d.ts`**

```typescript
// src/types/express.d.ts

import { IUserProfile } from '../models/user.model';

declare global {
    namespace Express {
        interface Request {
            user?: IUserProfile;
            io?: any;
        }
    }
}
```

- [ ] **Step 2: Criar `src/types/helpers.d.ts`**

```typescript
// src/types/helpers.d.ts

declare module '*/utils/helpers' {
    export function asInteger(value: any): number | null;
    export function normalizeDateToISO(val: any): string | null;
    export function formatDateToBR(val: any): string | null;
    export function selectAll(tableName: string, whereClause?: string, params?: any[]): Promise<any[]>;
    export function getLogAuditoria(): Promise<any[]>;
    export function getLogNotificacoes(): Promise<any[]>;
    export function getLogExecucoes(): Promise<any[]>;
    export function getFilaRunner(): Promise<any[]>;
}
```

- [ ] **Step 3: Atualizar import do `IUserProfile` em `src/middleware/authMiddleware.ts`**

Substituir import de `'../types/user'` por `'../models/user.model'`.

---

### Task 4: Migrar pasta `src/models/` para `src/services/` e implementar `UsuariosService.ts`

**Files:**
- Move Folder: `src/models/*.js` -> `src/services/*.js`
- Create: `src/services/UsuariosService.ts`
- Remove: `src/services/UsuariosService.js`
- Modify: Imports em controllers existentes (`src/controllers/*.js`) para apontar para `../services/*`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `src/models/user.model.ts`, `src/dtos/user.dto.ts`, `src/db/db.ts`, `src/utils/helpers.js`.
- Produces: Módulo de serviço `UsuariosService.ts` com funções tipadas `selectUsuariosFiltrados`, `getUsuarioDetalhes`, `updateUsuarioConfiguracao`, `deleteUsuario`, `getAllUsuarios`, `updateMeuPerfil`.

- [ ] **Step 1: Renomear/Mover a pasta `src/models` para `src/services` e ajustar imports de controllers JS existentes**

Mover os serviços existentes para `src/services/` e atualizar require imports nos controllers legados (`IncidentesController.js`, `RegrasController.js`, etc.) para apontar para `../services/*`.

- [ ] **Step 2: Criar a implementação tipada em `src/services/UsuariosService.ts`**

```typescript
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
    const { id_perfil, pesquisa } = filtros;
    const client: PoolClient = await pool.connect();

    try {
        const condicoes: string[] = [];
        const valores: any[] = [];
        let queryIndex = 1;

        const idPerfilVal = asInteger(id_perfil);
        if (idPerfilVal) {
            condicoes.push(`id_perfil = $${queryIndex}`);
            valores.push(idPerfilVal);
            queryIndex++;
        }

        if (pesquisa && typeof pesquisa === 'string' && pesquisa.trim().length > 0) {
            condicoes.push(`(nome ILIKE $${queryIndex} OR email ILIKE $${queryIndex})`);
            valores.push(`%${pesquisa.trim()}%`);
            queryIndex++;
        }

        let q = `SELECT * FROM ${SCHEMA}.usuario`;
        if (condicoes.length > 0) {
            q += ` WHERE ${condicoes.join(' AND ')}`;
        }

        q += ` ORDER BY nome ASC;`;

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
```

- [ ] **Step 3: Remover o serviço legado `src/services/UsuariosService.js`**

Run: `Remove-Item -Path "src/services/UsuariosService.js" -Force`

---

### Task 5: Criar e Migrar `src/controllers/UsuariosController.ts` e Atualizar Rotas

**Files:**
- Create: `src/controllers/UsuariosController.ts`
- Remove: `src/controllers/UsuariosController.js`
- Modify: `src/routes/usuariosRoutes.js`

**Interfaces:**
- Consumes: `src/services/UsuariosService`, `src/dtos/user.dto.ts`, `src/models/user.model.ts`, `logger`.
- Produces: Handlers Express tipados `registerUser`, `getUsuarios`, `getMeuDetalhe`, `getUsuarioDetalhes`, `updateUsuarioConfiguracao`, `updateMeuPerfil`, `deleteUsuario`.

- [ ] **Step 1: Criar a implementação do controller em `src/controllers/UsuariosController.ts`**

```typescript
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
            ON CONFLICT (uid_firebase) DO UPDATE SET email = EXCLUDED.email
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
        const { ativo } = req.query;
        const filtros: IUsuariosFiltrosDTO = {};
        
        if (ativo !== undefined) {
            filtros.ativo = (ativo === 'true');
        }

        const usuarios = await UsuariosService.getAllUsuarios(filtros);
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
```

- [ ] **Step 2: Remover o controller em JS `src/controllers/UsuariosController.js`**

Run: `Remove-Item -Path "src/controllers/UsuariosController.js" -Force`

- [ ] **Step 3: Atualizar os imports em `src/routes/usuariosRoutes.js`**

```javascript
// src/routes/usuariosRoutes.js
const express = require('express');
const router = express.Router();
const UsuariosController = require('../controllers/UsuariosController');
const { checkAuth, checkPermission, R_USUARIOS, P_ADMIN, P_TODOS, R_NENHUM } = require('../middleware/authMiddleware');

router.post("/register", UsuariosController.registerUser);
router.use(checkAuth); 

router.get("/", checkPermission(R_USUARIOS, P_ADMIN), UsuariosController.getUsuarios);
router.get("/eu/detalhes", checkPermission(R_NENHUM, P_TODOS), UsuariosController.getMeuDetalhe);
router.get("/:id/detalhes", checkPermission(R_USUARIOS, P_ADMIN), UsuariosController.getUsuarioDetalhes);
router.put("/:id/configuracao", checkPermission(R_USUARIOS, P_ADMIN), UsuariosController.updateUsuarioConfiguracao);
router.put("/eu/perfil", checkPermission(R_NENHUM, P_TODOS), UsuariosController.updateMeuPerfil);
router.delete("/:id", checkPermission(R_USUARIOS, P_ADMIN), UsuariosController.deleteUsuario);

module.exports = router;
```

---

### Task 6: Validação do Compilador e Testes de Regressão via Jest com `testing-advisor`

**Files:**
- Test: `npx tsc --noEmit`
- Test: `npm test`

- [ ] **Step 1: Checagem estrita de tipos no compilador**

Run: `npx tsc --noEmit`
Expected: Output limpo sem nenhum erro TypeScript.

- [ ] **Step 2: Execução dos testes de integração**

Run: `npm test`
Expected: PASS em 100% dos testes da suíte (`tests/api.test.js`).
