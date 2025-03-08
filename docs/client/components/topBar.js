import { UI_STATES, uiState } from '../uiState.js';
import { authState, logout } from '../auth.js';
import { fetchSystemInfo } from '../uiState.js';
import { logMessage } from "../log/index.js";

const userView = `
    <div class="user-container">
        <span id="user-info"></span>
        <span id="doc-path"></span>
        <button id="info-btn">ℹ️ Info</button>
        <button id="logout-btn">Logout</button>
    </div>
`;

const adminView = `
    <div class="admin-container">
        <span id="admin-info">Admin Console</span>
        <button id="view-users-btn">👥 Users</button>
        <button id="info-btn">ℹ️</button>
        <button id="logout-btn">Logout</button>
    </div>
`;

export function updateTopBar() {
    const topBar = document.getElementById('top-bar');
    switch (uiState.current) {
        case UI_STATES.LOGIN:
            topBar.innerHTML = '';
            break;
        case UI_STATES.USER:
            topBar.innerHTML = userView;
            updateUserInfo();
            break;
        case UI_STATES.ADMIN:
            topBar.innerHTML = adminView;
            break;
    }
    attachTopBarHandlers();
}

function updateUserInfo() {
    const userInfo = document.getElementById('user-info');
    const docPath = document.getElementById('doc-path');
    if (userInfo && docPath) {
        const remainingTime = Math.round((authState.expiresAt - Date.now()) / 1000 / 60);
        userInfo.textContent = `Logged in as ${authState.username} (${remainingTime}m)`;
        
        // Only show directory path if systemInfo and MD_DIR are defined
        if (uiState.systemInfo?.MD_DIR) {
            docPath.textContent = `Files: ${uiState.systemInfo.MD_DIR}/${authState.username}`;
        } else {
            docPath.textContent = `Files: ${authState.username}`;
        }
    }
}

function attachTopBarHandlers() {
    document.getElementById('info-btn')?.addEventListener('click', fetchSystemInfo);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    // ... other handlers
} 