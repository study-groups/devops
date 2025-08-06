/**
 * CodePanel.js - Code file browser integrated as a panel
 * REFACTORED to use the new PanelInterface.
 */

import { BasePanel } from './BasePanel.js';
import { appStore } from '/client/appState.js';
import eventBus from '/client/eventBus.js';
import { getCurrentPathname } from '../store/selectors.js';

export class CodePanel extends BasePanel {
    constructor(options = {}) {
        super(options);

        this.codeState = {
            currentPath: '',
            directories: [],
            files: [],
            fileInfoCache: new Map(),
            fileStatsCache: new Map(),
            loading: false
        };

        this.fileTypeHandlers = this.initializeFileTypeHandlers();
        this.storeUnsubscribe = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'code-panel-content';
        this.updateContentElement();
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        this.loadFiles();
        
        // BETTER REDUX PATTERN: Use selectors instead of direct state access
        let prevState = appStore.getState();
        let prevPathname = getCurrentPathname(prevState);
        
        this.storeUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            const newPathname = getCurrentPathname(newState);
            
            if (newPathname !== prevPathname) {
                this.handleFileChange(newPathname);
                prevPathname = newPathname;
            }
            prevState = newState;
        });

        eventBus.on('path:changed', this.handleExternalPathChange.bind(this));
        this.element.addEventListener('click', this.handleClick.bind(this));
    }

    onUnmount() {
        super.onUnmount();
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        eventBus.off('path:changed', this.handleExternalPathChange.bind(this));
    }

    handleFileChange(newPath) {
        this.codeState.currentPath = newPath || '';
        this.loadFiles();
    }

    handleExternalPathChange(eventData) {
        const newPath = eventData?.path || '';
        if (newPath !== this.codeState.currentPath) {
            this.codeState.currentPath = newPath;
            this.loadFiles();
        }
    }

    getCurrentPath() {
        const state = appStore.getState();
        return getCurrentPathname(state); // Uses selector with built-in defensive programming
    }

    async loadFiles(path = '') {
        this.codeState.loading = true;
        this.updateContentElement();

        const targetPath = path || this.getCurrentPath();
        
        try {
            const response = await this.fetchFileListing(targetPath);
            
            if (response && response.dirs && response.files) {
                this.codeState.directories = response.dirs || [];
                this.codeState.files = response.files || [];
                this.codeState.currentPath = targetPath;
            } else {
                this.codeState.directories = [];
                this.codeState.files = [];
            }
        } catch (error) {
            console.error(`Error loading files: ${error.message}`);
            this.codeState.directories = [];
            this.codeState.files = [];
        } finally {
            this.codeState.loading = false;
            this.updateContentElement();
        }
    }

    async fetchFileListing(path) {
        if (window.api && typeof window.api.getFileList === 'function') {
            return await window.api.getFileList(path);
        }
        return { dirs: [], files: [] };
    }

    updateContentElement() {
        if (!this.element) return;

        if (this.codeState.loading) {
            this.element.innerHTML = `<div class="panel-loading"><div class="loading-spinner"></div><div>Loading files...</div></div>`;
            return;
        }

        const { directories, files } = this.codeState;
        
        if (directories.length === 0 && files.length === 0) {
            this.element.innerHTML = `<div class="panel-empty"><div class="empty-icon">📁</div><div>No files found</div></div>`;
            return;
        }

        let fileListHTML = '';
        directories.forEach(dirName => {
            fileListHTML += this.createFileItemHTML(dirName, 'directory');
        });
        files.forEach(fileName => {
            fileListHTML += this.createFileItemHTML(fileName, 'file');
        });

        this.element.innerHTML = `<div class="file-list-container">${fileListHTML}</div>`;
    }

    createFileItemHTML(name, type) {
        const isDirectory = type === 'directory';
        const fileInfo = this.getFileInfo(name, type);
        const icon = isDirectory ? '📁' : (fileInfo.icon || '📄');
        
        return `
            <div class="file-item file-item-${type}" data-name="${name}" data-type="${type}" title="${fileInfo.description || name}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${name}</span>
            </div>
        `;
    }

    getFileInfo(fileName, type) {
        if (type === 'directory') {
            return { icon: '📁', description: 'Directory', category: 'directory' };
        }
        const extension = fileName.split('.').pop().toLowerCase();
        return this.fileTypeHandlers[extension] || { icon: '📄', description: 'File', category: 'unknown' };
    }

    handleClick(event) {
        const fileItem = event.target.closest('.file-item');
        if (!fileItem) return;

        const name = fileItem.dataset.name;
        const type = fileItem.dataset.type;

        if (type === 'directory') {
            this.handleDirectoryClick(name);
        } else if (type === 'file') {
            this.handleFileClick(name);
        }
    }

    handleDirectoryClick(dirName) {
        const currentPath = this.getCurrentPath();
        const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        eventBus.emit('navigate:pathname', { pathname: newPath, isDirectory: true });
    }

    handleFileClick(fileName) {
        const currentPath = this.getCurrentPath();
        const newPath = currentPath ? `${currentPath}/${fileName}` : fileName;
        eventBus.emit('navigate:pathname', { pathname: newPath, isDirectory: false });
    }

    initializeFileTypeHandlers() {
        return {
            'js': { icon: '🟨', description: 'JavaScript Module' },
            'mjs': { icon: '🟨', description: 'ES Module' },
            'html': { icon: '🟧', description: 'HTML Document' },
            'css': { icon: '🟦', description: 'Stylesheet' },
            'md': { icon: '📝', description: 'Markdown Document' },
            'sh': { icon: '⚫', description: 'Shell Script' },
            'json': { icon: '🔧', description: 'JSON Data' },
            'devpage': { icon: '📋', description: 'DevPage Definition' }
        };
    }
}
