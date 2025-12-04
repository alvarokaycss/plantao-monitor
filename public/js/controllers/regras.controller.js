// public/js/controllers/regras.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { renderRegrasTable } from '../views/regras.view.js';
import { showMessage } from '../utils/utils.js';

let regrasCache = [];
let bancosCache = [];
let rolesCache = [];

// Variáveis de estado para os Modais de Confirmação
let idRegraToDelete = null;
let idRegraToCancelAction = null;

export function initRegrasController() {
    // --- Listeners Principais ---
    if (ui.regras.addBtn) ui.regras.addBtn.addEventListener('click', () => openRegraModal('new'));
    if (ui.regras.btnCancelCrud) ui.regras.btnCancelCrud.addEventListener('click', () => ui.regras.crudModal.style.display = 'none');
    if (ui.regras.crudForm) ui.regras.crudForm.addEventListener('submit', handleRegraSubmit);
    if (ui.regras.btnTestar) ui.regras.btnTestar.addEventListener('click', handleTestarRegra);
    
    // --- Filtros ---
    if (ui.regras.search) ui.regras.search.onkeyup = applyRegrasFilters;
    if (ui.regras.filterPrioridade) ui.regras.filterPrioridade.onchange = applyRegrasFilters;
    
    // --- Modal de Agendar Ação (Adiar/Silenciar) ---
    if (ui.regras.btnCancelAcao) ui.regras.btnCancelAcao.addEventListener('click', () => ui.regras.modal.style.display = 'none');
    if (ui.regras.formAcoes) ui.regras.formAcoes.addEventListener('submit', handleAcaoSubmit);

    // --- Modal de Cancelar Ação Programada ---
    const modalCancelAction = document.getElementById('modal-confirmacao');
    const btnCloseCancel = document.getElementById('btn-conf-fechar');
    const btnConfirmCancel = document.getElementById('btn-conf-executar');

    if (btnCloseCancel) btnCloseCancel.addEventListener('click', () => modalCancelAction.style.display = 'none');
    if (btnConfirmCancel) btnConfirmCancel.addEventListener('click', executeCancelAction);

    // --- Modal de Deletar Regra ---
    const modalDelete = document.getElementById('modal-delete-regra');
    const btnCloseDelete = document.getElementById('btn-del-fechar');
    const btnConfirmDelete = document.getElementById('btn-del-confirmar');

    if (btnCloseDelete) btnCloseDelete.addEventListener('click', () => modalDelete.style.display = 'none');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', executeDeleteRegra);
}

export async function loadRegrasView() {
    ui.regras.tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const regras = await fetchApi('/regras');
        regrasCache = regras;
        applyRegrasFilters();
    } catch (e) { 
        console.error(e);
        ui.regras.tbody.innerHTML = '<tr><td colspan="5" style="color:red">Erro ao carregar regras.</td></tr>';
    }
}

function applyRegrasFilters() {
    const term = ui.regras.search.value.toLowerCase();
    const prio = ui.regras.filterPrioridade.value;
    const filtered = regrasCache.filter(r => {
        return r.nome.toLowerCase().includes(term) && (prio ? r.prioridade == prio : true);
    });
    
    renderRegrasTable(filtered, {
        onEdit: openRegraModal,
        onDelete: handleDeleteRegraClick, // Alterado para abrir modal
        onOpenAction: openAcaoModal,
        onCancelAction: handleCancelActionClick // Alterado para abrir modal
    });
}

// --- CRUD DE REGRAS ---

async function setupRegraForm() {
    if(bancosCache.length > 0) return;

    try {
        const [bancos, roles] = await Promise.all([ fetchApi('/bancos'), fetchApi('/roles') ]);
        bancosCache = bancos; 
        rolesCache = roles;
        
        ui.regras.campoBanco.innerHTML = bancos.map(b => `<option value="${b.id_banco_dados}">${b.tipo_banco}</option>`).join('');
        ui.regras.rolesContainer.innerHTML = roles.map(r => 
            `<label style="display: flex; gap: 5px; align-items: center;"><input type="checkbox" value="${r.id_role}"> ${r.nome}</label>`
        ).join('');
        
        ui.regras.campoPrioridade.innerHTML = `<option value="3">Baixa</option><option value="2">Média</option><option value="1">Alta</option>`;

    } catch (e) { showMessage('Erro ao carregar formulário.', 'error'); }
}

async function openRegraModal(modeOrId) {
    await setupRegraForm();
    ui.regras.crudForm.reset();
    ui.regras.regraId.value = '';
    ui.regras.rolesContainer.querySelectorAll('input').forEach(chk => chk.checked = false);
    
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
            ui.regras.campoDescricao.value = info.descricao || '';
            ui.regras.campoFrequencia.value = info.intervalo_minutos;
            ui.regras.campoErros.value = info.qnt_erro_max;
            ui.regras.campoPrioridade.value = info.prioridade;
            
            ui.regras.campoJanelaInicio.value = info.janela_inicio ? info.janela_inicio.substring(0, 5) : '00:00';
            ui.regras.campoJanelaFim.value = info.janela_fim ? info.janela_fim.substring(0, 5) : '23:59';
            
            let rolesIds = [];
            const regraLista = regrasCache.find(r => r.id_regra == idRegra);
            if(regraLista && regraLista.roles_id) rolesIds = regraLista.roles_id;
            
            const sIds = rolesIds.map(String);
            ui.regras.rolesContainer.querySelectorAll('input').forEach(chk => {
                if (sIds.includes(chk.value)) chk.checked = true;
            });

        } catch(e) { 
            console.error(e);
            showMessage('Erro ao carregar detalhes da regra.', 'error');
        }
    } else {
        ui.regras.crudTitle.textContent = 'Nova Regra';
        ui.regras.campoFrequencia.value = 5;
        ui.regras.campoErros.value = 1;
        ui.regras.campoPrioridade.value = 3;
        ui.regras.campoJanelaInicio.value = '00:00';
        ui.regras.campoJanelaFim.value = '23:59';
    }
    
    ui.regras.crudModal.style.display = 'flex';
}

async function handleRegraSubmit(e) {
    e.preventDefault();
    const idRegra = ui.regras.regraId.value;
    const roles = Array.from(ui.regras.rolesContainer.querySelectorAll('input:checked')).map(c => Number(c.value));
    
    if (roles.length === 0) { showMessage('Selecione pelo menos uma role.', 'error'); return; }

    const payload = {
        id_banco_dados: Number(ui.regras.campoBanco.value),
        nome: ui.regras.campoNome.value,
        consulta_sql: ui.regras.campoSqL.value,
        intervalo_minutos: Number(ui.regras.campoFrequencia.value),
        qnt_erro_max: Number(ui.regras.campoErros.value),
        prioridade: Number(ui.regras.campoPrioridade.value),
        roles: roles,
        descricao: ui.regras.campoDescricao.value,
        janela_inicio: ui.regras.campoJanelaInicio.value,
        janela_fim: ui.regras.campoJanelaFim.value
    };

    try {
        await fetchApi(idRegra ? `/regras/${idRegra}` : `/regras`, {
            method: idRegra ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        ui.regras.crudModal.style.display = 'none';
        loadRegrasView();
        showMessage('Regra salva com sucesso!', 'success');
    } catch (e) { showMessage(e.message, 'error'); }
}

async function handleTestarRegra() {
    const btn = ui.regras.btnTestar;
    const originalText = btn.innerHTML;
    btn.textContent = 'Testando...';
    btn.disabled = true;

    try {
        const res = await fetchApi('/regras/testar', {
            method: 'POST',
            body: JSON.stringify({
                id_banco_dados: ui.regras.campoBanco.value,
                consulta_sql: ui.regras.campoSqL.value
            })
        });
        
        let display = '';
        if(res.error) {
            display = `ERRO: ${res.error}`;
        } else {
            display = `Status: ${res.status}\nLinhas retornadas: ${res.rowCount}\n\n${JSON.stringify(res.rows, null, 2)}`;
        }
        ui.regras.campoResultado.value = display;

    } catch (e) { 
        ui.regras.campoResultado.value = "Erro na requisição: " + e.message; 
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- FUNÇÕES DE DELETE (MODAL) ---

function handleDeleteRegraClick(id) {
    idRegraToDelete = id;
    const modal = document.getElementById('modal-delete-regra');
    if(modal) modal.style.display = 'flex';
}

async function executeDeleteRegra() {
    if (!idRegraToDelete) return;
    
    const btn = document.getElementById('btn-del-confirmar');
    const originalText = btn.textContent;
    btn.textContent = "Excluindo...";
    btn.disabled = true;

    try {
        await fetchApi(`/regras/${idRegraToDelete}`, { method: 'DELETE' });
        showMessage("Regra excluída com sucesso!", "success");
        loadRegrasView();
        document.getElementById('modal-delete-regra').style.display = 'none';
    } catch (e) {
        showMessage(e.message, "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        idRegraToDelete = null;
    }
}

// --- AÇÕES PROGRAMADAS (Adiar/Silenciar) ---

function openAcaoModal(id) {
    document.getElementById('acao-id-regra').value = id;
    ui.regras.modal.style.display = 'flex';
}

async function handleAcaoSubmit(e) {
    e.preventDefault();
    const idRegra = document.getElementById('acao-id-regra').value;
    const tipo = document.getElementById('acao-tipo').value;
    const inicio = document.getElementById('acao-inicio').value;
    const fim = document.getElementById('acao-fim').value;

    try {
        await fetchApi(`/regras/${idRegra}/acoes`, {
            method: 'PATCH',
            body: JSON.stringify({ tipo, inicio, fim })
        });
        ui.regras.modal.style.display = 'none';
        loadRegrasView();
        showMessage('Ação programada com sucesso.', 'success');
    } catch(e) {
        showMessage(e.message, 'error');
    }
}

// --- CANCELAR AÇÃO (MODAL) ---

function handleCancelActionClick(id) {
    idRegraToCancelAction = id;
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'flex';
}

async function executeCancelAction() {
    if (!idRegraToCancelAction) return;

    const btn = document.getElementById('btn-conf-executar');
    const originalText = btn.textContent;
    btn.textContent = "Processando...";
    btn.disabled = true;

    try {
        await fetchApi(`/regras/${idRegraToCancelAction}/acoes`, {
            method: 'PATCH',
            body: JSON.stringify({ tipo: 'cancelar' })
        });
        loadRegrasView();
        showMessage('Ação cancelada com sucesso.', 'success');
        document.getElementById('modal-confirmacao').style.display = 'none';
    } catch (e) {
        showMessage(e.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        idRegraToCancelAction = null;
    }
}