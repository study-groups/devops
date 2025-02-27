import { authState } from './auth.js';
import { uiState } from './uiState.js';
import { logMessage } from './log.js';
import { globalFetch } from './globalFetch.js';
import { toggleLog } from './log.js';

// Initialize the UI system - main entry point
export function initializeUI() {
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
        
        if (docPath && uiState?.systemInfo) {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${authState.username}`;
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
    if (uiState?.systemInfo) {
        if (selectedDir === authState.username) {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${authState.username}`;
        } else if (selectedDir) {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}/${selectedDir}`;
        } else {
            docPath.textContent = `📁 ${uiState.systemInfo.MD_DIR}`;
        }
    } else {
        docPath.textContent = `📁 user/${selectedDir || authState.username || ''}`;
    }
}

// Load directories from API
export async function loadDirectories() {
    try {
        logMessage('[UI] Loading directories...');
        
        const dirSelect = document.getElementById('dir-select');
        if (!dirSelect) {
            logMessage('[UI] Directory selector not found in DOM');
            return;
        }
        
        // Clear existing options
        dirSelect.innerHTML = '<option value="">Select Directory</option>';
        
        // Try to fetch directories from the server
        try {
            const response = await globalFetch('/api/files/dirs');
            
            if (response.ok) {
                const dirs = await response.json();
                logMessage(`[UI] Successfully loaded ${dirs.length} directories`);
                
                dirs.forEach(dir => {
                    const option = document.createElement('option');
                    option.value = dir.id;
                    option.textContent = dir.name || dir.id;
                    if (dir.description) {
                        option.title = dir.description;
                    }
                    dirSelect.appendChild(option);
                });
                
                // Set default directory
                if (authState.username) {
                    dirSelect.value = authState.username;
                    logMessage(`[UI] Set directory selector to user directory: ${authState.username}`);
                }
                
                // Trigger change event
                dirSelect.dispatchEvent(new Event('change'));
                return dirs;
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            logMessage(`[UI] Server error when loading directories: ${error.message}`);
            
            // Fallback: Add just the user directory if we have a username
            if (authState.username) {
                const option = document.createElement('option');
                option.value = authState.username;
                option.textContent = `${authState.username} (Your Files)`;
                dirSelect.appendChild(option);
                dirSelect.value = authState.username;
                dirSelect.dispatchEvent(new Event('change'));
                logMessage('[UI] Added fallback directory for user');
            }
        }
    } catch (error) {
        logMessage('[UI ERROR] Failed to load directories: ' + error.message);
        console.error('[UI ERROR]', error);
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
                    
                    // Populate selector
                    dirSelect.innerHTML = '<option value="">Select Directory</option>';
                    dirs.forEach(dir => {
                        const option = document.createElement('option');
                        option.value = dir.id;
                        option.textContent = dir.name;
                        dirSelect.appendChild(option);
                    });
                    
                    if (authState.username) {
                        dirSelect.value = authState.username;
                        dirSelect.dispatchEvent(new Event('change'));
                    }
                    
                    console.log("7. Directory selector populated with alternate endpoint data");
                    return;
                }
                
                throw new Error("Both API endpoints failed");
            }
            
            const dirs = await response.json();
            console.log("4. Successfully fetched directories:", dirs);
            
            // Populate selector
            dirSelect.innerHTML = '<option value="">Select Directory</option>';
            dirs.forEach(dir => {
                const option = document.createElement('option');
                option.value = dir.id;
                option.textContent = dir.name;
                dirSelect.appendChild(option);
            });
            
            if (authState.username) {
                dirSelect.value = authState.username;
                dirSelect.dispatchEvent(new Event('change'));
            }
            
            console.log("5. Directory selector populated successfully");
            
        } catch (error) {
            console.log("ERROR: Failed to fetch directories:", error.message);
            
            // Add fallback directory
            console.log("6. Using fallback with user directory only");
            dirSelect.innerHTML = '<option value="">Select Directory</option>';
            
            if (authState.username) {
                const option = document.createElement('option');
                option.value = authState.username;
                option.textContent = `${authState.username} (Your Files)`;
                dirSelect.appendChild(option);
                dirSelect.value = authState.username;
                dirSelect.dispatchEvent(new Event('change'));
                console.log("7. Added fallback directory for current user");
            }
        }
        
    } catch (error) {
        console.log("CRITICAL ERROR in diagnostics:", error.message);
    }
    
    console.log("============== DIAGNOSTIC COMPLETE ==============");
}

// Display detailed system information
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

// Add a flag to track initialization
let topNavInitialized = false;

// Update the initializeTopNav function to check the flag
export function initializeTopNav() {
    // Return early if already initialized
    if (topNavInitialized) {
        return;
    }
    
    // Connect the existing log button in the top navigation
    const logBtn = document.getElementById('log-btn');
    if (logBtn) {
        // This will only be added once
        logBtn.addEventListener('click', () => {
            toggleLog();
            logMessage('[UI] Log toggled via top navigation');
        });
    }
    
    // Other top nav initialization can go here
    
    // Mark as initialized
    topNavInitialized = true;
    logMessage('[UI] Top navigation initialized (first time only)');
}

// Call this function on page load
document.addEventListener('DOMContentLoaded', initializeTopNav);

// Handle scroll lock toggle
function setupScrollLockToggle() {
    const scrollLockBtn = document.getElementById('scroll-lock-btn');
    if (!scrollLockBtn) return;
    
    scrollLockBtn.addEventListener('click', () => {
        const isLocked = document.body.classList.toggle('scroll-locked');
        
        // Update button state
        scrollLockBtn.classList.toggle('active', isLocked);
        scrollLockBtn.title = isLocked ? 'Unlock scrolling' : 'Lock scrolling';
        
        // Use this instead of anything that might toggle the log
        if (window.handleScrollLockChange) {
            window.handleScrollLockChange();
        }
        
        // Don't call toggleLog here!
    });
} 