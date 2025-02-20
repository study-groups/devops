import { authState } from './auth.js';
import { uiState } from './uiState.js';
import { logMessage } from './utils.js';
import { globalFetch } from './globalFetch.js';

export function updateAuthDisplay() {
    const displayElement = document.getElementById('pwd-display');
    const docPath = document.getElementById('doc-path');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    document.body.setAttribute('data-auth-state', 
        authState.isLoggedIn ? 'logged-in' : 'logged-out'
    );

    if (authState.isLoggedIn) {
        const remainingTime = Math.round((authState.expiresAt - Date.now()) / 1000 / 60);
        displayElement.textContent = `${authState.username} (${remainingTime}m)`;
        
        if (docPath && uiState?.systemInfo) {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${authState.username}`;
        }
        
        loginForm.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        displayElement.textContent = 'Not logged in';
        docPath.textContent = '';
        loginForm.style.display = 'flex';
        logoutBtn.style.display = 'none';
    }
}

export async function showSystemInfo() {
    try {
        const response = await globalFetch('/api/auth/system');
        if (!response.ok) throw new Error('Failed to fetch system info');
        
        const info = await response.json();
        logMessage('\n=== SYSTEM INFORMATION ===');
        
        // Environment
        logMessage('\nEnvironment:');
        Object.entries(info.environment).forEach(([key, value]) => {
            logMessage(`${key.padEnd(15)} = ${value}`);
        });

        // Paths
        logMessage('\nPaths:');
        Object.entries(info.paths).forEach(([key, value]) => {
            logMessage(`${key.padEnd(15)} = ${value}`);
        });

        // Server Stats
        logMessage('\nServer:');
        logMessage(`Uptime         = ${Math.round(info.server.uptime / 60)} minutes`);
        logMessage(`Memory (RSS)   = ${Math.round(info.server.memory.rss / 1024 / 1024)} MB`);
        
        // Active Users
        logMessage('\nActive Users:');
        info.server.activeUsers.forEach(user => {
            const lastSeen = new Date(user.lastSeen).toLocaleTimeString();
            const marker = user.isCurrentUser ? '👤' : '👻';
            logMessage(`${marker} ${user.username.padEnd(15)} (last seen: ${lastSeen})`);
        });

        logMessage('\n======================\n');
    } catch (error) {
        logMessage('[SYSTEM ERROR] Failed to fetch system information');
        console.error('[SYSTEM ERROR]', error);
    }
} 