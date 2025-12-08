// src/controllers/RegrasController.js

const RegrasService = require("../models/RegrasService");
const { asInteger } = require("../utils/helpers");

/**
 * GET /regras
 * Lista regras filtradas.
 */
exports.getRegras = async (req, res) => {
    try {
        const { prioridade, nome } = req.query;
        const data = await RegrasService.selectRegrasFiltradas({ prioridade, nome });
        res.json(data);
    } catch (error) {
        console.error("ERROR getRegras:", error);
        res.status(500).json({ error: "Erro ao buscar regras" });
    }
};

/**
 * GET /regras/:id/detalhes
 * Busca detalhes de uma regra específica.
 */
exports.getRegraDetalhes = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);
    
    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra deve ser um número inteiro positivo." });
    }

    try {
        const data = await RegrasService.getRegraDetalhes(idRegraVal);

        if (!data) {
            return res.status(404).json({ error: "Regra não encontrada." });
        }

        // A lógica de calcularStatusRegra (helper) será aplicada no frontend (script.js)
        // ou pode ser aplicada aqui, mas o frontend já faz isso.
        res.json(data);

    } catch (error) {
        console.error(`ERROR getRegraDetalhes (${idRegraVal}):`, error);
        res.status(500).json({ error: "Erro ao buscar detalhes da regra" });
    }
};


/**
 * POST /regras
 * Cria uma nova regra.
 */
exports.createRegra = async (req, res) => {
    try {
        const payload = req.body || {};
        // Garante que o usuário está autenticado (assumindo middleware auth)
        const id_usuario_criador = req.user ? req.user.id_usuario : null;

        if (!id_usuario_criador) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        // 1. Extração de Campos (Desestruturação)
        // Adicionei campos opcionais (descricao, janelas) que vimos antes
        const { 
            id_banco_dados, nome, consulta_sql, intervalo_minutos, 
            qnt_erro_max, prioridade, roles, descricao, janela_inicio, janela_fim 
        } = payload;

        // 2. Validação de Campos Obrigatórios (antes de manipular strings)
        if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos) {
            return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos" });
        }

        // 3. Validação de Segurança (DML/DDL)
        const sqlLimpo = String(consulta_sql).trim().toUpperCase();
        if (/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sqlLimpo)) {
            // Retorna 400 Bad Request em vez de explodir um erro
            return res.status(400).json({ error: "Segurança: Comandos DML/DDL não são permitidos nesta regra." });
        }

        if (!Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({ error: "O campo 'roles' é obrigatório e deve ser um array de IDs." });
        }

        // 4. Normalização (Sanitização)
        const idBancoVal = parseInt(id_banco_dados, 10);
        const intervaloVal = parseInt(intervalo_minutos, 10);
        const prioridadeVal = parseInt(prioridade, 10) || 3; 
        const qntErroMaxVal = Number(qnt_erro_max) >= 0 ? Number(qnt_erro_max) : 1;
        
        // Filtra roles para garantir que sejam números válidos
        const rolesVal = roles.map(r => parseInt(r, 10)).filter(id => !isNaN(id) && id > 0);

        if (!idBancoVal || !intervaloVal || rolesVal.length === 0) {
            return res.status(400).json({ error: "IDs (banco/intervalo/roles) devem ser números inteiros válidos." });
        }

        // 5. Montagem do Objeto Seguro 
            const dadosRegra = {
            // LADO ESQUERDO (O que o Service espera) : LADO DIREITO (Variável do Controller)
            idBancoVal: idBancoVal,          
            nome: nome.trim(),
            consulta_sql: consulta_sql,
            intervaloVal: intervaloVal,      
            qntErroMaxVal: qntErroMaxVal,    
            prioridadeVal: prioridadeVal,    
            rolesVal: rolesVal,              
            
            // Opcionais
            descricao: descricao || null,
            janela_inicio: janela_inicio || '00:00',
            janela_fim: janela_fim || '23:59',
            
            // Campos de Adiar/Silenciar (passando null se não vierem no body)
            data_adiar_inicio: payload.data_adiar_inicio || null,
            data_adiar_fim: payload.data_adiar_fim || null,
            data_silenciar_inicio: payload.data_silenciar_inicio || null,
            data_silenciar_fim: payload.data_silenciar_fim || null
        };

        // 6. Chamada ao Service
        const result = await RegrasService.createRegra(dadosRegra, id_usuario_criador);

        return res.status(201).json(result);

    } catch (err) {
        // Tratamento de Erro de Chave Estrangeira (Postgres)
        if (err && err.code === "23503") {
            return res.status(409).json({ error: "Falha ao criar regra: Banco de dados ou Role informada não existe." });
        }
        
        console.error("Erro ao inserir regra:", err);
        return res.status(500).json({ error: "Erro interno ao cadastrar regra." });
    }
};

/**
 * PUT /regras/:id
 * Atualiza uma regra existente.
 */
exports.updateRegra = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);
    const id_usuario_atualizacao = req.user.id_usuario;
    const payload = req.body || {};

    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra inválido." });
    }

    // 1. Validação (Simplificada, garantindo os campos críticos)
    const { id_banco_dados, nome, consulta_sql, intervalo_minutos, roles } = payload;
    if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos e roles." });
    }

    // 2. Normalização
    const idBancoVal = asInteger(id_banco_dados);
    const intervaloVal = asInteger(intervalo_minutos);
    const prioridadeVal = asInteger(payload.prioridade) || 3;
    const qntErroMaxVal = Number(payload.qnt_erro_max) >= 0 ? Number(payload.qnt_erro_max) : 1;
    const rolesVal = roles.map(asInteger).filter(id => id !== null);

    if (!idBancoVal || !intervaloVal || rolesVal.length === 0) {
        return res.status(400).json({ error: "IDs (banco/intervalo/roles) devem ser números inteiros positivos." });
    }

    // 3. Chamada ao Service
    try {
        await RegrasService.updateRegra(idRegraVal, {
            ...payload, idBancoVal, intervaloVal, qntErroMaxVal, prioridadeVal, rolesVal
        }, id_usuario_atualizacao);

        return res.status(200).json({ message: "Regra atualizada com sucesso.", id_regra: idRegraVal });

    } catch (error) {
        if (error.message === 'Regra não encontrada para atualização.') {
             return res.status(404).json({ error: "Regra não encontrada para atualização." });
        }
        if (error.code === "23503") {
            return res.status(400).json({ error: "Violação de integridade (Banco ou Role inválido)." });
        }
        console.error(`Erro ao atualizar regra ${idRegraVal}:`, error);
        res.status(500).json({ error: "Erro interno ao atualizar regra." });
    }
};

/**
 * PATCH /regras/:id/acoes
 * Agenda ações (Adiar/Silenciar/Cancelar).
 */
exports.updateRegraAcoes = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);
    const idUsuario = req.user.id_usuario;
    const { tipo, inicio, fim } = req.body || {};

    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra inválido." });
    }

    if (tipo !== 'cancelar' && (!inicio || !fim)) {
        return res.status(400).json({ error: "Para agendar, início e fim são obrigatórios." });
    }
    
    try {
        await RegrasService.updateRegraAcoes(idRegraVal, { tipo, inicio, fim }, idUsuario);
        res.json({ message: "Ação da regra atualizada com sucesso." });
        
    } catch (error) {
        if (error.message === 'Regra não encontrada.') {
             return res.status(404).json({ error: "Regra não encontrada." });
        }
        console.error(`Erro no PATCH /regras/${idRegraVal}/acoes:`, error);
        res.status(500).json({ error: "Erro interno ao atualizar ação da regra." });
    }
};

/**
 * DELETE /regras/:id
 * Exclui uma regra.
 */
exports.deleteRegra = async (req, res) => {
    const idRegraVal = asInteger(req.params.id);

    if (!idRegraVal) {
        return res.status(400).json({ error: "ID da regra inválido." });
    }

    try {
        await RegrasService.deleteRegra(idRegraVal);
        res.json({ message: "Regra excluída com sucesso." });

    } catch (error) {
        if (error.message === 'Regra não encontrada.') {
             return res.status(404).json({ error: "Regra não encontrada." });
        }
        if (error.code === '23503') {
            return res.status(409).json({ 
                error: "Não é possível excluir esta regra pois ela possui histórico (incidentes ou logs). Tente silenciá-la permanentemente." 
            });
        }
        console.error(`Erro ao excluir regra ${idRegraVal}:`, error);
        res.status(500).json({ error: "Erro interno ao excluir regra." });
    }
};

/**
 * POST /regras/testar
 * Executa a consulta SQL em modo sandbox.
 */
exports.testarRegra = async (req, res) => {
    const { id_banco_dados, consulta_sql } = req.body || {};

    // 1. Validação
    const idBancoVal = asInteger(id_banco_dados);
    if (!idBancoVal || !consulta_sql) {
        return res.status(400).json({ error: "id_banco_dados e consulta_sql são obrigatórios." });
    }

    try {
        // 2. Chamada ao Service
        const resultado = await RegrasService.testarConsultaSql(consulta_sql, idBancoVal);

        // 3. Resposta
        if (resultado.status === "ERRO") {
            // Retorna 400 Bad Request se a SQL falhar
            return res.status(400).json({ error: "Erro na consulta SQL: " + resultado.error });
        }
        
        // Retorna o resultado do teste
        res.json(resultado);

    } catch (error) {
        console.error("Erro interno ao testar regra:", error);
        res.status(500).json({ error: "Erro interno do servidor ao processar o teste." });
    }
};