import { AUTH_STATE } from '/client/core/auth.js';
import { logMessage } from './log/index.js';
import { globalFetch } from './globalFetch.js';
import { updateAuthDisplay } from './uiManager.js';

export const UI_STATES = {
    LOGIN: 'login',
    USER: 'user',
    ADMIN: 'admin'
};

export let uiState = {
    current: UI_STATES.LOGIN,
    systemInfo: null,
};

export function updateUIState() {
    if (!AUTH_STATE.isLoggedIn) {
        updateAuthDisplay();
        return;
    }
    
    updateAuthDisplay();
}

export function setUIState(newState, data = {}) {
    if (!Object.values(UI_STATES).includes(newState)) {
        console.error(`[UI STATE] Invalid state: ${newState}`);
        return;
    }

    uiState.current = newState;
    console.log(`[UI STATE] Changed to: ${newState}`);

    // Update UI based on the new state
    if (newState === UI_STATES.USER && data.username) {
        // Update user-specific UI elements
        console.log(`[UI STATE] Setting user-specific UI for: ${data.username}`);
    }

    // Dispatch a custom event for UI state change
    document.dispatchEvent(new CustomEvent('ui:stateChange', {
        detail: { state: newState, data }
    }));
}

export async function fetchSystemInfo() {
    try {
        // Check if user is logged in before making request
        if (!AUTH_STATE.isLoggedIn) {
            logMessage('error', 'Cannot fetch system info: User not logged in');
            throw new Error('User not logged in');
        }

        // Use globalFetch instead of native fetch
        const response = await globalFetch('/api/auth/system');
        if (!response.ok) throw new Error(`Failed to fetch system info: ${response.status} ${response.statusText}`);

        const info = await response.json();
        uiState.systemInfo = info;
        console.log('[UI STATE] System info fetched:', info);

        // Dispatch event for system info update
        document.dispatchEvent(new CustomEvent('ui:systemInfo', {
            detail: { systemInfo: info }
        }));
        
        return info;
    } catch (error) {
        console.error('[UI STATE] Failed to fetch system information:', error);
        // Don't set systemInfo to null if it already has a value (keep previous data)
        if (!uiState.systemInfo) {
            // Use fallback values to prevent undefined showing in UI
            uiState.systemInfo = {
                MD_DIR: '',  // Empty string is better than undefined
                version: 'unknown'
            };
        }
        throw error; // Re-throw so callers can handle it
    }
} 