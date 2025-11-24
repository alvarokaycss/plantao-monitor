// URL base da nossa API (do seu arquivo .js)
const BASE_URL = 'http://localhost:8000';

// (substitui firebaseConfig.js)
// ainda vou botar isso no .env
const firebaseConfig = {
    apiKey: "AIzaSyCtCAJBu_PPTxk-3DEbj1au1yXPVqnZ5kE",
    authDomain: "qq-monitor-auth.firebaseapp.com",
    projectId: "qq-monitor-auth",
    storageBucket: "qq-monitor-auth.firebasestorage.app",
    messagingSenderId: "874647901640",
    appId: "1:874647901640:web:c6c8893e3f615091105cfd"
};

// Variáveis Globais de Autenticação
let auth;
let idToken = null; // Armazena o token Bearer

// Armazena referências para os elementos principais da UI
const ui = {
    // Fluxo de Login
    loginView: document.getElementById('login-view'),
    appContainer: document.getElementById('app-container'),
    loginButton: document.getElementById('login-google-btn'),
    logoutButton: document.getElementById('logout-btn'),
    loginStatus: document.getElementById('login-status'),
    profileButton: document.querySelector('.profile-button'),

    // Elementos da Aplicação
    content: document.getElementById('app-content'),
    navLinks: document.querySelectorAll('.nav-link, .profile-button'),
    views: document.querySelectorAll('.view'),
    messageArea: document.getElementById('message-area'),

    // Elementos da View de Incidentes
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

    // Template
    incidentTemplate: document.getElementById('incident-item-template'),

    regras: {
        view: document.getElementById('view-regras'),
        tbody: document.getElementById('regras-list-body'),
        filterPrioridade: document.getElementById('regras-filter-prioridade'),
        search: document.getElementById('regras-search'),
        modal: document.getElementById('modal-acoes'),
        formAcoes: document.getElementById('form-acoes'),
        btnCancelAcao: document.getElementById('btn-cancel-acao'),
        
        // NOVOS ELEMENTOS PARA CRUD DE REGRAS
        addBtn: document.getElementById('btn-add-regra'),
        crudModal: document.getElementById('modal-regra'),
        crudForm: document.getElementById('form-regra'),
        crudTitle: document.getElementById('modal-regra-title'),
        btnCancelCrud: document.getElementById('btn-cancel-regra'),
        regraId: document.getElementById('regra-id-regra'),
        
        // Campos do Formulário
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
    
    // NOVOS ELEMENTOS PARA VIEW DE USUÁRIOS
    usuarios: {
        view: document.getElementById('view-usuarios'),
        tbody: document.getElementById('usuarios-list-body'),
        filterPerfil: document.getElementById('usuarios-filter-perfil'),
        search: document.getElementById('usuarios-search'),
        addBtn: document.getElementById('btn-add-usuario'),
        
        // Modal de Configuração
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

// Variáveis Globais para Cache de Dados Auxiliares e Filtros
let regrasCache = []; 
let bancosCache = []; 
let rolesCache = []; 
let perfisCache = []; 
let recursosCache = []; 
let tiposCanalCache = [];


// ==============================================
// FUNÇÕES HELPER DA INTERFACE DE USUÁRIO
// ==============================================

/**
 * Converte o ID de prioridade em texto amigável.
 * @param {number | string} p - Prioridade (1, 2, 3)
 * @returns {string} - "Alta", "Média", "Baixa"
 */
function formatPrioridade(p) {
    const prioridadeNum = Number(p);
    if (prioridadeNum === 1) return 'Alta';
    if (prioridadeNum === 2) return 'Média';
    if (prioridadeNum === 3) return 'Baixa';
    return 'N/A';
}

/**
 * Converte o status para o texto no front-end.
 * @param {string} s - Status (ABERTO, RECONHECIDO, FECHADO)
 * @returns {string} - "Aberto", "Reconhecido", "Fechado"
 */
function formatStatus(s) {
    if (s === 'ABERTO') return 'OPEN';
    if (s === 'RECONHECIDO') return 'ACK';
    if (s === 'FECHADO') return 'CLOSE';
    return s;
}

/**
 * Formata uma string de data ISO para o padrão local (dd/mm/aaaa hh:mm)
 * @param {string | null} isoDate - Data em formato ISO
 * @returns {string} - Data formatada ou "--"
 */
function formatData(isoDate) {
    if (!isoDate) return '--';
    try {
        return new Date(isoDate).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '--';
    }
}

/**
 * Formata uma string de data ISO para o padrão local (dd/mm/aaaa)
 * @param {string | null} isoDate - Data em formato ISO
 * @returns {string} - Data formatada ou "--"
 */
function formatDataCurta(isoDate) {
    if (!isoDate) return '--';
    try {
        // Usamos toLocaleDateString que retorna apenas a data
        return new Date(isoDate).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return '--';
    }
}


/**
 * Calcula o tempo relativo (ex: "há 8 min atrás")
 * @param {string} isoDate - Data de abertura
 * @returns {string} - Tempo relativo
 */
function formatRelativeTime(isoDate) {
    if (!isoDate) return 'Pendente há: --';

    try {
        const dataAbertura = new Date(isoDate);
        const agora = new Date();
        const diffMs = agora.getTime() - dataAbertura.getTime();

        const diffMin = Math.round(diffMs / 60000); // Diferença em minutos

        if (diffMin < 1) return 'Pendente há: menos de 1 min';
        if (diffMin === 1) return 'Pendente há: 1 min atrás';
        if (diffMin < 60) return `Pendente há: ${diffMin} min atrás`;

        const diffHoras = Math.floor(diffMin / 60);
        if (diffHoras === 1) return 'Pendente há: 1 hora atrás';
        if (diffHoras < 24) return `Pendente há: ${diffHoras} horas atrás`;

        const diffDias = Math.floor(diffHoras / 24);
        if (diffDias === 1) return 'Pendente há: 1 dia atrás';
        return `Pendente há: ${diffDias} dias atrás`;

    } catch (e) {
        return 'Pendente há: --';
    }
}


// ==============================================
// FUNÇÕES DE AUTENTICAÇÃO (RF01)
// ==============================================

/**
 * Ponto de entrada da aplicação.
 * Executado quando o DOM está pronto.
 */
function init() {
    console.log('Plantão Monitor iniciando...');

    // 1. Inicializa o Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();

    // 2. Configura os ouvintes de navegação (SPA)
    ui.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.view;
            navigateTo(viewName);
        });
    });

    // 3. Configura filtros da tela de incidentes
    ui.incidentes.filterBtn.addEventListener('click', () => {
        loadIncidentesView(); // Recarrega a view com os filtros aplicados
    });
    
    // 3.1 Configura filtros e listeners iniciais da tela de Usuários
    if (ui.usuarios.search) {
        ui.usuarios.search.onkeyup = () => loadUsuariosView();
    }
    if (ui.usuarios.filterPerfil) {
        ui.usuarios.filterPerfil.onchange = () => loadUsuariosView();
    }
    // Listeners do modal de Usuários (adicionados aqui para garantir que existam no DOM)
    ui.usuarios.addBtn.onclick = () => openUsuarioModal('new');
    ui.usuarios.btnCancel.onclick = closeUsuarioModal;
    ui.usuarios.form.onsubmit = handleUsuarioSubmit;

    // Listeners do modal de delete de Usuário
    const btnDelUsuarioFechar = document.getElementById('btn-del-usuario-fechar');
    const btnDelUsuarioConfirmar = document.getElementById('btn-del-usuario-confirmar');
    if (btnDelUsuarioFechar) {
        btnDelUsuarioFechar.onclick = () => {
            document.getElementById('modal-delete-usuario').style.display = 'none';
            window.idUsuarioParaDeletar = null;
        };
    }
    if (btnDelUsuarioConfirmar) {
        btnDelUsuarioConfirmar.onclick = async () => {
            if (!window.idUsuarioParaDeletar) return;
            const idUsuario = window.idUsuarioParaDeletar;
            
            document.getElementById('modal-delete-usuario').style.display = 'none';
            
            try {
                await fetchApi(`/usuarios/${idUsuario}`, {
                    method: 'DELETE'
                });
                
                showMessage('Usuário excluído com sucesso.', 'success');
                await loadUsuariosView();
                
            } catch (error) {
                console.error(error);
                showMessage('Erro ao excluir: ' + error.message, 'error');
            } finally {
                window.idUsuarioParaDeletar = null;
            }
        };
    }


    // 4. Configura botões de Login/Logout
    ui.loginButton.addEventListener('click', handleLogin);
    ui.logoutButton.addEventListener('click', handleLogout);

    // 5. Inicia o listener de autenticação
    setupAuthListener();

    // 6. Configura botões do CRUD de Regras (Já existia)
    ui.regras.addBtn.addEventListener('click', () => openRegraModal('new'));
    ui.regras.btnCancelCrud.addEventListener('click', closeRegraModal);
    ui.regras.crudForm.addEventListener('submit', handleRegraSubmit);
    
    // Configura o Testar Regra (RF17)
    ui.regras.btnTestar.addEventListener('click', handleTestarRegra);
}

/**
 * Função para o RF17: Testa a consulta SQL em modo sandbox.
 */
async function handleTestarRegra() {
    const btn = ui.regras.btnTestar;
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = 'Testando...';
    ui.regras.campoResultado.value = ''; // Limpa o campo de resultado
    
    // 1. Coleta os dados necessários
    const id_banco_dados = ui.regras.campoBanco.value;
    const consulta_sql = ui.regras.campoSqL.value.trim();

    if (!id_banco_dados || !consulta_sql) {
        showMessage('Selecione um Banco de Dados e preencha a Query SQL.', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
    }
    
    // 2. Monta o payload
    const payload = {
        id_banco_dados: Number(id_banco_dados),
        consulta_sql: consulta_sql
    };

    try {
        // 3. Chama o novo endpoint de teste
        const resultado = await fetchApi(`/regras/testar`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // 4. Trata o resultado (SUCESSO)
        let output = `[SUCESSO] Consulta validada. Linhas encontradas: ${resultado.rowCount}\n\n`;
        
        if (resultado.rowCount > 0) {
            output += "Amostra (Primeiras 10 linhas):\n";
            // Formata o header da tabela (nomes das colunas)
            const headers = Object.keys(resultado.rows[0]);
            output += headers.join(' | ') + '\n';
            output += '-'.repeat(headers.join(' | ').length) + '\n';
            
            // Adiciona as linhas (amostra limitada a 10)
            resultado.rows.slice(0, 10).forEach(row => {
                output += headers.map(header => String(row[header])).join(' | ') + '\n';
            });
        } else {
            output += "Nenhum resultado retornado pela consulta.";
        }

        ui.regras.campoResultado.value = output;
        showMessage('Teste de regra executado com sucesso!', 'success');

    } catch (error) {
        // 5. Trata o erro (FALHA SQL ou de API)
        const errorMessage = error.message.replace('Falha na API: Bad Request: ', '');
        ui.regras.campoResultado.value = `[ERRO] Falha na execução da Query:\n${errorMessage}`;
        showMessage('Erro ao testar regra. Verifique a sintaxe da SQL.', 'error');

    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

/**
 * Ouve as mudanças de estado de login (login/logout).
 */
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Usuário está logado
            ui.loginStatus.textContent = 'Autenticado. Verificando permissões...';
            try {
                // 1. Obter o token JWT
                idToken = await user.getIdToken(true); // Força a atualização do token

                // 2. Atualiza a foto de perfil
                if (user.photoURL) {
                    ui.profileButton.innerHTML = `<img src="${user.photoURL}" alt="Perfil" class="profile-image">`;
                } else if (user.displayName) {
                    // Pega as duas primeiras letras do nome
                    const iniciais = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
                    ui.profileButton.textContent = iniciais.toUpperCase();
                }

                // 3. Mostrar a aplicação principal
                showApp();
            } catch (error) {
                // Erro ao obter token (pode acontecer se o usuário foi desabilitado no Firebase)
                console.error("Erro ao obter token:", error);
                showMessage(`Erro ao verificar token: ${error.message}`, 'error');
                showLogin();
            }
        } else {
            // Usuário está deslogado
            idToken = null;
            showLogin();
        }
    });
}

/**
 * Mostra a tela de Login e esconde o App.
 */
function showLogin() {
    ui.loginView.style.display = 'flex';
    ui.appContainer.style.display = 'none';
    ui.loginStatus.textContent = 'Faça Login com Google!';
}

/**
 * Mostra o App e esconde a tela de Login.
 */
function showApp() {
    ui.loginView.style.display = 'none';
    ui.appContainer.style.display = 'block';

    // Carrega a view inicial (incidentes)
    navigateTo('incidentes');
}

/**
 * Inicia o fluxo de login com Google Popup.
 */
function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    ui.loginStatus.textContent = 'Abrindo popup de login...';

    auth.signInWithPopup(provider)
        .catch((error) => {
            // Trata erros de login (ex: popup bloqueado, usuário fechou)
            console.error("Erro de login:", error.code, error.message);
            showMessage(`Erro de login: ${error.message}`, 'error');
            ui.loginStatus.textContent = 'Falha no login.';
        });
}

/**
 * Executa o logout do Firebase.
 */
function handleLogout() {
    auth.signOut();
}

// ========================
// FUNÇÃO DE NAVEGAÇÃO
// ========================

/**
 * Navega para uma "view" específica da SPA.
 * @param {string} viewName - O nome da view (ex: 'incidentes', 'regras')
 */
async function navigateTo(viewName) {
    // 1. Esconde todas as views
    ui.views.forEach(view => view.style.display = 'none');

    // 2. Atualiza o link ativo na navbar
    ui.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewName);
    });

    // 3. Mostra a view correta
    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) {
        activeView.style.display = 'block';
    } else {
        console.error(`View não encontrada: ${viewName}`);
        return;
    }

    // 4. Carrega os dados para a view específica
    try {
        switch (viewName) {
            case 'incidentes':
                await loadIncidentesView();
                break;
            case 'regras':
                await loadRegrasView();
                break;
            case 'usuarios': // NOVO
                await loadUsuariosView();
                break;
            // Outras views (próximas etapas)
        }
    } catch (error) {
        // Não mostra a mensagem de erro se for apenas um erro de token (fetchApi já tratou)
        if (idToken) {
            console.error(`Erro ao carregar a view ${viewName}:`, error);
        }
    }
}


// =============================
// FUNÇÃO CENTRAL DE FETCH 
// ==============================

/**
 * Wrapper para o fetch() que injeta o token de autenticação
 * e trata erros comuns da API.
 * @param {string} url - URL da API (sem o BASE_URL)
 * @param {object} options - Opções do Fetch (method, body, etc)
 * @returns {Promise<any>} - O JSON retornado pela API
 */
async function fetchApi(url, options = {}) {
    if (!idToken) {
        // Se o token sumir, força o logout
        showMessage("Sessão expirada. Por favor, faça login novamente.", "error");
        auth.signOut();
        throw new Error("Token de autenticação expirado ou inválido.");
    }

    // 1. Define os cabeçalhos
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`, // Injeta o token aqui!
        ...options.headers
    };

    // 2. Monta a requisição
    const requestOptions = {
        ...options,
        headers: headers
    };

    // 3. Faz a chamada
    const res = await fetch(`${BASE_URL}${url}`, requestOptions);

    // 4. Trata erros
    if (!res.ok) {
        let errorData = { error: `Erro ${res.status}: ${res.statusText}` };
        try {
            // Tenta ler a mensagem de erro da API (ex: 409 Conflict)
            errorData = await res.json();
        } catch (e) {
            // Ignora se o corpo não for JSON
        }

        // Se o token expirar (401) ou o usuário for inativo (403), força o logout
        if (res.status === 401 || (res.status === 403 && errorData.code === "USER_INACTIVE")) {
            // Mostra o erro específico da API (ex: "Token expirado" ou "Usuário inativo")
            showMessage(errorData.error || "Sessão inválida.", "error");
            auth.signOut(); // Força o logout
        }

        throw new Error(errorData.error || `Falha na API: ${res.statusText}`);
    }

    // 5. Retorna o JSON (ou null se a resposta for 204 No Content)
    if (res.status === 204) {
        return null;
    }
    return await res.json();
}


// ============================
// LÓGICA DA VIEW: INCIDENTES 
// ============================

/**
 * Carrega e renderiza os dados para a view de Incidentes (KPIs + Lista).
 */
async function loadIncidentesView() {
    ui.incidentes.listContainer.innerHTML = '<div class="loading-placeholder card">Carregando...</div>';

    try {
        // Usando fetchApi)
        const [kpiData, incidentesData] = await Promise.all([
            fetchApi('/kpis'),
            fetchIncidentes() // (fetchIncidentes já usa fetchApi)
        ]);

        renderKPIs(kpiData);
        renderIncidentesList(incidentesData);

    } catch (error) {
        // Não mostra a mensagem de erro se for apenas um erro de token (fetchApi já tratou)
        if (idToken) {
            // Mostra o erro no console, não na UI, pra não poluir
            console.error("Erro ao atualizar dashboard:", error.message);
            // showMessage(`Erro ao atualizar dashboard: ${error.message}`, 'error'); por enquanto deixa comentado
        }
        ui.incidentes.listContainer.innerHTML = '<div class="loading-placeholder card">Falha ao carregar incidentes.</div>';
    }
}

/**
 * Busca os KPIs da API (Endpoint: GET /kpis)
 */
async function fetchKPIs() {
    return fetchApi('/kpis');
}

/**
 * Busca os incidentes da API (Endpoint: GET /incidentes)
 */
async function fetchIncidentes() {
    const status = ui.incidentes.filterStatus.value;
    const prioridade = ui.incidentes.filterPrioridade.value;

    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (prioridade) params.append('prioridade', prioridade);

    return fetchApi(`/incidentes?${params.toString()}`);
}

/**
 * Renderiza os dados dos KPIs nos cards.
 * @param {object} data - O objeto retornado da API (/kpis)
 */
function renderKPIs(data) {
    // Preenche o card de plantonista personalizado
    if (data.plantonista_atual) {
        ui.incidentes.kpiPlantonista.textContent = data.plantonista_atual.nome;
        // Preencher inicio e fim
        ui.incidentes.kpiInicio.textContent = `Início: ${formatDataCurta(data.plantonista_atual.data_inicio)}`;
        ui.incidentes.kpiFim.textContent = `Fim: ${formatDataCurta(data.plantonista_atual.data_fim)}`;
    } else {
        ui.incidentes.kpiPlantonista.textContent = 'Nenhum';
        // Limpar inicio e fim
        ui.incidentes.kpiInicio.textContent = 'Início: --';
        ui.incidentes.kpiFim.textContent = 'Fim: --';
    }

    // KPIs Padrão
    ui.incidentes.kpiAbertos.textContent = data.contagens.abertos;
    ui.incidentes.kpiReconhecidos.textContent = data.contagens.reconhecidos;

    // Atenção aqui, talvez tenha um bug de cálculo
    ui.incidentes.kpiMtta.textContent = data.metricas.mtta_minutos;
    ui.incidentes.kpiMttr.textContent = data.metricas.mttr_minutos;
}

/**
 * Renderiza a lista de incidentes usando o <template>.
 * @param {Array} incidentes - O array de incidentes retornado da API
 */
function renderIncidentesList(incidentes) {
    const container = ui.incidentes.listContainer;
    container.innerHTML = ''; // Limpa o "Carregando..."

    if (!incidentes || incidentes.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Nenhum incidente encontrado.</div>';
        return;
    }

    incidentes.forEach(inc => {
        // 1. Clonar o template
        const clone = ui.incidentTemplate.content.cloneNode(true);
        const card = clone.querySelector('.incident-item');
        card.dataset.id = inc.id_incidente; // Armazena o ID no card
        card.classList.add(`status-${inc.status}`); // Adiciona classe para a borda

        // 2. Selecionar elementos internos do clone
        const ruleNameH3 = clone.querySelector('.incident-rule-name');
        const prioritySpan = clone.querySelector('.incident-priority');
        const metaDiv = clone.querySelector('.incident-meta');
        const pendingDiv = clone.querySelector('.incident-pending');

        // 3. Preencher os dados (com helpers de UX)
        // A API envia 'nome_regra' devido ao JOIN no selectIncidentesFiltrados)
        ruleNameH3.textContent = inc.nome_regra || `Regra ID: ${inc.id_regra}`;

        prioritySpan.textContent = formatPrioridade(inc.prioridade_registro);
        prioritySpan.dataset.priority = inc.prioridade_registro;

        // Preencher meta e tempo pendente
        metaDiv.textContent = `${formatStatus(inc.status)} - Criado: ${formatData(inc.data_abertura)}`;
        pendingDiv.textContent = formatRelativeTime(inc.data_abertura);

        // 4. Lógica dos Botões de Ação
        const btnAck = clone.querySelector('.btn-ack');
        const btnClose = clone.querySelector('.btn-close');

        // Habilita/Desabilita botões conforme o status
        if (inc.status === 'ABERTO') {
            btnClose.disabled = true; // Só pode fechar se estiver RECONHECIDO
        } else if (inc.status === 'RECONHECIDO') {
            btnAck.disabled = true; // Já foi reconhecido
        } else if (inc.status === 'FECHADO') {
            btnAck.disabled = true;
            btnClose.disabled = true;
        }

        // 5. Adicionar Ouvintes de Eventos (Listeners)
        addCardListeners(card, inc.id_incidente);

        // 6. Adicionar o card pronto ao container
        container.appendChild(clone);
    });
}

/**
 * Adiciona os listeners de clique para os botões do card.
 * @param {HTMLElement} card - O elemento .incident-item
 * @param {string} incidenteId - O ID do incidente
 */
function addCardListeners(card, incidenteId) {
    const btnAck = card.querySelector('.btn-ack');
    const btnClose = card.querySelector('.btn-close');

    const commentInput = card.querySelector('.comment-input');

    // Listener: Botão ACK (Ação)
    btnAck.addEventListener('click', () => {
        // Comentário do ACK removido, pois a API não salva, checar depois
        console.log(`Ação: Reconhecer (ACK) incidente ${incidenteId}`);

        // Chamando a função da API
        handleAckIncident(incidenteId, btnAck);
    });

    // Listener: Botão Fechar (Ação) Aqui o comentário funciona normal
    btnClose.addEventListener('click', () => {
        const comentario = commentInput.value.trim();

        // Validação de comentário
        if (!comentario) {
            showMessage('O comentário de fechamento é obrigatório.', 'error');
            commentInput.focus();
            return;
        }

        console.log(`Ação: Fechar incidente ${incidenteId} com comentário: ${comentario}`);

        //Chamando a função da API)
        handleCloseIncident(incidenteId, comentario, btnClose);
    });
}


// ========================================
// FUNÇÕES DE AÇÃO (FETCH POST) 
// ========================================

/**
 * Envia a ação de ACK para a API (POST /incidentes/:id/ack)
 * Usa fetchApi
 */
async function handleAckIncident(incidenteId, button) {
    button.disabled = true; // Desabilita o botão
    button.textContent = 'Aguarde...';

    try {
        // Usando fetchApi
        await fetchApi(`/incidentes/${incidenteId}/ack`, {
            method: 'POST'
            // A API (checkAuth) pega o ID do usuário pelo token.
        });

        // Sucesso!
        showMessage('Incidente Reconhecido (ACK).', 'success');

        // Recarrega a view inteira para atualizar os KPIs e a lista
        // O socket.io vai entrar aqui futuramente provavelmente
        await loadIncidentesView();

    } catch (error) {
        console.error("Erro ao dar ACK:", error);
        showMessage(`Erro ao dar ACK: ${error.message}`, 'error');
        button.disabled = false; // Reabilita o botão se falhar
        button.textContent = 'ACK';
    }
}

/**
 * Envia a ação de CLOSE para a API (POST /incidentes/:id/close)
 * Refatorado para usar fetchApi; não envia mais ID no body)
 */
async function handleCloseIncident(incidenteId, comentario, button) {
    button.disabled = true;
    button.textContent = 'Aguarde...';

    // Validação mantida
    if (!comentario) {
        showMessage('O comentário de fechamento é obrigatório.', 'error');
        button.disabled = false;
        button.textContent = 'CLOSE';
        return;
    }

    try {
        // (Usando fetchApi)
        await fetchApi(`/incidentes/${incidenteId}/close`, {
            method: 'POST',
            body: JSON.stringify({
                // O ID do usuário foi removido. A API (checkAuth) pega do token.
                comentario_incidente: comentario // Enviando apenas o comentário
            })
        });

        // Sucesso!
        showMessage('Incidente Fechado.', 'success');

        // Recarrega a view inteira para atualizar os KPIs e a lista
        await loadIncidentesView();

    } catch (error) {
        console.error("Erro ao fechar:", error);
        showMessage(`Erro ao fechar: ${error.message}`, 'error');
        button.disabled = false; // Reabilita o botão se falhar
        button.textContent = 'CLOSE';
    }
}


/**
 * Mostra uma mensagem na área de notificação.
 * @param {string} text - A mensagem
 * @param {'success' | 'error'} type - O tipo de mensagem
 */
function showMessage(text, type = 'success') {
    const div = document.createElement('div');
    div.className = `msg ${type}`; // Define o estilo
    div.textContent = text; // Define o texto

    ui.messageArea.appendChild(div);

    // Remove a mensagem após 4 segundos
    setTimeout(() => {
        div.style.opacity = '0';
        // Remove do DOM após a transição de fade-out
        setTimeout(() => div.remove(), 500);
    }, 4000);
}

// ============================
// LÓGICA DA VIEW: REGRAS (RF05/RF18/RF17)
// ============================

async function loadRegrasView() {
    ui.regras.tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Carregando...</td></tr>';

    try {
        // 1. Busca dados da API
        const regras = await fetchApi('/regras');
        regrasCache = regras; // Salva no cache

        // 2. Renderiza
        renderRegrasTable(regras);

        // 3. Configura Filtros (apenas uma vez seria ideal, mas aqui garante funcionamento)
        setupRegrasFilters();

    } catch (error) {
        console.error("Erro ao carregar regras:", error);
        ui.regras.tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar regras.</td></tr>';
    }
}

function renderRegrasTable(listaRegras) {
    const tbody = ui.regras.tbody;
    tbody.innerHTML = '';

    if (listaRegras.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma regra encontrada.</td></tr>';
        return;
    }

    listaRegras.forEach(regra => {
        const tr = document.createElement('tr');

        const status = calcularStatusFrontend(regra);

        let badgeClass = 'badge-status-ativa';
        if (status === 'Adiada') badgeClass = 'badge-status-adiada';
        if (status === 'Silenciada') badgeClass = 'badge-status-silenciada';

        let actionIconHtml = '';
        if (status === 'Ativa') {
            // Botão Engrenagem (Configurar)
            actionIconHtml = `<button class="action-btn btn-config" title="Programar Ação" onclick="openAcaoModal(${regra.id_regra})"><img src="./gear.svg" alt="Programar"></button>`;
        } else {
            // Botão X (Cancelar Ação)
            actionIconHtml = `<button class="action-btn btn-cancel-schedule" title="Cancelar Programação" onclick="cancelarProgramacao(${regra.id_regra})">
                                <img src="./x.svg" alt="Cancelar" style="width: 16px; height: 16px;">
                              </button>`;
        }

        tr.innerHTML = `
            <td>${regra.nome}</td>
            <td>A cada ${regra.intervalo_minutos} min</td>
            <td style="text-align: left;">
                <span class="badge badge-prio-${regra.prioridade}">${formatPrioridade(regra.prioridade)}</span>
            </td>
            <td style="text-align: left;">
                <span class="badge ${badgeClass}">${status.toLowerCase()}</span>
            </td>
            <td style="text-align: left;">
                <button class="action-btn" title="Editar" onclick="openRegraModal(${regra.id_regra})">
                    <img src="./pencil-simple-line.svg" alt="Editar">
                </button>
                <button class="action-btn" title="Excluir" onclick="deleteRegra(${regra.id_regra})">
                    <img src="./trash.svg" alt="Excluir">
                </button>
                ${actionIconHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Função auxiliar para calcular status no Front (já que a lista completa talvez não traga)
function calcularStatusFrontend(r) {
    const agora = new Date();
    if (r.data_adiar_inicio && r.data_adiar_fim) {
        if (agora >= new Date(r.data_adiar_inicio) && agora <= new Date(r.data_adiar_fim)) return 'Adiada';
    }
    if (r.data_silenciar_inicio && r.data_silenciar_fim) {
        if (agora >= new Date(r.data_silenciar_inicio) && agora <= new Date(r.data_silenciar_fim)) return 'Silenciada';
    }
    return 'Ativa';
}

// Filtros de Regra
function setupRegrasFilters() {
    const filterFunc = () => {
        const termo = ui.regras.search.value.toLowerCase();
        const prio = ui.regras.filterPrioridade.value;

        const filtradas = regrasCache.filter(r => {
            const matchNome = r.nome.toLowerCase().includes(termo);
            const matchPrio = prio ? r.prioridade == prio : true;
            return matchNome && matchPrio;
        });
        renderRegrasTable(filtradas);
    };

    ui.regras.search.onkeyup = filterFunc;
    ui.regras.filterPrioridade.onchange = filterFunc;
}

/**
 * Busca dados auxiliares (Bancos, Roles) e preenche os selects/checkboxes.
 */
async function setupRegraForm() {
    // Se já estiver cacheado, não busca de novo
    if (bancosCache.length > 0 && rolesCache.length > 0) return;

    try {
        const [bancos, roles] = await Promise.all([
            fetchApi('/bancos'),
            fetchApi('/roles')
        ]);

        bancosCache = bancos;
        rolesCache = roles;

        // 1. Popular Bancos (Select)
        const selectBanco = ui.regras.campoBanco;
        selectBanco.innerHTML = '';
        bancos.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id_banco_dados;
            opt.textContent = b.tipo_banco; 
            selectBanco.appendChild(opt);
        });
        
        // 2. Popular Prioridades (Select)
        const selectPrioridade = ui.regras.campoPrioridade;
        selectPrioridade.innerHTML = '';
        [
            {id: 1, nome: 'Alta'}, 
            {id: 2, nome: 'Média'}, 
            {id: 3, nome: 'Baixa'}
        ].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nome;
            selectPrioridade.appendChild(opt);
        });

        // 3. Popular Roles (Checkboxes)
        const rolesContainer = ui.regras.rolesContainer;
        rolesContainer.innerHTML = '';
        roles.forEach(r => {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" name="roles" value="${r.id_role}">
                ${r.nome}
            `;
            rolesContainer.appendChild(label);
        });

    } catch (error) {
        console.error("Erro ao carregar dados do formulário de regras:", error);
        showMessage("Não foi possível carregar Bancos e Roles. Tente recarregar a página.", 'error');
    }
}

// --- Lógica do Modal de Ações (RF18) ---

// Abrir Modal
window.openAcaoModal = (idRegra) => {
    ui.regras.modal.style.display = 'flex';
    document.getElementById('acao-id-regra').value = idRegra;

    // Preenche o modal se a regra já tiver datas de adiar/silenciar
    const regra = regrasCache.find(r => r.id_regra == idRegra);
    if (regra) {
        const acaoTipoSelect = document.getElementById('acao-tipo');
        const acaoInicioInput = document.getElementById('acao-inicio');
        const acaoFimInput = document.getElementById('acao-fim');

        // Normaliza as datas para o formato datetime-local (YYYY-MM-DDTHH:MM)
        const toDatetimeLocal = (isoString) => {
            if (!isoString) return '';
            const date = new Date(isoString);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); // Ajusta fuso horário
            return date.toISOString().slice(0, 16);
        };

        if (regra.data_adiar_inicio && regra.data_adiar_fim) {
            acaoTipoSelect.value = 'adiar';
            acaoInicioInput.value = toDatetimeLocal(regra.data_adiar_inicio);
            acaoFimInput.value = toDatetimeLocal(regra.data_adiar_fim);
        } else if (regra.data_silenciar_inicio && regra.data_silenciar_fim) {
            acaoTipoSelect.value = 'silenciar';
            acaoInicioInput.value = toDatetimeLocal(regra.data_silenciar_inicio);
            acaoFimInput.value = toDatetimeLocal(regra.data_silenciar_fim);
        } else {
            // Se não houver, limpa e define padrão
            acaoTipoSelect.value = 'silenciar';
            acaoInicioInput.value = '';
            acaoFimInput.value = '';
        }
    }
};

// Fechar Modal
ui.regras.btnCancelAcao.onclick = () => {
    ui.regras.modal.style.display = 'none';
};

// Enviar Modal (PATCH na API) // atualizei de put para patch
ui.regras.formAcoes.onsubmit = async (e) => {
    e.preventDefault();

    const idRegra = document.getElementById('acao-id-regra').value;
    const tipo = document.getElementById('acao-tipo').value; // 'adiar' ou 'silenciar'
    const inicio = document.getElementById('acao-inicio').value;
    const fim = document.getElementById('acao-fim').value;

    if (!inicio || !fim) {
        showMessage('Preencha as datas de início e fim.', 'error');
        return;
    }

    try {
        // Agora chamamos a rota específica, enviando apenas o necessário
        await fetchApi(`/regras/${idRegra}/acoes`, {
            method: 'PATCH',
            body: JSON.stringify({
                tipo: tipo,
                inicio: new Date(inicio).toISOString(),
                fim: new Date(fim).toISOString()
            })
        });

        showMessage(`Regra ${tipo === 'adiar' ? 'adiada' : 'silenciada'} com sucesso!`, 'success');
        ui.regras.modal.style.display = 'none';
        loadRegrasView(); // Recarrega a tabela para ver o status mudar e o ícone virar X

    } catch (error) {
        console.error(error);
        showMessage('Erro ao salvar ação: ' + error.message, 'error');
    }
};

// ==========================================
// LÓGICA DO MODAL DE CONFIRMAÇÃO 
// ==========================================

let idRegraPendenteCancelamento = null; // Variável temporária

// 1. Substitui a função antiga de cancelar
window.cancelarProgramacao = (idRegra) => {
    // Guarda o ID para usar depois que o usuário clicar em "Confirmar"
    idRegraPendenteCancelamento = idRegra;

    // Abre o modal customizado
    document.getElementById('modal-confirmacao').style.display = 'flex';
};

// 2. Botão "Cancelar" (O verde do seu print - Fecha o modal e não faz nada)
document.getElementById('btn-conf-fechar').onclick = () => {
    document.getElementById('modal-confirmacao').style.display = 'none';
    idRegraPendenteCancelamento = null; // Limpa a variável
};

// 3. Botão "Confirmar" (O vermelho do seu print - Executa a ação)
document.getElementById('btn-conf-executar').onclick = async () => {
    if (!idRegraPendenteCancelamento) return;

    // Fecha o modal
    document.getElementById('modal-confirmacao').style.display = 'none';

    try {
        // Chama o PATCH com tipo 'cancelar'
        await fetchApi(`/regras/${idRegraPendenteCancelamento}/acoes`, {
            method: 'PATCH',
            body: JSON.stringify({
                tipo: 'cancelar'
            })
        });

        showMessage('Programação cancelada. A regra está ativa novamente.', 'success');
        loadRegrasView(); // Recarrega a tabela

    } catch (error) {
        showMessage('Erro ao cancelar: ' + error.message, 'error');
    } finally {
        idRegraPendenteCancelamento = null;
    }
};

// Função para Excluir Regra (Adicione ao final do script.js)
// ==========================================
// LÓGICA DO MODAL DE DELETAR (CUSTOM)
// ==========================================

let idRegraParaDeletar = null; // Variável temporária para o delete

// 1. Substitui a função window.deleteRegra antiga
window.deleteRegra = (idRegra) => {
    idRegraParaDeletar = idRegra;
    // Abre o modal de delete
    document.getElementById('modal-delete-regra').style.display = 'flex';
};

// 2. Botão Cancelar (Fecha o modal)
document.getElementById('btn-del-fechar').onclick = () => {
    document.getElementById('modal-delete-regra').style.display = 'none';
    idRegraParaDeletar = null;
};

// 3. Botão Confirmar (Executa a API)
document.getElementById('btn-del-confirmar').onclick = async () => {
    if (!idRegraParaDeletar) return;

    // Fecha o modal visualmente antes de processar
    document.getElementById('modal-delete-regra').style.display = 'none';

    try {
        await fetchApi(`/regras/${idRegraParaDeletar}`, {
            method: 'DELETE'
        });

        showMessage('Regra excluída com sucesso.', 'success');
        loadRegrasView(); // Atualiza a tabela

    } catch (error) {
        console.error(error);
        // Se for erro de chave estrangeira (tem incidentes vinculados)
        showMessage('Erro ao excluir: ' + error.message, 'error');
    } finally {
        idRegraParaDeletar = null;
    }
};

/**
 * Abre o modal de criação/edição de regra.
 * @param {'new' | number} modeOrId - 'new' para criação ou o ID da regra para edição.
 */
window.openRegraModal = async (modeOrId) => {
    // 1. Garantir que os dados auxiliares estão carregados
    await setupRegraForm();
    
    // 2. Limpar o formulário e campos
    ui.regras.crudForm.reset();
    ui.regras.regraId.value = '';
    ui.regras.campoResultado.value = ''; // Limpa resultado do teste
    
    const isEditing = modeOrId !== 'new';
    
    // 3. Desmarca todos os checkboxes antes de preencher
    ui.regras.rolesContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false);

    if (isEditing) {
        // Modo Edição
        const idRegra = Number(modeOrId);
        ui.regras.crudTitle.textContent = 'Editar regra existente';
        ui.regras.regraId.value = idRegra;
        
        try {
            // Busca os detalhes para preencher o formulário
            const regraDetalhes = await fetchApi(`/regras/${idRegra}/detalhes`);
            
            // Preenche os campos principais
            ui.regras.campoNome.value = regraDetalhes.info.nome || '';
            ui.regras.campoDescricao.value = regraDetalhes.info.descricao || '';
            ui.regras.campoFrequencia.value = regraDetalhes.info.intervalo_minutos || 5;
            ui.regras.campoErros.value = regraDetalhes.info.qnt_erro_max || 1;
            ui.regras.campoJanelaInicio.value = regraDetalhes.info.janela_inicio ? regraDetalhes.info.janela_inicio.substring(0, 5) : '09:00';
            ui.regras.campoJanelaFim.value = regraDetalhes.info.janela_fim ? regraDetalhes.info.janela_fim.substring(0, 5) : '18:00';
            ui.regras.campoPrioridade.value = regraDetalhes.info.prioridade || 3;
            ui.regras.campoBanco.value = regraDetalhes.info.id_banco_dados || '';
            ui.regras.campoSqL.value = regraDetalhes.info.consulta_sql || '';
            
            
            // Lógica de pré-seleção dos Checkboxes:
            const regraDaLista = regrasCache.find(r => r.id_regra == idRegra);
            if(regraDaLista && regraDaLista.roles_id && Array.isArray(regraDaLista.roles_id)) {
                
                const selectedRoleIds = regraDaLista.roles_id.map(String); // Converte para string para comparação
                
                ui.regras.rolesContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                    // Verifica se o valor do checkbox está na lista de roles_id da regra
                    if (selectedRoleIds.includes(chk.value)) {
                        chk.checked = true;
                    }
                });
            }


        } catch (error) {
            console.error("Erro ao carregar regra para edição:", error);
            showMessage('Erro ao carregar detalhes da regra: ' + error.message, 'error');
            return;
        }

    } else {
        // Modo Criação
        ui.regras.crudTitle.textContent = 'Adicionar nova regra';
        // Define defaults (para bancos e prioridade, se houver)
        ui.regras.campoPrioridade.value = 3; // Baixa por padrão
        // Deixa o primeiro banco selecionado
        if (bancosCache.length > 0) ui.regras.campoBanco.value = bancosCache[0].id_banco_dados; 
        
    }

    ui.regras.crudModal.style.display = 'flex';
};

/**
 * Fecha o modal de regra.
 */
function closeRegraModal() {
    ui.regras.crudModal.style.display = 'none';
    ui.regras.crudForm.reset();
}

/**
 * Lida com o envio do formulário (POST ou PUT).
 */
async function handleRegraSubmit(e) {
    e.preventDefault();
    
    // Desabilita o botão Salvar
    const submitBtn = ui.regras.crudForm.querySelector('.btn-salvar-regra');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    // 1. Coleta e formata os dados
    const idRegra = ui.regras.regraId.value;
    const isEditing = idRegra > 0;
    
    // Array de IDs de roles selecionadas (lendo checkboxes)
    const selectedRoles = Array.from(ui.regras.rolesContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(chk => Number(chk.value));
        
    if (selectedRoles.length === 0) {
        showMessage('Selecione pelo menos uma Role para a regra.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar';
        return;
    }

    const payload = {
        id_banco_dados: Number(ui.regras.campoBanco.value),
        nome: ui.regras.campoNome.value,
        consulta_sql: ui.regras.campoSqL.value,
        intervalo_minutos: Number(ui.regras.campoFrequencia.value),
        qnt_erro_max: Number(ui.regras.campoErros.value),
        prioridade: Number(ui.regras.campoPrioridade.value),
        roles: selectedRoles, // Array de IDs de roles
        descricao: ui.regras.campoDescricao.value || null,
        janela_inicio: ui.regras.campoJanelaInicio.value || '00:00:00',
        janela_fim: ui.regras.campoJanelaFim.value || '23:59:59',
        // O modal de ações cuida das datas de adiar/silenciar
        data_adiar_inicio: null, 
        data_adiar_fim: null,
        data_silenciar_inicio: null,
        data_silenciar_fim: null,
    };
    
    try {
        if (isEditing) {
            // Edição: PUT
            await fetchApi(`/regras/${idRegra}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showMessage('Regra atualizada com sucesso!', 'success');
        } else {
            // Criação: POST
            await fetchApi(`/regras`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showMessage('Regra cadastrada com sucesso!', 'success');
        }

        closeRegraModal();
        await loadRegrasView(); // Recarrega a lista para mostrar a nova/editada regra

    } catch (error) {
        console.error("Erro ao salvar regra:", error);
        showMessage(`Erro ao salvar regra: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar';
    }
}

// ============================
// LÓGICA DA VIEW: USUÁRIOS (RF03/RF02/RF04)
// ============================

/**
 * Carrega a lista de usuários e dados auxiliares (perfis, recursos, canais).
 */
async function loadUsuariosView() {
    ui.usuarios.tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Carregando...</td></tr>';

    try {
        // 1. Busca dados auxiliares
        await setupUsuarioFormCaches();

        // 2. Busca lista de usuários
        const data = await fetchUsuarios();
        renderUsuariosTable(data);
        
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        ui.usuarios.tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar lista de usuários.</td></tr>';
    }
}

/**
 * Busca a lista de usuários com filtros.
 */
async function fetchUsuarios() {
    const id_perfil = ui.usuarios.filterPerfil.value;
    const pesquisa = ui.usuarios.search.value;

    const params = new URLSearchParams();
    if (id_perfil) params.append('id_perfil', id_perfil);
    if (pesquisa) params.append('pesquisa', pesquisa);

    return fetchApi(`/usuarios?${params.toString()}`);
}

/**
 * Popula caches de dados auxiliares (Perfis, Recursos, Tipos de Canal).
 */
async function setupUsuarioFormCaches() {
    // Se já tiver todos os caches, retorna
    if (perfisCache.length > 0 && recursosCache.length > 0 && tiposCanalCache.length > 0) return;

    try {
        const [perfis, recursos, tiposCanal] = await Promise.all([
            fetchApi('/perfis'),
            fetchApi('/recursos'),
            fetchApi('/tipos_canal_notificacao')
        ]);
        
        perfisCache = perfis;
        recursosCache = recursos;
        tiposCanalCache = tiposCanal;
        
        // Popula o filtro de perfis (Dropdown)
        const selectFilter = ui.usuarios.filterPerfil;
        selectFilter.innerHTML = '<option value="">Perfil: Todos</option>';
        perfis.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_perfil;
            opt.textContent = p.nome;
            selectFilter.appendChild(opt);
        });

    } catch (e) {
        console.error("Falha ao carregar caches de Usuários:", e);
        showMessage('Falha ao carregar dados de Perfil/Recursos.', 'error');
        throw e;
    }
}


/**
 * Renderiza a tabela de usuários.
 */
function renderUsuariosTable(listaUsuarios) {
    const tbody = ui.usuarios.tbody;
    tbody.innerHTML = '';
    
    if (listaUsuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    listaUsuarios.forEach(user => {
        const tr = document.createElement('tr');
        // Busca o nome do perfil no cache
        const perfil = perfisCache.find(p => p.id_perfil === user.id_perfil);
        const perfilNome = perfil ? perfil.nome : 'N/A';
        const statusText = user.ativo ? 'Ativo' : 'Inativo';
        const statusClass = user.ativo ? 'badge-status-ativa' : 'badge-status-silenciada';
        
        tr.innerHTML = `
            <td>${user.nome || '--'}</td>
            <td>${user.email || '--'}</td>
            <td>${perfilNome}</td>
            <td style="text-align: left;">
                <span class="badge ${statusClass}">${statusText}</span>
            </td>
            <td style="text-align: left;">
                <button class="action-btn" title="Configurar" onclick="openUsuarioModal(${user.id_usuario})">
                    <img src="./gear.svg" alt="Configurar">
                </button>
                <button class="action-btn" title="Excluir" onclick="deleteUsuario(${user.id_usuario})">
                    <img src="./trash.svg" alt="Excluir">
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Abre o modal de edição/configuração de usuário.
 */
window.openUsuarioModal = async (modeOrId) => {
    // 1. Limpar formulário e containers
    ui.usuarios.form.reset();
    ui.usuarios.recursosContainer.innerHTML = '';
    ui.usuarios.notificacaoContainer.innerHTML = '';
    ui.usuarios.usuarioId.value = '';
    
    const isEditing = modeOrId !== 'new';
    
    // 2. Popular dropdowns auxiliares (Perfis)
    const selectPerfil = ui.usuarios.campoPerfil;
    selectPerfil.innerHTML = '';
    perfisCache.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id_perfil;
        opt.textContent = p.nome;
        selectPerfil.appendChild(opt);
    });

    if (isEditing) {
        const idUsuario = Number(modeOrId);
        ui.usuarios.title.textContent = 'Configurar Usuário Existente';
        
        try {
            // Busca detalhes do usuário (inclui recursos e notificações)
            const data = await fetchApi(`/usuarios/${idUsuario}/detalhes`);
            const info = data.info;
            
            // Verifica se a API retornou o ID do usuário no perfil
            const userProfile = await fetchApi('/usuarios/eu/detalhes');
            if (userProfile.info.id_usuario === idUsuario) {
                 showMessage('Atenção: Você está editando o seu próprio perfil. Tenha cautela com as permissões.', 'warning');
            }


            ui.usuarios.usuarioId.value = idUsuario;
            ui.usuarios.infoEmail.textContent = `Usuário: ${info.nome} (${info.email})`;
            ui.usuarios.campoPerfil.value = info.id_perfil;
            ui.usuarios.campoAtivo.value = info.ativo ? 'true' : 'false';
            
            // 3. Popular e pré-selecionar Recursos
            // data.recursos AGORA VEM DO SERVICE E CONTÉM id_recurso.
            renderRecursosCheckboxes(data.recursos || []);

            // 4. Popular e pré-selecionar Notificações (Simples)
            renderNotificacaoCampos(data.configuracoes || []);

        } catch (error) {
            console.error("Erro ao carregar usuário:", error);
            showMessage('Erro ao carregar detalhes do usuário: ' + error.message, 'error');
            return;
        }

    } else {
        ui.usuarios.title.textContent = 'Adicionar Novo Usuário';
        ui.usuarios.infoEmail.textContent = 'O usuário será provisionado após o primeiro login com Google.';
        ui.usuarios.campoAtivo.value = 'true';
        
        // 3. Popular e desmarcar Recursos (todos desmarcados por padrão)
        renderRecursosCheckboxes([]); 

        // 4. Renderizar um campo vazio para cada tipo de canal (simplificado)
        renderNotificacaoCampos([]);
        
        showMessage('A criação de novos usuários via este modal é apenas para pré-configuração de perfil e permissões.', 'info');
    }

    ui.usuarios.modal.style.display = 'flex';
};

/**
 * Fecha o modal de usuário.
 */
function closeUsuarioModal() {
    ui.usuarios.modal.style.display = 'none';
    ui.usuarios.form.reset();
}

/**
 * Renderiza os checkboxes de Recursos.
 */
/**
 * Renderiza os checkboxes de Recursos.
 */
function renderRecursosCheckboxes(recursosSelecionados) {
    const container = ui.usuarios.recursosContainer;
    container.innerHTML = '';
    
    // Converte os recursos selecionados em um Set de IDs para checagem rápida
    // O backend agora retorna objetos com id_recurso, então usamos ele.
    const selectedIds = new Set(recursosSelecionados.map(r => r.id_recurso)); 

    recursosCache.forEach(recurso => {
        // BUSCANDO O NOME DO RECURSO NO CACHE, POIS A API DE DETALHES RETORNA APENAS O ID
        const nomeRecurso = recurso.nome_amigavel || `Recurso ID ${recurso.id_recurso}`; 
        
        const label = document.createElement('label');
        const isChecked = selectedIds.has(recurso.id_recurso);
        
        label.innerHTML = `
            <input type="checkbox" name="recursos" value="${recurso.id_recurso}" ${isChecked ? 'checked' : ''}>
            ${nomeRecurso}
        `;
        container.appendChild(label);
    });
}
/**
 * Renderiza os campos de configuração de notificação.
 */
function renderNotificacaoCampos(configuracoesExistentes) {
    const container = ui.usuarios.notificacaoContainer;
    container.innerHTML = ''; 

    // Header
    const headerHtml = `<div style="font-weight: bold; margin-bottom: 5px;">Canal/Endereço</div><div style="font-weight: bold; margin-bottom: 5px;">Habilitado</div>`;
    container.innerHTML += headerHtml;

    tiposCanalCache.forEach(canal => {
        const config = configuracoesExistentes.find(c => c.id_tipo_canal === canal.id_tipo_canal) || {};

        // 1. Campo de Endereço (Input/Label)
        const inputContainer = document.createElement('div');
        inputContainer.className = 'form-group modal-full-width';
        inputContainer.innerHTML = `
            <label for="canal-${canal.id_tipo_canal}" style="font-size: 11px;">${canal.nome} Endereço</label>
            <input type="text" id="canal-${canal.id_tipo_canal}" 
                placeholder="${canal.nome === 'Email' ? 'exemplo@empresa.com' : 'Webhook/Token...'}"
                value="${config.endereco_notificacao || ''}"
                data-tipo-canal="${canal.id_tipo_canal}"
                data-nome-canal="${canal.nome}">
        `;
        
        // 2. Campo de Habilitado (Checkbox Simples)
        const checkContainer = document.createElement('div');
        checkContainer.className = 'modal-switch';
        const isHabilitado = config.habilitado !== undefined ? config.habilitado : true; // Default true
        
        checkContainer.innerHTML = `
            <label for="enable-${canal.id_tipo_canal}" style="margin: 0; font-weight: 400;">
                <input type="checkbox" id="enable-${canal.id_tipo_canal}" 
                    data-tipo-canal-toggle="${canal.id_tipo_canal}"
                    ${isHabilitado ? 'checked' : ''}>
                Habilitar
            </label>
        `;

        // Coloca na Grid
        container.appendChild(inputContainer);
        container.appendChild(checkContainer);
    });
}


/**
 * Lida com o envio do formulário de configuração do usuário (PUT).
 */
async function handleUsuarioSubmit(e) {
    e.preventDefault();
    
    const submitBtn = ui.usuarios.form.querySelector('.btn-salvar-usuario');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando...';

    const idUsuario = ui.usuarios.usuarioId.value;
    const isEditing = idUsuario > 0;
    
    if (!isEditing) {
         showMessage('Ação "Adicionar Novo Usuário" não está completa. Use o modal apenas para configurar usuários existentes.', 'error');
         submitBtn.disabled = false;
         submitBtn.textContent = 'Salvar Configurações';
         return;
    }

    // 1. Coleta Recursos (Toggles)
    const recursosSelecionados = Array.from(ui.usuarios.recursosContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(chk => Number(chk.value));

    // 2. Coleta Notificações (Endereço + Habilitado)
    const notificacoesColetadas = [];
    ui.usuarios.notificacaoContainer.querySelectorAll('input[type="text"]').forEach(input => {
        const idTipoCanal = Number(input.dataset.tipoCanal);
        const toggle = ui.usuarios.notificacaoContainer.querySelector(`#enable-${idTipoCanal}`);
        
        if (input.value.trim()) {
            notificacoesColetadas.push({
                id_tipo_canal: idTipoCanal,
                endereco_notificacao: input.value.trim(),
                habilitado: toggle ? toggle.checked : true // Se o toggle não existe, assume ativo
            });
        }
    });

    const payload = {
        id_perfil: Number(ui.usuarios.campoPerfil.value),
        ativo: ui.usuarios.campoAtivo.value === 'true',
        recursos: recursosSelecionados,
        notificacoes: notificacoesColetadas
    };
    
    try {
        await fetchApi(`/usuarios/${idUsuario}/configuracao`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        
        showMessage('Configurações de usuário atualizadas com sucesso!', 'success');
        closeUsuarioModal();
        await loadUsuariosView(); // Recarrega a lista

    } catch (error) {
        console.error("Erro ao salvar configurações:", error);
        showMessage(`Erro ao salvar configurações: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Configurações';
    }
}

// ==========================================
// LÓGICA DO MODAL DE DELETAR USUÁRIO
// ==========================================

let idUsuarioParaDeletar = null; // Variável temporária para o delete

// Variável global para armazenar o ID do usuário a ser deletado
window.idUsuarioParaDeletar = null;
// 1. Função para abrir o modal de delete
window.deleteUsuario = (idUsuario) => {
    idUsuarioParaDeletar = idUsuario;
    // Abre o modal de delete
    window.idUsuarioParaDeletar = idUsuario;
    document.getElementById('modal-delete-usuario').style.display = 'flex';
};

// 2. Botão Cancelar (Fecha o modal)
document.getElementById('btn-del-usuario-fechar').onclick = () => {
    document.getElementById('modal-delete-usuario').style.display = 'none';
    idUsuarioParaDeletar = null;
};

// 3. Botão Confirmar (Executa a API)
document.getElementById('btn-del-usuario-confirmar').onclick = async () => {
    if (!idUsuarioParaDeletar) return;

    // Fecha o modal visualmente antes de processar
    document.getElementById('modal-delete-usuario').style.display = 'none';

    try {
        await fetchApi(`/usuarios/${idUsuarioParaDeletar}`, {
            method: 'DELETE'
        });

        showMessage('Usuário excluído com sucesso.', 'success');
        loadUsuariosView(); // Atualiza a tabela

    } catch (error) {
        console.error(error);
        // Se for erro de chave estrangeira (tem registros vinculados) ou outro erro
        showMessage('Erro ao excluir: ' + error.message, 'error');
    } finally {
        idUsuarioParaDeletar = null;
    }
};


// Inicia a aplicação
document.addEventListener('DOMContentLoaded', init);