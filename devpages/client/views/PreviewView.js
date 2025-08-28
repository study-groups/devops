/**
 * PreviewView.js - A self-contained view for rendering Markdown previews
 * This version is driven by the Redux store and integrates with the preview system.
 */

import { ViewInterface } from '/client/layout/ViewInterface.js';
import { appStore } from '/client/appState.js';
import { renderMarkdown } from '/client/preview/renderer.js';

export class PreviewView extends ViewInterface {
    constructor(options = {}) {
        super({
            id: 'preview-view',
            title: 'Preview',
            ...options,
        });

        this.previewContainer = null;
        this.unsubscribe = null;
        this.lastProcessedContent = null;
        this.isUpdating = false;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
        this.isPreviewSystemInitialized = false;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'preview-container';
        container.innerHTML = '<div class="preview-placeholder">Ready to preview</div>';
        return container;
    }

    async onMount(container) {
        console.log('[PreviewView] Mounting preview view');
        
        // Enhanced initialization tracking
        this.initializationAttempts++;
        console.log(`[PreviewView] Initialization Attempt ${this.initializationAttempts}`);

        // Comprehensive container validation with detailed logging
        if (!container) {
            console.error(`[PreviewView] No container provided (Attempt ${this.initializationAttempts})`);
            
            // Advanced fallback strategy
            const fallbackContainers = [
                document.getElementById('workspace-preview'),
                document.querySelector('.preview-container'),
                document.body
            ];

            for (const fallbackContainer of fallbackContainers) {
                if (fallbackContainer) {
                    console.warn(`[PreviewView] Using fallback container: ${fallbackContainer.id || fallbackContainer.className}`);
                    return this.onMount(fallbackContainer);
                }
            }
            
            console.error('[PreviewView] No fallback containers found. Initialization aborted.');
            return;
        }

        // Defensive element creation with extensive logging
        try {
            if (!this.element) {
                this.element = this.render();
                console.log('[PreviewView] Element created via render()');
                
                // Ensure container is valid before appending
                if (container && container.appendChild) {
                    container.appendChild(this.element);
                    console.log('[PreviewView] Element appended to container');
                } else {
                    console.error('[PreviewView] Invalid container or missing appendChild method');
                }
            }
        } catch (renderError) {
            console.error('[PreviewView] Error during element rendering:', renderError);
            return;
        }
        
        // Advanced preview container detection
        // If the element itself has the preview-container class, use it directly
        if (this.element.classList.contains('preview-container')) {
            this.previewContainer = this.element;
        } else {
            this.previewContainer = this.element.querySelector('.preview-container');
        }
        
        console.log('[PreviewView] Initialization Diagnostic Report:', {
            containerProvided: !!container,
            containerType: container?.constructor?.name,
            elementCreated: !!this.element,
            elementType: this.element?.constructor?.name,
            previewContainerFound: !!this.previewContainer,
            previewContainerType: this.previewContainer?.constructor?.name
        });

        // Comprehensive fallback container strategy
        if (!this.previewContainer) {
            console.warn(`[PreviewView] Creating robust fallback preview container (Attempt ${this.initializationAttempts})`);
            this.previewContainer = document.createElement('div');
            this.previewContainer.className = 'preview-container emergency-fallback';
            this.previewContainer.innerHTML = `
                <div class="preview-placeholder">
                    Emergency Preview Initialization (Attempt ${this.initializationAttempts})
                    <small>Check console for details</small>
                </div>
            `;
            
            // Multiple fallback append strategies
            const appendStrategies = [
                () => this.element && this.element.appendChild(this.previewContainer),
                () => container.appendChild(this.previewContainer),
                () => document.body.appendChild(this.previewContainer)
            ];

            for (const strategy of appendStrategies) {
                try {
                    strategy();
                    console.log('[PreviewView] Successfully appended fallback container');
                    break;
                } catch (appendError) {
                    console.warn('[PreviewView] Fallback container append strategy failed:', appendError);
                }
            }
        }

        // Rest of the method remains the same
        this.loadCSS();
        
        try {
            this.isPreviewSystemInitialized = await this.initializePreviewSystem();
            console.log(`[PreviewView] Preview system initialization: ${this.isPreviewSystemInitialized}`);
        } catch (error) {
            console.error('[PreviewView] Failed to initialize preview system:', error);
            
            if (this.previewContainer) {
                this.previewContainer.innerHTML = `
                    <div class="preview-error">
                        Preview system initialization failed
                        <details>${error.message}</details>
                    </div>
                `;
            } else {
                console.error('[PreviewView] Cannot set error message: previewContainer is null');
            }
            return;
        }
        
        this.subscribeToStateChanges();
        this.updatePreviewFromState();
        
        console.log('[PreviewView] Preview view mounted successfully');
    }

    async initializePreviewSystem() {
        try {
            // Simple initialization - just ensure the renderer is ready
            console.log('[PreviewView] Initializing preview system...');
            
            // The renderer will initialize itself when needed
            // No need for complex Redux initialization here
            return true;
        } catch (error) {
            console.error('[PreviewView] Preview system initialization error:', error);
            return false;
        }
    }

    onUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        console.log('[PreviewView] Preview view unmounted');
    }

    loadCSS() {
        const cssPath = '/client/panels/styles/PreviewPanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
        }
    }

    subscribeToStateChanges() {
        // Only subscribe if preview system is initialized
        if (!this.isPreviewSystemInitialized) {
            console.warn('[PreviewView] Cannot subscribe: Preview system not initialized');
            return;
        }

        this.unsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            const currentFileContent = state.file?.currentFile?.content || '';
            
            // Prevent recursive or simultaneous updates
            if (currentFileContent && 
                currentFileContent !== this.lastProcessedContent && 
                !this.isUpdating) {
                this.triggerPreviewUpdate(currentFileContent, state.file?.currentFile?.pathname);
            }
        });
    }

    async triggerPreviewUpdate(content, filePath) {
        if (!content || this.isUpdating || !this.isPreviewSystemInitialized) return;
        
        try {
            this.isUpdating = true;
            
            // Use renderMarkdown directly like the working PreviewPanel
            const result = await renderMarkdown(content, filePath);
            
            if (result && result.html && this.previewContainer) {
                this.previewContainer.innerHTML = result.html;
                console.log('[PreviewView] Content rendered successfully');
            }
            
            // Track last processed content to prevent recursive updates
            this.lastProcessedContent = content;
        } catch (error) {
            console.error('[PreviewView] Failed to trigger preview update:', error);
            if (this.previewContainer) {
                this.previewContainer.innerHTML = '<div class="preview-error">Failed to update preview</div>';
            }
        } finally {
            // Reset updating flag after a short delay for async operations
            setTimeout(() => {
                this.isUpdating = false;
            }, 100);
        }
    }

    updatePreviewFromState() {
        // Comprehensive null checks with detailed logging
        console.log('[PreviewView] updatePreviewFromState called with:', {
            element: !!this.element,
            previewSystemInitialized: this.isPreviewSystemInitialized,
            previewContainer: !!this.previewContainer
        });

        if (!this.element || !this.isPreviewSystemInitialized) {
            console.error('[PreviewView] Element not initialized or preview system not ready');
            return;
        }

        // Ensure preview container exists
        if (!this.previewContainer) {
            console.error('[PreviewView] Preview container not initialized');
            
            // Attempt to recreate preview container
            this.previewContainer = this.element.querySelector('.preview-container');
            
            if (!this.previewContainer) {
                console.warn('[PreviewView] Creating emergency preview container');
                this.previewContainer = document.createElement('div');
                this.previewContainer.className = 'preview-container';
                this.previewContainer.innerHTML = '<div class="preview-placeholder">Preview initialization emergency fallback</div>';
                
                // Ensure element exists before appending
                if (this.element) {
                    this.element.appendChild(this.previewContainer);
                } else {
                    console.error('[PreviewView] Cannot append emergency container: element is null');
                    return;
                }
            }
        }

        const state = appStore.getState();
        const previewState = state.preview;
        
        if (!previewState) {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">Initializing preview...</div>';
            return;
        }
        
        const { status, htmlContent, error, currentContent } = previewState;

        if (status === 'loading') {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">Loading preview...</div>';
            return;
        }

        if (status === 'failed') {
            this.previewContainer.innerHTML = `<div class="preview-error">Error: ${error || 'Unknown error'}</div>`;
            return;
        }

        // Use currentContent if available, fallback to htmlContent
        const contentToDisplay = currentContent || htmlContent;
        if (!contentToDisplay) {
            this.previewContainer.innerHTML = '<div class="preview-placeholder">No content to preview</div>';
            return;
        }

        // Update the preview content
        this.previewContainer.innerHTML = contentToDisplay;
        
        // Post-process the content (handle scripts, styles, etc.)
        this.postProcessContent();
    }

    postProcessContent() {
        if (!this.previewContainer) return;

        // Ensure proper styling is applied
        this.previewContainer.classList.add('preview-rendered');
    }

    // Public API methods
    async syncContent() {
        const state = appStore.getState();
        const content = state.file?.currentFile?.content || '';
        const filePath = state.file?.currentFile?.pathname || '';
        
        try {
            // Prevent simultaneous updates
            if (!this.isUpdating && this.isPreviewSystemInitialized && content) {
                await this.triggerPreviewUpdate(content, filePath);
                console.log('[PreviewView] Content synced successfully');
            }
        } catch (error) {
            console.error('[PreviewView] Failed to sync content:', error);
            if (this.previewContainer) {
                this.previewContainer.innerHTML = '<div class="preview-error">Failed to sync preview</div>';
            }
        }
    }

    async refreshPreview() {
        console.log('[PreviewView] Refreshing preview...');
        await this.syncContent();
    }

    getPreviewContent() {
        return this.previewContainer?.innerHTML || '';
    }

    setPreviewContent(content) {
        if (this.previewContainer) {
            this.previewContainer.innerHTML = content;
        }
    }

    scrollToTop() {
        if (this.previewContainer) {
            this.previewContainer.scrollTop = 0;
        }
    }

    scrollToBottom() {
        if (this.previewContainer) {
            this.previewContainer.scrollTop = this.previewContainer.scrollHeight;
        }
    }
}