// public/js/services/auth.service.js

import { firebaseConfig } from '../config/config.js';

let auth = null;
let idToken = null;

/**
 * Inicializa o Firebase e configura o listener de estado
 * @param {Function} onUserChanged - Callback chamada quando o estado do usuário muda (user ou null)
 */
export function initAuth(onUserChanged) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                idToken = await user.getIdToken(true);
                onUserChanged(user);
            } catch (error) {
                console.error("Erro ao obter token:", error);
                idToken = null;
                onUserChanged(null);
            }
        } else {
            idToken = null;
            onUserChanged(null);
        }
    });
}

export function getIdToken() {
    return idToken;
}

export async function login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

export async function register(email, password, name) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    if (name) {
        await cred.user.updateProfile({ displayName: name });
    }
    // Força refresh para garantir que o token venha atualizado se necessário
    await cred.user.getIdToken(true);
    return cred.user;
}

export async function logout() {
    return auth.signOut();
}