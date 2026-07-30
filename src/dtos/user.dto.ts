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
