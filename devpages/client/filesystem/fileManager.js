/**
 * fileManager.js - Manages file system state, navigation, loading, and saving.
 * Implements agreed path semantics and event-driven flow.
 */
import eventBus from '/client/eventBus.js';
import { getContent, setContent } from '/client/editor.js';
import { logMessage } from '/client/log/index.js';
import * as fileSystemState from './fileSystemState.js'; // Use namespace import
import { appStore } from '/client/appState.js'; // <<< ADDED: Import appStore
import { globalFetch } from '/client/globalFetch.js'; // ADDED import

// >>> ADDED: Import for front matter parsing/handling
import { renderMarkdown } from '/client/preview/renderer.js';
// Import dispatch and ActionTypes
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

// --- Module State ---
// const fileState = {
//     topLevelDirectory: '',   // e.g., 'gridranger'
//     currentRelativePath: '', // e.g., '', 'iframe', 'iframe/assets'
//     currentFile: '',         // e.g., 'game-iframe-001.md'
//     isInitialized: false,    // Ensure init runs only once
//     isLoading: false,        // Track API call progress
//     topLevelDirs: []         // ADDED: Store available top-level directories
// };
// let currentListingData = { dirs: [], files: [] }; // Store current listing

// >>> ADDED: State for managing host scripts <<<
let currentHostScriptPath = null;
let currentHostScriptModule = null;

// >>> ADDED: State for managing dynamic styles <<<
let currentDynamicStyleElements = [];

let fmUnsubscribe = null; // <<< ADDED: Variable for store unsubscribe function

// --- Logging Helper ---
function logFileManager(message, level = 'text') {
    const type = 'FILEMGR';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

// --- Path Helper Functions ---
function pathJoin(...parts) {
    const filteredParts = parts.filter(part => part && part !== '/');
    if (filteredParts.length === 0) return '';
    return filteredParts.join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

function getParentRelativePath(relativePath) {
    if (!relativePath) return '';
    const parts = relativePath.split('/').filter(p => p);
    parts.pop();
    return parts.join('/');
}

// --- URL Parameter Helper ---
function updateUrlParameters(dir, relativePath, file) {
    try {
        const params = new URLSearchParams(window.location.search);
        if (dir) params.set('dir', dir); else params.delete('dir');
        if (relativePath) params.set('path', relativePath); else params.delete('path');
        if (file) params.set('file', file); else params.delete('file');
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
        if (window.location.href !== newUrl) {
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }
    } catch (error) {
        logFileManager(`Error updating URL: ${error.message}`, 'warning');
    }
}

// --- State Management & Persistence ---
// Updates internal state, saves to persistence, updates URL, updates appState
// function updateAndPersistState(newState) { ... }
// This logic will now live within event handlers, which will dispatch FS_SET_STATE
// and call fileSystemState.saveState / updateUrlParameters directly.

// --- Initialization ---
export async function initializeFileManager() {
    // Use appStore state to check if already initialized VIA THE FLAG WE SET
    // Checking store state directly might be tricky if init fails midway
    if (window.APP?.fileManagerInitialized) { // Use window flag
        logFileManager('Attempted to initialize FileManager again. Skipping.', 'warning');
        return false;
    }
    // Set flag immediately to prevent race conditions
    window.APP = window.APP || {}; // Ensure APP exists
    window.APP.fileManagerInitialized = true; 

    logFileManager('Initializing file manager (Refactored with statekit/reducer)...');
    dispatch({ type: ActionTypes.FS_INIT_START });

    let initialTopDir = null;
    let initialRelativePath = null;
    let initialFile = null;

    try {
        // --- Get initial state values (URL > localStorage) ---
        const persistedState = fileSystemState.loadState();
        initialTopDir = persistedState.currentDir;
        initialRelativePath = persistedState.currentRelativePath;
        initialFile = persistedState.currentFile;
        logFileManager(`Loaded persisted state: Top=${initialTopDir}, Rel=${initialRelativePath}, File=${initialFile}`);

        // --- Check for deep link restore ---
        // (Defer this until authentication is confirmed?) - Let's keep it here for now
        // It sets the *intended* initial state, which loadInitialFileData will use if authenticated.
        // We need auth state here though.
        const currentAuthState = appStore.getState().auth; 
        if (!initialTopDir && currentAuthState.isAuthenticated) { 
            try {
                const deepLinkModule = await import('/client/deepLink.js');
                const savedRequest = deepLinkModule.getSavedDeepLinkRequest();
                if (savedRequest) {
                    logFileManager(`Restoring deep link: dir=${savedRequest.dir}, path=${savedRequest.path}, file=${savedRequest.file}`);
                    initialTopDir = savedRequest.dir;
                    initialRelativePath = savedRequest.path || ''; 
                    initialFile = savedRequest.file || '';
                    deepLinkModule.clearSavedDeepLinkRequest();
                    fileSystemState.saveState({ currentDir: initialTopDir, currentFile: initialFile });
                }
            } catch (error) {
                logFileManager(`Error checking deep links: ${error.message}`, 'warning');
            }
        }
        
        // --- Apply default directory if none set and user is authenticated ---
        if (!initialTopDir && currentAuthState.isAuthenticated && currentAuthState.user?.username) {
            logFileManager('No directory context from URL/localStorage/deepLink, user logged in. Defaulting to username.');
            initialTopDir = currentAuthState.user.username;
            initialRelativePath = '';
            initialFile = '';
             // Persist this default state immediately
            fileSystemState.saveState({ currentDir: initialTopDir, currentFile: initialFile });
        }

        // --- Set initial state in appStore ---\n        logFileManager(`Dispatching initial FS_SET_STATE: Top=${initialTopDir}, Rel=${initialRelativePath}, File=${initialFile}`);
        dispatch({
            type: ActionTypes.FS_SET_STATE,
            payload: {
                topLevelDirectory: initialTopDir,
                currentRelativePath: initialRelativePath,
                currentFile: initialFile,
                isInitialized: false, // Mark as not fully initialized yet
                isLoading: true,     // Start in loading state until auth check / data load
            }
        });
        // Update URL based on the determined initial state
        updateUrlParameters(initialTopDir, initialRelativePath, initialFile);

        setupEventListeners(); // Keep event listeners for UI interactions

        // --- Subscribe to Auth Changes --- <<< ADDED
        if (fmUnsubscribe) fmUnsubscribe(); // Clear previous if any
        fmUnsubscribe = appStore.subscribe(handleAuthStateChangeForFileManager);
        logFileManager("Subscribed FileManager to appStore changes.");

        // --- Trigger initial check based on current auth state --- <<< ADDED
        // Call the handler immediately to potentially load data if already logged in
        await handleAuthStateChangeForFileManager(appStore.getState(), null); 

        // <<< REMOVED: Direct calls to load data >>>
        // // --- Load initial data ---
        // // 1. Load top-level directories
        // await loadTopLevelDirectories(); // This now dispatches FS_SET_TOP_DIRS
        // // ... rest of data loading logic ...

        // // 5. Mark initialization as complete in the store
        // Note: FS_INIT_COMPLETE might now be dispatched within handleAuthStateChangeForFileManager
        // or after loadInitialFileData finishes successfully. Let's dispatch it here for now,
        // but set isLoading based on whether data loading was triggered.
        const finalState = appStore.getState();
        dispatch({ 
            type: ActionTypes.FS_INIT_COMPLETE, 
            payload: { 
                error: null, 
                // isLoading should remain true if we triggered data loading and it hasn't finished
                // We'll manage isLoading via specific actions within the loading functions now.
            } 
        }); 
        logFileManager('File manager initialization setup complete. Data loading deferred to auth state.');
        return true;

    } catch (error) {
        logFileManager(`Initialization failed critically: ${error.message}`, 'error');
        console.error("FileManager Initialization Critical Error:", error);
        // Mark initialization as complete but with an error
        dispatch({ type: ActionTypes.FS_INIT_COMPLETE, payload: { error: error.message } });
        window.APP.fileManagerInitialized = false; // Allow retry?
        return false;
    }
}

// <<< ADDED: Handler for Auth State Changes >>>
async function handleAuthStateChangeForFileManager(newState, prevState) {
    const wasLoggedIn = prevState?.auth?.isAuthenticated ?? false; // Handle null prevState
    const isLoggedIn = newState.auth.isAuthenticated;
    const isAuthInitializing = newState.auth.isInitializing; // Don't act while auth is pending

    logFileManager(`Auth state change detected by FM: wasLoggedIn=${wasLoggedIn}, isLoggedIn=${isLoggedIn}, isAuthInitializing=${isAuthInitializing}`, 'debug');

    // Only react once auth is settled
    if (isAuthInitializing) {
        logFileManager("Auth initializing, FM deferring action.", 'debug');
        return; 
    }

    if (!wasLoggedIn && isLoggedIn) {
        // User just logged in (or was already logged in on page load and auth check finished)
        logFileManager("User authenticated. Triggering initial file data load.", 'info');
        await loadInitialFileData();
    } else if (wasLoggedIn && !isLoggedIn) {
        // User just logged out
        logFileManager("User logged out. Resetting file manager state.", 'info');
        resetFileManagerState(); // This dispatches FS_SET_STATE
    } else if (isLoggedIn && newState.auth.user?.username !== prevState?.auth?.user?.username) {
        // User changed? (Might not happen in this app, but good practice)
        logFileManager(`Auth user changed from ${prevState?.auth?.user?.username} to ${newState.auth.user?.username}. Triggering refresh.`, 'info');
        await refreshFileManagerForUser(newState.auth.user?.username);
    } else {
        // No relevant auth change for FM (e.g., still logged in, still logged out)
         logFileManager("No relevant auth change for FM.", 'debug');
    }
}

// <<< ADDED: Function to load initial data based on current state >>>
async function loadInitialFileData() {
    // Mark as loading (might be redundant if FS_INIT_START did this, but safer)
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true, error: null } });

    try {
        logFileManager("Loading initial file data...");
        // 1. Load top-level directories
        await loadTopLevelDirectories(); // Dispatches FS_SET_TOP_DIRS

        // 2. If a top-level directory is set, load its initial listing
        let currentFileIsValid = false;
        const currentState = appStore.getState().file; // Get the potentially updated state
        if (currentState.topLevelDirectory) {
            await loadFilesAndDirectories(currentState.topLevelDirectory, currentState.currentRelativePath); // Dispatches listing actions
            
            const stateAfterListing = appStore.getState().file; // Re-get state after listing load
            logFileManager(`[LOAD_INIT] Checking listing: Dirs=[${stateAfterListing.currentListing?.dirs?.join()}], Files=[${stateAfterListing.currentListing?.files?.join()}]`, 'debug');

            // 3. Validate if the initial file exists
            if (stateAfterListing.currentFile && stateAfterListing.currentListing?.files?.includes(stateAfterListing.currentFile)) {
                currentFileIsValid = true;
                logFileManager(`Initial file \'${stateAfterListing.currentFile}\' validated.`);
            } else if (stateAfterListing.currentFile) {
                logFileManager(`Initial file \'${stateAfterListing.currentFile}\' NOT found. Clearing file state.`, 'warning');
                dispatch({ type: ActionTypes.FS_SET_STATE, payload: { currentFile: null } });
                fileSystemState.saveState({ currentFile: '' });
                updateUrlParameters(stateAfterListing.topLevelDirectory, stateAfterListing.currentRelativePath, '');
            }
        } else {
            logFileManager('No initial directory context set for data loading.');
            // Ensure listing is clear if no top dir
             dispatch({ type: ActionTypes.FS_LOAD_LISTING_SUCCESS, payload: { listing: { dirs: [], files: [] } } });
        }

        // 4. Load the initial file content if needed and valid
        const finalInitialState = appStore.getState().file; // Get state again
        if (currentFileIsValid && finalInitialState.currentFile) {
            logFileManager(`Proceeding to load initial file content: \'${finalInitialState.currentFile}\'`);
            await loadFile(finalInitialState.currentFile, finalInitialState.topLevelDirectory, finalInitialState.currentRelativePath); // Dispatches file content actions
        } else if (finalInitialState.currentFile){
            // If file was set but not valid, ensure editor is cleared
            setContent('');
        }

        // Mark loading as complete (success case)
        // Individual load functions (loadFile, loadFilesAndDirectories) should ideally manage their specific start/end/error actions
        // Let's add a final "isLoading: false" dispatch here for the overall initial load sequence.
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false, isInitialized: true } }); // Mark as initialized now
        logFileManager("Initial file data loading sequence complete.");

    } catch (error) {
        logFileManager(`Initial file data loading failed: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false, error: error.message, isInitialized: true } }); // Mark as initialized (even on error)
    }
}

function setupEventListeners() {
    logFileManager('Setting up navigation event listeners...');
    // Clear existing listeners first
    eventBus.off('navigate:file');
    eventBus.off('navigate:directory');
    eventBus.off('navigate:up');
    eventBus.off('navigate:topLevelDir');
    eventBus.off('navigate:root');
    eventBus.off('navigate:absolute');
    eventBus.off('ui:requestTopLevelSelector'); // ADDED: Clear listener

    // Listen for UI navigation requests
    eventBus.on('navigate:topLevelDir', handleTopLevelDirectoryChange);
    eventBus.on('navigate:directory', handleDirectoryNavigation);
    eventBus.on('navigate:up', handleUpNavigation);
    eventBus.on('navigate:file', handleFileNavigation);
    eventBus.on('navigate:root', handleNavigateToRoot);
    eventBus.on('navigate:absolute', handleNavigateAbsolute);
    eventBus.on('ui:requestTopLevelSelector', handleRequestTopLevelSelector); // ADDED: Listen for request

    logFileManager('Navigation event listeners ready.');
}

// --- Event Handlers (Triggered by UI/eventBus) ---

async function handleTopLevelDirectoryChange(data) {
    // Get current state from the store
    const currentState = appStore.getState().file;
    const newTopDir = data?.directory ?? null; // Use null if undefined

    if (newTopDir === currentState.topLevelDirectory) return; // No change

    logFileManager(`Event navigate:topLevelDir received: newDir='${newTopDir}'`);
    // Update state: New top dir, clear relative path & file
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: { topLevelDirectory: newTopDir, currentRelativePath: null, currentFile: null }
    });
    // Persist and update URL
    fileSystemState.saveState({ currentDir: newTopDir, currentFile: '' });
    updateUrlParameters(newTopDir, null, null);

    setContent(''); // Clear editor

    // Load listing for the new top-level dir (or clear if none selected)
    if (newTopDir) {
        await loadFilesAndDirectories(newTopDir, ''); // Dispatches listing actions
    } else {
        // Dispatch empty listing if no directory is selected
        dispatch({ type: ActionTypes.FS_LOAD_LISTING_SUCCESS, payload: { listing: { dirs: [], files: [] } } });
    }
    // State is now managed by the store, no need for separate stateSettled event
}

async function handleDirectoryNavigation(data) {
    const subdir = data?.directory;
    const currentState = appStore.getState().file;

    if (!subdir || !currentState.topLevelDirectory) return; // Need top-level context

    logFileManager(`Event navigate:directory received: subdir='${subdir}'`);
    const newRelativePath = pathJoin(currentState.currentRelativePath, subdir);

    // Update state: New relative path, clear file
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: { currentRelativePath: newRelativePath, currentFile: null }
    });
    // Persist and update URL (only need to update path and clear file)
    fileSystemState.saveState({ currentFile: '' }); // Clear persisted file
    updateUrlParameters(currentState.topLevelDirectory, newRelativePath, null);

    setContent(''); // Clear editor

    // Load listing for the new subdirectory
    await loadFilesAndDirectories(currentState.topLevelDirectory, newRelativePath); // Dispatches listing actions
    // State is managed by the store
}

async function handleUpNavigation() {
    const currentState = appStore.getState().file;
    if (!currentState.currentRelativePath) return; // Already at top relative level

    logFileManager(`Event navigate:up received.`);
    const parentPath = getParentRelativePath(currentState.currentRelativePath);

    // Update state: Set parent path, clear file
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: { currentRelativePath: parentPath, currentFile: null }
    });
    // Persist and update URL
    fileSystemState.saveState({ currentFile: '' }); // Clear persisted file
    updateUrlParameters(currentState.topLevelDirectory, parentPath, null);

    setContent(''); // Clear editor

    // Load listing for the parent directory
    await loadFilesAndDirectories(currentState.topLevelDirectory, parentPath); // Dispatches listing actions
    // State is managed by the store
}

async function handleFileNavigation(data) {
    const filename = data?.filename;
    const currentState = appStore.getState().file;

    // Validate necessary context
    if (!filename || !currentState.topLevelDirectory) {
        logFileManager(`Event navigate:file ignored: Missing filename ('${filename}') or topLevelDirectory ('${currentState.topLevelDirectory}')`, 'warning');
        return;
    }

    if (filename === currentState.currentFile) return; // No change

    logFileManager(`Event navigate:file received: file='${filename}'`);

    // Update state and persistence BEFORE loading content
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: { currentFile: filename }
    });
    fileSystemState.saveState({ currentFile: filename });
    updateUrlParameters(currentState.topLevelDirectory, currentState.currentRelativePath, filename);

    // Load the actual file content (this will dispatch load success/error actions)
    await loadFile(filename, currentState.topLevelDirectory, currentState.currentRelativePath);

    // No need to dispatch stateSettled, UI should react to appStore changes.
}

async function handleNavigateToRoot() {
    logFileManager(`Event navigate:root received.`);

    // Clear state: top-level directory, relative path, file
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: { topLevelDirectory: null, currentRelativePath: null, currentFile: null }
    });
    // Clear listing in state
    dispatch({ type: ActionTypes.FS_LOAD_LISTING_SUCCESS, payload: { listing: { dirs: [], files: [] } } });

    // Persist and update URL
    fileSystemState.saveState({ currentDir: '', currentFile: '' }); // Persist empty context
    updateUrlParameters(null, null, null);

    setContent(''); // Clear editor

    // No need to load listing or emit stateSettled
}

// Refactored to use appStore state
async function handleRequestTopLevelSelector() {
    logFileManager('handleRequestTopLevelSelector called', 'debug');
    const currentFileState = appStore.getState().file;
    if (currentFileState.availableTopLevelDirs && currentFileState.availableTopLevelDirs.length > 0) {
        logFileManager('Responding with cached top-level dirs from appStore', 'debug');
        // Potentially emit an event specific to this UI interaction if needed,
        // or better yet, have the requesting component subscribe to the store.
        // For now, keeping the event bus pattern for this specific case:
        eventBus.emit('fileManager:dirsLoaded', { dirs: currentFileState.availableTopLevelDirs });
    } else {
        logFileManager('No cached dirs in appStore, attempting to load top-level directories...', 'debug');
        await loadTopLevelDirectories(); // This will load and dispatch FS_SET_TOP_DIRS
    }
}

async function handleNavigateAbsolute(data) {
    const { dir, path: relativePath = null, file = null } = data; // Use null defaults
    logFileManager(`Event navigate:absolute received: dir=${dir}, path=${relativePath}, file=${file}`);

    if (!dir) {
        logFileManager('Navigate absolute requires at least a directory (dir).', 'warning');
        return;
    }

    // 1. Update state: Set exact path, clear file initially
    const initialStateUpdate = {
        topLevelDirectory: dir,
        currentRelativePath: relativePath,
        currentFile: null // Clear file initially
    };
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: initialStateUpdate });
    fileSystemState.saveState({ currentDir: dir, currentFile: '' }); // Persist dir, clear file
    updateUrlParameters(dir, relativePath, null); // Update URL without file

    setContent(''); // Clear editor

    // 2. Load listing for the target directory
    await loadFilesAndDirectories(dir, relativePath); // Dispatches listing actions

    // 3. If a file was specified, validate and attempt to load it
    if (file) {
        logFileManager(`Attempting to load specified file: ${file}`);
        // Validate against the newly loaded listing
        const stateAfterListing = appStore.getState().file;
        if (stateAfterListing.currentListing?.files?.includes(file)) {
            // File exists, update state and load content
             dispatch({ type: ActionTypes.FS_SET_STATE, payload: { currentFile: file } });
             fileSystemState.saveState({ currentFile: file }); // Persist file
             updateUrlParameters(dir, relativePath, file); // Update URL with file
             await loadFile(file, dir, relativePath); // Dispatches load actions
        } else {
             logFileManager(`Specified file '${file}' not found in listing for dir='${dir}', path='${relativePath}'. Not loading.`, 'warning');
             // State already has currentFile: null from step 1, so no further state update needed.
             // URL and persisted state also correctly reflect no file selected.
        }
    }
    // No need for stateSettled event.
}

// --- API Interaction & Core Logic ---

async function loadTopLevelDirectories() {
    logFileManager('Loading top-level directories...');
    dispatch({ type: ActionTypes.FS_LOAD_TOP_DIRS_START }); // <<< ADDED START ACTION
    try {
        const response = await globalFetch('/api/files/dirs');
        if (!response.ok) throw new Error(`Failed to fetch directories: ${response.status}`);
        const dirs = await response.json();
        if (!Array.isArray(dirs)) throw new Error('Invalid directory list format from server.');
        
        logFileManager(`Received ${dirs.length} top-level dirs: [${dirs.join(', ')}]`);
        dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: { dirs } }); // Success uses SET action
        
    } catch (error) {
        logFileManager(`Error loading top-level directories: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_LOAD_TOP_DIRS_ERROR, payload: { error: error.message } }); // <<< ADDED ERROR ACTION
        // Optionally reset dirs on error
        // dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: { dirs: [] } });
    }
}

async function loadFilesAndDirectories(topLevelDir, relativePath) {
    const logPrefix = '[FILEMGR_LOADLIST]';
    const apiPath = pathJoin(topLevelDir, relativePath);
    logFileManager(`${logPrefix} START for API path: '${apiPath}'`);
    
    dispatch({ type: ActionTypes.FS_LOAD_LISTING_START });
    // REMOVED: setLoading(true);

    try {
        const apiUrl = `/api/files/list?dir=${encodeURIComponent(apiPath)}`;
        logFileManager(`${logPrefix} Fetching: ${apiUrl}`);
        const response = await globalFetch(apiUrl);
        if (!response.ok) throw new Error(`Failed to list files: ${response.status} for path '${apiPath}'`);
        
        const data = await response.json();
        logFileManager(`${logPrefix} Received data: Dirs=[${data.dirs?.join(', ')}], Files=[${data.files?.join(', ')}]`);
        
        // Dispatch success action with listing data
        dispatch({ 
            type: ActionTypes.FS_LOAD_LISTING_SUCCESS, 
            payload: { listing: { dirs: data.dirs || [], files: data.files || [] } } 
        });
        // REMOVED: currentListingData = data;
        // REMOVED: eventBus.emit('fileManager:listingLoaded', { ... });
        logFileManager(`${logPrefix} Dispatched FS_LOAD_LISTING_SUCCESS.`);

    } catch (error) {
        logFileManager(`${logPrefix} ERROR: ${error.message}`, 'error');
        // Dispatch error action
        dispatch({ type: ActionTypes.FS_LOAD_LISTING_ERROR, payload: { error: error.message } });
        // REMOVED: currentListingData = { dirs: [], files: [] };
        // REMOVED: eventBus.emit('fileManager:listingLoaded', { ... });
    } 
    // No finally/setLoading needed, reducer handles loading state
}

/**
 * Loads the content of a specific file.
 * Emits 'file:loaded' on success or 'file:loadError' on failure.
 * Handles host script loading/unloading based on front matter.
 */
export async function loadFile(filename, topLevelDir, relativePath) {
    const logPrefix = `[loadFile ${filename}]:`;
    logFileManager(`${logPrefix} Starting load... (Top='${topLevelDir}', Rel='${relativePath}')`);
    
    dispatch({ type: ActionTypes.FS_LOAD_FILE_START });
    // REMOVED: setLoading(true);

    const dirPathForApi = pathJoin(topLevelDir, relativePath);
    const apiUrl = `/api/files/content?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(dirPathForApi)}`;
    logFileManager(`${logPrefix} Fetching content from API: ${apiUrl}`, 'debug');

    // >>> ADDED: Cleanup previous dynamic styles FIRST <<<
    logFileManager(`${logPrefix} Cleaning up ${currentDynamicStyleElements.length} previous dynamic style element(s)...`, 'debug');
    currentDynamicStyleElements.forEach(element => {
        try {
            element.remove();
        } catch (e) {
            logFileManager(`${logPrefix} Error removing style element: ${e.message}`, 'warn');
        }
    });
    currentDynamicStyleElements = []; // Reset the array
    logFileManager(`${logPrefix} Previous dynamic styles cleaned up.`, 'debug');

    // >>> ADDED: Cleanup previous host script (moved before fetch) <<<
    // It's better to cleanup the old script before even fetching new file content
    if (currentHostScriptPath) { // Check if there *was* an old script
        if (window.__WB001_HOST_MODULE__ && typeof window.__WB001_HOST_MODULE__.cleanup === 'function') {
            logFileManager(`${logPrefix} Calling cleanup() on previous host script: ${currentHostScriptPath}`, 'debug');
            try { await window.__WB001_HOST_MODULE__.cleanup(); } catch (cleanupError) {
                 logFileManager(`${logPrefix} Error cleaning up old host script '${currentHostScriptPath}': ${cleanupError.message}`, 'error');
            }
        } else { logFileManager(`${logPrefix} No cleanup function found on window.__WB001_HOST_MODULE__ for path ${currentHostScriptPath}`, 'debug'); }
        if(window.__WB001_HOST_MODULE__) window.__WB001_HOST_MODULE__ = null; // Clear global ref
         currentHostScriptModule = null;
        currentHostScriptPath = null;
         logFileManager(`${logPrefix} Previous host script cleaned up.`, 'info');
    }

    try {
        // Use globalFetch for the request
        const response = await globalFetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Failed to read file: ${response.status} ${response.statusText} - ${await response.text()}`);
        }
        const content = await response.text();
        logFileManager(`${logPrefix} Content fetched (${content.length} chars).`);

        // Parse Front Matter
        let frontMatter = {};
        try {
            const renderResult = await renderMarkdown(content);
            frontMatter = renderResult.frontMatter || {};
            logFileManager(`${logPrefix} Parsed front matter: ${JSON.stringify(frontMatter)}`, 'debug');
        } catch (parseError) {
            logFileManager(`${logPrefix} Error parsing front matter: ${parseError.message}. Proceeding without host script/css logic.`, 'warning');
            // If front matter fails, skip host script and dynamic CSS loading
            frontMatter = {}; // Ensure it's empty
        }

        // >>> ADDED: Load Dynamic CSS Styles <<<
        // 1. Handle embedded CSS block
        if (frontMatter.css && typeof frontMatter.css === 'string') {
            logFileManager(`${logPrefix} Applying embedded CSS from front matter...`, 'debug');
            try {
                const styleElement = document.createElement('style');
                styleElement.textContent = frontMatter.css;
                styleElement.setAttribute('data-dynamic-style-source', filename); // Mark for cleanup
                document.head.appendChild(styleElement);
                currentDynamicStyleElements.push(styleElement);
                logFileManager(`${logPrefix} Embedded CSS added to head.`, 'debug');
            } catch (e) {
                logFileManager(`${logPrefix} Error applying embedded CSS: ${e.message}`, 'error');
            }
        }
        // 2. Handle linked CSS files(s)
        const cssLinks = frontMatter.css_link ? (Array.isArray(frontMatter.css_link) ? frontMatter.css_link : [frontMatter.css_link]) : [];
        if (cssLinks.length > 0) {
             logFileManager(`${logPrefix} Applying ${cssLinks.length} linked CSS file(s) from front matter...`, 'debug');
             cssLinks.forEach(href => {
                 if (typeof href === 'string' && href.trim()) {
                     try {
                         const linkElement = document.createElement('link');
                         linkElement.rel = 'stylesheet';
                         linkElement.href = href.trim();
                         linkElement.setAttribute('data-dynamic-style-source', filename); // Mark for cleanup
                         document.head.appendChild(linkElement);
                         currentDynamicStyleElements.push(linkElement);
                         logFileManager(`${logPrefix} Added <link> for ${href} to head.`, 'debug');
                     } catch (e) {
                         logFileManager(`${logPrefix} Error adding <link> for ${href}: ${e.message}`, 'error');
                     }
                 }
             });
        }
        // >>> END: Load Dynamic CSS Styles <<<

        // Host Script Loading (No changes needed here, cleanup moved earlier)
        const newHostScriptPath = frontMatter.host_script;
        if (newHostScriptPath) { // Only load if specified
             logFileManager(`${logPrefix} Attempting to load host script: ${newHostScriptPath}`, 'info');
             try {
                const absolutePath = newHostScriptPath.startsWith('/') ? newHostScriptPath : `/${newHostScriptPath}`;
                await import(absolutePath);
                currentHostScriptPath = newHostScriptPath; // Track the path
                logFileManager(`${logPrefix} Successfully loaded host script: ${newHostScriptPath}. Init will be called later.`, 'info');
            } catch (importError) {
                logFileManager(`${logPrefix} Failed to load new host script '${newHostScriptPath}': ${importError.message}`, 'error');
                console.error(`Error loading host script ${newHostScriptPath}:`, importError);
                currentHostScriptPath = null; // Reset path tracking on error
                dispatch({ type: ActionTypes.FS_LOAD_FILE_ERROR, payload: { filename, error: importError.message } });
            }
        } else {
             logFileManager(`${logPrefix} No host script specified in front matter.`, 'info');
        }

        // Iframe Update Logic (No changes needed here)
        const iFrameSrc = frontMatter.iframe_src;
        let iframeElement = document.getElementById('game-iframe'); 
        if (iFrameSrc) {
            logFileManager(`${logPrefix} Found iframe_src in front matter: ${iFrameSrc}`, 'info');
            if (!iframeElement) {
                // If it doesn't exist, maybe create it? Or assume it should exist in preview? For now, log error.
                 logFileManager(`${logPrefix} iframe element with ID 'game-iframe' not found in DOM! Cannot set src.`, 'error');
                 // Consider creating it if necessary based on UI structure
                 // iframeElement = document.createElement('iframe');
                 // iframeElement.id = 'game-iframe';
                 // ... set other attributes ...
                 // document.getElementById('preview-container').appendChild(iframeElement); // Example append target
            } else {
                 logFileManager(`${logPrefix} Updating iframe#game-iframe src to: ${iFrameSrc}`, 'debug');
                 // Check if src is actually different to avoid unnecessary reloads
                 const currentSrc = iframeElement.getAttribute('src');
                 if (currentSrc !== iFrameSrc) {
                    iframeElement.setAttribute('src', iFrameSrc);
                    logFileManager(`${logPrefix} iframe src updated.`, 'debug');
                 } else {
                     logFileManager(`${logPrefix} iframe src is already correct.`, 'debug');
                 }
            }
        } else if (iframeElement) {
             // If no iframe_src is defined, but an iframe exists, maybe clear it?
             logFileManager(`${logPrefix} No iframe_src in front matter. Clearing existing iframe#game-iframe src.`, 'debug');
             iframeElement.setAttribute('src', 'about:blank'); 
        }

        // Delayed Host Script Initialization (No changes needed here)
        if (currentHostScriptPath && window.__WB001_HOST_MODULE__ && typeof window.__WB001_HOST_MODULE__.initialize === 'function') {
             logFileManager(`${logPrefix} Scheduling initialization for host script: ${currentHostScriptPath}`, 'debug');
             // Use setTimeout to allow the DOM (incl. iframe src update) to process
             setTimeout(async () => {
                 logFileManager(`${logPrefix} Timeout fired. Checking for iframe#game-iframe...`, 'info');
                 const iframeCheck = document.getElementById('game-iframe');
                 if (iframeCheck) {
                     logFileManager(`${logPrefix} Found iframe#game-iframe. Now attempting to call initialize() on window.__WB001_HOST_MODULE__`, 'info');
                     try {
                         await window.__WB001_HOST_MODULE__.initialize();
                         logFileManager(`${logPrefix} Host script initialize() completed.`, 'info');
                     } catch (initError) {
                         logFileManager(`${logPrefix} Error calling initialize() on host script: ${initError.message}`, 'error');
                     }
                 } else {
                     logFileManager(`${logPrefix} iframe#game-iframe STILL NOT FOUND after delay! Cannot initialize host script.`, 'error');
                 }
             }, 500); // <<< Increased delay to 500ms >>>
        } else if (currentHostScriptPath) {
             logFileManager(`${logPrefix} Host script loaded (${currentHostScriptPath}) but initialize function not found on window.__WB001_HOST_MODULE__.`, 'warning');
        }

        // Set editor content AFTER potential iframe update and host script load
        setContent(content);
        logFileManager(`${logPrefix} Editor content set.`);

        // Dispatch success action
        dispatch({ 
            type: ActionTypes.FS_LOAD_FILE_SUCCESS, 
            payload: { filename, frontMatter } // Omit content from store payload
        });
        logFileManager(`${logPrefix} Dispatched FS_LOAD_FILE_SUCCESS.`);
        // REMOVED: eventBus.emit('file:loaded', { ... });

    } catch (error) {
        logFileManager(`${logPrefix} Error loading file: ${error.message}`, 'error');
        console.error(error);
        setContent(''); // Clear editor on error
        logFileManager(`${logPrefix} Editor content cleared.`);
        
        // Dispatch error action
        dispatch({ type: ActionTypes.FS_LOAD_FILE_ERROR, payload: { filename, error: error.message } });
        logFileManager(`${logPrefix} Dispatched FS_LOAD_FILE_ERROR.`);
        // REMOVED: eventBus.emit('file:loadError', { ... });

        // >>> ADDED: Use exposed cleanup function if available <<<
        if (window.__WB001_HOST_MODULE__ && typeof window.__WB001_HOST_MODULE__.cleanup === 'function') {
            logFileManager(`${logPrefix} Calling cleanup() on window.__WB001_HOST_MODULE__ due to file load error...`, 'warning');
            try { await window.__WB001_HOST_MODULE__.cleanup(); } catch (e) {
                 logFileManager(`${logPrefix} Error during host script cleanup: ${e.message}`, 'error');
            }
        } else {
             logFileManager(`${logPrefix} window.__WB001_HOST_MODULE__.cleanup not found during error handling.`, 'debug');
        }
        currentHostScriptModule = null; // Still clear internal reference

    }
    // No finally/setLoading needed
}

export async function saveFile() {
    // Get current state from store
    const currentState = appStore.getState().file; 
    const filename = currentState.currentFile;
    const topLevelDir = currentState.topLevelDirectory;
    const relativePath = currentState.currentRelativePath;

    logFileManager(`Save requested. State Check: File='${filename}', TopDir='${topLevelDir}', RelPath='${relativePath}'`, 'debug');

    if (!filename || !topLevelDir) {
        logFileManager('Save aborted: Missing current file or top-level directory.', 'warning');
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { filename: filename || '', error: 'Cannot save: No file or directory context is selected.' }});
        return false;
    }
    if (currentState.isLoading || currentState.isSaving) { // Check store state
        logFileManager('Save aborted: Another file operation is in progress.', 'warning');
        // Optionally dispatch another error or rely on UI disabling the save button
        return false;
    }

    const content = getContent(); // Assume getContent is synchronous for now
    logFileManager(`Got content for save, length: ${content?.length}.`, 'debug');

    if (content === null || content === undefined) { // More robust check
        logFileManager('Save aborted: getContent() returned null or undefined.', 'error');
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { filename, error: 'Save Aborted: Failed to get editor content.' }});
        return false;
    }
    if (content === '') {
        logFileManager('Save aborted: Content is empty.', 'warning');
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { filename, error: 'Save Aborted: Cannot save an empty file.' }});
        return false;
    }

    const fullPathForApi = pathJoin(topLevelDir, relativePath);
    logFileManager(`Saving file '${filename}' to API path '${fullPathForApi}' (Content length: ${content.length})`);

    dispatch({ type: ActionTypes.FS_SAVE_FILE_START, payload: { filename } });

    try {
        const apiUrl = `/api/files/save`;
        const requestBody = { dir: fullPathForApi, name: filename, content: content };
        logFileManager(`Saving - API: ${apiUrl}`, 'debug');

        const response = await globalFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logFileManager(`Save failed with status ${response.status}: ${errorText}`, 'error');
            throw new Error(`(${response.status}) ${errorText}`);
        }
        const result = await response.json();
        if (!result.success) {
            logFileManager(`Server reported save failure: ${result.message || 'Unknown reason'}`, 'error');
            throw new Error(result.message || 'Server reported save failure');
        }

        logFileManager(`File '${filename}' saved successfully.`);
        dispatch({ type: ActionTypes.FS_SAVE_FILE_SUCCESS, payload: { filename } });
        // REMOVED: eventBus.emit('file:saved', { filename });
        // Potentially dispatch an action to update editor 'dirty' state if applicable
        // dispatch({ type: ActionTypes.EDITOR_SET_DIRTY, payload: false });
        return true;

    } catch (error) {
        logFileManager(`Failed to save file '${filename}'. Error: ${error.message}`, 'error', error);
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { filename, error: error.message } });
        // REMOVED: eventBus.emit('file:saveError', { ... });
        return false;
    }
}

// --- State Reset and Refresh Logic (Refactored) ---

export function resetFileManagerState() {
    logFileManager('Resetting FileManager state via dispatch...');
    
    // Dispatch action to reset the file slice to initial state
    dispatch({ 
        type: ActionTypes.FS_SET_STATE, 
        payload: { // Define the full reset state payload explicitly
            isInitialized: false, 
            isLoading: false,
            isSaving: false,
            topLevelDirectory: null,
            currentRelativePath: null,
            currentFile: null,
            currentListing: { dirs: [], files: [] },
            availableTopLevelDirs: [],
            error: null,
        } 
    });
    
    // Unsubscribe from store changes if subscribed
    if (fmUnsubscribe) {
        fmUnsubscribe();
        fmUnsubscribe = null;
        logFileManager("Unsubscribed FileManager from appStore changes.");
    }

    // Reset the local window flag
    if (window.APP) window.APP.fileManagerInitialized = false; 

    fileSystemState.clearState(); 
    updateUrlParameters(null, null, null);
    setContent(''); 

    logFileManager('FileManager state reset complete.');
}

export async function refreshFileManagerForUser(username) {
    const logPrefix = '[FILEMGR_REFRESH]';
    if (!username) {
        logFileManager(`${logPrefix} Called without username. Resetting.`, 'warning');
        resetFileManagerState();
        return;
    }
    
    logFileManager(`${logPrefix} START for user: ${username}`);
    // Indicate loading state for the refresh operation
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true, error: null } }); // <<< SET isLoading: true
    
    try {
        // 1. Reload top-level directories (dispatches FS_SET_TOP_DIRS)
        logFileManager(`${logPrefix} Calling loadTopLevelDirectories...`);
        await loadTopLevelDirectories();
        // Read the updated dirs from the store *after* the load finishes
        const availableDirs = appStore.getState().file.availableTopLevelDirs;
        logFileManager(`${logPrefix} loadTopLevelDirectories DONE. Available: [${availableDirs.join(', ')}]`);

        // 2. Determine target directory
        let targetTopDir = null;
        let targetRelativePath = null;
        if (username.toLowerCase() === 'mike') {
            targetTopDir = null;
            targetRelativePath = null;
            logFileManager(`${logPrefix} Determined context for 'mike': Root selection (Top=null, Rel=null)`);
        } else {
            if (availableDirs.includes(username)) {
                targetTopDir = username;
                targetRelativePath = null;
                logFileManager(`${logPrefix} Determined context for '${username}': User directory (Top='${targetTopDir}', Rel=null)`);
            } else {
                targetTopDir = null;
                targetRelativePath = null;
                logFileManager(`${logPrefix} User directory '${username}' not found. Defaulting to Root selection (Top=null, Rel=null)`, 'warning');
            }
        }

        // 3. Update state: Set new context, clear file and listing
        const newStatePayload = {
            topLevelDirectory: targetTopDir,
            currentRelativePath: targetRelativePath,
            currentFile: null,
            currentListing: { dirs: [], files: [] }, // Ensure listing is cleared
            isLoading: true, // Still loading until listing is fetched
            error: null
        };
        logFileManager(`${logPrefix} Dispatching FS_SET_STATE for user context: ${JSON.stringify(newStatePayload)}`);
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: newStatePayload });

        // Update persistence and URL
        fileSystemState.saveState({ currentDir: targetTopDir || '', currentFile: '' });
        updateUrlParameters(targetTopDir, targetRelativePath, null);
        
        setContent(''); // Clear editor
        logFileManager(`${logPrefix} Editor content cleared.`);

        // 4. Load listing for the new context (if applicable)
        if (targetTopDir) {
             logFileManager(`${logPrefix} Calling loadFilesAndDirectories for Top='${targetTopDir}', Rel='${targetRelativePath ?? ''}'...`);
             await loadFilesAndDirectories(targetTopDir, targetRelativePath ?? '');
             logFileManager(`${logPrefix} loadFilesAndDirectories finished.`);
        } else {
             logFileManager(`${logPrefix} No topLevelDirectory set. Ensuring listing is cleared in state.`);
             // Reducer for FS_SET_STATE already cleared listing
        }

        // 5. Finalize loading state
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false } }); // <<< SET isLoading: false
        logFileManager(`${logPrefix} END.`);

    } catch (error) {
        logFileManager(`${logPrefix} ERROR: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false, isSaving: false, error: error.message } });
    }
}

// --- Default Export --- 
// Only export functions intended for external use
export default {
    initializeFileManager,
    saveFile,
    // loadFile, loadFilesAndDirectories, loadTopLevelDirectories are internal helpers called by event handlers/init
    resetFileManagerState, 
    refreshFileManagerForUser 
    // Event handlers (handle*) are internal, triggered by eventBus listeners set up in initializeFileManager
}; 