// public/js/controllers/perfil.controller.js

import { fetchApi } from '../services/api.service.js';
import { renderPerfil } from '../views/perfil.view.js';
import { showMessage } from '../utils/utils.js';
import { logout } from '../services/auth.service.js';

export function initPerfilController() {
    // Submit do Form
    document.addEventListener('submit', (e) => {
        if (e.target && e.target.id === 'form-perfil-detalhes') {
            e.preventDefault();
            handleSavePerfil();
        }
    });

    // Botão Sair
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'btn-perfil-logout') {
            logout();
        }
    });
}

export async function loadPerfilView() {
    const container = document.getElementById('perfil-container');
    if(container) container.innerHTML = '<div class="loading-placeholder">Carregando perfil...</div>';

    try {
        const data = await fetchApi('/usuarios/eu/detalhes');
        renderPerfil(data);
    } catch (e) {
        console.error(e);
        if(container) container.innerHTML = '<p class="msg error">Erro ao carregar perfil.</p>';
    }
}

async function handleSavePerfil() {
    const nome = document.getElementById('perfil-nome').value;
    const celular = document.getElementById('perfil-celular').value;
    
    // Captura Janela de Horário
    const janela_inicio = document.getElementById('perfil-inicio').value;
    const janela_fim = document.getElementById('perfil-fim').value;

    const notificacoes = {
        push: document.getElementById('toggle-push').checked,
        whatsapp: document.getElementById('toggle-whatsapp').checked,
        email: document.getElementById('toggle-email').checked
    };

    try {
        // Envia tudo no PUT
        await fetchApi('/usuarios/eu/perfil', {
            method: 'PUT',
            body: JSON.stringify({ 
                nome, 
                celular, 
                notificacoes,
                janela_inicio, // Novos campos
                janela_fim 
            })
        });
        showMessage("Perfil salvo com sucesso!", "success");
        loadPerfilView(); 
    } catch (e) {
        showMessage(e.message, "error");
    }
}