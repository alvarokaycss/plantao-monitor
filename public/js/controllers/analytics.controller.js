// public/js/controllers/analytics.controller.js

import { fetchApi } from '../services/api.service.js';
import { ui } from '../views/base.view.js';
import { showMessage } from '../utils/utils.js';

export function initAnalyticsController() {
    if (ui.analytics.btnGerar) {
        ui.analytics.btnGerar.addEventListener('click', handleGerarAnalytics);
    }

    if (ui.analytics.modal) {
        // Fecha ao clicar fora da imagem (no overlay)
        ui.analytics.modal.addEventListener('click', (e) => {
            if (e.target === ui.analytics.modal) {
                ui.analytics.modal.style.display = 'none';
            }
        });
    }
}

async function handleGerarAnalytics() {
    const btn = ui.analytics.btnGerar;
    const originalText = btn.innerHTML; // Preserva o ícone e texto
    
    // UI Feedback
    btn.textContent = 'Gerando Gráfico...';
    btn.disabled = true;

    try {
        // Chama o endpoint que dispara o script Python
        const response = await fetchApi('/analytics/gerar', { method: 'POST' });

        if (response && response.success && response.imageUrl) {
            // Sucesso: Atualiza a imagem e abre o modal
            // O timestamp (?t=...) força o navegador a baixar a imagem nova sem cache
            ui.analytics.imgFull.src = `${response.imageUrl}&t=${new Date().getTime()}`;
            ui.analytics.modal.style.display = 'flex';
            showMessage('Diagnóstico gerado com sucesso!', 'success');
        } else {
            throw new Error(response.error || 'Erro desconhecido ao gerar relatório.');
        }
    } catch (error) {
        console.error("Falha analytics:", error);
        showMessage('Falha na comunicação com o servidor de Analytics.', 'error');
    } finally {
        // Restaura o botão
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}