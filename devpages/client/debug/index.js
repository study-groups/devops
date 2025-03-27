// client/debug/index.js - Consolidated debugging utilities
import { logMessage } from "../log/index.js";
import { AUTH_STATE } from '/client/core/auth.js';
import { loadFileSystemState } from '../fileSystemState.js';
import { eventBus } from '../eventBus.js';

// Debug UI state and components
export function debugUI() {
    logMessage('[DEBUG] Running UI diagnostics...');
    
    // Check content container
    const content = document.getElementById('content');
    if (content) {
        logMessage(`[DEBUG] Content container: class=${content.className}, display=${getComputedStyle(content).display}`);
    } else {
        logMessage('[DEBUG ERROR] Content container not found');
    }
    
    // Check editor
    const editor = document.getElementById('md-editor');
    if (editor) {
        logMessage(`[DEBUG] Editor: display=${getComputedStyle(editor).display}, width=${getComputedStyle(editor).width}`);
        const textarea = editor.querySelector('textarea');
        if (textarea) {
            logMessage(`[DEBUG] Editor textarea found, content length: ${textarea.value.length} chars`);
        }
    }
    
    // Check file system state
    const fsState = loadFileSystemState();
    logMessage(`[DEBUG] File system state: ${JSON.stringify(fsState)}`);
    
    // Check auth state
    const eventBusState = eventBus.getAuthState();
    logMessage(`[DEBUG] Auth state: ${JSON.stringify({
        local: {
            isLoggedIn: AUTH_STATE.isLoggedIn,
            username: AUTH_STATE.username
        },
        eventBus: {
            isAuthenticated: eventBusState.isAuthenticated,
            username: eventBusState.username
        }
    })}`);
}

// Debug file operations
export async function debugFileOperations() {
    logMessage('[DEBUG] Testing file operations...');
    
    const fsState = loadFileSystemState();
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select: ${dirSelect.options.length} options, value="${dirSelect.value}"`);
    }
    
    if (fileSelect) {
        logMessage(`[DEBUG] File select: ${fileSelect.options.length} options, value="${fileSelect.value}"`);
    }
    
    // Test file loading
    if (fsState.currentFile && fsState.currentDir) {
        try {
            const response = await fetch(`/api/files/get?name=${encodeURIComponent(fsState.currentFile)}&dir=${encodeURIComponent(fsState.currentDir)}`);
            logMessage(`[DEBUG] File load test: ${response.status} ${response.statusText}`);
        } catch (error) {
            logMessage(`[DEBUG ERROR] File load test failed: ${error.message}`);
        }
    }
}

// Debug auth state
export function debugAuthState() {
    logMessage('[DEBUG] Auth State Diagnostics');
    
    // Check localStorage
    const storedAuth = localStorage.getItem('authState');
    if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        logMessage(`[DEBUG] Stored auth: ${JSON.stringify(parsedAuth)}`);
    }
    
    // Check memory states
    logMessage(`[DEBUG] Memory states:
        Local auth: ${JSON.stringify(AUTH_STATE)}
        Event bus: ${JSON.stringify(eventBus.getAuthState())}`);
    
    // Check token expiration
    if (AUTH_STATE.expiresAt) {
        const remaining = AUTH_STATE.expiresAt - Date.now();
        logMessage(`[DEBUG] Token expires in: ${Math.round(remaining/60000)} minutes`);
    }
}

// Debug API endpoints
export async function debugApiEndpoints() {
    logMessage('[DEBUG] Testing API endpoints...');
    
    const endpoints = [
        '/api/files/list',
        '/api/files/dirs',
        '/api/auth/status'
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);
            logMessage(`[DEBUG] ${endpoint}: ${response.status} ${response.statusText}`);
        } catch (error) {
            logMessage(`[DEBUG ERROR] ${endpoint} failed: ${error.message}`);
        }
    }
}

// Register debug functions globally if in development
if (process.env.NODE_ENV === 'development') {
    window.debugUI = debugUI;
    window.debugFileOperations = debugFileOperations;
    window.debugAuthState = debugAuthState;
    window.debugApiEndpoints = debugApiEndpoints;
} 