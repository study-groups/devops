/**
 * CodePanel.js - Code file browser integrated as a panel
 * 
 * Converts the existing code sidebar/file list functionality into a panel-based component
 * that can be managed by the PanelManager system.
 */

import { BasePanel } from './BasePanel.js';
import { appStore } from '/client/appState.js';
import eventBus from '/client/eventBus.js';

export class CodePanel extends BasePanel {
    constructor(options = {}) {
        super('code', {
            width: 300,
            minWidth: 250,
            maxWidth: 500,
            order: 1, // Second panel from left
            ...options
        });

        // Code panel specific state
        this.codeState = {
            currentPath: '',
            directories: [],
            files: [],
            fileInfoCache: new Map(),
            fileStatsCache: new Map(),
            loading: false
        };

        // File type handlers for different file extensions
        this.fileTypeHandlers = this.initializeFileTypeHandlers();

        this.log('CodePanel initialized', 'info');
    }

    /**
     * Get panel title
     */
    getTitle() {
        return 'Project Files';
    }

    /**
     * Setup event listeners
     */
    onSetupEventListeners() {
        // Subscribe to app store for file-related changes
        this.storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            this.handleStoreChange(newState, prevState);
        });

        // Listen for external path changes
        if (eventBus && typeof eventBus.on === 'function') {
            eventBus.on('path:changed', this.handleExternalPathChange.bind(this));
        }

        // Setup click delegation for file/directory items
        if (this.contentElement) {
            this.addEventListener(this.contentElement, 'click', this.handleClick.bind(this));
        }
    }

    /**
     * Handle app store changes
     */
    handleStoreChange(newState, prevState) {
        const newFileState = newState.file;
        const prevFileState = prevState.file || {};

        const pathChanged = newFileState?.currentPathname !== prevFileState?.currentPathname;
        const isDirectoryChanged = newFileState?.isDirectorySelected !== prevFileState?.isDirectorySelected;

        if (pathChanged || isDirectoryChanged) {
            this.codeState.currentPath = this.getCurrentPath();
            this.loadFiles();
        }
    }

    /**
     * Handle external path changes
     */
    handleExternalPathChange(eventData) {
        this.log(`External path change: ${JSON.stringify(eventData)}`, 'debug');
        const newPath = eventData?.path || '';
        if (newPath !== this.codeState.currentPath) {
            this.codeState.currentPath = newPath;
            this.loadFiles();
        }
    }

    /**
     * Get current path from app state
     */
    getCurrentPath() {
        if (window.appStore) {
            const state = window.appStore.getState();
            return state.file?.currentPathname || '';
        }
        return this.codeState.currentPath || '';
    }

    /**
     * Initialize file type handlers
     */
    initializeFileTypeHandlers() {
        return {
            // JavaScript files
            'js': {
                icon: '🟨',
                category: 'script',
                description: 'JavaScript Module',
                color: '#f7df1e',
                canParse: true,
                language: 'javascript'
            },
            'mjs': {
                icon: '🟨',
                category: 'script', 
                description: 'ES Module',
                color: '#f7df1e',
                canParse: true,
                language: 'javascript'
            },
            
            // HTML files
            'html': {
                icon: '🟧',
                category: 'markup',
                description: 'HTML Document',
                color: '#e34f26',
                canParse: true,
                language: 'html'
            },
            'htm': {
                icon: '🟧',
                category: 'markup',
                description: 'HTML Document',
                color: '#e34f26',
                canParse: true,
                language: 'html'
            },

            // CSS files
            'css': {
                icon: '🟦',
                category: 'style',
                description: 'Stylesheet',
                color: '#1572b6',
                canParse: true,
                language: 'css'
            },

            // Markdown files
            'md': {
                icon: '📝',
                category: 'document',
                description: 'Markdown Document',
                color: '#083fa1',
                canParse: false,
                language: 'markdown'
            },

            // Shell scripts
            'sh': {
                icon: '⚫',
                category: 'script',
                description: 'Shell Script',
                color: '#89e051',
                canParse: true,
                language: 'bash'
            },

            // Config files
            'json': {
                icon: '🔧',
                category: 'config',
                description: 'JSON Data',
                color: '#000000',
                canParse: true,
                language: 'json'
            },

            // DevPages specific
            'devpage': {
                icon: '📋',
                category: 'devpages',
                description: 'DevPage Definition',
                color: '#6f42c1',
                canParse: false,
                language: 'json'
            }
        };
    }

    /**
     * Load files for current path
     */
    async loadFiles(path = '', options = { source: 'internal' }) {
        this.codeState.loading = true;
        this.render(); // Show loading state

        const targetPath = path || this.getCurrentPath();
        
        try {
            this.log(`Loading files for path: '${targetPath}'`, 'debug');

            // Simulate API call to get file listing
            // In real implementation, this would call the server API
            const response = await this.fetchFileListing(targetPath);
            
            if (response && response.dirs && response.files) {
                this.codeState.directories = response.dirs || [];
                this.codeState.files = response.files || [];
                this.codeState.currentPath = targetPath;
                
                this.log(`Loaded ${this.codeState.directories.length} directories and ${this.codeState.files.length} files`, 'debug');
            } else {
                this.codeState.directories = [];
                this.codeState.files = [];
            }
        } catch (error) {
            this.log(`Error loading files: ${error.message}`, 'error');
            this.codeState.directories = [];
            this.codeState.files = [];
        } finally {
            this.codeState.loading = false;
            this.render();
        }
    }

    /**
     * Fetch file listing from server (placeholder)
     */
    async fetchFileListing(path) {
        // This is a placeholder - in real implementation this would
        // call the actual API endpoint
        if (window.api && typeof window.api.getFileList === 'function') {
            return await window.api.getFileList(path);
        }
        
        // Fallback: try to get from app state
        const state = window.appStore?.getState();
        const currentListing = state?.file?.currentListing;
        
        if (currentListing && currentListing.pathname === path) {
            return {
                dirs: currentListing.dirs || [],
                files: currentListing.files || []
            };
        }
        
        // Default empty response
        return { dirs: [], files: [] };
    }

    /**
     * Render the code panel content
     */
    render() {
        if (!this.contentElement) return;

        if (this.codeState.loading) {
            this.contentElement.innerHTML = `
                <div class="panel-loading">
                    <div class="loading-spinner"></div>
                    <div>Loading files...</div>
                </div>
            `;
            this.applyPanelStyles();
            return;
        }

        const { directories, files } = this.codeState;
        
        if (directories.length === 0 && files.length === 0) {
            this.contentElement.innerHTML = `
                <div class="panel-empty">
                    <div class="empty-icon">📁</div>
                    <div>No files found</div>
                    <div class="empty-hint">Check your current directory path</div>
                </div>
            `;
            this.applyPanelStyles();
            return;
        }

        // Build file list HTML
        let fileListHTML = '';

        // Add directories first
        directories.forEach(dirName => {
            fileListHTML += this.createFileItemHTML(dirName, 'directory');
        });

        // Add files
        files.forEach(fileName => {
            fileListHTML += this.createFileItemHTML(fileName, 'file');
        });

        this.contentElement.innerHTML = `
            <div class="file-list-container">
                ${fileListHTML}
            </div>
        `;

        this.applyPanelStyles();
    }

    /**
     * Create HTML for a file/directory item
     */
    createFileItemHTML(name, type) {
        const isDirectory = type === 'directory';
        const extension = isDirectory ? null : name.split('.').pop().toLowerCase();
        const fileInfo = this.getFileInfo(name, type);
        
        const icon = isDirectory ? '📁' : (fileInfo.icon || '📄');
        const displayName = isDirectory ? name : name;
        
        return `
            <div class="file-item file-item-${type}" 
                 data-name="${name}" 
                 data-type="${type}"
                 title="${fileInfo.description || (isDirectory ? 'Directory' : 'File')}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${displayName}</span>
                ${isDirectory ? '' : `<span class="file-ext">.${extension || ''}</span>`}
            </div>
        `;
    }

    /**
     * Get file information based on extension
     */
    getFileInfo(fileName, type) {
        if (type === 'directory') {
            return {
                icon: '📁',
                description: 'Directory',
                category: 'directory'
            };
        }

        const extension = fileName.split('.').pop().toLowerCase();
        return this.fileTypeHandlers[extension] || {
            icon: '📄',
            description: 'File',
            category: 'unknown',
            color: '#6c757d'
        };
    }

    /**
     * Apply panel-specific styles
     */
    applyPanelStyles() {
        if (!this.contentElement) return;

        // Add styles for the code panel
        const style = document.createElement('style');
        style.textContent = `
            .panel-code .file-list-container {
                height: 100%;
                overflow-y: auto;
            }
            
            .panel-code .file-item {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                cursor: pointer;
                border-radius: 3px;
                margin: 1px 0;
                font-size: 13px;
                color: #333;
                transition: background-color 0.15s ease;
                user-select: none;
            }
            
            .panel-code .file-item:hover {
                background-color: #e9ecef;
            }
            
            .panel-code .file-item:active {
                background-color: #dee2e6;
            }
            
            .panel-code .file-icon {
                margin-right: 8px;
                width: 16px;
                text-align: center;
                font-size: 12px;
                opacity: 0.8;
            }
            
            .panel-code .file-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                line-height: 1.3;
            }
            
            .panel-code .file-ext {
                font-size: 11px;
                color: #6c757d;
                opacity: 0.7;
            }
            
            .panel-code .file-item-directory {
                font-weight: 500;
            }
            
            .panel-code .file-item-directory .file-name {
                color: #495057;
            }
            
            .panel-code .file-item-file .file-name {
                color: #6c757d;
            }
            
            .panel-code .panel-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100px;
                color: #6c757d;
                font-style: italic;
            }
            
            .panel-code .loading-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 8px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .panel-code .panel-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 150px;
                color: #6c757d;
                text-align: center;
            }
            
            .panel-code .empty-icon {
                font-size: 32px;
                margin-bottom: 8px;
                opacity: 0.5;
            }
            
            .panel-code .empty-hint {
                font-size: 11px;
                opacity: 0.7;
                margin-top: 4px;
            }
        `;
        
        // Add class to content element
        this.contentElement.classList.add('panel-code');
        
        // Append style if not already present
        if (!document.head.querySelector('style[data-code-panel]')) {
            style.setAttribute('data-code-panel', 'true');
            document.head.appendChild(style);
        }
    }

    /**
     * Handle click events on file/directory items
     */
    handleClick(event) {
        const fileItem = event.target.closest('.file-item');
        if (!fileItem) return;

        const name = fileItem.dataset.name;
        const type = fileItem.dataset.type;

        this.log(`File item clicked: ${name} (${type})`, 'debug');

        if (type === 'directory') {
            this.handleDirectoryClick(name);
        } else if (type === 'file') {
            this.handleFileClick(name);
        }
    }

    /**
     * Handle directory click
     */
    handleDirectoryClick(dirName) {
        this.log(`Opening directory: ${dirName}`, 'debug');
        
        const currentPath = this.getCurrentPath();
        const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        
        // Emit navigation event
        if (eventBus) {
            eventBus.emit('navigate:pathname', { 
                pathname: newPath, 
                isDirectory: true 
            });
        }
    }

    /**
     * Handle file click
     */
    handleFileClick(fileName) {
        this.log(`Opening file: ${fileName}`, 'debug');
        
        const currentPath = this.getCurrentPath();
        const newPath = currentPath ? `${currentPath}/${fileName}` : fileName;
        
        // Emit navigation event
        if (eventBus) {
            eventBus.emit('navigate:pathname', { 
                pathname: newPath, 
                isDirectory: false 
            });
        }
    }

    /**
     * Refresh file list
     */
    refresh() {
        this.log('Refreshing file list', 'debug');
        this.loadFiles();
    }

    /**
     * Called when panel is mounted
     */
    onMount() {
        this.log('CodePanel mounted', 'info');
        this.loadFiles(); // Load initial file list
    }

    /**
     * Called when panel is shown
     */
    onShow() {
        this.log('CodePanel shown', 'debug');
        this.refresh(); // Refresh when shown
    }

    /**
     * Called when panel is hidden
     */
    onHide() {
        this.log('CodePanel hidden', 'debug');
    }

    /**
     * Called when panel is resized
     */
    onResize() {
        this.log(`CodePanel resized to ${this.state.width}px`, 'debug');
    }
} 