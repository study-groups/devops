/**
 * @file client/panels/core/SubPanel.js
 * @description A simple, stateless collapsible panel component for use inside other panels.
 */

export class SubPanel {
    /**
     * @param {object} options - The options for the sub-panel.
     * @param {string} options.title - The title of the sub-panel.
     * @param {boolean} options.miniTabMode - Whether to show view mode controls.
     * @param {boolean} options.showViewModeControls - Whether to show view mode controls.
     */
    constructor(title, miniTabMode = false, showViewModeControls = false) {
        this.title = title;
        this.miniTabMode = miniTabMode;
        this.showViewModeControls = showViewModeControls;
        this.isCollapsed = false;
        this.element = null;
        
        // Default view mode - matrix for color categories, list for others
        this.currentViewMode = miniTabMode ? 'matrix' : 'list';
    }

    /**
     * Create the sub-panel element.
     * @param {HTMLElement} content - The content to display inside the sub-panel.
     * @returns {HTMLElement} The sub-panel element.
     */
    createElement(content) {
        const subPanel = document.createElement('div');
        subPanel.className = 'sub-panel';
        subPanel.dataset.subPanelId = this.title;

        const header = document.createElement('div');
        header.className = 'sub-panel-header';
        
        // Create title element
        const titleElement = document.createElement('span');
        titleElement.className = 'sub-panel-title';
        titleElement.textContent = this.title;
        header.appendChild(titleElement);

        // Add view mode controls in the center if enabled
        if (this.miniTabMode) {
            const viewModeControls = document.createElement('div');
            viewModeControls.className = 'view-mode-controls';
            viewModeControls.innerHTML = `
                <button class="view-mode-btn ${this.currentViewMode === 'list' ? 'active' : ''}" data-mode="list" title="List View">☰</button>
                <button class="view-mode-btn ${this.currentViewMode === 'grid' ? 'active' : ''}" data-mode="grid" title="Grid View">⊞</button>
                <button class="view-mode-btn ${this.currentViewMode === 'matrix' ? 'active' : ''}" data-mode="matrix" title="Matrix View">▦</button>
            `;
            header.appendChild(viewModeControls);
        }

        // Create toggle element
        const toggleElement = document.createElement('span');
        toggleElement.className = 'sub-panel-toggle';
        toggleElement.textContent = '▼';
        header.appendChild(toggleElement);

        const subPanelContent = document.createElement('div');
        subPanelContent.className = 'sub-panel-content';
        
        // Add view mode classes
        if (this.currentViewMode === 'matrix') {
            subPanelContent.classList.add('matrix-mode');
        } else if (this.currentViewMode === 'grid') {
            subPanelContent.classList.add('grid-mode');
        }

        if (content) {
            if (typeof content === 'string') {
                subPanelContent.innerHTML = content;
            } else {
                subPanelContent.appendChild(content);
            }
        }

        subPanel.appendChild(header);
        subPanel.appendChild(subPanelContent);

        this.element = subPanel;
        return subPanel;
    }

    /**
     * Attach event listeners to the sub-panel.
     */
    attachEventListeners() {
        if (!this.element) return;

        const header = this.element.querySelector('.sub-panel-header');
        const toggle = this.element.querySelector('.sub-panel-toggle');
        const viewControls = this.element.querySelector('.view-mode-controls');

        if (header && toggle) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.view-mode-controls')) {
                    return; // Don't toggle collapse when clicking view controls
                }
                this.toggle();
            });
        }

        if (viewControls) {
            viewControls.addEventListener('click', (e) => {
                const btn = e.target.closest('.view-mode-btn');
                if (btn) {
                    const mode = btn.dataset.mode;
                    this.setViewMode(mode);
                }
            });
        }
    }

    /**
     * Set the view mode (list or grid).
     * @param {string} mode - The view mode ('list' or 'grid').
     */
    setViewMode(mode) {
        if (mode === this.currentViewMode) return;

        this.currentViewMode = mode;

        // Update button states
        const buttons = this.element.querySelectorAll('.view-mode-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update content classes
        const content = this.element.querySelector('.sub-panel-content');
        if (content) {
            content.classList.remove('matrix-mode', 'grid-mode');
            if (mode === 'matrix') {
                content.classList.add('matrix-mode');
            } else if (mode === 'grid') {
                content.classList.add('grid-mode');
            }
        }
    }

    /**
     * Toggle the collapsed state of the sub-panel.
     */
    toggle() {
        if (!this.element) return;

        this.isCollapsed = !this.isCollapsed;
        const content = this.element.querySelector('.sub-panel-content');
        const toggle = this.element.querySelector('.sub-panel-toggle');

        if (content) {
            content.style.display = this.isCollapsed ? 'none' : 'block';
        }

        if (toggle) {
            toggle.textContent = this.isCollapsed ? '▶' : '▼';
        }
    }

    /**
     * Get the current collapsed state.
     * @returns {boolean} Whether the sub-panel is collapsed.
     */
    getCollapsed() {
        return this.isCollapsed;
    }

    /**
     * Set the collapsed state.
     * @param {boolean} collapsed - Whether to collapse the sub-panel.
     */
    setCollapsed(collapsed) {
        if (this.isCollapsed !== collapsed) {
            this.toggle();
        }
    }
} 