import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js'; // Assuming settings are in appStore
import { api } from '/client/api.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js'; // Ensure pathJoin is imported
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js'; // <<< Ensure dispatch and ActionTypes are imported

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
    
    // Disable root CSS by default since we're using the theme system
    const state = appStore.getState();
    if (state.settings?.preview?.enableRootCss === undefined) {
        try {
            const savedState = localStorage.getItem('enableRootCss');
            if (savedState === null) {
                // First time - set default to false (using theme system instead)
                dispatch({ 
                    type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, 
                    payload: false 
                });
                logger.debug('Set default enableRootCss to false (using theme system)');
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
    const enableRootCss = state.settings?.preview?.enableRootCss ?? false;
    const configuredItems = state.settings?.preview?.cssFiles || [];
    logger.debug(`[CSS APPLY] State Read: enableRootCss=${enableRootCss}, configuredItems count=${configuredItems.length}`);
    // -----------------------------

    let successfullyAppliedPaths = new Set();
    let rootStyleApplied = false;

    // === 1. Handle Implicit Root Theme CSS ===
    const rootThemePaths = ['themes/classic/core.css', 'themes/classic/light.css'];
    const rootExistingElement = document.getElementById(ROOT_STYLE_ELEMENT_ID);
    try {
        logger.debug(`[CSS APPLY ROOT] Processing theme CSS. User wants enabled=${enableRootCss}`);
        if (enableRootCss) {
            // Fetch and combine all theme CSS files
            const themeContents = [];
            for (const themePath of rootThemePaths) {
                const themeData = await api.fetchPublicCss(themePath);
                if (themeData && typeof themeData.content === 'string') {
                    themeContents.push(`/* === ${themePath} === */\n${themeData.content}`);
                    logger.debug(`[CSS APPLY ROOT] Loaded theme: ${themePath}`);
                } else {
                    logger.warn(`[CSS APPLY ROOT] Failed to load theme: ${themePath}`);
                }
            }

            if (themeContents.length > 0) {
                const combinedThemeContent = themeContents.join('\n\n');
                logger.debug(`[CSS APPLY ROOT] Combined theme content (${combinedThemeContent.length} chars). Applying...`);
                
                if (rootExistingElement) {
                    if (rootExistingElement.textContent !== combinedThemeContent) {
                        rootExistingElement.textContent = combinedThemeContent;
                        logger.debug(`[CSS APPLY ROOT] Updated existing theme tag.`);
                    } else {
                        logger.debug(`[CSS APPLY ROOT] Theme tag content unchanged.`);
                    }
                } else {
                    const styleEl = document.createElement('style'); 
                    styleEl.id = ROOT_STYLE_ELEMENT_ID; 
                    styleEl.textContent = combinedThemeContent; 
                    document.head.appendChild(styleEl);
                    logger.debug(`[CSS APPLY ROOT] Created new theme tag.`);
                }
                rootStyleApplied = true;
                logger.debug(`[CSS APPLY ROOT] Set rootStyleApplied = true`);
            } else {
                logger.debug(`[CSS APPLY ROOT] No theme content loaded, ensuring tag removed.`);
                if (rootExistingElement) { rootExistingElement.remove(); }
                rootStyleApplied = false;
            }
        } else {
            logger.debug(`[CSS APPLY ROOT] Disabled by setting, ensuring tag removed.`);
            if (rootExistingElement) { rootExistingElement.remove(); }
            rootStyleApplied = false;
        }
    } catch (error) {
        logger.error(`[CSS APPLY ROOT] Error loading theme CSS: ${error.message}`, error);
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
            // Using <link> tags is better for debugging and performance
            if (!existingElement) {
                const linkEl = document.createElement('link');
                linkEl.id = elementId;
                linkEl.rel = 'stylesheet';
                linkEl.href = `/api/files/content?pathname=${encodeURIComponent(configuredPath)}`;
                document.head.appendChild(linkEl);
                logger.debug(`[CSS APPLY CONFIG] Created <link> for: "${configuredPath}"`);
                successfullyAppliedPaths.add(configuredPath);
            } else {
                // Already exists, no need to do anything
                successfullyAppliedPaths.add(configuredPath);
            }
        } else {
            if (existingElement) {
                existingElement.remove();
                logger.debug(`[CSS APPLY CONFIG] Removed <link> for: "${configuredPath}"`);
            }
        }
    }
    // ==========================================

    // === 3. Update Tracking and Dispatch State ===
    lastAppliedConfiguredPaths = successfullyAppliedPaths;
    lastAppliedRootStatus = rootStyleApplied;

    let finalActivePaths = [...successfullyAppliedPaths];
    if (rootStyleApplied) {
        logger.debug(`[CSS APPLY DISPATCH] Theme CSS was applied this run.`);
        // Add theme paths to active list
        for (const themePath of rootThemePaths) {
            if (!finalActivePaths.includes(themePath)) {
                finalActivePaths.push(themePath);
            }
        }
    } else {
        logger.debug(`[CSS APPLY DISPATCH] Theme CSS was NOT applied this run.`);
    }

    const previousActivePaths = state.settings?.preview?.activeCssFiles || [];
    const sortedFinal = [...finalActivePaths].sort();
    const sortedPrevious = [...previousActivePaths].sort();
    if (JSON.stringify(sortedFinal) !== JSON.stringify(sortedPrevious)) {
        logger.info(`[CSS APPLY DISPATCH] New active files detected: ${JSON.stringify(finalActivePaths)}`);
        dispatch({ type: ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS, payload: finalActivePaths });
        logger.debug(`[CSS APPLY DISPATCH] Dispatched successfully`);
    } else {
        logger.debug(`[CSS APPLY DISPATCH] Active files unchanged, skipping dispatch.`);
    }
    // ===========================================
}
