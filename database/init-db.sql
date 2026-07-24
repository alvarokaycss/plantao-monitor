CREATE SCHEMA IF NOT EXISTS qq_monitor;
SET search_path TO qq_monitor;
-------------------
-- Plantão Monitor
-------------------

----------------------
-- Tabelas de Auxílio
----------------------

-- Tabela: perfil
-- (RF02) Tabela para armazenar os perfis de usuário (admin, operator, viewer)
CREATE TABLE perfil (
    id_perfil SERIAL NOT NULL,
    nome VARCHAR(30) NOT NULL,
    
    CONSTRAINT pk_perfis PRIMARY KEY (id_perfil),
    CONSTRAINT uk_perfis_nome UNIQUE (nome)
);

-- Tabela: roles
-- (RF02, RF05, RF12) Tabela para armazenar as 'roles' (etiquetas) que mapeiam regras a grupos de usuários
CREATE TABLE roles (
    id_role SERIAL NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    
    CONSTRAINT pk_roles PRIMARY KEY (id_role),
    CONSTRAINT uk_roles_nome UNIQUE (nome)
);

-- Tabela: tipos_canal_notificacao (Tipos de Notificação, Push/Notificação/Whatsapp)
-- (RF12, RF13) Armazena os canais de notificação disponíveis (Push, WhatsApp, Slack, Email)
CREATE TABLE tipos_canal_notificacao (
    id_tipo_canal SERIAL NOT NULL,
    nome VARCHAR(30) NOT NULL,
    
    CONSTRAINT pk_tipos_canal_notificacao PRIMARY KEY (id_tipo_canal),
    CONSTRAINT uk_tipos_canal_notificacao_nome UNIQUE (nome)
);

-- Tabela: banco_dados
-- (RF05, RF06) Armazena os bancos de dados onde as regras serão executadas (Postgres/Oracle)
CREATE TABLE banco_dados (
    id_banco_dados SERIAL NOT NULL,
    tipo_banco VARCHAR(20) NOT NULL, -- Ex: 'POSTGRES', 'ORACLE'

    CONSTRAINT pk_bancos_dados PRIMARY KEY (id_banco_dados),
    CONSTRAINT ck_bancos_dados_tipo 
        CHECK (tipo_banco IN ('POSTGRES', 'ORACLE'))
);

-- Tabela: recursos (permissões dos usuários as respectivas telas)
-- (RF02) Armazena os recursos (telas/funcionalidades) para controle de autorização
CREATE TABLE recursos (
    id_recurso SERIAL NOT NULL,
    chave_recurso VARCHAR(50) NOT NULL, -- Ex: 'TELA_REGRAS', 'TELA_ESCALAS'
    nome_amigavel VARCHAR(100) NOT NULL, -- Ex: 'Acesso à tela de Regras'
    
    CONSTRAINT pk_recursos PRIMARY KEY (id_recurso),
    CONSTRAINT uk_recursos_chave UNIQUE (chave_recurso)
);

---------------------------
-- 2. Entidades Principais
---------------------------

-- Tabela: usuario
-- (RF01, RF02, RF03, RF04) Tabela principal de usuários, armazena dados de autenticação e preferências
CREATE TABLE usuario (
    id_usuario SERIAL NOT NULL,
    uid_firebase VARCHAR(128) NOT NULL, -- (RF01)
    id_perfil INT NOT NULL DEFAULT 3, -- (RF02 - FK para perfil - Define AÇÕES)
    email VARCHAR(255) NOT NULL, -- (RF01, RF03)
    nome VARCHAR(100) NOT NULL, -- (RF03)
    notificacao_push_som VARCHAR(50) NULL DEFAULT 'default', -- (RF04 - REVERTIDO)
    notificacao_janela_inicio TIME NULL, -- (RF04 - Janela de não perturbe)
    notificacao_janela_fim TIME NULL, -- (RF04 - Janela de não perturbe)
    ativo BOOLEAN NOT NULL DEFAULT FALSE, -- (RF03)
    data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Restrições
    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uk_usuario_uid_firebase UNIQUE (uid_firebase),
    CONSTRAINT uk_usuario_email UNIQUE (email),
    CONSTRAINT fk_usuario_perfil FOREIGN KEY (id_perfil)
        REFERENCES perfil (id_perfil)
);


-- Tabela: configuracoes_notificacao 
-- (RF04, RF12, RF13, RF19) Armazena os 'endereços' de notificação de um usuário (tokens, email, etc)
CREATE TABLE configuracoes_notificacao (
    id_configuracao_notificacao SERIAL NOT NULL,
    id_usuario INT NOT NULL, -- (FK para usuario)
    id_tipo_canal INT NOT NULL, -- (FK para tipos_canal_notificacao) (RF12, RF13)
    
    -- Endereço: Pode ser o token_app, o email, o numero de whatsapp
    endereco_notificacao TEXT NOT NULL, -- (RF13, RF19 - token_app)
    
    habilitado BOOLEAN NOT NULL DEFAULT TRUE, -- (RF04 - enable_push)
    nome_dispositivo VARCHAR(100) NULL, -- Ex: "Notebook Empresa"

    -- Restrições
    CONSTRAINT pk_configuracoes_notificacao PRIMARY KEY (id_configuracao_notificacao),
    
    -- Um mesmo "token" ou "email" não pode pertencer a dois usuários
    CONSTRAINT uk_configuracoes_notificacao_endereco UNIQUE (endereco_notificacao),
    
    CONSTRAINT fk_configuracoes_notificacao_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),
        
    CONSTRAINT fk_configuracoes_notificacao_tipo_canal FOREIGN KEY (id_tipo_canal)
        REFERENCES tipos_canal_notificacao (id_tipo_canal)
);


-- Tabela: usuario_recursos (relação que o usuário tem visualização das telas)
-- (RF02) Tabela de associação para implementar autorização baseada em permissões de recursos/telas
CREATE TABLE usuario_recursos (
    id_usuario INT NOT NULL, -- (FK para usuario)
    id_recurso INT NOT NULL, -- (FK para recursos)
    
    -- Restrições
    CONSTRAINT pk_usuario_recursos PRIMARY KEY (id_usuario, id_recurso),
    CONSTRAINT fk_usuario_recursos_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),
    CONSTRAINT fk_usuario_recursos_recurso FOREIGN KEY (id_recurso)
        REFERENCES recursos (id_recurso)
);


-- Tabela: escala (relação de role com usuário e escala)
-- (RF11) Armazena a gestão de rota (on-call), definindo quem está de plantão para qual 'role' e quando
CREATE TABLE escala (
    id_escala SERIAL NOT NULL,
    id_usuario INT NOT NULL, -- (FK para usuario) (RF11)
    id_role INT NOT NULL, -- (FK para roles) (RF11)
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL, -- (RF11)
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL, -- (RF11)
    
    -- Restrições
    CONSTRAINT pk_escala PRIMARY KEY (id_escala),
    
    CONSTRAINT fk_escala_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),
        
    CONSTRAINT fk_escala_role FOREIGN KEY (id_role)
        REFERENCES roles (id_role), 
        
    CONSTRAINT ck_escala_datas CHECK (data_fim > data_inicio)
);

-- Tabela: regra
-- (RF05, RF06, RF17, RF18) Entidade central, armazena a definição das regras de monitoramento
CREATE TABLE regra (
    id_regra SERIAL NOT NULL,
    id_banco_dados INT NOT NULL, -- (RF05 - FK para banco_dados)
    nome VARCHAR(150) NOT NULL, -- (RF05)
    descricao TEXT NULL, -- (RF05)
    consulta_sql TEXT NOT NULL, -- (RF05, RF17 - Teste de Regra)
    intervalo_minutos INT NOT NULL DEFAULT 5, -- (RF05 - minuto_atualizacao, RF06)
    janela_inicio TIME NOT NULL DEFAULT '00:00:00', -- (RF05 - hora_inicio, RF06)
    janela_fim TIME NOT NULL DEFAULT '23:59:59', -- (RF05 - hora_final, RF06)
    qnt_erro_max SMALLINT NOT NULL DEFAULT 1, -- (RF05)
    prioridade SMALLINT NOT NULL DEFAULT 3, -- (RF05)
    
    -- RF18: Ações Programadas
    data_adiar_inicio TIMESTAMP WITH TIME ZONE NULL, -- (RF18 - Adiar regra)
    data_adiar_fim TIMESTAMP WITH TIME ZONE NULL, -- (RF18 - Adiar regra)
    data_silenciar_inicio TIMESTAMP WITH TIME ZONE NULL, -- (RF18 - Silenciar por período)
    data_silenciar_fim TIMESTAMP WITH TIME ZONE NULL, -- (RF18 - Silenciar por período)
    
    -- Auditoria (RF15)
    data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_criador INT NULL, -- (FK para usuario)
    data_atualizacao TIMESTAMP WITH TIME ZONE NULL,
    id_usuario_atualizacao INT NULL, -- (FK para usuario)

    -- Restrições
    CONSTRAINT pk_regras PRIMARY KEY (id_regra),
    
    CONSTRAINT fk_regras_bancos_dados FOREIGN KEY (id_banco_dados)
        REFERENCES banco_dados (id_banco_dados),
        
    CONSTRAINT fk_regras_usuario_criador FOREIGN KEY (id_usuario_criador)
        REFERENCES usuario (id_usuario),
        
    CONSTRAINT fk_regras_usuario_atualizacao FOREIGN KEY (id_usuario_atualizacao)
        REFERENCES usuario (id_usuario),
        
    CONSTRAINT ck_regras_intervalo CHECK (intervalo_minutos > 0),
    CONSTRAINT ck_regras_prioridade CHECK (prioridade BETWEEN 1 AND 3),
    
    CONSTRAINT ck_regras_janela_adiar 
        CHECK ( (data_adiar_inicio IS NULL AND data_adiar_fim IS NULL) OR 
                (data_adiar_inicio IS NOT NULL AND data_adiar_fim IS NOT NULL AND data_adiar_fim > data_adiar_inicio) ),
                
    CONSTRAINT ck_regras_janela_silenciar
        CHECK ( (data_silenciar_inicio IS NULL AND data_silenciar_fim IS NULL) OR 
                (data_silenciar_inicio IS NOT NULL AND data_silenciar_fim IS NOT NULL AND data_silenciar_fim > data_silenciar_inicio) )
);

-- Tabela: regra_role (identifica as regras com as suas respectivas roles)
-- (RF05, RF12) Tabela de associação entre Regras e Roles, para direcionar notificações
CREATE TABLE regra_role (
    id_regra INT NOT NULL, -- (FK para regra)
    id_role INT NOT NULL, -- (FK para roles)

    -- Restrições
    CONSTRAINT pk_regra_role PRIMARY KEY (id_regra, id_role),

    CONSTRAINT fk_regra_role_regra FOREIGN KEY (id_regra)
        REFERENCES regra (id_regra),

    CONSTRAINT fk_regra_role_role FOREIGN KEY (id_role)
        REFERENCES roles (id_role)
);

------------------------------
-- Tabela Dashboard e de Logs
------------------------------

-- Tabela: incidente
-- (RF07, RF08, RF09, RF10, RF14, RF16) Armazena incidentes gerados pelas regras
CREATE TABLE incidente (
    id_incidente BIGSERIAL NOT NULL,
    id_regra INT NOT NULL, -- (FK para regra) (RF07)
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO', -- (RF08 - Fluxo de Incidente)
    prioridade_registro SMALLINT NOT NULL, -- (RF05 - Herdada da regra)
    data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- (RF08)
    data_ultimo_escalonamento TIMESTAMP WITH TIME ZONE NULL, -- (RF10 - Escalonamento)
    data_ack TIMESTAMP WITH TIME ZONE NULL, -- (RF08, RF09 - Ação ACK)
    id_usuario_ack INT NULL, -- (FK para usuario) (RF08, RF09)
    data_fechamento TIMESTAMP WITH TIME ZONE NULL, -- (RF08, RF09 - Ação Close)
    id_usuario_fechamento INT NULL, -- (FK para usuario) (RF08, RF09)
    comentario_incidente TEXT NULL, -- (RF09 - Comentários ao ACK/CLOSE)
    dados_amostra JSON NULL, -- (RF17 - Amostra de dados)

    -- Restrições
    CONSTRAINT pk_incidentes PRIMARY KEY (id_incidente),
    CONSTRAINT fk_incidentes_regras FOREIGN KEY (id_regra)
        REFERENCES regra (id_regra), 
    CONSTRAINT fk_incidentes_usuario_ack FOREIGN KEY (id_usuario_ack)
        REFERENCES usuario (id_usuario), 
    CONSTRAINT fk_incidentes_usuario_fechamento FOREIGN KEY (id_usuario_fechamento)
        REFERENCES usuario (id_usuario),
        
    CONSTRAINT ck_incidente_status
        CHECK (status IN ('ABERTO', 'RECONHECIDO', 'FECHADO'))
);

-- Tabela: log_execucoes_regras
-- (RF06, RF07, RF15) Log de cada execução do Runner para cada regra
CREATE TABLE log_execucoes_regras (
    id_log_execucao BIGSERIAL NOT NULL,
    id_regra INT NOT NULL, -- (FK para regra) (RF06)
    data_execucao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- (RF15)
    duracao_ms INT NOT NULL, -- (RF15 - run_time)
    status_execucao VARCHAR(10) NOT NULL, -- (RF06 - Captura de erros, RF15 - error)
    resultado_contagem INT NOT NULL DEFAULT 0, -- (RF15 - result)
    mensagem_erro TEXT NULL, -- (RF06, RF15)
    id_incidente_gerado BIGINT NULL, -- (FK para incidente) (RF07)

    -- Restrições
    CONSTRAINT pk_log_execucoes_regras PRIMARY KEY (id_log_execucao),
    CONSTRAINT fk_log_execucoes_regras_regra FOREIGN KEY (id_regra)
        REFERENCES regra (id_regra),
    CONSTRAINT fk_log_execucoes_regras_incidente FOREIGN KEY (id_incidente_gerado)
        REFERENCES incidente (id_incidente),
        
    CONSTRAINT ck_log_execucoes_status
        CHECK (status_execucao IN ('SUCESSO', 'FALHA'))
);

-- Tabela: log_notificacoes
-- (RF10, RF13, RF15) Log de todas as tentativas de notificação enviadas
CREATE TABLE log_notificacoes (
    id_log_notificacao BIGSERIAL NOT NULL,
    id_incidente BIGINT NOT NULL, -- (FK para incidente) (RF13)
    id_usuario_destinatario INT NULL, -- (FK para usuario) (RF10)
    id_tipo_canal INT NOT NULL, -- (FK para tipos_canal_notificacao) (RF13)
    status_envio VARCHAR(10) NOT NULL, -- (RF13, RF15)
    data_envio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- (RF13, RF15)
    destino_envio TEXT NOT NULL, -- (RF13)
    conteudo_enviado TEXT NULL, -- (RF13)
    mensagem_erro TEXT NULL, -- (RF13, RF15)

    -- Restrições
    CONSTRAINT pk_log_notificacoes PRIMARY KEY (id_log_notificacao),
    CONSTRAINT fk_log_notificacoes_incidente FOREIGN KEY (id_incidente)
        REFERENCES incidente (id_incidente),
    CONSTRAINT fk_log_notificacoes_usuario FOREIGN KEY (id_usuario_destinatario)
        REFERENCES usuario (id_usuario),
    CONSTRAINT fk_log_notificacoes_tipo_canal FOREIGN KEY (id_tipo_canal)
        REFERENCES tipos_canal_notificacao (id_tipo_canal),
        
    CONSTRAINT ck_log_notificacoes_status
        CHECK (status_envio IN ('ENVIADO', 'FALHA'))
);

-- Tabela: log_auditoria_alteracoes
-- (RF15) Log genérico de auditoria para mudanças em tabelas críticas (regras, rotas)
CREATE TABLE log_auditoria_alteracoes (
    id_log_auditoria BIGSERIAL NOT NULL,
    id_usuario INT NULL, -- (FK para usuario) (RF15)
    data_alteracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- (RF15)
    acao VARCHAR(10) NOT NULL, -- (RF15)
    tabela_afetada VARCHAR(100) NOT NULL, -- (RF15)
    id_registro_afetado BIGINT NOT NULL, -- (RF15)
    dados_antigos JSON NULL, -- (RF15)
    dados_novos JSON NULL, -- (RF15)

    -- Restrições
    CONSTRAINT pk_log_auditoria_alteracoes PRIMARY KEY (id_log_auditoria),
    CONSTRAINT fk_log_auditoria_alteracoes_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),

    CONSTRAINT ck_log_auditoria_acao
        CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE'))
);

----------------------------------------------------------------------------------------
-- Criação da Fila do Runner e Ajustes de Log

-- Tabela de Fila 
CREATE TABLE fila_runner (
    id_fila BIGSERIAL PRIMARY KEY,
    id_regra INT NOT NULL,
    
    -- Status do processamento: 
    -- PENDENTE (Agendado) 
    -- CONCLUIDO (Sucesso)
    -- FALHA (Esgotou tentativas)
    status VARCHAR(20) DEFAULT 'PENDENTE' NOT NULL,
    
    -- Controle de tentativas (Campo Adicionado)
    tentativas INT DEFAULT 0,
    
    data_agendamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_inicio_processamento TIMESTAMP WITH TIME ZONE,
    data_fim_processamento TIMESTAMP WITH TIME ZONE,
    
    mensagem_erro TEXT, -- Caso o runner falhe (ex: banco fora do ar)
    
    CONSTRAINT fk_fila_regra 
        FOREIGN KEY (id_regra) REFERENCES regra (id_regra)
);

--------------------------------------------------------
-- MIGRATION 003: Tabela de Escalonamento
--------------------------------------------------------

-- 1. Nova Tabela de Configuração 
CREATE TABLE regra_escalonamento (
    id_escalonamento SERIAL PRIMARY KEY,
    id_regra INT NOT NULL, 
    minutos_apos_abertura INT NOT NULL, 
    id_role_destino INT NOT NULL, 
    id_tipo_canal INT NOT NULL,
    
    CONSTRAINT fk_escalonamento_regra FOREIGN KEY (id_regra) 
        REFERENCES regra (id_regra) ON DELETE CASCADE,
    CONSTRAINT fk_escalonamento_role FOREIGN KEY (id_role_destino) 
        REFERENCES roles (id_role),
    CONSTRAINT fk_escalonamento_canal FOREIGN KEY (id_tipo_canal) 
        REFERENCES tipos_canal_notificacao (id_tipo_canal)
);


ALTER TABLE incidente
ADD COLUMN nivel_escalonamento INT NOT NULL DEFAULT 0;

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
UPDATE usuario 
SET 
    ativo = TRUE, 
    id_perfil = 1  -- 1 = Admin
WHERE email = 'seuemailaqui@gmail.com';

INSERT INTO usuario_recursos (id_usuario, id_recurso)
SELECT 
    (SELECT id_usuario FROM usuario WHERE email = 'seuemailaqui@gmail.com'), -- Busca ID do seu usuário
    id_recurso
FROM recursos
ON CONFLICT (id_usuario, id_recurso) DO NOTHING; -- Evita erro se já tiver algum