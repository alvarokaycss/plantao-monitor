// public/js/views/incidentes.view.js

import { ui } from './base.view.js';
import { formatData, formatDataCurta, formatPrioridade, formatStatus, formatRelativeTime, showMessage } from '../utils/utils.js';

// Renderiza os Cards de KPI
export function renderKPIs(data) {
    if (data.plantonista_atual) {
        ui.incidentes.kpiPlantonista.textContent = data.plantonista_atual.nome;
        ui.incidentes.kpiInicio.textContent = `Início: ${formatDataCurta(data.plantonista_atual.data_inicio)}`;
        ui.incidentes.kpiFim.textContent = `Fim: ${formatDataCurta(data.plantonista_atual.data_fim)}`;
    } else {
        ui.incidentes.kpiPlantonista.textContent = 'Nenhum';
    }
    
    ui.incidentes.kpiAbertos.textContent = data.contagens.abertos;
    ui.incidentes.kpiReconhecidos.textContent = data.contagens.reconhecidos;
    ui.incidentes.kpiMtta.textContent = data.metricas.mtta_minutos;
    ui.incidentes.kpiMttr.textContent = data.metricas.mttr_minutos;
}

// Renderiza a lista de incidentes
// Recebe callbacks para os botões (onAck, onClose, onOpenDetalhes)
export function renderIncidentesList(list, callbacks) {
    const container = ui.incidentes.listContainer;
    container.innerHTML = '';
    
    if (!list || list.length === 0) { 
        container.innerHTML = '<div class="loading-placeholder">Nenhum incidente encontrado.</div>'; 
        return; 
    }

    list.forEach(inc => {
        const clone = ui.incidentTemplate.content.cloneNode(true);
        const card = clone.querySelector('.incident-item');
        card.classList.add(`status-${inc.status}`);

        clone.querySelector('.incident-rule-name').textContent = inc.nome_regra || `ID ${inc.id_regra}`;

        // Área de detalhes (clique no card esquerdo)
        const areaDetalhes = clone.querySelector('.incident-details-left');
        areaDetalhes.style.cursor = 'pointer'; 
        areaDetalhes.onclick = () => callbacks.onOpenDetalhes(inc.id_incidente);

        const prio = clone.querySelector('.incident-priority');
        prio.textContent = formatPrioridade(inc.prioridade_registro);
        prio.dataset.priority = inc.prioridade_registro;

        clone.querySelector('.incident-meta').textContent = `${formatStatus(inc.status)} - ${formatData(inc.data_abertura)}`;
        clone.querySelector('.incident-pending').textContent = formatRelativeTime(inc.data_abertura);

        const btnAck = clone.querySelector('.btn-ack');
        const btnClose = clone.querySelector('.btn-close');

        // Estado dos botões
        if (inc.status === 'ABERTO') btnClose.disabled = true;
        else if (inc.status === 'RECONHECIDO') btnAck.disabled = true;
        else { btnAck.disabled = true; btnClose.disabled = true; }

        // Listeners dos botões
        btnAck.onclick = () => callbacks.onAck(inc.id_incidente, btnAck);
        btnClose.onclick = () => {
            const comment = card.querySelector('.comment-input').value.trim();
            callbacks.onClose(inc.id_incidente, comment, btnClose);
        };

        container.appendChild(clone);
    });
}

// Preenche o modal de detalhes (apenas preenche, não busca dados)
export function fillDetalheModal(dados) {
    ui.detalhe.lblStatus.textContent = formatStatus(dados.status);
    ui.detalhe.lblRegra.textContent = dados.nome_regra || 'Regra sem nome';
    ui.detalhe.lblPlantonista.textContent = dados.nome_usuario_ack || '--';
    ui.detalhe.lblAbertura.textContent = formatData(dados.data_abertura);
    ui.detalhe.lblFechamento.textContent = formatData(dados.data_fechamento);
    ui.detalhe.boxComentario.textContent = dados.comentario_incidente || 'Nenhum comentário.';

    if (dados.dados_amostra) {
        ui.detalhe.boxJson.textContent = JSON.stringify(dados.dados_amostra, null, 2);
    } else {
        ui.detalhe.boxJson.textContent = "Sem dados de amostra registrados.";
    }

    renderTimeline(dados.historico, dados);
    updateActionButtons(dados.status);
}

// Helper interno (não exportado se não precisar ser usado fora)
function updateActionButtons(status) {
    ui.detalhe.btnAck.disabled = false;
    ui.detalhe.btnCloseInc.disabled = false;
    
    if (status === 'ABERTO') {
        ui.detalhe.btnCloseInc.disabled = true; 
    } else if (status === 'RECONHECIDO') {
        ui.detalhe.btnAck.disabled = true;
    } else if (status === 'FECHADO') {
        ui.detalhe.btnAck.disabled = true;
        ui.detalhe.btnCloseInc.disabled = true;
    }
}

function renderTimeline(historico, dadosIncidente) {
    const container = ui.detalhe.timeline;
    container.innerHTML = '';

    const eventos = historico || [];

    eventos.forEach(log => {
        const div = document.createElement('div');
        let classeCor = '';
        let titulo = '';
        let meta = {};
        
        if (typeof log.dados_novos === 'string') {
            try { meta = JSON.parse(log.dados_novos); } catch(e) {}
        } else {
            meta = log.dados_novos || {};
        }

        if (meta.acao === 'ACK' || meta.status === 'RECONHECIDO') {
            classeCor = 'acao-ACK';
            titulo = `ACK por ${log.nome_usuario || 'Sistema'}`;
        } else if (meta.status === 'FECHADO' || meta.acao === 'CLOSE') {
            classeCor = 'acao-CLOSE';
            titulo = `CLOSE por ${log.nome_usuario || 'Sistema'}`;
        } else if (meta.msg || meta.acao === 'INSERT') { 
            classeCor = 'acao-CREATE'; 
            if (meta.msg && meta.msg.includes('Reexecução')) {
                titulo = `Reexecução solicitada por ${log.nome_usuario || 'Sistema'}`;
            } else {
                titulo = `Registro por ${log.nome_usuario || 'Sistema'}`;
            }
        } else {
            titulo = `Atualização por ${log.nome_usuario || 'Sistema'}`;
        }

        div.className = `timeline-item ${classeCor}`;
        div.innerHTML = `
            <div class="timeline-header">${titulo}</div>
            <div class="timeline-date">${formatData(log.data_alteracao)}</div>
        `;
        container.appendChild(div);
    });

    const divCreate = document.createElement('div');
    divCreate.className = 'timeline-item acao-CREATE';
    divCreate.innerHTML = `
        <div class="timeline-header">Incidente Criado</div>
        <div class="timeline-desc">Sistema detectou falha na regra.</div>
        <div class="timeline-date">${formatData(dadosIncidente.data_abertura)}</div>
    `;
    container.appendChild(divCreate);
}