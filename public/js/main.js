// public/js/main.js

import { BASE_URL } from './config/config.js';
import { showMessage } from './utils/utils.js';
import { ui } from './views/base.view.js';

// Services
import { initAuth, logout } from './services/auth.service.js';
import { fetchApi } from './services/api.service.js';

// Controllers
import { initAuthController } from './controllers/auth.controller.js';
import { initIncidentesController, loadIncidentesView, openDetalheIncidente } from './controllers/incidentes.controller.js';
import { initRegrasController, loadRegrasView } from './controllers/regras.controller.js';
import { initUsuariosController, loadUsuariosView } from './controllers/usuarios.controller.js';
import { initAnalyticsController } from "./controllers/analytics.controller.js";

// --- CONFIGURAÇÃO DE PERMISSÕES ---
// Mapeia o nome da view (data-view) para a chave do recurso exigido no banco
const VIEW_PERMISSIONS = {
    'incidentes': null,       // Acesso livre (apenas login)
    'perfil': null,           // Acesso livre
    'regras': 'TELA_REGRAS',
    'escalas': 'TELA_ESCALAS',
    'usuarios': 'TELA_USUARIOS'
};

// Armazena os recursos do usuário logado
let currentUserResources = [];

// --- Navegação (SPA) com Bloqueio ---
async function navigateTo(viewName) {
    // 1. Verifica Permissão antes de navegar
    const requiredResource = VIEW_PERMISSIONS[viewName];
    
    // Se a tela exige um recurso E o usuário NÃO tem esse recurso na lista...
    if (requiredResource && !currentUserResources.includes(requiredResource)) {
        showMessage(`Acesso negado: Você não tem permissão para acessar ${viewName}.`, 'error');
        return; // Bloqueia a navegação
    }

    // 2. Atualiza Navbar (Visual ativo)
    ui.navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
    
    // 3. Troca a View (Display block/none)
    ui.views.forEach(v => v.style.display = 'none');
    const active = document.getElementById(`view-${viewName}`);
    if (active) active.style.display = 'block';

    // 4. Carrega Dados Específicos da View
    try {
        if (viewName === 'incidentes') await loadIncidentesView();
        if (viewName === 'regras') await loadRegrasView();
        if (viewName === 'usuarios') await loadUsuariosView();
        // Adicione aqui para escalas futuramente
    } catch (e) { 
        console.error("Erro ao navegar:", e); 
    }
}

// --- Função para Atualizar a Navbar (Esconder Links) ---
function updateNavbarVisibility() {
    ui.navLinks.forEach(link => {
        const view = link.dataset.view;
        // Se não tem data-view (ex: botão perfil ou logout), ignora
        if (!view) return;

        const requiredResource = VIEW_PERMISSIONS[view];

        // Se exige recurso e usuário não tem -> Esconde (display: none)
        if (requiredResource && !currentUserResources.includes(requiredResource)) {
            link.style.display = 'none';
        } else {
            link.style.display = ''; // Reseta para o padrão (block/inline)
        }
    });
}

// --- WebSocket Setup ---

let globalSocket = null;

function setupWebSocket() {
    if (typeof io === 'undefined') return;
    
    // Evitar duplicação de mensagens
    if (globalSocket) return;

    globalSocket = io(BASE_URL);
    globalSocket.on("connect", () => console.log("WebSocket conectado:", globalSocket.id));
    
    globalSocket.on("dashboard_update", async (data) => {
        console.log("Update recebido:", data);
        showMessage(`${data.mensagem}`, 'info');

        // Se estiver na tela de incidentes, recarrega a lista silenciosamente
        const navIncidentes = document.querySelector('a[data-view="incidentes"]');
        if (navIncidentes && navIncidentes.classList.contains('active')) {
            loadIncidentesView(true); // true = update silencioso
        }

        // Se o modal de detalhes estiver aberto para este incidente, atualiza
        const modal = document.getElementById('modal-detalhes-incidente');
        if (modal && modal.style.display === 'flex' && data.id_incidente) {
            openDetalheIncidente(data.id_incidente).catch(() => {});
        }
    });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Plantão Monitor iniciando...');

    // 1. Inicializa Controllers
    initAuthController();
    initIncidentesController();
    initRegrasController();
    initUsuariosController();
    initAnalyticsController();

    // 2. Configura Listener de Navegação
    ui.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.view;
            if (viewName) navigateTo(viewName);
        });
    });

    // 3. Inicializa Auth (Gerencia estado Login/App)
    initAuth(async (user) => {
        if (user) {
            ui.loginStatus.textContent = 'Verificando permissões...';
            
            try {
                // Tenta buscar detalhes do usuário E suas permissões (recursos)
                // Esta rota é acessível a todos (R_NENHUM)
                const userDetails = await fetchApi('/usuarios/eu/detalhes');
                
                // Processa a lista de recursos
                if (userDetails.recursos) {
                    // Transforma objetos {chave_recurso: '...'} em array de strings
                    currentUserResources = userDetails.recursos.map(r => r.chave_recurso);
                } else {
                    currentUserResources = [];
                }

                // === LOGIN SUCESSO: Usuário Ativo e Validado ===
                ui.loginStatus.textContent = 'Autenticado.';
                if (user.displayName && ui.profileButton) {
                    const iniciais = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
                    ui.profileButton.textContent = iniciais.toUpperCase();
                }
                
                // Aplica as permissões na Navbar (esconde o que não pode ver)
                updateNavbarVisibility();

                // Libera acesso ao App
                ui.loginView.style.display = 'none';
                ui.appContainer.style.display = 'block';
                
                // Redireciona para Incidentes (view padrão segura)
                navigateTo('incidentes');
                
                // Inicia WebSocket
                setupWebSocket();

            } catch (error) {
                // === TRATAMENTO DE ERROS DE NEGÓCIO (Fluxo Seguro) ===
                
                // CASO A: Usuário não existe no banco -> Faz Auto-Cadastro
                if (error.code === 'USER_NOT_FOUND_IN_DB') {
                    ui.loginStatus.textContent = 'Finalizando configuração da conta...';
                    
                    try {
                        const token = await user.getIdToken();
                        // Chama rota pública de registro que criamos
                        await fetchApi('/usuarios/register', { 
                            method: 'POST', 
                            body: JSON.stringify({ idToken: token }) 
                        });

                        ui.loginStatus.textContent = 'Cadastro enviado! Aguarde aprovação do administrador.';
                        ui.loginStatus.className = 'login-status-text msg success';
                        
                        // Logout forçado para impedir acesso parcial
                        setTimeout(() => logout(), 4000);

                    } catch (regError) {
                        ui.loginStatus.textContent = 'Erro no auto-cadastro: ' + regError.message;
                        ui.loginStatus.className = 'login-status-text msg error';
                        setTimeout(() => logout(), 4000);
                    }
                } 
                // CASO B: Usuário existe mas está INATIVO
                else if (error.code === 'USER_INACTIVE') {
                    ui.loginStatus.textContent = 'Sua conta aguarda aprovação de um administrador.';
                    ui.loginStatus.className = 'login-status-text msg info';
                    setTimeout(() => logout(), 4000);
                } 
                // CASO C: Outros erros (Servidor fora, Rede)
                else {
                    console.error("Erro de login:", error);
                    ui.loginStatus.textContent = 'Erro ao conectar ao servidor: ' + error.message;
                    ui.loginStatus.className = 'login-status-text msg error';
                    setTimeout(() => logout(), 4000);
                }
                
                // Garante que fique na tela de login se deu erro
                ui.loginView.style.display = 'flex';
                ui.appContainer.style.display = 'none';
            }

        } else {
            // Não logado (Logout ou Inicial)
            ui.loginView.style.display = 'flex';
            ui.appContainer.style.display = 'none';
            currentUserResources = []; // Limpa permissões
            
            if(!ui.loginStatus.classList.contains('msg')) {
                 ui.loginStatus.textContent = 'Aguardando credenciais...';
            }
        }
    });
});