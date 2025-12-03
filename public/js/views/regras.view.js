// public/js/views/regras.view.js

import { ui } from './base.view.js';
import { formatPrioridade } from '../utils/utils.js';

export function renderRegrasTable(list, callbacks) {
    ui.regras.tbody.innerHTML = '';
    if (!list || list.length === 0) { 
        ui.regras.tbody.innerHTML = '<tr><td colspan="5">Nenhuma regra encontrada.</td></tr>'; 
        return; 
    }

    list.forEach(r => {
        const tr = document.createElement('tr');
        const status = calcularStatusFrontend(r);

        let badgeClass = 'badge-status-ativa';
        if (status === 'Adiada') badgeClass = 'badge-status-adiada';
        if (status === 'Silenciada') badgeClass = 'badge-status-silenciada';

        // Botões de Ação
        const actionBtn = status === 'Ativa'
            ? `<button class="action-btn btn-acao-regra" data-id="${r.id_regra}" title="Programar Ação"><img src="./assets/gear.svg"></button>`
            : `<button class="action-btn btn-cancelar-acao" data-id="${r.id_regra}" title="Cancelar Ação"><img src="./assets/x.svg"></button>`;

        tr.innerHTML = `
            <td>${r.nome}</td>
            <td>${r.intervalo_minutos} min</td>
            <td><span class="badge badge-prio-${r.prioridade}">${formatPrioridade(r.prioridade)}</span></td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
            <td>
                <button class="action-btn btn-edit-regra" data-id="${r.id_regra}"><img src="./assets/pencil-simple-line.svg"></button>
                <button class="action-btn btn-delete-regra" data-id="${r.id_regra}"><img src="./assets/trash.svg"></button>
                ${actionBtn}
            </td>
        `;
        
        // Adiciona listeners manuais após inserir o HTML para evitar "onclick" inline
        const btnEdit = tr.querySelector('.btn-edit-regra');
        const btnDelete = tr.querySelector('.btn-delete-regra');
        const btnAction = tr.querySelector('.btn-acao-regra') || tr.querySelector('.btn-cancelar-acao');

        if(btnEdit) btnEdit.onclick = () => callbacks.onEdit(r.id_regra);
        if(btnDelete) btnDelete.onclick = () => callbacks.onDelete(r.id_regra);
        if(btnAction) {
            const isCancel = btnAction.classList.contains('btn-cancelar-acao');
            btnAction.onclick = () => isCancel ? callbacks.onCancelAction(r.id_regra) : callbacks.onOpenAction(r.id_regra);
        }

        ui.regras.tbody.appendChild(tr);
    });
}

function calcularStatusFrontend(r) {
    const now = new Date();
    if (r.data_adiar_inicio && now < new Date(r.data_adiar_fim)) return 'Adiada';
    if (r.data_silenciar_inicio && now < new Date(r.data_silenciar_fim)) return 'Silenciada';
    return 'Ativa';
}