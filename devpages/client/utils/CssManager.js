/**
 * Unified CSS Management System
 * 
 * Provides a single source of truth for CSS handling across preview and publishing contexts.
 * Supports both bundled (inline) and linked (external) CSS modes with configurable prefixes.
 * 
 * Key Features:
 * - Unified rendering pipeline for all contexts
 * - Flexible CSS resolution (bundled vs linked)
 * - Per-user CSS overrides with proper hierarchy
 * - Smart endpoint structure with configurable prefixes
 * - Consistent behavior across preview and publish
 */

import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js';
import { getIsPluginEnabled } from '/client/store/selectors.js'; // Fixed import - FORCE RELOAD

// Helper for logging within this module
function logCssManager(message, level = 'debug') {
    const type = 'CSS_MANAGER';
    if (typeof logMessage === 'function') {
        logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

/**
 * CSS Context Types
 */
export const CSS_CONTEXT = {
    PREVIEW: 'preview',
    PUBLISH_LOCAL: 'publish_local', 
    PUBLISH_SPACES: 'publish_spaces'
};

/**
 * CSS Mode Types
 */
export const CSS_MODE = {
    BUNDLED: 'bundled',  // Inline <style> tags
    LINKED: 'linked'     // External <link> tags
};

/**
 * CSS File Types for proper resolution
 */
export const CSS_FILE_TYPE = {
    CLIENT: 'client',     // /client/* files
    USER: 'user',         // User CSS files in MD_DIR
    SYSTEM: 'system'      // System CSS files
};

/**
 * Unified CSS Manager Class
 */
export class CssManager {
    constructor() {
        this.cache = new Map();
        this.lastFetchTimes = new Map();
        this.cacheTimeout = 5000; // 5 seconds
        this.devMode = !window.location.hostname.includes('production') && 
                      window.location.hostname !== 'your-production-domain.com'; // Disable cache in development
    }

    /**
     * Get CSS configuration for a specific context
     * @param {string} context - CSS_CONTEXT value
     * @returns {Object} CSS configuration
     */
    getCssConfig(context = CSS_CONTEXT.PREVIEW) {
        const state = appStore.getState();
        const previewSettings = state.settings?.preview || {};
        const publishSettings = state.settings?.publish || {};

        // Base CSS files that are always included
        // Note: For preview context, we don't include md.css as it has layout constraints
        // The preview uses its own CSS system via preview.css
        const baseCssFiles = context === CSS_CONTEXT.PREVIEW ? [] : ['/client/preview/md.css'];
        
        // Get user CSS files from settings
        const userCssFiles = [];
        
        // Add theme CSS files if enabled (replaces old styles.css)
        if (previewSettings.enableRootCss !== false) {
            userCssFiles.push('themes/classic/core.css');
            userCssFiles.push('themes/classic/light.css'); // Default to light theme
        }
        
        // Add active CSS files
        const activeCssFiles = previewSettings.activeCssFiles || [];
        activeCssFiles.forEach(cssPath => {
            if (!userCssFiles.includes(cssPath)) {
                userCssFiles.push(cssPath);
            }
        });

        // Determine CSS mode based on context
        let cssMode = CSS_MODE.BUNDLED;
        let cssPrefix = '';
        
        switch (context) {
            case CSS_CONTEXT.PREVIEW:
                // Preview always uses bundled mode for performance
                cssMode = CSS_MODE.BUNDLED;
                break;
                
            case CSS_CONTEXT.PUBLISH_LOCAL:
                // Local publishing: always bundle for standalone files
                cssMode = CSS_MODE.BUNDLED;
                break;
                
            case CSS_CONTEXT.PUBLISH_SPACES:
                // Spaces publishing: use settings preference
                cssMode = publishSettings.bundleCss !== false ? CSS_MODE.BUNDLED : CSS_MODE.LINKED;
                cssPrefix = previewSettings.cssPrefix || '';
                break;
        }

        return {
            context,
            mode: cssMode,
            prefix: cssPrefix,
            baseCssFiles,
            userCssFiles,
            allCssFiles: [...baseCssFiles, ...userCssFiles]
        };
    }

    /**
     * Classify CSS file type for proper resolution
     * @param {string} cssPath - CSS file path
     * @returns {string} CSS_FILE_TYPE value
     */
    classifyCssFile(cssPath) {
        if (cssPath.startsWith('/client/')) {
            return CSS_FILE_TYPE.CLIENT;
        } else if (cssPath === 'styles.css' || cssPath.startsWith('styles/') || cssPath.startsWith('themes/')) {
            return CSS_FILE_TYPE.USER;
        } else {
            return CSS_FILE_TYPE.USER; // Default to user files
        }
    }

    /**
     * Fetch CSS content from appropriate endpoint
     * @param {string} cssPath - CSS file path
     * @returns {Promise<string>} CSS content or empty string if failed
     */
    async fetchCssContent(cssPath) {
        try {
            // Check cache first (skip in development mode)
            const cacheKey = cssPath;
            const lastFetch = this.lastFetchTimes.get(cacheKey);
            const now = Date.now();
            
            if (!this.devMode && lastFetch && (now - lastFetch) < this.cacheTimeout && this.cache.has(cacheKey)) {
                logCssManager(`Using cached CSS for: ${cssPath}`);
                return this.cache.get(cacheKey);
            }

            logCssManager(`Fetching CSS content for: ${cssPath}`);
            
            let response;
            const fileType = this.classifyCssFile(cssPath);
            
            switch (fileType) {
                case CSS_FILE_TYPE.CLIENT:
                    // Client CSS files: fetch directly from client path
                    const clientUrl = this.devMode ? `${cssPath}?t=${Date.now()}` : cssPath;
                    response = await globalFetch(clientUrl);
                    break;
                    
                case CSS_FILE_TYPE.USER:
                case CSS_FILE_TYPE.SYSTEM:
                    // User/System CSS files: use /public/css endpoint
                    const userUrl = this.devMode 
                        ? `/public/css?path=${encodeURIComponent(cssPath)}&t=${Date.now()}`
                        : `/public/css?path=${encodeURIComponent(cssPath)}`;
                    response = await globalFetch(userUrl);
                    break;
                    
                default:
                    throw new Error(`Unknown CSS file type for: ${cssPath}`);
            }
            
            if (!response.ok) {
                logCssManager(`Failed to fetch CSS ${cssPath}: ${response.status} ${response.statusText}`, 'warn');
                return '';
            }
            
            const cssContent = await response.text();
            
            // Cache the result (skip in development mode)
            if (!this.devMode) {
                this.cache.set(cacheKey, cssContent);
                this.lastFetchTimes.set(cacheKey, now);
            }
            
            logCssManager(`Successfully fetched CSS ${cssPath} (${cssContent.length} chars)${this.devMode ? ' [DEV-NO-CACHE]' : ''}`);
            return cssContent;
            
        } catch (error) {
            logCssManager(`Error fetching CSS ${cssPath}: ${error.message}`, 'error');
            return '';
        }
    }

    /**
     * Bundle all CSS files into a single string
     * @param {string} context - CSS_CONTEXT value
     * @returns {Promise<string>} Bundled CSS content
     */
    async bundleCss(context = CSS_CONTEXT.PREVIEW) {
        logCssManager(`Bundling CSS for context: ${context}`);
        
        const config = this.getCssConfig(context);
        const cssFilesToBundle = config.allCssFiles;
        
        logCssManager(`Bundling ${cssFilesToBundle.length} CSS files: ${JSON.stringify(cssFilesToBundle)}`);
        
        // Fetch CSS files in parallel
        const cssPromises = cssFilesToBundle.map(async (cssPath) => {
            const content = await this.fetchCssContent(cssPath);
            return content ? 
                `/* === BUNDLED CSS: ${cssPath} === */\n${content}\n` : 
                `/* === FAILED TO LOAD: ${cssPath} === */\n`;
        });
        
        const cssContents = await Promise.all(cssPromises);
        const bundledCss = cssContents.filter(content => content.trim()).join('\n');
        
        logCssManager(`CSS bundling complete. Total bundled size: ${bundledCss.length} chars`);
        return bundledCss;
    }

    /**
     * Generate CSS links for external linking
     * @param {string} context - CSS_CONTEXT value
     * @returns {string} HTML link tags
     */
    generateCssLinks(context = CSS_CONTEXT.PUBLISH_SPACES) {
        logCssManager(`Generating CSS links for context: ${context}`);
        
        const config = this.getCssConfig(context);
        const cssFilesToLink = config.allCssFiles;
        const cssPrefix = config.prefix;
        
        const cssLinks = cssFilesToLink.map(cssPath => {
            // Build the appropriate URL for each file type
            let finalUrl;
            const fileType = this.classifyCssFile(cssPath);
            
            switch (fileType) {
                case CSS_FILE_TYPE.CLIENT:
                    // Client files are served directly
                    finalUrl = cssPrefix ? `${cssPrefix}${cssPath}` : cssPath;
                    break;
                    
                case CSS_FILE_TYPE.USER:
                case CSS_FILE_TYPE.SYSTEM:
                    // User files need to go through the unified CSS endpoint
                    const cssEndpoint = `/css/${cssPath}`;
                    finalUrl = cssPrefix ? `${cssPrefix}${cssEndpoint}` : cssEndpoint;
                    break;
                    
                default:
                    finalUrl = cssPath;
            }
            
            return `    <link rel="stylesheet" href="${finalUrl}">`;
        }).join('\n');
        
        logCssManager(`CSS links generated for ${cssFilesToLink.length} files with prefix "${cssPrefix}"`);
        return cssLinks;
    }

    /**
     * Generate CSS section for HTML document
     * @param {string} context - CSS_CONTEXT value
     * @returns {Promise<string>} CSS section HTML
     */
    async generateCssSection(context = CSS_CONTEXT.PREVIEW) {
        const config = this.getCssConfig(context);
        
        if (config.mode === CSS_MODE.BUNDLED) {
            const cssContent = await this.bundleCss(context);
            return `    <!-- CSS Generated by CssManager for context: ${context} -->
    <!-- CSS Mode: BUNDLED (inline) -->
    <style>
${cssContent}
    </style>`;
        } else {
            const cssLinks = this.generateCssLinks(context);
            return `    <!-- CSS Generated by CssManager for context: ${context} -->
    <!-- CSS Mode: LINKED (external) with prefix: "${config.prefix}" -->
${cssLinks}`;
        }
    }

    /**
     * Apply CSS to preview context (for runtime application)
     * @returns {Promise<void>}
     */
    async applyPreviewCss() {
        logCssManager('Applying CSS to preview context');
        
        const config = this.getCssConfig(CSS_CONTEXT.PREVIEW);
        const bundledCss = await this.bundleCss(CSS_CONTEXT.PREVIEW);
        
        // Remove existing managed style elements
        const existingStyles = document.querySelectorAll('style[data-css-manager]');
        existingStyles.forEach(style => style.remove());
        
        // Add new bundled CSS
        const styleElement = document.createElement('style');
        styleElement.setAttribute('data-css-manager', 'true');
        styleElement.textContent = bundledCss;
        document.head.appendChild(styleElement);
        
        logCssManager('Preview CSS applied successfully');
    }

    /**
     * Clear CSS cache
     */
    clearCache() {
        this.cache.clear();
        this.lastFetchTimes.clear();
        logCssManager('CSS cache cleared');
    }

    /**
     * Get CSS manager statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            cachedFiles: Array.from(this.cache.keys()),
            cacheTimeout: this.cacheTimeout
        };
    }

    // Add plugin CSS handling
    async getPluginCss(context, pluginId) {
        const state = appStore.getState();
        if (!getIsPluginEnabled(state, pluginId)) {
            return ''; // Skip disabled plugins
        }
        
        const pluginSettings = state.plugins[pluginId]?.settings || {};
        const theme = state.theme || 'light';
        
        // Load system CSS for this plugin
        const systemCss = await this.fetchCssContent(`styles/system/${pluginId}-${theme}.css`);
        
        // Load user override if exists
        const userCss = await this.fetchCssContent(`styles/user/${pluginId}.css`);
        
        return [systemCss, userCss].filter(Boolean).join('\n');
    }
}

// Export singleton instance
export const cssManager = new CssManager();

// Export convenience functions that use the singleton
export const getCssConfig = (context) => cssManager.getCssConfig(context);
export const fetchCssContent = (cssPath) => cssManager.fetchCssContent(cssPath);
export const bundleCss = (context) => cssManager.bundleCss(context);
export const generateCssLinks = (context) => cssManager.generateCssLinks(context);
export const generateCssSection = (context) => cssManager.generateCssSection(context);
export const applyPreviewCss = () => cssManager.applyPreviewCss();
export const clearCssCache = () => cssManager.clearCache(); 