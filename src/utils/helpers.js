/**
 * Lista de tabelas permitidas (Plantão Monitor) / evita SQL injection
 */
const TABLES = {
    perfis: "perfil",
    roles: "roles",
    tipos_canal_notificacao: "tipos_canal_notificacao",
    bancos: "banco_dados",
    recursos: "recursos",
    usuarios: "usuario",
    configuracoes_notificacao: "configuracoes_notificacao",
    usuario_recursos: "usuario_recursos",
    escalas: "escala",
    regras: "regra",
    regras_roles: "regra_role",
    incidentes: "incidente",
    log_execucoes: "log_execucoes_regras",
    log_notificacoes: "log_notificacoes",
    log_auditoria: "log_auditoria_alteracoes",
};

/**
 * Tenta converter um valor para um Inteiro positivo.
 * Retorna null se não for um inteiro > 0.
 */
function asInteger(v) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) {
        return n;
    }
    return null;
}

/**
 * Normaliza uma entrada (string, data) para um timestamp ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
 * Retorna null se a data for inválida.
 */
function normalizeDateToISO(v) {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString(); // Formato do 'TIMESTAMP WITH TIME ZONE'
}

/**
 * Calcula o status dinâmico de uma regra (Ativa, Adiada, Silenciada)
 */
function calcularStatusRegra(regra) {
    const agora = new Date();
    
    // Checa se está Adiada
    if (regra.data_adiar_inicio && regra.data_adiar_fim) {
        // Converte as strings ISO do banco para objetos Date para comparar
        if (agora >= new Date(regra.data_adiar_inicio) && agora <= new Date(regra.data_adiar_fim)) {
            return 'Adiada';
        }
    }
    
    // Checa se está Silenciada
    if (regra.data_silenciar_inicio && regra.data_silenciar_fim) {
        if (agora >= new Date(regra.data_silenciar_inicio) && agora <= new Date(regra.data_silenciar_fim)) {
            return 'Silenciada';
        }
    }
    
    // Senão, está Ativa
    return 'Ativa';
}

module.exports = {
    TABLES,
    asInteger,
    normalizeDateToISO,
    calcularStatusRegra
};