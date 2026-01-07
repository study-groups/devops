/**
 * PJA Code Viewer Component
 * A reusable component to display code with line numbers and highlighting.
 */
class DevWatchCodeViewer {
    constructor(options = {}) {
        this.options = {
            container: null,
            title: '',
            actions: [], // e.g., [{ id: 'ast', label: 'View AST', callback: () => {} }]
            highlightLine: -1,
            onClose: null, // Callback for a close button
            ...options,
        };
        this.container = typeof this.options.container === 'string' 
            ? document.querySelector(this.options.container) 
            : this.options.container;

        if (!this.container) {
            console.error('DevWatchCodeViewer: Container not found.');
            return;
        }
    }

    render(content, highlightLine = -1) {
        // Update highlightLine in options if a new one is passed
        if (highlightLine > 0) {
            this.options.highlightLine = highlightLine;
        }

        if (typeof content !== 'string') {
            this.container.innerHTML = '<div class="devwatch-code-viewer-error">Invalid content</div>';
            return;
        }

        // Store the original content for later use
        this.originalContent = content;

        const headerHtml = this._renderHeader();
        const lines = content.split('\n');
        const linesHtml = lines.map((line, index) => {
            const lineNumber = index + 1;
            const isHighlighted = lineNumber === parseInt(this.options.highlightLine, 10);
            const lineClass = isHighlighted ? 'devwatch-code-line highlighted' : 'devwatch-code-line';
            
            return `
                <div class="${lineClass}" data-line-number="${lineNumber}">
                    <span class="pja-line-number">${lineNumber}</span>
                    <span class="pja-line-content">${this._escapeHtml(line)}</span>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="devwatch-code-viewer-wrapper">
                ${headerHtml}
                <div class="devwatch-code-viewer-content">
                    <div class="devwatch-code-viewer devwatch-tab-content active" data-tab="code">${linesHtml}</div>
                    <div class="devwatch-code-viewer-extra">
                        <!-- Action content will be injected here -->
                    </div>
                </div>
            </div>
        `;

        // The component's HTML is now in the container, so we can safely attach listeners.
        this._attachActionListeners();
    }
    
    _renderHeader() {
        if (!this.options.title && this.options.actions.length === 0) {
            return '';
        }

        const titleHtml = this.options.title 
            ? `<div class="devwatch-code-viewer-title">${this.options.title}</div>` 
            : '';
        
        // Add Code tab as the first tab, then action tabs
        const codeTabHtml = `<button class="devwatch-button devwatch-button--ghost devwatch-code-viewer-action-btn is-active" data-action-id="code">Code</button>`;
        const actionsHtml = this.options.actions.map(action => 
            `<button class="devwatch-button devwatch-button--ghost devwatch-code-viewer-action-btn" data-action-id="${action.id}">${action.label}</button>`
        ).join('');

        // Add a "Go to Line" button if a highlight line is provided
        const goToLineHtml = this.options.highlightLine > 0
            ? `<button class="devwatch-button devwatch-button--ghost go-to-line-btn" title="Go to line ${this.options.highlightLine}">
                   @ ${this.options.highlightLine}
               </button>`
            : '';

        // Add copy button
        const copyHtml = `<button class="devwatch-button devwatch-button--ghost devwatch-code-viewer-copy-btn" title="Copy code to clipboard">Copy</button>`;
            
        const closeHtml = this.options.onClose
            ? `<button class="devwatch-button devwatch-button--ghost devwatch-code-viewer-close-btn" title="Close code view">&times;</button>`
            : '';

        return `
            <div class="devwatch-code-viewer-header">
                ${titleHtml}
                <div class="devwatch-code-viewer-actions">
                    ${goToLineHtml}
                    ${copyHtml}
                    ${codeTabHtml}
                    ${actionsHtml}
                    ${closeHtml}
                </div>
            </div>
        `;
    }
    
    _attachActionListeners() {
        const extraContainer = this.container.querySelector('.devwatch-code-viewer-extra');
        const codeViewer = this.container.querySelector('.devwatch-code-viewer');

        // Create containers for each action tab
        this.options.actions.forEach(action => {
            const actionContentContainer = document.createElement('div');
            actionContentContainer.id = `pja-action-content-${action.id}`;
            actionContentContainer.className = 'pja-action-content devwatch-tab-content';
            actionContentContainer.dataset.tab = action.id;
            actionContentContainer.style.display = 'none';
            extraContainer.appendChild(actionContentContainer);
        });

        // Attach listeners for all tab buttons (including Code tab)
        this.container.querySelectorAll('.devwatch-code-viewer-action-btn').forEach(button => {
            button.addEventListener('click', () => {
                const actionId = button.dataset.actionId;
                
                // If the clicked tab is already active, do nothing
                if (button.classList.contains('is-active')) {
                    return;
                }

                // Deactivate all tabs and hide all content
                this.container.querySelectorAll('.devwatch-code-viewer-action-btn').forEach(btn => {
                    btn.classList.remove('is-active');
                });
                this.container.querySelectorAll('.devwatch-tab-content').forEach(content => {
                    content.classList.remove('active');
                    content.style.display = 'none';
                });

                // Activate the clicked tab
                button.classList.add('is-active');

                if (actionId === 'code') {
                    // Show the code viewer
                    codeViewer.classList.add('active');
                    codeViewer.style.display = 'block';
                } else {
                    // Show the action content
                    const actionContentContainer = this.container.querySelector(`#pja-action-content-${actionId}`);
                    if (actionContentContainer) {
                        actionContentContainer.classList.add('active');
                        actionContentContainer.style.display = 'block';

                        // Load content if it's the first time
                        if (!actionContentContainer.hasChildNodes()) {
                            const action = this.options.actions.find(a => a.id === actionId);
                            if (action && action.callback) {
                                action.callback(actionContentContainer);
                            }
                        }
                    }
                }
            });
        });

        // Attach listener for the "Go to Line" button
        const goToLineBtn = this.container.querySelector('.go-to-line-btn');
        if (goToLineBtn) {
            goToLineBtn.addEventListener('click', () => {
                // First switch to code tab if not already active
                const codeTab = this.container.querySelector('[data-action-id="code"]');
                if (codeTab && !codeTab.classList.contains('is-active')) {
                    codeTab.click();
                }
                
                // Then scroll to highlighted line
                setTimeout(() => {
                    const highlightedEl = this.container.querySelector('.highlighted');
                    if (highlightedEl) {
                        highlightedEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                }, 100);
            });
        }
        
        // Attach listener for the copy button
        const copyBtn = this.container.querySelector('.devwatch-code-viewer-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyCodeToClipboard();
            });
        }
        
        // Attach listener for the close button
        const closeBtn = this.container.querySelector('.devwatch-code-viewer-close-btn');
        if (closeBtn && typeof this.options.onClose === 'function') {
            closeBtn.addEventListener('click', () => {
                this.options.onClose();
            });
        }
    }

    async copyCodeToClipboard() {
        try {
            // Check if there's selected text first
            const selection = window.getSelection();
            let textToCopy = '';
            
            if (selection && selection.toString().trim()) {
                // Copy selected text
                textToCopy = selection.toString();
            } else {
                // Copy all code content
                textToCopy = this.originalContent || '';
            }
            
            if (!textToCopy) {
                console.warn('No content to copy');
                return;
            }
            
            // Use the modern clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
                this.showCopyFeedback('Copied to clipboard!');
            } else {
                // Fallback for older browsers
                this.fallbackCopyToClipboard(textToCopy);
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showCopyFeedback('Copy failed', true);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showCopyFeedback('Copied to clipboard!');
            } else {
                this.showCopyFeedback('Copy failed', true);
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showCopyFeedback('Copy failed', true);
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    showCopyFeedback(message, isError = false) {
        const copyBtn = this.container.querySelector('.devwatch-code-viewer-copy-btn');
        if (!copyBtn) return;
        
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = isError ? '❌ Failed' : '✅ Copied';
        copyBtn.disabled = true;
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.disabled = false;
        }, 2000);
    }

    showLoading() {
        this.container.innerHTML = '<div class="devwatch-code-viewer-loading">Loading code...</div>';
    }

    showError(message) {
        this.container.innerHTML = `<div class="devwatch-code-viewer-error">${message}</div>`;
    }

    _escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
