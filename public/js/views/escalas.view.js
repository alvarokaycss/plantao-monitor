// public/js/views/escalas.view.js

import { formatDataCurta } from '../utils/utils.js';

export function renderEscalasGrid(list, callbacks) {
    const container = document.getElementById('escalas-grid');
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Nenhuma escala cadastrada.</div>';
        return;
    }

    const agora = new Date();

    // Identificar o "Próximo" para CADA Role
    const mapProximos = new Map();

    // Organizamos por Escala
    const escalasPorRole = {};
    list.forEach(e => {
        if (!escalasPorRole[e.id_role]) escalasPorRole[e.id_role] = [];
        escalasPorRole[e.id_role].push(e);
    });

    // Ordena por data
    Object.keys(escalasPorRole).forEach(roleId => {
        const escalasDaRole = escalasPorRole[roleId];
        const futuras = escalasDaRole.filter(e => new Date(e.data_inicio) > agora);
        // Filtra pela menor data primeiro
        futuras.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));
        
        if (futuras.length > 0) {
            mapProximos.set(Number(roleId), futuras[0].id_escala);
        }
    });

    // RENDERIZAÇÃO 
    list.forEach(escala => {
        const inicio = new Date(escala.data_inicio);
        const fim = new Date(escala.data_fim);
        
        let statusTexto = 'Aguardando a escala';
        let statusClass = 'escala-status-future'; 
        let borderClass = '';

        // Lógica de Status
        if (agora >= inicio && agora <= fim) {
            statusTexto = 'Plantonista atual';
            statusClass = 'escala-status-current';
            borderClass = 'card-active-border';
        } 
        else if (mapProximos.get(escala.id_role) === escala.id_escala) {
            statusTexto = 'Próximo plantonista';
            statusClass = 'escala-status-next';
        } 
        else if (agora > fim) {
            statusTexto = 'Finalizado';
            statusClass = 'escala-status-past';
        }

        const card = document.createElement('div');
        card.className = `kpi-card ${borderClass}`;
        
        const nomeUser = escala.nome_usuario || 'Usuário Desconhecido';
        const nomeRole = escala.nome_role || 'Role não definida';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                    <h3 style="margin:0; font-size:16px; color:#2C5132; font-weight:bold;">
                        ${nomeUser}
                    </h3>
                    <span style="font-size:11px; color:#2c5132; font-weight:bold; background:#ebf6f2; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;">
                        ${nomeRole}
                    </span>
                </div>
                
                <div style="display: flex;">
                    <button class="action-btn btn-edit-escala" title="Editar" style="color:#2C5132">
                        <img src="./assets/pencil-simple-line.svg" style="width:18px;">
                    </button>
                    <button class="action-btn btn-delete-escala" style="color:#761818" title="Remover">
                        <img src="./assets/trash.svg" style="width:18px;">
                    </button>
                </div>
            </div>
            
            <div style="margin: 15px 0; font-size: 13px; color: #444; line-height: 1.6;">
                <div style="display:flex; align-items:center; gap:6px;">
                     <strong>Início:</strong> ${formatDataCurta(escala.data_inicio)}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                     <strong>Fim:</strong> ${formatDataCurta(escala.data_fim)}
                </div>
            </div>

            <div class="escala-badge ${statusClass}">
                ${statusTexto}
            </div>
        `;

        // LISTENERS
        if (callbacks && typeof callbacks.onEdit === 'function') {
            card.querySelector('.btn-edit-escala').onclick = () => callbacks.onEdit(escala);
        }
        
        if (callbacks && typeof callbacks.onDelete === 'function') {
            card.querySelector('.btn-delete-escala').onclick = () => callbacks.onDelete(escala.id_escala);
        }

        container.appendChild(card);
    });
}