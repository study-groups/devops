import { UI_STATES, uiState } from '../uiState.js';
import { logout } from '/client/core/auth.js';
import { fetchSystemInfo } from '../uiState.js';
import { logMessage } from "../log/index.js";

const userView = `
    <div class="user-container">
        <div class="user-info-container">
            <div class="user-details">
                <span id="username-display"></span>
                <span id="time-remaining-display"></span>
            </div>
        </div>
        
        <span id="doc-path"></span>
        
        <button id="logout-btn" class="mobile-logout-btn">Logout</button>
        
        <div id="codebase-info" class="codebase-info-collapsed">
            <span>📂 Codebase Info (tap to expand)</span>
        </div>
        <div id="codebase-details" class="codebase-info-expanded" style="display: none;">
            <h4>Codebase Structure</h4>
            <div id="codebase-structure"></div>
        </div>
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

    try {
        // Update the page title and any UI elements that might show URL
        const titleElem = document.getElementById('page-title');
        if (titleElem) {
            // Use sanitized title that doesn't include URL parameters
            const path = window.location.pathname;
            const cleanTitle = path.split('/').pop() || 'Home';
            titleElem.textContent = cleanTitle;
        }
        
        // Update any breadcrumbs or navigation elements
        const breadcrumbs = document.getElementById('breadcrumbs');
        if (breadcrumbs) {
            // Create safe breadcrumb that doesn't include URL parameters
            const pathSegments = window.location.pathname.split('/').filter(Boolean);
            
            if (pathSegments.length === 0) {
                breadcrumbs.innerHTML = '<span>Home</span>';
            } else {
                let html = '<span>Home</span>';
                let currentPath = '';
                
                pathSegments.forEach((segment, index) => {
                    currentPath += '/' + segment;
                    const isLast = index === pathSegments.length - 1;
                    
                    if (isLast) {
                        html += ` &gt; <span>${segment}</span>`;
                    } else {
                        html += ` &gt; <a href="${currentPath}">${segment}</a>`;
                    }
                });
                
                breadcrumbs.innerHTML = html;
            }
        }
    } catch (error) {
        console.error('[UI] Error updating top bar:', error);
    }
}

function updateUserInfo() {
    const usernameDisplay = document.getElementById('username-display');
    const timeRemainingDisplay = document.getElementById('time-remaining-display');
    const docPath = document.getElementById('doc-path');
    
    if (usernameDisplay && timeRemainingDisplay && docPath) {
        const remainingTime = Math.round((authState.expiresAt - Date.now()) / 1000 / 60);
        
        // Create simple username and time display
        usernameDisplay.innerHTML = `👤 <strong>${authState.username}</strong>`;
        timeRemainingDisplay.innerHTML = `<span>GDC-2024 (${remainingTime}m)</span>`;
        
        // Format the document path
        if (uiState.systemInfo?.MD_DIR) {
            docPath.innerHTML = `<div>📁 ${uiState.systemInfo.MD_DIR}/${authState.username}</div>`;
        } else {
            docPath.innerHTML = `<div>📁 ${authState.username}</div>`;
        }
    }
}

function attachTopBarHandlers() {
    const logoutBtn = document.getElementById('logout-btn');
    
    // Improve logout button handling
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logMessage('[TopBar] Logout button clicked');
            logout();
        });
        
        // Force the logout button to be visible, especially on mobile
        logoutBtn.style.display = 'block';
        logoutBtn.style.visibility = 'visible';
        logoutBtn.style.opacity = '1';
    }
    
    // Add toggle for codebase info
    const codebaseInfo = document.getElementById('codebase-info');
    const codebaseDetails = document.getElementById('codebase-details');
    
    if (codebaseInfo && codebaseDetails) {
        codebaseInfo.addEventListener('click', () => {
            if (codebaseDetails.style.display === 'none') {
                codebaseDetails.style.display = 'block';
                codebaseInfo.textContent = '📂 Codebase Info (tap to collapse)';
                loadCodebaseStructure();
            } else {
                codebaseDetails.style.display = 'none';
                codebaseInfo.textContent = '📂 Codebase Info (tap to expand)';
            }
        });
    }
}

// Function to load codebase structure
async function loadCodebaseStructure() {
    const structureElement = document.getElementById('codebase-structure');
    if (!structureElement) return;
    
    structureElement.innerHTML = '<p>Loading codebase structure...</p>';
    
    try {
        // Fetch the codebase structure from the server
        const response = await fetch('/api/codebase/structure');
        if (!response.ok) {
            throw new Error('Failed to fetch codebase structure');
        }
        
        const data = await response.json();
        
        // Create a tree-like structure for the codebase
        let html = '<ul class="codebase-tree">';
        
        // Generate the tree HTML based on the data received
        // This is a simplified example - adjust according to your actual data format
        for (const folder of data.folders) {
            html += `<li class="folder"><span class="folder-name">📁 ${folder.name}</span>`;
            
            if (folder.files && folder.files.length > 0) {
                html += '<ul>';
                for (const file of folder.files) {
                    html += `<li class="file">📄 ${file.name}</li>`;
                }
                html += '</ul>';
            }
            
            html += '</li>';
        }
        
        html += '</ul>';
        structureElement.innerHTML = html;
    } catch (error) {
        structureElement.innerHTML = `<p class="error">Error loading codebase structure: ${error.message}</p>`;
        logMessage('[ERROR] Failed to load codebase structure: ' + error.message, 'error');
    }
} 