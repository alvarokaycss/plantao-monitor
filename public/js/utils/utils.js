// public/js/utils/utils.js

export function showMessage(text, type = 'success') {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) return;

    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    messageArea.appendChild(div);
    
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 500);
    }, 4000);
}

export function formatPrioridade(p) { 
    return Number(p) === 1 ? 'Alta' : (Number(p) === 2 ? 'Média' : 'Baixa'); 
}

export function formatStatus(s) { 
    return s === 'ABERTO' ? 'OPEN' : (s === 'RECONHECIDO' ? 'ACK' : 'CLOSE'); 
}

export function formatData(isoDate) { 
    if (!isoDate) return '--'; 
    try { return new Date(isoDate).toLocaleString('pt-BR'); } catch (e) { return '--'; } 
}

export function formatDataCurta(isoDate) { 
    if (!isoDate) return '--'; 
    try { return new Date(isoDate).toLocaleDateString('pt-BR'); } catch (e) { return '--'; } 
}

export function formatRelativeTime(isoDate) {
    if (!isoDate) return '--';

    const diffMs = new Date() - new Date(isoDate);
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `Há ${diffMin} min`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Há ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Há 1 dia';
    return `Há ${diffDays} dias`;
}