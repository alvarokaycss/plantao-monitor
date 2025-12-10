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
        // Garante que o usuário está autenticado
        const id_usuario_criador = req.user ? req.user.id_usuario : null;

        if (!id_usuario_criador) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        // 1. Extração de Campos
        const { 
            id_banco_dados, nome, consulta_sql, intervalo_minutos, 
            qnt_erro_max, prioridade, roles, escalonamento,
            descricao, janela_inicio, janela_fim,
            data_adiar_inicio, data_adiar_fim, 
            data_silenciar_inicio, data_silenciar_fim
        } = payload;

        // 2. Processamento do Escalonamento
        let escalonamentoVal = [];
        if (Array.isArray(escalonamento)) {
            escalonamentoVal = escalonamento.map(e => ({
                minutos: asInteger(e.minutos),
                role: asInteger(e.role),
                canal: asInteger(e.canal)
            })).filter(e => e.minutos !== null && e.role !== null && e.canal !== null);
        }

        // 3. Validação de Campos Obrigatórios
        if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos) {
            return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos" });
        }

        // 4. Validação de Segurança (DML/DDL)
        const sqlLimpo = String(consulta_sql).trim().toUpperCase();
        if (/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sqlLimpo)) {
            return res.status(400).json({ error: "Segurança: Comandos DML/DDL não são permitidos nesta regra." });
        }

        if (!Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({ error: "O campo 'roles' é obrigatório e deve ser um array de IDs." });
        }

        // 5. Normalização (Sanitização)
        const idBancoVal = asInteger(id_banco_dados);
        const intervaloVal = asInteger(intervalo_minutos);
        const prioridadeVal = asInteger(prioridade) || 3; 
        const qntErroMaxVal = Number(qnt_erro_max) >= 0 ? Number(qnt_erro_max) : 1;
        
        // Filtra roles
        const rolesVal = roles.map(asInteger).filter(id => id !== null);

        if (!idBancoVal || !intervaloVal || rolesVal.length === 0) {
            return res.status(400).json({ error: "IDs (banco/intervalo/roles) devem ser números inteiros válidos." });
        }

        // 6. Montagem do Objeto para o Service
        const dadosRegra = {
            idBancoVal,          
            nome: String(nome).trim(),
            consulta_sql,
            intervaloVal,      
            qntErroMaxVal,    
            prioridadeVal,    
            rolesVal,
            escalonamentoVal, 
            
            // Opcionais
            descricao: descricao || null,
            janela_inicio: janela_inicio || '00:00',
            janela_fim: janela_fim || '23:59',
            
            // Campos de Ação
            data_adiar_inicio: data_adiar_inicio || null,
            data_adiar_fim: data_adiar_fim || null,
            data_silenciar_inicio: data_silenciar_inicio || null,
            data_silenciar_fim: data_silenciar_fim || null
        };

        // 7. Chamada ao Service
        const result = await RegrasService.createRegra(dadosRegra, id_usuario_criador);

        return res.status(201).json(result);

    } catch (err) {
        if (err && err.code === "23503") {
            return res.status(409).json({ error: "Falha de integridade: Banco, Role ou Canal inválido." });
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

    // 1. Validação
    const { id_banco_dados, nome, consulta_sql, intervalo_minutos, roles, escalonamento } = payload;
    if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos e roles." });
    }

    let escalonamentoVal = [];
    if (Array.isArray(escalonamento)) {
        escalonamentoVal = escalonamento.map(e => ({
            minutos: asInteger(e.minutos),
            role: asInteger(e.role),
            canal: asInteger(e.canal)
        })).filter(e => e.minutos !== null && e.role !== null && e.canal !== null);
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
            ...payload, idBancoVal, intervaloVal, qntErroMaxVal, prioridadeVal, rolesVal,
            escalonamentoVal 
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