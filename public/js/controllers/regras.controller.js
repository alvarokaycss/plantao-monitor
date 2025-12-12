// public/js/controllers/regras.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { renderRegrasTable } from '../views/regras.view.js';
import { showMessage } from '../utils/utils.js';

let regrasCache = [];
let bancosCache = [];
let rolesCache = [];
let canaisCache = []; 

// Variáveis de estado
let idRegraToDelete = null;
let idRegraToCancelAction = null;

export function initRegrasController() {
    // Listeners Principais
    if (ui.regras.addBtn) ui.regras.addBtn.addEventListener('click', () => openRegraModal('new'));
    if (ui.regras.btnCancelCrud) ui.regras.btnCancelCrud.addEventListener('click', () => ui.regras.crudModal.style.display = 'none');
    if (ui.regras.crudForm) ui.regras.crudForm.addEventListener('submit', handleRegraSubmit);
    if (ui.regras.btnTestar) ui.regras.btnTestar.addEventListener('click', handleTestarRegra);
    
    // Listener Adicionar
    const btnAddPasso = document.getElementById('btn-add-passo');
    if (btnAddPasso) btnAddPasso.addEventListener('click', () => addEscalonamentoRow());

    // Filtros
    if (ui.regras.search) ui.regras.search.onkeyup = applyRegrasFilters;
    if (ui.regras.filterPrioridade) ui.regras.filterPrioridade.onchange = applyRegrasFilters;
    
    // Modais Ações/Delete
    setupActionModals();
}

// --- SETUP E CARREGAMENTO ---

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
        onDelete: handleDeleteRegraClick,
        onOpenAction: openAcaoModal,
        onCancelAction: handleCancelActionClick
    });
}

async function setupRegraForm() {
    if (bancosCache.length > 0 && canaisCache.length > 0) return;

    try {
        // Agora buscamos Tipos de Canal também
        const [bancos, roles, canais] = await Promise.all([ 
            fetchApi('/bancos'), 
            fetchApi('/roles'),
            fetchApi('/tipos_canal_notificacao')
        ]);
        
        bancosCache = bancos; 
        rolesCache = roles;
        canaisCache = canais;
        
        // Popula Selects Estáticos
        ui.regras.campoBanco.innerHTML = bancos.map(b => `<option value="${b.id_banco_dados}">${b.tipo_banco}</option>`).join('');
        
        // Popula Checkboxes de Roles (Notificação Inicial)
        ui.regras.rolesContainer.innerHTML = roles.map(r => 
            `<label style="display: flex; gap: 5px; align-items: center;"><input type="checkbox" value="${r.id_role}"> ${r.nome}</label>`
        ).join('');
        
        ui.regras.campoPrioridade.innerHTML = `<option value="3">Baixa</option><option value="2">Média</option><option value="1">Alta</option>`;

    } catch (e) { showMessage('Erro ao carregar dependências do formulário.', 'error'); }
}

// --- ABERTURA DO MODAL (CRUD) ---

async function openRegraModal(modeOrId) {
    await setupRegraForm();
    ui.regras.crudForm.reset();
    ui.regras.regraId.value = '';
    
    // Limpa checkboxes e lista de escalonamento
    ui.regras.rolesContainer.querySelectorAll('input').forEach(chk => chk.checked = false);
    document.getElementById('container-passos-escalonamento').innerHTML = '<p class="help-text" id="msg-sem-escalonamento">Nenhum escalonamento configurado.</p>';
    
    if (modeOrId !== 'new') {
        const idRegra = Number(modeOrId);
        ui.regras.crudTitle.textContent = 'Editar Regra';
        ui.regras.regraId.value = idRegra;
        
        try {
            // Busca detalhes completos (incluindo escalonamento)
            const data = await fetchApi(`/regras/${idRegra}/detalhes`);
            const info = data.info; 
            
            // Preenche campos básicos
            ui.regras.campoNome.value = info.nome;
            ui.regras.campoSqL.value = info.consulta_sql;
            ui.regras.campoBanco.value = info.id_banco_dados;
            ui.regras.campoDescricao.value = info.descricao || '';
            ui.regras.campoFrequencia.value = info.intervalo_minutos;
            ui.regras.campoErros.value = info.qnt_erro_max;
            ui.regras.campoPrioridade.value = info.prioridade;
            ui.regras.campoJanelaInicio.value = info.janela_inicio ? info.janela_inicio.substring(0, 5) : '00:00';
            ui.regras.campoJanelaFim.value = info.janela_fim ? info.janela_fim.substring(0, 5) : '23:59';
            
            // Preenche Roles (Notificação Inicial)
            let rolesIds = [];
            // Tenta pegar do cache da lista ou usa o que veio do detalhes se disponível
            const regraLista = regrasCache.find(r => r.id_regra == idRegra);
            if (regraLista && regraLista.roles_id) rolesIds = regraLista.roles_id;
            
            const sIds = rolesIds.map(String);
            ui.regras.rolesContainer.querySelectorAll('input').forEach(chk => {
                if (sIds.includes(chk.value)) chk.checked = true;
            });

            // Preenche Escalonamento
            if (data.escalonamento && data.escalonamento.length > 0) {
                // Limpa mensagem de "nenhum"
                document.getElementById('container-passos-escalonamento').innerHTML = '';
                // Adiciona cada linha
                data.escalonamento.forEach(passo => {
                    addEscalonamentoRow(passo.minutos_apos_abertura, passo.id_role_destino, passo.id_tipo_canal);
                });
            }

        } catch(e) { 
            console.error(e);
            showMessage('Erro ao carregar detalhes.', 'error');
        }
    } else {
        ui.regras.crudTitle.textContent = 'Nova Regra';
        // Defaults
        ui.regras.campoFrequencia.value = 5;
        ui.regras.campoErros.value = 1;
        ui.regras.campoPrioridade.value = 3;
        ui.regras.campoJanelaInicio.value = '00:00';
        ui.regras.campoJanelaFim.value = '23:59';
    }
    
    ui.regras.crudModal.style.display = 'flex';
}

// --- MANIPULAÇÃO DE LINHAS DE ESCALONAMENTO ---

function addEscalonamentoRow(minutos = 15, roleId = '', canalId = '') {
    const container = document.getElementById('container-passos-escalonamento');
    const msgEmpty = document.getElementById('msg-sem-escalonamento');
    if (msgEmpty) msgEmpty.remove();

    const row = document.createElement('div');
    row.className = 'escalonamento-row';
    
    // Monta Options de Role e Canal
    const optionsRoles = rolesCache.map(r => `<option value="${r.id_role}" ${r.id_role == roleId ? 'selected' : ''}>${r.nome}</option>`).join('');
    const optionsCanais = canaisCache.map(c => `<option value="${c.id_tipo_canal}" ${c.id_tipo_canal == canalId ? 'selected' : ''}>${c.nome}</option>`).join('');

    row.innerHTML = `
        <span>Após</span>
        <input type="number" class="input-minutos" value="${minutos}" min="1" style="width:50px">
        <span>min</span>
        <select class="select-role" title="Role Destino">${optionsRoles}</select>
        <select class="select-canal" title="Canal">${optionsCanais}</select>
        <button type="button" class="btn-remove-passo" title="Remover">X</button>
    `;

    // Botão Remover
    row.querySelector('.btn-remove-passo').addEventListener('click', () => {
        row.remove();
        if (container.children.length === 0) {
            container.innerHTML = '<p class="help-text" id="msg-sem-escalonamento">Nenhum escalonamento configurado.</p>';
        }
    });

    container.appendChild(row);
}

// --- SUBMIT (SALVAR) ---

async function handleRegraSubmit(e) {
    e.preventDefault();
    const idRegra = ui.regras.regraId.value;
    
    // 1. Coleta Roles Iniciais
    const roles = Array.from(ui.regras.rolesContainer.querySelectorAll('input:checked')).map(c => Number(c.value));
    if (roles.length === 0) { showMessage('Selecione pelo menos uma role inicial.', 'error'); return; }

    // 2. Coleta Escalonamento
    const escalonamento = [];
    const rows = document.querySelectorAll('.escalonamento-row');
    rows.forEach(row => {
        const min = row.querySelector('.input-minutos').value;
        const role = row.querySelector('.select-role').value;
        const canal = row.querySelector('.select-canal').value;
        
        if (min && role && canal) {
            escalonamento.push({
                minutos: Number(min),
                role: Number(role),
                canal: Number(canal)
            });
        }
    });

    // 3. Payload Completo
    const payload = {
        id_banco_dados: Number(ui.regras.campoBanco.value),
        nome: ui.regras.campoNome.value,
        consulta_sql: ui.regras.campoSqL.value,
        intervalo_minutos: Number(ui.regras.campoFrequencia.value),
        qnt_erro_max: Number(ui.regras.campoErros.value),
        prioridade: Number(ui.regras.campoPrioridade.value),
        roles: roles,
        escalonamento: escalonamento,
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

// --- OUTRAS FUNÇÕES (Testar, Delete, Ações) ---

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
        ui.regras.campoResultado.value = res.error ? `ERRO: ${res.error}` : `Status: ${res.status}\nRows: ${res.rowCount}\n\n${JSON.stringify(res.rows, null, 2)}`;
    } catch (e) { 
        ui.regras.campoResultado.value = "Erro: " + e.message; 
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function setupActionModals() {
    // Configura listeners dos modais secundários (Ação e Delete)
    if (ui.regras.btnCancelAcao) ui.regras.btnCancelAcao.addEventListener('click', () => ui.regras.modal.style.display = 'none');
    if (ui.regras.formAcoes) ui.regras.formAcoes.addEventListener('submit', handleAcaoSubmit);

    const modalDelete = document.getElementById('modal-delete-regra');
    if (document.getElementById('btn-del-fechar')) document.getElementById('btn-del-fechar').addEventListener('click', () => modalDelete.style.display = 'none');
    if (document.getElementById('btn-del-confirmar')) document.getElementById('btn-del-confirmar').addEventListener('click', executeDeleteRegra);

    const modalCancel = document.getElementById('modal-confirmacao');
    if (document.getElementById('btn-conf-fechar')) document.getElementById('btn-conf-fechar').addEventListener('click', () => modalCancel.style.display = 'none');
    if (document.getElementById('btn-conf-executar')) document.getElementById('btn-conf-executar').addEventListener('click', executeCancelAction);
}

// ... Funções auxiliares de Delete e Ação ...
function handleDeleteRegraClick(id) {
    idRegraToDelete = id;
    document.getElementById('modal-delete-regra').style.display = 'flex';
}

async function executeDeleteRegra() {
    if(!idRegraToDelete) return;
    try {
        await fetchApi(`/regras/${idRegraToDelete}`, { method: 'DELETE' });
        showMessage("Regra excluída!", "success");
        loadRegrasView();
        document.getElementById('modal-delete-regra').style.display = 'none';
    } catch(e) { showMessage(e.message, "error"); }
}

function openAcaoModal(id) {
    document.getElementById('acao-id-regra').value = id;
    ui.regras.modal.style.display = 'flex';
}

async function handleAcaoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('acao-id-regra').value;
    try {
        await fetchApi(`/regras/${id}/acoes`, {
            method: 'PATCH',
            body: JSON.stringify({
                tipo: document.getElementById('acao-tipo').value,
                inicio: document.getElementById('acao-inicio').value,
                fim: document.getElementById('acao-fim').value
            })
        });
        ui.regras.modal.style.display = 'none';
        loadRegrasView();
        showMessage('Ação programada.', 'success');
    } catch(e) { showMessage(e.message, 'error'); }
}

function handleCancelActionClick(id) {
    idRegraToCancelAction = id;
    document.getElementById('modal-confirmacao').style.display = 'flex';
}

async function executeCancelAction() {
    if(!idRegraToCancelAction) return;
    try {
        await fetchApi(`/regras/${idRegraToCancelAction}/acoes`, { method: 'PATCH', body: JSON.stringify({ tipo: 'cancelar' }) });
        loadRegrasView();
        showMessage('Cancelado.', 'success');
        document.getElementById('modal-confirmacao').style.display = 'none';
    } catch(e) { showMessage(e.message, 'error'); }
}