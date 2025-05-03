import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js'; // Assuming settings are in appStore
import { api } from '/client/api.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js'; // Ensure pathJoin is imported
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js'; // <<< Ensure dispatch and ActionTypes are imported

const STYLE_ELEMENT_PREFIX = 'preview-plugin-css-';
const ROOT_STYLE_ELEMENT_ID = 'preview-plugin-css-root-styles';
let lastAppliedFiles = new Set(); // Keep track of files currently linked
let lastAppliedConfiguredPaths = new Set();
let lastAppliedRootStatus = false;

/**
 * Initializes the CSS Plugin (currently does nothing, logic is in applyStyles)
 * @param {object} config - Plugin configuration object (optional)
 */
export function init(config = {}) {
    logMessage('CSS Plugin Initialized.', 'debug', 'CSS_PLUGIN');
    
    // Ensure root CSS is enabled by default if not previously set
    const state = appStore.getState();
    if (state.settings?.preview?.enableRootCss === undefined) {
        try {
            const savedState = localStorage.getItem(ENABLE_ROOT_CSS_KEY);
            if (savedState === null) {
                // First time - set default to true
                dispatch({ 
                    type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, 
                    payload: true 
                });
                logMessage('Set default enableRootCss to true', 'debug', 'CSS_PLUGIN');
            }
        } catch (e) {
            logMessage('Error setting default enableRootCss', 'error', 'CSS_PLUGIN');
        }
    }
    
    return true; // Signal successful initialization
}

/**
 * Fetches CSS content using the PUBLIC API from the PD_DIR/data directory.
 * @param {string} relativePathFromSettings - Path relative to PD_DIR/data, as entered in settings.
 * @returns {Promise<string|null>} CSS content or null if not found/error.
 */
async function fetchCssContent(relativePath) {
    // The path received IS the path relative to MD_DIR (e.g., "themes/dark.css")
    const pathForPublicApi = relativePath; // <<< NO 'data/' prefix needed
    logMessage(`[CSS FETCH PUBLIC] Starting fetch for: "${pathForPublicApi}"`, 'debug', 'CSS_PLUGIN');
    try {
        const fileData = await api.fetchPublicCss(pathForPublicApi); // <<< Use path directly
        if (fileData && typeof fileData.content === 'string') {
             logMessage(`[CSS FETCH PUBLIC] Success: Content length for ${pathForPublicApi}: ${fileData.content.length}`, 'debug', 'CSS_PLUGIN');
            return fileData.content;
         } else {
             logMessage(`[CSS FETCH PUBLIC] Failed: File not found or empty content for ${pathForPublicApi}`, 'warn', 'CSS_PLUGIN');
             return null;
         }
    } catch (error) {
        logMessage(`[CSS FETCH PUBLIC] Error fetching ${pathForPublicApi}: ${error.message}`, 'error', 'CSS_PLUGIN');
        return null;
    }
}

/**
 * Applies CSS styles based on current application settings.
 * Fetches CSS content via API and injects/updates <style> tags in <head>.
 */
export async function applyStyles() {
    // --- Start Log ---
    console.log('%c CSS PLUGIN: applyStyles FUNCTION ENTRY POINT ', 'background: #222; color: #bada55; font-size: 1.2em;');
    logMessage('[CSS APPLY] applyStyles called (handling root + configured).', 'info', 'CSS_PLUGIN');
    const state = appStore.getState();
    // --- Log State Being Read ---
    const enableRootCss = state.settings?.preview?.enableRootCss ?? true;
    const configuredItems = state.settings?.preview?.cssFiles || [];
    logMessage(`[CSS APPLY] State Read: enableRootCss=${enableRootCss}, configuredItems count=${configuredItems.length}`, 'debug', 'CSS_PLUGIN');
    // -----------------------------

    let successfullyAppliedPaths = new Set();
    let rootStyleApplied = false;

    // === 1. Handle Implicit Root styles.css ===
    const rootCssPath = 'styles.css';
    const rootExistingElement = document.getElementById(ROOT_STYLE_ELEMENT_ID);
    try {
        logMessage(`[CSS APPLY ROOT] Processing. User wants enabled=${enableRootCss}`, 'debug', 'CSS_PLUGIN');
        if (enableRootCss) {
            const rootFileData = await api.fetchPublicCss(rootCssPath);
            logMessage(`[CSS APPLY ROOT] Fetch result: ${rootFileData ? 'Data received' : 'No data/null'}`, 'debug', 'CSS_PLUGIN');

            if (rootFileData && typeof rootFileData.content === 'string') {
                logMessage(`[CSS APPLY ROOT] Content retrieved. Applying...`, 'debug', 'CSS_PLUGIN');
                if (rootExistingElement) {
                    if (rootExistingElement.textContent !== rootFileData.content) {
                        rootExistingElement.textContent = rootFileData.content;
                        logMessage(`[CSS APPLY ROOT] Updated existing tag.`, 'debug', 'CSS_PLUGIN');
                    } else {
                         logMessage(`[CSS APPLY ROOT] Tag content unchanged.`, 'debug', 'CSS_PLUGIN');
                    }
                } else {
                    const styleEl = document.createElement('style'); styleEl.id = ROOT_STYLE_ELEMENT_ID; styleEl.textContent = rootFileData.content; document.head.appendChild(styleEl);
                     logMessage(`[CSS APPLY ROOT] Created new tag.`, 'debug', 'CSS_PLUGIN');
                }
                rootStyleApplied = true;
                logMessage(`[CSS APPLY ROOT] Set rootStyleApplied = true`, 'debug', 'CSS_PLUGIN');

                // After fetching
                logMessage(`[CSS DEBUG] rootFileData content type: ${rootFileData ? typeof rootFileData.content : 'rootFileData is null'}`, 'error', 'CSS_PLUGIN');
                logMessage(`[CSS DEBUG] rootFileData dump: ${JSON.stringify(rootFileData)}`, 'error', 'CSS_PLUGIN');
            } else {
                 logMessage(`[CSS APPLY ROOT] No content or fetch failed, ensuring tag removed.`, 'debug', 'CSS_PLUGIN');
                if (rootExistingElement) { rootExistingElement.remove(); }
                rootStyleApplied = false;
            }
        } else {
            logMessage(`[CSS APPLY ROOT] Disabled by setting, ensuring tag removed.`, 'debug', 'CSS_PLUGIN');
            if (rootExistingElement) { rootExistingElement.remove(); }
            rootStyleApplied = false;
        }
    } catch (error) {
        logMessage(`[CSS APPLY ROOT] Error loading: ${error.message}`, 'error', 'CSS_PLUGIN');
        if (rootExistingElement) { rootExistingElement.remove(); }
        rootStyleApplied = false;
    }
    logMessage(`[CSS APPLY ROOT] Finished. rootStyleApplied = ${rootStyleApplied}`, 'debug', 'CSS_PLUGIN');
    // ============================================

    // === 2. Handle Configured & Enabled Files ===
    const enabledItems = configuredItems.filter(item => item.enabled);
    const enabledPaths = enabledItems.map(item => item.path);
    const currentEnabledSet = new Set(enabledPaths);
    const configuredFilesToProcess = new Set([...lastAppliedConfiguredPaths, ...currentEnabledSet]);

    logMessage(`[CSS APPLY CONFIG] Enabled Paths: [${enabledPaths.join(', ')}], Processing: [${[...configuredFilesToProcess].join(', ')}]`, 'debug', 'CSS_PLUGIN');
    for (const configuredPath of configuredFilesToProcess) {
        const elementId = `${STYLE_ELEMENT_PREFIX}${configuredPath.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        const existingElement = document.getElementById(elementId);
        if (currentEnabledSet.has(configuredPath)) {
             logMessage(`[CSS APPLY CONFIG] Processing configured enabled file: "${configuredPath}"`, 'debug', 'CSS_PLUGIN');
             const cssContent = await fetchCssContent(configuredPath);
             if (cssContent !== null) {
                 logMessage(`[CSS APPLY CONFIG] Content retrieved for "${configuredPath}", applying...`, 'debug', 'CSS_PLUGIN');
                 if (existingElement) { if (existingElement.textContent !== cssContent) { existingElement.textContent = cssContent; } }
                 else { const styleEl = document.createElement('style'); styleEl.id = elementId; styleEl.textContent = cssContent; document.head.appendChild(styleEl); }
                 successfullyAppliedPaths.add(configuredPath);
            } else {
                 logMessage(`[CSS APPLY CONFIG] No content for "${configuredPath}", removing style tag.`, 'warn', 'CSS_PLUGIN');
                 if (existingElement) { existingElement.remove(); }
            }
        } else {
            logMessage(`[CSS APPLY CONFIG] File "${configuredPath}" not enabled, removing style tag.`, 'debug', 'CSS_PLUGIN');
            if (existingElement) { existingElement.remove(); }
        }
    }
    // ==========================================

    // === 3. Update Tracking and Dispatch State ===
    lastAppliedConfiguredPaths = successfullyAppliedPaths;
    lastAppliedRootStatus = rootStyleApplied;

    let finalActivePaths = [...successfullyAppliedPaths];
    if (rootStyleApplied) {
         logMessage(`[CSS APPLY DISPATCH] Root was applied this run.`, 'debug', 'CSS_PLUGIN');
        if (!finalActivePaths.includes(rootCssPath)) {
            finalActivePaths.push(rootCssPath);
        }
    } else {
         logMessage(`[CSS APPLY DISPATCH] Root was NOT applied this run.`, 'debug', 'CSS_PLUGIN');
    }

    const previousActivePaths = state.settings?.preview?.activeCssFiles || [];
    const sortedFinal = [...finalActivePaths].sort();
    const sortedPrevious = [...previousActivePaths].sort();
    if (JSON.stringify(sortedFinal) !== JSON.stringify(sortedPrevious)) {
         logMessage(`[CSS APPLY DISPATCH] Dispatching new active files: ${JSON.stringify(finalActivePaths)}`, 'info', 'CSS_PLUGIN');
         dispatch({ type: ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS, payload: finalActivePaths });
    } else {
         logMessage(`[CSS APPLY DISPATCH] Active files unchanged, skipping dispatch.`, 'debug', 'CSS_PLUGIN');
    }
    // ===========================================
}
