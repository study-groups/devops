// client/debug/index.js - Consolidated debugging utilities
import { logMessage } from "/client/log/index.js";
import { loadState as loadFileSystemState } from '../fileSystemState.js';
import { globalFetch } from '../globalFetch.js'; // Added for testFileLoading
import { appStore } from '/client/appState.js'; // Use central state
// import { eventBus } from '/client/eventBus.js'; // Removed
// import fileManager from '/client/fileManager.js'; // Removed

// Centralized logger function for this module
function logDebug(message, level = 'debug') { // Default level to debug
    const type = 'DEBUG';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.debug(`[${type}] ${message}`); // Fallback to console.debug
    }
}

// --- App Info ---
export function showAppInfo() {
    const config = window.APP_CONFIG || {
        name: 'DevPages', 
        version: '1.0.0', 
        buildDate: new Date().toISOString().split('T')[0]
    };
    logDebug('\n=== APPLICATION INFORMATION ===');
    logDebug(`Name: ${config.name || 'N/A'}`);
    logDebug(`Version: ${config.version || 'N/A'}`);
    logDebug(`Build Date: ${config.buildDate || 'N/A'}`);
    logDebug('================================');
}

// --- UI Debug ---
export function debugUI() {
    logDebug('[DEBUG] Running UI diagnostics...');
    const content = document.getElementById('content');
    if (content) {
        logDebug(`[DEBUG] Content container: class=${content.className}, display=${getComputedStyle(content).display}`);
    } else {
        logDebug('[DEBUG ERROR] Content container not found');
    }
    const editor = document.getElementById('md-editor');
    if (editor) {
        logDebug(`[DEBUG] Editor: display=${getComputedStyle(editor).display}, width=${getComputedStyle(editor).width}`);
        const textarea = editor.querySelector('textarea');
        if (textarea) {
            logDebug(`[DEBUG] Editor textarea found, content length: ${textarea.value.length} chars`);
        } else {
            logDebug('[DEBUG ERROR] Editor textarea not found');
        }
    } else {
        logDebug('[DEBUG ERROR] Editor not found');
    }
    const preview = document.querySelector(".preview-container");
    if (preview) {
        logDebug(`[DEBUG] Preview: display=${getComputedStyle(preview).display}, width=${getComputedStyle(preview).width}`);
    } else {
        logDebug('[DEBUG ERROR] Preview not found');
    }
    try {
        const fsState = loadFileSystemState();
        logDebug(`[DEBUG] File system state: currentDir=${fsState.currentDir}, currentFile=${fsState.currentFile}`);
    } catch (e) {
        logDebug('[DEBUG ERROR] Could not parse file system state');
    }
    const viewMode = localStorage.getItem('viewMode');
    logDebug(`[DEBUG] Current view mode from localStorage: ${viewMode}`);
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      logDebug(`[DEBUG] Save button found: id=${saveBtn.id}, text=${saveBtn.textContent}`);
    } else {
        logDebug('[DEBUG ERROR] Save button not found');
    }
     const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        logDebug(`[DEBUG] Load button found: id=${loadBtn.id}, text=${loadBtn.textContent}`);
    } else {
        logDebug('[DEBUG ERROR] Load button not found');
    }
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        logDebug(`[DEBUG] File select found: options=${fileSelect.options.length}`);
    } else {
        logDebug('[DEBUG ERROR] File select not found');
    }
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        logDebug(`[DEBUG] Directory select found: options=${dirSelect.options.length}`);
    } else {
        logDebug('[DEBUG ERROR] Directory select not found');
    }
    logDebug('[DEBUG] UI diagnostics complete');
}

// --- API Debug ---
export function testApiEndpoints() {
    logDebug('[DEBUG] Testing API endpoints...');
    fetch('/api/files/list')
        .then(response => {
            logDebug(`[DEBUG] /api/files/list: ${response.status} ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            logDebug(`[DEBUG] Files list received: ${data.length} items`);
        })
        .catch(error => {
            logDebug(`[DEBUG ERROR] Files list failed: ${error.message}`);
        });
    const testFile = 'README.md'; // Use a default/common file
    fetch(`/api/files/get?name=${testFile}`)
        .then(response => {
            logDebug(`[DEBUG] /api/files/get?name=${testFile}: ${response.status} ${response.statusText}`);
            return response.text();
        })
        .then(text => {
            logDebug(`[DEBUG] File content received: ${text.length} chars`);
        })
        .catch(error => {
            logDebug(`[DEBUG ERROR] File get failed: ${error.message}`);
        });
    logDebug('[DEBUG] API endpoint tests initiated');
}

export async function debugApiResponses() {
    logDebug('[DEBUG] Testing API responses...');
    try {
        const dirsResponse = await fetch('/api/files/dirs');
        logDebug(`[DEBUG] /api/files/dirs: ${dirsResponse.status} ${dirsResponse.statusText}`);
        if (dirsResponse.ok) {
            const dirsData = await dirsResponse.json();
            logDebug(`[DEBUG] Directories response type: ${Array.isArray(dirsData) ? 'Array' : typeof dirsData}`);
            logDebug(`[DEBUG] Directories response: ${JSON.stringify(dirsData).substring(0, 200)}...`);
        }
        const filesResponse = await fetch('/api/files/list');
        logDebug(`[DEBUG] /api/files/list: ${filesResponse.status} ${filesResponse.statusText}`);
        if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            logDebug(`[DEBUG] Files response type: ${Array.isArray(filesData) ? 'Array' : typeof filesData}`);
            logDebug(`[DEBUG] Files response: ${JSON.stringify(filesData).substring(0, 200)}...`);
            if (Array.isArray(filesData) && filesData.length > 0) {
                const firstFile = filesData[0];
                logDebug(`[DEBUG] First file type: ${typeof firstFile}`);
                logDebug(`[DEBUG] First file: ${JSON.stringify(firstFile)}`);
            }
        }
        logDebug('[DEBUG] API response tests complete');
    } catch (error) {
        logDebug(`[DEBUG ERROR] API response tests failed: ${error.message}`);
        logDebug('[DEBUG ERROR]', error);
    }
}

// --- File Operations Debug ---
// Note: Removed dependency on debugFileSystemState() as it wasn't defined
// and replaced fileSystemState usage with loadFileSystemState()
export function debugFileOperations() {
    logDebug('[DEBUG] Testing file operations...');
    const fsState = loadFileSystemState();

    if (fsState) {
        logDebug(`[DEBUG] File system state: currentDir=${fsState.currentDir || 'N/A'}, currentFile=${fsState.currentFile || 'N/A'}`);
    } else {
        logDebug('[DEBUG WARN] Could not load file system state for checking fileManager details.');
    }
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    if (dirSelect) {
        logDebug(`[DEBUG] Directory select exists, value: ${dirSelect.value}`);
        if (fsState && fsState.currentDir && dirSelect.value !== fsState.currentDir) {
            logDebug(`[DEBUG WARN] Directory select value (${dirSelect.value}) doesn't match state (${fsState.currentDir})`);
        }
    } else {
        logDebug('[DEBUG ERROR] Directory select not found');
    }
    if (fileSelect) {
        logDebug(`[DEBUG] File select exists, value: ${fileSelect.value}`);
        if (fsState && fsState.currentFile && fileSelect.value !== fsState.currentFile) {
            logDebug(`[DEBUG WARN] File select value (${fileSelect.value}) doesn't match state (${fsState.currentFile})`);
        }
    } else {
        logDebug('[DEBUG ERROR] File select not found');
    }
    const editor = document.querySelector('#md-editor textarea');
    if (editor) {
        logDebug(`[DEBUG] Editor exists, content length: ${editor.value.length} chars`);
    } else {
        logDebug('[DEBUG ERROR] Editor not found');
    }
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        logDebug('[DEBUG] Save button found');
        const saveBtnClone = saveBtn.cloneNode(true); // Simple check
        if (saveBtn.outerHTML !== saveBtnClone.outerHTML) {
             logDebug('[DEBUG] Save button appears to have event handlers'); // May not be accurate
        } else {
            logDebug('[DEBUG WARN] Save button may not have event handlers (heuristic)');
        }
    } else {
        logDebug('[DEBUG ERROR] Save button not found');
    }
    logDebug('[DEBUG] File operations debug complete');
}

export async function testFileLoading() {
    logDebug('[DEBUG] Testing file loading...');
    try {
        const state = loadFileSystemState();
        const currentFile = state.currentFile || 'README.md';
        const currentDir = state.currentDir || '';
        logDebug(`[DEBUG] Testing file loading for: ${currentFile} in ${currentDir || 'root'}`);
        
        const response = await globalFetch(`/api/files/get?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`);
        logDebug(`[DEBUG] /api/files/get response: ${response.status} ${response.statusText}`);
        const responseClone = response.clone();
        try {
            const data = await response.json();
            logDebug(`[DEBUG] Response parsed as JSON: ${typeof data}`);
            if (data.content) {
                logDebug(`[DEBUG] JSON content type: ${typeof data.content}`);
                logDebug(`[DEBUG] JSON content length: ${data.content.length} chars`);
                logDebug(`[DEBUG] JSON content preview: ${data.content.substring(0, 50)}...`);
            } else {
                logDebug(`[DEBUG] JSON data has no content property: ${JSON.stringify(data).substring(0, 100)}...`);
            }
        } catch (e) {
            logDebug(`[DEBUG] JSON parsing failed: ${e.message}`);
            const text = await responseClone.text();
            logDebug(`[DEBUG] Response as text (first 100 chars): ${text.substring(0, 100)}...`);
        }
        logDebug('[DEBUG] File loading test complete');
    } catch (error) {
        logDebug(`[DEBUG ERROR] File loading test failed: ${error.message}`);
        logDebug('[DEBUG ERROR]', error);
    }
}

export function debugFileList() {
    logDebug('[DEBUG] File List Diagnostics');
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        logDebug(`[DEBUG] Directory selector: ${dirSelect.options.length} options`);
        logDebug(`[DEBUG] Current directory value: "${dirSelect.value}"`);
        for (let i = 0; i < dirSelect.options.length; i++) {
            logDebug(`[DEBUG] Dir option ${i}: value="${dirSelect.options[i].value}", text="${dirSelect.options[i].text}"`);
        }
    } else {
        logDebug('[DEBUG] Directory selector not found');
    }
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        logDebug(`[DEBUG] File selector: ${fileSelect.options.length} options`);
        logDebug(`[DEBUG] Current file value: "${fileSelect.value}"`);
        for (let i = 0; i < fileSelect.options.length; i++) {
            logDebug(`[DEBUG] File option ${i}: value="${fileSelect.options[i].value}", text="${fileSelect.options[i].text}"`);
        }
    } else {
        logDebug('[DEBUG] File selector not found');
    }
    try {
        const fsState = loadFileSystemState();
        logDebug(`[DEBUG] FileSystemState in localStorage: ${JSON.stringify(fsState)}`);
    } catch (e) {
        logDebug(`[DEBUG] Error reading localStorage: ${e.message}`);
    }
    logDebug('[DEBUG] Attempting to force reload files...');
    import('../fileManager/operations.js').then(async ({ loadFiles, getCurrentDirectory }) => {
        const dir = getCurrentDirectory();
        logDebug(`[DEBUG] Current directory from state: ${dir}`);
        if (dir !== undefined && dir !== null) { // Check dir has a valid value
            try {
                await loadFiles(dir, true);
                logDebug('[DEBUG] File reload complete');
            } catch (error) {
                logDebug(`[DEBUG] File reload failed: ${error.message}`);
            }
        } else {
            logDebug('[DEBUG] No current directory found in state to reload');
        }
    }).catch(error => {
        logDebug(`[DEBUG] Import error during file reload: ${error.message}`);
    });
}

export async function debugFileLoadingIssues() {
    logDebug('===== FILE LOADING DIAGNOSTIC =====');
    const currentAuthState = appStore.getState().auth;
    logDebug(`[DEBUG] Authentication state: ${currentAuthState.isLoggedIn ? 'Logged in' : 'Not logged in'}`);
    if (currentAuthState.isLoggedIn) {
        logDebug(`[DEBUG] Logged in as: ${currentAuthState.user?.username}`);
        logDebug(`[DEBUG] Has hashed password: ${!!currentAuthState.hashedPassword}`);
    }
    let currentDir = null;
    try {
        const fsState = loadFileSystemState();
        currentDir = fsState.currentDir; // Store for later use
        logDebug(`[DEBUG] Current directory (state): ${fsState.currentDir || 'none'}`);
        logDebug(`[DEBUG] Current file (state): ${fsState.currentFile || 'none'}`);
    } catch (error) {
        logDebug(`[DEBUG ERROR] Failed to load file system state: ${error.message}`);
    }
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    if (dirSelect) {
        logDebug(`[DEBUG] Directory select exists with ${dirSelect.options.length} options`);
        logDebug(`[DEBUG] Current directory value (UI): ${dirSelect.value}`);
        if (!currentDir) currentDir = dirSelect.value; // Fallback to UI value
    } else {
        logDebug('[DEBUG ERROR] Directory select not found');
    }
    if (fileSelect) {
        logDebug(`[DEBUG] File select exists with ${fileSelect.options.length} options`);
        logDebug(`[DEBUG] Current file value (UI): ${fileSelect.value}`);
    } else {
        logDebug('[DEBUG ERROR] File select not found');
    }
    try {
        logDebug('[DEBUG] Attempting to load directories...');
        const { loadDirectories } = await import('../fileManager/operations.js');
        const directories = await loadDirectories();
        logDebug(`[DEBUG] Loaded ${directories.length} directories: ${directories.join(', ')}`);
    } catch (error) {
        logDebug(`[DEBUG ERROR] Failed to load directories: ${error.message}`);
    }
    if (currentDir !== null && currentDir !== undefined && currentDir !== '') {
        try {
            logDebug(`[DEBUG] Attempting to load files for directory: ${currentDir}`);
            const { loadFiles } = await import('../fileManager/operations.js');
            const files = await loadFiles(currentDir, true); // Force reload
            logDebug(`[DEBUG] Loaded ${files.length} files for ${currentDir}`);
        } catch (error) {
            logDebug(`[DEBUG ERROR] Failed to load files for ${currentDir}: ${error.message}`);
        }
    } else {
        logDebug('[DEBUG] No current directory identified to load files for');
    }
    logDebug('===== END FILE LOADING DIAGNOSTIC =====');
}

// --- Auth Debug ---
export function testAuthStatus() {
    logDebug('[DEBUG] --- Testing Auth Status ---');
    try {
        const currentAuthState = appStore.getState().auth;
        logDebug(`[DEBUG] Current auth state (from appStore): ${JSON.stringify(currentAuthState)}`);

        const loginForm = document.getElementById('login-form');
        const logoutBtn = document.getElementById('logout-btn');
        const statusDisplay = document.getElementById('auth-status-display');

        if (!loginForm || !logoutBtn || !statusDisplay) {
            logDebug('[DEBUG][ERROR] Auth related DOM elements not found!', 'error');
            return;
        }

        logDebug(`[DEBUG] Login form display: ${loginForm.style.display}`);
        logDebug(`[DEBUG] Logout button display: ${logoutBtn.style.display}`);
        logDebug(`[DEBUG] Status display text: ${statusDisplay.textContent}`);
        logDebug(`[DEBUG] Body data-auth-state: ${document.body.getAttribute('data-auth-state')}`);

        // Check if UI matches reactive state
        if (currentAuthState.isLoggedIn) {
            if (loginForm.style.display !== 'none') logDebug('[DEBUG][WARN] Login form should be hidden when authenticated.', 'warning');
            if (logoutBtn.style.display === 'none') logDebug('[DEBUG][WARN] Logout button should be visible when authenticated.', 'warning');
            if (!statusDisplay.textContent?.includes(currentAuthState.user?.username || '')) logDebug(`[DEBUG][WARN] Status display should show username '${currentAuthState.user?.username}'.`, 'warning');
        } else {
            if (loginForm.style.display === 'none') logDebug('[DEBUG][WARN] Login form should be visible when not authenticated.', 'warning');
            if (logoutBtn.style.display !== 'none') logDebug('[DEBUG][WARN] Logout button should be hidden when not authenticated.', 'warning');
            if (!statusDisplay.textContent?.includes('Not Logged In')) logDebug('[DEBUG][WARN] Status display should show "Not Logged In".', 'warning');
        }
        logDebug('[DEBUG] --- Auth Status Test Complete ---');

    } catch (error) {
        logDebug(`[DEBUG][ERROR] Error during auth status test: ${error.message}`, 'error');
    }
}

export function debugAuthState() {
    logDebug('===== AUTH STATE DEBUG =====');
    try {
        const storedAuth = localStorage.getItem('authState');
        if (storedAuth) {
            const parsedAuth = JSON.parse(storedAuth);
            logDebug(`[AUTH DEBUG] localStorage: ${JSON.stringify({
                isLoggedIn: parsedAuth.isLoggedIn,
                username: parsedAuth.username,
                loginTime: parsedAuth.loginTime ? new Date(parsedAuth.loginTime).toLocaleString() : 'N/A',
                expiresAt: parsedAuth.expiresAt ? new Date(parsedAuth.expiresAt).toLocaleString() : 'N/A',
                hasHashedPassword: !!parsedAuth.hashedPassword
            })}`);
        } else {
            logDebug('[AUTH DEBUG] No auth data in localStorage');
        }
    } catch (error) {
        logDebug(`[AUTH DEBUG] Error reading localStorage: ${error.message}`);
    }
    const currentAuthState = appStore.getState().auth;
    logDebug(`[AUTH DEBUG] Memory appStore.auth: ${JSON.stringify({
        isLoggedIn: currentAuthState.isLoggedIn,
        username: currentAuthState.user?.username,
        loginTime: currentAuthState.loginTime ? new Date(currentAuthState.loginTime).toLocaleString() : 'N/A',
        expiresAt: currentAuthState.expiresAt ? new Date(currentAuthState.expiresAt).toLocaleString() : 'N/A',
        hasHashedPassword: !!currentAuthState.hashedPassword
    })}`);
    try {
        const sessionAuth = sessionStorage.getItem('authState');
        if (sessionAuth) {
            logDebug(`[AUTH DEBUG] Session storage has auth data (unexpected)`);
        }
    } catch (error) { /* Ignore */ }
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const pwdDisplay = document.getElementById('pwd-display');
    logDebug(`[AUTH DEBUG] UI State: 
        - Login form visible: ${!loginForm || loginForm.style.display !== 'none'}
        - Logout button visible: ${!!logoutBtn && logoutBtn.style.display !== 'none'}
        - Display text: ${pwdDisplay ? pwdDisplay.textContent : 'Not found'}`);
    logDebug('[AUTH DEBUG] Testing API authentication...');
    const authHeader = currentAuthState.isLoggedIn ? {
         'Authorization': `Basic ${btoa(`${currentAuthState.user?.username}:${currentAuthState.hashedPassword || ''}`)}`
        } : {};
    logDebug('[DEBUG] Constructed auth header for API tests (if logged in).');
    fetch('/api/files/dirs', { headers: authHeader })
    .then(response => {
        logDebug(`[AUTH DEBUG] API test response: ${response.status} ${response.statusText}`);
        return response.text();
    })
    .then(text => {
        try { JSON.parse(text); logDebug('[AUTH DEBUG] API returned valid JSON.'); }
        catch (e) { logDebug(`[AUTH DEBUG] API returned non-JSON: ${text.substring(0, 50)}...`); }
    })
    .catch(error => {
        logDebug(`[AUTH DEBUG] API test failed: ${error.message}`);
    });
    logDebug('===== END AUTH DEBUG =====');
}


// --- URL Debug ---
export function debugUrlParameters() {
    logDebug('[DEBUG] Testing URL parameter handling...');
    const urlParams = new URLSearchParams(window.location.search);
    const urlDir = urlParams.get('dir');
    const urlFile = urlParams.get('file');
    logDebug(`[DEBUG] URL parameters: dir=${urlDir || 'none'}, file=${urlFile || 'none'}`);
    const state = loadFileSystemState();
    logDebug(`[DEBUG] File system state: dir=${state.currentDir || 'none'}, file=${state.currentFile || 'none'}`);
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    if (dirSelect) {
        logDebug(`[DEBUG] Directory select value: ${dirSelect.value || 'none'}`);
        if (urlDir) {
            const dirOption = Array.from(dirSelect.options).find(opt => opt.value === urlDir);
            logDebug(`[DEBUG] URL directory ${urlDir} ${dirOption ? 'found' : 'not found'} in options`);
        }
    }
    if (fileSelect) {
        logDebug(`[DEBUG] File select value: ${fileSelect.value || 'none'}`);
        if (urlFile) {
            const fileOption = Array.from(fileSelect.options).find(opt => opt.value === urlFile);
            logDebug(`[DEBUG] URL file ${urlFile} ${fileOption ? 'found' : 'not found'} in options`);
        }
    }
    logDebug('[DEBUG] URL parameter test complete');
}

// --- Endpoint Debug --- (Consolidated from multiple functions)
export async function debugAllApiEndpoints() {
    logDebug('[DEBUG] Testing key API endpoints...');
    const state = loadFileSystemState();
    const currentFile = state.currentFile || 'README.md';
    const currentDir = state.currentDir || '';
    const currentAuthState = appStore.getState().auth;
    const authHeader = currentAuthState.isLoggedIn ? {
         'Authorization': `Basic ${btoa(`${currentAuthState.user?.username}:${currentAuthState.hashedPassword || ''}`)}`
        } : {};
    logDebug('[DEBUG] Constructed auth header for API tests (if logged in).');

    try {
        logDebug('[DEBUG] Fetching /api/files/dirs with potentially added auth...');
        const dirsResponse = await fetch('/api/files/dirs', { headers: authHeader });
        logDebug(`[DEBUG] /api/files/dirs response: ${dirsResponse.status} ${dirsResponse.statusText}`);
        if (dirsResponse.ok) {
            const dirsData = await dirsResponse.json();
            logDebug(`[DEBUG] Directories response type: ${Array.isArray(dirsData) ? 'Array' : typeof dirsData}`);
            logDebug(`[DEBUG] Directories response: ${JSON.stringify(dirsData).substring(0, 200)}...`);
        }
        const filesResponse = await fetch('/api/files/list');
        logDebug(`[DEBUG] /api/files/list: ${filesResponse.status} ${filesResponse.statusText}`);
        if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            logDebug(`[DEBUG] Files response type: ${Array.isArray(filesData) ? 'Array' : typeof filesData}`);
            logDebug(`[DEBUG] Files response: ${JSON.stringify(filesData).substring(0, 200)}...`);
            if (Array.isArray(filesData) && filesData.length > 0) {
                const firstFile = filesData[0];
                logDebug(`[DEBUG] First file type: ${typeof firstFile}`);
                logDebug(`[DEBUG] First file: ${JSON.stringify(firstFile)}`);
            }
        }
        logDebug('[DEBUG] API response tests complete');
    } catch (error) {
        logDebug(`[DEBUG ERROR] API response tests failed: ${error.message}`);
        logDebug('[DEBUG ERROR]', error);
    }
}

/**
 * Diagnose docs loading issues
 */
export async function diagnoseDocs() {
    logDebug('[DOCS DIAGNOSIS] Starting docs loading diagnosis...');
    
    try {
        // 1. Check authentication status
        const authState = appStore.getState().auth;
        logDebug(`[DOCS DIAGNOSIS] Auth Status:`, 'info');
        logDebug(`  - Authenticated: ${authState.isAuthenticated}`);
        logDebug(`  - User: ${authState.user?.username || 'None'}`);
        logDebug(`  - Initializing: ${authState.isInitializing}`);
        logDebug(`  - Error: ${authState.error || 'None'}`);
        
        // 2. Check file manager state
        const fileState = appStore.getState().file;
        logDebug(`[DOCS DIAGNOSIS] File Manager State:`, 'info');
        logDebug(`  - Current Pathname: ${fileState.currentPathname || 'None'}`);
        logDebug(`  - Is Directory: ${fileState.isDirectorySelected}`);
        logDebug(`  - Is Loading: ${fileState.isLoading}`);
        logDebug(`  - Error: ${fileState.error || 'None'}`);
        
        // 3. Test basic API connectivity
        logDebug(`[DOCS DIAGNOSIS] Testing API connectivity...`);
        try {
            const response = await fetch('/api/auth/user', {
                credentials: 'include'
            });
            logDebug(`  - Auth API Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const userData = await response.json();
                logDebug(`  - Auth API Response: ${JSON.stringify(userData)}`);
            }
        } catch (apiError) {
            logDebug(`  - Auth API Error: ${apiError.message}`, 'error');
        }
        
        // 4. Test file listing API
        logDebug(`[DOCS DIAGNOSIS] Testing file listing API...`);
        try {
            const listResponse = await fetch('/api/files/list?pathname=', {
                credentials: 'include'
            });
            logDebug(`  - File List API Status: ${listResponse.status} ${listResponse.statusText}`);
            
            if (listResponse.ok) {
                const listData = await listResponse.json();
                logDebug(`  - Available directories: ${JSON.stringify(listData.dirs || [])}`);
                logDebug(`  - Available files: ${JSON.stringify(listData.files || [])}`);
            } else {
                const errorText = await listResponse.text();
                logDebug(`  - File List API Error: ${errorText}`, 'error');
            }
        } catch (listError) {
            logDebug(`  - File List API Error: ${listError.message}`, 'error');
        }
        
        // 5. Check if there's a specific file to test
        const currentPath = fileState.currentPathname;
        if (currentPath && !fileState.isDirectorySelected) {
            logDebug(`[DOCS DIAGNOSIS] Testing current file loading: ${currentPath}`);
            try {
                const fileResponse = await fetch(`/api/files/content?pathname=${encodeURIComponent(currentPath)}`, {
                    credentials: 'include'
                });
                logDebug(`  - File Content API Status: ${fileResponse.status} ${fileResponse.statusText}`);
                
                if (fileResponse.ok) {
                    const content = await fileResponse.text();
                    logDebug(`  - File Content Length: ${content.length} chars`);
                    logDebug(`  - Content Preview: ${content.substring(0, 100)}...`);
                } else {
                    const errorText = await fileResponse.text();
                    logDebug(`  - File Content API Error: ${errorText}`, 'error');
                }
            } catch (fileError) {
                logDebug(`  - File Content API Error: ${fileError.message}`, 'error');
            }
        }
        
        // 6. Check browser console for any errors
        logDebug(`[DOCS DIAGNOSIS] Browser Info:`, 'info');
        logDebug(`  - User Agent: ${navigator.userAgent}`);
        logDebug(`  - Cookies: ${document.cookie ? 'Present' : 'None'}`);
        logDebug(`  - Local Storage Auth: ${localStorage.getItem('authState') ? 'Present' : 'None'}`);
        
        // 7. Recommendations
        logDebug(`[DOCS DIAGNOSIS] Recommendations:`, 'info');
        if (!authState.isAuthenticated) {
            logDebug(`  - Please log in to access files`, 'warning');
        }
        if (fileState.error) {
            logDebug(`  - File manager has error: ${fileState.error}`, 'warning');
        }
        if (!fileState.currentPathname) {
            logDebug(`  - No file currently selected`, 'info');
        }
        
        logDebug('[DOCS DIAGNOSIS] Diagnosis complete. Check the logs above for issues.');
        
    } catch (error) {
        logDebug(`[DOCS DIAGNOSIS] Error during diagnosis: ${error.message}`, 'error');
        console.error('[DOCS DIAGNOSIS] Error:', error);
    }
}

// --- Last Opened File Persistence Debug ---
export async function debugLastOpenedFilePersistence() {
    logDebug('[DEBUG] Testing last opened file persistence...');
    
    // Check what's currently in localStorage
    const lastFile = localStorage.getItem('devpages_last_file');
    const lastDir = localStorage.getItem('devpages_last_directory');
    logDebug(`[DEBUG] Current localStorage: file="${lastFile || 'none'}", dir="${lastDir || 'none'}"`);
    
    // Check app state
    const state = appStore.getState();
    const currentFile = state.file?.currentPathname;
    const isDir = state.file?.isDirectorySelected;
    logDebug(`[DEBUG] Current app state: pathname="${currentFile || 'none'}", isDirectory=${isDir}`);
    
    // Test the loadLastOpened function
    try {
        const { loadLastOpened } = await import('/client/store/reducers/fileReducer.js');
        const lastOpened = loadLastOpened();
        logDebug(`[DEBUG] loadLastOpened() returned:`, lastOpened);
    } catch (error) {
        logDebug(`[DEBUG] Error testing loadLastOpened: ${error.message}`, 'error');
    }
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlPathname = urlParams.get('pathname');
    logDebug(`[DEBUG] URL pathname parameter: "${urlPathname || 'none'}"`);
    
    logDebug('[DEBUG] Last opened file persistence test complete');
}

// --- Editor Debug ---
export function debugEditorState() {
    logDebug('[DEBUG] Testing editor state...');
    
    // Check if editor panel exists
    const editorPanel = document.querySelector('#editor-panel');
    const textarea = document.querySelector('#editor-panel textarea');
    logDebug(`[DEBUG] Editor panel: ${editorPanel ? 'found' : 'missing'}`);
    logDebug(`[DEBUG] Textarea: ${textarea ? 'found' : 'missing'}`);
    
    if (textarea) {
        logDebug(`[DEBUG] Textarea content length: ${textarea.value?.length || 0}`);
        logDebug(`[DEBUG] Textarea first 100 chars: "${(textarea.value || '').substring(0, 100)}"`);
    }
    
    // Check app state
    const state = appStore.getState();
    const content = state.file?.content;
    const pathname = state.file?.currentPathname;
    logDebug(`[DEBUG] App state content length: ${content?.length || 0}`);
    logDebug(`[DEBUG] App state pathname: "${pathname || 'none'}"`);
    logDebug(`[DEBUG] App state content first 100 chars: "${(content || '').substring(0, 100)}"`);
    
    // Check if editor panel instance exists on window
    if (window.editorPanel) {
        logDebug(`[DEBUG] Window.editorPanel exists`);
        try {
            const editorContent = window.editorPanel.getValue();
            logDebug(`[DEBUG] EditorPanel.getValue() length: ${editorContent?.length || 0}`);
        } catch (error) {
            logDebug(`[DEBUG] Error calling editorPanel.getValue(): ${error.message}`, 'error');
        }
    } else {
        logDebug(`[DEBUG] Window.editorPanel not found`);
    }
    
    logDebug('[DEBUG] Editor state test complete');
}

// --- Force Editor Refresh ---
export function forceRefreshEditor() {
    logDebug('[DEBUG] Force refreshing editor from app state...');
    
    try {
        const state = appStore.getState();
        const content = state.file?.content || '';
        
        // Try multiple ways to update the editor
        const textarea = document.querySelector('#editor-panel textarea');
        if (textarea) {
            textarea.value = content;
            logDebug(`[DEBUG] Updated textarea directly with ${content.length} chars`);
            
            // Trigger change event
            const changeEvent = new Event('input', { bubbles: true });
            textarea.dispatchEvent(changeEvent);
            logDebug(`[DEBUG] Dispatched input event on textarea`);
        }
        
        // Try the editor panel method
        if (window.editorPanel && typeof window.editorPanel.setValue === 'function') {
            window.editorPanel.setValue(content);
            logDebug(`[DEBUG] Called editorPanel.setValue() with ${content.length} chars`);
        }
        
        logDebug('[DEBUG] Force editor refresh complete');
    } catch (error) {
        logDebug(`[DEBUG] Error in force refresh: ${error.message}`, 'error');
    }
}

// --- Preview Debug ---
export function debugPreviewPanel() {
    logDebug('[DEBUG] Testing preview panel...');
    
    // Check if preview panel exists
    const previewPanel = document.querySelector('#preview-panel');
    const previewContainer = document.querySelector('#preview-container');
    logDebug(`[DEBUG] Preview panel: ${previewPanel ? 'found' : 'missing'}`);
    logDebug(`[DEBUG] Preview container: ${previewContainer ? 'found' : 'missing'}`);
    
    // Check app state for content
    const state = appStore.getState();
    const content = state.file?.content;
    const pathname = state.file?.currentPathname;
    logDebug(`[DEBUG] App state content length: ${content?.length || 0}`);
    logDebug(`[DEBUG] App state pathname: "${pathname || 'none'}"`);
    
    // Check window.previewPanel
    if (window.previewPanel) {
        logDebug(`[DEBUG] Window.previewPanel exists`);
        try {
            logDebug(`[DEBUG] PreviewPanel container:`, window.previewPanel.previewContainer);
        } catch (error) {
            logDebug(`[DEBUG] Error accessing previewPanel: ${error.message}`, 'error');
        }
    } else {
        logDebug(`[DEBUG] Window.previewPanel not found`);
    }
    
    // Force a preview update
    if (window.previewPanel && typeof window.previewPanel.updatePreview === 'function') {
        logDebug(`[DEBUG] Forcing preview update...`);
        window.previewPanel.updatePreview();
    }
    
    logDebug('[DEBUG] Preview panel test complete');
}

// --- Preview Settings Integration Debug ---
export async function debugPreviewSettingsIntegration() {
    logDebug('[DEBUG] Testing preview settings integration...');
    
    // Check if both panels exist
    const previewPanel = window.previewPanel;
    const previewSettingsPanel = window.previewSettingsPanel;
    
    logDebug(`[DEBUG] PreviewPanel: ${previewPanel ? 'found' : 'missing'}`);
    logDebug(`[DEBUG] PreviewSettingsPanel: ${previewSettingsPanel ? 'found' : 'missing'}`);
    
    // Check current settings in store
    if (typeof appStore !== 'undefined') {
        const state = appStore.getState();
        const previewSettings = state.settings?.preview || {};
        logDebug(`[DEBUG] Current preview settings in store:`, previewSettings);
        
        // Test reading settings from PreviewPanel
        if (previewPanel && typeof previewPanel.getPreviewSettings === 'function') {
            const panelSettings = previewPanel.getPreviewSettings();
            logDebug(`[DEBUG] Settings as read by PreviewPanel:`, panelSettings);
        }
    }
    
    // Test updating a setting
    logDebug('[DEBUG] Testing debounce delay update...');
    const testDelay = 300;
    
    if (previewSettingsPanel && typeof previewSettingsPanel.updateSetting === 'function') {
        previewSettingsPanel.updateSetting('debounceDelay', testDelay);
        logDebug(`[DEBUG] Updated debounce delay to ${testDelay}ms via PreviewSettingsPanel`);
        
        // Check if it was updated in store
        setTimeout(() => {
            if (typeof appStore !== 'undefined') {
                const newState = appStore.getState();
                const newDelay = newState.settings?.preview?.debounceDelay;
                logDebug(`[DEBUG] Debounce delay in store after update: ${newDelay}ms`);
                logDebug(`[DEBUG] Update successful: ${newDelay === testDelay ? 'YES' : 'NO'}`);
                
                // Test if PreviewPanel picks up the change
                if (previewPanel && typeof previewPanel.getPreviewSettings === 'function') {
                    const panelSettings = previewPanel.getPreviewSettings();
                    logDebug(`[DEBUG] Debounce delay as read by PreviewPanel: ${panelSettings.debounceDelay}ms`);
                }
            }
        }, 100);
    } else {
        logDebug('[DEBUG] PreviewSettingsPanel updateSetting method not available');
    }
    
    // Test eventBus integration
    if (window.eventBus) {
        logDebug('[DEBUG] Testing eventBus integration...');
        window.eventBus.emit('preview:settingsChanged', { testSetting: 'testValue' });
        logDebug('[DEBUG] Emitted preview:settingsChanged event');
    }
    
    logDebug('[DEBUG] Preview settings integration test complete');
}

// --- Preview Basic Debug ---
export function debugPreviewBasics() {
    logDebug('[DEBUG] === PREVIEW BASICS DEBUG ===');
    
    // Check if preview panel exists
    const previewPanel = window.previewPanel;
    logDebug(`PreviewPanel object: ${!!previewPanel}`);
    
    if (previewPanel) {
        logDebug(`PreviewPanel container: ${!!previewPanel.previewContainer}`);
        if (previewPanel.previewContainer) {
            logDebug(`Container ID: ${previewPanel.previewContainer.id}`);
            logDebug(`Container innerHTML length: ${previewPanel.previewContainer.innerHTML.length}`);
            logDebug(`Container visible: ${previewPanel.previewContainer.offsetWidth > 0 && previewPanel.previewContainer.offsetHeight > 0}`);
        }
    }
    
    // Check DOM for preview containers
    const previewContainers = document.querySelectorAll('#preview-container, .preview-container, [data-panel-type="preview"]');
    logDebug(`Found ${previewContainers.length} preview container(s) in DOM`);
    previewContainers.forEach((container, i) => {
        logDebug(`Container ${i}: ID=${container.id}, class=${container.className}, content length=${container.innerHTML.length}`);
    });
    
    // Check app state
    if (typeof appStore !== 'undefined') {
        const state = appStore.getState();
        const file = state.file || {};
        logDebug(`App state file content length: ${file.content?.length || 0}`);
        logDebug(`App state current pathname: ${file.currentPathname || 'none'}`);
        logDebug(`App state is directory: ${file.isDirectorySelected}`);
    }
    
    // Test manual preview update
    if (previewPanel && typeof previewPanel.updatePreview === 'function') {
        logDebug('Testing manual preview update...');
        previewPanel.updatePreview();
        
        // Also try with test content
        setTimeout(() => {
            logDebug('Testing with manual content...');
            const testContent = '# Test Preview\n\nThis is a test preview content.';
            if (typeof previewPanel.performPreviewUpdate === 'function') {
                previewPanel.performPreviewUpdate(testContent, 'test.md');
            }
        }, 500);
    }
    
    logDebug('[DEBUG] === PREVIEW BASICS DEBUG COMPLETE ===');
}

// Expose debug functions to window for console access
if (typeof window !== 'undefined') {
    window.debugLastOpenedFilePersistence = debugLastOpenedFilePersistence;
    window.debugEditorState = debugEditorState;
    window.forceRefreshEditor = forceRefreshEditor;
    window.debugPreviewPanel = debugPreviewPanel;
    window.debugPreviewSettingsIntegration = debugPreviewSettingsIntegration;
    window.debugPreviewBasics = debugPreviewBasics;
}