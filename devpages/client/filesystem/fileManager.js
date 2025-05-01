/**
 * fileManager.js - Manages file system state, navigation, loading, and saving.
 * Uses unified 'pathname' semantics.
 */
import eventBus from '/client/eventBus.js';
import { getContent, setContent } from '/client/editor.js';
import { logMessage } from '/client/log/index.js';
import * as fileSystemState from './fileSystemState.js'; // Handles loading initial path from URL
import { appStore } from '/client/appState.js';
import { api } from '/client/api.js'; // Use refactored API
import { pathJoin, getParentPath, getFilename } from '/client/utils/pathUtils.js';
import { renderMarkdown } from '/client/preview/renderer.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

// --- Module State (Removed - state now in appStore) ---
let currentHostScriptPath = null;
// let currentHostScriptModule = null; // Not strictly needed?
let currentDynamicStyleElements = [];
let fmUnsubscribe = null;

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

// --- URL Parameter Helper (Refactored for pathname) ---
function updateUrlParameters(pathname) {
    try {
        // Direct URL construction without URLSearchParams to avoid encoding
        const baseUrl = window.location.pathname;
        const newUrl = pathname !== null && pathname !== undefined 
            ? `${baseUrl}?pathname=${pathname}`
            : baseUrl;
            
        if (window.location.href !== newUrl) {
            window.history.replaceState({ path: newUrl }, '', newUrl);
            logFileManager(`URL updated: pathname='${pathname ?? '(cleared)'}'`, 'debug');
        }
    } catch (error) {
        logFileManager(`Error updating URL: ${error.message}`, 'warning');
    }
}

// --- Initialization ---
export async function initializeFileManager() {
    if (window.APP?.fileManagerInitialized) {
        logFileManager('Attempted to initialize FileManager again. Skipping.', 'warning');
        return false;
    }
    window.APP = window.APP || {};
    window.APP.fileManagerInitialized = true;

    logFileManager('Initializing file manager (Using pathname)...');
    dispatch({ type: ActionTypes.FS_INIT_START });

    let initialState = {
        currentPathname: null,
        isDirectorySelected: false, // Default assumption
        isInitialized: false,
        isLoading: true, // Start loading until auth check / data load
    };

    try {
        // --- Get initial path (URL only) ---
        const { initialPathname } = fileSystemState.loadState(); // Gets 'pathname' from URL or null
        if (initialPathname !== null) {
            initialState.currentPathname = initialPathname;
            // Simple check: assume it's a directory unless it looks like a file (has extension)
            // This might be refined later based on actual listing results
            initialState.isDirectorySelected = !/\.[^/]+$/.test(initialPathname);
             logFileManager(`Loaded initial pathname from URL: '${initialState.currentPathname}', isDirectory: ${initialState.isDirectorySelected}`);
        } else {
             logFileManager(`No initial pathname from URL.`);
        }

        // --- Check for deep link restore (If no URL path) ---
        const currentAuthState = appStore.getState().auth;
        if (initialState.currentPathname === null && currentAuthState.isAuthenticated) {
            // ... (Deep link logic might need adjustment if it stored old format) ...
            // Assuming deepLink returns a single 'pathname' now
            try {
                const deepLinkModule = await import('/client/deepLink.js');
                const savedRequest = deepLinkModule.getSavedDeepLinkRequest(); // Assumes returns { pathname: '...' }
                if (savedRequest?.pathname) {
                    logFileManager(`Restoring deep link pathname: '${savedRequest.pathname}'`);
                    initialState.currentPathname = savedRequest.pathname;
                    initialState.isDirectorySelected = !/\.[^/]+$/.test(savedRequest.pathname); // Infer type
                    deepLinkModule.clearSavedDeepLinkRequest();
                }
            } catch (error) { /* ... log error ... */ }
        }

        // --- Set initial state in appStore ---
        logFileManager(`Dispatching initial FS_SET_STATE: ${JSON.stringify(initialState)}`);
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: initialState });
        // Update URL based on the determined initial state
        updateUrlParameters(initialState.currentPathname);

        setupEventListeners(); // Setup NEW event listeners

        // --- Subscribe to Auth Changes ---
        if (fmUnsubscribe) fmUnsubscribe();
        fmUnsubscribe = appStore.subscribe(handleAuthStateChangeForFileManager);
        logFileManager("Subscribed FileManager to appStore changes.");

        // --- Trigger initial check ---
        await handleAuthStateChangeForFileManager(appStore.getState(), null);

        // --- Mark initialization process as started ---
        // FS_INIT_COMPLETE will be dispatched by loadInitialFileData
        logFileManager('File manager initialization setup complete. Data loading deferred to auth state.');
        return true;

    } catch (error) {
        logFileManager(`Initialization failed critically: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_INIT_COMPLETE, payload: { error: error.message } });
        window.APP.fileManagerInitialized = false;
        return false;
    }
}

// --- Auth State Change Handler ---
async function handleAuthStateChangeForFileManager(newState, prevState) {
    const wasLoggedIn = prevState?.auth?.isAuthenticated ?? false;
    const isLoggedIn = newState.auth.isAuthenticated;
    const isAuthInitializing = newState.auth.isInitializing;

    if (isAuthInitializing) return; // Wait for auth

    if (!wasLoggedIn && isLoggedIn) {
        logFileManager("User authenticated. Triggering initial file data load.", 'info');
        await loadInitialFileData();
        logFileManager("Finished awaiting loadInitialFileData in auth change handler.");
    } else if (wasLoggedIn && !isLoggedIn) {
        logFileManager("User logged out. Resetting file manager state.", 'info');
        resetFileManagerState();
    } else if (isLoggedIn && newState.auth.user?.username !== prevState?.auth?.user?.username) {
         logFileManager(`Auth user changed. Triggering refresh for ${newState.auth.user?.username}.`, 'info');
         await refreshFileManagerForUser(newState.auth.user?.username); // Needs update
    }
}

// --- Initial Data Load (Refactored) ---
async function loadInitialFileData() {
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true, error: null } });
    let initialStateError = null;

    try {
        logFileManager("Loading initial file data (pathname)...");
        // 1. Load top-level directories (needed for context/admin view)
        await loadTopLevelDirectories();
        logFileManager("Finished awaiting loadTopLevelDirectories.");

        // 2. Determine effective initial path based on current state and role
        const currentState = appStore.getState();
        let targetPathname = currentState.file.currentPathname; // Path from URL/deepLink/persistence
        let targetIsDir = currentState.file.isDirectorySelected;
        const user = currentState.auth.user;

        // Improved detection of file vs directory
        if (targetPathname !== null) {
            // Check if path likely points to a file (has extension or ends with specific pattern)
            targetIsDir = !/\.[^/]+$/.test(targetPathname);
            
            // Update state immediately with better isDirectorySelected detection
            dispatch({
                type: ActionTypes.FS_SET_STATE, 
                payload: { 
                    currentPathname: targetPathname, 
                    isDirectorySelected: targetIsDir 
                }
            });
            
            logFileManager(`Initial pathname from URL/storage: '${targetPathname}', detected as ${targetIsDir ? 'directory' : 'file'}`);
        }

        // If no path set yet AND user is logged in, set default path
        if (targetPathname === null && user?.username) {
            if (user.role !== 'admin') { // Regular user defaults to their own directory
                targetPathname = user.username;
                targetIsDir = true;
                logFileManager(`Setting default pathname for user '${user.username}': '${targetPathname}'`);
            } else { // Admin defaults to root
                targetPathname = ''; // Admin starts at root
                targetIsDir = true;
                logFileManager(`Setting default pathname for admin: '(Root)'`);
            }
            // Update state immediately with the default path
            dispatch({
                type: ActionTypes.FS_SET_STATE, 
                payload: { 
                    currentPathname: targetPathname, 
                    isDirectorySelected: targetIsDir 
                }
            });
            updateUrlParameters(targetPathname); // Update URL too
        } else {
            logFileManager(`Using existing pathname: '${targetPathname}'`);
        }

        // 3. Load listing/file based on the determined targetPathname
        if (targetPathname !== null) {
            if (targetIsDir) {
                logFileManager(`Loading initial directory listing for: '${targetPathname}'`);
                await loadFilesAndDirectories(targetPathname); // Load listing for the directory
            } else {
                logFileManager(`Loading initial file content for: '${targetPathname}'`);
                
                // First load the parent directory to populate the file selector
                const parentPath = getParentPath(targetPathname);
                if (parentPath !== null) {
                    logFileManager(`Loading parent directory listing first: '${parentPath}'`);
                    await loadFilesAndDirectories(parentPath);
                }
                
                // Then load the file content
                await loadFile(targetPathname);
            }
        } else {
            // No path context yet (e.g., logged out or auth pending still?)
            logFileManager('No initial pathname context set for data loading.');
            dispatch({ type: ActionTypes.FS_LOAD_LISTING_SUCCESS, payload: { pathname: null, listing: { dirs: [], files: [] } } });
            setContent(''); // Ensure editor is empty
        }

    } catch (error) {
        initialStateError = error.message;
        logFileManager(`Initial file data loading failed: ${initialStateError}`, 'error');
    } finally {
        // Mark initialization complete (success or failure)
        dispatch({
            type: ActionTypes.FS_INIT_COMPLETE,
            payload: { error: initialStateError, isLoading: false } // Ensure loading is false
        });
        logFileManager(`Initial file data loading sequence complete. Error: ${initialStateError || 'None'}`);
    }
}

// --- Event Listener Setup (Refactored) ---
function setupEventListeners() {
    logFileManager('Setting up event listeners...');
    
    // Clear existing listeners first
    eventBus.off('navigate:pathname');
    eventBus.off('request:directoryListing');
    eventBus.off('file:save');
    
    // Add listeners
    eventBus.on('navigate:pathname', handleNavigateToPathname);
    eventBus.on('request:directoryListing', handleRequestDirectoryListing);
    eventBus.on('file:save', handleFileSave);
    
    // Add event listener for save button clicks
    document.addEventListener('click', handleDocumentClick);
    
    logFileManager('Event listeners ready.');
}

// --- Event Handlers (Refactored) ---

async function handleNavigateToPathname(data) {
    const { pathname, isDirectory } = data;
    const currentPathname = appStore.getState().file.currentPathname;

    // Basic validation
    if (pathname === undefined || pathname === null || typeof isDirectory !== 'boolean') {
        logFileManager(`Invalid navigate:pathname event received: ${JSON.stringify(data)}`, 'warning');
        return;
    }
    // Normalize path
    const normalizedPathname = pathJoin(pathname);

    if (normalizedPathname === currentPathname) {
        logFileManager(`Navigation ignored, already at pathname: '${normalizedPathname}'`, 'debug');
        return; // No change needed
    }

    logFileManager(`Event navigate:pathname received: '${normalizedPathname}', isDirectory=${isDirectory}`);

    // Update state optimistically BEFORE loading data
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: {
            currentPathname: normalizedPathname,
            isDirectorySelected: isDirectory,
            isLoading: true, // Set loading true as we'll fetch data
            error: null,
             // Clear parent listing when navigating normally
             parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] }
        }
    });
    updateUrlParameters(normalizedPathname); // Update URL

    // Clear editor content immediately if navigating away from a file or to a new directory
    setContent('');

    // Load data based on type
    if (isDirectory) {
        await loadFilesAndDirectories(normalizedPathname);
    } else {
        await loadFile(normalizedPathname);
    }
    // isLoading will be set to false by the load functions upon completion/error
}

// Handler specifically for fetching parent listing for sibling dropdowns
async function handleRequestDirectoryListing(data) {
    const { pathname, triggeringPath } = data;
    logFileManager(`Event request:directoryListing received for path: '${pathname}' (Triggered by: ${triggeringPath})`);
    try {
        // Use the correct API function name - fetchDirectoryListing
        const listing = await api.fetchDirectoryListing(pathname);
        logFileManager(`Parent listing received for '${pathname}': ${listing?.dirs?.length ?? 0} dirs, ${listing?.files?.length ?? 0} files`);
        dispatch({
            type: ActionTypes.FS_SET_PARENT_LISTING,
            payload: { pathname, listing, triggeringPath }
        });
    } catch (error) {
        logFileManager(`Error loading parent directory listing for '${pathname}': ${error.message}`, 'error');
        dispatch({
             type: ActionTypes.FS_SET_PARENT_LISTING,
             payload: { pathname, listing: { dirs: [], files: [] }, triggeringPath, error: error.message }
        });
    }
}

// Add document click handler to catch save button clicks
function handleDocumentClick(event) {
    const target = event.target;
    if (target.id === 'save-btn' || target.dataset.action === 'saveFile') {
        logFileManager('Save button clicked via document event listener', 'debug');
        event.preventDefault();
        handleFileSave();
    }
}

// Add this function to properly handle file save events
async function handleFileSave() {
    logFileManager('File save event received', 'info');
    await saveFile();
}

// --- API Interaction & Core Logic (Refactored for pathname) ---

async function loadTopLevelDirectories() {
    logFileManager('Attempting to load top-level directories...'); // Log entry
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true } }); // Ensure loading state is active
    try {
        logFileManager(`Calling api.fetchDirectoryListing with pathname: ''`); // Log API call
        const listing = await api.fetchDirectoryListing(''); // <<< CHANGE TO THIS

        // Log the raw response from the API
        logFileManager(`API response for root listing: ${JSON.stringify(listing)}`);

        if (listing && listing.dirs && Array.isArray(listing.dirs)) {
             logFileManager(`Top-level dirs received: [${listing.dirs.join(', ')}]`);
             dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: listing.dirs });
             logFileManager(`Dispatched FS_SET_TOP_DIRS with payload: ${JSON.stringify(listing.dirs)}`);
        } else {
             logFileManager('No valid directories array found at the root or API error.', 'warning');
             dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: [] }); // Dispatch empty array
             logFileManager(`Dispatched FS_SET_TOP_DIRS with empty payload due to invalid response.`);
        }
    } catch (error) {
        logFileManager(`Error loading top-level directories: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: [] }); // Dispatch empty on error
        logFileManager(`Dispatched FS_SET_TOP_DIRS with empty payload due to error.`);
        // Also dispatch error to state?
        dispatch({ type: ActionTypes.FS_LOAD_TOP_DIRS_ERROR, payload: { error: error.message } });

    } finally {
         // Consider setting isLoading: false here ONLY if this is the *only* thing loading
         // Probably better handled by FS_INIT_COMPLETE
         // dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false } });
    }
}

// Loads listing for a given directory pathname
async function loadFilesAndDirectories(pathname) {
    const state = appStore.getState();
    const currentPath = state.file.currentPathname;
    const isLoading = state.file.isLoading;

    logFileManager(`[LoadListing ${pathname}]: Starting load... Current state path: ${currentPath}, isLoading: ${isLoading}`);

    // Prevent reload if already loading or already at the target directory
    // Adjusted logic: Allow reload even if path matches, but maybe not if isLoading is true for THAT path?
    // Let's keep it simple for now: proceed if not already loading
    if (isLoading) {
         logFileManager(`[LoadListing ${pathname}]: Currently loading. Skipping duplicate request.`);
         // Maybe check if the *target* of the loading is different? For now, just skip if any load active.
         // return; // Let's allow it to proceed for now, state updates should handle idempotency.
    }


    dispatch({ type: ActionTypes.FS_LOAD_LISTING_START });
    try {
        // <<< ENSURE THIS IS CORRECT >>>
        // const listing = await api.listDirectory(pathname); // OLD/WRONG
        // const listing = await api.requestDirectoryListing(pathname); // ALIAS - MIGHT FAIL
        const listing = await api.fetchDirectoryListing(pathname); // <<< USE DIRECT METHOD NAME
        logFileManager(`[LoadListing ${pathname}]: API Success. Dirs: ${listing?.dirs?.length}, Files: ${listing?.files?.length}`);
        dispatch({ type: ActionTypes.FS_LOAD_LISTING_SUCCESS, payload: { pathname, listing } });
    } catch (error) {
        logFileManager(`[LoadListing ${pathname}]: ERROR fetching listing: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_LOAD_LISTING_ERROR, payload: { pathname, error: error.message } });
    }
}

// Loads content for a given file pathname
export async function loadFile(pathname) {
    if (!pathname) {
        logFileManager('LoadFile called with empty pathname. Clearing content.', 'warning');
        setContent(''); // Clear editor
        // Dispatch state? Maybe just clear editor is enough if path is null/empty
        dispatch({ type: ActionTypes.FS_LOAD_FILE_SUCCESS, payload: { pathname: null } }); // Reflect empty state
        return;
    }
    logFileManager(`[LoadFile ${pathname}]: Loading file content...`);
    dispatch({ type: ActionTypes.FS_LOAD_FILE_START });

    try {
        // Extract directory and filename - Reuse pathUtils
        const directory = getParentPath(pathname);
        const filename = getFilename(pathname);

        if (!filename) {
             throw new Error(`Could not extract filename from pathname: ${pathname}`);
        }

        // <<< USE CORRECT API FUNCTION >>>
        // const content = await api.readFile(filename, directory); // OLD/WRONG
        const content = await api.fetchFileContent(filename, directory); // CORRECTED

        logFileManager(`[LoadFile ${pathname}]: Content loaded successfully (Length: ${content?.length ?? 0}). Setting editor.`);
        setContent(content); // Update the editor

        // Dispatch success, ensuring pathname and isDirectorySelected are correct
        dispatch({
             type: ActionTypes.FS_LOAD_FILE_SUCCESS,
             payload: { pathname: pathname } // Reducer handles setting isDirectorySelected=false
        });

        // --- Handle dynamic assets based on front matter ---
        try {
             const previewModule = await import('/client/preview/markdown.js');
             const { frontMatter } = previewModule.parseFrontMatter(content); // Assuming this exists
             if (frontMatter) {
                logFileManager(`[LoadFile ${pathname}]: Found front matter. Handling dynamic assets.`);
                // Cleanup previous assets first
                cleanupDynamicAssets(`LoadFile ${pathname}`);
                // Load new ones
                await loadDynamicStyles(frontMatter, `LoadFile ${pathname}`);
                await loadHostScript(frontMatter.host_script, `LoadFile ${pathname}`); // Pass path directly
                updateIframeSource(frontMatter.iframe_src, `LoadFile ${pathname}`);
             } else {
                 // No front matter, ensure any previous dynamic assets are cleared
                 cleanupDynamicAssets(`LoadFile ${pathname} - No front matter`);
             }
         } catch (fmError) {
              logFileManager(`[LoadFile ${pathname}]: Error processing front matter or dynamic assets: ${fmError.message}`, 'warning');
         }
        // --- End Dynamic Asset Handling ---


    } catch (error) {
        logFileManager(`[LoadFile ${pathname}]: ERROR loading file: ${error.message}`, 'error');
        setContent(`## Error Loading File\n\nFailed to load \`${pathname}\`.\n\n**Error:**\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease check the console and server logs for more details.`); // Show error in editor
        dispatch({ type: ActionTypes.FS_LOAD_FILE_ERROR, payload: { pathname, error: error.message } });
    }
}

// Fix saveFile function using direct fetch to the correct endpoint
export async function saveFile() {
    const currentState = appStore.getState().file;
    const pathname = currentState.currentPathname;
    const isDirectory = currentState.isDirectorySelected;

    logFileManager(`Save requested. Pathname='${pathname}', isDirectory=${isDirectory}`, 'debug');

    if (isDirectory || !pathname) {
        logFileManager('Save aborted: No file is currently selected.', 'warning');
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { pathname: pathname || '', error: 'Cannot save: No file selected.' }});
        return false;
    }
    if (currentState.isLoading || currentState.isSaving) { return false; }

    const content = getContent();
    if (content === null || content === undefined || content === '') { return false; }

    logFileManager(`Saving file '${pathname}' (Content length: ${content.length})`);
    dispatch({ type: ActionTypes.FS_SAVE_FILE_START, payload: { pathname } });

    try {
        // Extract filename and directory
        const directory = getParentPath(pathname);
        const filename = getFilename(pathname);
        
        if (!filename) {
            throw new Error(`Could not extract filename from pathname: ${pathname}`);
        }

        // Use direct fetch to the API endpoint
        const result = await fetch('/api/files/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: filename,
                dir: directory,
                content: content
            }),
            credentials: 'include' // Include cookies for auth
        });
        
        if (!result.ok) {
            const errorText = await result.text();
            throw new Error(`Server returned ${result.status}: ${errorText || result.statusText}`);
        }

        logFileManager(`File '${pathname}' saved successfully.`);
        dispatch({ type: ActionTypes.FS_SAVE_FILE_SUCCESS, payload: { pathname } });
        return true;

    } catch (error) {
        logFileManager(`Failed to save file '${pathname}'. Error: ${error.message}`, 'error', error);
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { pathname, error: error.message } });
        return false;
    }
}

// --- State Reset and Refresh Logic (Refactored) ---

export function resetFileManagerState() {
    logFileManager('Resetting FileManager state (pathname)...');
    // Dispatch action to reset the file slice
    dispatch({
        type: ActionTypes.FS_SET_STATE,
        payload: { // Define the full reset state payload explicitly
            isInitialized: false, isLoading: false, isSaving: false,
            currentPathname: null, isDirectorySelected: false,
            currentListing: { pathname: null, dirs: [], files: [] },
            parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] },
            availableTopLevelDirs: [], error: null,
        }
    });
    if (fmUnsubscribe) { fmUnsubscribe(); fmUnsubscribe = null; }
    if (window.APP) window.APP.fileManagerInitialized = false;
    fileSystemState.clearState(); // Clear persisted state (though it does little now)
    updateUrlParameters(null); // Clear pathname from URL
    setContent('');
    cleanupDynamicAssets('(Reset)'); // Clean up any dynamic assets
    logFileManager('FileManager state reset complete.');
}

export async function refreshFileManagerForUser(username) {
    const logPrefix = '[FILEMGR_REFRESH]';
    if (!username) { /* ... reset ... */ return; }
    logFileManager(`${logPrefix} START for user: ${username}`);
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true, error: null } });

    try {
        await loadTopLevelDirectories(); // Load dirs based on new user/role
        const { availableTopLevelDirs } = appStore.getState().file;
        const userRole = appStore.getState().auth.user?.role; // Get role

        let targetPathname = null;
        let targetIsDir = false;

        if (userRole === 'admin') {
            targetPathname = ''; // Admin defaults to root
            targetIsDir = true;
            logFileManager(`${logPrefix} Determined context for admin: '(Root)'`);
        } else if (userRole === 'user' && availableTopLevelDirs.includes(username)) {
            targetPathname = username; // User defaults to own directory
            targetIsDir = true;
            logFileManager(`${logPrefix} Determined context for user '${username}': '${targetPathname}'`);
        } else {
             logFileManager(`${logPrefix} Could not determine default context for '${username}' (Role: ${userRole}, Dirs: [${availableTopLevelDirs.join(',')}]). Defaulting to null.`, 'warning');
             targetPathname = null; // No specific context
             targetIsDir = false;
        }

        // Dispatch state update for the new context
        dispatch({
            type: ActionTypes.FS_SET_STATE,
            payload: {
                currentPathname: targetPathname,
                isDirectorySelected: targetIsDir,
                currentFile: null, // Ensure file is cleared
                currentListing: { pathname: null, dirs: [], files: [] }, // Clear listing
                parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] }, // Clear parent listing
                isLoading: targetPathname !== null, // Stay loading only if we have a path to load
                error: null
            }
        });
        updateUrlParameters(targetPathname); // Update URL
        setContent(''); // Clear editor

        // Load listing for the new context (if applicable)
        if (targetPathname !== null && targetIsDir) {
             logFileManager(`${logPrefix} Calling loadFilesAndDirectories for '${targetPathname}'...`);
             await loadFilesAndDirectories(targetPathname);
        } else {
             dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false } }); // Ensure loading stops if no path
        }
        // Finalize loading state (might be redundant if loadFilesAndDirectories handles it)
        // dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false } });
        logFileManager(`${logPrefix} END.`);

    } catch (error) {
        logFileManager(`${logPrefix} ERROR: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: false, isSaving: false, error: error.message } });
    }
}

// --- Helper Functions for Dynamic Assets ---

function cleanupDynamicAssets(context = '(Unknown)') {
    logFileManager(`[CleanupAssets ${context}] Cleaning dynamic styles and host script...`, 'debug');
    // Styles
    currentDynamicStyleElements.forEach(element => {
        try { element.remove(); } catch (e) { logFileManager(`Error removing style: ${e.message}`, 'warn'); }
    });
    currentDynamicStyleElements = [];
    // Script
    cleanupHostScript(`(Asset Cleanup for ${context})`);
}

function cleanupHostScript(logContext = '') {
    if (currentHostScriptPath) {
        if (window.__WB001_HOST_MODULE__?.cleanup) {
            logFileManager(`${logContext} Calling cleanup() on previous host script: ${currentHostScriptPath}`, 'debug');
            try { window.__WB001_HOST_MODULE__.cleanup(); } catch (e) { logFileManager(`${logContext} Error cleaning up host script: ${e.message}`, 'error'); }
        }
        window.__WB001_HOST_MODULE__ = null; // Clear global ref regardless
        currentHostScriptPath = null;
        logFileManager(`${logContext} Previous host script reference cleared.`, 'info');
    }
}

async function loadDynamicStyles(frontMatter, logContext = '') {
    // Embedded CSS
    if (frontMatter.css && typeof frontMatter.css === 'string') { /* ... create/append style tag ... */ }
    // Linked CSS
    const cssLinks = frontMatter.css_link ? (Array.isArray(frontMatter.css_link) ? frontMatter.css_link : [frontMatter.css_link]) : [];
    cssLinks.forEach(href => { /* ... create/append link tag ... */ });
}

async function loadHostScript(scriptPath, logContext = '') {
    if (!scriptPath) {
        currentHostScriptPath = null;
        return; // No script to load
    }
    logFileManager(`[LoadScript ${logContext}] Attempting load: ${scriptPath}`, 'info');
    try {
        // Assume scriptPath is relative to web root if not starting with /
        const importPath = scriptPath.startsWith('/') ? scriptPath : `/${scriptPath}`;
        await import(importPath); // Dynamic import
        currentHostScriptPath = scriptPath; // Track success
        logFileManager(`[LoadScript ${logContext}] Successfully loaded: ${scriptPath}`, 'info');
    } catch (importError) {
        logFileManager(`[LoadScript ${logContext}] FAILED to load '${scriptPath}': ${importError.message}`, 'error');
        currentHostScriptPath = null; // Reset on error
        // Maybe dispatch an error? For now, just log.
        // dispatch({ type: ActionTypes.FS_LOAD_FILE_ERROR, payload: { pathname: logContext, error: `Failed to load host script: ${scriptPath}` }});
    }
}

function updateIframeSource(iframeSrc, logContext = '') {
    let iframeElement = document.getElementById('game-iframe');
    if (iframeSrc) { /* ... update src if different ... */ }
    else if (iframeElement) { /* ... clear src ... */ }
}

function scheduleHostScriptInit(scriptPath, logContext = '') {
     if (scriptPath && window.__WB001_HOST_MODULE__?.initialize) {
         logFileManager(`${logContext} Scheduling initialization for host script: ${scriptPath}`, 'debug');
         setTimeout(async () => {
             logFileManager(`${logContext} Init timeout fired. Checking iframe...`, 'info');
             const iframeCheck = document.getElementById('game-iframe');
             if (iframeCheck) {
                  logFileManager(`${logContext} Found iframe. Calling initialize()...`, 'info');
                  try {
                      await window.__WB001_HOST_MODULE__.initialize();
                      logFileManager(`${logContext} Host script initialize() completed.`, 'info');
                  } catch (initError) { /* ... log error ... */ }
             } else { /* ... log error ... */ }
         }, 500);
    } else if (scriptPath) { /* ... log warning if initialize missing ... */ }
}


// --- Default Export ---
export default {
    initializeFileManager,
    saveFile,
    resetFileManagerState,
    // refreshFileManagerForUser // Removed? Or needs update if kept
    // loadFile // Primarily internal now
}; 