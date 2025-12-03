// public/js/views/usuarios.view.js

import { ui } from './base.view.js';

export function renderUsuariosTable(list, perfisCache, callbacks) {
    ui.usuarios.tbody.innerHTML = '';
    if (!list || list.length === 0) { 
        ui.usuarios.tbody.innerHTML = '<tr><td colspan="5">Nenhum usuário encontrado.</td></tr>'; 
        return; 
    }

    list.forEach(u => {
        const pName = perfisCache.find(x => x.id_perfil === u.id_perfil)?.nome || '?';
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${u.nome}</td>
            <td>${u.email}</td>
            <td>${pName}</td>
            <td><span class="badge ${u.ativo ? 'badge-status-ativa' : 'badge-status-silenciada'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <button class="action-btn btn-edit-user" data-id="${u.id_usuario}"><img src="./assets/gear.svg"></button>
                <button class="action-btn btn-delete-user" data-id="${u.id_usuario}"><img src="./assets/trash.svg"></button>
            </td>
        `;

        tr.querySelector('.btn-edit-user').onclick = () => callbacks.onEdit(u.id_usuario);
        tr.querySelector('.btn-delete-user').onclick = () => callbacks.onDelete(u.id_usuario);

        ui.usuarios.tbody.appendChild(tr);
    });
}

export function renderRecursosCheckboxes(selected, recursosCache) {
    const sIds = new Set(selected.map(r => r.id_recurso));
    ui.usuarios.recursosContainer.innerHTML = recursosCache.map(r =>
        `<label><input type="checkbox" value="${r.id_recurso}" ${sIds.has(r.id_recurso) ? 'checked' : ''}> ${r.nome_amigavel}</label>`
    ).join('');
}

export function renderNotificacaoCampos(existentes, tiposCanalCache) {
    ui.usuarios.notificacaoContainer.innerHTML = `<div style="font-weight:bold">Canal</div><div style="font-weight:bold">Ativo</div>`;
    tiposCanalCache.forEach(c => {
        const conf = existentes.find(x => x.id_tipo_canal === c.id_tipo_canal) || {};
        const div = document.createElement('div');
        div.style.display = 'contents'; 
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