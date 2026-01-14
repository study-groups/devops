/**
 * Authentication module
 */

import { store } from './store.js';
import { api } from './api.js';
import { toast } from './toast.js';

const LoginMode = { USERNAME: 'username', MAGIC: 'magic' };

function getLoginMode(identifier) {
    return identifier?.includes('@') && identifier?.includes('.')
        ? LoginMode.MAGIC
        : LoginMode.USERNAME;
}

function createLoginUI(elements) {
    const { passwordField, passwordInput, submitBtn, statusEl } = elements;

    return {
        setMode(mode) {
            const isMagic = mode === LoginMode.MAGIC;
            passwordField.classList.toggle('dimmed', isMagic);
            passwordInput.disabled = isMagic;
            submitBtn.textContent = isMagic ? 'Send Magic Link' : 'Login';
        },
        showStatus(message, type = 'info') {
            statusEl.textContent = message;
            statusEl.className = `login-status visible ${type}`;
        },
        hideStatus() {
            statusEl.className = 'login-status';
        },
        setLoading(loading) {
            submitBtn.disabled = loading;
        },
        setButtonText(text) {
            submitBtn.textContent = text;
        }
    };
}

async function handleMagicLogin(email) {
    const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error || 'Could not send magic link');
    return result;
}

async function handlePasswordLogin(username, password) {
    store.clearAuth();

    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Invalid credentials');
    }

    if (result.token) {
        store.setToken(result.token);
    } else {
        store.set('authCredentials', { username, password });
    }

    return { authenticated: true, user: result.user };
}

async function loadLoginDiagnostics() {
    const diagEl = document.getElementById('login-diagnostics');
    try {
        const status = await fetch('/status').then(r => r.json());
        diagEl.innerHTML = `PD_DIR=${status.pd_dir} | Users: ${status.users || 'N/A'}`;
    } catch (err) {
        diagEl.textContent = '';
    }
}

export function updateAuthDisplay() {
    const userDisplay = document.getElementById('user-display');
    const authBtn = document.getElementById('auth-btn');
    const currentUser = store.get('currentUser');

    if (store.isAuthenticated()) {
        userDisplay.textContent = `${currentUser.username} (${currentUser.role})`;
        authBtn.textContent = 'Logout';
    } else {
        userDisplay.textContent = 'anonymous';
        authBtn.textContent = 'Login';
    }
}

export async function checkAuth() {
    try {
        const result = await api('/auth/user');
        store.set('currentUser', result.user);
        updateAuthDisplay();
    } catch (err) {
        store.setToken(null);
        store.set('currentUser', { username: 'anonymous', role: 'guest', permissions: { can_view: true } });
        updateAuthDisplay();
    }
}

export function logout() {
    store.clearAuth();
    store.set('currentUser', { username: 'anonymous', role: 'guest', permissions: { can_view: true } });
    updateAuthDisplay();
}

export function handleMagicLinkToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const welcome = params.get('welcome');
    const error = params.get('error');

    if (error) {
        setTimeout(() => toast(`Login error: ${error}`, 'error'), 100);
    }

    if (token) {
        store.setToken(token);
        window.history.replaceState({}, '', '/');

        if (welcome === 'new') {
            setTimeout(() => toast('Welcome! New account created.', 'success'), 100);
        } else {
            setTimeout(() => toast('Welcome back!', 'success'), 100);
        }
    }
}

export function init(onLoginSuccess) {
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const identifierInput = loginForm.querySelector('input[name="identifier"]');

    const ui = createLoginUI({
        passwordField: document.getElementById('password-field'),
        passwordInput: loginForm.querySelector('input[name="password"]'),
        submitBtn: document.getElementById('login-submit-btn'),
        statusEl: document.getElementById('login-status')
    });

    function reset() {
        loginForm.reset();
        ui.setMode(LoginMode.USERNAME);
        ui.setLoading(false);
        ui.hideStatus();
    }

    identifierInput.addEventListener('input', () => {
        ui.hideStatus();
        ui.setMode(getLoginMode(identifierInput.value.trim()));
    });

    document.getElementById('auth-btn').addEventListener('click', () => {
        if (store.isAuthenticated()) {
            logout();
            onLoginSuccess?.();
        } else {
            reset();
            loadLoginDiagnostics();
            loginModal.showModal();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = new FormData(e.target).get('identifier').trim();
        const password = new FormData(e.target).get('password');
        const mode = getLoginMode(identifier);

        ui.setLoading(true);

        if (mode === LoginMode.MAGIC) {
            ui.showStatus('Sending magic link...', 'info');
            try {
                const result = await handleMagicLogin(identifier);
                if (result.devMode) {
                    ui.showStatus('DEV MODE: Check server console for magic link', 'warning');
                } else {
                    ui.showStatus(`Check your email! Login link sent to ${identifier}`, 'success');
                }
                ui.setButtonText('Link Sent');
            } catch (err) {
                ui.showStatus(`Failed: ${err.message}`, 'error');
                ui.setLoading(false);
            }
        } else {
            if (!password) {
                ui.showStatus('Password is required for username login', 'error');
                ui.setLoading(false);
                return;
            }
            ui.showStatus('Authenticating...', 'info');
            try {
                const result = await handlePasswordLogin(identifier, password);
                store.set('currentUser', result.user);
                ui.showStatus(`Success! Logged in as ${result.user.username} (${result.user.role})`, 'success');
                setTimeout(() => {
                    updateAuthDisplay();
                    loginModal.close();
                    reset();
                    onLoginSuccess?.();
                }, 500);
            } catch (err) {
                ui.showStatus(`Login failed: ${err.message}`, 'error');
                ui.setLoading(false);
            }
        }
    });

    loginModal.querySelector('.cancel').addEventListener('click', () => {
        reset();
        loginModal.close();
    });

    checkAuth();
}
