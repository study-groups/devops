// client/debug/index.js - Consolidated debugging utilities
import { logMessage } from "/client/log/index.js";
import { loadFileSystemState } from '../fileSystemState.js';
import { globalFetch } from '../globalFetch.js'; // Added for testFileLoading
import { AUTH_STATE } from '/client/auth.js'; // Added for testAuthStatus and others

// --- App Info ---
export function showAppInfo() {
    const config = window.APP_CONFIG || {
        name: 'DevPages', 
        version: '1.0.0', 
        buildDate: new Date().toISOString().split('T')[0]
    };
    logMessage('\n=== APPLICATION INFORMATION ===');
    logMessage(`Name: ${config.name || 'N/A'}`);
    logMessage(`Version: ${config.version || 'N/A'}`);
    logMessage(`Build Date: ${config.buildDate || 'N/A'}`);
    logMessage('================================');
}

// --- UI Debug ---
export function debugUI() {
    logMessage('[DEBUG] Running UI diagnostics...');
    const content = document.getElementById('content');
    if (content) {
        logMessage(`[DEBUG] Content container: class=${content.className}, display=${getComputedStyle(content).display}`);
    } else {
        logMessage('[DEBUG ERROR] Content container not found');
    }
    const editor = document.getElementById('md-editor');
    if (editor) {
        logMessage(`[DEBUG] Editor: display=${getComputedStyle(editor).display}, width=${getComputedStyle(editor).width}`);
        const textarea = editor.querySelector('textarea');
        if (textarea) {
            logMessage(`[DEBUG] Editor textarea found, content length: ${textarea.value.length} chars`);
        } else {
            logMessage('[DEBUG ERROR] Editor textarea not found');
        }
    } else {
        logMessage('[DEBUG ERROR] Editor not found');
    }
    const preview = document.getElementById('md-preview');
    if (preview) {
        logMessage(`[DEBUG] Preview: display=${getComputedStyle(preview).display}, width=${getComputedStyle(preview).width}`);
    } else {
        logMessage('[DEBUG ERROR] Preview not found');
    }
    try {
        const fsState = loadFileSystemState(); // Use imported function
        logMessage(`[DEBUG] File system state: currentDir=${fsState.currentDir}, currentFile=${fsState.currentFile}`);
    } catch (e) {
        logMessage('[DEBUG ERROR] Could not parse file system state');
    }
    const viewMode = localStorage.getItem('viewMode');
    logMessage(`[DEBUG] Current view mode from localStorage: ${viewMode}`);
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      logMessage(`[DEBUG] Save button found: id=${saveBtn.id}, text=${saveBtn.textContent}`);
    } else {
        logMessage('[DEBUG ERROR] Save button not found');
    }
     const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        logMessage(`[DEBUG] Load button found: id=${loadBtn.id}, text=${loadBtn.textContent}`);
    } else {
        logMessage('[DEBUG ERROR] Load button not found');
    }
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        logMessage(`[DEBUG] File select found: options=${fileSelect.options.length}`);
    } else {
        logMessage('[DEBUG ERROR] File select not found');
    }
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select found: options=${dirSelect.options.length}`);
    } else {
        logMessage('[DEBUG ERROR] Directory select not found');
    }
    logMessage('[DEBUG] UI diagnostics complete');
}

// --- API Debug ---
export function testApiEndpoints() {
    logMessage('[DEBUG] Testing API endpoints...');
    fetch('/api/files/list')
        .then(response => {
            logMessage(`[DEBUG] /api/files/list: ${response.status} ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            logMessage(`[DEBUG] Files list received: ${data.length} items`);
        })
        .catch(error => {
            logMessage(`[DEBUG ERROR] Files list failed: ${error.message}`);
        });
    const testFile = 'README.md'; // Use a default/common file
    fetch(`/api/files/get?name=${testFile}`)
        .then(response => {
            logMessage(`[DEBUG] /api/files/get?name=${testFile}: ${response.status} ${response.statusText}`);
            return response.text();
        })
        .then(text => {
            logMessage(`[DEBUG] File content received: ${text.length} chars`);
        })
        .catch(error => {
            logMessage(`[DEBUG ERROR] File get failed: ${error.message}`);
        });
    logMessage('[DEBUG] API endpoint tests initiated');
}

export async function debugApiResponses() {
    logMessage('[DEBUG] Testing API responses...');
    try {
        const dirsResponse = await fetch('/api/files/dirs');
        logMessage(`[DEBUG] /api/files/dirs: ${dirsResponse.status} ${dirsResponse.statusText}`);
        if (dirsResponse.ok) {
            const dirsData = await dirsResponse.json();
            logMessage(`[DEBUG] Directories response type: ${Array.isArray(dirsData) ? 'Array' : typeof dirsData}`);
            logMessage(`[DEBUG] Directories response: ${JSON.stringify(dirsData).substring(0, 200)}...`);
        }
        const filesResponse = await fetch('/api/files/list');
        logMessage(`[DEBUG] /api/files/list: ${filesResponse.status} ${filesResponse.statusText}`);
        if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            logMessage(`[DEBUG] Files response type: ${Array.isArray(filesData) ? 'Array' : typeof filesData}`);
            logMessage(`[DEBUG] Files response: ${JSON.stringify(filesData).substring(0, 200)}...`);
            if (Array.isArray(filesData) && filesData.length > 0) {
                const firstFile = filesData[0];
                logMessage(`[DEBUG] First file type: ${typeof firstFile}`);
                logMessage(`[DEBUG] First file: ${JSON.stringify(firstFile)}`);
            }
        }
        logMessage('[DEBUG] API response tests complete');
    } catch (error) {
        logMessage(`[DEBUG ERROR] API response tests failed: ${error.message}`);
        console.error('[DEBUG ERROR]', error);
    }
}

// --- File Operations Debug ---
// Note: Removed dependency on debugFileSystemState() as it wasn't defined
// and replaced fileSystemState usage with loadFileSystemState()
export function debugFileOperations() {
    logMessage('[DEBUG] Testing file operations...');
    if (window.fileManager) {
        logMessage(`[DEBUG] fileManager is available`);
        logMessage(`[DEBUG] Current directory: ${window.fileManager.currentDir}`);
    } else {
        logMessage('[DEBUG ERROR] fileManager is not available');
    }
    const fsState = loadFileSystemState(); // Use imported function
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select exists, value: ${dirSelect.value}`);
        if (fsState && fsState.currentDir && dirSelect.value !== fsState.currentDir) {
            logMessage(`[DEBUG WARN] Directory select value (${dirSelect.value}) doesn't match state (${fsState.currentDir})`);
        }
    } else {
        logMessage('[DEBUG ERROR] Directory select not found');
    }
    if (fileSelect) {
        logMessage(`[DEBUG] File select exists, value: ${fileSelect.value}`);
        if (fsState && fsState.currentFile && fileSelect.value !== fsState.currentFile) {
            logMessage(`[DEBUG WARN] File select value (${fileSelect.value}) doesn't match state (${fsState.currentFile})`);
        }
    } else {
        logMessage('[DEBUG ERROR] File select not found');
    }
    const editor = document.querySelector('#md-editor textarea');
    if (editor) {
        logMessage(`[DEBUG] Editor exists, content length: ${editor.value.length} chars`);
    } else {
        logMessage('[DEBUG ERROR] Editor not found');
    }
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        logMessage('[DEBUG] Save button found');
        const saveBtnClone = saveBtn.cloneNode(true); // Simple check
        if (saveBtn.outerHTML !== saveBtnClone.outerHTML) {
             logMessage('[DEBUG] Save button appears to have event handlers'); // May not be accurate
        } else {
            logMessage('[DEBUG WARN] Save button may not have event handlers (heuristic)');
        }
    } else {
        logMessage('[DEBUG ERROR] Save button not found');
    }
    logMessage('[DEBUG] File operations debug complete');
}

export async function testFileLoading() {
    logMessage('[DEBUG] Testing file loading...');
    try {
        const state = loadFileSystemState();
        const currentFile = state.currentFile || 'README.md';
        const currentDir = state.currentDir || '';
        logMessage(`[DEBUG] Testing file loading for: ${currentFile} in ${currentDir || 'root'}`);
        
        const response = await globalFetch(`/api/files/get?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`);
        logMessage(`[DEBUG] /api/files/get response: ${response.status} ${response.statusText}`);
        const responseClone = response.clone();
        try {
            const data = await response.json();
            logMessage(`[DEBUG] Response parsed as JSON: ${typeof data}`);
            if (data.content) {
                logMessage(`[DEBUG] JSON content type: ${typeof data.content}`);
                logMessage(`[DEBUG] JSON content length: ${data.content.length} chars`);
                logMessage(`[DEBUG] JSON content preview: ${data.content.substring(0, 50)}...`);
            } else {
                logMessage(`[DEBUG] JSON data has no content property: ${JSON.stringify(data).substring(0, 100)}...`);
            }
        } catch (e) {
            logMessage(`[DEBUG] JSON parsing failed: ${e.message}`);
            const text = await responseClone.text();
            logMessage(`[DEBUG] Response as text (first 100 chars): ${text.substring(0, 100)}...`);
        }
        logMessage('[DEBUG] File loading test complete');
    } catch (error) {
        logMessage(`[DEBUG ERROR] File loading test failed: ${error.message}`);
        console.error('[DEBUG ERROR]', error);
    }
}

export function debugFileList() {
    logMessage('[DEBUG] File List Diagnostics');
    logMessage(`[DEBUG] File manager initialized: ${window.fileManagerInitialized || 'unknown'}`);
    logMessage(`[DEBUG] File manager initializing: ${window.fileManagerInitializing || 'unknown'}`);
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        logMessage(`[DEBUG] Directory selector: ${dirSelect.options.length} options`);
        logMessage(`[DEBUG] Current directory value: "${dirSelect.value}"`);
        for (let i = 0; i < dirSelect.options.length; i++) {
            logMessage(`[DEBUG] Dir option ${i}: value="${dirSelect.options[i].value}", text="${dirSelect.options[i].text}"`);
        }
    } else {
        logMessage('[DEBUG] Directory selector not found');
    }
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        logMessage(`[DEBUG] File selector: ${fileSelect.options.length} options`);
        logMessage(`[DEBUG] Current file value: "${fileSelect.value}"`);
        for (let i = 0; i < fileSelect.options.length; i++) {
            logMessage(`[DEBUG] File option ${i}: value="${fileSelect.options[i].value}", text="${fileSelect.options[i].text}"`);
        }
    } else {
        logMessage('[DEBUG] File selector not found');
    }
    try {
        const fsState = loadFileSystemState(); // Use imported function
        logMessage(`[DEBUG] FileSystemState in localStorage: ${JSON.stringify(fsState)}`);
    } catch (e) {
        logMessage(`[DEBUG] Error reading localStorage: ${e.message}`);
    }
    logMessage('[DEBUG] Attempting to force reload files...');
    import('../fileManager/operations.js').then(async ({ loadFiles, getCurrentDirectory }) => {
        const dir = getCurrentDirectory();
        logMessage(`[DEBUG] Current directory from state: ${dir}`);
        if (dir !== undefined && dir !== null) { // Check dir has a valid value
            try {
                await loadFiles(dir, true);
                logMessage('[DEBUG] File reload complete');
            } catch (error) {
                logMessage(`[DEBUG] File reload failed: ${error.message}`);
            }
        } else {
            logMessage('[DEBUG] No current directory found in state to reload');
        }
    }).catch(error => {
        logMessage(`[DEBUG] Import error during file reload: ${error.message}`);
    });
}

export async function debugFileLoadingIssues() {
    logMessage('===== FILE LOADING DIAGNOSTIC =====');
    logMessage(`[DEBUG] Authentication state: ${AUTH_STATE.isLoggedIn ? 'Logged in' : 'Not logged in'}`);
    if (AUTH_STATE.isLoggedIn) {
        logMessage(`[DEBUG] Logged in as: ${AUTH_STATE.username}`);
        logMessage(`[DEBUG] Has hashed password: ${!!AUTH_STATE.hashedPassword}`);
    }
    let currentDir = null;
    try {
        const fsState = loadFileSystemState();
        currentDir = fsState.currentDir; // Store for later use
        logMessage(`[DEBUG] Current directory (state): ${fsState.currentDir || 'none'}`);
        logMessage(`[DEBUG] Current file (state): ${fsState.currentFile || 'none'}`);
    } catch (error) {
        logMessage(`[DEBUG ERROR] Failed to load file system state: ${error.message}`);
    }
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select exists with ${dirSelect.options.length} options`);
        logMessage(`[DEBUG] Current directory value (UI): ${dirSelect.value}`);
        if (!currentDir) currentDir = dirSelect.value; // Fallback to UI value
    } else {
        logMessage('[DEBUG ERROR] Directory select not found');
    }
    if (fileSelect) {
        logMessage(`[DEBUG] File select exists with ${fileSelect.options.length} options`);
        logMessage(`[DEBUG] Current file value (UI): ${fileSelect.value}`);
    } else {
        logMessage('[DEBUG ERROR] File select not found');
    }
    try {
        logMessage('[DEBUG] Attempting to load directories...');
        const { loadDirectories } = await import('../fileManager/operations.js');
        const directories = await loadDirectories();
        logMessage(`[DEBUG] Loaded ${directories.length} directories: ${directories.join(', ')}`);
    } catch (error) {
        logMessage(`[DEBUG ERROR] Failed to load directories: ${error.message}`);
    }
    if (currentDir !== null && currentDir !== undefined && currentDir !== '') {
        try {
            logMessage(`[DEBUG] Attempting to load files for directory: ${currentDir}`);
            const { loadFiles } = await import('../fileManager/operations.js');
            const files = await loadFiles(currentDir, true); // Force reload
            logMessage(`[DEBUG] Loaded ${files.length} files for ${currentDir}`);
        } catch (error) {
            logMessage(`[DEBUG ERROR] Failed to load files for ${currentDir}: ${error.message}`);
        }
    } else {
        logMessage('[DEBUG] No current directory identified to load files for');
    }
    logMessage('===== END FILE LOADING DIAGNOSTIC =====');
}

// --- Auth Debug ---
export async function testAuthStatus() {
    logMessage('[DEBUG] Testing authentication status...');
    try {
        // AUTH_STATE is imported at the top
        const isLoggedIn = AUTH_STATE.isLoggedIn; // Direct check
        const username = AUTH_STATE.username;
        logMessage(`[DEBUG] Auth State: LoggedIn='${isLoggedIn}', Username='${username || 'N/A'}'`);
        logMessage(`[DEBUG] Test Result: User is ${isLoggedIn ? 'LOGGED IN' : 'LOGGED OUT'}.`);
    } catch (error) {
        logMessage(`[DEBUG ERROR] Authentication test failed: ${error.message}`,'error');
        console.error('[DEBUG AUTH ERROR]', error);
    }
}

export function debugAuthState() {
    logMessage('===== AUTH STATE DEBUG =====');
    try {
        const storedAuth = localStorage.getItem('authState');
        if (storedAuth) {
            const parsedAuth = JSON.parse(storedAuth);
            logMessage(`[AUTH DEBUG] localStorage: ${JSON.stringify({
                isLoggedIn: parsedAuth.isLoggedIn,
                username: parsedAuth.username,
                loginTime: parsedAuth.loginTime ? new Date(parsedAuth.loginTime).toLocaleString() : 'N/A',
                expiresAt: parsedAuth.expiresAt ? new Date(parsedAuth.expiresAt).toLocaleString() : 'N/A',
                hasHashedPassword: !!parsedAuth.hashedPassword
            })}`);
        } else {
            logMessage('[AUTH DEBUG] No auth data in localStorage');
        }
    } catch (error) {
        logMessage(`[AUTH DEBUG] Error reading localStorage: ${error.message}`);
    }
    // AUTH_STATE is imported at the top
    logMessage(`[AUTH DEBUG] Memory authState: ${JSON.stringify({
        isLoggedIn: AUTH_STATE.isLoggedIn,
        username: AUTH_STATE.username,
        loginTime: AUTH_STATE.loginTime ? new Date(AUTH_STATE.loginTime).toLocaleString() : 'N/A',
        expiresAt: AUTH_STATE.expiresAt ? new Date(AUTH_STATE.expiresAt).toLocaleString() : 'N/A',
        hasHashedPassword: !!AUTH_STATE.hashedPassword
    })}`);
    try {
        const sessionAuth = sessionStorage.getItem('authState');
        if (sessionAuth) {
            logMessage(`[AUTH DEBUG] Session storage has auth data (unexpected)`);
        }
    } catch (error) { /* Ignore */ }
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const pwdDisplay = document.getElementById('pwd-display');
    logMessage(`[AUTH DEBUG] UI State: 
        - Login form visible: ${!loginForm || loginForm.style.display !== 'none'}
        - Logout button visible: ${!!logoutBtn && logoutBtn.style.display !== 'none'}
        - Display text: ${pwdDisplay ? pwdDisplay.textContent : 'Not found'}`);
    logMessage('[AUTH DEBUG] Testing API authentication...');
    fetch('/api/files/dirs', {
        headers: AUTH_STATE.isLoggedIn ? {
            'Authorization': `Basic ${btoa(`${AUTH_STATE.username}:${AUTH_STATE.hashedPassword || ''}`)}`
        } : {}
    })
    .then(response => {
        logMessage(`[AUTH DEBUG] API test response: ${response.status} ${response.statusText}`);
        return response.text();
    })
    .then(text => {
        try { JSON.parse(text); logMessage('[AUTH DEBUG] API returned valid JSON.'); }
        catch (e) { logMessage(`[AUTH DEBUG] API returned non-JSON: ${text.substring(0, 50)}...`); }
    })
    .catch(error => {
        logMessage(`[AUTH DEBUG] API test failed: ${error.message}`);
    });
    logMessage('===== END AUTH DEBUG =====');
}


// --- URL Debug ---
export function debugUrlParameters() {
    logMessage('[DEBUG] Testing URL parameter handling...');
    const urlParams = new URLSearchParams(window.location.search);
    const urlDir = urlParams.get('dir');
    const urlFile = urlParams.get('file');
    logMessage(`[DEBUG] URL parameters: dir=${urlDir || 'none'}, file=${urlFile || 'none'}`);
    const state = loadFileSystemState();
    logMessage(`[DEBUG] File system state: dir=${state.currentDir || 'none'}, file=${state.currentFile || 'none'}`);
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select value: ${dirSelect.value || 'none'}`);
        if (urlDir) {
            const dirOption = Array.from(dirSelect.options).find(opt => opt.value === urlDir);
            logMessage(`[DEBUG] URL directory ${urlDir} ${dirOption ? 'found' : 'not found'} in options`);
        }
    }
    if (fileSelect) {
        logMessage(`[DEBUG] File select value: ${fileSelect.value || 'none'}`);
        if (urlFile) {
            const fileOption = Array.from(fileSelect.options).find(opt => opt.value === urlFile);
            logMessage(`[DEBUG] URL file ${urlFile} ${fileOption ? 'found' : 'not found'} in options`);
        }
    }
    logMessage('[DEBUG] URL parameter test complete');
}

// --- Endpoint Debug --- (Consolidated from multiple functions)
export async function debugAllApiEndpoints() {
    logMessage('[DEBUG] Testing key API endpoints...');
    const state = loadFileSystemState();
    const currentFile = state.currentFile || 'README.md';
    const currentDir = state.currentDir || '';
    const authHeader = AUTH_STATE.isLoggedIn ? { 'Authorization': `Basic ${btoa(`${AUTH_STATE.username}:${AUTH_STATE.hashedPassword || ''}`)}` } : {};

    const endpoints = [
        // List
        { name: 'List Dirs', url: '/api/files/dirs', method: 'GET' },
        { name: 'List Files', url: `/api/files/list?dir=${encodeURIComponent(currentDir)}`, method: 'GET' },
        // Get
        { name: 'Get File (name+dir)', url: `/api/files/get?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`, method: 'GET' },
        // Save/Update
        { name: 'Save File (POST)', url: '/api/files/save', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: currentFile, dir: currentDir, content: 'Test content' }) },
        // Auth
        { name: 'Auth Status', url: '/api/auth/status', method: 'GET' },
    ];

    for (const endpoint of endpoints) {
        try {
            logMessage(`[DEBUG] Testing: ${endpoint.name} (${endpoint.method} ${endpoint.url})`);
            const options = {
                method: endpoint.method,
                headers: { ...authHeader, ...(endpoint.headers || {}) },
                body: endpoint.body // Will be undefined for GET etc.
            };
            const response = await fetch(endpoint.url, options);
            logMessage(`  Response: ${response.status} ${response.statusText}`);
            if (!response.ok) {
                const errorText = await response.text();
                logMessage(`  Error Detail: ${errorText.substring(0, 100)}...`, 'warning');
            } else {
                // Optionally log success details if needed
                 logMessage(`  Success.`, 'text');
            }
        } catch (error) {
            logMessage(`  Exception: ${error.message}`, 'error');
        }
    }
    logMessage('[DEBUG] API endpoint testing complete');
}

// --- Consolidated Diagnostics Runner ---
export async function runAllDiagnostics() {
    logMessage('\n===== RUNNING ALL DIAGNOSTICS =====', 'heading'); // Use a distinct log level if available
    showAppInfo(); // Show app info first
    debugUI();
    await debugAllApiEndpoints(); // Covers testApiEndpoints, debugApiResponses
    debugFileOperations();
    await testFileLoading();
    await testAuthStatus();
    debugAuthState(); // Add this for comprehensive auth check
    debugUrlParameters();
    debugFileList(); // Add file list check
    // debugFileLoadingIssues(); // Maybe too verbose for default run?
    logMessage('===== ALL DIAGNOSTICS COMPLETE =====', 'heading');
}

// --- Global Registration ---
// Only register globally in development or if explicitly enabled
// const isDevelopment = process.env.NODE_ENV === 'development'; // Basic check - CRASHES IN BROWSER if process not defined
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'; // Browser-safe check

if (isDevelopment) { // Or add a specific debug flag check
    window.dev = { // Use a namespace to avoid cluttering window
        showAppInfo,
        debugUI,
        testApiEndpoints, // Keep individual functions available for targeted debugging
        debugApiResponses,
        debugFileOperations,
        testFileLoading,
        debugFileList,
        debugFileLoadingIssues,
        testAuthStatus,
        debugAuthState,
        debugUrlParameters,
        debugAllApiEndpoints,
        runAllDiagnostics, // Add the new consolidated function
        // debugSaveEndpoints, // Excluded, covered by debugAllApiEndpoints
    };
    logMessage('[DEBUG] Debug functions registered under window.dev');
} else {
     logMessage('[DEBUG] Debug functions not registered globally in production.');
}

logMessage('[DEBUG] Consolidated debug utilities module loaded');

// Removed old/redundant code:
// - logDebug helper (use logMessage directly)
// - Imports/exports for non-existent files (uiDebug.js etc)
// - Redundant function wrappers
// - Duplicate function definitions
// - Individual window assignments (using window.dev now)
// - debugSaveEndpoints (covered by debugAllApiEndpoints)
// - debugApiEndpoints (covered by debugAllApiEndpoints)