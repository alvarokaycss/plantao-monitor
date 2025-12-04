// public/js/controllers/auth.controller.js

import { login, register, logout } from '../services/auth.service.js';
import { ui } from '../views/base.view.js';

let isRegisterMode = false;

export function initAuthController() {
    if (ui.logoutButton) ui.logoutButton.addEventListener('click', handleLogout);

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

    if (ui.toggleMode) {
        ui.toggleMode.addEventListener('click', toggleAuthMode);
    }
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    ui.loginStatus.textContent = '';
    ui.loginStatus.className = 'login-status-text';

    if (isRegisterMode) {
        ui.fieldNomeContainer.classList.remove('hidden');
        ui.btnSubmit.textContent = 'Criar Conta';
        ui.btnSubmit.classList.replace('btn-primary', 'btn-secondary');
        ui.toggleMode.textContent = 'Já tem conta? Voltar para Login';
        if (ui.loginNome) ui.loginNome.required = true;
        ui.loginStatus.textContent = 'Preencha seus dados para cadastro.';
    } else {
        ui.fieldNomeContainer.classList.add('hidden');
        ui.btnSubmit.textContent = 'Entrar';
        ui.btnSubmit.classList.replace('btn-secondary', 'btn-primary');
        ui.toggleMode.textContent = 'Não tem conta? Cadastre-se';
        if (ui.loginNome) ui.loginNome.required = false;
        ui.loginStatus.textContent = 'Aguardando credenciais...';
    }
}

async function handleEmailLogin() {
    
    try {
        await login(ui.loginEmail.value.trim(), ui.loginPass.value);
        if(ui.btnSubmit) ui.btnSubmit.textContent = "Entrando...";
        // O listener de estado no main.js fará o redirecionamento
    } catch (error) {
        if(ui.btnSubmit) ui.btnSubmit.disabled = false;
        
        let msg = "Falha ao entrar.";
        // Tratamento de erros comuns do Firebase
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = "E-mail ou senha incorretos.";
        } else if (error.message && error.message.includes("INVALID_LOGIN_CREDENTIALS")) {
            msg = "E-mail ou senha incorretos.";
        } else if (error.code === 'auth/too-many-requests') {
            msg = "Muitas tentativas falhas. Tente novamente mais tarde.";
        }

        ui.loginStatus.textContent = msg;
        ui.loginStatus.className = 'login-status-text msg error';
    }
}

async function handleEmailRegister() {
    if (ui.btnSubmit) ui.btnSubmit.disabled = true;
    try {
        await register(ui.loginEmail.value.trim(), ui.loginPass.value, ui.loginNome.value.trim());
        // Listener redireciona
    } catch (error) {
        if (ui.btnSubmit) ui.btnSubmit.disabled = false;
        ui.loginStatus.textContent = "Erro: " + error.message;
        ui.loginStatus.className = 'login-status-text msg error';
    }
}

function handleLogout() {
    if (ui.btnSubmit) ui.btnSubmit.textContent = "Entrar"
    logout();
}