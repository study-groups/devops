/**
 * client/settings/PageThemeManager.js
 * Manages the dynamic application of page themes to the preview iframe.
 * Supports the new theme structure: core.css + light/dark.css
 */

import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

const PAGE_THEME_CORE_LINK_ID = 'devpages-page-theme-core-stylesheet';
const PAGE_THEME_MODE_LINK_ID = 'devpages-page-theme-mode-stylesheet';

class PageThemeManager {
    constructor() {
        this.unsubscribe = null;
        this.currentTheme = {
            themeDir: null,
            themeMode: null,
        };
        this.loadedThemes = new Set(); // Track successfully loaded themes
    }

    start() {
        if (this.unsubscribe) {
            logMessage('PageThemeManager is already running.', 'warn', 'THEME_MANAGER');
            return;
        }

        logMessage('Starting PageThemeManager...', 'info', 'THEME_MANAGER');
        this.unsubscribe = appStore.subscribe((newState, oldState) => {
            const newThemeSettings = newState.settings?.pageTheme;
            const oldThemeSettings = oldState.settings?.pageTheme;

            if (newThemeSettings && newThemeSettings !== oldThemeSettings) {
                this.handleThemeChange(newThemeSettings);
            }
        });

        // Apply the initial theme based on the current state
        const initialState = appStore.getState();
        this.handleThemeChange(initialState.settings?.pageTheme);
    }

    stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            logMessage('PageThemeManager stopped.', 'info', 'THEME_MANAGER');
        }
        this.removeThemeStylesheets();
    }

    async handleThemeChange(themeSettings) {
        if (!themeSettings) return;

        const { themeDir, themeMode } = themeSettings;

        if (this.currentTheme.themeDir === themeDir && this.currentTheme.themeMode === themeMode) {
            return; // No change
        }

        this.currentTheme = { themeDir, themeMode };

        if (!themeDir || !themeMode) {
            logMessage('Theme directory or mode is not set. Removing theme stylesheets.', 'debug', 'THEME_MANAGER');
            this.removeThemeStylesheets();
            return;
        }

        // Support both new structure (core + mode) and legacy (single file)
        const coreUrl = `${themeDir}/core.css`;
        const modeUrl = `${themeDir}/${themeMode}.css`;
        const legacyUrl = `${themeDir}/${themeMode}.css`; // Fallback to old structure

        logMessage(`Applying page theme: ${themeDir} (${themeMode} mode)`, 'info', 'THEME_MANAGER');
        
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
            
            logMessage(`Validating theme file via files API: ${apiPath}`, 'debug', 'THEME_MANAGER');
            
            // Use the authenticated files API
            const response = await fetch(`/api/files/content?pathname=${encodeURIComponent(apiPath)}`, { method: 'HEAD' });
            const exists = response.ok;
            
            logMessage(`Theme file ${apiPath} ${exists ? 'exists' : 'not found'} (${response.status})`, 'debug', 'THEME_MANAGER');
            return exists;
        } catch (error) {
            logMessage(`Theme file validation failed for ${themeUrl}: ${error.message}`, 'warn', 'THEME_MANAGER');
            return false;
        }
    }

    async applyNewThemeStructure(coreUrl, modeUrl) {
        const previewDoc = this.getPreviewIframeDocument();
        if (!previewDoc) {
            logMessage('Preview iframe not found. Cannot apply page theme.', 'warn', 'THEME_MANAGER');
            return;
        }

        // Apply core theme
        await this.applyThemeStylesheet(previewDoc, PAGE_THEME_CORE_LINK_ID, coreUrl);
        
        // Apply mode-specific theme
        const modeExists = await this.validateThemeFile(modeUrl);
        if (modeExists) {
            await this.applyThemeStylesheet(previewDoc, PAGE_THEME_MODE_LINK_ID, modeUrl);
        } else {
            logMessage(`Mode file ${modeUrl} not found, using core only`, 'debug', 'THEME_MANAGER');
        }
    }

    async applyLegacyTheme(legacyUrl) {
        const previewDoc = this.getPreviewIframeDocument();
        if (!previewDoc) return;

        const legacyExists = await this.validateThemeFile(legacyUrl);
        if (legacyExists) {
            await this.applyThemeStylesheet(previewDoc, PAGE_THEME_MODE_LINK_ID, legacyUrl);
        } else {
            logMessage(`Legacy theme file not found: ${legacyUrl}`, 'error', 'THEME_MANAGER');
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
            logMessage('Preview container found but no iframe present - content may be rendered inline', 'debug', 'THEME_MANAGER');
        } else {
            logMessage('Preview iframe not found with any selector', 'debug', 'THEME_MANAGER');
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
            logMessage(`Created new theme stylesheet link: ${linkId}`, 'debug', 'THEME_MANAGER');
        }

        // Convert theme URL to files API URL for loading
        const apiPath = themeUrl.startsWith('/') ? themeUrl.substring(1) : themeUrl;
        const apiUrl = `/api/files/content?pathname=${encodeURIComponent(apiPath)}`;

        if (link.getAttribute('href') !== apiUrl) {
            link.setAttribute('href', apiUrl);
            this.loadedThemes.add(themeUrl);
            logMessage(`Updated theme stylesheet: ${themeUrl} -> ${apiUrl}`, 'debug', 'THEME_MANAGER');
        }
    }

    removeThemeStylesheets() {
        const previewDoc = this.getPreviewIframeDocument();
        if (previewDoc) {
            [PAGE_THEME_CORE_LINK_ID, PAGE_THEME_MODE_LINK_ID].forEach(linkId => {
                const link = previewDoc.getElementById(linkId);
                if (link) {
                    link.parentNode.removeChild(link);
                    logMessage(`Removed theme stylesheet: ${linkId}`, 'debug', 'THEME_MANAGER');
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