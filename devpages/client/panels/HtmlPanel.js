/**
 * HtmlPanel.js - HTML preview panel component for DevPages
 * Handles displaying and rendering HTML files
 */

import { BasePanel } from './BasePanel.js';
import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { log } from '/client/log/index.js';

// Dynamically load the renderer only when needed.
let HtmlPreviewRenderer;
(async () => {
    try {
        const module = await import('/client/panels/renderers/HtmlPreviewRenderer.js');
        HtmlPreviewRenderer = module.HtmlPreviewRenderer;
    } catch (error) {
        log.error('Failed to load HtmlPreviewRenderer', error);
    }
})();

export class HtmlPanel extends BasePanel {
    constructor(options = {}) {
        super(options.id || 'html-panel', options);

        // HTML panel specific state
        this.htmlState = {
            isRendering: false,
            lastContent: '',
            lastFilePath: '',
            renderQueue: [],
            debounceTimer: null
        };
    }

    /**
     * Initialize the HTML panel
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            // Import HTML renderer and CSS
            await import('/client/panels/renderers/HtmlRenderer.js');
            
            // Load CSS if not already loaded
            if (!document.querySelector('link[href*="HtmlPanel.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '/client/panels/styles/HtmlPanel.css';
                document.head.appendChild(link);
            }
            
            this.initialized = true;
            this.log('HtmlPanel initialized successfully', 'info');
            return true;
        } catch (error) {
            this.log(`HtmlPanel initialization failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Dynamically load the panel's CSS
     */
    loadCSS() {
        const cssPath = '/client/panels/styles/HtmlPanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            this.log('HtmlPanel CSS loaded.', 'info');
        }
    }

    /**
     * Render panel content
     */
    renderContent() {
        return `
            <div class="html-panel-content">
                <div id="html-preview" class="html-preview html-content" data-html-content>
                    <div class="html-loading-state" style="display: none;">
                        <div class="loading-spinner"></div>
                        <div>Loading HTML...</div>
                    </div>
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
        this.log('[PANEL_DEBUG] HtmlPanel onMount hook executed.', 'debug');

        // Get the HTML container
        this.htmlContainer = this.contentElement.querySelector('#html-preview');
        
        // Subscribe to app state changes to handle file updates
        this.setupStateSubscription();

        this.log('HtmlPanel fully mounted and configured.', 'info');
    }

    /**
     * Setup state subscription to handle content updates
     */
    setupStateSubscription() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }

        this.storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            this.handleStateChange(newState, prevState);
        });
    }

    /**
     * Handle app state changes
     */
    handleStateChange(newState, prevState) {
        const currentFile = newState.file;
        
        // Check if we need to render HTML content
        if (currentFile && currentFile.content !== undefined) {
            const filePath = currentFile.currentPathname || '';
            const isHtmlFile = filePath.toLowerCase().endsWith('.html') || filePath.toLowerCase().endsWith('.htm');
            
            if (isHtmlFile && currentFile.content !== this.htmlState.lastContent) {
                this.updateHtmlPreview(currentFile.content, filePath);
            }
        }
    }

    /**
     * Update HTML preview with debouncing
     */
    async updateHtmlPreview(content, filePath) {
        // Skip if content hasn't changed
        if (content === this.htmlState.lastContent && filePath === this.htmlState.lastFilePath) {
            return;
        }

        // Clear previous debounce
        if (this.htmlState.debounceTimer) {
            clearTimeout(this.htmlState.debounceTimer);
        }

        // Debounce the update
        this.htmlState.debounceTimer = setTimeout(async () => {
            await this.performHtmlUpdate(content, filePath);
        }, 150);
    }

    /**
     * Perform the actual HTML preview update
     */
    async performHtmlUpdate(content, filePath) {
        if (this.htmlState.isRendering) {
            this.log('Already rendering, queuing update');
            this.htmlState.renderQueue.push({ content, filePath });
            return;
        }

        this.htmlState.isRendering = true;
        this.htmlState.lastContent = content;
        this.htmlState.lastFilePath = filePath;

        try {
            this.log(`Rendering HTML file: ${filePath} (content length: ${content.length})`);
            
            // Show loading state
            this.showLoadingState();

            // Import and use HTML renderer
            const { HtmlRenderer } = await import('/client/panels/renderers/HtmlRenderer.js');
            
            // Clean up any existing renderer first
            if (this.currentRenderer && typeof this.currentRenderer.destroy === 'function') {
                this.currentRenderer.destroy();
            }
            
            this.currentRenderer = new HtmlRenderer();
            
            // Render HTML content
            const renderResult = await this.currentRenderer.render(content, filePath);
            
            if (!renderResult || typeof renderResult.html !== 'string') {
                this.log('HTML render returned invalid result', 'error');
                this.showErrorState('Failed to render HTML content');
                return;
            }

            // Update container content
            await this.updateContainerContent(renderResult.html);
            
            // Post-process the rendered content
            await this.currentRenderer.postProcess(this.htmlContainer, renderResult, filePath);
            
            this.log('HTML preview updated successfully');
            this.showSuccessState();

        } catch (error) {
            this.log(`HTML render failed: ${error.message}`, 'error');
            console.error('HTML render error:', error);
            this.showErrorState(error.message);
        } finally {
            this.htmlState.isRendering = false;
            
            // Process any queued updates
            if (this.htmlState.renderQueue.length > 0) {
                const nextUpdate = this.htmlState.renderQueue.shift();
                setTimeout(() => this.performHtmlUpdate(nextUpdate.content, nextUpdate.filePath), 100);
            }
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        if (!this.htmlContainer) return;
        
        const loadingState = this.htmlContainer.querySelector('.html-loading-state');
        if (loadingState) {
            loadingState.style.display = 'flex';
        }
        
        this.htmlContainer.classList.add('html-updating');
    }

    /**
     * Show error state
     */
    showErrorState(message) {
        if (!this.htmlContainer) return;
        
        this.htmlContainer.classList.remove('html-updating', 'html-success');
        this.htmlContainer.classList.add('html-error-state');
        
        const errorHtml = `
            <div class="html-error">
                <div class="html-error__icon">⚠️</div>
                <div class="html-error__content">
                    <h4>HTML Render Error</h4>
                    <p>${message}</p>
                    <button class="html-error__retry" onclick="this.closest('.html-preview').dataset.forceRefresh = 'true'; window.dispatchEvent(new CustomEvent('html:retry'))">
                        Retry
                    </button>
                </div>
            </div>
        `;
        
        this.htmlContainer.innerHTML = errorHtml;
    }

    /**
     * Show success state
     */
    showSuccessState() {
        if (!this.htmlContainer) return;
        
        this.htmlContainer.classList.remove('html-updating', 'html-error-state');
        this.htmlContainer.classList.add('html-success');
        
        // Hide loading state
        const loadingState = this.htmlContainer.querySelector('.html-loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        // Remove success class after animation
        setTimeout(() => {
            if (this.htmlContainer) {
                this.htmlContainer.classList.remove('html-success');
            }
        }, 300);
    }

    /**
     * Update container content with smooth transition
     */
    async updateContainerContent(html) {
        if (!this.htmlContainer) return;
        
        return new Promise((resolve) => {
            // Add transition class
            this.htmlContainer.classList.add('html-transitioning');
            
            // Small delay to ensure transition starts
            setTimeout(() => {
                this.htmlContainer.innerHTML = html;
                this.htmlContainer.classList.remove('html-transitioning', 'html-updating');
                
                // Allow transition to complete
                setTimeout(resolve, 100);
            }, 50);
        });
    }

    /**
     * Panel cleanup
     */
    cleanup() {
        this.log('HtmlPanel cleanup', 'debug');
        
        // Clear timers
        if (this.htmlState.debounceTimer) {
            clearTimeout(this.htmlState.debounceTimer);
        }
        
        // Clear state subscription
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        
        // Cleanup any active HTML renderer
        if (this.currentRenderer && typeof this.currentRenderer.destroy === 'function') {
            this.currentRenderer.destroy();
            this.currentRenderer = null;
        }
        
        // Also cleanup global renderer if it exists
        if (window.htmlRenderer && typeof window.htmlRenderer.destroy === 'function') {
            window.htmlRenderer.destroy();
        }
        
        super.cleanup();
    }
} 