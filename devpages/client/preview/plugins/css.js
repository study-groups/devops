import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js'; // Assuming settings are in appStore
import { api } from '/client/api.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js'; // Ensure pathJoin is imported
import { dispatch, ActionTypes, isReducerInitialized } from '/client/messaging/messageQueue.js'; // <<< Ensure dispatch and ActionTypes are imported

// Simple logger using logMessage
const logger = {
    debug: (msg, data) => logMessage(msg, 'debug', 'CSS_PLUGIN', data),
    info: (msg, data) => logMessage(msg, 'info', 'CSS_PLUGIN', data),
    warn: (msg, data) => logMessage(msg, 'warn', 'CSS_PLUGIN', data),
    error: (msg, data) => logMessage(msg, 'error', 'CSS_PLUGIN', data)
};

const STYLE_ELEMENT_PREFIX = 'preview-plugin-css-';
const ROOT_STYLE_ELEMENT_ID = 'preview-plugin-css-root-styles';
let lastAppliedFiles = new Set(); // Keep track of files currently linked
let lastAppliedConfiguredPaths = new Set();
let lastAppliedRootStatus = false;

/**
 * Initializes the CSS Plugin and applies persisted CSS settings
 * @param {object} config - Plugin configuration object (optional)
 */
export function init(config = {}) {
    logger.debug('CSS Plugin Initialized.');
    
    // Ensure root CSS is enabled by default if not previously set
    const state = appStore.getState();
    if (state.settings?.preview?.enableRootCss === undefined) {
        try {
            const savedState = localStorage.getItem('enableRootCss');
            if (savedState === null) {
                // First time - set default to true
                if (isReducerInitialized()) {
                    dispatch({ 
                        type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, 
                        payload: true 
                    });
                    logger.debug('Set default enableRootCss to true');
                } else {
                    logger.warn('Reducer not ready yet, skipping default enableRootCss dispatch');
                }
            }
        } catch (e) {
            logger.error('Error setting default enableRootCss', e);
        }
    }
    
    // Apply CSS styles immediately based on persisted settings
    setTimeout(() => {
        logger.debug('Applying persisted CSS settings on initialization');
        applyStyles().catch(error => {
            logger.error('Error applying CSS styles during initialization:', error);
        });
    }, 100); // Small delay to ensure DOM is ready
    
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
    logger.debug(`[CSS FETCH PUBLIC] Starting fetch for: "${pathForPublicApi}"`);
    try {
        const fileData = await api.fetchPublicCss(pathForPublicApi); // <<< Use path directly
        if (fileData && typeof fileData.content === 'string') {
            logger.debug(`[CSS FETCH PUBLIC] Success: Content length for ${pathForPublicApi}: ${fileData.content.length}`);
            return fileData.content;
         } else {
            logger.warn(`[CSS FETCH PUBLIC] Failed: File not found or empty content for ${pathForPublicApi}`);
            return null;
         }
    } catch (error) {
        logger.error(`[CSS FETCH PUBLIC] Error fetching ${pathForPublicApi}: ${error.message}`, error);
        return null;
    }
}

/**
 * Applies CSS styles using the legacy CSS management system for preview.
 * Preview context uses its own CSS system and doesn't need the unified manager.
 * The unified manager is used only for publishing contexts.
 */
export async function applyStyles() {
    // --- Start Log ---
    console.log('%c CSS PLUGIN: applyStyles LEGACY SYSTEM ', 'background: #222; color: #bada55; font-size: 1.2em;');
    logger.info('[CSS APPLY] applyStyles called (using legacy CSS system for preview).');
    const state = appStore.getState();
    // --- Log State Being Read ---
    const enableRootCss = state.settings?.preview?.enableRootCss ?? true;
    const configuredItems = state.settings?.preview?.cssFiles || [];
    logger.debug(`[CSS APPLY] State Read: enableRootCss=${enableRootCss}, configuredItems count=${configuredItems.length}`);
    // -----------------------------

    let successfullyAppliedPaths = new Set();
    let rootStyleApplied = false;

    // === 1. Handle Implicit Root styles.css ===
    const rootCssPath = 'styles.css';
    const rootExistingElement = document.getElementById(ROOT_STYLE_ELEMENT_ID);
    try {
        logger.debug(`[CSS APPLY ROOT] Processing. User wants enabled=${enableRootCss}`);
        if (enableRootCss) {
            const rootFileData = await api.fetchPublicCss(rootCssPath);
            logger.debug(`[CSS APPLY ROOT] Fetch result: ${rootFileData ? 'Data received' : 'No data/null'}`);

            if (rootFileData && typeof rootFileData.content === 'string') {
                logger.debug(`[CSS APPLY ROOT] Content retrieved. Applying...`);
                if (rootExistingElement) {
                    if (rootExistingElement.textContent !== rootFileData.content) {
                        rootExistingElement.textContent = rootFileData.content;
                        logger.debug(`[CSS APPLY ROOT] Updated existing tag.`);
                    } else {
                        logger.debug(`[CSS APPLY ROOT] Tag content unchanged.`);
                    }
                } else {
                    const styleEl = document.createElement('style'); styleEl.id = ROOT_STYLE_ELEMENT_ID; styleEl.textContent = rootFileData.content; document.head.appendChild(styleEl);
                    logger.debug(`[CSS APPLY ROOT] Created new tag.`);
                }
                rootStyleApplied = true;
                logger.debug(`[CSS APPLY ROOT] Set rootStyleApplied = true`);

                // After fetching
                logger.debug(`[CSS DEBUG] rootFileData content type: ${rootFileData ? typeof rootFileData.content : 'rootFileData is null'}`);
                logger.debug(`[CSS DEBUG] rootFileData dump: ${JSON.stringify(rootFileData)}`);
            } else {
                logger.debug(`[CSS APPLY ROOT] No content or fetch failed, ensuring tag removed.`);
                if (rootExistingElement) { rootExistingElement.remove(); }
                rootStyleApplied = false;
            }
        } else {
            logger.debug(`[CSS APPLY ROOT] Disabled by setting, ensuring tag removed.`);
            if (rootExistingElement) { rootExistingElement.remove(); }
            rootStyleApplied = false;
        }
    } catch (error) {
        logger.error(`[CSS APPLY ROOT] Error loading: ${error.message}`, error);
        if (rootExistingElement) { rootExistingElement.remove(); }
        rootStyleApplied = false;
    }
    logger.debug(`[CSS APPLY ROOT] Finished. rootStyleApplied = ${rootStyleApplied}`);
    // ============================================

    // === 2. Handle Configured & Enabled Files ===
    const enabledItems = configuredItems.filter(item => item.enabled);
    const enabledPaths = enabledItems.map(item => item.path);
    const currentEnabledSet = new Set(enabledPaths);
    const configuredFilesToProcess = new Set([...lastAppliedConfiguredPaths, ...currentEnabledSet]);

    logger.debug(`[CSS APPLY CONFIG] Enabled Paths: [${enabledPaths.join(', ')}], Processing: [${[...configuredFilesToProcess].join(', ')}]`);
    for (const configuredPath of configuredFilesToProcess) {
        const elementId = `${STYLE_ELEMENT_PREFIX}${configuredPath.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        const existingElement = document.getElementById(elementId);
        if (currentEnabledSet.has(configuredPath)) {
            logger.debug(`[CSS APPLY CONFIG] Processing configured enabled file: "${configuredPath}"`);
            const cssContent = await fetchCssContent(configuredPath);
            if (cssContent !== null) {
                logger.debug(`[CSS APPLY CONFIG] Content retrieved for "${configuredPath}", applying...`);
                if (existingElement) { if (existingElement.textContent !== cssContent) { existingElement.textContent = cssContent; } }
                else { const styleEl = document.createElement('style'); styleEl.id = elementId; styleEl.textContent = cssContent; document.head.appendChild(styleEl); }
                successfullyAppliedPaths.add(configuredPath);
            } else {
                logger.warn(`[CSS APPLY CONFIG] No content for "${configuredPath}", removing style tag.`);
                if (existingElement) { existingElement.remove(); }
            }
        } else {
            logger.debug(`[CSS APPLY CONFIG] File "${configuredPath}" not enabled, removing style tag.`);
            if (existingElement) { existingElement.remove(); }
        }
    }
    // ==========================================

    // === 3. Update Tracking and Dispatch State ===
    lastAppliedConfiguredPaths = successfullyAppliedPaths;
    lastAppliedRootStatus = rootStyleApplied;

    let finalActivePaths = [...successfullyAppliedPaths];
    if (rootStyleApplied) {
        logger.debug(`[CSS APPLY DISPATCH] Root was applied this run.`);
        if (!finalActivePaths.includes(rootCssPath)) {
            finalActivePaths.push(rootCssPath);
        }
    } else {
        logger.debug(`[CSS APPLY DISPATCH] Root was NOT applied this run.`);
    }

    const previousActivePaths = state.settings?.preview?.activeCssFiles || [];
    const sortedFinal = [...finalActivePaths].sort();
    const sortedPrevious = [...previousActivePaths].sort();
    if (JSON.stringify(sortedFinal) !== JSON.stringify(sortedPrevious)) {
        logger.info(`[CSS APPLY DISPATCH] New active files detected: ${JSON.stringify(finalActivePaths)}`);
        if (isReducerInitialized()) {
            dispatch({ type: ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS, payload: finalActivePaths });
            logger.debug(`[CSS APPLY DISPATCH] Dispatched successfully`);
        } else {
            logger.warn(`[CSS APPLY DISPATCH] Reducer not ready yet, skipping dispatch (will apply on next CSS update)`);
        }
    } else {
        logger.debug(`[CSS APPLY DISPATCH] Active files unchanged, skipping dispatch.`);
    }
    // ===========================================
}
