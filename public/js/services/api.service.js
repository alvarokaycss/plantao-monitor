// public/js/services/api.service.js

import { BASE_URL } from '../config/config.js';
import { getIdToken, logout } from './auth.service.js';
import { showMessage } from '../utils/utils.js';

export async function fetchApi(endpoint, options = {}) {
    const token = getIdToken();

    if (!token) {
        showMessage("Sessão expirada.", "error");
        logout();
        throw new Error("Token inválido ou sessão expirada.");
    }

    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        },
        cache: 'no-store'
    };

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${endpoint}${separator}_t=${new Date().getTime()}`;

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            let errorData = {};
            try { 
                errorData = await response.json(); 
            } catch (e) { /* Ignora se não for JSON */ }

            // Cria um objeto de erro enriquecido com status e código
            const error = new Error(errorData.error || `Erro API: ${response.statusText}`);
            error.status = response.status;
            error.code = errorData.code;

            // Logout automático apenas para erros críticos de sessão, 
            if (response.status === 401 && error.code !== 'USER_NOT_FOUND_IN_DB') {
                showMessage(errorData.error || "Sessão inválida.", "error");
                logout();
            }

            throw error;
        }

        if (response.status === 204) return null;
        
        return await response.json();

    } catch (error) {
        throw error;
    }
}