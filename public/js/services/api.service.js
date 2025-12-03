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

    // Timestamp anti-cache
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${endpoint}${separator}_t=${new Date().getTime()}`;

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            let errorData = {};
            try { 
                errorData = await response.json(); 
            } catch (e) { /* Ignora se não for JSON */ }

            // Tratamento específico de erro de sessão
            if (response.status === 401 || (response.status === 403 && errorData.code === "USER_INACTIVE")) {
                showMessage(errorData.error || "Sessão inválida.", "error");
                logout();
            }

            throw new Error(errorData.error || `Erro API: ${response.statusText}`);
        }

        if (response.status === 204) return null;
        
        return await response.json();

    } catch (error) {
        throw error;
    }
}