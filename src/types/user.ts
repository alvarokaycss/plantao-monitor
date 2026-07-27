// src/types/user.ts

/**
 * Interface que representa o perfil completo do usuário carregado no middleware de autenticação (checkAuth)
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
 * DTO para o corpo da requisição de registro (POST /auth/register)
 */
export interface IRegisterUserDTO {
    idToken: string;
}

/**
 * DTO para atualização das configurações do usuário pelo Admin (PUT /usuarios/:id/configuracao)
 */
export interface IUpdateUsuarioConfigDTO {
    id_perfil: number;
    ativo?: boolean;
    recursos?: number[];
    notificacoes?: Array<{
        id_tipo_canal: number;
        endereco_notificacao: string;
    }>;
}
