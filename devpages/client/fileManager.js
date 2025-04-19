/**
 * fileManager.js - Manages file system state, navigation, loading, and saving.
 * Implements agreed path semantics and event-driven flow.
 */
import { eventBus } from '/client/eventBus.js';
import { getContent, setContent } from '/client/editor.js';
import { logMessage } from '/client/log/index.js';
import fileSystemState from '/client/fileSystemState.js'; // Authoritative state persistence
import { appState } from '/client/appState.js'; // IMPORT central state
import { globalFetch } from '/client/globalFetch.js'; // ADDED import

// >>> ADDED: Import for front matter parsing/handling
import { renderMarkdown } from '/client/preview/renderer.js';

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

// >>> ADDED: State for managing host scripts <<<
let currentHostScriptPath = null;
let currentHostScriptModule = null;

// >>> ADDED: State for managing dynamic styles <<<
let currentDynamicStyleElements = [];

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
function updateAndPersistState(newState) {
    const changedStateForPersistence = {};
    let stateActuallyChanged = false;
    let appStateChanges = {}; // <<< Track changes for appState

    logFileManager(`updateAndPersistState: Called with newState=${JSON.stringify(newState)}. Current fileState BEFORE update: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`, 'debug');

    if (newState.topLevelDirectory !== undefined && newState.topLevelDirectory !== fileState.topLevelDirectory) {
        fileState.topLevelDirectory = newState.topLevelDirectory;
        changedStateForPersistence.currentDir = fileState.topLevelDirectory;
        appStateChanges.currentDir = fileState.topLevelDirectory; // <<< Update appState track
        stateActuallyChanged = true;
    }
    if (newState.currentRelativePath !== undefined && newState.currentRelativePath !== fileState.currentRelativePath) {
        fileState.currentRelativePath = newState.currentRelativePath;
        appStateChanges.currentRelativePath = fileState.currentRelativePath; // <<< Update appState track
        stateActuallyChanged = true;
    }
    if (newState.currentFile !== undefined && newState.currentFile !== fileState.currentFile) {
        fileState.currentFile = newState.currentFile;
        changedStateForPersistence.currentFile = fileState.currentFile;
        appStateChanges.currentFile = fileState.currentFile; // <<< Update appState track
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
        
        // <<< Update central appState >>>
        if (Object.keys(appStateChanges).length > 0) {
            appState.update(currentState => ({
                ...currentState,
                file: { ...currentState.file, ...appStateChanges }
            }));
            logFileManager(`Updated central appState.file: ${JSON.stringify(appStateChanges)}`, 'debug');
        }
        // <<< END Update appState >>>
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

    // --- Check for deep link restore for already authenticated users ---
    // This handles the case where a user is already logged in and arrives via a deep link
    try {
        // Only attempt if we don't already have a directory context from URL/localStorage
        if (!fileState.topLevelDirectory) {
            const deepLinkModule = await import('/client/deepLink.js');
            const savedRequest = deepLinkModule.getSavedDeepLinkRequest();
            if (savedRequest) {
                logFileManager('Found saved deep link request, checking auth state...');
                
                // Check if user is authenticated
                const currentAuthState = appState.getState().auth;
                if (currentAuthState.isLoggedIn) {
                    logFileManager(`Restoring deep link: dir=${savedRequest.dir}, path=${savedRequest.path}, file=${savedRequest.file}`);
                    
                    // Set state directly to avoid navigation event during initialization
                    fileState.topLevelDirectory = savedRequest.dir;
                    fileState.currentRelativePath = savedRequest.path;
                    fileState.currentFile = savedRequest.file;
                    
                    // Clear the saved request to prevent duplicate processing
                    deepLinkModule.clearSavedDeepLinkRequest();
                    
                    // Update localStorage with the restored values
                    updateAndPersistState({
                        topLevelDirectory: savedRequest.dir,
                        currentRelativePath: savedRequest.path,
                        currentFile: savedRequest.file
                    });
                }
            }
        }
    } catch (error) {
        logFileManager(`Error checking deep links: ${error.message}`, 'warning');
        // Non-critical error, continue with initialization
    }

    // --- Use central appState for auth check ---
    const currentAuthState = appState.getState().auth; // Get auth slice from appState
    if (currentAuthState.isLoggedIn && !fileState.topLevelDirectory) { // Check isLoggedIn
        logFileManager('No directory context from URL/localStorage, user logged in. Defaulting to username.');
        // Use user?.username from central state
        fileState.topLevelDirectory = currentAuthState.user?.username;
        // Persist this default state immediately
        updateAndPersistState({ topLevelDirectory: fileState.topLevelDirectory });
    }
    // --- END UPDATED SECTION ---

    logFileManager(`Initializing with state: Top=${fileState.topLevelDirectory}, Rel=${fileState.currentRelativePath}, File=${fileState.currentFile}`);

    setupEventListeners(); // Set up listeners for UI navigation events

    try {
        // 1. Load top-level directories first (essential for context)
        await loadTopLevelDirectories(); // Emits 'dirsLoaded'

        let initialFileNeedsLoading = false;

        // 2. If a top-level directory is set, load its initial listing
        if (fileState.topLevelDirectory) {
            await loadFilesAndDirectories(fileState.topLevelDirectory, fileState.currentRelativePath); // Emits 'listingLoaded', updates module var directly

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
    const newTopDir = data?.directory;
    if (newTopDir === fileState.topLevelDirectory) return; // No change

    logFileManager(`Event navigate:topLevelDir received: newDir='${newTopDir}'`);
    // Update state: New top dir, clear relative path & file
    updateAndPersistState({ topLevelDirectory: newTopDir, currentRelativePath: '', currentFile: '' });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear listing

    // Load listing for the new top-level dir (or clear if none selected)
    if (newTopDir) {
        await loadFilesAndDirectories(newTopDir, '');
    } else {
        eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' }); // Clear UI listing
    }
    // Emit state settled AFTER listing is loaded/cleared
    eventBus.emit('fileManager:stateSettled', { topLevelDirectory: newTopDir, relativePath: '', currentFile: '' });
}

async function handleDirectoryNavigation(data) {
    const subdir = data?.directory;
    if (!subdir || !fileState.topLevelDirectory) return; // Need top-level context

    logFileManager(`Event navigate:directory received: subdir='${subdir}'`);
    // Update state: New relative path, clear file
    const newRelativePath = pathJoin(fileState.currentRelativePath, subdir);
    updateAndPersistState({ currentRelativePath: newRelativePath, currentFile: '' });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear old listing before load

    // Load listing for the new subdirectory
    await loadFilesAndDirectories(fileState.topLevelDirectory, newRelativePath);
    // Emit state settled
    eventBus.emit('fileManager:stateSettled', { topLevelDirectory: fileState.topLevelDirectory, relativePath: newRelativePath, currentFile: '' });
}

async function handleUpNavigation() {
    if (!fileState.currentRelativePath) return; // Already at top relative level

    logFileManager(`Event navigate:up received.`);
    // Update state: Set parent path, clear file
    const parentPath = getParentRelativePath(fileState.currentRelativePath);
    updateAndPersistState({ currentRelativePath: parentPath, currentFile: '' });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear old listing before load

    // Load listing for the parent directory
    await loadFilesAndDirectories(fileState.topLevelDirectory, parentPath);
    // Emit state settled
    eventBus.emit('fileManager:stateSettled', { topLevelDirectory: fileState.topLevelDirectory, relativePath: parentPath, currentFile: '' });
}

// >>> REPLACED handleFileNavigation with version calling the modified loadFile <<<
async function handleFileNavigation(data) {
    const filename = data?.filename;

    // Validate necessary context
    if (!filename || !fileState.topLevelDirectory) {
        logFileManager(`Event navigate:file ignored: Missing filename ('${filename}') or topLevelDirectory ('${fileState.topLevelDirectory}')`, 'warning');
        return;
    }

    logFileManager(`Event navigate:file received: file='${filename}'`);
    // Update internal state and persistence BEFORE loading content
    updateAndPersistState({ currentFile: filename });

    // Load the actual file content (this will emit file:loaded or file:loadError)
    // The modified loadFile function now handles the host script logic internally
    await loadFile(filename, fileState.topLevelDirectory, fileState.currentRelativePath);

    // Emit state settled AFTER file is loaded (or failed)
    // This ensures UI updates selections after potentially clearing the file state on load failure
    eventBus.emit('fileManager:stateSettled', {
        topLevelDirectory: fileState.topLevelDirectory,
        relativePath: fileState.currentRelativePath,
        currentFile: fileState.currentFile // Use the potentially updated file state
    });
}
// >>> END REPLACEMENT <<<

async function handleNavigateToRoot() {
    logFileManager(`Event navigate:root received.`);
    // Clear relative path, file, AND top-level directory
    updateAndPersistState({ topLevelDirectory: '', currentRelativePath: '', currentFile: '' }); 
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear old listing before load

    // // Load listing for the top-level directory - REMOVED, no top dir selected now
    // if (fileState.topLevelDirectory) { 
    //     await loadFilesAndDirectories(fileState.topLevelDirectory, '');
    // } else {
    //     eventBus.emit('fileManager:listingLoaded', { ...currentListingData, relativePath: '' }); // Clear UI listing
    // }
    // Directly emit listingLoaded with empty data as no directory is selected
    eventBus.emit('fileManager:listingLoaded', { dirs: [], files: [], relativePath: '' });

    // Emit state settled - topLevelDirectory is now empty
    eventBus.emit('fileManager:stateSettled', { topLevelDirectory: '', relativePath: '', currentFile: '' });
}

// ADDED: Handler to respond to UI requests for top-level dirs
async function handleRequestTopLevelSelector() {
    logFileManager('handleRequestTopLevelSelector called', 'debug');
    if (fileState.topLevelDirs && fileState.topLevelDirs.length > 0) {
        logFileManager('Emitting fileManager:dirsLoaded with cached dirs', 'debug');
        eventBus.emit('fileManager:dirsLoaded', { dirs: fileState.topLevelDirs });
    } else {
        logFileManager('No cached dirs, attempting to load top-level directories...', 'debug');
        await loadTopLevelDirectories(); // This will load and emit dirsLoaded
    }
}

async function handleNavigateAbsolute(data) {
    const { dir, path: relativePath = '', file = '' } = data;
    logFileManager(`Event navigate:absolute received: dir=${dir}, path=${relativePath}, file=${file}`);

    if (!dir) {
        logFileManager('Navigate absolute requires at least a directory (dir).', 'warning');
        return;
    }

    // Update state: Set exact path, clear file
    updateAndPersistState({ topLevelDirectory: dir, currentRelativePath: relativePath, currentFile: '' });
    setContent(''); // Clear editor
    currentListingData = { dirs: [], files: [] }; // Clear old listing before load

    // Load listing for the target directory
    await loadFilesAndDirectories(dir, relativePath);

    // Emit state settled (without file first)
    eventBus.emit('fileManager:stateSettled', {
        topLevelDirectory: dir,
        relativePath: relativePath,
        currentFile: ''
    });

    // If a file was specified, attempt to load it
    if (file) {
        logFileManager(`Attempting to load specified file: ${file}`);
        await loadFile(file, dir, relativePath); // This will update state.currentFile if successful
        // Emit stateSettled AGAIN after file load attempt
        eventBus.emit('fileManager:stateSettled', {
            topLevelDirectory: fileState.topLevelDirectory,
            relativePath: fileState.currentRelativePath,
            currentFile: fileState.currentFile // Use the potentially updated file state
        });
    }
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

/**
 * Loads the content of a specific file.
 * Emits 'file:loaded' on success or 'file:loadError' on failure.
 * Handles host script loading/unloading based on front matter.
 */
export async function loadFile(filename, topLevelDir, relativePath) {
    const logPrefix = `[loadFile ${filename}]:`;
    logFileManager(`${logPrefix} Starting load... (Top='${topLevelDir}', Rel='${relativePath}')`);
    setLoading(true);

    // Reverted: Use /api/files/content with query params
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
                eventBus.emit('file:hostScriptLoadError', { path: newHostScriptPath, error: importError.message });
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

        // Emit success event WITHOUT host script info (handled internally now)
        eventBus.emit('file:loaded', { 
            filename, 
            content, 
            frontMatter
        }); 
        logFileManager(`${logPrefix} Emitted file:loaded event.`);

    } catch (error) {
        logFileManager(`${logPrefix} Error loading file: ${error.message}`, 'error');
        console.error(error);
        // Clear editor and emit error event
        setContent(''); // Clear editor on error
        currentListingData = { dirs: [], files: [] }; // Clear listing data before load
        logFileManager(`${logPrefix} Editor content cleared.`);
        currentListingData = { dirs: [], files: [] }; // Clear listing data before load
        logFileManager(`${logPrefix} Internal currentListingData cleared.`);
        eventBus.emit('file:loadError', { filename, error: error.message });
        // Emit explicitly here ensures UI clears if no load needed
        logFileManager(`${logPrefix} Emitted file:loadError event.`);

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

    } finally {
        setLoading(false);
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

    // <<< Update central appState on reset >>>
    appState.update(currentState => ({
        ...currentState,
        file: { ...currentState.file, currentFile: null, currentDir: null, currentRelativePath: null }
    }));
    logFileManager('Updated central appState.file to nulls for reset.', 'debug');
    // <<< END Update appState >>>

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
        const stateToSettle = {
             topLevelDirectory: fileState.topLevelDirectory,
             relativePath: fileState.currentRelativePath,
             currentFile: fileState.currentFile
        };
        logFileManager(`[DEBUG] About to emit stateSettled (Mike@Root). State: ${JSON.stringify(stateToSettle)}`, 'debug');
        eventBus.emit('fileManager:stateSettled', stateToSettle);
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