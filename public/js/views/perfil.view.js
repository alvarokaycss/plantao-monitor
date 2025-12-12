// public/js/views/perfil.view.js

import { ui } from './base.view.js';

export function renderPerfil(data) {
    const container = ui.perfil.container;
    if (!container) return;

    const user = data.info;
    const configs = data.configuracoes || [];

    const getConfig = (idTipo) => configs.find(c => c.id_tipo_canal === idTipo);
    
    // Dados
    const zapConfig = getConfig(3);
    const celular = zapConfig ? zapConfig.endereco_notificacao : '';
    const isPushOn = getConfig(1)?.habilitado !== false; 
    const isEmailOn = getConfig(2)?.habilitado !== false;
    const isZapOn = getConfig(3)?.habilitado !== false;

    // Horários (HH:MM)
    const inicio = user.notificacao_janela_inicio ? user.notificacao_janela_inicio.substring(0, 5) : '';
    const fim = user.notificacao_janela_fim ? user.notificacao_janela_fim.substring(0, 5) : '';

    const iniciais = user.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

    container.innerHTML = `
        <div class="profile-container">
            
            <div class="card profile-card">
                <div class="profile-header-row">
                    <div class="profile-avatar">${iniciais}</div>
                    <div>
                        <h3 class="profile-name">${user.nome}</h3>
                        <span class="profile-email">${user.email}</span>
                    </div>
                </div>

                <form id="form-perfil-detalhes">
                    <div class="form-group modal-full-width" style="margin-bottom: 15px;">
                        <label>Nome Completo</label>
                        <input type="text" id="perfil-nome" value="${user.nome}" required>
                    </div>

                    <div class="form-group modal-full-width" style="margin-bottom: 25px;">
                        <label>Celular (WhatsApp)</label>
                        <input type="text" id="perfil-celular" value="${celular}" placeholder="Ex: 51 99999-9999">
                    </div>

                    <div style="text-align: right;">
                        <button type="submit" class="btn-primary">Salvar Alterações</button>
                    </div>
                </form>
            </div>

            <div class="card profile-card">
                
                <div>
                    <h3 class="profile-section-title">Canais de Notificação</h3>
                    
                    <div class="profile-toggle-group">
                        <label class="profile-toggle-item">
                            <input type="checkbox" id="toggle-push" ${isPushOn ? 'checked' : ''}>
                            <span>Notificação do Sistema (Push)</span>
                        </label>

                        <label class="profile-toggle-item">
                            <input type="checkbox" id="toggle-whatsapp" ${isZapOn ? 'checked' : ''}>
                            <span>Notificação por WhatsApp</span>
                        </label>

                        <label class="profile-toggle-item">
                            <input type="checkbox" id="toggle-email" ${isEmailOn ? 'checked' : ''}>
                            <span>Notificação por E-mail</span>
                        </label>
                    </div>

                    <div class="profile-time-window">
                        <h3 class="profile-section-title" style="margin-bottom: 10px; font-size: 14px;">
                            Janela de Horário
                        </h3>
                        <div class="profile-time-inputs">
                            <input type="time" id="perfil-inicio" value="${inicio}" title="Início">
                            <span>até</span>
                            <input type="time" id="perfil-fim" value="${fim}" title="Fim">
                        </div>
                    </div>
                </div>

                <div class="profile-logout-container">
                    <button id="btn-perfil-logout" class="btn-danger-outline">
                        Sair
                    </button>
                </div>

            </div>
        </div>
    `;
}