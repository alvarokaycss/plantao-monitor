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
