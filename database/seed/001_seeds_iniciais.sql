/*
 MIGRATION 003: SEEDS ESTRUTURAIS 
*/

-- 1. Perfis de Acesso (RF02)
INSERT INTO perfil (id_perfil, nome) VALUES 
(1, 'admin'), 
(2, 'operator'), 
(3, 'viewer')
ON CONFLICT (id_perfil) DO NOTHING;

-- 2. Tipos de Canal de Notificação (RF13)
INSERT INTO tipos_canal_notificacao (id_tipo_canal, nome) VALUES 
(1, 'PUSH'), 
(2, 'EMAIL'), 
(3, 'WHATSAPP')
ON CONFLICT (id_tipo_canal) DO NOTHING;

-- 3. Bancos de Dados Suportados (RF05)
INSERT INTO banco_dados (id_banco_dados, tipo_banco) VALUES 
(1, 'POSTGRES'), 
(2, 'ORACLE')
ON CONFLICT (id_banco_dados) DO NOTHING;

-- 4. Roles / Grupos de Atuação (RF12) - PADRÃO DO MOCK
INSERT INTO roles (nome, descricao) VALUES 
('CANAL_PRINCIPAL', 'Canal de Vendas e PIX'),
('CANAL_SECUNDARIO', 'Canal de Jobs e Infra')
ON CONFLICT (nome) DO NOTHING;

-- 5. Recursos / Permissões de Tela (RF02)
INSERT INTO recursos (chave_recurso, nome_amigavel) VALUES
('TELA_REGRAS', 'Acesso à tela de Regras'),
('TELA_ESCALAS', 'Acesso à tela de Escalas'),
('TELA_USUARIOS', 'Acesso à tela de Usuários'),
('TELA_CONFIGS', 'Acesso às Configurações')
ON CONFLICT (chave_recurso) DO NOTHING;

-- FIM DO SCRIPT