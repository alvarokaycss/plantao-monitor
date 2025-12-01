// ==============================================
// 1. CONFIGURAÇÕES E ESTADO GLOBAL
// ==============================================

const BASE_URL = 'http://localhost:8000';

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCtCAJBu_PPTxk-3DEbj1au1yXPVqnZ5kE",
    authDomain: "qq-monitor-auth.firebaseapp.com",
    projectId: "qq-monitor-auth",
    storageBucket: "qq-monitor-auth.firebasestorage.app",
    messagingSenderId: "874647901640",
    appId: "1:874647901640:web:c6c8893e3f615091105cfd"
};

// Variáveis de Auth
let auth;
let idToken = null;

// Variáveis Globais de Estado (Cache)
let regrasCache = [];
let bancosCache = [];
let rolesCache = [];
let perfisCache = [];
let recursosCache = [];
let tiposCanalCache = [];

// Variáveis de Controle de Modais
let isRegisterMode = false;
window.idUsuarioParaDeletar = null; // Global para o modal de delete de usuário
window.idRegraParaDeletar = null;   // Global para o modal de delete de regra
window.idRegraPendenteCancelamento = null; // Global para confirmar ação

// Referências de UI
const ui = {
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

    // Regras
    regras: {
        view: document.getElementById('view-regras'),
        tbody: document.getElementById('regras-list-body'),
        filterPrioridade: document.getElementById('regras-filter-prioridade'),
        search: document.getElementById('regras-search'),

        // Modal Ações
        modal: document.getElementById('modal-acoes'),
        formAcoes: document.getElementById('form-acoes'),
        btnCancelAcao: document.getElementById('btn-cancel-acao'),

        // Modal CRUD
        addBtn: document.getElementById('btn-add-regra'),
        crudModal: document.getElementById('modal-regra'),
        crudForm: document.getElementById('form-regra'),
        crudTitle: document.getElementById('modal-regra-title'),
        btnCancelCrud: document.getElementById('btn-cancel-regra'),
        regraId: document.getElementById('regra-id-regra'),

        // Campos
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
        addBtn: document.getElementById('btn-add-usuario'),

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
    }
};

// ==============================================
// 2. INICIALIZAÇÃO (INIT)
// ==============================================

function init() {
    console.log('Plantão Monitor iniciando...');

    // 1. Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();

    // 2. Navegação (SPA)
    ui.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.view;
            if (viewName) navigateTo(viewName); // check simples
        });
    });

    // 3. Logout
    if (ui.logoutButton) ui.logoutButton.addEventListener('click', handleLogout);

    // 4. Login (Formulário)
    if (ui.loginForm) {
        ui.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isRegisterMode) {
                await handleEmailRegister();
            } else {
                await handleEmailLogin();
            }
        });
    }

    // 5. Toggle Login/Cadastro
    if (ui.toggleMode) {
        ui.toggleMode.addEventListener('click', () => {
            isRegisterMode = !isRegisterMode;
            ui.loginStatus.textContent = '';
            ui.loginStatus.className = 'login-status-text';

            if (isRegisterMode) {
                // MODO CADASTRO
                ui.fieldNomeContainer.classList.remove('hidden');
                ui.btnSubmit.textContent = 'Criar Conta';
                ui.btnSubmit.classList.remove('btn-primary');
                ui.btnSubmit.classList.add('btn-secondary');
                ui.toggleMode.textContent = 'Já tem conta? Voltar para Login';
                if (ui.loginNome) ui.loginNome.required = true;
                ui.loginStatus.textContent = 'Preencha seus dados para cadastro.';
            } else {
                // MODO LOGIN
                ui.fieldNomeContainer.classList.add('hidden');
                ui.btnSubmit.textContent = 'Entrar';
                ui.btnSubmit.classList.remove('btn-secondary');
                ui.btnSubmit.classList.add('btn-primary');
                ui.toggleMode.textContent = 'Não tem conta? Cadastre-se';
                if (ui.loginNome) ui.loginNome.required = false;
                ui.loginStatus.textContent = 'Aguardando credenciais...';
            }
        });
    }

    // 6. Listeners de Filtros
    if (ui.incidentes.filterBtn) ui.incidentes.filterBtn.addEventListener('click', loadIncidentesView);
    if (ui.regras.search) ui.regras.search.onkeyup = setupRegrasFilters;
    if (ui.regras.filterPrioridade) ui.regras.filterPrioridade.onchange = setupRegrasFilters;
    if (ui.usuarios.search) ui.usuarios.search.onkeyup = loadUsuariosView;
    if (ui.usuarios.filterPerfil) ui.usuarios.filterPerfil.onchange = loadUsuariosView;

    // 7. Listeners CRUD Regras
    if (ui.regras.addBtn) ui.regras.addBtn.addEventListener('click', () => openRegraModal('new'));
    if (ui.regras.btnCancelCrud) ui.regras.btnCancelCrud.addEventListener('click', closeRegraModal);
    if (ui.regras.crudForm) ui.regras.crudForm.addEventListener('submit', handleRegraSubmit);
    if (ui.regras.btnTestar) ui.regras.btnTestar.addEventListener('click', handleTestarRegra);
    if (ui.regras.btnCancelAcao) ui.regras.btnCancelAcao.onclick = () => { ui.regras.modal.style.display = 'none'; };
    if (ui.regras.formAcoes) ui.regras.formAcoes.onsubmit = handleAcaoSubmit;

    // 8. Listeners CRUD Usuários
    if (ui.usuarios.addBtn) ui.usuarios.addBtn.onclick = () => openUsuarioModal('new');
    if (ui.usuarios.btnCancel) ui.usuarios.btnCancel.onclick = closeUsuarioModal;
    if (ui.usuarios.form) ui.usuarios.form.onsubmit = handleUsuarioSubmit;

    // 9. Configura Modais Genéricos (Delete/Confirmar)
    setupGenericModalListeners();

    // 10. Inicia Listener de Auth
    setupAuthListener();

    // 11. 
    setupAnalyticsListener();
}

// ==============================================
// 3. LISTENERS GENÉRICOS (DELETE/CONFIRM)
// ==============================================

function setupGenericModalListeners() {
    // --- 1. MODAL DELETAR USUÁRIO ---
    const btnDelUserClose = document.getElementById('btn-del-usuario-fechar');
    const btnDelUserConfirm = document.getElementById('btn-del-usuario-confirmar');
    const modalDelUser = document.getElementById('modal-delete-usuario');

    if (btnDelUserClose && modalDelUser) {
        btnDelUserClose.onclick = () => {
            modalDelUser.style.display = 'none';
            window.idUsuarioParaDeletar = null;
        };
    }

    if (btnDelUserConfirm && modalDelUser) {
        btnDelUserConfirm.onclick = async () => {
            if (!window.idUsuarioParaDeletar) return;

            const originalText = btnDelUserConfirm.textContent;
            btnDelUserConfirm.textContent = 'Excluindo...';
            btnDelUserConfirm.disabled = true;

            try {
                await fetchApi(`/usuarios/${window.idUsuarioParaDeletar}`, { method: 'DELETE' });
                showMessage('Usuário excluído com sucesso.', 'success');
                modalDelUser.style.display = 'none';
                await loadUsuariosView();
            } catch (error) {
                console.error(error);
                showMessage('Erro ao excluir: ' + error.message, 'error');
                modalDelUser.style.display = 'none';
            } finally {
                window.idUsuarioParaDeletar = null;
                btnDelUserConfirm.textContent = originalText;
                btnDelUserConfirm.disabled = false;
            }
        };
    }

    // --- 2. MODAL DELETAR REGRA ---
    const btnDelRegraClose = document.getElementById('btn-del-fechar');
    const btnDelRegraConfirm = document.getElementById('btn-del-confirmar');
    const modalDelRegra = document.getElementById('modal-delete-regra');

    if (btnDelRegraClose && modalDelRegra) {
        btnDelRegraClose.onclick = () => {
            modalDelRegra.style.display = 'none';
            window.idRegraParaDeletar = null;
        };
    }

    if (btnDelRegraConfirm && modalDelRegra) {
        btnDelRegraConfirm.onclick = async () => {
            if (!window.idRegraParaDeletar) return;

            const originalText = btnDelRegraConfirm.textContent;
            btnDelRegraConfirm.textContent = 'Excluindo...';
            btnDelRegraConfirm.disabled = true;

            try {
                await fetchApi(`/regras/${window.idRegraParaDeletar}`, { method: 'DELETE' });
                showMessage('Regra excluída com sucesso.', 'success');
                modalDelRegra.style.display = 'none';
                await loadRegrasView();
            } catch (error) {
                console.error(error);
                showMessage('Erro ao excluir: ' + error.message, 'error');
                modalDelRegra.style.display = 'none';
            } finally {
                window.idRegraParaDeletar = null;
                btnDelRegraConfirm.textContent = originalText;
                btnDelRegraConfirm.disabled = false;
            }
        };
    }

    // --- 3. MODAL CONFIRMAÇÃO (Ações) ---
    const btnConfClose = document.getElementById('btn-conf-fechar');
    const btnConfExec = document.getElementById('btn-conf-executar');
    const modalConf = document.getElementById('modal-confirmacao');

    if (btnConfClose && modalConf) {
        btnConfClose.onclick = () => {
            modalConf.style.display = 'none';
            window.idRegraPendenteCancelamento = null;
        };
    }

    if (btnConfExec && modalConf) {
        btnConfExec.onclick = async () => {
            if (!window.idRegraPendenteCancelamento) return;

            const originalText = btnConfExec.textContent;
            btnConfExec.textContent = 'Processando...';
            btnConfExec.disabled = true;

            try {
                await fetchApi(`/regras/${window.idRegraPendenteCancelamento}/acoes`, {
                    method: 'PATCH',
                    body: JSON.stringify({ tipo: 'cancelar' })
                });
                showMessage('Programação cancelada.', 'success');
                modalConf.style.display = 'none';
                await loadRegrasView();
            } catch (error) {
                console.error(error);
                showMessage('Erro ao cancelar: ' + error.message, 'error');
                modalConf.style.display = 'none';
            } finally {
                window.idRegraPendenteCancelamento = null;
                btnConfExec.textContent = originalText;
                btnConfExec.disabled = false;
            }
        };
    }
}

function setupAnalyticsListener() {
    const btnGerarAnalytics = document.getElementById('btn-gerar-analytics');
    
    // Referências do Modal Novo
    const modalAnalytics = document.getElementById('modal-analytics-view');
    const imgFull = document.getElementById('img-analytics-full');
    const btnClose = document.getElementById('btn-close-analytics');

    // Fecha se clicar no fundo escuro (UX padrão)
    if (modalAnalytics) {
        modalAnalytics.onclick = (e) => {
            if (e.target === modalAnalytics) { // Garante que clicou fora da imagem
                modalAnalytics.style.display = 'none';
            }
        };
    }

    if (btnGerarAnalytics) {
        btnGerarAnalytics.addEventListener('click', async () => {
            // Feedback de carregamento
            const originalText = btnGerarAnalytics.innerHTML;
            btnGerarAnalytics.textContent = 'Gerando Gráfico...';
            btnGerarAnalytics.disabled = true;

            try {
                // Chama o Python via Node
                const response = await fetchApi('/analytics/gerar', { method: 'POST' });

                if (response.success && response.imageUrl) {
                    // SUCESSO: Define a imagem e ABRE O MODAL
                    // O timestamp (?t=...) força o navegador a baixar a imagem nova
                    imgFull.src = response.imageUrl + '&t=' + new Date().getTime();
                    
                    // Mostra o modal
                    modalAnalytics.style.display = 'flex'; 
                } else {
                    showMessage('Erro ao gerar gráfico: ' + (response.error || 'Desconhecido'), 'error');
                }
            } catch (error) {
                console.error("Falha analytics:", error);
                showMessage('Falha na comunicação com o servidor de Analytics.', 'error');
            } finally {
                // Restaura o botão
                btnGerarAnalytics.innerHTML = originalText;
                btnGerarAnalytics.disabled = false;
            }
        });
    }
}

// ==============================================
// 4. FUNÇÕES EXPOSTAS NO WINDOW (HTML ONCLICK)
// ==============================================

window.deleteUsuario = (idUsuario) => {
    window.idUsuarioParaDeletar = idUsuario;
    document.getElementById('modal-delete-usuario').style.display = 'flex';
};

window.deleteRegra = (idRegra) => {
    window.idRegraParaDeletar = idRegra;
    document.getElementById('modal-delete-regra').style.display = 'flex';
};

window.cancelarProgramacao = (idRegra) => {
    window.idRegraPendenteCancelamento = idRegra;
    document.getElementById('modal-confirmacao').style.display = 'flex';
};

window.openAcaoModal = (idRegra) => {
    ui.regras.modal.style.display = 'flex';
    document.getElementById('acao-id-regra').value = idRegra;

    // Preenche campos
    const regra = regrasCache.find(r => r.id_regra == idRegra);
    if (regra) {
        const toDatetimeLocal = (isoString) => {
            if (!isoString) return '';
            const date = new Date(isoString);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            return date.toISOString().slice(0, 16);
        };

        const acaoTipoSelect = document.getElementById('acao-tipo');
        const acaoInicioInput = document.getElementById('acao-inicio');
        const acaoFimInput = document.getElementById('acao-fim');

        if (regra.data_adiar_inicio) {
            acaoTipoSelect.value = 'adiar';
            acaoInicioInput.value = toDatetimeLocal(regra.data_adiar_inicio);
            acaoFimInput.value = toDatetimeLocal(regra.data_adiar_fim);
        } else if (regra.data_silenciar_inicio) {
            acaoTipoSelect.value = 'silenciar';
            acaoInicioInput.value = toDatetimeLocal(regra.data_silenciar_inicio);
            acaoFimInput.value = toDatetimeLocal(regra.data_silenciar_fim);
        } else {
            acaoTipoSelect.value = 'silenciar';
            acaoInicioInput.value = '';
            acaoFimInput.value = '';
        }
    }
};

window.openRegraModal = async (modeOrId) => {
    await setupRegraForm(); // Carrega bancos/roles

    ui.regras.crudForm.reset();
    ui.regras.regraId.value = '';
    ui.regras.campoResultado.value = '';
    ui.regras.rolesContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false);

    const isEditing = modeOrId !== 'new';

    if (isEditing) {
        const idRegra = Number(modeOrId);
        ui.regras.crudTitle.textContent = 'Editar regra existente';
        ui.regras.regraId.value = idRegra;

        try {
            const regraDetalhes = await fetchApi(`/regras/${idRegra}/detalhes`);
            const info = regraDetalhes.info;

            ui.regras.campoNome.value = info.nome || '';
            ui.regras.campoDescricao.value = info.descricao || '';
            ui.regras.campoFrequencia.value = info.intervalo_minutos || 5;
            ui.regras.campoErros.value = info.qnt_erro_max || 1;
            ui.regras.campoJanelaInicio.value = info.janela_inicio ? info.janela_inicio.substring(0, 5) : '09:00';
            ui.regras.campoJanelaFim.value = info.janela_fim ? info.janela_fim.substring(0, 5) : '18:00';
            ui.regras.campoPrioridade.value = info.prioridade || 3;
            ui.regras.campoBanco.value = info.id_banco_dados || '';
            ui.regras.campoSqL.value = info.consulta_sql || '';

            // Checkboxes
            const regraDaLista = regrasCache.find(r => r.id_regra == idRegra);
            if (regraDaLista && regraDaLista.roles_id && Array.isArray(regraDaLista.roles_id)) {
                const selectedRoleIds = regraDaLista.roles_id.map(String);
                ui.regras.rolesContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                    if (selectedRoleIds.includes(chk.value)) chk.checked = true;
                });
            }
        } catch (error) {
            console.error(error);
            showMessage('Erro ao carregar regra: ' + error.message, 'error');
        }
    } else {
        ui.regras.crudTitle.textContent = 'Adicionar nova regra';
        ui.regras.campoPrioridade.value = 3;
        if (bancosCache.length > 0) ui.regras.campoBanco.value = bancosCache[0].id_banco_dados;
    }
    ui.regras.crudModal.style.display = 'flex';
};

window.openUsuarioModal = async (modeOrId) => {
    ui.usuarios.form.reset();
    ui.usuarios.recursosContainer.innerHTML = '';
    ui.usuarios.notificacaoContainer.innerHTML = '';
    ui.usuarios.usuarioId.value = '';

    // Popula Perfis
    const selectPerfil = ui.usuarios.campoPerfil;
    selectPerfil.innerHTML = '';
    perfisCache.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id_perfil;
        opt.textContent = p.nome;
        selectPerfil.appendChild(opt);
    });

    const isEditing = modeOrId !== 'new';

    if (isEditing) {
        const idUsuario = Number(modeOrId);
        ui.usuarios.title.textContent = 'Configurar Usuário Existente';
        try {
            const data = await fetchApi(`/usuarios/${idUsuario}/detalhes`);
            const info = data.info;

            // Alerta se editando próprio perfil
            // (Poderia checar com API /eu, mas simplificando)

            ui.usuarios.usuarioId.value = idUsuario;
            ui.usuarios.infoEmail.textContent = `Usuário: ${info.nome} (${info.email})`;
            ui.usuarios.campoPerfil.value = info.id_perfil;
            ui.usuarios.campoAtivo.value = info.ativo ? 'true' : 'false';

            renderRecursosCheckboxes(data.recursos || []);
            renderNotificacaoCampos(data.configuracoes || []);
        } catch (error) {
            showMessage('Erro ao carregar usuário: ' + error.message, 'error');
        }
    } else {
        ui.usuarios.title.textContent = 'Adicionar Novo Usuário';
        ui.usuarios.infoEmail.textContent = 'O usuário será provisionado após o primeiro login.';
        ui.usuarios.campoAtivo.value = 'true';
        renderRecursosCheckboxes([]);
        renderNotificacaoCampos([]);
        showMessage('Use este modal apenas para pré-configuração.', 'info');
    }
    ui.usuarios.modal.style.display = 'flex';
};

// ==============================================
// 5. HELPERS (Fetch, Formatters)
// ==============================================

async function fetchApi(url, options = {}) {
    if (!idToken) {
        showMessage("Sessão expirada.", "error");
        auth.signOut();
        throw new Error("Token inválido.");
    }
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        ...options.headers
    };
    const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
    if (!res.ok) {
        let errorData = {};
        try { errorData = await res.json(); } catch (e) { }

        if (res.status === 401 || (res.status === 403 && errorData.code === "USER_INACTIVE")) {
            showMessage(errorData.error || "Sessão inválida.", "error");
            auth.signOut();
        }
        throw new Error(errorData.error || `Erro API: ${res.statusText}`);
    }
    if (res.status === 204) return null;
    return await res.json();
}

function showMessage(text, type = 'success') {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    ui.messageArea.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 500);
    }, 4000);
}

function formatPrioridade(p) { return Number(p) === 1 ? 'Alta' : (Number(p) === 2 ? 'Média' : 'Baixa'); }
function formatStatus(s) { return s === 'ABERTO' ? 'OPEN' : (s === 'RECONHECIDO' ? 'ACK' : 'CLOSE'); }
function formatData(isoDate) { if (!isoDate) return '--'; try { return new Date(isoDate).toLocaleString('pt-BR'); } catch (e) { return '--'; } }
function formatDataCurta(isoDate) { if (!isoDate) return '--'; try { return new Date(isoDate).toLocaleDateString('pt-BR'); } catch (e) { return '--'; } }
function formatRelativeTime(isoDate) {
    if (!isoDate) return '--';

    const diffMs = new Date() - new Date(isoDate);
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `Há ${diffMin} min`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Há ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Há 1 dia';
    return `Há ${diffDays} dias`;
}

// ==============================================
// 6. LÓGICA DE NEGÓCIO (HANDLERS)
// ==============================================

// --- Auth ---
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            ui.loginStatus.textContent = 'Autenticado.';
            try {
                idToken = await user.getIdToken(true);
                if (user.displayName) {
                    const iniciais = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
                    ui.profileButton.textContent = iniciais.toUpperCase();
                }
                showApp();
            } catch (error) {
                console.error(error);
                showLogin();
            }
        } else {
            idToken = null;
            showLogin();
        }
    });
}

function showLogin() { ui.loginView.style.display = 'flex'; ui.appContainer.style.display = 'none'; }
function showApp() { ui.loginView.style.display = 'none'; ui.appContainer.style.display = 'block'; navigateTo('incidentes'); }
function handleLogout() { auth.signOut(); }

async function handleEmailLogin() {
    if(ui.btnSubmit) ui.btnSubmit.disabled = true;
    
    try {
        await auth.signInWithEmailAndPassword(ui.loginEmail.value.trim(), ui.loginPass.value);
        // O setupAuthListener redireciona automaticamente
    } catch (error) {
        if(ui.btnSubmit) ui.btnSubmit.disabled = false;
        
        let msg = "Falha ao entrar.";
        
        // Verifica códigos padrão do SDK
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = "E-mail ou senha incorretos.";
        } 
        // Verifica se a mensagem contém o JSON bruto do erro da imagem
        else if (error.message && error.message.includes("INVALID_LOGIN_CREDENTIALS")) {
            msg = "E-mail ou senha incorretos.";
        }
        else if (error.code === 'auth/too-many-requests') {
            msg = "Muitas tentativas falhas. Tente novamente mais tarde.";
        }
        else {
            // Se for outro erro, tenta limpar o JSON bruto para não assustar o usuário
            try {
                // Tenta ver se é um JSON
                if (error.message.startsWith('{')) {
                    msg = "Erro no servidor de autenticação.";
                } else {
                    msg = error.message;
                }
            } catch(e) {
                msg = error.message;
            }
        }

        ui.loginStatus.textContent = msg;
        ui.loginStatus.className = 'login-status-text msg error';
    }
}

async function handleEmailRegister() {
    if (ui.btnSubmit) ui.btnSubmit.disabled = true;
    try {
        const cred = await auth.createUserWithEmailAndPassword(ui.loginEmail.value.trim(), ui.loginPass.value);
        await cred.user.updateProfile({ displayName: ui.loginNome.value.trim() });
        await cred.user.getIdToken(true);
    } catch (error) {
        if (ui.btnSubmit) ui.btnSubmit.disabled = false;
        ui.loginStatus.textContent = "Erro: " + error.message;
        ui.loginStatus.className = 'login-status-text msg error';
    }
}

// --- Navigation ---
async function navigateTo(viewName) {
    ui.views.forEach(v => v.style.display = 'none');
    ui.navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
    const active = document.getElementById(`view-${viewName}`);
    if (active) active.style.display = 'block';

    try {
        if (viewName === 'incidentes') await loadIncidentesView();
        if (viewName === 'regras') await loadRegrasView();
        if (viewName === 'usuarios') await loadUsuariosView();
    } catch (e) { console.error(e); }
}

// --- Incidentes ---
async function loadIncidentesView() {
    ui.incidentes.listContainer.innerHTML = 'Carregando...';
    try {
        const [kpi, list] = await Promise.all([fetchApi('/kpis'), fetchIncidentes()]);
        renderKPIs(kpi);
        renderIncidentesList(list);
    } catch (e) { ui.incidentes.listContainer.innerHTML = 'Erro ao carregar.'; }
}

async function fetchIncidentes() {
    const p = new URLSearchParams();
    if (ui.incidentes.filterStatus.value) p.append('status', ui.incidentes.filterStatus.value);
    if (ui.incidentes.filterPrioridade.value) p.append('prioridade', ui.incidentes.filterPrioridade.value);
    return fetchApi(`/incidentes?${p}`);
}

function renderKPIs(data) {
    // Plantonista
    if (data.plantonista_atual) {
        ui.incidentes.kpiPlantonista.textContent = data.plantonista_atual.nome;
        ui.incidentes.kpiInicio.textContent = `Início: ${formatDataCurta(data.plantonista_atual.data_inicio)}`;
        ui.incidentes.kpiFim.textContent = `Fim: ${formatDataCurta(data.plantonista_atual.data_fim)}`;
    } else {
        ui.incidentes.kpiPlantonista.textContent = 'Nenhum';
    }
    // Cards
    ui.incidentes.kpiAbertos.textContent = data.contagens.abertos;
    ui.incidentes.kpiReconhecidos.textContent = data.contagens.reconhecidos;
    ui.incidentes.kpiMtta.textContent = data.metricas.mtta_minutos;
    ui.incidentes.kpiMttr.textContent = data.metricas.mttr_minutos;
}

function renderIncidentesList(list) {
    const c = ui.incidentes.listContainer;
    c.innerHTML = '';
    if (!list || list.length === 0) { c.innerHTML = 'Nenhum incidente.'; return; }

    list.forEach(inc => {
        const clone = ui.incidentTemplate.content.cloneNode(true);
        const card = clone.querySelector('.incident-item');
        card.classList.add(`status-${inc.status}`);

        clone.querySelector('.incident-rule-name').textContent = inc.nome_regra || `ID ${inc.id_regra}`;

        const prio = clone.querySelector('.incident-priority');
        prio.textContent = formatPrioridade(inc.prioridade_registro);
        prio.dataset.priority = inc.prioridade_registro;

        clone.querySelector('.incident-meta').textContent = `${formatStatus(inc.status)} - ${formatData(inc.data_abertura)}`;
        clone.querySelector('.incident-pending').textContent = formatRelativeTime(inc.data_abertura);

        const btnAck = clone.querySelector('.btn-ack');
        const btnClose = clone.querySelector('.btn-close');

        if (inc.status === 'ABERTO') btnClose.disabled = true;
        else if (inc.status === 'RECONHECIDO') btnAck.disabled = true;
        else { btnAck.disabled = true; btnClose.disabled = true; }

        // Listeners
        btnAck.addEventListener('click', async () => {
            btnAck.disabled = true;
            try { await fetchApi(`/incidentes/${inc.id_incidente}/ack`, { method: 'POST' }); showMessage('ACK!'); loadIncidentesView(); }
            catch (e) { showMessage(e.message, 'error'); btnAck.disabled = false; }
        });

        btnClose.addEventListener('click', async () => {
            const comment = card.querySelector('.comment-input').value.trim();
            if (!comment) { showMessage('Comentário obrigatório.', 'error'); return; }
            btnClose.disabled = true;
            try {
                await fetchApi(`/incidentes/${inc.id_incidente}/close`, { method: 'POST', body: JSON.stringify({ comentario_incidente: comment }) });
                showMessage('Closed!'); loadIncidentesView();
            } catch (e) { showMessage(e.message, 'error'); btnClose.disabled = false; }
        });

        c.appendChild(clone);
    });
}

// --- Regras ---
async function loadRegrasView() {
    ui.regras.tbody.innerHTML = 'Loading...';
    try {
        const regras = await fetchApi('/regras');
        regrasCache = regras;
        renderRegrasTable(regras);
        setupRegrasFilters(); // Reaplica filtros
    } catch (e) { console.error(e); }
}

function renderRegrasTable(list) {
    ui.regras.tbody.innerHTML = '';
    if (list.length === 0) { ui.regras.tbody.innerHTML = '<tr><td colspan="5">Vazio</td></tr>'; return; }

    list.forEach(r => {
        const tr = document.createElement('tr');
        const status = calcularStatusFrontend(r);

        let badgeClass = 'badge-status-ativa';
        if (status === 'Adiada') badgeClass = 'badge-status-adiada';
        if (status === 'Silenciada') badgeClass = 'badge-status-silenciada';

        const actionBtn = status === 'Ativa'
            ? `<button class="action-btn" onclick="openAcaoModal(${r.id_regra})"><img src="./assets/gear.svg"></button>`
            : `<button class="action-btn" onclick="cancelarProgramacao(${r.id_regra})"><img src="./assets/x.svg"></button>`;

        tr.innerHTML = `
            <td>${r.nome}</td>
            <td>${r.intervalo_minutos} min</td>
            <td><span class="badge badge-prio-${r.prioridade}">${formatPrioridade(r.prioridade)}</span></td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
            <td>
                <button class="action-btn" onclick="openRegraModal(${r.id_regra})"><img src="./assets/pencil-simple-line.svg"></button>
                <button class="action-btn" onclick="deleteRegra(${r.id_regra})"><img src="./assets/trash.svg"></button>
                ${actionBtn}
            </td>
        `;
        ui.regras.tbody.appendChild(tr);
    });
}

function calcularStatusFrontend(r) {
    const now = new Date();
    if (r.data_adiar_inicio && now < new Date(r.data_adiar_fim)) return 'Adiada';
    if (r.data_silenciar_inicio && now < new Date(r.data_silenciar_fim)) return 'Silenciada';
    return 'Ativa';
}

function setupRegrasFilters() {
    const term = ui.regras.search.value.toLowerCase();
    const prio = ui.regras.filterPrioridade.value;
    const filtered = regrasCache.filter(r => {
        return r.nome.toLowerCase().includes(term) && (prio ? r.prioridade == prio : true);
    });
    renderRegrasTable(filtered);
}

// --- CRUD Regra ---
// --- CRUD Regra (CORRIGIDO) ---
async function setupRegraForm() {
    // 1. Popula Prioridades (Fixo) - ISSO ESTAVA FALTANDO
    ui.regras.campoPrioridade.innerHTML = `
        <option value="3">Baixa</option>
        <option value="2">Média</option>
        <option value="1">Alta</option>
    `;

    // 2. Verifica se já temos Bancos e Roles em cache
    if(bancosCache.length > 0) return;

    try {
        const [bancos, roles] = await Promise.all([ fetchApi('/bancos'), fetchApi('/roles') ]);
        bancosCache = bancos; 
        rolesCache = roles;
        
        // Popula Bancos
        ui.regras.campoBanco.innerHTML = bancos.map(b => 
            `<option value="${b.id_banco_dados}">${b.tipo_banco}</option>`
        ).join('');
        
        // Popula Roles (Checkboxes)
        ui.regras.rolesContainer.innerHTML = roles.map(r => 
            `<label style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                <input type="checkbox" value="${r.id_role}"> ${r.nome}
             </label>`
        ).join('');

    } catch (e) {
        console.error(e);
        showMessage('Erro ao carregar dados do formulário.', 'error');
    }
}

async function handleRegraSubmit(e) {
    e.preventDefault();
    const idRegra = ui.regras.regraId.value;
    const roles = Array.from(ui.regras.rolesContainer.querySelectorAll('input:checked')).map(c => Number(c.value));

    if (roles.length === 0) { showMessage('Selecione uma Role.', 'error'); return; }

    const payload = {
        id_banco_dados: Number(ui.regras.campoBanco.value),
        nome: ui.regras.campoNome.value,
        consulta_sql: ui.regras.campoSqL.value,
        intervalo_minutos: Number(ui.regras.campoFrequencia.value),
        qnt_erro_max: Number(ui.regras.campoErros.value),
        prioridade: Number(ui.regras.campoPrioridade.value),
        roles: roles,
        descricao: ui.regras.campoDescricao.value,
        janela_inicio: ui.regras.campoJanelaInicio.value || '00:00:00',
        janela_fim: ui.regras.campoJanelaFim.value || '23:59:59',
        data_adiar_inicio: null, data_adiar_fim: null,
        data_silenciar_inicio: null, data_silenciar_fim: null
    };

    try {
        await fetchApi(idRegra ? `/regras/${idRegra}` : `/regras`, {
            method: idRegra ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        closeRegraModal();
        loadRegrasView();
        showMessage('Salvo!', 'success');
    } catch (e) { showMessage(e.message, 'error'); }
}

function closeRegraModal() { ui.regras.crudModal.style.display = 'none'; }

async function handleAcaoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('acao-id-regra').value;
    try {
        await fetchApi(`/regras/${id}/acoes`, {
            method: 'PATCH',
            body: JSON.stringify({
                tipo: document.getElementById('acao-tipo').value,
                inicio: new Date(document.getElementById('acao-inicio').value).toISOString(),
                fim: new Date(document.getElementById('acao-fim').value).toISOString()
            })
        });
        ui.regras.modal.style.display = 'none';
        loadRegrasView();
        showMessage('Ação salva!', 'success');
    } catch (e) { showMessage(e.message, 'error'); }
}

async function handleTestarRegra() {
    try {
        const res = await fetchApi('/regras/testar', {
            method: 'POST',
            body: JSON.stringify({
                id_banco_dados: ui.regras.campoBanco.value,
                consulta_sql: ui.regras.campoSqL.value
            })
        });
        ui.regras.campoResultado.value = JSON.stringify(res.rows, null, 2);
    } catch (e) { ui.regras.campoResultado.value = e.message; }
}

// --- Usuários ---
async function loadUsuariosView() {
    ui.usuarios.tbody.innerHTML = 'Loading...';
    try {
        await setupUsuarioFormCaches();
        const users = await fetchUsuarios();
        renderUsuariosTable(users);
    } catch (e) { console.error(e); }
}

async function fetchUsuarios() {
    const p = new URLSearchParams();
    if (ui.usuarios.filterPerfil.value) p.append('id_perfil', ui.usuarios.filterPerfil.value);
    if (ui.usuarios.search.value) p.append('pesquisa', ui.usuarios.search.value);
    return fetchApi(`/usuarios?${p}`);
}

async function setupUsuarioFormCaches() {
    if (perfisCache.length > 0) return;
    const [p, r, c] = await Promise.all([fetchApi('/perfis'), fetchApi('/recursos'), fetchApi('/tipos_canal_notificacao')]);
    perfisCache = p; recursosCache = r; tiposCanalCache = c;

    ui.usuarios.filterPerfil.innerHTML = '<option value="">Perfil: Todos</option>' +
        p.map(x => `<option value="${x.id_perfil}">${x.nome}</option>`).join('');

    ui.usuarios.campoPerfil.innerHTML = p.map(x => `<option value="${x.id_perfil}">${x.nome}</option>`).join('');
}

function renderUsuariosTable(list) {
    ui.usuarios.tbody.innerHTML = '';
    if (list.length === 0) { ui.usuarios.tbody.innerHTML = '<tr><td>Vazio</td></tr>'; return; }

    list.forEach(u => {
        const pName = perfisCache.find(x => x.id_perfil === u.id_perfil)?.nome || '?';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.nome}</td>
            <td>${u.email}</td>
            <td>${pName}</td>
            <td><span class="badge ${u.ativo ? 'badge-status-ativa' : 'badge-status-silenciada'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <button class="action-btn" onclick="openUsuarioModal(${u.id_usuario})"><img src="./assets/gear.svg"></button>
                <button class="action-btn" onclick="deleteUsuario(${u.id_usuario})"><img src="./assets/trash.svg"></button>
            </td>
        `;
        ui.usuarios.tbody.appendChild(tr);
    });
}

async function handleUsuarioSubmit(e) {
    e.preventDefault();
    const id = ui.usuarios.usuarioId.value;
    if (!id) { showMessage('Use para configurar usuários existentes.', 'error'); return; }

    const recs = Array.from(ui.usuarios.recursosContainer.querySelectorAll('input:checked')).map(c => Number(c.value));
    const notifs = [];

    ui.usuarios.notificacaoContainer.querySelectorAll('input[type="text"]').forEach(inp => {
        if (inp.value) {
            const tid = inp.dataset.tipoCanal;
            const chk = document.getElementById(`enable-${tid}`);
            notifs.push({ id_tipo_canal: tid, endereco_notificacao: inp.value, habilitado: chk ? chk.checked : true });
        }
    });

    try {
        await fetchApi(`/usuarios/${id}/configuracao`, {
            method: 'PUT',
            body: JSON.stringify({
                id_perfil: Number(ui.usuarios.campoPerfil.value),
                ativo: ui.usuarios.campoAtivo.value === 'true',
                recursos: recs,
                notificacoes: notifs
            })
        });
        closeUsuarioModal();
        loadUsuariosView();
        showMessage('Salvo!', 'success');
    } catch (e) { showMessage(e.message, 'error'); }
}

function closeUsuarioModal() { ui.usuarios.modal.style.display = 'none'; }

function renderRecursosCheckboxes(selected) {
    const sIds = new Set(selected.map(r => r.id_recurso));
    ui.usuarios.recursosContainer.innerHTML = recursosCache.map(r =>
        `<label><input type="checkbox" value="${r.id_recurso}" ${sIds.has(r.id_recurso) ? 'checked' : ''}> ${r.nome_amigavel}</label>`
    ).join('');
}

function renderNotificacaoCampos(existentes) {
    ui.usuarios.notificacaoContainer.innerHTML = `<div style="font-weight:bold">Canal</div><div style="font-weight:bold">Ativo</div>`;
    tiposCanalCache.forEach(c => {
        const conf = existentes.find(x => x.id_tipo_canal === c.id_tipo_canal) || {};
        const div = document.createElement('div');
        div.style.display = 'contents'; // Grid trick
        div.innerHTML = `
            <div class="form-group modal-full-width">
                <label style="font-size:11px">${c.nome}</label>
                <input type="text" data-tipo-canal="${c.id_tipo_canal}" value="${conf.endereco_notificacao || ''}" placeholder="...">
            </div>
            <div class="modal-switch" style="justify-content:center">
                <input type="checkbox" id="enable-${c.id_tipo_canal}" ${conf.habilitado !== false ? 'checked' : ''}>
            </div>
        `;
        ui.usuarios.notificacaoContainer.appendChild(div);
    });
}

// Inicia
document.addEventListener('DOMContentLoaded', init);