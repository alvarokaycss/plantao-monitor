// public/js/controllers/usuarios.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { renderUsuariosTable, renderRecursosCheckboxes, renderNotificacaoCampos } from '../views/usuarios.view.js';
import { showMessage } from '../utils/utils.js';

let perfisCache = [];
let recursosCache = [];
let tiposCanalCache = [];

// Estado para controle do delete
let idUsuarioParaDeletar = null; 

export function initUsuariosController() {
    //  MODAL DE EDIÇÃO 
    if (ui.usuarios.btnCancel) ui.usuarios.btnCancel.onclick = () => ui.usuarios.modal.style.display = 'none';
    if (ui.usuarios.form) ui.usuarios.form.onsubmit = handleUsuarioSubmit;
    
    // FILTROS 
    if (ui.usuarios.search) ui.usuarios.search.onkeyup = loadUsuariosView;
    if (ui.usuarios.filterPerfil) ui.usuarios.filterPerfil.onchange = loadUsuariosView;

    // MODAL DE DELETE  
    const modalDelete = document.getElementById('modal-delete-usuario');
    const btnCancelDelete = document.getElementById('btn-del-usuario-fechar');
    const btnConfirmDelete = document.getElementById('btn-del-usuario-confirmar');

    if (btnCancelDelete) {
        btnCancelDelete.addEventListener('click', () => {
            modalDelete.style.display = 'none';
            idUsuarioParaDeletar = null;
        });
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', executeDeleteUsuario);
    }
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
            onDelete: openDeleteConfirmation 
        });
    } catch (e) { console.error(e); }
}

async function setupCache() {
    if (perfisCache.length > 0) return;
    try {
        const [p, r, c] = await Promise.all([
            fetchApi('/perfis'), 
            fetchApi('/recursos'), 
            fetchApi('/tipos_canal_notificacao')
        ]);
        perfisCache = p; recursosCache = r; tiposCanalCache = c;
        
        ui.usuarios.filterPerfil.innerHTML = '<option value="">Perfil: Todos</option>' + 
            p.map(x => `<option value="${x.id_perfil}">${x.nome}</option>`).join('');
            
        ui.usuarios.campoPerfil.innerHTML = p.map(x => `<option value="${x.id_perfil}">${x.nome}</option>`).join('');
    } catch (e) {
        console.error("Erro ao carregar caches:", e);
    }
}

async function openUsuarioModal(idUsuario) {
    if (!idUsuario) return;

    ui.usuarios.form.reset();
    ui.usuarios.usuarioId.value = idUsuario;
    ui.usuarios.title.textContent = 'Gerenciar Acesso do Usuário';
    
    try {
        const data = await fetchApi(`/usuarios/${idUsuario}/detalhes`);
        const info = data.info;
        
        ui.usuarios.infoEmail.textContent = `Usuário: ${info.email} (${info.nome})`;
        ui.usuarios.campoPerfil.value = info.id_perfil;
        ui.usuarios.campoAtivo.value = info.ativo ? 'true' : 'false';
        
        renderRecursosCheckboxes(data.recursos || [], recursosCache);
        renderNotificacaoCampos(data.configuracoes || [], tiposCanalCache);
        
        ui.usuarios.modal.style.display = 'flex';

    } catch(e) { 
        showMessage('Erro ao carregar usuário: ' + e.message, 'error'); 
    }
}

async function handleUsuarioSubmit(e) {
    e.preventDefault();
    const id = ui.usuarios.usuarioId.value;
    if (!id) return;

    const recursosSelecionados = Array.from(
        ui.usuarios.recursosContainer.querySelectorAll('input:checked')
    ).map(c => Number(c.value));
    
    const notificacoesPayload = [];
    tiposCanalCache.forEach(tipo => {
        const inputEndereco = ui.usuarios.notificacaoContainer.querySelector(`input[data-tipo-canal="${tipo.id_tipo_canal}"]`);
        const checkHabilitado = document.getElementById(`enable-${tipo.id_tipo_canal}`);
        
        if (inputEndereco && inputEndereco.value.trim() !== '') {
            notificacoesPayload.push({
                id_tipo_canal: tipo.id_tipo_canal,
                endereco_notificacao: inputEndereco.value.trim(),
                habilitado: checkHabilitado ? checkHabilitado.checked : true,
                nome_dispositivo: 'Web Admin Config'
            });
        }
    });

    const payload = {
        id_perfil: Number(ui.usuarios.campoPerfil.value),
        ativo: ui.usuarios.campoAtivo.value === 'true',
        recursos: recursosSelecionados,
        notificacoes: notificacoesPayload
    };
    
    try {
        await fetchApi(`/usuarios/${id}/configuracao`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        
        ui.usuarios.modal.style.display = 'none';
        loadUsuariosView();
        showMessage('Permissões e acessos atualizados!', 'success');
    } catch (e) { 
        showMessage(e.message, 'error'); 
    }
}

// === Lógica do Modal de Delete ===

function openDeleteConfirmation(id) {
    idUsuarioParaDeletar = id;
    const modal = document.getElementById('modal-delete-usuario');
    if (modal) modal.style.display = 'flex';
}

async function executeDeleteUsuario() {
    if (!idUsuarioParaDeletar) return;

    const btn = document.getElementById('btn-del-usuario-confirmar');
    const originalText = btn.textContent;
    btn.textContent = "Excluindo...";
    btn.disabled = true;

    try {
        await fetchApi(`/usuarios/${idUsuarioParaDeletar}`, { method: 'DELETE' });
        
        showMessage('Usuário e vínculos removidos com sucesso.', 'success');
        loadUsuariosView();
        
        document.getElementById('modal-delete-usuario').style.display = 'none';
        
    } catch (e) {
        showMessage(e.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        idUsuarioParaDeletar = null; // Limpa estado
    }
}