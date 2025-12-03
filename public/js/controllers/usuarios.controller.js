// public/js/controllers/usuarios.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { renderUsuariosTable, renderRecursosCheckboxes, renderNotificacaoCampos } from '../views/usuarios.view.js';
import { showMessage } from '../utils/utils.js';

let perfisCache = [];
let recursosCache = [];
let tiposCanalCache = [];

export function initUsuariosController() {
    if (ui.usuarios.addBtn) ui.usuarios.addBtn.onclick = () => openUsuarioModal('new');
    if (ui.usuarios.btnCancel) ui.usuarios.btnCancel.onclick = () => ui.usuarios.modal.style.display = 'none';
    if (ui.usuarios.form) ui.usuarios.form.onsubmit = handleUsuarioSubmit;
    
    if (ui.usuarios.search) ui.usuarios.search.onkeyup = loadUsuariosView;
    if (ui.usuarios.filterPerfil) ui.usuarios.filterPerfil.onchange = loadUsuariosView;
}

export async function loadUsuariosView() {
    ui.usuarios.tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        await setupCache();
        
        const p = new URLSearchParams();
        if (ui.usuarios.filterPerfil.value) p.append('id_perfil', ui.usuarios.filterPerfil.value);
        if (ui.usuarios.search.value) p.append('pesquisa', ui.usuarios.search.value);
        
        const users = await fetchApi(`/usuarios?${p}`);
        
        renderUsuariosTable(users, perfisCache, {
            onEdit: openUsuarioModal,
            onDelete: handleDeleteUsuario
        });
    } catch (e) { console.error(e); }
}

async function setupCache() {
    if (perfisCache.length > 0) return;
    const [p, r, c] = await Promise.all([fetchApi('/perfis'), fetchApi('/recursos'), fetchApi('/tipos_canal_notificacao')]);
    perfisCache = p; recursosCache = r; tiposCanalCache = c;
    
    ui.usuarios.filterPerfil.innerHTML = '<option value="">Perfil: Todos</option>' + 
        p.map(x => `<option value="${x.id_perfil}">${x.nome}</option>`).join('');
        
    ui.usuarios.campoPerfil.innerHTML = p.map(x => `<option value="${x.id_perfil}">${x.nome}</option>`).join('');
}

async function openUsuarioModal(modeOrId) {
    ui.usuarios.form.reset();
    ui.usuarios.usuarioId.value = '';
    
    if (modeOrId !== 'new') {
        ui.usuarios.title.textContent = 'Editar Usuário';
        const idUsuario = Number(modeOrId);
        ui.usuarios.usuarioId.value = idUsuario;
        
        try {
            const data = await fetchApi(`/usuarios/${idUsuario}/detalhes`);
            const info = data.info;
            
            ui.usuarios.campoPerfil.value = info.id_perfil;
            ui.usuarios.campoAtivo.value = info.ativo ? 'true' : 'false';
            
            renderRecursosCheckboxes(data.recursos || [], recursosCache);
            renderNotificacaoCampos(data.configuracoes || [], tiposCanalCache);
        } catch(e) { showMessage(e.message, 'error'); }
    } else {
        ui.usuarios.title.textContent = 'Novo Usuário';
        renderRecursosCheckboxes([], recursosCache);
        renderNotificacaoCampos([], tiposCanalCache);
    }
    
    ui.usuarios.modal.style.display = 'flex';
}

async function handleUsuarioSubmit(e) {
    e.preventDefault();
    const id = ui.usuarios.usuarioId.value;
    if (!id) { showMessage('Use o modal apenas para editar (Cadastro é no Login).', 'info'); return; }
    
    // Lógica simplificada de coleta de dados
    const recs = Array.from(ui.usuarios.recursosContainer.querySelectorAll('input:checked')).map(c => Number(c.value));
    
    try {
        await fetchApi(`/usuarios/${id}/configuracao`, {
            method: 'PUT',
            body: JSON.stringify({
                id_perfil: Number(ui.usuarios.campoPerfil.value),
                ativo: ui.usuarios.campoAtivo.value === 'true',
                recursos: recs,
                notificacoes: [] // Simplificado para este exemplo
            })
        });
        ui.usuarios.modal.style.display = 'none';
        loadUsuariosView();
        showMessage('Salvo!', 'success');
    } catch (e) { showMessage(e.message, 'error'); }
}

function handleDeleteUsuario(id) {
    if(confirm("Deseja realmente excluir este usuário?")) {
        fetchApi(`/usuarios/${id}`, { method: 'DELETE' })
            .then(() => { showMessage('Excluído.', 'success'); loadUsuariosView(); })
            .catch(e => showMessage(e.message, 'error'));
    }
}