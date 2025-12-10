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
