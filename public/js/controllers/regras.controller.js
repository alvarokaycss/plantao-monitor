// public/js/controllers/regras.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { renderRegrasTable } from '../views/regras.view.js';
import { showMessage } from '../utils/utils.js';

let regrasCache = [];
let bancosCache = [];
let rolesCache = [];

export function initRegrasController() {
    if (ui.regras.addBtn) ui.regras.addBtn.addEventListener('click', () => openRegraModal('new'));
    if (ui.regras.btnCancelCrud) ui.regras.btnCancelCrud.addEventListener('click', () => ui.regras.crudModal.style.display = 'none');
    if (ui.regras.crudForm) ui.regras.crudForm.addEventListener('submit', handleRegraSubmit);
    if (ui.regras.btnTestar) ui.regras.btnTestar.addEventListener('click', handleTestarRegra);
    
    // Filtros
    if (ui.regras.search) ui.regras.search.onkeyup = applyRegrasFilters;
    if (ui.regras.filterPrioridade) ui.regras.filterPrioridade.onchange = applyRegrasFilters;
}

export async function loadRegrasView() {
    ui.regras.tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const regras = await fetchApi('/regras');
        regrasCache = regras;
        applyRegrasFilters();
    } catch (e) { console.error(e); }
}

function applyRegrasFilters() {
    const term = ui.regras.search.value.toLowerCase();
    const prio = ui.regras.filterPrioridade.value;
    const filtered = regrasCache.filter(r => {
        return r.nome.toLowerCase().includes(term) && (prio ? r.prioridade == prio : true);
    });
    
    renderRegrasTable(filtered, {
        onEdit: openRegraModal,
        onDelete: handleDeleteRegra,
        onOpenAction: openAcaoModal,
        onCancelAction: cancelAction
    });
}

// --- CRUD ---

async function setupRegraForm() {
    // Popula selects apenas se cache estiver vazio
    if(bancosCache.length > 0) return;

    try {
        const [bancos, roles] = await Promise.all([ fetchApi('/bancos'), fetchApi('/roles') ]);
        bancosCache = bancos; 
        rolesCache = roles;
        
        ui.regras.campoBanco.innerHTML = bancos.map(b => `<option value="${b.id_banco_dados}">${b.tipo_banco}</option>`).join('');
        ui.regras.rolesContainer.innerHTML = roles.map(r => 
            `<label style="display: flex; gap: 5px;"><input type="checkbox" value="${r.id_role}"> ${r.nome}</label>`
        ).join('');
        
        // Prioridade fixa
        ui.regras.campoPrioridade.innerHTML = `<option value="3">Baixa</option><option value="2">Média</option><option value="1">Alta</option>`;

    } catch (e) { showMessage('Erro ao carregar formulário.', 'error'); }
}

async function openRegraModal(modeOrId) {
    await setupRegraForm();
    ui.regras.crudForm.reset();
    ui.regras.regraId.value = '';
    
    if (modeOrId !== 'new') {
        const idRegra = Number(modeOrId);
        ui.regras.crudTitle.textContent = 'Editar Regra';
        ui.regras.regraId.value = idRegra;
        
        try {
            const data = await fetchApi(`/regras/${idRegra}/detalhes`);
            const info = data.info;
            
            ui.regras.campoNome.value = info.nome;
            ui.regras.campoSqL.value = info.consulta_sql;
            ui.regras.campoBanco.value = info.id_banco_dados;
            // ... preencher outros campos (abreviado para concisão) ...
            
            // Checkboxes
            const regraLista = regrasCache.find(r => r.id_regra == idRegra);
            if (regraLista && regraLista.roles_id) {
                const sIds = regraLista.roles_id.map(String);
                ui.regras.rolesContainer.querySelectorAll('input').forEach(chk => {
                    if (sIds.includes(chk.value)) chk.checked = true;
                });
            }
        } catch(e) { console.error(e); }
    } else {
        ui.regras.crudTitle.textContent = 'Nova Regra';
    }
    
    ui.regras.crudModal.style.display = 'flex';
}

async function handleRegraSubmit(e) {
    e.preventDefault();
    const idRegra = ui.regras.regraId.value;
    const roles = Array.from(ui.regras.rolesContainer.querySelectorAll('input:checked')).map(c => Number(c.value));
    
    if (roles.length === 0) { showMessage('Selecione uma role.', 'error'); return; }

    const payload = {
        id_banco_dados: Number(ui.regras.campoBanco.value),
        nome: ui.regras.campoNome.value,
        consulta_sql: ui.regras.campoSqL.value,
        intervalo_minutos: Number(ui.regras.campoFrequencia.value),
        qnt_erro_max: Number(ui.regras.campoErros.value),
        prioridade: Number(ui.regras.campoPrioridade.value),
        roles: roles,
        // Outros campos opcionais...
    };

    try {
        await fetchApi(idRegra ? `/regras/${idRegra}` : `/regras`, {
            method: idRegra ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        ui.regras.crudModal.style.display = 'none';
        loadRegrasView();
        showMessage('Salvo!', 'success');
    } catch (e) { showMessage(e.message, 'error'); }
}

async function handleTestarRegra() {
    try {
        const res = await fetchApi('/regras/testar', {
            method: 'POST',
            body: JSON.stringify({
                id_banco_dados: ui.regras.campoBanco.value,
                consulta_sql: ui.regras.campoSqL.value
            })
        });
        ui.regras.campoResultado.value = JSON.stringify(res.rows || res, null, 2);
    } catch (e) { ui.regras.campoResultado.value = "Erro: " + e.message; }
}

function handleDeleteRegra(id) {
    if(confirm("Tem certeza que deseja excluir esta regra?")) {
        fetchApi(`/regras/${id}`, { method: 'DELETE' })
            .then(() => { showMessage("Excluído!", "success"); loadRegrasView(); })
            .catch(e => showMessage(e.message, "error"));
    }
}

// Ações (Stub)
function openAcaoModal(id) { alert(`Abrir modal de ação para regra ${id}`); }
function cancelAction(id) { alert(`Cancelar ação da regra ${id}`); }