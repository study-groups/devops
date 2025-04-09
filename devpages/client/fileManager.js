/**
 * fileManager.js - Manages file system state, navigation, loading, and saving.
 * Implements agreed path semantics and event-driven flow.
 */
import { eventBus } from '/client/eventBus.js';
import { getContent, setContent } from '/client/editor.js';
import { logMessage } from '/client/log/index.js';
import fileSystemState from '/client/fileSystemState.js'; // Authoritative state persistence
import { authState } from '/client/authState.js'; // ADDED import
import { globalFetch } from '/client/globalFetch.js'; // ADDED import

// --- Module State ---
const fileState = {
    topLevelDirectory: '',   // e.g., 'gridranger'
    currentRelativePath: '', // e.g., '', 'iframe', 'iframe/assets'
    currentFile: '',         // e.g., 'game-iframe-001.md'
    isInitialized: false,    // Ensure init runs only once
    isLoading: false,        // Track API call progress
    topLevelDirs: []         // ADDED: Store available top-level directories
};
let currentListingData = { dirs: [], files: [] }; // Store current listing

// --- Logging Helper ---
function logFileManager(message, level = 'text') {
    const prefix = '[FILEMGR]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
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
// Updates internal state, saves to persistence, updates URL
function updateAndPersistState(newState) {
    const changedStateForPersistence = {};
    let stateActuallyChanged = false;

    logFileManager(`updateAndPersistState: Called with newState=${JSON.stringify(newState)}. Current fileState BEFORE update: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`, 'debug');

    if (newState.topLevelDirectory !== undefined && newState.topLevelDirectory !== fileState.topLevelDirectory) {
        fileState.topLevelDirectory = newState.topLevelDirectory;
        changedStateForPersistence.currentDir = fileState.topLevelDirectory;
        stateActuallyChanged = true;
    }
    if (newState.currentRelativePath !== undefined && newState.currentRelativePath !== fileState.currentRelativePath) {
        fileState.currentRelativePath = newState.currentRelativePath;
        stateActuallyChanged = true;
    }
    if (newState.currentFile !== undefined && newState.currentFile !== fileState.currentFile) {
        fileState.currentFile = newState.currentFile;
        changedStateForPersistence.currentFile = fileState.currentFile;
        stateActuallyChanged = true;
    }

    if (stateActuallyChanged) {
        logFileManager(`Internal fileState AFTER update: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`, 'debug');
        // Persist core state (dir, file) using fileSystemState
        if (Object.keys(changedStateForPersistence).length > 0) {
            logFileManager(`Persisting state changes: ${JSON.stringify(changedStateForPersistence)}`, 'debug');
            fileSystemState.saveState(changedStateForPersistence);
        }
        // Update URL to reflect the full current state
        updateUrlParameters(fileState.topLevelDirectory, fileState.currentRelativePath, fileState.currentFile);
    } else {
        logFileManager(`updateAndPersistState: No actual state changes detected.`, 'debug');
    }
}

// --- Initialization ---
export async function initializeFileManager() {
    if (fileState.isInitialized) {
        logFileManager('Attempted to initialize FileManager again. Skipping.', 'warning');
        return false; // Prevent re-initialization
    }
    logFileManager('Initializing file manager (v_ContextMgrRefactor)...');

    // --- Get initial state (URL > localStorage > Default) ---
    const initialState = fileSystemState.loadState();
    fileState.topLevelDirectory = initialState.currentDir;
    fileState.currentRelativePath = initialState.currentRelativePath; 
    fileState.currentFile = initialState.currentFile;

    // --- ADDED: Default to username if logged in and no directory set ---
    const currentUserState = authState.get();
    if (currentUserState.isAuthenticated && !fileState.topLevelDirectory) {
        logFileManager('No directory context from URL/localStorage, user logged in. Defaulting to username.');
        fileState.topLevelDirectory = currentUserState.username;
        // Persist this default state immediately
        updateAndPersistState({ topLevelDirectory: fileState.topLevelDirectory });
    }
    // --- END ADDED SECTION ---

    logFileManager(`Initializing with state: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`);

    setupEventListeners(); // Set up listeners for UI navigation events

    try {
        // 1. Load top-level directories first (essential for context)
        await loadTopLevelDirectories(); // Emits 'dirsLoaded'

        let initialFileNeedsLoading = false;

        // 2. If a top-level directory is set, load its initial listing
        if (fileState.topLevelDirectory) {
            await loadFilesAndDirectories(fileState.topLevelDirectory, fileState.currentRelativePath); // Emits 'listingLoaded', updates module var directly

            // ADDED: Log currentListingData right before use
            logFileManager(`[INIT] After loadFilesAndDirectories, checking currentListingData: ${JSON.stringify(currentListingData)}`, 'debug');

            // 3. Validate if the initial file exists in the loaded listing
            if (fileState.currentFile && Array.isArray(currentListingData.files) && currentListingData.files.includes(fileState.currentFile)) {
                initialFileNeedsLoading = true;
                logFileManager(`Initial file '${fileState.currentFile}' validated in listing.`);
            } else if (fileState.currentFile) {
                logFileManager(`Initial file '${fileState.currentFile}' NOT found for Top='${fileState.topLevelDirectory}', Rel='${fileState.currentRelativePath}'. Clearing file state.`, 'warning');
                updateAndPersistState({ currentFile: '' }); // Correct the state
                fileState.currentFile = ''; // Ensure internal state reflects this immediately for step 5
            }
        } else {
            logFileManager('No initial directory context set.');
            // Ensure file/path are cleared if no top dir
            if(fileState.currentFile || fileState.currentRelativePath) {
                 updateAndPersistState({ currentFile: '', currentRelativePath: '' });
                 fileState.currentFile = '';
                 fileState.currentRelativePath = '';
            }
            // Ensure UI clears listings
             eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' });
        }

        // 4. Mark as initialized and emit stateSettled - UI uses this to set selections
        fileState.isInitialized = true;
        logFileManager('Emitting fileManager:stateSettled (Initialization)...');
        eventBus.emit('fileManager:stateSettled', {
             topLevelDirectory: fileState.topLevelDirectory,
             relativePath: fileState.currentRelativePath,
             currentFile: fileState.currentFile
             // No listing data needed here, UI uses separate events
        });

        // 5. AFTER state is settled and UI *should* be synced, load the initial file content if needed
        if (initialFileNeedsLoading) {
             logFileManager(`Proceeding to load initial file content: '${fileState.currentFile}'`);
             await loadFile(fileState.currentFile, fileState.topLevelDirectory, fileState.currentRelativePath); // Emits 'file:loaded' or 'file:loadError'
        }

        logFileManager('File manager initialization sequence complete.');
        return true;

    } catch (error) {
        logFileManager(`Initialization failed critically: ${error.message}`, 'error');
        console.error("FileManager Initialization Critical Error:", error); // Make sure it's visible
        fileState.isInitialized = false; // Ensure it can be retried? Or maybe prevent retry.
        // Optionally emit a failure event
        // eventBus.emit('fileManager:initFailed', { error: error.message });
        return false;
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
    const newTopLevelDir = data?.directory || '';
    logFileManager(`Event navigate:topLevelDir received: New dir = '${newTopLevelDir}'`);

    // Update state: New top dir, clear relative path & file
    updateAndPersistState({
        topLevelDirectory: newTopLevelDir,
        currentRelativePath: '',
        currentFile: ''
    });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear listing
    
    // Load listing for the new top-level dir (or clear if none selected)
    if (newTopLevelDir) {
        await loadFilesAndDirectories(fileState.topLevelDirectory, fileState.currentRelativePath); // Emits listingLoaded which uses currentListingData
    } else {
        eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' }); // Clear UI listing
    }

    // Emit state settled AFTER listing is loaded/cleared
    logFileManager('Emitting fileManager:stateSettled (TopLevelDir Change)...');
    eventBus.emit('fileManager:stateSettled', {
         topLevelDirectory: fileState.topLevelDirectory,
         relativePath: fileState.currentRelativePath,
         currentFile: fileState.currentFile
    });
}

async function handleDirectoryNavigation(data) {
    const subdirName = data?.directory;
    if (!subdirName || !fileState.topLevelDirectory) return; // Need context

    const newRelativePath = pathJoin(fileState.currentRelativePath, subdirName);
    logFileManager(`Event navigate:directory received: subdir='${subdirName}', newRelPath='${newRelativePath}'`);

    // Update state: New relative path, clear file
    updateAndPersistState({ currentRelativePath: newRelativePath, currentFile: '' });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear old listing before load

    // Load listing for new path
    await loadFilesAndDirectories(fileState.topLevelDirectory, fileState.currentRelativePath); // Emits listingLoaded

    // Emit state settled AFTER listing is loaded
    logFileManager('Emitting fileManager:stateSettled (Directory Navigation)...');
    eventBus.emit('fileManager:stateSettled', {
         topLevelDirectory: fileState.topLevelDirectory,
         relativePath: fileState.currentRelativePath,
         currentFile: fileState.currentFile
     });
}

async function handleUpNavigation() {
    if (!fileState.topLevelDirectory || fileState.currentRelativePath === '') {
         logFileManager('Event navigate:up ignored: No directory context or already at root relative path.');
        return; // Cannot go up further
    }
    const parentPath = getParentRelativePath(fileState.currentRelativePath);
    logFileManager(`Event navigate:up received: newRelPath='${parentPath}'`);

    // Update state: Set parent path, clear file
    updateAndPersistState({ currentRelativePath: parentPath, currentFile: '' });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear old listing before load

    // Load listing for parent path
    await loadFilesAndDirectories(fileState.topLevelDirectory, fileState.currentRelativePath); // Emits listingLoaded

    // Emit state settled AFTER listing is loaded
    logFileManager('Emitting fileManager:stateSettled (Up Navigation)...');
    eventBus.emit('fileManager:stateSettled', {
         topLevelDirectory: fileState.topLevelDirectory,
         relativePath: fileState.currentRelativePath,
         currentFile: fileState.currentFile
     });
}

async function handleFileNavigation(data) {
    const filename = data?.filename;
    if (!filename || !fileState.topLevelDirectory) {
         logFileManager(`Event navigate:file ignored: Missing filename ('${filename}') or topLevelDirectory ('${fileState.topLevelDirectory}')`, 'warning');
        return; // Need context and file
    }
    if (filename === fileState.currentFile) return; // Already loaded

    logFileManager(`Event navigate:file received: file='${filename}'`);
    // Attempt to load the file. loadFile handles state updates & events internally.
    await loadFile(filename, fileState.topLevelDirectory, fileState.currentRelativePath);
    // NOTE: stateSettled is generally NOT emitted just for a file load,
    // only file:loaded. UI needs to react appropriately.
}

// ADDED: Handler for navigating back to root selection
async function handleNavigateToRoot() {
    const logPrefix = '[FILEMGR_NAVROOT]';
    logFileManager(`${logPrefix} START. Handling navigate to root...`);
    
    const currentUser = authState.get();
    
    // Always ensure top-level dirs are loaded first
    if (fileState.topLevelDirs.length === 0) {
        logFileManager(`${logPrefix} Top-level dirs not loaded, fetching...`);
        await loadTopLevelDirectories();
        logFileManager(`${logPrefix} Top-level dirs loaded.`);
    }
    
    let targetTopDir = '';
    let targetRelativePath = '';
    let needsListingLoad = false;

    if (currentUser.isAuthenticated) {
        if (currentUser.username.toLowerCase() === 'mike') {
             // Mike goes to root selection, no specific dir/listing needed initially
             targetTopDir = '';
             targetRelativePath = '';
             logFileManager(`${logPrefix} User is 'mike'. Setting context to root selection.`);
        } else {
            // Other logged-in users go to their own directory
            targetTopDir = currentUser.username;
            targetRelativePath = '';
            // Check if this directory actually exists in the list
            if (fileState.topLevelDirs.includes(targetTopDir)) {
                 logFileManager(`${logPrefix} User '${currentUser.username}'. Setting context to user directory '${targetTopDir}'.`);
                 needsListingLoad = true; // We need to load the listing for this directory
            } else {
                 logFileManager(`${logPrefix} User directory '${targetTopDir}' not found for user '${currentUser.username}'. Defaulting to root selection.`, 'warning');
                 targetTopDir = ''; // Fallback to root selection
                 needsListingLoad = false;
            }
        }
    } else {
        // Logged out user goes to root selection
        targetTopDir = '';
        targetRelativePath = '';
         logFileManager(`${logPrefix} User is logged out. Setting context to root selection.`);
    }

    // Update state
    logFileManager(`${logPrefix} Updating state: Top='${targetTopDir}', Rel='${targetRelativePath}', File=''`);
    updateAndPersistState({ 
        topLevelDirectory: targetTopDir, 
        currentRelativePath: targetRelativePath, 
        currentFile: '' 
    });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear listing data before potential load

    // Load listing if needed (only for non-Mike users going to their dir)
    if (needsListingLoad) {
         logFileManager(`${logPrefix} Needs listing load for '${targetTopDir}'. Calling loadFilesAndDirectories...`);
         await loadFilesAndDirectories(targetTopDir, targetRelativePath);
         logFileManager(`${logPrefix} Listing load complete.`);
    } else {
         logFileManager(`${logPrefix} No listing load needed. Emitting empty listingLoaded event.`);
         // Ensure UI clears listing if none was loaded
          eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' }); 
    }

    // Emit state settled AFTER potential listing load is complete
    logFileManager(`${logPrefix} Emitting fileManager:stateSettled...`);
    eventBus.emit('fileManager:stateSettled', {
         topLevelDirectory: fileState.topLevelDirectory,
         relativePath: fileState.currentRelativePath,
         currentFile: fileState.currentFile
    });
    logFileManager(`${logPrefix} stateSettled emitted. END.`);
}

// ADDED: Handler for Mike's request to see the top-level selector
async function handleRequestTopLevelSelector() {
    logFileManager('Event ui:requestTopLevelSelector received (for Mike).');
    // Ensure top-level dirs are loaded
    if (fileState.topLevelDirs.length === 0) {
        logFileManager('Top-level dirs not loaded for selector request, fetching...');
        await loadTopLevelDirectories();
    }
    // Now, trigger the navigation to root state, which will clear the selection
    // and allow the UI to render the selector based on the empty topLevelDirectory state.
    await handleNavigateToRoot(); 
}

// ADDED: Handler for navigating to an absolute path (via breadcrumb)
async function handleNavigateAbsolute(data) {
     const { topLevelDir, relativePath } = data;
     logFileManager(`Event navigate:absolute received: Top='${topLevelDir}', Rel='${relativePath}'`);
     if (topLevelDir === fileState.topLevelDirectory && relativePath === fileState.currentRelativePath) {
         return; // No change
     }

     // Update state: Set exact path, clear file
     updateAndPersistState({
         topLevelDirectory: topLevelDir,
         currentRelativePath: relativePath,
         currentFile: ''
     });
     setContent(''); // Clear editor
     currentListingData = { dirs: [], files: [] }; // Clear old listing before load

     // Load listing for new path
     await loadFilesAndDirectories(topLevelDir, relativePath); // Emits listingLoaded

     // Emit state settled AFTER listing is loaded
     logFileManager('Emitting fileManager:stateSettled (Navigate Absolute)...');
     eventBus.emit('fileManager:stateSettled', {
         topLevelDirectory: fileState.topLevelDirectory,
         relativePath: fileState.currentRelativePath,
         currentFile: fileState.currentFile
     });
}

// --- API Interaction & Core Logic ---

async function loadTopLevelDirectories() {
    logFileManager('Loading top-level directories...');
    setLoading(true);
    try {
        const response = await globalFetch('/api/files/dirs'); // Uses existing endpoint
        if (!response.ok) {
            throw new Error(`Failed to fetch directories: ${response.status}`);
        }
        const dirs = await response.json();
        if (!Array.isArray(dirs)) {
             throw new Error('Invalid directory list format from server.');
        }
        logFileManager(`Received ${dirs.length} top-level dirs: [${dirs.join(', ')}]`);
        fileState.topLevelDirs = dirs; // ADDED: Store fetched dirs
        eventBus.emit('fileManager:dirsLoaded', dirs);
    } catch (error) {
        logFileManager(`Error loading top-level directories: ${error.message}`, 'error');
        fileState.topLevelDirs = []; // Clear on error
        eventBus.emit('fileManager:dirsLoaded', []); // Emit empty list on error
        // Maybe throw or handle more gracefully depending on requirements
    } finally {
        setLoading(false);
    }
}

async function loadFilesAndDirectories(topLevelDir, relativePath) {
    const logPrefix = '[FILEMGR_LOADLIST]';
    const apiPath = pathJoin(topLevelDir, relativePath);
    logFileManager(`${logPrefix} START for API path: '${apiPath}' (Top='${topLevelDir}', Rel='${relativePath}')`);
    setLoading(true);
    logFileManager(`${logPrefix} setLoading(true)`);
    try {
        const apiUrl = `/api/files/list?dir=${encodeURIComponent(apiPath)}`;
        logFileManager(`${logPrefix} Fetching: ${apiUrl}`);
        const response = await globalFetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Failed to list files: ${response.status} for path '${apiPath}'`);
        }
        const data = await response.json();
        logFileManager(`${logPrefix} Received data: Dirs=[${data.dirs?.join(', ')}], Files=[${data.files?.join(', ')}]`);
        currentListingData = data; // Update internal listing

        logFileManager(`${logPrefix} Emitting fileManager:listingLoaded...`);
        eventBus.emit('fileManager:listingLoaded', {
             ...currentListingData,
             // Include context for clarity, though receiver might not use it
             topLevelDirectory: topLevelDir, 
             relativePath: relativePath 
        });
        logFileManager(`${logPrefix} listingLoaded emitted.`);

        // Maybe return data if needed by caller (refresh doesn't currently use it)
        // return currentListingData; 

    } catch (error) {
        logFileManager(`${logPrefix} ERROR: ${error.message}`, 'error');
        currentListingData = { dirs: [], files: [] }; // Clear listing on error
        // Emit empty listing on error so UI clears
        logFileManager(`${logPrefix} Emitting EMPTY fileManager:listingLoaded due to error...`);
        eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: relativePath }); 
    } finally {
        setLoading(false);
         logFileManager(`${logPrefix} setLoading(false). END for API path: '${apiPath}'`);
    }
}

export async function loadFile(filename, topLevelDir, relativePath) {
    // Path construction for API Call
    const fullPathForApi = pathJoin(topLevelDir, relativePath);
    logFileManager(`Requesting file content: '${filename}' from API path '${fullPathForApi}'`);
    setLoading(true);
    try {
        const apiUrl = `/api/files/content?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(fullPathForApi)}`;
        const response = await fetch(apiUrl);
        if (!response.ok) { throw new Error(`(${response.status}) ${await response.text()}`) }
        const content = await response.text();

        setContent(content);
        const previousFile = fileState.currentFile;
        // Update state *after* successful load
        updateAndPersistState({ currentFile: filename });

        logFileManager(`File '${filename}' loaded successfully.`);
        eventBus.emit('file:loaded', { filename: fileState.currentFile, previousFile: previousFile });
        setLoading(false);
        return true;

    } catch (error) {
        logFileManager(`Failed to load file '${filename}': ${error.message}`, 'error');
        setContent(`## Error loading ${filename}\n\n\`\`\`\n${error.message}\n\`\`\``);
        eventBus.emit('file:loadError', { filename, error: error.message });
        // Do NOT change persisted state on load error, user might want to retry save/load
        setLoading(false);
        return false;
    }
}

export async function saveFile() {
    logFileManager(`Save requested. State Check: File='${fileState.currentFile}', TopDir='${fileState.topLevelDirectory}'`, 'debug');
    if (!fileState.currentFile || !fileState.topLevelDirectory) {
        logFileManager('Save aborted: Missing file or top-level directory in current state.', 'warning');
        alert('Cannot save: No file or directory context is selected.');
        return false;
    }
    if (fileState.isLoading) {
         logFileManager('Save aborted: Another operation is in progress.', 'warning');
         alert('Please wait for the current operation to complete.');
         return false;
    }

    logFileManager('About to call getContent() for save...', 'debug');
    const content = getContent();
    logFileManager(`>>> getContent() returned content with length: ${content.length}. Starting with: "${content.substring(0, 100)}..."`, 'debug');

    // *** ADDED SAFEGUARD ***
    // Check if content is actually empty. Allow saving whitespace, but not truly empty.
    if (content === '') { 
        logFileManager('Save aborted: getContent() returned an empty string.', 'error');
        // Use a more informative alert
        alert('Save Aborted: Cannot save an empty file. Please add content to the editor.'); 
        setLoading(false); // Ensure loading state is reset
        return false; // Prevent the save operation
    }
    // *** END SAFEGUARD ***

    const filename = fileState.currentFile;
    const fullPathForApi = pathJoin(fileState.topLevelDirectory, fileState.currentRelativePath);

    // Prevent saving if content is unexpectedly empty (basic safeguard)
    if (!filename) { // Also ensure filename hasn't somehow become empty
         logFileManager('Save aborted: Filename became empty just before sending.', 'error');
         alert('Save aborted: Filename missing.'); // Consider a less intrusive notification
         return false;
    }

    logFileManager(`Saving file '${filename}' to API path '${fullPathForApi}' (Content length: ${content.length})`);
    setLoading(true, true);
    try {
         const apiUrl = `/api/files/save`;
         const requestBody = { dir: fullPathForApi, name: filename, content: content };
         logFileManager(`Saving - API: ${apiUrl}, Body: ${JSON.stringify(requestBody)}`, 'debug');

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
         eventBus.emit('file:saved', { filename });
         setLoading(false);
         return true;

    } catch (error) {
        // Log the specific error object as well
        logFileManager(`Failed to save file '${filename}'. Error: ${error.message}`, 'error', error); 
        // alert(`Error saving file: ${error.message}`); // Already commented out
        eventBus.emit('file:saveError', { filename, error: error.message });
        setLoading(false);
        return false;
    }
}

// Helper to manage loading state and emit event
function setLoading(isLoading, isSaving = false) {
    if (fileState.isLoading !== isLoading) {
        fileState.isLoading = isLoading;
        eventBus.emit('fileManager:loadingStateChanged', { isLoading, isSaving });
    }
}

// --- State Getters --- (Exported for UI)
export function getCurrentTopLevelDirectory() { return fileState.topLevelDirectory; }
export function getCurrentRelativePath() { return fileState.currentRelativePath; }
export function getCurrentFile() { return fileState.currentFile; }
export function getIsLoading() { return fileState.isLoading; }
export function getIsInitialized() { return fileState.isInitialized; } // Export init state
export function getCurrentListing() { return currentListingData; } // ADDED to getters
export function getAvailableTopLevelDirs() { return fileState.topLevelDirs; } // ADDED getter

// ADDED: Function to reset state on logout or clear
export function resetFileManagerState() {
    logFileManager('Resetting FileManager state...');
    fileState.topLevelDirectory = '';
    fileState.currentRelativePath = '';
    fileState.currentFile = '';
    fileState.topLevelDirs = []; // ADDED: Clear stored dirs
    // Don't reset isInitialized here
    fileState.isLoading = false;
    currentListingData = { dirs: [], files: [] };

    // Clear persistence related to file manager context
    fileSystemState.saveState({ currentDir: '', currentFile: '', currentRelativePath: '' }); // Persist the clear state

    // Clear URL parameters
    updateUrlParameters('', '', '');

    // Clear UI elements managed/affected by fileManager
    setContent(''); // Clear editor content via editor module

    // Emit events to notify UI to clear views
    logFileManager('Emitting listingLoaded with empty data for reset.');
    eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' });

    logFileManager('Emitting stateSettled with empty data for reset.');
     eventBus.emit('fileManager:stateSettled', {
         topLevelDirectory: '',
         relativePath: '',
         currentFile: ''
    });
    logFileManager('FileManager state reset complete.');
}

// ADDED: Function to refresh file manager state after login (if already initialized)
export async function refreshFileManagerForUser(username) {
    const logPrefix = '[FILEMGR_REFRESH]'; // Specific prefix for this flow
    if (!username) {
        logFileManager(`${logPrefix} Called without username. Resetting.`, 'warning');
        resetFileManagerState();
        return;
    }
    
    logFileManager(`${logPrefix} START for user: ${username}`);
    setLoading(true);
    logFileManager(`${logPrefix} setLoading(true)`);
    
    try {
        // 1. Reload top-level directories
        logFileManager(`${logPrefix} Calling loadTopLevelDirectories...`);
        await loadTopLevelDirectories(); 
        logFileManager(`${logPrefix} loadTopLevelDirectories DONE. Available: [${fileState.topLevelDirs.join(', ')}]`);

        // 2. Determine target directory
        let targetTopDir = '';
        let targetRelativePath = '';
        if (username.toLowerCase() === 'mike') {
            targetTopDir = '';
            targetRelativePath = '';
            logFileManager(`${logPrefix} Determined context for 'mike': Root selection (Top='', Rel='')`);
        } else {
             if (fileState.topLevelDirs.includes(username)) {
                 targetTopDir = username;
                 targetRelativePath = '';
                 logFileManager(`${logPrefix} Determined context for '${username}': User directory (Top='${targetTopDir}', Rel='${targetRelativePath}')`);
             } else {
                 targetTopDir = '';
                 targetRelativePath = '';
                 logFileManager(`${logPrefix} User directory '${username}' not found. Determined context: Root selection (Top='', Rel='')`, 'warning');
             }
        }

        // 3. Update internal state (BEFORE loading listing)
        logFileManager(`${logPrefix} BEFORE updateAndPersistState: Current fileState: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`);
        updateAndPersistState({ 
            topLevelDirectory: targetTopDir, 
            currentRelativePath: targetRelativePath, 
            currentFile: '' 
        });
        logFileManager(`${logPrefix} AFTER updateAndPersistState: New fileState: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`);
        setContent(''); // Clear editor
        logFileManager(`${logPrefix} Editor content cleared.`);
        currentListingData = { dirs: [], files: [] }; // Clear listing data before load
        logFileManager(`${logPrefix} Internal currentListingData cleared.`);

        // 4. Load listing for the new context (if applicable)
        if (fileState.topLevelDirectory) {
             logFileManager(`${logPrefix} Calling loadFilesAndDirectories for Top='${fileState.topLevelDirectory}', Rel='${fileState.currentRelativePath}'...`);
             // IMPORTANT: loadFilesAndDirectories internally updates currentListingData and emits listingLoaded
             await loadFilesAndDirectories(fileState.topLevelDirectory, fileState.currentRelativePath);
             logFileManager(`${logPrefix} loadFilesAndDirectories DONE.`);
        } else {
             logFileManager(`${logPrefix} No topLevelDirectory set ('mike' or missing user dir). Emitting empty listingLoaded.`);
             // Emit explicitly here ensures UI clears if no load needed
             eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' }); 
        }

        // 5. Emit state settled ONLY AFTER potential listing load is complete
        logFileManager(`${logPrefix} FINAL State before emitting stateSettled: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`);
        logFileManager(`${logPrefix} Emitting fileManager:stateSettled...`);
        eventBus.emit('fileManager:stateSettled', {
             topLevelDirectory: fileState.topLevelDirectory,
             relativePath: fileState.currentRelativePath,
             currentFile: fileState.currentFile
        });
        logFileManager(`${logPrefix} stateSettled emitted.`);

    } catch (error) {
        logFileManager(`${logPrefix} ERROR: ${error.message}`, 'error');
        resetFileManagerState(); // Fallback to reset
    } finally {
        setLoading(false);
        logFileManager(`${logPrefix} setLoading(false). END.`);
    }
}

// --- Default Export ---
export default {
    initializeFileManager,
    saveFile,
    // loadFile is primarily internal now, triggered by events or init
    // Getters for UI state updates
    getCurrentTopLevelDirectory,
    getCurrentRelativePath,
    getCurrentFile,
    getIsLoading,
    getIsInitialized,
    getCurrentListing, // ADDED to default export
    getAvailableTopLevelDirs,
    refreshFileManagerForUser
}; 