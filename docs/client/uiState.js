import { authState } from './auth.js';
import { logMessage } from './utils.js';
import { updateAuthDisplay } from './uiManager.js';

export const UI_STATES = {
    LOGIN: 'login',
    USER: 'user',
    ADMIN: 'admin'
};

export const uiState = {
    current: UI_STATES.LOGIN,
    userInfo: null,
    systemInfo: null
};

export function updateUIState() {
    if (!authState.isLoggedIn) {
        updateAuthDisplay();
        return;
    }
    
    updateAuthDisplay();
}

export function setUIState(state) {
    uiState.current = state;
    updateTopBar();
}

export async function fetchSystemInfo() {
    try {
        const response = await fetch('/api/auth/config');
        uiState.systemInfo = await response.json();
        logMessage('[INFO] System information:');
        logMessage(`[INFO] Document Root: ${uiState.systemInfo.MD_DIR}`);
        logMessage(`[INFO] User Files: ${uiState.systemInfo.MD_DIR}/${authState.username}`);
        logMessage(`[INFO] API Endpoints:`);
        logMessage(`[INFO] - Auth: /api/auth/*`);
        logMessage(`[INFO] - Files: /api/files/*`);
        logMessage(`[INFO] - Images: /api/images/*`);
    } catch (error) {
        logMessage('[INFO ERROR] Failed to fetch system info');
    }
} 