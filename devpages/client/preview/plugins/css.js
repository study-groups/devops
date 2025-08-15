import { appStore } from '/client/appState.js'; // Assuming settings are in appStore
import { appStore } from "/client/appState.js";
import { api } from '/client/api.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js'; // Ensure pathJoin is imported
import { storageService } from '/client/services/storageService.js';
// REMOVED: messageQueue import (file deleted)

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('CssPlugin');

const STYLE_ELEMENT_PREFIX = 'preview-plugin-css-';
const ROOT_STYLE_ELEMENT_ID = 'preview-plugin-css-root-styles';
let lastAppliedFiles = new Set(); // Keep track of files currently linked
let lastAppliedConfiguredPaths = new Set();
let lastAppliedRootStatus = false;
let _cssDispatchTimeout;
let _lastAppliedState = null;

/**
 * Initializes the CSS Plugin and applies persisted CSS settings
 * @param {object} config - Plugin configuration object (optional)
 */
export function init(config = {}) {
    log.debug('CSS_PLUGIN', 'INIT', 'CSS Plugin Initialized.');
    
    // Disable root CSS by default since we're using the theme system
    const state = appStore.getState();
    if (state.settings?.preview?.enableRootCss === undefined) {
        try {
            const savedState = storageService.getItem('enableRootCss');
            if (savedState === null) {
                // First time - set default to false (using theme system instead)
                dispatch({ 
                    type: // ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, 
                    payload: false 
                });
                log.debug('CSS_PLUGIN', 'SET_DEFAULT_ROOT_CSS', 'Set default enableRootCss to false (using theme system)');
            }
        } catch (e) {
            log.error('CSS_PLUGIN', 'SET_DEFAULT_ROOT_CSS_ERROR', 'Error setting default enableRootCss', e);
        }
    }
    
    // Apply CSS styles immediately based on persisted settings
    setTimeout(() => {
        log.debug('CSS_PLUGIN', 'APPLY_PERSISTED_SETTINGS', 'Applying persisted CSS settings on initialization');
        applyStyles().catch(error => {
            log.error('CSS_PLUGIN', 'APPLY_STYLES_INIT_ERROR', 'Error applying CSS styles during initialization:', error);
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
    log.debug('CSS_PLUGIN', 'FETCH_PUBLIC_CSS', `[CSS FETCH PUBLIC] Starting fetch for: "${pathForPublicApi}"`);
    try {
        const fileData = await api.fetchPublicCss(pathForPublicApi); // <<< Use path directly
        if (fileData && typeof fileData.content === 'string') {
            log.debug('CSS_PLUGIN', 'FETCH_PUBLIC_CSS_SUCCESS', `[CSS FETCH PUBLIC] Success: Content length for ${pathForPublicApi}: ${fileData.content.length}`);
            return fileData.content;
         } else {
            log.warn('CSS_PLUGIN', 'FETCH_PUBLIC_CSS_FAILED', `[CSS FETCH PUBLIC] Failed: File not found or empty content for ${pathForPublicApi}`);
            return null;
         }
    } catch (error) {
        log.error('CSS_PLUGIN', 'FETCH_PUBLIC_CSS_ERROR', `[CSS FETCH PUBLIC] Error fetching ${pathForPublicApi}: ${error.message}`, error);
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
    log.info('CSS_PLUGIN', 'APPLY_STYLES', '[CSS APPLY] applyStyles called (using legacy CSS system for preview).');
    const state = appStore.getState();
    // --- Log State Being Read ---
    const enableRootCss = state.settings?.preview?.enableRootCss ?? false;
    const configuredItems = state.settings?.preview?.cssFiles || [];
    log.debug('CSS_PLUGIN', 'APPLY_STYLES_STATE', `[CSS APPLY] State Read: enableRootCss=${enableRootCss}, configuredItems count=${configuredItems.length}`);
    // -----------------------------

    let successfullyAppliedPaths = new Set();
    let rootStyleApplied = false;

    // === 1. Handle Implicit Root Theme CSS ===
    const rootThemePaths = ['themes/classic/core.css', 'themes/classic/light.css'];
    const rootExistingElement = document.getElementById(ROOT_STYLE_ELEMENT_ID);
    try {
        log.debug('CSS_PLUGIN', 'PROCESS_ROOT_CSS', `[CSS APPLY ROOT] Processing theme CSS. User wants enabled=${enableRootCss}`);
        if (enableRootCss) {
            // Fetch and combine all theme CSS files
            const themeContents = [];
            for (const themePath of rootThemePaths) {
                const themeData = await api.fetchPublicCss(themePath);
                if (themeData && typeof themeData.content === 'string') {
                    themeContents.push(`/* === ${themePath} === */\n${themeData.content}`);
                    log.debug('CSS_PLUGIN', 'LOADED_THEME', `[CSS APPLY ROOT] Loaded theme: ${themePath}`);
                } else {
                    log.warn('CSS_PLUGIN', 'LOAD_THEME_FAILED', `[CSS APPLY ROOT] Failed to load theme: ${themePath}`);
                }
            }

            if (themeContents.length > 0) {
                const combinedThemeContent = themeContents.join('\n\n');
                log.debug('CSS_PLUGIN', 'APPLY_COMBINED_THEME', `[CSS APPLY ROOT] Combined theme content (${combinedThemeContent.length} chars). Applying...`);
                
                if (rootExistingElement) {
                    if (rootExistingElement.textContent !== combinedThemeContent) {
                        rootExistingElement.textContent = combinedThemeContent;
                        log.debug('CSS_PLUGIN', 'UPDATED_THEME_TAG', `[CSS APPLY ROOT] Updated existing theme tag.`);
                    } else {
                        log.debug('CSS_PLUGIN', 'THEME_TAG_UNCHANGED', `[CSS APPLY ROOT] Theme tag content unchanged.`);
                    }
                } else {
                    const styleEl = document.createElement('style'); 
                    styleEl.id = ROOT_STYLE_ELEMENT_ID; 
                    styleEl.textContent = combinedThemeContent; 
                    document.head.appendChild(styleEl);
                    log.debug('CSS_PLUGIN', 'CREATED_THEME_TAG', `[CSS APPLY ROOT] Created new theme tag.`);
                }
                rootStyleApplied = true;
                log.debug('CSS_PLUGIN', 'ROOT_STYLE_APPLIED', `[CSS APPLY ROOT] Set rootStyleApplied = true`);
            } else {
                log.debug('CSS_PLUGIN', 'NO_THEME_CONTENT', `[CSS APPLY ROOT] No theme content loaded, ensuring tag removed.`);
                if (rootExistingElement) { rootExistingElement.remove(); }
                rootStyleApplied = false;
            }
        } else {
            log.debug('CSS_PLUGIN', 'ROOT_CSS_DISABLED', `[CSS APPLY ROOT] Disabled by setting, ensuring tag removed.`);
            if (rootExistingElement) { rootExistingElement.remove(); }
            rootStyleApplied = false;
        }
    } catch (error) {
        log.error('CSS_PLUGIN', 'LOAD_THEME_ERROR', `[CSS APPLY ROOT] Error loading theme CSS: ${error.message}`, error);
        if (rootExistingElement) { rootExistingElement.remove(); }
        rootStyleApplied = false;
    }
    log.debug('CSS_PLUGIN', 'ROOT_CSS_FINISHED', `[CSS APPLY ROOT] Finished. rootStyleApplied = ${rootStyleApplied}`);
    // ============================================

    // === 2. Handle Configured & Enabled Files ===
    const enabledItems = configuredItems.filter(item => item.enabled);
    const enabledPaths = enabledItems.map(item => item.path);
    const currentEnabledSet = new Set(enabledPaths);
    const configuredFilesToProcess = new Set([...lastAppliedConfiguredPaths, ...currentEnabledSet]);

    log.debug('CSS_PLUGIN', 'PROCESS_CONFIGURED_FILES', `[CSS APPLY CONFIG] Enabled Paths: [${enabledPaths.join(', ')}], Processing: [${[...configuredFilesToProcess].join(', ')}]`);
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
                log.debug('CSS_PLUGIN', 'CREATED_LINK_TAG', `[CSS APPLY CONFIG] Created <link> for: "${configuredPath}"`);
                successfullyAppliedPaths.add(configuredPath);
            } else {
                // Already exists, no need to do anything
                successfullyAppliedPaths.add(configuredPath);
            }
        } else {
            if (existingElement) {
                existingElement.remove();
                log.debug('CSS_PLUGIN', 'REMOVED_LINK_TAG', `[CSS APPLY CONFIG] Removed <link> for: "${configuredPath}"`);
            }
        }
    }
    // ==========================================

    // === 3. Update Tracking and Dispatch State ===
    lastAppliedConfiguredPaths = successfullyAppliedPaths;
    lastAppliedRootStatus = rootStyleApplied;

    let finalActivePaths = [...successfullyAppliedPaths];
    if (rootStyleApplied) {
        log.debug('CSS_PLUGIN', 'THEME_CSS_APPLIED', `[CSS APPLY DISPATCH] Theme CSS was applied this run.`);
        // Add theme paths to active list
        for (const themePath of rootThemePaths) {
            if (!finalActivePaths.includes(themePath)) {
                finalActivePaths.push(themePath);
            }
        }
    } else {
        log.debug('CSS_PLUGIN', 'THEME_CSS_NOT_APPLIED', `[CSS APPLY DISPATCH] Theme CSS was NOT applied this run.`);
    }

    const shouldDispatch = shouldDispatchCssChange(finalActivePaths, state);
    
    if (shouldDispatch) {
        log.info('CSS_PLUGIN', 'NEW_ACTIVE_FILES', `[CSS APPLY DISPATCH] New active files detected: ${JSON.stringify(finalActivePaths)}`);
        // Add debouncing to prevent rapid successive dispatches
        if (_cssDispatchTimeout) {
            clearTimeout(_cssDispatchTimeout);
        }
        _cssDispatchTimeout = setTimeout(() => {
            dispatch({ type: // ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS, payload: finalActivePaths });
            log.debug('CSS_PLUGIN', 'DISPATCH_SUCCESS', `[CSS APPLY DISPATCH] Dispatched successfully`);
            _cssDispatchTimeout = null;
        }, 150); // Increased from 50ms to 150ms for better stability
    } else {
        log.debug('CSS_PLUGIN', 'NO_CHANGE_SKIP_DISPATCH', `[CSS APPLY DISPATCH] Active files unchanged, skipping dispatch.`);
    }
    // ===========================================
}

// CSS state change detection function  
function shouldDispatchCssChange(finalActivePaths, currentState) {
    const previousActivePaths = currentState.settings?.preview?.activeCssFiles || [];
    const sortedFinal = [...finalActivePaths].sort();
    const sortedPrevious = [...previousActivePaths].sort();
    
    // Create a state signature to compare
    const currentSignature = JSON.stringify({
        paths: sortedFinal,
        rootEnabled: currentState.settings?.preview?.enableRootCss || false
    });
    
    // Only dispatch if the signature actually changed AND we're not in a dispatch loop
    if (_lastAppliedState !== currentSignature) {
        _lastAppliedState = currentSignature;
        
        // Additional check: ensure we're not dispatching the same paths that are already active
        const pathsChanged = sortedFinal.length !== sortedPrevious.length || 
                            !sortedFinal.every((path, index) => path === sortedPrevious[index]);
        
        if (pathsChanged) {
            log.debug('CSS_PLUGIN', 'STATE_SIGNATURE_CHANGED', `[CSS APPLY DISPATCH] State signature changed, dispatching update`);
            return true;
        } else {
            log.debug('CSS_PLUGIN', 'PATHS_UNCHANGED', `[CSS APPLY DISPATCH] State signature changed but paths unchanged, skipping dispatch`);
            return false;
        }
    }
    
    log.debug('CSS_PLUGIN', 'STATE_SIGNATURE_UNCHANGED', `[CSS APPLY DISPATCH] State signature unchanged, skipping dispatch`);
    return false;
}
