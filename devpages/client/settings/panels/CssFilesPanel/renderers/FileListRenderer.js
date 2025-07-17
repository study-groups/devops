/**
 * client/settings/panels/css-files/renderers/FileListRenderer.js
 * Renderer for CSS file lists and individual file items
 */

export class FileListRenderer {
    constructor() {
        this.onToggleFile = null;
        this.onViewFile = null;
        this.eventHandlers = {};
    }

    /**
     * Set callbacks for file interactions
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks) {
        this.onToggleFile = callbacks.onToggleFile;
        this.onViewFile = callbacks.onViewFile;
        this.eventHandlers = callbacks;
    }

    /**
     * Render a summary section with statistics
     * @param {Object} stats - Statistics object
     * @returns {string} HTML string
     */
    renderSummarySection(stats) {
        return `
            <div class="css-summary-section" style="background: var(--color-background-secondary, #f8f9fa); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 16px; color: var(--color-foreground, #333);">📊 CSS Files Overview</h3>
                    <button class="refresh-css-btn" style="background: var(--color-primary, #007bff); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        🔄 Refresh
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; font-size: 14px;">
                    <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 6px;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--color-primary, #007bff);">${stats.total}</div>
                        <div style="font-size: 12px; color: var(--color-foreground-secondary, #666);">Total Files</div>
                    </div>
                    
                    <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 6px;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--color-success, #28a745);">${stats.enabled}</div>
                        <div style="font-size: 12px; color: var(--color-foreground-secondary, #666);">Enabled</div>
                    </div>
                    
                    <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 6px;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--color-danger, #dc3545);">${stats.disabled}</div>
                        <div style="font-size: 12px; color: var(--color-foreground-secondary, #666);">Disabled</div>
                    </div>
                    
                    <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 6px;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--color-info, #17a2b8);">${stats.external}</div>
                        <div style="font-size: 12px; color: var(--color-foreground-secondary, #666);">External</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a collapsible section
     * @param {string} title - Section title
     * @param {string} content - Section content HTML
     * @returns {string} HTML string
     */
    renderSection(title, content) {
        const sectionId = `css-section-${title.replace(/\s+/g, '-')}`;
        
        return `
            <div class="settings-section-container">
                <h2 class="settings-section-header" tabindex="0">
                    <span class="collapse-indicator">▼</span>
                    ${title}
                </h2>
                <div class="settings-section-content">
                    ${content}
                </div>
            </div>
        `;
    }

    /**
     * Render a list of CSS files grouped by category
     * @param {Object} categories - Categorized CSS files
     * @returns {string} HTML string
     */
    renderCategorizedFileList(categories) {
        return `
            <div class="css-files-list">
                ${this.renderCategory('Theme Files', categories.theme, 'theme', '🎨')}
                ${this.renderCategory('System Files', categories.system, 'system', '⚙️')}
                ${this.renderCategory('Other Files', categories.other, 'other', '📄')}
            </div>
        `;
    }

    /**
     * Render a category of CSS files
     */
    renderCategory(title, files, categoryId, icon) {
        if (files.size === 0) {
            return '';
        }

        const filesList = Array.from(files.entries())
            .map(([href, cssFile]) => this.renderCssFileItem(href, cssFile))
            .join('');

        return `
            <div class="css-category" data-category="${categoryId}" style="margin-bottom: 20px;">
                <div class="category-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--color-border, #eee); cursor: pointer;" data-section="${categoryId}">
                    <h4 style="margin: 0; font-size: 14px; color: var(--color-foreground, #333); display: flex; align-items: center; gap: 8px;">
                        <span class="category-toggle">▼</span>
                        ${icon} ${title} (${files.size})
                    </h4>
                </div>
                
                <div class="category-content" data-category-content="${categoryId}" style="padding-top: 8px;">
                    ${filesList}
                </div>
            </div>
        `;
    }

    /**
     * Render individual CSS file item
     */
    renderCssFileItem(href, cssFile) {
        const fileName = this.getDisplayName(cssFile);
        const isDisabled = cssFile.disabled;
        
        return `
            <div class="stylesheet-item ${isDisabled ? 'stylesheet-disabled' : ''}" 
                 data-href="${href}" 
                 style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin: 4px 0; background: var(--color-background, white); border: 1px solid var(--color-border, #eee); border-radius: 6px; ${isDisabled ? 'opacity: 0.6;' : ''}">
                
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 12px;">${cssFile.type === 'external' ? '🔗' : '📝'}</span>
                        <span style="font-weight: 500; font-size: 13px; color: var(--color-foreground, #333); word-break: break-all;">
                            ${fileName}
                        </span>
                    </div>
                    
                    <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); display: flex; gap: 12px;">
                        <span>Type: ${cssFile.type}</span>
                        <span>Media: ${cssFile.media}</span>
                        ${cssFile.type === 'inline' && cssFile.content ? `<span>Preview: ${cssFile.content}</span>` : ''}
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; margin-left: 12px;">
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 12px;">
                        <input type="checkbox" class="css-toggle" data-href="${href}" ${!isDisabled ? 'checked' : ''} 
                               style="margin-right: 4px;">
                        ${isDisabled ? 'Disabled' : 'Enabled'}
                    </label>
                    
                    <button class="view-css-btn" data-href="${href}" 
                            style="background: var(--color-secondary, #6c757d); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">
                        👁️ View
                    </button>
                    
                    <button class="debug-css-btn" data-href="${href}" 
                            style="background: var(--color-warning, #ffc107); color: black; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">
                        🐛 Debug
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render the CSS content modal
     * @returns {string} HTML string
     */
    renderCssModal() {
        return `
            <div id="css-modal" class="css-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; align-items: center; justify-content: center;">
                <div class="css-modal-content" style="background: var(--color-background, white); border-radius: 8px; padding: 0; max-width: 90vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                    <div class="css-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--color-border, #eee);">
                        <h2 class="css-modal-title" style="margin: 0; font-size: 18px; color: var(--color-foreground, #333);"></h2>
                        <button class="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-foreground-muted, #666);">&times;</button>
                    </div>
                    
                    <div class="css-modal-body" style="flex: 1; overflow: auto; padding: 20px;">
                        <pre class="css-content" style="background: var(--color-background-secondary, #f8f9fa); padding: 16px; border-radius: 6px; overflow: auto; margin: 0; font-family: var(--font-family-mono, monospace); font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;"></pre>
                    </div>
                    
                    <div class="css-modal-footer" style="padding: 20px; border-top: 1px solid var(--color-border, #eee); text-align: right;">
                        <button class="close-modal" style="padding: 8px 16px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create modal element
     */
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'css-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); 
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--color-background, white); border-radius: 8px; padding: 0; max-width: 90vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--color-border, #eee);">
                    <h2 style="margin: 0; font-size: 18px; color: var(--color-foreground, #333);">${title}</h2>
                    <button class="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-foreground-muted, #666);">&times;</button>
                </div>
                
                <div style="flex: 1; overflow: auto; padding: 20px;">
                    <pre style="background: var(--color-background-secondary, #f8f9fa); padding: 16px; border-radius: 6px; overflow: auto; margin: 0; font-family: var(--font-family-mono, monospace); font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;">${this.escapeHtml(content)}</pre>
                </div>
                
                <div style="padding: 20px; border-top: 1px solid var(--color-border, #eee); text-align: right;">
                    <button class="close-modal" style="padding: 8px 16px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * Setup event listeners for rendered elements
     * @param {Element} container - Container element
     * @param {Object} callbacks - Callback functions
     */
    setupEventListeners(container, callbacks) {
        // Refresh button
        const refreshBtn = container.querySelector('.refresh-css-btn');
        if (refreshBtn && callbacks.onRefresh) {
            refreshBtn.addEventListener('click', callbacks.onRefresh);
        }

        // Category toggles
        container.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const categoryId = e.currentTarget.dataset.section;
                const content = container.querySelector(`[data-category-content="${categoryId}"]`);
                const toggle = e.currentTarget.querySelector('.category-toggle');
                
                if (content && toggle) {
                    const isCollapsed = content.style.display === 'none';
                    content.style.display = isCollapsed ? 'block' : 'none';
                    toggle.textContent = isCollapsed ? '▼' : '▶';
                }
            });
        });

        // CSS file toggles
        container.querySelectorAll('.css-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const href = e.currentTarget.dataset.href;
                const enabled = e.currentTarget.checked;
                if (callbacks.onToggleFile) callbacks.onToggleFile(href, enabled);
            });
        });

        // View CSS buttons
        container.querySelectorAll('.view-css-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const href = e.currentTarget.dataset.href;
                if (callbacks.onViewFile) callbacks.onViewFile(href);
            });
        });

        // Debug CSS buttons
        container.querySelectorAll('.debug-css-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const href = e.currentTarget.dataset.href;
                if (callbacks.onDebugFile) callbacks.onDebugFile(href);
            });
        });

        // Modal close handlers
        this.setupModalListeners(container);
    }

    /**
     * Setup modal listeners
     * @param {Element} container - Container element
     */
    setupModalListeners(container) {
        const modal = container.querySelector('.css-modal');
        if (modal) {
            const closeBtn = modal.querySelector('.close-modal');
            const backdrop = modal.querySelector('.css-modal-backdrop');
            
            const closeModal = () => {
                modal.style.display = 'none';
                document.removeEventListener('keydown', handleEscape);
            };

            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                }
            };

            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (backdrop) backdrop.addEventListener('click', closeModal);
        }
    }

    /**
     * Get type order for sorting
     * @param {Object} file - File object
     * @returns {number} Sort order
     */
    getTypeOrder(file) {
        if (file.isTheme) return 1;
        if (file.isSystem) return 2;
        return 3; // other
    }

    /**
     * Extract filename from href
     * @param {string} href - File href
     * @returns {string} Filename
     */
    getFileName(href) {
        if (href.startsWith('inline-')) {
            return href;
        }
        try {
            return new URL(href).pathname.split('/').pop() || href;
        } catch {
            return href;
        }
    }

    /**
     * Get display name for CSS file
     */
    getDisplayName(cssFile) {
        if (cssFile.title && cssFile.title !== cssFile.href) {
            return cssFile.title;
        }
        
        if (cssFile.href.startsWith('<style')) {
            return cssFile.href;
        }
        
        try {
            const url = new URL(cssFile.href);
            return url.pathname.split('/').pop() || 'unknown.css';
        } catch (e) {
            return cssFile.href.split('/').pop() || 'unknown.css';
        }
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destroy the renderer
     */
    destroy() {
        this.eventHandlers = {};
        console.log('[FileListRenderer] Destroyed');
    }
} 