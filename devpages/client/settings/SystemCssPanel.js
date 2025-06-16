/**
 * SystemCssPanel.js - System CSS management panel
 * Lists all stylesheets and provides CSS consolidation tools
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from './panelRegistry.js';

function logSystemCss(message, level = 'info') {
    const type = 'SYSTEM_CSS';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export class SystemCssPanel {
    constructor(parentElement) {
        this.containerElement = parentElement;
        this.stateUnsubscribe = null;
        this.stylesheets = [];
        this.systemCssPath = 'devpages/styles/system/';
        
        this.createPanelContent(parentElement);
        this.subscribeToState();
        this.scanStylesheets();
        
        logSystemCss('SystemCssPanel initialized');
    }

    createPanelContent(parentElement) {
        parentElement.innerHTML = `
            <div class="system-css-panel-content">
                <div class="css-summary-section">
                    <h5>CSS Summary</h5>
                    <div class="css-stats">
                        <div class="stat-item">
                            <span class="stat-label">Total Stylesheets:</span>
                            <span class="stat-value" id="total-stylesheets">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">System CSS:</span>
                            <span class="stat-value" id="system-css-count">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Page CSS:</span>
                            <span class="stat-value" id="page-css-count">0</span>
                        </div>
                    </div>
                </div>

                <div class="stylesheet-list-section">
                    <h5>Current Stylesheets</h5>
                    <div class="stylesheet-list" id="stylesheet-list">
                        <!-- Dynamically populated -->
                    </div>
                </div>

                <div class="css-actions-section">
                    <h5>CSS Management</h5>
                    <div class="css-actions">
                        <button class="css-action-btn" id="create-system-css">
                            Create System CSS
                        </button>
                        <button class="css-action-btn" id="consolidate-css">
                            Consolidate CSS
                        </button>
                        <button class="css-action-btn" id="copy-all-css">
                            Copy All CSS
                        </button>
                        <button class="css-action-btn" id="refresh-scan">
                            Refresh Scan
                        </button>
                    </div>
                </div>

                <div class="css-preview-section">
                    <h5>CSS Preview Mode</h5>
                    <div class="preview-mode-controls">
                        <label class="preview-mode-option">
                            <input type="radio" name="css-injection-mode" value="stylesheet" checked>
                            <span>Inject as Stylesheet</span>
                        </label>
                        <label class="preview-mode-option">
                            <input type="radio" name="css-injection-mode" value="inline">
                            <span>Inject as Inline Styles</span>
                        </label>
                    </div>
                    <div class="preview-target-info">
                        <p>Target: <span id="preview-target">div#preview-container</span></p>
                        <p>Mode: <span id="preview-mode">Direct DOM</span></p>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // CSS action buttons
        document.getElementById('create-system-css')?.addEventListener('click', () => {
            this.createSystemCss();
        });

        document.getElementById('consolidate-css')?.addEventListener('click', () => {
            this.consolidateCss();
        });

        document.getElementById('copy-all-css')?.addEventListener('click', () => {
            this.copyAllCss();
        });

        document.getElementById('refresh-scan')?.addEventListener('click', () => {
            this.scanStylesheets();
        });

        // Preview mode radio buttons
        const radioButtons = this.containerElement.querySelectorAll('input[name="css-injection-mode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateCssInjectionMode(e.target.value);
            });
        });
    }

    scanStylesheets() {
        logSystemCss('Scanning current stylesheets...');
        
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

        this.updateDisplay();
        logSystemCss(`Found ${this.stylesheets.length} stylesheets`);
    }

    isSystemCss(href) {
        return href.includes('/client/') || href.includes('/styles/system/');
    }

    isPageCss(href) {
        return href.includes('/md/styles/') || href.includes('styles.css');
    }

    updateDisplay() {
        // Update stats
        const totalCount = this.stylesheets.length;
        const systemCount = this.stylesheets.filter(s => s.isSystem).length;
        const pageCount = this.stylesheets.filter(s => s.isPage).length;

        document.getElementById('total-stylesheets').textContent = totalCount;
        document.getElementById('system-css-count').textContent = systemCount;
        document.getElementById('page-css-count').textContent = pageCount;

        // Update stylesheet list
        const listContainer = document.getElementById('stylesheet-list');
        listContainer.innerHTML = '';

        this.stylesheets.forEach((stylesheet, index) => {
            const item = document.createElement('div');
            item.className = 'stylesheet-item';
            
            const typeClass = stylesheet.isSystem ? 'system' : stylesheet.isPage ? 'page' : 'other';
            
            const stylesheetPath = this.getStylesheetPath(stylesheet);
            item.innerHTML = `
                <div class="stylesheet-info">
                    <div class="stylesheet-type ${typeClass}">${this.getStylesheetTypeLabel(stylesheet)}</div>
                    <div class="stylesheet-path" title="${stylesheetPath}">${stylesheetPath}</div>
                    <div class="stylesheet-size">${this.getStylesheetSize(stylesheet)}</div>
                </div>
                <div class="stylesheet-actions">
                    <button class="stylesheet-action" data-action="view" data-index="${index}" title="View stylesheet content">View</button>
                    <button class="stylesheet-action" data-action="edit" data-index="${index}" title="Edit stylesheet content">Edit</button>
                </div>
            `;
            
            // Add event listeners for the action buttons
            const viewBtn = item.querySelector('[data-action="view"]');
            const editBtn = item.querySelector('[data-action="edit"]');
            
            if (viewBtn) {
                viewBtn.addEventListener('click', () => this.viewStylesheet(index));
            }
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editStylesheet(index));
            }
            
            listContainer.appendChild(item);
        });
    }

    getStylesheetTypeLabel(stylesheet) {
        if (stylesheet.isSystem) return 'System';
        if (stylesheet.isPage) return 'Page';
        if (stylesheet.type === 'inline') return 'Inline';
        return 'External';
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

    viewStylesheet(index) {
        const stylesheet = this.stylesheets[index];
        if (!stylesheet) {
            logSystemCss(`Stylesheet at index ${index} not found`, 'error');
            return;
        }

        logSystemCss(`Viewing stylesheet: ${this.getStylesheetPath(stylesheet)}`);
        
        // For external stylesheets, try to fetch content if possible
        if (stylesheet.type === 'link' && this.canFetchExternalStylesheet(stylesheet)) {
            this.fetchExternalStylesheetContent(stylesheet)
                .then(content => {
                    const enhancedStylesheet = { ...stylesheet, fetchedContent: content };
                    this.showStylesheetModal(enhancedStylesheet, 'view');
                })
                .catch(error => {
                    logSystemCss(`Failed to fetch external stylesheet: ${error.message}`, 'warn');
                    this.showStylesheetModal(stylesheet, 'view');
                });
        } else {
            // Create a modal or popup to show the stylesheet content
            this.showStylesheetModal(stylesheet, 'view');
        }
    }

    canFetchExternalStylesheet(stylesheet) {
        // Check if the stylesheet is from the same origin or a trusted domain
        try {
            const stylesheetUrl = new URL(stylesheet.href, window.location.origin);
            const currentUrl = new URL(window.location.href);
            
            // Same origin is always allowed
            if (stylesheetUrl.origin === currentUrl.origin) {
                return true;
            }
            
            // Check for trusted domains (you can expand this list)
            const trustedDomains = [
                'devpages.qa.pixeljamarcade.com',
                'pixeljamarcade.com',
                // Add more trusted domains as needed
            ];
            
            return trustedDomains.some(domain => stylesheetUrl.hostname.endsWith(domain));
        } catch (error) {
            logSystemCss(`Invalid stylesheet URL: ${stylesheet.href}`, 'warn');
            return false;
        }
    }

    async fetchExternalStylesheetContent(stylesheet) {
        try {
            logSystemCss(`Attempting to fetch external stylesheet: ${stylesheet.href}`);
            
            const response = await fetch(stylesheet.href, {
                method: 'GET',
                mode: 'cors',
                cache: 'default',
                headers: {
                    'Accept': 'text/css,*/*;q=0.1'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.includes('text/css') && !contentType.includes('text/plain')) {
                logSystemCss(`Unexpected content type: ${contentType}`, 'warn');
            }
            
            const content = await response.text();
            logSystemCss(`Successfully fetched ${content.length} characters from external stylesheet`);
            
            return content;
        } catch (error) {
            logSystemCss(`Failed to fetch external stylesheet: ${error.message}`, 'error');
            throw error;
        }
    }

    editStylesheet(index) {
        const stylesheet = this.stylesheets[index];
        if (!stylesheet) {
            logSystemCss(`Stylesheet at index ${index} not found`, 'error');
            return;
        }

        logSystemCss(`Editing stylesheet: ${this.getStylesheetPath(stylesheet)}`);
        
        // Create a modal or popup to edit the stylesheet content
        this.showStylesheetModal(stylesheet, 'edit');
    }

    showStylesheetModal(stylesheet, mode = 'view') {
        // Remove any existing modal
        const existingModal = document.querySelector('.stylesheet-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'stylesheet-modal';
        modal.innerHTML = `
            <div class="stylesheet-modal-backdrop"></div>
            <div class="stylesheet-modal-content">
                <div class="stylesheet-modal-header">
                    <h3>${mode === 'edit' ? 'Edit' : 'View'} Stylesheet</h3>
                    <div class="stylesheet-modal-info">
                        <span class="stylesheet-type ${stylesheet.isSystem ? 'system' : stylesheet.isPage ? 'page' : 'other'}">
                            ${this.getStylesheetTypeLabel(stylesheet)}
                        </span>
                        <span class="stylesheet-path">${this.getStylesheetPath(stylesheet)}</span>
                    </div>
                    <button class="stylesheet-modal-close">&times;</button>
                </div>
                <div class="stylesheet-modal-body">
                    <textarea class="stylesheet-content" ${mode === 'view' ? 'readonly' : ''}>${this.getStylesheetContent(stylesheet)}</textarea>
                </div>
                <div class="stylesheet-modal-footer">
                    ${mode === 'edit' ? `
                        <button class="stylesheet-modal-save">Save Changes</button>
                        <button class="stylesheet-modal-cancel">Cancel</button>
                    ` : `
                        <button class="stylesheet-modal-close-btn">Close</button>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.stylesheet-modal-close');
        const closeBtnFooter = modal.querySelector('.stylesheet-modal-close-btn');
        const backdrop = modal.querySelector('.stylesheet-modal-backdrop');
        const cancelBtn = modal.querySelector('.stylesheet-modal-cancel');

        const closeModal = () => {
            modal.remove();
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeBtnFooter) closeBtnFooter.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (mode === 'edit') {
            const saveBtn = modal.querySelector('.stylesheet-modal-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const textarea = modal.querySelector('.stylesheet-content');
                    const newContent = textarea.value;
                    this.saveStylesheetContent(stylesheet, newContent);
                    closeModal();
                });
            }
        }

        // Focus the textarea
        const textarea = modal.querySelector('.stylesheet-content');
        if (textarea) {
            textarea.focus();
        }
    }

    getStylesheetContent(stylesheet) {
        if (stylesheet.type === 'inline') {
            return stylesheet.content || '';
        } else if (stylesheet.type === 'link') {
            // If we have fetched content, use it
            if (stylesheet.fetchedContent) {
                return `/* External stylesheet: ${stylesheet.href} */\n/* Fetched content: */\n\n${stylesheet.fetchedContent}`;
            }
            
            // Otherwise show the API suggestion
            return `/* External stylesheet: ${stylesheet.href} */
/* Content cannot be displayed for security reasons */
/* 
 * To view external stylesheet content, consider implementing an API endpoint:
 * 
 * GET /api/stylesheets/proxy?url=${encodeURIComponent(stylesheet.href)}
 * 
 * This would allow server-side fetching of external CSS while maintaining
 * security controls and CORS compliance.
 * 
 * Example implementation:
 * - Validate the URL is from allowed domains
 * - Fetch the CSS server-side
 * - Return sanitized CSS content
 * - Add caching headers for performance
 */`;
        }
        return '/* No content available */';
    }

    saveStylesheetContent(stylesheet, newContent) {
        logSystemCss(`Saving stylesheet content for: ${this.getStylesheetPath(stylesheet)}`);
        
        if (stylesheet.type === 'inline') {
            // Update the inline style element
            if (stylesheet.element && stylesheet.element.tagName === 'STYLE') {
                stylesheet.element.textContent = newContent;
                stylesheet.content = newContent;
                logSystemCss('Inline stylesheet updated successfully');
            }
        } else {
            logSystemCss('Cannot save external stylesheet content', 'warn');
        }
        
        // Refresh the display
        this.scanStylesheets();
    }

    createSystemCss() {
        logSystemCss('Creating system CSS structure...');
        
        // Reference the new classic system CSS file
        const systemCssPath = '/devpages/styles/system/classic.css';
        
        // Open the system CSS file in a new tab for viewing
        window.open(systemCssPath, '_blank');
        
        logSystemCss(`System CSS available at: ${systemCssPath}`);
        
        // Also provide download functionality
        fetch(systemCssPath)
            .then(response => response.text())
            .then(cssContent => {
                const blob = new Blob([cssContent], { type: 'text/css' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'devpages-classic-system.css';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                logSystemCss('System CSS file downloaded');
            })
            .catch(error => {
                logSystemCss(`Error loading system CSS: ${error}`, 'error');
                
                // Fallback: show the generated default CSS
                const defaultSystemCss = this.generateDefaultSystemCss();
                this.showCssPreview('Default System CSS (Fallback)', defaultSystemCss);
            });
    }

    generateDefaultSystemCss() {
        return `/* DevPages System CSS - Default Markdown Styling */
/* Generated automatically - provides base styling for all markdown elements */

/* Reset and base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-weight: bold;
  line-height: 1.2;
}

h1 { font-size: 2rem; }
h2 { font-size: 1.75rem; }
h3 { font-size: 1.5rem; }
h4 { font-size: 1.25rem; }
h5 { font-size: 1.125rem; }
h6 { font-size: 1rem; }

/* Text elements */
p {
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Lists */
ul, ol {
  padding-left: 2rem;
}

li {
  line-height: 1.5;
}

/* Code */
code {
  font-family: monospace;
  font-size: 0.9em;
}

pre {
  font-family: monospace;
  overflow-x: auto;
}

/* Links */
a {
  text-decoration: underline;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
}

th, td {
  border: 1px solid;
  padding: 0.5rem;
  text-align: left;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
}

/* Blockquotes */
blockquote {
  border-left: 4px solid;
  padding-left: 1rem;
}

/* Details/Summary */
details {
  margin: 1rem 0;
}

summary {
  cursor: pointer;
  font-weight: bold;
}
`;
    }

    consolidateCss() {
        logSystemCss('Consolidating CSS files...');
        
        // This would analyze all current CSS and suggest consolidation
        const consolidationPlan = this.analyzeCssConsolidation();
        this.showConsolidationPlan(consolidationPlan);
    }

    async copyAllCss() {
        logSystemCss('Gathering all CSS in order...');
        
        try {
            const allCss = await this.gatherAllCssInOrder();
            this.showCopyAllCssModal(allCss);
        } catch (error) {
            logSystemCss(`Error gathering CSS: ${error.message}`, 'error');
            alert('Error gathering CSS. Check console for details.');
        }
    }

    async gatherAllCssInOrder() {
        const cssBlocks = [];
        let totalSize = 0;
        
        logSystemCss(`Processing ${this.stylesheets.length} stylesheets...`);
        
        for (let i = 0; i < this.stylesheets.length; i++) {
            const stylesheet = this.stylesheets[i];
            const path = this.getStylesheetPath(stylesheet);
            
            logSystemCss(`Processing ${i + 1}/${this.stylesheets.length}: ${path}`);
            
            try {
                let cssContent = '';
                let sourceInfo = '';
                
                if (stylesheet.type === 'inline') {
                    cssContent = stylesheet.content || '';
                    sourceInfo = `/* Inline Styles (${cssContent.length} characters) */`;
                } else if (stylesheet.type === 'link') {
                    sourceInfo = `/* External Stylesheet: ${stylesheet.href} */`;
                    
                    // Try to fetch external content
                    if (this.canFetchExternalStylesheet(stylesheet)) {
                        try {
                            cssContent = await this.fetchExternalStylesheetContent(stylesheet);
                            sourceInfo += `\n/* Successfully fetched (${cssContent.length} characters) */`;
                        } catch (error) {
                            cssContent = `/* Could not fetch content: ${error.message} */`;
                            sourceInfo += `\n/* Fetch failed: ${error.message} */`;
                        }
                    } else {
                        cssContent = `/* External stylesheet - content not accessible due to CORS restrictions */`;
                        sourceInfo += `\n/* Content not accessible - consider implementing API proxy */`;
                    }
                }
                
                const block = {
                    index: i + 1,
                    type: stylesheet.type,
                    path: path,
                    href: stylesheet.href || 'inline',
                    isSystem: stylesheet.isSystem,
                    isPage: stylesheet.isPage,
                    sourceInfo: sourceInfo,
                    content: cssContent,
                    size: cssContent.length
                };
                
                cssBlocks.push(block);
                totalSize += cssContent.length;
                
            } catch (error) {
                logSystemCss(`Error processing stylesheet ${path}: ${error.message}`, 'error');
                cssBlocks.push({
                    index: i + 1,
                    type: stylesheet.type,
                    path: path,
                    href: stylesheet.href || 'inline',
                    isSystem: stylesheet.isSystem,
                    isPage: stylesheet.isPage,
                    sourceInfo: `/* Error processing stylesheet */`,
                    content: `/* Error: ${error.message} */`,
                    size: 0
                });
            }
        }
        
        logSystemCss(`Gathered ${cssBlocks.length} CSS blocks, total size: ${totalSize} characters`);
        
        return {
            blocks: cssBlocks,
            totalSize: totalSize,
            timestamp: new Date().toISOString(),
            summary: {
                total: cssBlocks.length,
                system: cssBlocks.filter(b => b.isSystem).length,
                page: cssBlocks.filter(b => b.isPage).length,
                inline: cssBlocks.filter(b => b.type === 'inline').length,
                external: cssBlocks.filter(b => b.type === 'link').length
            }
        };
    }

    showCopyAllCssModal(cssData) {
        // Remove any existing modal
        const existingModal = document.querySelector('.copy-all-css-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Generate the complete CSS content
        const completeCSS = this.generateCompleteCssContent(cssData);
        
        const modal = document.createElement('div');
        modal.className = 'copy-all-css-modal stylesheet-modal';
        modal.innerHTML = `
            <div class="stylesheet-modal-backdrop"></div>
            <div class="stylesheet-modal-content">
                <div class="stylesheet-modal-header">
                    <h3>Copy All CSS</h3>
                    <div class="css-summary-info">
                        <span class="css-stat">${cssData.summary.total} stylesheets</span>
                        <span class="css-stat">${(cssData.totalSize / 1024).toFixed(1)}KB total</span>
                        <span class="css-stat">${cssData.summary.system} system</span>
                        <span class="css-stat">${cssData.summary.page} page</span>
                    </div>
                    <button class="stylesheet-modal-close">&times;</button>
                </div>
                <div class="stylesheet-modal-body">
                    <div class="css-copy-controls">
                        <button class="css-copy-btn" id="copy-to-clipboard">📋 Copy to Clipboard</button>
                        <button class="css-copy-btn" id="download-css">💾 Download CSS File</button>
                        <button class="css-copy-btn" id="copy-summary">📊 Copy Summary Only</button>
                    </div>
                    <textarea class="stylesheet-content" readonly>${completeCSS}</textarea>
                </div>
                <div class="stylesheet-modal-footer">
                    <div class="css-footer-info">
                        Generated: ${new Date(cssData.timestamp).toLocaleString()}
                    </div>
                    <button class="stylesheet-modal-close-btn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.stylesheet-modal-close');
        const closeBtnFooter = modal.querySelector('.stylesheet-modal-close-btn');
        const backdrop = modal.querySelector('.stylesheet-modal-backdrop');
        const copyBtn = modal.querySelector('#copy-to-clipboard');
        const downloadBtn = modal.querySelector('#download-css');
        const summaryBtn = modal.querySelector('#copy-summary');

        const closeModal = () => {
            modal.remove();
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeBtnFooter) closeBtnFooter.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyToClipboard(completeCSS, 'Complete CSS copied to clipboard!');
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadCssFile(completeCSS, cssData);
            });
        }

        if (summaryBtn) {
            summaryBtn.addEventListener('click', () => {
                const summary = this.generateCssSummary(cssData);
                this.copyToClipboard(summary, 'CSS summary copied to clipboard!');
            });
        }

        // Focus the textarea
        const textarea = modal.querySelector('.stylesheet-content');
        if (textarea) {
            textarea.focus();
        }
    }

    generateCompleteCssContent(cssData) {
        const header = `/*
 * Complete CSS Export - DevPages System
 * Generated: ${new Date(cssData.timestamp).toLocaleString()}
 * Total Stylesheets: ${cssData.summary.total}
 * Total Size: ${(cssData.totalSize / 1024).toFixed(1)}KB
 * 
 * Breakdown:
 * - System CSS: ${cssData.summary.system} files
 * - Page CSS: ${cssData.summary.page} files  
 * - Inline Styles: ${cssData.summary.inline} blocks
 * - External Stylesheets: ${cssData.summary.external} files
 */

`;

        const cssContent = cssData.blocks.map((block, index) => {
            const separator = index === 0 ? '' : '\n\n';
            const blockHeader = `${separator}/* ========================================
 * ${block.index}. ${block.path}
 * Type: ${block.type.toUpperCase()}${block.isSystem ? ' (System)' : ''}${block.isPage ? ' (Page)' : ''}
 * Size: ${block.size} characters
 * ======================================== */

${block.sourceInfo}

${block.content}`;
            
            return blockHeader;
        }).join('');

        return header + cssContent;
    }

    generateCssSummary(cssData) {
        return `CSS Summary - DevPages System
Generated: ${new Date(cssData.timestamp).toLocaleString()}

Total Stylesheets: ${cssData.summary.total}
Total Size: ${(cssData.totalSize / 1024).toFixed(1)}KB

Breakdown:
- System CSS: ${cssData.summary.system} files
- Page CSS: ${cssData.summary.page} files
- Inline Styles: ${cssData.summary.inline} blocks
- External Stylesheets: ${cssData.summary.external} files

Stylesheet List:
${cssData.blocks.map(block => 
    `${block.index}. ${block.path} (${block.type}, ${block.size} chars)${block.isSystem ? ' [System]' : ''}${block.isPage ? ' [Page]' : ''}`
).join('\n')}`;
    }

    async copyToClipboard(text, successMessage) {
        try {
            await navigator.clipboard.writeText(text);
            logSystemCss(successMessage);
            
            // Show temporary success message
            this.showTemporaryMessage(successMessage, 'success');
        } catch (error) {
            logSystemCss(`Failed to copy to clipboard: ${error.message}`, 'error');
            
            // Fallback: select the text
            const textarea = document.querySelector('.stylesheet-content');
            if (textarea) {
                textarea.select();
                textarea.setSelectionRange(0, 99999);
                this.showTemporaryMessage('Text selected - use Ctrl+C to copy', 'info');
            }
        }
    }

    downloadCssFile(cssContent, cssData) {
        const filename = `devpages-complete-css-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.css`;
        
        const blob = new Blob([cssContent], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logSystemCss(`CSS file downloaded: ${filename}`);
        this.showTemporaryMessage(`Downloaded: ${filename}`, 'success');
    }

    showTemporaryMessage(message, type = 'info') {
        // Remove any existing message
        const existingMessage = document.querySelector('.temp-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `temp-message temp-message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}-background);
            color: var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
            padding: 12px 16px;
            border-radius: 6px;
            border: 1px solid var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(messageEl);

        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.remove();
                    }
                }, 300);
            }
        }, 3000);
    }

    analyzeCssConsolidation() {
        const systemFiles = this.stylesheets.filter(s => s.isSystem);
        const pageFiles = this.stylesheets.filter(s => s.isPage);
        
        return {
            systemFiles: systemFiles.length,
            pageFiles: pageFiles.length,
            duplicateRules: 0, // Would analyze for duplicates
            suggestions: [
                'Move all system CSS to devpages/styles/system/',
                'Consolidate page-specific CSS',
                'Remove ID-specific selectors',
                'Use CSS custom properties for theming'
            ]
        };
    }

    showConsolidationPlan(plan) {
        const planHtml = `
            <div class="consolidation-plan">
                <h6>CSS Consolidation Plan</h6>
                <ul>
                    ${plan.suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
                <p>System files: ${plan.systemFiles}, Page files: ${plan.pageFiles}</p>
            </div>
        `;
        
        // Show in a modal or expand section
        logSystemCss('Consolidation plan generated');
    }

    showCssPreview(title, css) {
        // Create a modal or expandable section to show CSS content
        logSystemCss(`Showing CSS preview: ${title}`);
        console.log(css);
    }

    updateCssInjectionMode(mode) {
        logSystemCss(`CSS injection mode changed to: ${mode}`);
        
        // Update the preview target info
        const targetEl = document.getElementById('preview-target');
        const modeEl = document.getElementById('preview-mode');
        
        if (mode === 'stylesheet') {
            targetEl.textContent = '<link> or <style> element';
            modeEl.textContent = 'Stylesheet injection';
        } else {
            targetEl.textContent = 'style attribute';
            modeEl.textContent = 'Inline style injection';
        }
        
        // Dispatch action to update the CSS injection preference
        dispatch({
            type: ActionTypes.SETTINGS_UPDATE_CSS_INJECTION_MODE,
            payload: { mode }
        });
    }

    subscribeToState() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            // React to CSS-related state changes
            if (newState.settings?.preview?.cssFiles !== prevState.settings?.preview?.cssFiles) {
                this.scanStylesheets();
            }
        });
    }

    destroy() {
        logSystemCss('Destroying SystemCssPanel...');
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        logSystemCss('SystemCssPanel destroyed.');
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'system-css-container',
    title: 'System CSS',
    component: SystemCssPanel,
    order: 30,
    defaultCollapsed: true
}); 