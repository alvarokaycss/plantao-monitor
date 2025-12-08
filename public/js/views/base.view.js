// public/js/views/base.view.js

// Exportamos um objeto com getters para garantir que o DOM já carregou quando acessarmos
export const ui = {
    // Login
    loginView: document.getElementById('login-view'),
    appContainer: document.getElementById('app-container'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPass: document.getElementById('login-password'),
    loginNome: document.getElementById('login-nome'),
    fieldNomeContainer: document.getElementById('field-nome-container'),
    btnSubmit: document.getElementById('btn-submit'),
    toggleMode: document.getElementById('toggle-mode'),
    loginStatus: document.getElementById('login-status'),

    // Navbar
    logoutButton: document.getElementById('logout-btn'),
    profileButton: document.querySelector('.profile-button'),
    navLinks: document.querySelectorAll('.nav-link, .profile-button'),

    // Geral
    content: document.getElementById('app-content'),
    views: document.querySelectorAll('.view'),
    messageArea: document.getElementById('message-area'),

    // Detalhes Incidente
    detalhe: {
        modal: document.getElementById('modal-detalhes-incidente'),
        btnClose: document.getElementById('btn-fechar-detalhe'),
        timeline: document.getElementById('timeline-historico'),
        lblStatus: document.getElementById('detalhe-status'),
        lblRegra: document.getElementById('detalhe-regra'),
        lblPlantonista: document.getElementById('detalhe-plantonista'),
        lblAbertura: document.getElementById('detalhe-abertura'),
        lblFechamento: document.getElementById('detalhe-fechamento'),
        boxJson: document.getElementById('detalhe-json-erro'),
        boxComentario: document.getElementById('detalhe-ultimo-comentario'),
        btnAck: document.getElementById('btn-detalhe-ack'),
        btnCloseInc: document.getElementById('btn-detalhe-close'),
        btnReexecute: document.getElementById('btn-detalhe-reexecute')
    },

    // Incidentes
    incidentes: {
        kpiPlantonista: document.getElementById('kpi-plantonista'),
        kpiInicio: document.getElementById('kpi-inicio'),
        kpiFim: document.getElementById('kpi-fim'),
        kpiAbertos: document.getElementById('kpi-abertos'),
        kpiReconhecidos: document.getElementById('kpi-reconhecidos'),
        kpiMtta: document.getElementById('kpi-mtta'),
        kpiMttr: document.getElementById('kpi-mttr'),
        filterStatus: document.getElementById('filter-status'),
        filterPrioridade: document.getElementById('filter-prioridade'),
        filterBtn: document.getElementById('filter-btn'),
        listContainer: document.getElementById('incident-list-container')
    },
    incidentTemplate: document.getElementById('incident-item-template'),

    // Analytics
    analytics: {
        btnGerar: document.getElementById('btn-gerar-analytics'),
        modal: document.getElementById('modal-analytics-view'),
        imgFull: document.getElementById('img-analytics-full')
    },

    // Regras
    regras: {
        view: document.getElementById('view-regras'),
        tbody: document.getElementById('regras-list-body'),
        filterPrioridade: document.getElementById('regras-filter-prioridade'),
        search: document.getElementById('regras-search'),
        modal: document.getElementById('modal-acoes'), // Modal Ações
        formAcoes: document.getElementById('form-acoes'),
        btnCancelAcao: document.getElementById('btn-cancel-acao'),
        
        // Modal CRUD
        addBtn: document.getElementById('btn-add-regra'),
        crudModal: document.getElementById('modal-regra'),
        crudForm: document.getElementById('form-regra'),
        crudTitle: document.getElementById('modal-regra-title'),
        btnCancelCrud: document.getElementById('btn-cancel-regra'),
        regraId: document.getElementById('regra-id-regra'),
        
        // Campos Regra
        campoNome: document.getElementById('regra-nome'),
        campoDescricao: document.getElementById('regra-descricao'),
        campoFrequencia: document.getElementById('regra-frequencia'),
        campoErros: document.getElementById('regra-erros'),
        campoJanelaInicio: document.getElementById('regra-inicio'),
        campoJanelaFim: document.getElementById('regra-fim'),
        campoPrioridade: document.getElementById('regra-prioridade'),
        campoBanco: document.getElementById('regra-banco'),
        rolesContainer: document.getElementById('regra-roles-container'),
        campoSqL: document.getElementById('regra-sql'),
        campoNotificacao: document.getElementById('regra-notificacao'),
        campoResultado: document.getElementById('regra-resultado'),
        btnTestar: document.getElementById('btn-testar-regra')
    },

    // Usuários
    usuarios: {
        view: document.getElementById('view-usuarios'),
        tbody: document.getElementById('usuarios-list-body'),
        filterPerfil: document.getElementById('usuarios-filter-perfil'),
        search: document.getElementById('usuarios-search'),
        
        // Modal Config
        modal: document.getElementById('modal-usuario-config'),
        form: document.getElementById('form-usuario-config'),
        title: document.getElementById('modal-usuario-title'),
        infoEmail: document.getElementById('usuario-info-email'),
        usuarioId: document.getElementById('usuario-id'),
        campoPerfil: document.getElementById('config-perfil'),
        campoAtivo: document.getElementById('config-ativo'),
        recursosContainer: document.getElementById('config-recursos-container'),
        notificacaoContainer: document.getElementById('config-notificacao-container'),
        btnCancel: document.getElementById('btn-cancel-usuario')
    },

    modals: {
        // Modal de Confirmação de Reexecução
        reexecute: {
            modal: document.getElementById('modal-reexecute-confirm'),
            btnCancel: document.getElementById('btn-reexec-fechar'),
            btnConfirm: document.getElementById('btn-reexec-confirmar')
        },
        // Modal de Fechamento com Comentário
        closeIncident: {
            modal: document.getElementById('modal-close-incident'),
            inputComment: document.getElementById('close-comment-input'),
            btnCancel: document.getElementById('btn-close-modal-fechar'),
            btnConfirm: document.getElementById('btn-close-modal-confirmar')
        }
    }
};