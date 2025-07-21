/**
 * client/settings/PageThemeManager.js
 * Manages the dynamic application of page themes to the preview iframe.
 * Supports the new theme structure: core.css + light/dark.css
 */

import { appStore } from '/client/appState.js';

const log = window.APP.services.log.createLogger('PageThemeManager');

const PAGE_THEME_CORE_LINK_ID = 'devpages-page-theme-core-stylesheet';
const PAGE_THEME_MODE_LINK_ID = 'devpages-page-theme-mode-stylesheet';

class PageThemeManager {
    constructor() {
        this.store = appStore;
        this.unsubscribe = null;
        this.currentThemeDir = '';
    }
    
    init() {
        let prevState = this.store.getState(); // Initialize previous state
        this.unsubscribe = this.store.subscribe(() => {
            const newState = this.store.getState();
            this.handleStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });

        // Apply the initial theme based on the current state
        const initialState = appStore.getState();
        this.handleStateChange(initialState, prevState); // Pass initial state and previous state
    }

    stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            log.info('THEME_MANAGER', 'STOP', 'PageThemeManager stopped.');
        }
        this.removeThemeStylesheets();
    }

    handleStateChange(newState, oldState) {
        const themeDir = newState.settings.pageTheme.themeDir;
        if (themeDir !== this.currentThemeDir) {
            this.currentThemeDir = themeDir;
            this.handleThemeChange(newState.settings.pageTheme);
        }
    }

    async handleThemeChange(themeSettings) {
        if (!themeSettings) return;

        const { themeDir, themeMode } = themeSettings;

        if (this.currentThemeDir === themeDir && this.currentThemeMode === themeMode) {
            return; // No change
        }

        this.currentThemeDir = themeDir;
        this.currentThemeMode = themeMode;

        if (!themeDir || !themeMode) {
            log.debug('THEME_MANAGER', 'NO_THEME_SET', 'Theme directory or mode is not set. Removing theme stylesheets.');
            this.removeThemeStylesheets();
            return;
        }

        // Support both new structure (core + mode) and legacy (single file)
        const coreUrl = `${themeDir}/core.css`;
        const modeUrl = `${themeDir}/${themeMode}.css`;
        const legacyUrl = `${themeDir}/${themeMode}.css`; // Fallback to old structure

        log.info('THEME_MANAGER', 'APPLYING_THEME', `Applying page theme: ${themeDir} (${themeMode} mode)`);
        
        // Try new structure first, fallback to legacy
        const coreExists = await this.validateThemeFile(coreUrl);
        if (coreExists) {
            await this.applyNewThemeStructure(coreUrl, modeUrl);
        } else {
            await this.applyLegacyTheme(legacyUrl);
        }
    }

    async validateThemeFile(themeUrl) {
        try {
            // Convert theme URL to API path
            // themeUrl format: "/themes/classic/core.css" or similar
            const apiPath = themeUrl.startsWith('/') ? themeUrl.substring(1) : themeUrl;
            
            log.debug('THEME_MANAGER', 'VALIDATE_THEME_FILE', `Validating theme file via files API: ${apiPath}`);
            
            // Use the authenticated files API
            const response = await fetch(`/api/files/content?pathname=${encodeURIComponent(apiPath)}`, { method: 'HEAD' });
            const exists = response.ok;
            
            log.debug('THEME_MANAGER', 'VALIDATE_THEME_FILE_RESULT', `Theme file ${apiPath} ${exists ? 'exists' : 'not found'} (${response.status})`);
            return exists;
        } catch (error) {
            log.warn('THEME_MANAGER', 'VALIDATE_THEME_FILE_ERROR', `Theme file validation failed for ${themeUrl}: ${error.message}`, error);
            return false;
        }
    }

    async applyNewThemeStructure(coreUrl, modeUrl) {
        const previewDoc = this.getPreviewIframeDocument();
        if (!previewDoc) {
            log.warn('THEME_MANAGER', 'PREVIEW_IFRAME_NOT_FOUND', 'Preview iframe not found. Cannot apply page theme.');
            return;
        }

        // Apply core theme
        await this.applyThemeStylesheet(previewDoc, PAGE_THEME_CORE_LINK_ID, coreUrl);
        
        // Apply mode-specific theme
        const modeExists = await this.validateThemeFile(modeUrl);
        if (modeExists) {
            await this.applyThemeStylesheet(previewDoc, PAGE_THEME_MODE_LINK_ID, modeUrl);
        } else {
            log.debug('THEME_MANAGER', 'MODE_FILE_NOT_FOUND', `Mode file ${modeUrl} not found, using core only`);
        }
    }

    async applyLegacyTheme(legacyUrl) {
        const previewDoc = this.getPreviewIframeDocument();
        if (!previewDoc) return;

        const legacyExists = await this.validateThemeFile(legacyUrl);
        if (legacyExists) {
            await this.applyThemeStylesheet(previewDoc, PAGE_THEME_MODE_LINK_ID, legacyUrl);
        } else {
            log.error('THEME_MANAGER', 'LEGACY_THEME_NOT_FOUND', `Legacy theme file not found: ${legacyUrl}`);
        }
    }

    getPreviewIframeDocument() {
        // Try multiple selectors to find the preview iframe
        const selectors = [
            '#preview-container iframe',
            '.preview-container iframe',
            '.preview-container-panel iframe',
            '#content-preview-panel iframe',
            '.preview-panel iframe',
            'iframe[data-preview]'
        ];

        for (const selector of selectors) {
            const iframe = document.querySelector(selector);
            if (iframe && iframe.contentDocument) {
                return iframe.contentDocument;
            }
        }
        
        // If no iframe found, check if preview container exists but has no iframe yet
        const previewContainer = document.querySelector('#preview-container, .preview-container');
        if (previewContainer && !previewContainer.querySelector('iframe')) {
            log.debug('THEME_MANAGER', 'PREVIEW_CONTAINER_NO_IFRAME', 'Preview container found but no iframe present - content may be rendered inline');
        } else {
            log.debug('THEME_MANAGER', 'PREVIEW_IFRAME_NOT_FOUND_ANY', 'Preview iframe not found with any selector');
        }
        return null;
    }

    async applyThemeStylesheet(previewDoc, linkId, themeUrl) {
        let link = previewDoc.getElementById(linkId);

        if (!link) {
            link = previewDoc.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            previewDoc.head.appendChild(link);
            log.debug('THEME_MANAGER', 'CREATED_STYLESHEET_LINK', `Created new theme stylesheet link: ${linkId}`);
        }

        // Convert theme URL to files API URL for loading
        const apiPath = themeUrl.startsWith('/') ? themeUrl.substring(1) : themeUrl;
        const apiUrl = `/api/files/content?pathname=${encodeURIComponent(apiPath)}`;

        if (link.getAttribute('href') !== apiUrl) {
            link.setAttribute('href', apiUrl);
            this.loadedThemes.add(themeUrl);
            log.debug('THEME_MANAGER', 'UPDATED_STYLESHEET', `Updated theme stylesheet: ${themeUrl} -> ${apiUrl}`);
        }
    }

    removeThemeStylesheets() {
        const previewDoc = this.getPreviewIframeDocument();
        if (previewDoc) {
            [PAGE_THEME_CORE_LINK_ID, PAGE_THEME_MODE_LINK_ID].forEach(linkId => {
                const link = previewDoc.getElementById(linkId);
                if (link) {
                    link.parentNode.removeChild(link);
                    log.debug('THEME_MANAGER', 'REMOVED_STYLESHEET', `Removed theme stylesheet: ${linkId}`);
                }
            });
        }
        this.loadedThemes.clear();
    }

    // Public method to get current theme status
    getThemeStatus() {
        return {
            currentTheme: { ...this.currentTheme },
            loadedThemes: Array.from(this.loadedThemes),
            isActive: !!this.unsubscribe
        };
    }
}

export const pageThemeManager = new PageThemeManager(); 