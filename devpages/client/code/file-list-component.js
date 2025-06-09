/**
 * File List Component for DevPages Code Editor
 * Provides card-like UI with strong file type awareness
 */

import eventBus from '/client/eventBus.js'; // Ensure this import is present and correct
// import { analyzeJavaScript } from './ast-parser.js'; // Remove this import

class FileListComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = {
            showPath: true,
            showDevPageNotice: true,
            ...options
        };
        this.currentPath = '';
        this.directories = [];
        this.files = [];
        this.fileInfoCache = new Map();
        this.fileStatsCache = new Map(); // Cache for file stats (like .devpage presence)

        this.eventHandlers = {}; // For more structured event handling

        this.log('[FileListComponent] Instantiated.');

        // Bind methods that will be used as callbacks or event handlers
        // this.handleFileClick = this.handleFileClick.bind(this);
        // this.handleDirectoryClick = this.handleDirectoryClick.bind(this);
        // this.handleDevPageNoticeClick = this.handleDevPageNoticeClick.bind(this);
        // this.handleExternalPathChange = this.handleExternalPathChange.bind(this); 

        this.fileTypeHandlers = this.initializeFileTypeHandlers(); // Correctly assign here
        this.init();
    }

    log(message, level = 'info') {
        const prefix = '[FileList]';
        if (window.logMessage) {
            window.logMessage(`${prefix} ${message}`, level, 'FILELIST');
        } else {
            console[level] ? console[level](`${prefix} ${message}`) : console.log(`${prefix} ${message}`);
        }
    }

    init() {
        if (!this.container) {
            this.log('Container not found', 'error');
            return;
        }
        this.log('Initializing...');
        this.render(); // Initial render (likely empty or with root)

        // Subscribe to external path changes using the IMPORTED eventBus
        this.log(`Attempting to subscribe. Imported eventBus object: ${eventBus === undefined ? 'undefined' : (eventBus === null ? 'null' : 'exists')}`, 'debug');
        if (eventBus) {
            this.log(`Typeof eventBus.on: ${typeof eventBus.on}`, 'debug');
        }

        if (eventBus && typeof eventBus.on === 'function') {
            this.log('Subscribing to "path:changed" on imported eventBus.', 'debug');
            eventBus.on('path:changed', this.handleExternalPathChange);
        } else if (window.eventBus && typeof window.eventBus.on === 'function') {
            // Fallback or warning if imported eventBus is not available but window.eventBus is
            this.log('Imported eventBus not available or "on" method missing. Attempting to use window.eventBus as a fallback.', 'warn');
            if (window.eventBus) {
                this.log(`Fallback: Typeof window.eventBus.on: ${typeof window.eventBus.on}`, 'debug');
            }
            window.eventBus.on('path:changed', this.handleExternalPathChange);
             this.log('Subscribed to "path:changed" on window.eventBus (fallback).', 'debug');
        } else {
            this.log('Neither imported eventBus nor window.eventBus is available for "path:changed" subscription. Imported eventBus was ' + (eventBus ? 'defined but not a valid bus' : 'undefined/null') + '. Window.eventBus was ' + (window.eventBus ? 'defined but not a valid bus' : 'undefined/null') + '.', 'error');
        }

        // Attach event listeners to the container for delegation
        this.container.addEventListener('click', (event) => {
            const card = event.target.closest('.file-card');
            const devPageNotice = event.target.closest('.devpage-notice');

            if (devPageNotice) {
                this.handleDevPageNoticeClick(devPageNotice);
                return;
            }

            if (card) {
                const type = card.dataset.type;
                const name = card.dataset.name;
                console.log(`[FileList Debug] Delegated click on card. Type: ${type}, Name: ${name}`);
                if (type === 'directory') {
                    this.handleDirectoryClick(name, card);
                } else if (type === 'file') {
                    console.log(`[FileList Debug] Delegated click IS FILE. Calling handleFileClick for: ${name}`);
                    this.handleFileClick(name, card);
                }
            }
        });
        this.log('Initialization complete and event listeners attached.');
    }

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
            'bash': {
                icon: '⚫',
                category: 'script',
                description: 'Bash Script',
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
            'devpages.json': {
                icon: '⚙️',
                category: 'config',
                description: 'DevPages Config',
                color: '#007bff',
                canParse: true,
                language: 'json'
            },

            // DevPages specific
            'devpage': {
                icon: '📋',
                category: 'devpages',
                description: 'DevPage Definition',
                color: '#6f42c1',
                canParse: true,
                language: 'yaml'
            }
        };
    }

    getFileInfo(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const fullName = filename.toLowerCase();
        
        // Check for specific filenames first
        if (this.fileTypeHandlers[fullName]) {
            return this.fileTypeHandlers[fullName];
        }
        
        // Then check extensions
        if (this.fileTypeHandlers[ext]) {
            return this.fileTypeHandlers[ext];
        }
        
        // Default for unknown types
        return {
            icon: '📄',
            category: 'unknown',
            description: 'Unknown File',
            color: '#6c757d',
            canParse: false,
            language: 'text'
        };
    }

    handleExternalPathChange = (eventData) => {
        this.log(`[HANDLE_EXTERNAL_PATH_CHANGE] Triggered. Raw eventData type: ${typeof eventData}`, 'debug');
        if (typeof eventData === 'object' && eventData !== null) {
            this.log(`[HANDLE_EXTERNAL_PATH_CHANGE] eventData.newPath: ${eventData.newPath}, eventData.source: ${eventData.source}`, 'debug');
        } else {
            this.log(`[HANDLE_EXTERNAL_PATH_CHANGE] eventData (primitive): ${eventData}`, 'debug');
        }

        const newPath = typeof eventData === 'object' && eventData !== null && eventData.newPath !== undefined ? eventData.newPath : eventData;
        this.log(`[HANDLE_EXTERNAL_PATH_CHANGE] Extracted newPath: "${newPath}", Current path: "${this.currentPath}"`, 'debug');

        // Ignore events emitted by this component itself if they somehow loop back
        if (typeof eventData === 'object' && eventData.source === 'fileListComponent') {
            this.log('[FileList] Ignored event from self (fileListComponent).', 'debug');
            return;
        }

        if (newPath !== undefined) {
            // Smart path handling: if newPath is a file, extract its directory
            let targetPath = newPath;
            if (newPath && /\.[^/]+$/.test(newPath)) {
                // This is a file path, extract the directory
                targetPath = newPath.substring(0, newPath.lastIndexOf('/'));
                this.log(`[HANDLE_EXTERNAL_PATH_CHANGE] File path detected (${newPath}), using directory: "${targetPath}"`, 'debug');
            }
            
            if (targetPath !== this.currentPath) {
                this.log(`[HANDLE_EXTERNAL_PATH_CHANGE] Path is different. Loading files for: "${targetPath}"`, 'debug');
                this.loadFiles(targetPath, { source: 'external' });
            } else {
                this.log('[HANDLE_EXTERNAL_PATH_CHANGE] Path is same as current. Not reloading.', 'debug');
            }
        } else {
            this.log('[HANDLE_EXTERNAL_PATH_CHANGE] Path is undefined. Not reloading.', 'debug');
        }
    }

    async loadFiles(path = '', options = { source: 'internal' }) {
        const requestPath = typeof path === 'string' ? path : '';
        
        // 🛡️ HANDLE FILE PATHS GRACEFULLY (Expected behavior when receiving file paths)
        if (requestPath && /\.[^/]+$/.test(requestPath)) {
            console.log(`[FileList] INFO: Received file path: ${requestPath}`);
            console.log(`[FileList] Auto-correcting to directory listing for parent directory`);
            
            // Extract directory from file path
            const dirPath = requestPath.substring(0, requestPath.lastIndexOf('/'));
            console.log(`[FileList] Loading parent directory: ${dirPath}`);
            
            // Load the directory containing the file
            return this.loadFiles(dirPath, options);
        }
        
            this.currentPath = requestPath;
        this.log(`Loading files for path: "${requestPath}"`, 'debug');
        this.container.innerHTML = '<div class="loading-indicator">Loading...</div>';

        try {
            const response = await fetch(`/api/files/list?pathname=${encodeURIComponent(requestPath)}`);
            if (!response.ok) {
                const errorText = await response.text();
                this.log(`Error loading files: ${response.status} ${errorText}`, 'error');
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            const data = await response.json();
            this.directories = data.dirs || [];
            this.files = data.files || [];
            
            this.render();
        } catch (error) {
            console.error('[FileList] Error loading files:', error);
            this.renderError(error.message);
        }
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="file-list-header">
                <div class="file-list-path">${this.currentPath || 'Root'}</div>
            </div>
            <div class="file-list-grid">
                ${this.renderDirectories()}
                ${this.renderFiles()}
            </div>
        `;

        this.attachEventListeners();
    }

    renderDirectories() {
        return this.directories.map(dir => `
            <div class="file-card" data-type="directory" data-name="${dir}">
                <div class="file-indicator">D</div>
                <div class="file-card-content">
                    <div class="file-card-name" title="${dir}">${dir}</div>
                    <div class="file-card-info">Directory</div>
                </div>
            </div>
        `).join('');
    }

    renderFiles() {
        return this.files.map(file => {
            const fileInfo = this.getFileInfo(file);
            const stats = this.getFileStats(file);
            
            // Combine description and size for file-card-info
            let infoText = fileInfo.description;
            if (stats.size) {
                infoText += ` - ${stats.size}`;
            }

            return `
                <div class="file-card" 
                     data-type="file" 
                     data-name="${file}"
                     data-language="${fileInfo.language}"
                     data-can-parse="${fileInfo.canParse}">
                    
                    <div class="file-indicator">F</div>
                    
                    <div class="file-card-content">
                        <div class="file-card-name" title="${file}">${file}</div>
                        <div class="file-card-info">${infoText}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getFileStats(filename) {
        // Placeholder for file statistics
        // In a real implementation, this would come from the API
        return {
            size: Math.floor(Math.random() * 50) + 'KB', // Mock size
            lines: Math.floor(Math.random() * 500) + 50   // Mock line count
        };
    }

    attachEventListeners() {
        const cards = this.container.querySelectorAll('.file-card');
        
        cards.forEach(card => {
            const name = card.dataset.name;
            const type = card.dataset.type;
            
            // Double-click to open
            card.addEventListener('dblclick', () => {
                if (type === 'directory') {
                    this.openDirectory(name);
                } else {
                    this.openFile(name);
                }
            });
            
            // Action buttons
            const actionButtons = card.querySelectorAll('.file-action-btn');
            actionButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    this.handleAction(action, name, type, card);
                });
            });
        });
    }

    handleAction(action, name, type, card) {
        console.log(`[FileList] Action: ${action} on ${type}: ${name}`);
        
        switch (action) {
            case 'open':
                if (type === 'directory') {
                    this.openDirectory(name);
                }
                break;
                
            case 'edit':
                if (type === 'file') {
                    this.openFile(name);
                }
                break;
                
            case 'analyze':
                if (type === 'file') {
                    this.analyzeFile(name, card);
                }
                break;
                
            case 'info':
                this.showFileInfo(name, type, card);
                break;
        }
    }

    async openDirectory(dirName) {
        const newPath = this.currentPath ? `${this.currentPath}/${dirName}` : dirName;
        await this.loadFiles(newPath);
    }

    async openFile(filename) {
        try {
            const fullPath = this.currentPath ? `${this.currentPath}/${filename}` : filename;
            console.log('[FileList] Opening file:', fullPath);
            
            // Emit file open event
            if (window.eventBus) {
                window.eventBus.emit('file:open', {
                    filename: fullPath,
                    type: 'edit'
                });
            }
            
            // Also try the existing file loading mechanism
            if (window.triggerActions && window.triggerActions.loadFile) {
                window.triggerActions.loadFile({ filename: fullPath });
            }
        } catch (error) {
            console.error('[FileList] Error opening file:', error);
        }
    }

    async analyzeFile(filename, card) {
        try {
            const fullPath = this.currentPath ? `${this.currentPath}/${filename}` : filename;
            console.log('[FileList] Analyzing file:', fullPath);
            
            // Add loading indicator
            const analyzeBtn = card.querySelector('[data-action="analyze"]');
            const originalContent = analyzeBtn.innerHTML;
            analyzeBtn.innerHTML = '⏳';
            analyzeBtn.disabled = true;
            
            // Emit analysis request
            if (window.eventBus) {
                window.eventBus.emit('file:analyze', {
                    filename: fullPath,
                    language: card.dataset.language
                });
            }
            
            // Restore button after delay
            setTimeout(() => {
                analyzeBtn.innerHTML = originalContent;
                analyzeBtn.disabled = false;
            }, 2000);
            
            // If it's a JavaScript file, try to fetch, parse, and log AST info
            if (filename.endsWith('.js')) {
                this.log(`JavaScript file selected: ${fullPath}. Attempting to analyze...`, 'debug');
                try {
                    // FIXED: Use /content for files
                    const response = await fetch(`/api/files/content?pathname=${encodeURIComponent(fullPath)}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status} for ${fullPath}`);
                    }
                    const fileContent = await response.text();
                    
                    this.log(`Content for ${fullPath} fetched. Length: ${fileContent.length}. Analyzing...`, 'debug');
                    const analysis = await window.DevPagesAstParser.analyzeJavaScript(fileContent);

                    console.log(`[AST Analysis for ${fullPath}]:`);
                    console.log('Functions found:', analysis.functions);
                    console.log('Objects found:', analysis.objects);
                    this.log(`Analysis complete for ${fullPath}. Functions: ${analysis.functions.length}, Objects: ${analysis.objects.length}`, 'info');

                    // Emit AST analysis complete event for other components
                    if (eventBus && typeof eventBus.emit === 'function') {
                        eventBus.emit('ast:analysis-complete', {
                            filename: fullPath,
                            functions: analysis.functions,
                            objects: analysis.objects,
                            source: 'file-list-component'
                        });
                    }

                } catch (error) {
                    console.error(`[FileList] Error fetching or analyzing JS file ${fullPath}:`, error);
                    this.log(`Error during JS file analysis for ${fullPath}: ${error.message}`, 'error');
                }
            }
        } catch (error) {
            console.error('[FileList] Error analyzing file:', error);
        }
    }

    showFileInfo(name, type, card) {
        const info = type === 'file' ? this.getFileInfo(name) : null;
        
        console.log('[FileList] File info:', {
            name,
            type,
            info,
            language: card?.dataset.language,
            canParse: card?.dataset.canParse
        });
        
        // Could show a modal or sidebar with detailed file information
        // For now, just log to console
    }

    renderError(message) {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="file-list-error">
                <div class="error-icon">⚠️</div>
                <div class="error-message">Error loading files: ${message}</div>
                <button class="retry-btn" onclick="window.fileList?.loadFiles('${this.currentPath}')">
                    Retry
                </button>
            </div>
        `;
    }

    // Method to handle clicks on file cards
    handleFileClick = async (fileName, cardElement) => {
        this.log(`File card clicked: ${fileName}`, 'info');
        const fullPath = this.currentPath ? `${this.currentPath}/${fileName}` : fileName;

        // Emit file selected event for general purpose use
        if (eventBus && typeof eventBus.emit === 'function') {
            eventBus.emit('file:selected', { 
                path: fullPath, 
                name: fileName, 
                type: 'file',
                language: cardElement.dataset.language,
                canParse: cardElement.dataset.canParse === 'true'
            });
        }

        // If it's a JavaScript file, try to fetch, parse, and log AST info
        if (fileName.endsWith('.js')) {
            this.log(`JavaScript file selected: ${fullPath}. Attempting to analyze...`, 'debug');
            try {
                // FIXED: Use /content for files
                const response = await fetch(`/api/files/content?pathname=${encodeURIComponent(fullPath)}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${fullPath}`);
                }
                const fileContent = await response.text();
                
                this.log(`Content for ${fullPath} fetched. Length: ${fileContent.length}. Analyzing...`, 'debug');
                const analysis = await window.DevPagesAstParser.analyzeJavaScript(fileContent);

                console.log(`[AST Analysis for ${fullPath}]:`);
                console.log('Functions found:', analysis.functions);
                console.log('Objects found:', analysis.objects);
                this.log(`Analysis complete for ${fullPath}. Functions: ${analysis.functions.length}, Objects: ${analysis.objects.length}`, 'info');

                // Emit AST analysis complete event for other components
                if (eventBus && typeof eventBus.emit === 'function') {
                    eventBus.emit('ast:analysis-complete', {
                        filename: fullPath,
                        functions: analysis.functions,
                        objects: analysis.objects,
                        source: 'file-list-component'
                    });
                }

            } catch (error) {
                console.error(`[FileList] Error fetching or analyzing JS file ${fullPath}:`, error);
                this.log(`Error during JS file analysis for ${fullPath}: ${error.message}`, 'error');
            }
        }
    }

    // Method to handle clicks on directory cards
    handleDirectoryClick = (dirName, cardElement) => {
        this.log(`Directory card clicked: ${dirName}`, 'info');
        const newPath = this.currentPath ? `${this.currentPath}/${dirName}` : dirName;
        this.loadFiles(newPath, { source: 'internalNavigation' }); 
        // We expect fileManager to emit the main 'path:changed' after this if path changes for TopBar
    }

    // Method to handle clicks on .devpage notice
    handleDevPageNoticeClick = (noticeElement) => {
        const filePath = noticeElement.dataset.filePath;
        this.log(`.devpage notice clicked for: ${filePath}`, 'info');
        if (eventBus && typeof eventBus.emit === 'function') {
            eventBus.emit('devpage:edit-request', { path: filePath });
        } else {
            this.log('Event bus not available to emit devpage:edit-request event.', 'warn');
        }
    }
}

// Initialize and export
// window.FileListComponent = FileListComponent; 
export default FileListComponent; 