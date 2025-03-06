import { authState } from './auth.js';
import { logMessage } from './log.js';
import { globalFetch } from './globalFetch.js';
import { toggleLog } from './log.js';
import { UI_STATES, uiState, fetchSystemInfo } from './uiState.js';
import { updateTopBar } from './components/topBar.js';

// Initialize the UI system - main entry point
export function initializeUI() {
    updateTopBar();
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMReady);
    } else {
        onDOMReady();
    }
    
    // Register for auth events
    document.addEventListener('auth:login', onAuthStateChanged);
    document.addEventListener('auth:logout', onAuthStateChanged);
}

// Core function called when DOM is ready
function onDOMReady() {
    logMessage('[UI] DOM ready, initializing UI system...');
    
    // Initialize user display
    updateAuthDisplay();
    
    // Set up directory selector
    setupDirectorySelector();
    
    // If user is logged in, load directories
    if (authState.isLoggedIn) {
        logMessage('[UI] User logged in, loading directories...');
        loadDirectories();
    }
}

// Setup the directory selector and its event handlers
function setupDirectorySelector() {
    const dirSelect = document.getElementById('dir-select');
    if (!dirSelect) {
        logMessage('[UI] Directory selector not found in DOM');
        return;
    }
    
    // Add change handler
    dirSelect.addEventListener('change', function() {
        const selectedDir = this.value;
        if (selectedDir) {
            logMessage(`[UI] Directory changed to: ${selectedDir}`);
            
            // Use either fileManager if available or dispatch an event
            if (window.fileManager && window.fileManager.changeDirectory) {
                window.fileManager.changeDirectory(selectedDir);
            } else {
                document.dispatchEvent(new CustomEvent('directory:change', {
                    detail: { directory: selectedDir }
                }));
            }
            
            // Update filesystem status display
            updateFilesystemStatus();
        }
    });
    
    logMessage('[UI] Directory selector initialized');
}

// Called when authentication state changes
function onAuthStateChanged(event) {
    logMessage(`[UI] Auth state changed: ${event.type}`);
    
    // Update UI
    updateAuthDisplay();
    
    // Load directories if logged in
    if (event.type === 'auth:login') {
        loadDirectories();
    }
}

// Update auth-related UI elements
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
        
        if (docPath) {
            if (uiState?.systemInfo?.MD_DIR) {
                docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${authState.username}`;
            } else {
                docPath.textContent = `📁 ${authState.username}`;
            }
        }
        
        loginForm.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        displayElement.textContent = 'Not logged in';
        if (docPath) docPath.textContent = '';
        loginForm.style.display = 'flex';
        logoutBtn.style.display = 'none';
    }

    // Update debug status in log toolbar
    const debugStatus = document.getElementById('debug-status');
    if (debugStatus) {
        debugStatus.textContent = authState?.isLoggedIn ? 
            `${authState.username}` : '?';
    }

    logMessage(`[UI] Display updated: ${authState.isLoggedIn ? 'logged in' : 'logged out'}`);
}

// Update filesystem status display
function updateFilesystemStatus() {
    const docPath = document.getElementById('filesystem-status');
    if (!docPath) return;
    
    // Get the current selected directory
    const dirSelect = document.getElementById('dir-select');
    const selectedDir = dirSelect ? dirSelect.value : '';
    
    // Fetch system info if we don't have it yet
    if (!uiState.systemInfo) {
        globalFetch('/api/auth/config')
            .then(response => response.json())
            .then(info => {
                uiState.systemInfo = info;
                updatePathDisplay(docPath, selectedDir);
            })
            .catch(error => {
                console.error('[UI] Error fetching system info:', error);
            });
    } else {
        updatePathDisplay(docPath, selectedDir);
    }
}

// Helper for updating path display
function updatePathDisplay(docPath, selectedDir) {
    if (uiState?.systemInfo?.MD_DIR) {
        if (selectedDir === authState.username) {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${authState.username}`;
        } else if (selectedDir) {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${selectedDir}`;
        } else {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}`;
        }
    } else {
        // Fall back to a simpler path if systemInfo is not available
        if (selectedDir) {
            docPath.textContent = `📁 ${selectedDir}`;
        } else {
            docPath.textContent = `📁 ${authState.username || ''}`;
        }
    }
}

// Load directories from API
export async function loadDirectories() {
    const dirSelect = document.getElementById('dir-select');
    if (!dirSelect) {
        logMessage('[UI] Directory selector not found');
        return null;
    }
    
    // Get the saved directory from state
    const { getCurrentDirectory } = await import('./fileSystemState.js');
    const savedDirectory = getCurrentDirectory();
    logMessage(`[UI] Saved directory from state: ${savedDirectory || 'none'}`);
    
    // Try to fetch directories from the server
    try {
        const response = await globalFetch('/api/files/dirs');
        
        if (response.ok) {
            const dirs = await response.json();
            logMessage(`[UI] Successfully loaded ${dirs.length} directories`);
            
            // Import the centralized function and use it
            const { updateDirectorySelector } = await import('./fileManager/core.js');
            updateDirectorySelector(dirs, savedDirectory || (authState.username ? authState.username : null));
            
            // Trigger change event
            dirSelect.dispatchEvent(new Event('change'));
            return dirs;
        } else {
            throw new Error(`Failed to load directories: ${response.status}`);
        }
    } catch (error) {
        logMessage(`[UI] Error loading directories: ${error.message}`);
        
        // Use the centralized function for fallback too
        const { updateDirectorySelector } = await import('./fileManager/core.js');
        
        // Add fallback with just the user directory if logged in
        if (authState.username) {
            updateDirectorySelector([{
                id: authState.username,
                name: `${authState.username} (Your Files)`
            }], authState.username);
            
            // Trigger change event
            dirSelect.dispatchEvent(new Event('change'));
        } else {
            // Just clear the selector if not logged in
            updateDirectorySelector([]);
        }
        
        return null;
    }
}

// Start the UI system when window loads
window.addEventListener('load', () => {
    initializeUI();
});

// Direct diagnostic function to help identify the issue
export async function diagnoseDirSelector() {
    try {
        console.log("========= DIRECTORY SELECTOR DIAGNOSTIC =========");
        
        // Check if the select element exists
        const dirSelect = document.getElementById('dir-select');
        console.log("1. Directory select element exists:", !!dirSelect);
        
        if (!dirSelect) {
            console.log("ERROR: Can't find dir-select element in the DOM");
            return;
        }
        
        // Try fetching directories directly
        console.log("2. Attempting to fetch directories from API...");
        
        try {
            const response = await fetch('/api/files/dirs', {
                headers: {
                    'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                }
            });
            
            console.log("3. API response status:", response.status);
            
            if (!response.ok) {
                console.log("ERROR: API returned error status", response.status);
                
                // Try alternate endpoint
                console.log("4. Trying alternate endpoint '/api/markdown/dirs'...");
                const altResponse = await fetch('/api/markdown/dirs', {
                    headers: {
                        'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                    }
                });
                
                console.log("5. Alternate API response status:", altResponse.status);
                
                if (altResponse.ok) {
                    const dirs = await altResponse.json();
                    console.log("6. Success! Found directories at alternate endpoint:", dirs);
                    
                    // Use the centralized function
                    const { updateDirectorySelector } = await import('./fileManager/core.js');
                    updateDirectorySelector(dirs, authState.username);
                    
                    console.log("7. Directory selector populated with alternate endpoint data");
                    return;
                }
                
                throw new Error("Both API endpoints failed");
            }
            
            const dirs = await response.json();
            console.log("4. Successfully fetched directories:", dirs);
            
            // Use the centralized function
            const { updateDirectorySelector } = await import('./fileManager/core.js');
            updateDirectorySelector(dirs, authState.username);
            
            console.log("5. Directory selector populated successfully");
            
        } catch (error) {
            console.log("ERROR: Failed to fetch directories:", error.message);
            
            // Add fallback directory using the centralized function
            console.log("6. Using fallback with user directory only");
            const { updateDirectorySelector } = await import('./fileManager/core.js');
            
            if (authState.username) {
                updateDirectorySelector([{
                    id: authState.username,
                    name: `${authState.username} (Your Files)`
                }], authState.username);
                
                console.log("7. Added fallback directory for current user");
            } else {
                updateDirectorySelector([]);
            }
        }
        
    } catch (error) {
        console.log("CRITICAL ERROR in diagnostics:", error.message);
    }
    
    console.log("============== DIAGNOSTIC COMPLETE ==============");
}

// Display detailed system information - original version
export async function showSystemInfo() {
    try {
        // Fetch system info
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
        
        // Try to fetch stream info
        try {
            // Import the fetchStreamInfo function from fileManager/api.js
            const { fetchStreamInfo } = await import('./fileManager/api.js');
            const streamInfo = await fetchStreamInfo();
            
            // Display stream info
            logMessage('\n=== STREAM INFORMATION ===');
            if (typeof streamInfo === 'object') {
                Object.entries(streamInfo).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                        logMessage(`\n${key}:`);
                        Object.entries(value).forEach(([subKey, subValue]) => {
                            logMessage(`  ${subKey.padEnd(15)} = ${subValue}`);
                        });
                    } else {
                        logMessage(`${key.padEnd(15)} = ${value}`);
                    }
                });
            } else {
                logMessage(JSON.stringify(streamInfo, null, 2));
            }
        } catch (error) {
            logMessage(`\n[NOTE] Stream info not available: ${error.message}`);
        }
        
        logMessage('\n=== END OF SYSTEM INFORMATION ===');
    } catch (error) {
        logMessage(`[ERROR] Failed to fetch system info: ${error.message}`);
        console.error('[SYSTEM ERROR]', error);
    }
}

// Add a flag to track initialization
let topNavInitialized = false;

// Update the initializeTopNav function
export function initializeTopNav() {
    // Return early if already initialized
    if (topNavInitialized) {
        return;
    }
    
    // Connect the existing log button in the top navigation
    const logBtn = document.getElementById('log-btn');
    if (logBtn) {
        // Remove any existing event listeners (just in case)
        logBtn.removeEventListener('click', handleLogButtonClick);
        
        // Add the event listener with a named function for easier debugging
        logBtn.addEventListener('click', handleLogButtonClick);
        console.log('[UI] Log button event listener attached');
    }
    
    // Setup scroll lock toggle
    setupScrollLockToggle();
    
    // Other top nav initialization can go here
    
    // Mark as initialized
    topNavInitialized = true;
    logMessage('[UI] Top navigation initialized (first time only)');
}

// Separate function for handling log button clicks
function handleLogButtonClick(event) {
    // Prevent event propagation to avoid triggering other handlers
    event.stopPropagation();
    event.preventDefault();
    
    console.log('[UI] Log button clicked, calling toggleLog');
    
    // Explicitly toggle the log
    toggleLog('button');
    logMessage('[UI] Log toggled via top navigation');
}

// Call this function on page load
document.addEventListener('DOMContentLoaded', initializeTopNav);

// Handle scroll lock toggle
function setupScrollLockToggle() {
    const scrollLockBtn = document.getElementById('scroll-lock-btn');
    if (!scrollLockBtn) return;
    
    scrollLockBtn.addEventListener('click', (event) => {
        // Prevent event propagation to avoid triggering other handlers
        event.stopPropagation();
        
        const isLocked = document.body.classList.toggle('scroll-locked');
        
        // Update button state
        scrollLockBtn.classList.toggle('active', isLocked);
        scrollLockBtn.title = isLocked ? 'Unlock scrolling' : 'Lock scrolling';
        
        // Use this instead of anything that might toggle the log
        if (window.handleScrollLockChange) {
            window.handleScrollLockChange();
        }
    });
}

// Make sure the function is exported and available globally
window.showSystemInfo = showSystemInfo; 