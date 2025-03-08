// This file is maintained for backward compatibility
export * from './fileManager/index.js';
export { default } from './fileManager/core.js';

let fileManagerInitialized = false;
let fileManagerInitializing = false;
let initializationPromise = null;

export async function initializeFileManager() {
    // Return existing promise if initialization is in progress
    if (fileManagerInitializing && initializationPromise) {
        console.log('[FILES] File manager initialization already in progress, returning existing promise');
        return initializationPromise;
    }
    
    // Skip if already initialized
    if (fileManagerInitialized) {
        console.log('[FILES] File manager already initialized, skipping');
        return Promise.resolve();
    }
    
    fileManagerInitializing = true;
    
    // Create a promise to track initialization
    initializationPromise = new Promise(async (resolve, reject) => {
        try {
            logMessage('[FILES] Initializing file manager...');
            
            // Rest of initialization code...
            
            // Set initialized flag at the end
            fileManagerInitialized = true;
            fileManagerInitializing = false;
            resolve();
        } catch (error) {
            console.error('[FILES] Initialization error:', error);
            fileManagerInitializing = false;
            reject(error);
        }
    });
    
    return initializationPromise;
}

function setupEventListeners() {
    // Remove existing listeners first (important!)
    document.removeEventListener('auth:login', handleAuthLogin);
    
    // Add single event listener with check
    document.addEventListener('auth:login', handleAuthLogin);
}

function handleAuthLogin(event) {
    // Check if already handled
    if (event.detail && event.detail.fileManagerHandled) {
        console.log('[FILES] Auth login event already handled by file manager, skipping');
        return;
    }
    
    // Mark as handled
    if (event.detail) {
        event.detail.fileManagerHandled = true;
    }
    
    logMessage('[FILES] Auth login detected, initializing file manager');
    initializeFileManager();
}