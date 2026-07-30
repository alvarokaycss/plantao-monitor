-- database/seed/002_seeds_admin_user.sql
-- Seed de Administrador Profissional e Permissões Completas (RF01, RF02, RF03)

-- 1. Inserção do Usuário Admin Principal
INSERT INTO usuario (uid_firebase, id_perfil, email, nome, ativo) VALUES
('seed_admin_uid', 1, 'admin@gmail.com', 'Administrador Principal', TRUE)
ON CONFLICT (email) DO UPDATE SET ativo = TRUE, id_perfil = 1;

-- 2. Inserção do Canal de Notificação Padrão (Email)
INSERT INTO configuracoes_notificacao (id_usuario, id_tipo_canal, endereco_notificacao, habilitado, nome_dispositivo)
SELECT id_usuario, 2, 'admin@gmail.com', TRUE, 'Web Admin Config'
FROM usuario WHERE email = 'admin@gmail.com'
ON CONFLICT (endereco_notificacao) DO NOTHING;

-- 3. Concessão de Todos os Recursos e Permissões de Telas ao Admin
INSERT INTO usuario_recursos (id_usuario, id_recurso)
SELECT (SELECT id_usuario FROM usuario WHERE email = 'admin@gmail.com'), id_recurso
FROM recursos
ON CONFLICT (id_usuario, id_recurso) DO NOTHING;