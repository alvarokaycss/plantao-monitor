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
import { initAnalyticsController } from "./controllers/analytics.controller.js"

// --- Navegação (SPA) ---
async function navigateTo(viewName) {
    ui.navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
    ui.views.forEach(v => v.style.display = 'none');
    const active = document.getElementById(`view-${viewName}`);
    if (active) active.style.display = 'block';

    try {
        if (viewName === 'incidentes') await loadIncidentesView();
        if (viewName === 'regras') await loadRegrasView();
        if (viewName === 'usuarios') await loadUsuariosView();
    } catch (e) { 
        console.error("Erro ao navegar:", e); 
    }
}

// --- WebSocket Setup ---
function setupWebSocket() {
    if (typeof io === 'undefined') return;
    // Conexão persistente entre navegador e servidor
    const socket = io(BASE_URL);
    socket.on("connect", () => console.log("WebSocket conectado:", socket.id));
    // Listener de atualização do dashboard
    socket.on("dashboard_update", async (data) => {
        showMessage(`${data.mensagem}`, 'info');
        const navIncidentes = document.querySelector('a[data-view="incidentes"]');
        if (navIncidentes && navIncidentes.classList.contains('active')) {
            loadIncidentesView(true);
        }
        const modal = document.getElementById('modal-detalhes-incidente');
        if (modal && modal.style.display === 'flex' && data.id_incidente) {
            openDetalheIncidente(data.id_incidente).catch(() => {});
        }
    });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Plantão Monitor iniciando...');

    initAuthController();
    initIncidentesController();
    initRegrasController();
    initUsuariosController();
    initAnalyticsController();

    ui.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = link.dataset.view;
            if (viewName) navigateTo(viewName);
        });
    });

    // 3. Inicializa Auth com Fluxo de Verificação de Cadastro
    initAuth(async (user) => {
        if (user) {
            ui.loginStatus.textContent = 'Verificando cadastro...';
            
            try {
                // Tenta acessar uma rota protegida para verificar se o usuário existe e está ativo no Postgres
                await fetchApi('/usuarios/eu/detalhes');

                // === SUCESSO: Usuário existe e está ativo ===
                ui.loginStatus.textContent = 'Autenticado.';
                if (user.displayName && ui.profileButton) {
                    const iniciais = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
                    ui.profileButton.textContent = iniciais.toUpperCase();
                }
                
                // Libera acesso à plataforma
                ui.loginView.style.display = 'none';
                ui.appContainer.style.display = 'block';
                navigateTo('incidentes');
                setupWebSocket();

            } catch (error) {
                // === FLUXO DE ERRO DE NEGÓCIO ===
                
                // CASO A: Usuário não existe no Postgres -> Auto-Cadastro
                if (error.code === 'USER_NOT_FOUND_IN_DB') {
                    ui.loginStatus.textContent = 'Finalizando configuração da conta...';
                    
                    try {
                        const token = await user.getIdToken();
                        // Chama rota pública de registro
                        await fetchApi('/usuarios/register', { 
                            method: 'POST', 
                            body: JSON.stringify({ idToken: token }) 
                        });

                        // Feedback e Logout
                        ui.loginStatus.textContent = 'Cadastro enviado com sucesso! Aguarde a aprovação do administrador para acessar.';
                        ui.loginStatus.className = 'login-status-text msg success';
                        
                        // Força logout do Firebase para impedir acesso "logado porém sem permissão" e limpar estado
                        setTimeout(() => logout(), 3000);

                    } catch (regError) {
                        ui.loginStatus.textContent = 'Erro no auto-cadastro: ' + regError.message;
                        ui.loginStatus.className = 'login-status-text msg error';
                        setTimeout(() => logout(), 3000);
                    }
                } 
                // CASO B: Usuário existe, mas está inativo (Pendente)
                else if (error.code === 'USER_INACTIVE') {
                    ui.loginStatus.textContent = 'Sua conta aguarda aprovação de um administrador.';
                    ui.loginStatus.className = 'login-status-text msg info';
                    // Mantém na tela de login
                    setTimeout(() => logout(), 4000);
                } 
                // CASO C: Outro erro (Rede, Servidor)
                else {
                    console.error("Erro de verificação de login:", error);
                    ui.loginStatus.textContent = 'Erro ao conectar ao servidor: ' + error.message;
                    ui.loginStatus.className = 'login-status-text msg error';
                    setTimeout(() => logout(), 4000);
                }
                
                // Garante que a app não aparece em caso de erro
                ui.loginView.style.display = 'flex';
                ui.appContainer.style.display = 'none';
            }

        } else {
            // Não logado no Firebase
            ui.loginView.style.display = 'flex';
            ui.appContainer.style.display = 'none';
            // Limpa mensagens antigas se houver
            if(!ui.loginStatus.classList.contains('msg')) {
                 ui.loginStatus.textContent = 'Aguardando credenciais...';
            }
        }
    });
});