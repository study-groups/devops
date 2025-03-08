/**
 * Debug utilities for troubleshooting the application
 */

import { logMessage } from "./log/index.js";
import { debugFileSystemState } from './fileSystemState.js';

// Debug function to check the state of key elements
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
        
        // Check for textarea
        const textarea = editor.querySelector('textarea');
        if (textarea) {
            logMessage(`[DEBUG] Editor textarea found, content length: ${textarea.value.length} chars`);
        } else {
            logMessage('[DEBUG ERROR] Editor textarea not found');
        }
    } else {
        logMessage('[DEBUG ERROR] Editor not found');
    }
    
    // Check preview
    const preview = document.getElementById('md-preview');
    if (preview) {
        logMessage(`[DEBUG] Preview: display=${getComputedStyle(preview).display}, width=${getComputedStyle(preview).width}`);
    } else {
        logMessage('[DEBUG ERROR] Preview not found');
    }
    
    // Check file system state
    try {
        const fsState = JSON.parse(localStorage.getItem('fileSystemState') || '{}');
        logMessage(`[DEBUG] File system state: currentDir=${fsState.currentDir}, currentFile=${fsState.currentFile}`);
    } catch (e) {
        logMessage('[DEBUG ERROR] Could not parse file system state');
    }
    
    // Check view mode
    const viewMode = localStorage.getItem('viewMode');
    logMessage(`[DEBUG] Current view mode from localStorage: ${viewMode}`);
    
    // Check buttons
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        // Check if the save button has event listeners
        // We can't directly check for event listeners, but we can check if the button was properly initialized
        // by the connectSaveButton function
        
        // Instead of showing a warning, let's verify the save button is working by checking if it's connected
        // in the fileManager initialization
        logMessage(`[DEBUG] Save button found: id=${saveBtn.id}, text=${saveBtn.textContent}`);
        
        // Reconnect the save button to ensure it has event handlers
        import('./fileManager.js').then(({ connectSaveButton }) => {
            connectSaveButton();
            logMessage('[DEBUG] Save button event handlers reconnected');
        }).catch(err => {
            logMessage(`[DEBUG ERROR] Failed to reconnect save button: ${err.message}`);
        });
    } else {
        logMessage('[DEBUG ERROR] Save button not found');
    }
    
    // Check load button
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        logMessage(`[DEBUG] Load button found: id=${loadBtn.id}, text=${loadBtn.textContent}`);
    } else {
        logMessage('[DEBUG ERROR] Load button not found');
    }
    
    // Check file select
    const fileSelect = document.getElementById('file-select');
    if (fileSelect) {
        logMessage(`[DEBUG] File select found: options=${fileSelect.options.length}`);
    } else {
        logMessage('[DEBUG ERROR] File select not found');
    }
    
    // Check directory select
    const dirSelect = document.getElementById('dir-select');
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select found: options=${dirSelect.options.length}`);
    } else {
        logMessage('[DEBUG ERROR] Directory select not found');
    }
    
    logMessage('[DEBUG] UI diagnostics complete');
}

// Add this to window for console access
window.debugUI = debugUI;

// Add API endpoint testing to the debug function
export function testApiEndpoints() {
    logMessage('[DEBUG] Testing API endpoints...');
    
    // Test file listing endpoint
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
    
    // Test file get endpoint with a known file
    const testFile = 'README.md';
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

// Add this to the window object
window.testApiEndpoints = testApiEndpoints;

// Add a function to debug file operations
export function debugFileOperations() {
    logMessage('[DEBUG] Testing file operations...');
    
    // Check if fileManager is available
    if (window.fileManager) {
        logMessage('[DEBUG] fileManager is available');
        logMessage(`[DEBUG] Current directory: ${window.fileManager.currentDir}`);
    } else {
        logMessage('[DEBUG ERROR] fileManager is not available');
    }
    
    // Check file system state
    const fsState = debugFileSystemState();
    
    // Check UI elements
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
    
    // Check editor content
    const editor = document.querySelector('#md-editor textarea');
    if (editor) {
        logMessage(`[DEBUG] Editor exists, content length: ${editor.value.length} chars`);
    } else {
        logMessage('[DEBUG ERROR] Editor not found');
    }
    
    // Check save button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        logMessage('[DEBUG] Save button found');
        
        // Check if it has event listeners (approximate check)
        const saveBtnClone = saveBtn.cloneNode(true);
        if (saveBtn.outerHTML !== saveBtnClone.outerHTML) {
            logMessage('[DEBUG] Save button appears to have event handlers');
        } else {
            logMessage('[DEBUG WARN] Save button may not have event handlers');
        }
    } else {
        logMessage('[DEBUG ERROR] Save button not found');
    }
    
    logMessage('[DEBUG] File operations debug complete');
}

// Add this to the window object
window.debugFileOperations = debugFileOperations;

// Add a function to debug API responses
export async function debugApiResponses() {
    logMessage('[DEBUG] Testing API responses...');
    
    try {
        // Test directories endpoint
        const dirsResponse = await fetch('/api/files/dirs');
        logMessage(`[DEBUG] /api/files/dirs: ${dirsResponse.status} ${dirsResponse.statusText}`);
        
        if (dirsResponse.ok) {
            const dirsData = await dirsResponse.json();
            logMessage(`[DEBUG] Directories response type: ${Array.isArray(dirsData) ? 'Array' : typeof dirsData}`);
            logMessage(`[DEBUG] Directories response: ${JSON.stringify(dirsData).substring(0, 200)}...`);
        }
        
        // Test files endpoint
        const filesResponse = await fetch('/api/files/list');
        logMessage(`[DEBUG] /api/files/list: ${filesResponse.status} ${filesResponse.statusText}`);
        
        if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            logMessage(`[DEBUG] Files response type: ${Array.isArray(filesData) ? 'Array' : typeof filesData}`);
            logMessage(`[DEBUG] Files response: ${JSON.stringify(filesData).substring(0, 200)}...`);
            
            // Check the first file
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

// Add this to the window object
window.debugApiResponses = debugApiResponses;

// Add a function to test file loading
export async function testFileLoading() {
    logMessage('[DEBUG] Testing file loading...');
    
    try {
        // Import required modules
        const { loadFileSystemState } = await import('./fileSystemState.js');
        const { globalFetch } = await import('./globalFetch.js');
        
        // Get the current file from state
        const state = loadFileSystemState();
        const currentFile = state.currentFile || 'README.md';
        const currentDir = state.currentDir || '';
        
        logMessage(`[DEBUG] Testing file loading for: ${currentFile} in ${currentDir || 'root'}`);
        
        // Test file loading with globalFetch instead of direct fetch
        const response = await globalFetch(`/api/files/get?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`);
        logMessage(`[DEBUG] /api/files/get response: ${response.status} ${response.statusText}`);
        
        // Clone the response to read it twice
        const responseClone = response.clone();
        
        // Try to parse as JSON
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
            
            // Try as text
            const text = await responseClone.text();
            logMessage(`[DEBUG] Response as text (first 100 chars): ${text.substring(0, 100)}...`);
        }
        
        logMessage('[DEBUG] File loading test complete');
    } catch (error) {
        logMessage(`[DEBUG ERROR] File loading test failed: ${error.message}`);
        console.error('[DEBUG ERROR]', error);
    }
}

// Make sure to register the function with window
window.testFileLoading = testFileLoading;

// Add a function to test authentication status
export async function testAuthStatus() {
    logMessage('[DEBUG] Testing authentication status...');
    
    try {
        // Import auth state
        const { authState, refreshAuth } = await import('./auth.js');
        
        // Check current auth state
        logMessage(`[DEBUG] Auth state: isLoggedIn=${authState.isLoggedIn}, username=${authState.username || 'none'}`);
        
        if (authState.expiresAt) {
            const now = Date.now();
            const expiresIn = authState.expiresAt - now;
            const expiresInMinutes = Math.round(expiresIn / 60000);
            
            logMessage(`[DEBUG] Token expires in: ${expiresInMinutes} minutes (${new Date(authState.expiresAt).toLocaleTimeString()})`);
            
            if (expiresIn < 0) {
                logMessage('[DEBUG] Token has expired!');
            } else if (expiresIn < 5 * 60 * 1000) {
                logMessage('[DEBUG] Token is about to expire, refreshing...');
                const refreshed = await refreshAuth();
                logMessage(`[DEBUG] Token refresh ${refreshed ? 'successful' : 'failed'}`);
            }
        } else {
            logMessage('[DEBUG] No token expiration found');
        }
        
        // Add file system state information
        try {
            const { loadFileSystemState } = await import('./fileSystemState.js');
            const fsState = loadFileSystemState();
            
            logMessage('[DEBUG] File System State:');
            logMessage(`[DEBUG] - Current Directory: ${fsState.currentDir || 'none'}`);
            logMessage(`[DEBUG] - Current File: ${fsState.currentFile || 'none'}`);
            logMessage(`[DEBUG] - Recent Files: ${fsState.recentFiles?.length || 0} files`);
            if (fsState.recentFiles?.length > 0) {
                logMessage(`[DEBUG] - Recent Files List: ${fsState.recentFiles.join(', ')}`);
            }
            logMessage(`[DEBUG] - Last Modified: ${fsState.lastModified ? new Date(fsState.lastModified).toLocaleString() : 'never'}`);
        } catch (error) {
            logMessage(`[DEBUG ERROR] Failed to get file system state: ${error.message}`);
        }
        
        // Test a simple authenticated request
        try {
            const { globalFetch } = await import('./globalFetch.js');
            const response = await globalFetch('/api/auth/status');
            
            if (response.ok) {
                const data = await response.json();
                logMessage(`[DEBUG] Auth status: ${JSON.stringify(data)}`);
            } else {
                logMessage(`[DEBUG] Auth status check failed: ${response.status}`);
            }
        } catch (error) {
            logMessage(`[DEBUG] Auth status check error: ${error.message}`);
        }
        
        logMessage('[DEBUG] Authentication test complete');
    } catch (error) {
        logMessage(`[DEBUG ERROR] Authentication test failed: ${error.message}`);
        console.error('[DEBUG ERROR]', error);
    }
}

// Make the function available globally
window.testAuthStatus = testAuthStatus;

// Add this function to debug URL parameter handling
export function debugUrlParameters() {
    logMessage('[DEBUG] Testing URL parameter handling...');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlDir = urlParams.get('dir');
    const urlFile = urlParams.get('file');
    
    logMessage(`[DEBUG] URL parameters: dir=${urlDir || 'none'}, file=${urlFile || 'none'}`);
    
    // Check file system state
    const state = loadFileSystemState();
    logMessage(`[DEBUG] File system state: dir=${state.currentDir || 'none'}, file=${state.currentFile || 'none'}`);
    
    // Check UI elements
    const dirSelect = document.getElementById('dir-select');
    const fileSelect = document.getElementById('file-select');
    
    if (dirSelect) {
        logMessage(`[DEBUG] Directory select value: ${dirSelect.value || 'none'}`);
        
        // Check if URL dir is in the options
        if (urlDir) {
            const dirOption = Array.from(dirSelect.options).find(opt => opt.value === urlDir);
            logMessage(`[DEBUG] URL directory ${urlDir} ${dirOption ? 'found' : 'not found'} in options`);
        }
    }
    
    if (fileSelect) {
        logMessage(`[DEBUG] File select value: ${fileSelect.value || 'none'}`);
        
        // Check if URL file is in the options
        if (urlFile) {
            const fileOption = Array.from(fileSelect.options).find(opt => opt.value === urlFile);
            logMessage(`[DEBUG] URL file ${urlFile} ${fileOption ? 'found' : 'not found'} in options`);
        }
    }
    
    logMessage('[DEBUG] URL parameter test complete');
}

// Make it available globally
window.debugUrlParameters = debugUrlParameters;

// Add this function to debug API endpoint formats
export function debugApiEndpoints() {
    logMessage('[DEBUG] Testing API endpoint formats...');
    
    // Get current file and directory
    const state = loadFileSystemState();
    const currentFile = state.currentFile || 'README.md';
    const currentDir = state.currentDir || '';
    
    logMessage(`[DEBUG] Current file: ${currentFile}, directory: ${currentDir}`);
    
    // Test both endpoint formats
    const formats = [
        `/api/files/get?dir=${encodeURIComponent(currentDir)}&file=${encodeURIComponent(currentFile)}`,
        `/api/files/get?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`
    ];
    
    formats.forEach(async (url, index) => {
        try {
            logMessage(`[DEBUG] Testing format ${index + 1}: ${url}`);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                }
            });
            
            logMessage(`[DEBUG] Format ${index + 1} response: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const text = await response.text();
                logMessage(`[DEBUG] Format ${index + 1} success! Content length: ${text.length} chars`);
                logMessage(`[DEBUG] Content preview: ${text.substring(0, 50)}...`);
            } else {
                const error = await response.text();
                logMessage(`[DEBUG] Format ${index + 1} error: ${error}`);
            }
        } catch (error) {
            logMessage(`[DEBUG] Format ${index + 1} exception: ${error.message}`);
        }
    });
    
    logMessage('[DEBUG] API endpoint test complete');
}

// Make it available globally
window.debugApiEndpoints = debugApiEndpoints;

// Add this function to debug all API endpoints
export function debugAllApiEndpoints() {
    logMessage('[DEBUG] Testing all API endpoints...');
    
    // Get current file and directory
    const state = loadFileSystemState();
    const currentFile = state.currentFile || 'README.md';
    const currentDir = state.currentDir || '';
    
    logMessage(`[DEBUG] Current file: ${currentFile}, directory: ${currentDir}`);
    
    // Test all possible endpoint formats
    const endpoints = [
        // Get file endpoints
        {
            name: 'Get file (name+dir)',
            url: `/api/files/get?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`,
            method: 'GET'
        },
        {
            name: 'Get file (file+dir)',
            url: `/api/files/get?file=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`,
            method: 'GET'
        },
        // Save file endpoints
        {
            name: 'Save file (update endpoint)',
            url: `/api/files/update?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'Test content'
        },
        {
            name: 'Save file (save endpoint)',
            url: `/api/files/save`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentFile,
                dir: currentDir,
                content: 'Test content'
            })
        }
    ];
    
    endpoints.forEach(async (endpoint, index) => {
        try {
            logMessage(`[DEBUG] Testing endpoint ${index + 1}: ${endpoint.name} - ${endpoint.url}`);
            
            const options = {
                method: endpoint.method,
                headers: {
                    'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                }
            };
            
            if (endpoint.headers) {
                options.headers = { ...options.headers, ...endpoint.headers };
            }
            
            if (endpoint.body) {
                options.body = endpoint.body;
            }
            
            const response = await fetch(endpoint.url, options);
            
            logMessage(`[DEBUG] Endpoint ${index + 1} response: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                try {
                    const text = await response.text();
                    logMessage(`[DEBUG] Endpoint ${index + 1} success! Content length: ${text.length} chars`);
                    logMessage(`[DEBUG] Content preview: ${text.substring(0, 50)}...`);
                } catch (e) {
                    logMessage(`[DEBUG] Endpoint ${index + 1} success! (Could not read response body)`);
                }
            } else {
                const error = await response.text();
                logMessage(`[DEBUG] Endpoint ${index + 1} error: ${error}`);
            }
        } catch (error) {
            logMessage(`[DEBUG] Endpoint ${index + 1} exception: ${error.message}`);
        }
    });
    
    logMessage('[DEBUG] API endpoint test complete');
}

// Make it available globally
window.debugAllApiEndpoints = debugAllApiEndpoints;

// Add this function to debug all possible save endpoints
export function debugSaveEndpoints() {
    const state = loadFileSystemState();
    const currentFile = state.currentFile || 'test.md';
    const currentDir = state.currentDir || '';
    const content = 'Test content';
    
    logMessage(`[DEBUG] Testing save endpoints for file: ${currentFile} in directory: ${currentDir}`);
    
    const endpoints = [
        {
            name: 'Save to /api/files/update',
            url: '/api/files/update',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentFile,
                directory: currentDir,
                content: content
            })
        },
        {
            name: 'Save to /api/files/content',
            url: `/api/files/content?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: content
        },
        {
            name: 'Save to /api/files/save',
            url: `/api/files/save?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: content
        },
        {
            name: 'Save to /api/files/write',
            url: `/api/files/write?name=${encodeURIComponent(currentFile)}&dir=${encodeURIComponent(currentDir)}`,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: content
        }
    ];
    
    endpoints.forEach(async (endpoint, index) => {
        try {
            logMessage(`[DEBUG] Testing endpoint ${index + 1}: ${endpoint.name} - ${endpoint.url}`);
            
            const options = {
                method: endpoint.method,
                headers: {
                    'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                }
            };
            
            if (endpoint.headers) {
                options.headers = { ...options.headers, ...endpoint.headers };
            }
            
            if (endpoint.body) {
                options.body = endpoint.body;
            }
            
            const response = await fetch(endpoint.url, options);
            
            logMessage(`[DEBUG] Endpoint ${index + 1} response: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                logMessage(`[DEBUG] Endpoint ${index + 1} SUCCESS! This is the correct endpoint.`);
            } else {
                logMessage(`[DEBUG] Endpoint ${index + 1} failed.`);
            }
        } catch (error) {
            logMessage(`[DEBUG] Endpoint ${index + 1} exception: ${error.message}`);
        }
    });
}

// Make it available globally
window.debugSaveEndpoints = debugSaveEndpoints; 