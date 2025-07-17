/**
 * HTML Renderer - Renders HTML content inside a sandboxed iframe with CSS debugging capabilities.
 */

function logHtmlPreviewRenderer(message, level = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(`[HtmlPreviewRenderer] ${message}`, level, 'HTML_RENDERER');
    } else {
        console.log(`[HtmlPreviewRenderer] ${message}`);
    }
}

export class HtmlPreviewRenderer {
    constructor() {
        // Configuration for the renderer
        this.debugMode = false;
        this.cssIsolationMode = 'strict'; // 'strict', 'selective', 'none'
        
        // Track debug panel and event listeners for cleanup
        this.debugPanel = null;
        this.debugEventListeners = [];
        
        // Set up CSS change listener
        this.setupCssChangeListener();
    }

    /**
     * Main render method for HTML content.
     * @param {string} htmlContent - Raw HTML content.
     * @param {string} filePath - Source file path.
     * @returns {Promise<Object>} Render result containing an iframe.
     */
    async render(htmlContent, filePath) {
        logHtmlPreviewRenderer(`Rendering HTML file in iframe: ${filePath}`);

        // Inject the game client SDK script at the beginning of the head
        let content = htmlContent || '';
        if (content.includes('<head>')) {
            content = content.replace('<head>', `<head>\n<script src="/client/sdk/gameClient.js"><\/script>`);
        } else {
            // Fallback if no head tag
            content = `<head><script src="/client/sdk/gameClient.js"><\/script></head>${content}`;
        }
        
        // Log the content being rendered for debugging
        logHtmlPreviewRenderer(`HTML content length: ${content.length}`, 'debug');
        logHtmlPreviewRenderer(`HTML content preview: ${content.substring(0, 200)}...`, 'debug');
        
        // Use direct file URL for better isolation and performance
        // const fileUrl = `/api/files/content?pathname=${encodeURIComponent(filePath)}`;
        
        // Create iframe with enhanced isolation and debugging capabilities
        const iframeHtml = `
            <div class="html-renderer-container" data-file-path="${filePath}">
                <div class="html-renderer-toolbar" style="display: none;">
                    <button class="html-debug-btn" title="Debug CSS Issues">🔍 Debug CSS</button>
                    <button class="html-reload-btn" title="Reload Content">🔄 Reload</button>
                </div>
                <iframe 
                    class="html-preview-iframe" 
                    srcdoc="${content.replace(/"/g, '&quot;')}"
                    frameborder="0" 
                    sandbox="allow-scripts allow-popups allow-forms allow-modals"
                    style="width: 100%; height: 100%; border: none; margin: 0; padding: 0; display: block; min-height: 400px; opacity: 1;"
                    data-file-path="${filePath}">
                </iframe>
            </div>
        `;

        const result = {
            html: iframeHtml,
            isHtml: true,
            filePath,
            requiresIsolation: true
        };

        logHtmlPreviewRenderer(`Successfully generated iframe for HTML file: ${filePath}`);
        return result;
    }

    /**
     * Post-processing for iframe-based rendering with CSS debugging setup.
     * @param {HTMLElement} previewElement - The container element for the preview.
     */
    async postProcess(previewElement, renderResult, filePath) {
        logHtmlPreviewRenderer('Post-processing for iframe-based HTML render.');
        
        const container = previewElement.querySelector('.html-renderer-container');
        const iframe = previewElement.querySelector('.html-preview-iframe');
        const toolbar = previewElement.querySelector('.html-renderer-toolbar');
        
        if (iframe) {
            // Ensure proper iframe styling and remove any conflicting CSS
            this.ensureIframeIsolation(iframe);
            
            // Setup enhanced event listeners
            this.setupIframeEventListeners(iframe, container, toolbar);
            
            // Setup debugging capabilities
            this.setupDebuggingFeatures(container, iframe, filePath);
            
            // Show toolbar on hover
            if (container && toolbar) {
                container.addEventListener('mouseenter', () => {
                    toolbar.style.display = 'flex';
                });
                container.addEventListener('mouseleave', () => {
                    toolbar.style.display = 'none';
                });
            }
        }
    }

    /**
     * Ensure iframe is properly isolated from parent CSS
     */
    ensureIframeIsolation(iframe) {
        // Force iframe visibility and remove any parent CSS interference
        iframe.style.cssText = `
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            min-height: 400px !important;
            opacity: 1 !important;
            visibility: visible !important;
            position: relative !important;
            z-index: auto !important;
            background: white !important;
        `;

        // Remove any problematic classes that might be applied by parent CSS
        iframe.classList.remove('loaded', 'loading');
        
        logHtmlPreviewRenderer('Applied CSS isolation to iframe');
    }

    /**
     * Setup enhanced event listeners for iframe
     */
    setupIframeEventListeners(iframe, container, toolbar) {
        iframe.addEventListener('load', () => {
            logHtmlPreviewRenderer('HTML iframe loaded successfully');
            
            // Re-apply isolation after load
            this.ensureIframeIsolation(iframe);
            
            // Try to analyze iframe content
            this.analyzeIframeContent(iframe);
            
            // Dispatch ready event
            const event = new CustomEvent('preview:contentready', {
                bubbles: true,
                cancelable: false,
                detail: { 
                    filePath: iframe.getAttribute('data-file-path') || 'unknown',
                    renderer: 'html',
                    isolated: true
                }
            });
            container.dispatchEvent(event);
        });
        
        iframe.addEventListener('error', (e) => {
            logHtmlPreviewRenderer(`HTML iframe error: ${e.message}`, 'error');
            this.showIframeError(container, e);
        });

        // Monitor for CSS interference
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    // Re-apply isolation if style was changed
                    this.ensureIframeIsolation(iframe);
                }
            });
        });
        observer.observe(iframe, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    /**
     * Setup debugging features for CSS and content analysis
     */
    setupDebuggingFeatures(container, iframe, filePath) {
        const debugBtn = container.querySelector('.html-debug-btn');
        const reloadBtn = container.querySelector('.html-reload-btn');

        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                this.openCssDebugger(iframe, filePath);
            });
        }

        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                iframe.src = iframe.src; // Force reload
            });
        }
    }

    /**
     * Analyze iframe content for potential issues
     */
    analyzeIframeContent(iframe) {
        try {
            // Try to access iframe content (will fail for cross-origin)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                const title = iframeDoc.title || 'Untitled';
                const bodyText = iframeDoc.body ? iframeDoc.body.textContent.substring(0, 100) : '';
                logHtmlPreviewRenderer(`Iframe content analyzed - Title: ${title}, Body preview: ${bodyText}...`);
            }
        } catch (e) {
            logHtmlPreviewRenderer('Cannot analyze iframe content (cross-origin or security restrictions)');
        }
    }

    /**
     * Open CSS debugger for iframe content
     */
    openCssDebugger(iframe, filePath) {
        logHtmlPreviewRenderer('Opening CSS debugger for iframe');
        
        // Create debugging panel
        this.createCssDebugPanel(iframe, filePath);
    }

    /**
     * Create CSS debugging panel - now redirects to existing CSS Files Panel
     */
    createCssDebugPanel(iframe, filePath) {
        logHtmlPreviewRenderer('Opening CSS debug - redirecting to CSS Files Panel');
        
        // Import eventBus and emit event to open CSS Files Panel
        import('/client/eventBus.js').then(({ eventBus }) => {
            eventBus.emit('settings:openPanel', { 
                panelId: 'CssFilesPanel',
                source: 'html-renderer',
                filePath: filePath
            });
        }).catch(error => {
            logHtmlPreviewRenderer(`Failed to open CSS Files Panel: ${error.message}`, 'error');
            
            // Fallback: show simple message
            this.showSimpleMessage(
                'CSS Debug',
                'To debug CSS files, please open the CSS Files panel in Settings.',
                'info'
            );
        });
    }

    /**
     * Show a simple message dialog
     */
    showSimpleMessage(title, message, type = 'info') {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: var(--font-family-sans, system-ui);
        `;

        const iconMap = {
            info: '💡',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };

        modal.innerHTML = `
            <div style="
                background: var(--color-background, white);
                border: 1px solid var(--color-border, #e1e4e8);
                border-radius: 8px;
                padding: 24px;
                max-width: 400px;
                margin: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                ">
                    <span style="font-size: 24px;">${iconMap[type] || iconMap.info}</span>
                    <h3 style="
                        margin: 0;
                        color: var(--color-foreground);
                        font-size: 18px;
                        font-weight: 600;
                    ">${title}</h3>
                </div>
                <p style="
                    margin: 0 0 20px 0;
                    color: var(--color-foreground-muted, #6a737d);
                    line-height: 1.5;
                ">${message}</p>
                <div style="text-align: right;">
                    <button class="close-message" style="
                        background: var(--color-accent, #0366d6);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        const closeHandler = () => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        modal.querySelector('.close-message').addEventListener('click', closeHandler);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeHandler();
        });

        // Auto-close after 5 seconds for info messages
        if (type === 'info') {
            setTimeout(closeHandler, 5000);
        }
    }

    /**
     * Clean up debug panel and all associated event listeners
     */
    cleanupDebugPanel() {
        // Remove all event listeners
        this.debugEventListeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });
        this.debugEventListeners = [];

        // Remove debug panel from DOM
        if (this.debugPanel && this.debugPanel.parentNode) {
            this.debugPanel.parentNode.removeChild(this.debugPanel);
        }
        this.debugPanel = null;

        // Clean up any existing panels by class name (fallback)
        const existingPanels = document.querySelectorAll('.css-debug-panel');
        existingPanels.forEach(panel => {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        });
    }

    /**
     * Listen to CSS changes from the CssFilesPanel via EventBus
     */
    setupCssChangeListener() {
        // Import EventBus and set up listener
        import('/client/eventBus.js').then(({ eventBus }) => {
            eventBus.on('css:changed', (eventData) => {
                const { event: eventType, data } = eventData;
                
                if (eventType === 'cssToggled') {
                    logHtmlPreviewRenderer(`CSS file toggled via EventBus: ${data.href} (enabled: ${data.enabled})`);
                    
                    // Re-apply iframe isolation after CSS changes
                    const iframe = document.querySelector('.html-preview-iframe');
                    if (iframe) {
                        requestAnimationFrame(() => {
                            this.ensureIframeIsolation(iframe);
                        });
                    }
                }
            });
        }).catch(error => {
            logHtmlPreviewRenderer(`Failed to set up CSS change listener: ${error.message}`, 'error');
        });
    }

    /**
     * Show iframe error
     */
    showIframeError(container, error) {
        const errorHtml = `
            <div class="iframe-error" style="padding: 20px; text-align: center; color: #dc3545;">
                <h4>HTML Preview Error</h4>
                <p>Failed to load HTML content: ${error.message || 'Unknown error'}</p>
                <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;">
                    Reload Page
                </button>
            </div>
        `;
        container.innerHTML = errorHtml;
    }

    /**
     * Cleanup method to be called when renderer is destroyed
     */
    destroy() {
        logHtmlPreviewRenderer('Cleaning up HTML renderer');
        this.cleanupDebugPanel();
        
        // Clear any global references
        if (window.htmlRenderer === this) {
            delete window.htmlRenderer;
        }
    }
}

// Legacy export for backward compatibility
export async function renderHtml(htmlContent, filePath) {
    const renderer = new HtmlPreviewRenderer();
    return await renderer.render(htmlContent, filePath);
} 