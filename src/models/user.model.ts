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
