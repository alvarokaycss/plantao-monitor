// public/js/controllers/incidentes.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { renderKPIs, renderIncidentesList, fillDetalheModal } from '../views/incidentes.view.js';
import { showMessage } from '../utils/utils.js';

let currentIncidenteId = null;        // ID do incidente aberto no modal de detalhes
let idIncidenteParaAcao = null;       // ID temporário para ações (Reexecute/Close)

export function initIncidentesController() {
    // Filtros da lista
    if (ui.incidentes.filterBtn) ui.incidentes.filterBtn.addEventListener('click', () => loadIncidentesView());
    
    // Configura botões e modais de ação
    setupDetalheActions();
    setupModalsListeners();
}

// --- Carregamento de Dados ---

export async function loadIncidentesView(isBackgroundUpdate = false) {
    if (!isBackgroundUpdate) {
        ui.incidentes.listContainer.innerHTML = '<div class="loading-placeholder">Carregando dados...</div>';
    }
    
    try {
        const [kpi, list] = await Promise.all([ 
            fetchApi('/kpis'), 
            fetchIncidentes() 
        ]);
        
        renderKPIs(kpi);
        renderIncidentesList(list, {
            onAck: handleAckList,
            onClose: handleCloseList,
            onOpenDetalhes: openDetalheIncidente
        });
    } catch (e) { 
        console.error(e);
        if (!isBackgroundUpdate) {
            ui.incidentes.listContainer.innerHTML = '<div class="loading-placeholder" style="color:red">Erro ao carregar dados.</div>'; 
        }
    }
}

async function fetchIncidentes() {
    const p = new URLSearchParams();
    if (ui.incidentes.filterStatus.value) p.append('status', ui.incidentes.filterStatus.value);
    if (ui.incidentes.filterPrioridade.value) p.append('prioridade', ui.incidentes.filterPrioridade.value);
    return fetchApi(`/incidentes?${p}`);
}

// --- Ações da LISTA (Cards) ---

async function handleAckList(id, btnElement) {
    await performAck(id, btnElement);
}

async function handleCloseList(id, comment, btnElement) {
    if (!comment) { showMessage('Comentário obrigatório para fechar.', 'error'); return; }
    await performClose(id, comment, btnElement);
}

// --- Ações do MODAL DE DETALHES ---

export async function openDetalheIncidente(id) {
    currentIncidenteId = id;
    ui.detalhe.modal.style.display = 'flex';
    // Feedback visual
    ui.detalhe.timeline.innerHTML = '<div style="padding:20px; text-align:center">Carregando histórico...</div>';
    
    try {
        const dados = await fetchApi(`/incidentes/${id}/detalhes`);
        fillDetalheModal(dados);
    } catch (e) {
        showMessage("Erro ao carregar detalhes: " + e.message, 'error');
        // Não fecha o modal automaticamente para permitir retry ou leitura do erro
    }
}

function setupDetalheActions() {
    // Botão X do modal principal
    if (ui.detalhe.btnClose) {
        ui.detalhe.btnClose.onclick = () => { 
            ui.detalhe.modal.style.display = 'none'; 
            currentIncidenteId = null; 
        };
    }

    // Botão ACK (Dentro do detalhe)
    if (ui.detalhe.btnAck) {
        ui.detalhe.btnAck.onclick = async () => {
            if (!currentIncidenteId) return;
            await performAck(currentIncidenteId, ui.detalhe.btnAck);
        };
    }

    // Botão CLOSE (Dentro do detalhe -> Abre Modal de Comentário)
    if (ui.detalhe.btnCloseInc) {
        ui.detalhe.btnCloseInc.onclick = () => {
            if (!currentIncidenteId) return;
            idIncidenteParaAcao = currentIncidenteId;
            
            // Prepara o modal de fechamento
            ui.modals.closeIncident.inputComment.value = '';
            ui.modals.closeIncident.modal.style.display = 'flex';
            setTimeout(() => ui.modals.closeIncident.inputComment.focus(), 100);
        };
    }

    // Botão REEXECUTE (Dentro do detalhe -> Abre Modal de Confirmação)
    if (ui.detalhe.btnReexecute) {
        ui.detalhe.btnReexecute.onclick = () => {
            if (!currentIncidenteId) return;
            idIncidenteParaAcao = currentIncidenteId;
            ui.modals.reexecute.modal.style.display = 'flex';
        };
    }
}

// --- Listeners dos Modais de Confirmação ---

function setupModalsListeners() {
    // 1. Modal Reexecute
    const mReexec = ui.modals.reexecute;
    if (mReexec.btnCancel) mReexec.btnCancel.onclick = () => { mReexec.modal.style.display = 'none'; };
    
    if (mReexec.btnConfirm) {
        mReexec.btnConfirm.onclick = async () => {
            if (!idIncidenteParaAcao) return;
            
            const btn = mReexec.btnConfirm;
            const originalText = btn.textContent;
            btn.textContent = "Agendando...";
            btn.disabled = true;

            try {
                await fetchApi(`/incidentes/${idIncidenteParaAcao}/reexecute`, { method: 'POST' });
                showMessage("Reexecução agendada!", "success");
                mReexec.modal.style.display = 'none';
                
                // Atualiza dados se estiver vendo o detalhe
                if(currentIncidenteId === idIncidenteParaAcao) openDetalheIncidente(currentIncidenteId);
            } catch (e) {
                showMessage("Erro: " + e.message, "error");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }

    // 2. Modal Close Incident
    const mClose = ui.modals.closeIncident;
    if (mClose.btnCancel) mClose.btnCancel.onclick = () => { mClose.modal.style.display = 'none'; };

    if (mClose.btnConfirm) {
        mClose.btnConfirm.onclick = async () => {
            if (!idIncidenteParaAcao) return;
            
            const comment = mClose.inputComment.value.trim();
            if (!comment) { showMessage("Comentário é obrigatório.", "error"); return; }

            const btn = mClose.btnConfirm;
            const originalText = btn.textContent;
            btn.textContent = "Fechando...";
            btn.disabled = true;

            try {
                await performClose(idIncidenteParaAcao, comment, null); // null pois o btn é do modal, não da lista
                mClose.modal.style.display = 'none';
            } catch (e) {
                // Erro já tratado no performClose, mas precisamos resetar o botão aqui
                btn.textContent = originalText;
                btn.disabled = false;
            } finally {
                // Se deu sucesso, o performClose já atualiza a UI
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }
}

// --- Funções Auxiliares de API ---

async function performAck(id, btnElement) {
    if(btnElement) { btnElement.disabled = true; }
    
    try {
        await fetchApi(`/incidentes/${id}/ack`, { method: 'POST' });
        // showMessage('Incidente Reconhecido (ACK).', 'success'); // 
        
        // Atualiza UI
        loadIncidentesView(true); // Atualiza lista
        if (currentIncidenteId === id) openDetalheIncidente(id); // Atualiza modal se aberto
        
    } catch (e) {
        showMessage(e.message, 'error');
        if(btnElement) { btnElement.textContent = "ACK"; btnElement.disabled = false; }
    }
}

async function performClose(id, comment, btnElement) {
    if(btnElement) btnElement.disabled = true;

    try {
        await fetchApi(`/incidentes/${id}/close`, { 
            method: 'POST', 
            body: JSON.stringify({ comentario_incidente: comment }) 
        });
        showMessage('Incidente Fechado.', 'success');
        
        // Atualiza UI
        loadIncidentesView(true);
        if (currentIncidenteId === id) openDetalheIncidente(id);

    } catch (e) {
        showMessage(e.message, 'error');
        if(btnElement) btnElement.disabled = false;
        throw e; // Re-throw para o modal tratar o botão
    }
}