// public/js/main.js

import { BASE_URL } from './config/config.js';
import { showMessage } from './utils/utils.js';
import { ui } from './views/base.view.js';

// Services
import { initAuth } from './services/auth.service.js';

// Controllers
import { initAuthController } from './controllers/auth.controller.js';
import { initIncidentesController, loadIncidentesView, openDetalheIncidente } from './controllers/incidentes.controller.js';
import { initRegrasController, loadRegrasView } from './controllers/regras.controller.js';
import { initUsuariosController, loadUsuariosView } from './controllers/usuarios.controller.js';
import { initAnalyticsController } from "./controllers/analytics.controller.js"

// --- Navegação (SPA) ---
async function navigateTo(viewName) {
    // Atualiza classes da navbar
    ui.navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
    
    // Alterna visibilidade das views
    ui.views.forEach(v => v.style.display = 'none');
    const active = document.getElementById(`view-${viewName}`);
    if (active) active.style.display = 'block';

    // Carrega dados da view específica
    try {
        if (viewName === 'incidentes') await loadIncidentesView();
        if (viewName === 'regras') await loadRegrasView();
        if (viewName === 'usuarios') await loadUsuariosView();
    } catch (e) { 
        console.error("Erro ao navegar:", e); 
    }
}

// --- WebSocket Setup ---
// Mantido aqui pois conecta eventos globais com controllers específicos
function setupWebSocket() {
    if (typeof io === 'undefined') {
        console.error("Socket.IO não carregado.");
        return;
    }

    const socket = io(BASE_URL);

    socket.on("connect", () => console.log("WebSocket conectado:", socket.id));

    socket.on("dashboard_update", async (data) => {
        console.log("Update recebido:", data);
        showMessage(`${data.mensagem}`, 'info');

        // Se estiver na tela de incidentes, recarrega a lista
        const navIncidentes = document.querySelector('a[data-view="incidentes"]');
        if (navIncidentes && navIncidentes.classList.contains('active')) {
            loadIncidentesView(true); // true = update silencioso
        }

        // Se o modal de detalhes estiver aberto para este incidente, atualiza
        const modal = document.getElementById('modal-detalhes-incidente');
        if (modal && modal.style.display === 'flex' && data.id_incidente) {
            // Verifica se o modal aberto é do incidente atualizado (precisamos pegar o ID do controller ou do DOM)
            // Simplificação: tenta atualizar se estiver visível
            openDetalheIncidente(data.id_incidente).catch(() => {});
        }
    });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Plantão Monitor iniciando...');

    // 1. Inicializa Controllers (Listeners de botões, forms, etc)
    initAuthController();
    initIncidentesController();
    initRegrasController();
    initUsuariosController();
    initAnalyticsController();

    // 2. Configura Navegação
    ui.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.view;
            if (viewName) navigateTo(viewName);
        });
    });

    // 3. Inicializa Auth (Gerencia estado Login/App)
    initAuth((user) => {
        if (user) {
            ui.loginStatus.textContent = 'Autenticado.';
            if (user.displayName && ui.profileButton) {
                const iniciais = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
                ui.profileButton.textContent = iniciais.toUpperCase();
            }
            // Show App
            ui.loginView.style.display = 'none';
            ui.appContainer.style.display = 'block';
            navigateTo('incidentes');
            
            // Inicia WebSocket apenas após login
            setupWebSocket();
        } else {
            // Show Login
            ui.loginView.style.display = 'flex';
            ui.appContainer.style.display = 'none';
        }
    });
});