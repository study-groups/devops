/**
 * CssDesignPanel.js - Consolidated CSS & Design management panel
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from '../../core/panelRegistry.js';

function logCssDesign(message, level = 'info') {
    const type = 'CSS_DESIGN';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export class CssDesignPanel {
    constructor(parentElement) {
        this.containerElement = parentElement;
        this.stateUnsubscribe = null;
        this.designTokens = {};
        this.stylesheets = [];
        
        // Load CSS for this panel
        this.loadCSS();
        
        // Get initial state from store
        const state = appStore.getState();
        const designTokensState = state.settings?.designTokens || {};
        
        this.themesDirectory = designTokensState.tokensDirectory || '/root/pj/md/themes';
        this.currentTheme = designTokensState.activeTheme || 'classic';
        this.previewMode = designTokensState.themeVariant || 'light';
        
        this.createPanelContent(parentElement);
        this.subscribeToState();
        this.scanStylesheets();
        this.loadDesignTokens();
        
        // Automatically scan for theme files on load
        setTimeout(() => {
            this.scanThemeFiles();
        }, 500);
        
        // Expose instance globally for theme selection buttons
        window.cssDesignPanel = this;
        
        logCssDesign('CssDesignPanel initialized');
    }

    loadCSS() {
        const cssId = 'css-design-panel-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = '/client/settings/panels/css-design/CssDesignPanel.css';
            document.head.appendChild(link);
            logCssDesign('Loaded CssDesignPanel.css');
        }
    }

    createPanelContent(parentElement) {
        parentElement.innerHTML = `
            <div class="css-design-panel-content">
                <div class="design-tokens-section">
                    <h5>Design Tokens</h5>
                    <div class="design-tokens-controls">
                        <div class="form-group">
                            <label for="themes-directory">Themes Directory:</label>
                            <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                                <input type="text" id="themes-directory" value="${this.themesDirectory}" 
                                       placeholder="/root/pj/md/themes" class="form-input" style="flex: 1;">
                                <button id="scan-directory" class="action-btn">Scan</button>
                            </div>
                        </div>
                        
                        <div class="scan-results" id="scan-results">
                            <!-- Directory scan results will appear here -->
                        </div>
                        
                        <div class="form-group">
                            <label>Current Theme:</label>
                            <span id="current-theme-display" class="theme-display">${this.currentTheme}</span>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button id="generate-design-tokens" class="action-btn">Generate design-tokens.js</button>
                        </div>
                    </div>
                </div>

                <div class="devpages-css-section">
                    <h5>Active Theme Files</h5>
                    <div class="theme-files-container" id="theme-files-container">
                        <div class="theme-files-loading">Loading theme files...</div>
                    </div>
                    <button id="reload-theme-files" class="action-btn secondary">Reload Files</button>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.scanThemeFiles();
    }

    attachEventListeners() {
        // Design tokens controls
        document.getElementById('scan-directory')?.addEventListener('click', () => {
            this.scanDirectory();
        });

        document.getElementById('generate-design-tokens')?.addEventListener('click', () => {
            this.generateDesignTokensFile();
        });

        document.getElementById('themes-directory')?.addEventListener('change', (e) => {
            this.updateThemesDirectory(e.target.value);
        });

        // Theme file controls
        document.getElementById('reload-theme-files')?.addEventListener('click', () => {
            this.reloadThemeFiles();
        });
    }

    async scanDirectory() {
        logCssDesign(`Scanning themes directory: ${this.themesDirectory}`);
        
        // Update the directory in state
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR,
            payload: this.themesDirectory
        });

        const statusElement = document.getElementById('scan-results');
        statusElement.innerHTML = `
            <div class="scan-result">
                <h5>Directory Scan Results</h5>
                <div class="scan-info scanning">
                    <p>📁 Directory: <code>${this.themesDirectory}</code></p>
                    <p>🔍 Scanning for themes...</p>
                </div>
            </div>
        `;

        try {
            // Convert absolute path to relative path for API
            let relativePath = this.themesDirectory;
            if (relativePath.startsWith('/root/pj/md/')) {
                relativePath = relativePath.replace('/root/pj/md/', '');
            } else if (relativePath.startsWith('/')) {
                // Remove leading slash for relative paths
                relativePath = relativePath.substring(1);
            }
            
            logCssDesign(`Fetching directory listing for: ${relativePath}`);
            
            const response = await fetch(`/api/files/list?pathname=${encodeURIComponent(relativePath)}`);
            
            if (!response.ok) {
                logCssDesign(`API request failed: ${response.status} ${response.statusText}`, 'warn');
                
                // For themes directory, we know classic exists, so show it
                if (relativePath === 'themes' || relativePath.endsWith('/themes')) {
                    this.displayKnownThemes(relativePath);
                } else {
                    this.displayScanError(`API request failed: ${response.status} ${response.statusText}`);
                }
                return;
            }
            
            const data = await response.json();
            logCssDesign(`Directory scan response:`, data);
            
            // Handle different response formats and find directories
            let themes = [];
            
            if (data.files && Array.isArray(data.files)) {
                themes = data.files.filter(item => item.type === 'directory' || item.isDirectory);
            } else if (data.directories && Array.isArray(data.directories)) {
                themes = data.directories.map(name => ({ name, type: 'directory' }));
            } else if (Array.isArray(data)) {
                themes = data.filter(item => 
                    item.type === 'directory' || 
                    item.isDirectory || 
                    (item.name && !item.name.includes('.'))
                );
            }
            
            logCssDesign(`Found ${themes.length} potential theme directories`);
            
            // Update display with results
            this.displayScanResults(themes, this.themesDirectory);
            
        } catch (error) {
            logCssDesign(`Error scanning directory: ${error.message}`, 'error');
            
            // For themes directory, show known themes as fallback
            if (this.themesDirectory.includes('themes')) {
                this.displayKnownThemes(this.themesDirectory);
            } else {
                this.displayScanError(error.message);
            }
        }
    }

    displayScanResults(themes, scannedPath) {
        const statusElement = document.getElementById('scan-results');
        
        if (themes.length === 0) {
            statusElement.innerHTML = `
                <div class="scan-result">
                    <h5>Directory Scan Results</h5>
                    <div class="scan-info no-themes">
                        <p>📁 Directory: <code>${scannedPath}</code></p>
                        <p>⚠️ No theme directories found</p>
                        <p class="scan-suggestion">Create a theme directory (e.g., 'classic') to get started</p>
                    </div>
                </div>
            `;
        } else {
            const themesList = themes.map(theme => `
                <div class="theme-item">
                    <span class="theme-icon">🎨</span>
                    <span class="theme-name">${theme.name}</span>
                    <button class="theme-action" onclick="window.cssDesignPanel?.selectTheme('${theme.name}')">Select</button>
                </div>
            `).join('');
            
            statusElement.innerHTML = `
                <div class="scan-result">
                    <h5>Directory Scan Results</h5>
                    <div class="scan-info success">
                        <p>📁 Directory: <code>${scannedPath}</code></p>
                        <p>✅ Found ${themes.length} theme${themes.length === 1 ? '' : 's'}</p>
                    </div>
                    <div class="themes-list">
                        ${themesList}
                    </div>
                </div>
            `;
        }
        
        logCssDesign(`Directory scan completed - found ${themes.length} themes`);
    }

    displayKnownThemes(scannedPath) {
        const statusElement = document.getElementById('scan-results');
        
        // Since we know the classic theme exists, show it and auto-select it
        const knownThemes = [
            { name: 'classic', type: 'directory' }
        ];
        
        const themesList = knownThemes.map(theme => `
            <div class="theme-item">
                <span class="theme-icon">🎨</span>
                <span class="theme-name">${theme.name}</span>
                <button class="theme-action" onclick="window.cssDesignPanel?.selectTheme('${theme.name}')">Select</button>
            </div>
        `).join('');
        
        statusElement.innerHTML = `
            <div class="scan-result">
                <h5>Directory Scan Results</h5>
                <div class="scan-info success">
                    <p>📁 Directory: <code>${scannedPath}</code></p>
                    <p>✅ Found ${knownThemes.length} known theme${knownThemes.length === 1 ? '' : 's'}</p>
                    <p class="scan-note">⚠️ API scan failed, showing known themes</p>
                </div>
                <div class="themes-list">
                    ${themesList}
                </div>
            </div>
        `;
        
        // Auto-select the classic theme
        this.selectTheme('classic');
        
        logCssDesign(`Showing ${knownThemes.length} known themes as fallback, auto-selected classic`);
    }

    displayScanError(errorMessage) {
        const statusElement = document.getElementById('scan-results');
        statusElement.innerHTML = `
            <div class="scan-result">
                <h5>Directory Scan Results</h5>
                <div class="scan-info error">
                    <p>📁 Directory: <code>${this.themesDirectory}</code></p>
                    <p>❌ Scan failed: ${errorMessage}</p>
                    <p class="scan-suggestion">Check that the directory exists and is accessible</p>
                </div>
            </div>
        `;
    }

    selectTheme(themeName) {
        logCssDesign(`Selecting theme: ${themeName}`);
        this.currentTheme = themeName;
        
        // Update display
        document.getElementById('current-theme-display').textContent = themeName;
        
        // Update state
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_THEME,
            payload: themeName
        });
        
        // Check for theme files
        this.checkThemeFiles(themeName);
    }

    async checkThemeFiles(themeName) {
        const themeDir = `${this.themesDirectory}/${themeName}`;
        const relativePath = themeDir.startsWith('/root/pj/md/') 
            ? themeDir.replace('/root/pj/md/', '') 
            : themeDir;
        
        try {
            const response = await fetch(`/api/files/list?pathname=${encodeURIComponent(relativePath)}`);
            
            if (response.ok) {
                const data = await response.json();
                const files = data.files || [];
                
                const expectedFiles = ['core.css', 'light.css', 'dark.css'];
                const foundFiles = files.filter(f => f.type === 'file' && expectedFiles.includes(f.name));
                
                logCssDesign(`Theme ${themeName} has ${foundFiles.length}/${expectedFiles.length} expected files`);
                
                // Update theme status
                this.updateThemeStatus(themeName, foundFiles, expectedFiles);
            }
        } catch (error) {
            logCssDesign(`Error checking theme files: ${error.message}`, 'error');
        }
    }

    updateThemeStatus(themeName, foundFiles, expectedFiles) {
        const statusElement = document.getElementById('scan-results');
        const existingContent = statusElement.innerHTML;
        
        const fileStatus = expectedFiles.map(fileName => {
            const found = foundFiles.some(f => f.name === fileName);
            return `<span class="file-status ${found ? 'found' : 'missing'}">${fileName} ${found ? '✅' : '❌'}</span>`;
        }).join('');
        
        const themeStatus = `
            <div class="theme-status">
                <h6>Theme: ${themeName}</h6>
                <div class="theme-files">
                    ${fileStatus}
                </div>
            </div>
        `;
        
        statusElement.innerHTML = existingContent + themeStatus;
    }

    generateDesignTokensFile() {
        logCssDesign('Generating design-tokens.js file...');
        
        const designTokensContent = this.generateDesignTokensContent();
        this.downloadFile('design-tokens.js', designTokensContent);
        
        logCssDesign('design-tokens.js file generated and downloaded');
    }

    async scanThemeFiles() {
        logCssDesign('Scanning for active theme files...');
        
        const themeFilesContainer = document.getElementById('theme-files-container');
        themeFilesContainer.innerHTML = `
            <div class="scanning-theme-files">
                <p>Scanning for theme files...</p>
            </div>
        `;

        try {
            // Scan for theme files in the current theme directory
            const themeFiles = await this.findActiveThemeFiles();
            this.displayThemeFiles(themeFiles);
        } catch (error) {
            logCssDesign(`Error scanning theme files: ${error.message}`, 'error');
            themeFilesContainer.innerHTML = `
                <div class="theme-scan-error">
                    <p>Error scanning theme files: ${error.message}</p>
                </div>
            `;
        }
    }

    async findActiveThemeFiles() {
        const themeFiles = [];
        const expectedFiles = ['core.css', 'light.css', 'dark.css'];
        
        // Always check for classic theme since we know it exists
        const themesPath = this.themesDirectory.startsWith('/root/pj/md/') 
            ? this.themesDirectory.replace('/root/pj/md/', '') 
            : this.themesDirectory;
        
        // Check for classic theme as default
        const classicThemePath = `${themesPath}/classic`;
        
        logCssDesign(`Looking for theme files in: ${classicThemePath}`);
        
        for (const fileName of expectedFiles) {
            const filePath = `${classicThemePath}/${fileName}`;
            try {
                logCssDesign(`Checking file: ${filePath}`);
                
                // Use the authenticated files API
                const filesResponse = await fetch(`/api/files/content?pathname=${encodeURIComponent(filePath)}`);
                if (filesResponse.ok) {
                    const content = await filesResponse.text();
                    themeFiles.push({
                        name: fileName,
                        path: filePath,
                        theme: 'classic',
                        size: content.length,
                        loaded: true,
                        type: this.getThemeFileType(fileName),
                        source: 'files-api'
                    });
                    logCssDesign(`Found ${fileName} via files API (${content.length} chars)`);
                } else {
                    // If API fails, still show the file as potentially available
                    themeFiles.push({
                        name: fileName,
                        path: filePath,
                        theme: 'classic',
                        size: 0,
                        loaded: false,
                        type: this.getThemeFileType(fileName),
                        error: `Files API failed (${filesResponse.status}) - check authentication`,
                        note: 'File may exist but API cannot access it - try generating an API token'
                    });
                    logCssDesign(`Files API failed for ${fileName} (${filesResponse.status}) - check authentication`, 'warn');
                }
            } catch (error) {
                themeFiles.push({
                    name: fileName,
                    path: filePath,
                    theme: 'classic',
                    size: 0,
                    loaded: false,
                    error: error.message,
                    type: this.getThemeFileType(fileName)
                });
                logCssDesign(`Error checking ${fileName}: ${error.message}`, 'error');
            }
        }

        return themeFiles;
    }

    getThemeFileType(fileName) {
        switch (fileName) {
            case 'core.css': return 'Base design tokens and variables';
            case 'light.css': return 'Light theme colors';
            case 'dark.css': return 'Dark theme colors';
            default: return 'Theme file';
        }
    }

    displayThemeFiles(themeFiles) {
        const themeFilesContainer = document.getElementById('theme-files-container');
        
        if (themeFiles.length === 0) {
            themeFilesContainer.innerHTML = `
                <div class="no-theme-files">
                    <p>No theme files found</p>
                    <p class="theme-suggestion">Make sure theme files exist in <code>${this.themesDirectory}</code></p>
                </div>
            `;
            return;
        }

        const themeFilesList = themeFiles.map(file => {
            const status = file.loaded ? 'loaded' : (file.note ? 'api-error' : 'missing');
            const sizeText = file.loaded ? `${(file.size / 1024).toFixed(1)}KB` : (file.note ? 'API Error' : 'Missing');
            
            return `
                <div class="theme-file-item ${status}">
                    <div class="theme-file-info">
                        <div class="theme-file-name">
                            <span class="file-status status-${status}"></span>
                            <span class="file-name">${file.name}</span>
                            <span class="file-type">${file.type}</span>
                        </div>
                        <div class="theme-file-details">
                            <span class="file-path" title="${file.path}">${file.path}</span>
                            <span class="file-size">${sizeText}</span>
                            ${file.note ? `<span class="file-note" title="${file.error}">${file.note}</span>` : ''}
                        </div>
                    </div>
                    <div class="theme-file-actions">
                        ${file.loaded ? `
                            <button class="theme-file-action" onclick="window.cssDesignPanel?.viewThemeFile('${file.path}')">View</button>
                            <button class="theme-file-action" onclick="window.cssDesignPanel?.reloadThemeFile('${file.path}')">Reload</button>
                        ` : file.note ? `
                            <button class="theme-file-action warning" onclick="window.cssDesignPanel?.viewThemeFile('${file.path}')">Try View</button>
                        ` : `
                            <button class="theme-file-action disabled" disabled>Missing</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        const loadedCount = themeFiles.filter(f => f.loaded).length;
        const totalCount = themeFiles.length;

        themeFilesContainer.innerHTML = `
            <div class="theme-files-summary">
                <div class="summary-stats">
                    <span class="stat-item">
                        <span class="stat-label">Files:</span>
                        <span class="stat-value">${loadedCount}/${totalCount}</span>
                    </span>
                    <span class="stat-item">
                        <span class="stat-label">Theme:</span>
                        <span class="stat-value">${themeFiles[0]?.theme || 'Unknown'}</span>
                    </span>
                </div>
            </div>
            <div class="theme-files-list">
                ${themeFilesList}
            </div>
        `;

        logCssDesign(`Displayed ${themeFiles.length} theme files (${loadedCount} loaded)`);
    }

    async reloadThemeFiles() {
        logCssDesign('Reloading theme files...');
        await this.scanThemeFiles();
        this.showTemporaryMessage('Theme files reloaded', 'success');
    }

    async viewThemeFile(filePath) {
        logCssDesign(`Viewing theme file: ${filePath}`);
        
        try {
            // Ensure the file path is properly formatted for the API
            const apiPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            logCssDesign(`Using API path: ${apiPath}`);
            
            // Use the authenticated files API
            const response = await fetch(`/api/files/content?pathname=${encodeURIComponent(apiPath)}`);
            
            if (response.ok) {
                const content = await response.text();
                this.showThemeFileModal(filePath, content);
            } else {
                throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            logCssDesign(`Error viewing theme file: ${error.message}`, 'error');
            this.showTemporaryMessage(`Error loading file: ${error.message}`, 'error');
        }
    }

    async reloadThemeFile(filePath) {
        logCssDesign(`Reloading theme file: ${filePath}`);
        // This would trigger a reload of the specific theme file
        // For now, just refresh the scan
        await this.scanThemeFiles();
        this.showTemporaryMessage(`Reloaded ${filePath}`, 'success');
    }

    showThemeFileModal(filePath, content) {
        // Create a modal to show the theme file content
        const modal = document.createElement('div');
        modal.className = 'theme-file-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Theme File: ${filePath.split('/').pop()}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="file-info">
                        <p><strong>Path:</strong> ${filePath}</p>
                        <p><strong>Size:</strong> ${(content.length / 1024).toFixed(1)}KB</p>
                        <p><strong>Lines:</strong> ${content.split('\n').length}</p>
                    </div>
                    <textarea class="theme-file-content" readonly>${content}</textarea>
                </div>
                <div class="modal-footer">
                    <button class="modal-close-btn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeModal = () => modal.remove();
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);
        modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    }

    generateDesignTokensContent() {
        return `// Design Tokens for DevPages Classic Theme
// Generated: ${new Date().toISOString()}
// Theme Structure: ${this.themesDirectory}/classic/
//   - core.css (base design tokens and variables)
//   - light.css (light theme semantic mappings)
//   - dark.css (dark theme semantic mappings)
//   - system.css (DevPages system interface styles)

export const designTokens = {
  // Theme Configuration
  theme: {
    name: 'classic',
    variant: 'light', // 'light' | 'dark'
    directory: '${this.themesDirectory}/classic',
    files: {
      core: 'core.css',
      light: 'light.css', 
      dark: 'dark.css',
      system: 'system.css'
    }
  },

  // Color Palette (matches core.css)
  colors: {
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617'
    },
    brand: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d'
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309'
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c'
    },
    info: {
      50: '#f0f9ff',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1'
    }
  },

  // Typography (matches core.css)
  typography: {
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
      serif: ['Georgia', 'Times New Roman', 'serif']
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem'  // 36px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800
    },
    lineHeight: {
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2
    }
  },

  // Spacing Scale (matches core.css)
  spacing: {
    0: '0',
    px: '1px',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    1.5: '0.375rem',  // 6px
    2: '0.5rem',      // 8px
    2.5: '0.625rem',  // 10px
    3: '0.75rem',     // 12px
    3.5: '0.875rem',  // 14px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    7: '1.75rem',     // 28px
    8: '2rem',        // 32px
    9: '2.25rem',     // 36px
    10: '2.5rem',     // 40px
    11: '2.75rem',    // 44px
    12: '3rem',       // 48px
    14: '3.5rem',     // 56px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
    24: '6rem',       // 96px
    28: '7rem',       // 112px
    32: '8rem'        // 128px
  },

  // Border Radius (matches core.css)
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    base: '0.25rem',  // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px'
  },

  // Shadows (matches core.css)
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
  },

  // Breakpoints
  screens: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
};

// Helper functions for theme switching
export const themeHelpers = {
  // Apply theme to document
  applyTheme(variant = 'light') {
    document.documentElement.setAttribute('data-theme', variant);
  },

  // Load theme CSS files
  loadThemeCSS(baseUrl = '${this.themesDirectory}/classic') {
    const files = ['core.css', 'light.css', 'dark.css', 'system.css'];
    files.forEach(file => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = \`\${baseUrl}/\${file}\`;
      link.id = \`theme-\${file.replace('.css', '')}\`;
      document.head.appendChild(link);
    });
  },

  // Toggle between light and dark themes
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    this.applyTheme(next);
    return next;
  }
};

export default designTokens;
`;
    }

    scanStylesheets() {
        logCssDesign('Scanning current stylesheets...');
        
        this.stylesheets = [];
        
        // Scan link elements
        const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
        linkElements.forEach(link => {
            this.stylesheets.push({
                type: 'link',
                href: link.href,
                element: link,
                isSystem: this.isSystemCss(link.href),
                isPage: this.isPageCss(link.href)
            });
        });

        // Scan style elements
        const styleElements = document.querySelectorAll('style');
        styleElements.forEach(style => {
            this.stylesheets.push({
                type: 'inline',
                content: style.textContent,
                element: style,
                isSystem: false,
                isPage: false
            });
        });

        this.updateStylesheetDisplay();
        logCssDesign(`Found ${this.stylesheets.length} stylesheets`);
    }

    isSystemCss(href) {
        return href.includes('/client/') || href.includes('/styles/system/') || href.includes('settings');
    }

    isPageCss(href) {
        return href.includes('/md/styles/') || href.includes('styles.css') || href.includes('/themes/');
    }

    updateStylesheetDisplay() {
        // Update stats
        const totalCount = this.stylesheets.length;
        const systemCount = this.stylesheets.filter(s => s.isSystem).length;
        const pageCount = this.stylesheets.filter(s => s.isPage).length;

        document.getElementById('total-stylesheets').textContent = totalCount;
        document.getElementById('system-css-count').textContent = systemCount;
        document.getElementById('page-css-count').textContent = pageCount;

        // Update stylesheet lists
        this.updateStylesheetList('page-stylesheets', this.stylesheets.filter(s => s.isPage));
        this.updateStylesheetList('system-stylesheets', this.stylesheets.filter(s => s.isSystem));
    }

    updateStylesheetList(containerId, stylesheets) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (stylesheets.length === 0) {
            container.innerHTML = '<p class="no-stylesheets">No stylesheets found</p>';
            return;
        }

        stylesheets.forEach((stylesheet) => {
            const item = document.createElement('div');
            item.className = 'stylesheet-item';
            
            const stylesheetPath = this.getStylesheetPath(stylesheet);
            item.innerHTML = `
                <div class="stylesheet-info">
                    <div class="stylesheet-path" title="${stylesheetPath}">${stylesheetPath}</div>
                    <div class="stylesheet-size">${this.getStylesheetSize(stylesheet)}</div>
                </div>
                <div class="stylesheet-actions">
                    <button class="stylesheet-action" data-action="view" title="View stylesheet content">👁️</button>
                </div>
            `;
            
            // Add event listener for view action
            const viewBtn = item.querySelector('[data-action="view"]');
            if (viewBtn) {
                viewBtn.addEventListener('click', () => this.viewStylesheet(stylesheet));
            }
            
            container.appendChild(item);
        });
    }

    getStylesheetPath(stylesheet) {
        if (stylesheet.type === 'link') {
            const url = new URL(stylesheet.href);
            return url.pathname;
        }
        return 'Inline styles';
    }

    getStylesheetSize(stylesheet) {
        if (stylesheet.type === 'inline') {
            return `${stylesheet.content.length} chars`;
        }
        return 'External';
    }

    viewStylesheet(stylesheet) {
        const path = this.getStylesheetPath(stylesheet);
        logCssDesign(`Viewing stylesheet: ${path}`);
        
        // Open in new tab if external
        if (stylesheet.type === 'link') {
            window.open(stylesheet.href, '_blank');
        }
    }

    async copyAllCss() {
        logCssDesign('Gathering all CSS...');
        
        try {
            const allCss = await this.gatherAllCss();
            await this.copyToClipboard(allCss);
            this.showTemporaryMessage('All CSS copied to clipboard!', 'success');
        } catch (error) {
            logCssDesign(`Error gathering CSS: ${error.message}`, 'error');
            this.showTemporaryMessage('Error gathering CSS', 'error');
        }
    }

    async gatherAllCss() {
        let allCss = `/* Complete CSS Export - DevPages System */\n/* Generated: ${new Date().toISOString()} */\n\n`;
        
        for (let i = 0; i < this.stylesheets.length; i++) {
            const stylesheet = this.stylesheets[i];
            const path = this.getStylesheetPath(stylesheet);
            
            allCss += `/* ${i + 1}. ${path} */\n`;
            
            if (stylesheet.type === 'inline') {
                allCss += stylesheet.content || '/* No content */';
            } else {
                allCss += `/* External stylesheet: ${stylesheet.href} */`;
            }
            
            allCss += '\n\n';
        }
        
        return allCss;
    }

    createSystemCss() {
        logCssDesign('Creating system CSS...');
        
        // Reference the default system.css file in client/styles/
        const defaultSystemCssPath = '/client/styles/system.css';
        
        // Open the system CSS file in a new tab for viewing
        window.open(defaultSystemCssPath, '_blank');
        
        logCssDesign(`Default system CSS available at: ${defaultSystemCssPath}`);
        
        // Also provide download functionality with generated content
        const systemCssContent = this.generateSystemCssContent();
        this.downloadFile('devpages-system.css', systemCssContent);
        
        logCssDesign('System CSS file created and downloaded');
    }

    generateSystemCssContent() {
        return `/* DevPages System CSS - Reference Copy */
/* Generated: ${new Date().toISOString()} */
/* 
 * This is a reference copy of the system CSS.
 * 
 * File Structure:
 * - /client/styles/system.css: Default system interface styles (this file)
 * - ${this.themesDirectory}/classic/core.css: Base design tokens and variables
 * - ${this.themesDirectory}/classic/light.css: Light theme semantic color mappings  
 * - ${this.themesDirectory}/classic/dark.css: Dark theme semantic color mappings
 * 
 * The system.css works independently of MD_DIR and provides default styling
 * for the DevPages interface, while the theme files in MD_DIR handle content styling.
 */

/* Import the core design tokens from MD_DIR themes (if available) */
@import url('${this.themesDirectory}/classic/core.css');
@import url('${this.themesDirectory}/classic/light.css');
@import url('${this.themesDirectory}/classic/dark.css');

/* System interface styles are defined in /client/styles/system.css */
/* This includes: */
/* - Navigation system (.devpages-nav) */
/* - Sidebar system (.devpages-sidebar) */
/* - Settings panel system (.devpages-settings-panel) */
/* - Form elements (.devpages-form-*) */
/* - Buttons (.devpages-btn) */
/* - Cards and panels (.devpages-card) */
/* - Modals (.devpages-modal) */
/* - Tooltips (.devpages-tooltip) */
/* - Loading states (.devpages-loading) */
/* - Responsive design and accessibility features */

/* To use the complete system CSS, reference the default file: */
/* <link rel="stylesheet" href="/client/styles/system.css"> */

/* Basic fallback styles for immediate use: */
.devpages-system {
  font-family: var(--font-family-sans, 'Inter', system-ui, sans-serif);
  font-size: var(--font-size-sm, 0.875rem);
  line-height: var(--line-height-normal, 1.5);
  color: var(--color-foreground-primary, #0f172a);
  background-color: var(--color-background-primary, #f8fafc);
}

.devpages-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid;
  cursor: pointer;
  transition: var(--transition-all, all 150ms ease);
  text-decoration: none;
  user-select: none;
}

.devpages-btn-primary {
  background-color: var(--button-primary-background, #2563eb);
  color: var(--button-primary-foreground, #ffffff);
  border-color: var(--button-primary-border, #2563eb);
}

.devpages-btn-primary:hover {
  background-color: var(--button-primary-hover, #1d4ed8);
  border-color: var(--button-primary-hover, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
}

/* Note: This is a minimal fallback. The complete system.css file */
/* contains comprehensive styling for all DevPages interface components. */
`;
    }

    updateThemesDirectory(directory) {
        this.themesDirectory = directory;
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR,
            payload: directory
        });
        logCssDesign(`Themes directory updated to: ${directory}`);
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            return false;
        }
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logCssDesign(`File downloaded: ${filename}`);
    }

    showTemporaryMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `temp-message temp-message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }

    loadDesignTokens() {
        const state = appStore.getState();
        const designTokensState = state.settings?.designTokens || {};
        
        this.designTokens = designTokensState.tokens || {};
        
        logCssDesign('Design tokens loaded');
    }

    subscribeToState() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            if (newState.settings?.designTokens !== prevState.settings?.designTokens) {
                this.handleStateUpdate(newState.settings.designTokens);
            }
        });
    }

    handleStateUpdate(designTokensState) {
        const oldDirectory = this.themesDirectory;
        
        this.themesDirectory = designTokensState.tokensDirectory || '/root/pj/md/themes';
        this.currentTheme = designTokensState.activeTheme || 'default';
        
        if (oldDirectory !== this.themesDirectory) {
            document.getElementById('themes-directory').value = this.themesDirectory;
            document.getElementById('current-theme-display').textContent = this.currentTheme;
        }
    }

    destroy() {
        logCssDesign('Destroying CssDesignPanel...');
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        // Clean up global reference
        if (window.cssDesignPanel === this) {
            window.cssDesignPanel = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        logCssDesign('CssDesignPanel destroyed.');
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'css-design-container',
    title: 'CSS & Design',
    component: CssDesignPanel,
    order: 5,
    defaultCollapsed: false
}); 