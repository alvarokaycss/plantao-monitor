// public/js/controllers/escalas.controller.js

import { fetchApi } from '../services/api.service.js';
import { renderEscalasGrid } from '../views/escalas.view.js';
import { showMessage } from '../utils/utils.js';

let usuariosCache = [];
let idEscalaToDelete = null;

export function initEscalasController() {

    const btnAdd = document.getElementById('btn-add-escala');
    if (btnAdd) btnAdd.onclick = () => openEscalaModal();

    const btnCancel = document.getElementById('btn-cancel-escala');
    if (btnCancel) btnCancel.onclick = () => document.getElementById('modal-escala').style.display = 'none';

    // Submit do Formulário (Criar ou Editar)
    const form = document.getElementById('form-escala');
    if (form) form.onsubmit = handleEscalaSubmit;

    // Listener do Input de Busca de Usuário (Datalist)
    // Isso garante que peguemos o ID do usuário selecionado, não apenas o nome
    const inputUser = document.getElementById('escala-usuario-input');
    if (inputUser) {
        inputUser.addEventListener('input', (e) => {
            const val = e.target.value;
            // Busca o usuário na lista carregada pelo nome ou email
            const found = usuariosCache.find(u => u.nome === val || u.email === val);
            // Atualiza o campo oculto com o ID
            document.getElementById('escala-id-usuario').value = found ? found.id_usuario : '';
        });
    }

    // Configuração do Modal de Deleção
    const modalDelete = document.getElementById('modal-delete-escala');
    const btnCancelDelete = document.getElementById('btn-del-escala-fechar');
    const btnConfirmDelete = document.getElementById('btn-del-escala-confirmar');

    if (btnCancelDelete) {
        btnCancelDelete.addEventListener('click', () => {
            modalDelete.style.display = 'none';
            idEscalaToDelete = null;
        });
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', executeDeleteEscala);
    }
}

// --- CARREGAMENTO DA TELA ---

export async function loadEscalasView() {
    try {
        const dados = await fetchApi('/escalas');
        
        // Renderiza o Grid passando os callbacks para os botões de cada card
        renderEscalasGrid(dados, {
            onDelete: confirmDeleteEscala,
            onEdit: openEscalaModal
        });

    } catch (e) {
        console.error(e);
        const grid = document.getElementById('escalas-grid');
        if(grid) grid.innerHTML = '<div class="loading-placeholder" style="color:red">Erro ao carregar escalas.</div>';
    }
}

// FUNÇÕES AUXILIARES

// Formata data ISO para o formato do input datetime-local (YYYY-MM-DDTHH:mm)
function toInputDate(isoStr) {
    if(!isoStr) return '';
    return new Date(isoStr).toISOString().slice(0, 16);
}

// LÓGICA DE CRIAÇÃO / EDIÇÃO 

async function openEscalaModal(escalaParaEditar = null) {
    const modal = document.getElementById('modal-escala');
    const selectRole = document.getElementById('escala-role');
    const dataList = document.getElementById('lista-usuarios');
    const form = document.getElementById('form-escala');
    
    // Reset do Formulário
    form.reset();
    document.getElementById('escala-id-usuario').value = '';
    
    // Garante que o campo hidden de ID de registro exista (usado na edição)
    let hiddenId = document.getElementById('escala-id-registro');
    if (!hiddenId) {
        hiddenId = document.createElement('input');
        hiddenId.type = 'hidden';
        hiddenId.id = 'escala-id-registro';
        form.appendChild(hiddenId);
    }
    hiddenId.value = '';

    // Define Título Dinâmico
    const titulo = modal.querySelector('.modal-header h3');
    titulo.textContent = escalaParaEditar ? 'Editar Plantonista' : 'Adicionar Plantonista';

    try {
       
        const [roles, users] = await Promise.all([
            fetchApi('/roles'),
            fetchApi('/usuarios?ativo=true')
        ]);
        
        usuariosCache = users;

        // Popula Select de Roles
        selectRole.innerHTML = roles.map(r => `<option value="${r.id_role}">${r.nome}</option>`).join('');
        
        // Popula Datalist de Usuários (para busca)
        dataList.innerHTML = users.map(u => `<option value="${u.nome}">${u.email}</option>`).join('');

        // SE FOR EDIÇÃO: Preenche os campos com os dados existentes
        if (escalaParaEditar) {
            document.getElementById('escala-id-registro').value = escalaParaEditar.id_escala;
            document.getElementById('escala-role').value = escalaParaEditar.id_role;
            
            // Encontra o usuário na lista para preencher o nome correto no input visível
            const userObj = users.find(u => u.id_usuario === escalaParaEditar.id_usuario);
            if(userObj) {
                document.getElementById('escala-usuario-input').value = userObj.nome;
                document.getElementById('escala-id-usuario').value = userObj.id_usuario;
            }

            // Preenche as datas formatadas
            document.getElementById('escala-inicio').value = toInputDate(escalaParaEditar.data_inicio);
            document.getElementById('escala-fim').value = toInputDate(escalaParaEditar.data_fim);
        }

        modal.style.display = 'flex';

    } catch (e) {
        showMessage("Erro ao carregar formulário: " + e.message, "error");
    }
}

async function handleEscalaSubmit(e) {
    e.preventDefault();
    
    const idRegistro = document.getElementById('escala-id-registro').value;
    const idUsuario = document.getElementById('escala-id-usuario').value;
    const inputUserText = document.getElementById('escala-usuario-input').value;

    // Validação de Segurança UX: Usuário deve ser selecionado da lista
    if (!idUsuario) {
        showMessage(`Usuário "${inputUserText}" inválido. Selecione da lista.`, "error");
        return;
    }

    const payload = {
        id_usuario: Number(idUsuario),
        id_role: Number(document.getElementById('escala-role').value),
        data_inicio: document.getElementById('escala-inicio').value,
        data_fim: document.getElementById('escala-fim').value
    };

    try {
        if (idRegistro) {
            // PUT (Editar)
            await fetchApi(`/escalas/${idRegistro}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showMessage("Escala atualizada!", "success");
        } else {
            // POST (Criar)
            await fetchApi('/escalas', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showMessage("Plantonista adicionado!", "success");
        }

        document.getElementById('modal-escala').style.display = 'none';
        loadEscalasView(); // Recarrega a tela

    } catch (e) {
        showMessage(e.message, "error");
    }
}

// --- LÓGICA DE DELEÇÃO (MODAL) ---

function confirmDeleteEscala(id) {
    idEscalaToDelete = id;
    const modal = document.getElementById('modal-delete-escala');
    if (modal) modal.style.display = 'flex';
}

async function executeDeleteEscala() {
    if (!idEscalaToDelete) return;

    const btn = document.getElementById('btn-del-escala-confirmar');
    const originalText = btn.textContent;
    btn.textContent = "Removendo...";
    btn.disabled = true;

    try {
        await fetchApi(`/escalas/${idEscalaToDelete}`, { method: 'DELETE' });
        
        showMessage("Escala removida com sucesso.", "success");
        loadEscalasView();
        
        document.getElementById('modal-delete-escala').style.display = 'none';

    } catch (e) {
        showMessage(e.message, "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        idEscalaToDelete = null;
    }
}