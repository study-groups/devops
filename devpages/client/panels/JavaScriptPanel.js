/**
 * JavaScriptPanel.js - JavaScript code preview panel component for DevPages
 * Handles displaying and syntax highlighting JavaScript files
 */

import { eventBus } from '/client/eventBus.js';
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { HighlightPlugin } from '/client/preview/plugins/highlight.js';

export class JavaScriptPanel extends BasePanel {
    constructor(options = {}) {
        super(options.id || 'javascript-panel', options);

        // JavaScript panel specific state
        this.jsState = {
            isRendering: false,
            lastContent: '',
            lastFilePath: '',
            renderQueue: [],
            debounceTimer: null
        };
        this.highlightPlugin = new HighlightPlugin();
    }

    /**
     * Initialize the JavaScript panel
     */
    async initialize() {
        if (this.initialized) return true;

        await this.highlightPlugin.init();
        
        this.initialized = true;
        this.log('JavaScriptPanel initialized successfully', 'info');
        return true;
    }

    async init() {
        super.init();
        let prevState = appStore.getState(); // Initialize previous state
        // Subscribe to state changes
        this.storeUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            this.handleStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });
    }

    /**
     * Dynamically load the panel's CSS
     */
    loadCSS() {
        const cssPath = '/client/panels/styles/JavaScriptPanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            this.log('JavaScriptPanel CSS loaded.', 'info');
        }
    }

    /**
     * Render panel content
     */
    renderContent() {
        return `
            <div class="javascript-panel-content">
                <div class="javascript-panel-header">
                    <div class="file-info">
                        <span class="file-icon">📄</span>
                        <span class="file-name" id="js-file-name">JavaScript File</span>
                        <span class="file-size" id="js-file-size"></span>
                    </div>
                    <div class="panel-actions">
                        <button class="copy-code-btn" id="copy-code-btn" title="Copy code to clipboard">
                            📋 Copy
                        </button>
                    </div>
                </div>
                <div id="javascript-preview" class="javascript-preview js-content" data-js-content>
                    <div class="js-loading-state" data-visible="false">
                        <div class="loading-spinner"></div>
                        <div>Loading JavaScript...</div>
                    </div>
                    <pre class="javascript-code-block"><code class="language-javascript" id="js-code-content"></code></pre>
                </div>
            </div>
        `;
    }

    /**
     * Setup after DOM creation
     */
    async onMount() {
        await super.onMount();
        this.loadCSS();
        this.log('[PANEL_DEBUG] JavaScriptPanel onMount hook executed.', 'debug');

        // Get the JavaScript container and elements
        this.jsContainer = this.contentElement.querySelector('#javascript-preview');
        this.codeElement = this.contentElement.querySelector('#js-code-content');
        this.fileNameElement = this.contentElement.querySelector('#js-file-name');
        this.fileSizeElement = this.contentElement.querySelector('#js-file-size');
        this.copyButton = this.contentElement.querySelector('#copy-code-btn');
        
        // Setup copy functionality
        this.setupCopyButton();
        
        // Subscribe to app state changes to handle file updates
        this.setupStateSubscription();

        this.log('JavaScriptPanel fully mounted and configured.', 'info');
    }

    /**
     * Setup copy button functionality
     */
    setupCopyButton() {
        if (this.copyButton) {
            this.copyButton.addEventListener('click', async () => {
                try {
                    const code = this.codeElement.textContent;
                    await navigator.clipboard.writeText(code);
                    
                    // Visual feedback
                    const originalText = this.copyButton.textContent;
                    this.copyButton.textContent = '✅ Copied!';
                    this.copyButton.classList.add('copied');
                    
                    setTimeout(() => {
                        this.copyButton.textContent = originalText;
                        this.copyButton.classList.remove('copied');
                    }, 2000);
                    
                    this.log('Code copied to clipboard', 'info');
                } catch (error) {
                    this.log(`Failed to copy code: ${error.message}`, 'error');
                    
                    // Fallback visual feedback
                    const originalText = this.copyButton.textContent;
                    this.copyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        this.copyButton.textContent = originalText;
                    }, 2000);
                }
            });
        }
    }

    /**
     * Setup state subscription to handle content updates
     */
    setupStateSubscription() {
        this.storeUnsubscribe = null;
        this.lastRenderedPath = null;
        let prevState = appStore.getState(); // Initialize previous state
        this.storeUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            this.handleStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });
    }

    /**
     * Handle app state changes
     */
    handleStateChange(newState, prevState) {
        const currentFile = newState.file;
        
        // Check if we need to render JavaScript content
        if (currentFile && currentFile.content !== undefined) {
            const filePath = currentFile.currentPathname || '';
            const isJavaScriptFile = this.isJavaScriptFile(filePath);
            
            if (isJavaScriptFile && currentFile.content !== this.jsState.lastContent) {
                this.updateJavaScriptPreview(currentFile.content, filePath);
            }
        }
    }

    /**
     * Check if file is a JavaScript file
     */
    isJavaScriptFile(filePath) {
        const jsExtensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx'];
        return jsExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    /**
     * Update JavaScript preview with debouncing
     */
    async updateJavaScriptPreview(content, filePath) {
        // Skip if content hasn't changed
        if (content === this.jsState.lastContent && filePath === this.jsState.lastFilePath) {
            return;
        }

        // Clear previous debounce
        if (this.jsState.debounceTimer) {
            clearTimeout(this.jsState.debounceTimer);
        }

        // Debounce the update
        this.jsState.debounceTimer = setTimeout(async () => {
            await this.performJavaScriptUpdate(content, filePath);
        }, 150);
    }

    /**
     * Perform the actual JavaScript preview update
     */
    async performJavaScriptUpdate(content, filePath) {
        if (this.jsState.isRendering) {
            this.log('Already rendering, queuing update');
            this.jsState.renderQueue.push({ content, filePath });
            return;
        }

        this.jsState.isRendering = true;
        this.jsState.lastContent = content;
        this.jsState.lastFilePath = filePath;

        try {
            this.log(`Rendering JavaScript file: ${filePath} (content length: ${content.length})`);
            
            // Update file info
            this.updateFileInfo(filePath, content);
            
            // Show loading state
            this.showLoadingState();

            // Set the raw code content first
            this.codeElement.textContent = content;
            
            // Apply syntax highlighting if plugin is ready
            if (this.highlightPlugin.isReady()) {
                this.highlightPlugin.hljs.highlightElement(this.codeElement);
                this.log(`Applied syntax highlighting`);
            } else {
                this.log('Highlight plugin not ready, showing plain text', 'warn');
            }
            
            this.log('JavaScript preview updated successfully');
            this.showSuccessState();

        } catch (error) {
            this.log(`JavaScript render failed: ${error.message}`, 'error');
            console.error('JavaScript render error:', error);
            this.showErrorState(error.message);
        } finally {
            this.jsState.isRendering = false;
            
            // Process the next item in the queue
            if (this.jsState.renderQueue.length > 0) {
                const next = this.jsState.renderQueue.shift();
                this.performJavaScriptUpdate(next.content, next.filePath);
            }
        }
    }

    /**
     * Get language identifier from file path
     */
    getLanguageFromPath(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        const languageMap = {
            'js': 'javascript',
            'mjs': 'javascript', 
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript'
        };
        return languageMap[extension] || 'javascript';
    }

    /**
     * Update file information display
     */
    updateFileInfo(filePath, content) {
        if (this.fileNameElement) {
            const fileName = filePath.split('/').pop() || 'JavaScript File';
            this.fileNameElement.textContent = fileName;
        }
        
        if (this.fileSizeElement) {
            const size = new Blob([content]).size;
            const sizeStr = size < 1024 ? `${size} B` : 
                           size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` :
                           `${(size / (1024 * 1024)).toFixed(1)} MB`;
            this.fileSizeElement.textContent = sizeStr;
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        if (!this.jsContainer) return;
        
        const loadingState = this.jsContainer.querySelector('.js-loading-state');
        if (loadingState) {
            loadingState.dataset.visible = 'true';
        }
        
        this.jsContainer.classList.add('js-updating');
    }

    /**
     * Show error state
     */
    showErrorState(message) {
        if (!this.jsContainer) return;
        
        this.jsContainer.classList.remove('js-updating', 'js-success');
        this.jsContainer.classList.add('js-error-state');
        
        const errorHtml = `
            <div class="js-error">
                <div class="js-error__icon">⚠️</div>
                <div class="js-error__content">
                    <h4>JavaScript Render Error</h4>
                    <p>${message}</p>
                    <button class="js-error__retry" onclick="this.closest('.javascript-preview').dataset.forceRefresh = 'true'; window.dispatchEvent(new CustomEvent('js:retry'))">
                        Retry
                    </button>
                </div>
            </div>
        `;
        
        this.jsContainer.innerHTML = errorHtml;
    }

    /**
     * Show success state
     */
    showSuccessState() {
        if (!this.jsContainer) return;
        
        this.jsContainer.classList.remove('js-updating', 'js-error-state');
        this.jsContainer.classList.add('js-success');
        
        // Hide loading state
        const loadingState = this.jsContainer.querySelector('.js-loading-state');
        if (loadingState) {
            loadingState.dataset.visible = 'false';
        }
        
        // Remove success class after animation
        setTimeout(() => {
            if (this.jsContainer) {
                this.jsContainer.classList.remove('js-success');
            }
        }, 300);
    }

    /**
     * Panel cleanup
     */
    cleanup() {
        this.log('JavaScriptPanel cleanup', 'debug');
        
        // Clear timers
        if (this.jsState.debounceTimer) {
            clearTimeout(this.jsState.debounceTimer);
        }
        
        // Clear state subscription
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        
        super.cleanup();
    }
} 