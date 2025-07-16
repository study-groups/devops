/**
 * fileManager.js - Manages file system state, navigation, loading, and saving.
 * Uses unified 'pathname' semantics.
 */
import eventBus from '/client/eventBus.js';
// Editor methods accessed through WorkspaceLayoutManager
import { logMessage } from '/client/log/index.js';
import * as fileSystemState from './fileSystemState.js'; // Handles loading initial path from URL
import { appStore } from '/client/appState.js';
import { api } from '/client/api.js'; // Use refactored API
import { pathJoin, getParentPath, getFilename } from '/client/utils/pathUtils.js';
import { renderMarkdown } from '/client/preview/renderers/MarkdownRenderer.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

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
        // --- Get initial path (URL first, localStorage fallback) ---
        const { initialPathname, isDirectorySelected } = fileSystemState.loadState(); // Gets 'pathname' from URL or localStorage
        if (initialPathname !== null) {
            initialState.currentPathname = initialPathname;
            initialState.isDirectorySelected = isDirectorySelected;
             logFileManager(`Loaded initial pathname: '${initialState.currentPathname}', isDirectory: ${initialState.isDirectorySelected}`);
        } else {
             logFileManager(`No initial pathname from URL or localStorage.`);
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

        // --- Subscribe to Auth Changes ONLY ---
        if (fmUnsubscribe) fmUnsubscribe();

        // Create a selector that only returns the auth state.
        // The subscriber will only be called when the result of this selector changes.
        const selectAuth = state => state.auth;

        let previousAuth = selectAuth(appStore.getState());
        fmUnsubscribe = appStore.subscribe(() => {
            const currentAuth = selectAuth(appStore.getState());
            // Deep comparison is not strictly necessary if we assume auth state is immutable,
            // but a simple reference check is fast and effective here.
            if (currentAuth !== previousAuth) {
                // Pass a constructed "prevState" to the handler for compatibility.
                const mockPrevState = { auth: previousAuth };
                handleAuthStateChangeForFileManager(appStore.getState(), mockPrevState);
                previousAuth = currentAuth;
            }
        });

        logFileManager("Subscribed FileManager to auth state changes.");

        // --- Trigger initial check asynchronously so initialization can complete ---
        handleAuthStateChangeForFileManager(appStore.getState(), null);

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

    // The subscription is now specific, so we can remove the complex trigger reason logic.
    logFileManager(`[AUTH_CHANGE_HANDLER] Called. isLoggedIn: ${isLoggedIn}, wasLoggedIn: ${wasLoggedIn}, isAuthInitializing: ${isAuthInitializing}`, 'debug');

    if (isAuthInitializing) {
        logFileManager('[AUTH_CHANGE_HANDLER] Auth is initializing. Waiting.', 'debug');
        return; 
    }

    if (!wasLoggedIn && isLoggedIn) {
        logFileManager("[AUTH_CHANGE_HANDLER] User authenticated. Triggering initial file data load.", 'info');
        await loadInitialFileData();
        logFileManager("[AUTH_CHANGE_HANDLER] Finished awaiting loadInitialFileData in auth change handler.", 'debug');
    } else if (wasLoggedIn && !isLoggedIn) {
        logFileManager("[AUTH_CHANGE_HANDLER] User logged out. Resetting file manager state.", 'info');
        resetFileManagerState();
    } else if (isLoggedIn && newState.auth.user?.username !== prevState?.auth?.user?.username) {
         logFileManager(`[AUTH_CHANGE_HANDLER] Auth user changed. Triggering refresh for ${newState.auth.user?.username}.`, 'info');
         await refreshFileManagerForUser(newState.auth.user?.username); 
    }
}

// --- Initial Data Load (Refactored) ---
async function loadInitialFileData() {
    logFileManager('[LOAD_INITIAL_FILE_DATA] Entered function.', 'debug');
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true, error: null } });
    let initialStateError = null;

    try {
        logFileManager("[LOAD_INITIAL_FILE_DATA] Loading initial file data (pathname)...", 'debug');
        // 1. Load top-level directories (needed for context/admin view)
        await loadTopLevelDirectories();
        logFileManager("[LOAD_INITIAL_FILE_DATA] Finished awaiting loadTopLevelDirectories.", 'debug');

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
                await loadFilesAndDirectories(targetPathname);
            } else {
                logFileManager(`Loading initial file content for: '${targetPathname}'`);
                
                const parentPath = getParentPath(targetPathname);
                if (parentPath !== null) {
                    logFileManager(`Loading parent directory listing first: '${parentPath}'`);
                    await loadFilesAndDirectories(parentPath);
                }
                
                await loadFile(targetPathname);
            }
            console.log('[DEBUG_EMIT_POINT_1A] Reached point before initial load emit. targetPathname:', targetPathname);
            
            console.log('[DEBUG_EVENTBUS_CHECK_1A] window.eventBus exists:', !!window.eventBus);
            if (window.eventBus) {
                console.log('[DEBUG_EVENTBUS_CHECK_1A] typeof window.eventBus.emit:', typeof window.eventBus.emit);
            }

            // Emit path change for listeners like FileListComponent
            if (eventBus && typeof eventBus.emit === 'function') {
                logFileManager(`[FileManager] Emitting path:changed for initial load: ${targetPathname}`, 'debug');
                eventBus.emit('path:changed', { newPath: targetPathname, source: 'fileManagerInitialLoad' });
            } else {
                logFileManager('[FileManager] SKIPPED path:changed emit in initial load - imported eventBus or emit not ready.', 'warning');
            }
        } else {
            // Emit path change for listeners, indicating root or no path
            if (eventBus && typeof eventBus.emit === 'function') {
                logFileManager('[FileManager] Emitting path:changed for initial load (no path): null', 'debug');
                eventBus.emit('path:changed', { newPath: null, source: 'fileManagerInitialLoad' });
            } else {
                logFileManager('[FileManager] SKIPPED path:changed emit for no path - imported eventBus or emit not ready.', 'warning');
            }
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
        logFileManager(`[LOAD_INITIAL_FILE_DATA] Initial file data loading sequence complete. Error: ${initialStateError || 'None'}`, 'debug');
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
    // Content is now managed through app state - dispatch empty content
    dispatch({
        type: ActionTypes.FS_LOAD_FILE_SUCCESS,
        payload: { pathname: null, content: '' }
    });

    // Load data based on type
    if (isDirectory) {
        await loadFilesAndDirectories(normalizedPathname);
    } else {
        await loadFile(normalizedPathname);
    }
    // isLoading will be set to false by the load functions upon completion/error
    
    // Emit path:changed event so other components (like FileListComponent and Topbar display) can react
    if (eventBus && typeof eventBus.emit === 'function') {
        logFileManager(`[FileManager] Emitting path:changed after navigation: ${normalizedPathname}`, 'debug');
        eventBus.emit('path:changed', { newPath: normalizedPathname, source: 'fileManagerNavigation' });
    } else {
        logFileManager('[FileManager] SKIPPED path:changed emit after navigation - imported eventBus or emit not ready.', 'warning');
    }
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
    logFileManager('Attempting to load top-level directories...');
    dispatch({ type: ActionTypes.FS_SET_STATE, payload: { isLoading: true } });
    try {
        // Call the correct API endpoint for user directories
        logFileManager(`Calling /api/files/dirs`);
        const response = await fetch('/api/files/dirs', {
            credentials: 'include' // Include cookies for auth
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const directories = await response.json();
        logFileManager(`API response for user directories: ${JSON.stringify(directories)}`);

        if (directories && Array.isArray(directories)) {
             logFileManager(`Top-level dirs received: [${directories.join(', ')}]`);
             dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: directories });
             logFileManager(`Dispatched FS_SET_TOP_DIRS with payload: ${JSON.stringify(directories)}`);
        } else {
             logFileManager('No valid directories array found or API error.', 'warning');
             dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: [] });
             logFileManager(`Dispatched FS_SET_TOP_DIRS with empty payload due to invalid response.`);
        }
    } catch (error) {
        logFileManager(`Error loading top-level directories: ${error.message}`, 'error');
        dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: [] });
        logFileManager(`Dispatched FS_SET_TOP_DIRS with empty payload due to error.`);
        dispatch({ type: ActionTypes.FS_LOAD_TOP_DIRS_ERROR, payload: { error: error.message } });
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
        // Content will be cleared via app state
        // Dispatch state? Maybe just clear editor is enough if path is null/empty
        dispatch({ type: ActionTypes.FS_LOAD_FILE_SUCCESS, payload: { pathname: null, content: '' } }); // Reflect empty state
        return;
    }
    logFileManager(`[LoadFile ${pathname}]: Loading file content...`);
    dispatch({ type: ActionTypes.FS_LOAD_FILE_START });

    // --- FIX: Prevent trying to load a directory as a file ---
    // A simple check for a file extension. This is a reasonable guard
    // against trying to fetch content for a path like "/projects".
    if (!pathname.includes('.')) {
        logFileManager(`[LoadFile ${pathname}]: Path has no file extension, assuming directory.`, 'debug', 'FILEMGR');
        return;
    }

    try {
        // Extract directory and filename - Reuse pathUtils
        const directory = getParentPath(pathname);
        const filename = getFilename(pathname);

        if (!filename) {
             throw new Error(`Could not extract filename from pathname: ${pathname}`);
        }

        // Check authentication status before attempting to load
        const authState = appStore.getState().auth;
        if (!authState.isAuthenticated) {
            throw new Error('User not authenticated. Please log in to access files.');
        }

        logFileManager(`[LoadFile ${pathname}]: Calling api.fetchFileContent...`, 'debug');
        // <<< USE CORRECT API FUNCTION >>>
        // const content = await api.readFile(filename, directory); // OLD/WRONG
        const content = await api.fetchFileContent(pathname); // Pass the full pathname

        if (content === null || content === undefined) {
            throw new Error('File content is null or undefined - server may have returned empty response');
        }

        logFileManager(`[LoadFile ${pathname}]: Content loaded successfully (Length: ${content?.length ?? 0}). Content will be available in app state.`);

        // Dispatch success, ensuring pathname and content are stored in state
        dispatch({
             type: ActionTypes.FS_LOAD_FILE_SUCCESS,
             payload: { 
                 pathname: pathname, 
                 content: content // Store content in app state so EditorPanel can access it
             } // Reducer handles setting isDirectorySelected=false
        });

        // --- REMOVE Entire Dynamic Asset Handling Block --- 
        /*
        try {
            const previewModule = await import('/client/preview/markdown.js');
            // Removed front matter pre-parsing - Renderer handles this now
            // const { frontMatter } = previewModule.parseFrontMatter(content); // Assuming this exists

            // Dispatch completion action
            dispatch({
                type: ActionTypes.FS_LOAD_FILE_COMPLETE,
                payload: { pathname: pathname }
            });

            // --- Dynamic Asset Handling REMOVED - Handled by Renderer --- 
            // The renderer now parses front matter and injects necessary
            // <script>, <link>, and <style> tags directly into the preview HTML.
            /* 
            // Cleanup previous assets first
            cleanupDynamicAssets(`LoadFile ${pathname}`);
            // Load new ones
            await loadDynamicStyles(frontMatter, `LoadFile ${pathname}`);
            await loadHostScript(frontMatter.host_script, `LoadFile ${pathname}`); // Pass path directly
            updateIframeSource(frontMatter.iframe_src, `LoadFile ${pathname}`);
            * /
            // --- End REMOVED ---
        } catch (fmError) {
             logFileManager(`[LoadFile ${pathname}]: Error processing front matter or dynamic assets: ${fmError.message}`, 'warning');
        }
        */
        // --- END REMOVED BLOCK ---

    } catch (error) {
        logFileManager(`[LoadFile ${pathname}]: ERROR loading file: ${error.message}`, 'error');
        
        // Show detailed error information to help with debugging
        let errorDetails = error.message;
        if (error.status) {
            errorDetails += `\n\nHTTP Status: ${error.status}`;
        }
        if (error.stack) {
            logFileManager(`[LoadFile ${pathname}]: Error stack: ${error.stack}`, 'debug');
        }
        
        // Check if it's an authentication error
        const authState = appStore.getState().auth;
        if (!authState.isAuthenticated) {
            errorDetails = 'Authentication required. Please log in to access files.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorDetails = 'Authentication expired or insufficient permissions. Please log in again.';
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
            errorDetails = `File not found: ${pathname}\n\nThe file may have been moved, deleted, or you may not have permission to access it.`;
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
            errorDetails = `Server error while loading file: ${pathname}\n\nPlease check the server logs for more details.`;
        }
        
        // Show error content in state so EditorPanel can display it
        const errorContent = `## Error Loading File

Failed to load \`${pathname}\`.

**Error Details:**
\`\`\`
${errorDetails}
\`\`\`

**Troubleshooting:**
- Check if you are logged in
- Verify the file exists and you have permission to access it
- Check the browser console and server logs for more details
- Try refreshing the page

**Authentication Status:**
- Authenticated: ${authState.isAuthenticated}
- User: ${authState.user?.username || 'None'}
- Initializing: ${authState.isInitializing}

**Debug Info:**
- Timestamp: ${new Date().toISOString()}
- Pathname: ${pathname}
- User Agent: ${navigator.userAgent.substring(0, 50)}...
`;
        
        dispatch({ type: ActionTypes.FS_LOAD_FILE_ERROR, payload: { pathname, error: error.message, content: errorContent } });
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

    // Get content from app state
    const content = currentState.content || '';
    logFileManager(`[SAVE_DEBUG] Content from state: TYPE=${typeof content}, LENGTH=${content.length}`, 'debug');
    if (content === null || content === undefined || content === '') {
        logFileManager(`Save aborted: Content is null, undefined, or empty for '${pathname}'.`, 'warning');
        dispatch({ type: ActionTypes.FS_SAVE_FILE_ERROR, payload: { pathname, error: 'Cannot save: Content is empty or invalid.' }});
        return false;
    }

    logFileManager(`Saving file '${pathname}' (Content length: ${content.length})`);
    dispatch({ type: ActionTypes.FS_SAVE_FILE_START, payload: { pathname } });

    try {
        // Extract filename and directory
        // const directory = getParentPath(pathname); // Not needed for the corrected API call
        // const filename = getFilename(pathname); // Not needed for the corrected API call
        
        // if (!filename) { // Not needed
        //     throw new Error(`Could not extract filename from pathname: ${pathname}`);
        // }

        // Use direct fetch to the API endpoint
        const result = await fetch('/api/files/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pathname: pathname, // Corrected: send the full pathname
                content: content
                // name: filename, // Removed
                // dir: directory, // Removed
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
            currentPathname: null, isDirectorySelected: false, content: '',
            currentListing: { pathname: null, dirs: [], files: [] },
            parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] },
            availableTopLevelDirs: [], error: null,
        }
    });
    if (fmUnsubscribe) { fmUnsubscribe(); fmUnsubscribe = null; }
    if (window.APP) window.APP.fileManagerInitialized = false;
    fileSystemState.clearState(); // Clear persisted state (though it does little now)
    updateUrlParameters(null); // Clear pathname from URL
    // Content will be cleared via the state reset above
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
                content: '', // Clear content for new user context
                currentListing: { pathname: null, dirs: [], files: [] }, // Clear listing
                parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] }, // Clear parent listing
                isLoading: targetPathname !== null, // Stay loading only if we have a path to load
                error: null
            }
        });
        updateUrlParameters(targetPathname); // Update URL
        // Content cleared via state update above

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

// Add this at the top of the file
const originalFetchDirectoryListing = api.fetchDirectoryListing;
api.fetchDirectoryListing = function(directory) {
    if (directory && /\.[^/]+$/.test(directory)) {
        console.error(`[DEBUG] fetchDirectoryListing called on FILE:`, directory);
        console.trace('Call stack for wrong directory listing call');
        throw new Error(`Cannot list file as directory: ${directory}`);
    }
    return originalFetchDirectoryListing.call(this, directory);
}; 