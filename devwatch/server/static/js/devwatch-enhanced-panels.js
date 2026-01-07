/**
 * PJA Enhanced Panel System
 * Extends the existing PJA Panel system with resizable panels and flexible layouts
 */

class DevWatchEnhancedPanel extends DevWatchPanel {
    constructor(options = {}) {
        // Call parent constructor first
        super(options);
        
        // Enhanced panel properties
        this.isResizable = options.isResizable !== false;
        this.resizeMode = options.resizeMode || 'width'; // 'width', 'height', 'both'
        this.minWidth = options.minWidth || 250;
        this.maxWidth = options.maxWidth || 800;
        this.minHeight = options.minHeight || 200;
        this.maxHeight = options.maxHeight || 600;
        this.currentWidth = options.width || 300;
        this.currentHeight = options.height || 300;
        this.displayMode = options.displayMode || 'card'; // 'card', 'full', 'inline'
        
        // Resize state
        this.isResizing = false;
        this.resizeStartX = 0;
        this.resizeStartY = 0;
        this.resizeStartWidth = 0;
        this.resizeStartHeight = 0;
        
        // Override the element creation to add resize capabilities
        this.enhancePanel();
        this.loadPanelState();
    }

    enhancePanel() {
        if (!this.element) return;
        
        // Add enhanced panel class
        this.element.classList.add('devwatch-enhanced-panel');
        
        // Set display mode
        this.element.classList.add(`devwatch-panel-${this.displayMode}`);
        
        // Set initial dimensions
        if (this.displayMode === 'card') {
            this.element.style.width = `${this.currentWidth}px`;
            this.element.style.height = `${this.currentHeight}px`;
        }
        
        // Add resize handles if resizable
        if (this.isResizable && this.displayMode === 'card') {
            this.addResizeHandles();
        }
        
        // Add enhanced styling
        this.injectEnhancedStyles();
    }

    addResizeHandles() {
        // Remove existing handles
        this.element.querySelectorAll('.devwatch-resize-handle').forEach(handle => handle.remove());
        
        if (this.resizeMode === 'width' || this.resizeMode === 'both') {
            const rightHandle = document.createElement('div');
            rightHandle.className = 'devwatch-resize-handle devwatch-resize-right';
            rightHandle.addEventListener('mousedown', (e) => this.startResize(e, 'width'));
            this.element.appendChild(rightHandle);
        }
        
        if (this.resizeMode === 'height' || this.resizeMode === 'both') {
            const bottomHandle = document.createElement('div');
            bottomHandle.className = 'devwatch-resize-handle devwatch-resize-bottom';
            bottomHandle.addEventListener('mousedown', (e) => this.startResize(e, 'height'));
            this.element.appendChild(bottomHandle);
        }
        
        if (this.resizeMode === 'both') {
            const cornerHandle = document.createElement('div');
            cornerHandle.className = 'devwatch-resize-handle devwatch-resize-corner';
            cornerHandle.addEventListener('mousedown', (e) => this.startResize(e, 'both'));
            this.element.appendChild(cornerHandle);
        }
    }

    startResize(e, mode) {
        e.preventDefault();
        e.stopPropagation();
        
        this.isResizing = true;
        this.resizeMode = mode;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        this.resizeStartWidth = this.element.offsetWidth;
        this.resizeStartHeight = this.element.offsetHeight;
        
        this.element.classList.add('devwatch-panel-resizing');
        
        // Add global mouse listeners
        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
        
        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
    }

    handleResize(e) {
        if (!this.isResizing) return;
        
        const deltaX = e.clientX - this.resizeStartX;
        const deltaY = e.clientY - this.resizeStartY;
        
        if (this.resizeMode === 'width' || this.resizeMode === 'both') {
            const newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, this.resizeStartWidth + deltaX));
            this.element.style.width = `${newWidth}px`;
            this.currentWidth = newWidth;
        }
        
        if (this.resizeMode === 'height' || this.resizeMode === 'both') {
            const newHeight = Math.max(this.minHeight, Math.min(this.maxHeight, this.resizeStartHeight + deltaY));
            this.element.style.height = `${newHeight}px`;
            this.currentHeight = newHeight;
        }
        
        // Trigger resize event for content updates
        this.element.dispatchEvent(new CustomEvent('panelResize', {
            detail: { width: this.currentWidth, height: this.currentHeight }
        }));
    }

    stopResize() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.element.classList.remove('devwatch-panel-resizing');
        
        // Remove global listeners
        document.removeEventListener('mousemove', this.handleResize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
        
        // Restore text selection
        document.body.style.userSelect = '';
        
        // Save state
        this.savePanelState();
    }

    setDisplayMode(mode) {
        // Remove old mode class
        this.element.classList.remove(`devwatch-panel-${this.displayMode}`);
        
        // Set new mode
        this.displayMode = mode;
        this.element.classList.add(`devwatch-panel-${mode}`);
        
        // Update resize handles
        if (mode === 'card' && this.isResizable) {
            this.addResizeHandles();
            this.element.style.width = `${this.currentWidth}px`;
            this.element.style.height = `${this.currentHeight}px`;
        } else {
            // Remove resize handles for full/inline modes
            this.element.querySelectorAll('.devwatch-resize-handle').forEach(handle => handle.remove());
            if (mode === 'full') {
                this.element.style.width = '';
                this.element.style.height = '';
            }
        }
        
        this.savePanelState();
    }

    // Override updateDisplay to handle resize handles properly when collapsed
    updateDisplay() {
        // Call parent updateDisplay first
        super.updateDisplay();
        
        // Handle resize handles visibility based on collapsed state
        const resizeHandles = this.element.querySelectorAll('.devwatch-resize-handle');
        resizeHandles.forEach(handle => {
            if (this.state.isCollapsed) {
                handle.style.display = 'none';
            } else {
                handle.style.display = '';
            }
        });
    }

    savePanelState() {
        const state = {
            width: this.currentWidth,
            height: this.currentHeight,
            displayMode: this.displayMode,
            isCollapsed: this.state.isCollapsed
        };
        
        localStorage.setItem(`devwatch-enhanced-panel-${this.id}`, JSON.stringify(state));
    }

    loadPanelState() {
        const saved = localStorage.getItem(`devwatch-enhanced-panel-${this.id}`);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.currentWidth = state.width || this.currentWidth;
                this.currentHeight = state.height || this.currentHeight;
                this.displayMode = state.displayMode || this.displayMode;
                
                // Apply loaded state
                if (this.displayMode === 'card') {
                    this.element.style.width = `${this.currentWidth}px`;
                    this.element.style.height = `${this.currentHeight}px`;
                }
                
                this.setDisplayMode(this.displayMode);
            } catch (e) {
                console.warn('Failed to load panel state:', e);
            }
        }
    }

    injectEnhancedStyles() {
        if (document.getElementById('devwatch-enhanced-panel-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'devwatch-enhanced-panel-styles';
        style.textContent = `
            .devwatch-enhanced-panel {
                transition: all 0.2s ease;
                position: relative;
            }

            .devwatch-enhanced-panel.devwatch-panel-resizing {
                transition: none;
                box-shadow: var(--devwatch-shadow-lg, 0 8px 16px rgba(0, 0, 0, 0.2));
                border-color: var(--devwatch-color-accent, #0066cc);
            }

            /* Display Modes */
            .devwatch-panel-card {
                margin-bottom: var(--devwatch-spacing-md, 16px);
                flex-shrink: 0;
            }

            .devwatch-panel-full {
                width: 100% !important;
                margin-bottom: var(--devwatch-spacing-md, 16px);
            }

            .devwatch-panel-inline {
                display: inline-block;
                vertical-align: top;
                margin-right: var(--devwatch-spacing-md, 16px);
                margin-bottom: var(--devwatch-spacing-md, 16px);
            }

            /* Resize Handles */
            .devwatch-resize-handle {
                position: absolute;
                background: var(--devwatch-color-accent, #0066cc);
                opacity: 0;
                transition: opacity 0.2s ease;
                z-index: 10;
            }

            .devwatch-enhanced-panel:hover .devwatch-resize-handle {
                opacity: 0.6;
            }

            .devwatch-resize-handle:hover {
                opacity: 1 !important;
            }

            .devwatch-resize-right {
                top: 0;
                right: -2px;
                width: 4px;
                height: 100%;
                cursor: ew-resize;
            }

            .devwatch-resize-bottom {
                bottom: -2px;
                left: 0;
                width: 100%;
                height: 4px;
                cursor: ns-resize;
            }

            .devwatch-resize-corner {
                bottom: -2px;
                right: -2px;
                width: 12px;
                height: 12px;
                cursor: nw-resize;
                border-radius: 0 0 4px 0;
            }

            /* Enhanced Panel Header */
            .devwatch-enhanced-panel .devwatch-panel__header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .devwatch-panel-mode-controls {
                display: flex;
                gap: 4px;
                margin-left: auto;
            }

            .devwatch-mode-btn {
                width: 20px;
                height: 20px;
                border: 1px solid var(--devwatch-color-border, rgba(255, 255, 255, 0.2));
                background: transparent;
                color: var(--devwatch-color-text-muted, #666);
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .devwatch-mode-btn:hover {
                background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.1));
                color: var(--devwatch-color-text, #fff);
            }

            .devwatch-mode-btn.active {
                background: var(--devwatch-color-accent, #0066cc);
                color: var(--devwatch-color-accent-text, #fff);
                border-color: var(--devwatch-color-accent, #0066cc);
            }

            /* Flexible Layout for Right Column */
            .devwatch-column--right {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: var(--devwatch-spacing-md, 16px);
                align-content: flex-start;
            }

            .devwatch-column--right .devwatch-enhanced-panel {
                flex-shrink: 0;
            }

            /* Stacked mode - force single column */
            .devwatch-column-stacked {
                flex-direction: column !important;
                flex-wrap: nowrap !important;
            }

            .devwatch-column-stacked .devwatch-enhanced-panel {
                width: 100% !important;
                max-width: none !important;
            }

            /* Grid mode - flexible wrapping layout */
            .devwatch-column-grid {
                flex-direction: row;
                flex-wrap: wrap;
                justify-content: flex-start;
                align-items: flex-start;
            }

            .devwatch-column-grid .devwatch-panel-card {
                flex: 0 0 auto;
            }

            .devwatch-column-grid .devwatch-panel-full {
                flex: 1 1 100%;
                width: 100% !important;
            }

            .devwatch-column--right > .devwatch-column-panel-container {
                display: flex;
                flex-wrap: wrap;
                gap: var(--devwatch-spacing-md, 16px);
                width: 100%;
            }

            /* Enhanced content styling */
            .devwatch-enhanced-panel .devwatch-panel__content {
                height: calc(100% - 50px);
                overflow-y: auto;
            }

            .devwatch-panel-card .devwatch-panel__content {
                max-height: calc(100% - 50px);
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Enhanced Column Layout that supports flexible panel arrangements
class DevWatchEnhancedColumnLayout extends DevWatchColumnLayout {
    constructor(options = {}) {
        super(options);
        
        // Create Layout Manager Panel EXPLICITLY for LEFT column
        const layoutManagerPanel = new DevWatchEnhancedPanel({
            id: 'layout-manager-panel',
            title: 'Layout Manager',
            isResizable: true,
            content: `
                <div class="layout-manager-controls">
                    <button id="resize-smallest">Resize Smallest</button>
                    <button id="resize-largest">Resize Largest</button>
                    <button id="arrange-panels">Pack Panels</button>
                </div>
            `
        });

        // EXPLICITLY add to LEFT column
        this.leftColumn.appendChild(layoutManagerPanel.element);

        this.rightColumnMode = options.rightColumnMode || 'grid';
        this.showLayoutControls = options.showLayoutControls !== false;
        
        this.enhanceLayout();
        if (this.showLayoutControls) {
            this.addLayoutControls();
        }
    }

    enhanceLayout() {
        if (this.rightColumn) {
            this.rightColumn.classList.add('devwatch-enhanced-column');
            this.rightColumn.classList.add(`devwatch-column-${this.rightColumnMode}`);
        }
    }

    addLayoutControls() {
        if (!this.rightColumn) return;
        
        // Add layout mode controls to the right column
        const controls = document.createElement('div');
        controls.className = 'pja-layout-controls';
        controls.innerHTML = `
            <div class="pja-layout-mode-buttons">
                <button class="pja-layout-btn ${this.rightColumnMode === 'grid' ? 'active' : ''}" 
                        data-mode="grid" title="Grid Layout (side-by-side)">⊞</button>
                <button class="pja-layout-btn ${this.rightColumnMode === 'stacked' ? 'active' : ''}" 
                        data-mode="stacked" title="Stacked Layout (single column)">⊟</button>
            </div>
        `;
        
        // Add event listeners
        controls.querySelectorAll('.devwatch-layout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setRightColumnMode(mode);
                
                // Update button states
                controls.querySelectorAll('.devwatch-layout-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Insert at the top of the right column
        this.rightColumn.insertBefore(controls, this.rightColumn.firstChild);
        
        // Add styles for layout controls
        this.addLayoutControlStyles();
    }

    addLayoutControlStyles() {
        if (document.getElementById('pja-layout-control-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pja-layout-control-styles';
        style.textContent = `
            .devwatch-layout-controls {
                display: flex;
                justify-content: flex-end;
                padding: var(--devwatch-spacing-sm, 12px);
                border-bottom: 1px solid var(--devwatch-color-border-subtle, rgba(255, 255, 255, 0.05));
                background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.02));
                margin-bottom: var(--devwatch-spacing-md, 16px);
                border-radius: var(--devwatch-border-radius, 6px) var(--devwatch-border-radius, 6px) 0 0;
            }

            .devwatch-layout-mode-buttons {
                display: flex;
                gap: 4px;
            }

            .devwatch-layout-btn {
                width: 28px;
                height: 28px;
                border: 1px solid var(--devwatch-color-border, rgba(255, 255, 255, 0.2));
                background: transparent;
                color: var(--devwatch-color-text-muted, #666);
                border-radius: var(--devwatch-border-radius-sm, 4px);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .devwatch-layout-btn:hover {
                background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.1));
                color: var(--devwatch-color-text, #fff);
                border-color: var(--devwatch-color-accent, #0066cc);
            }

            .devwatch-layout-btn.active {
                background: var(--devwatch-color-accent, #0066cc);
                color: var(--devwatch-color-accent-text, #fff);
                border-color: var(--devwatch-color-accent, #0066cc);
            }
        `;
        
        document.head.appendChild(style);
    }

    addPanel(panel, position = 'right') {
        super.addPanel(panel, position);
        
        // Add mode controls to enhanced panels
        if (panel instanceof DevWatchEnhancedPanel && position === 'right') {
            this.addPanelModeControls(panel);
        }
    }

    addPanelModeControls(panel) {
        const header = panel.element.querySelector('.devwatch-panel__header');
        if (!header) return;
        
        // Check if controls already exist
        if (header.querySelector('.devwatch-panel-mode-controls')) return;
        
        const controls = document.createElement('div');
        controls.className = 'devwatch-panel-mode-controls';
        controls.innerHTML = `
            <button class="pja-mode-btn ${panel.displayMode === 'card' ? 'active' : ''}" 
                    data-mode="card" title="Card Mode">⊡</button>
            <button class="pja-mode-btn ${panel.displayMode === 'full' ? 'active' : ''}" 
                    data-mode="full" title="Full Width">⊟</button>
        `;
        
        // Add event listeners
        controls.querySelectorAll('.devwatch-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mode = btn.dataset.mode;
                
                // Update button states
                controls.querySelectorAll('.devwatch-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Set panel mode
                panel.setDisplayMode(mode);
            });
        });
        
        header.appendChild(controls);
    }

    setRightColumnMode(mode) {
        if (this.rightColumn) {
            this.rightColumn.classList.remove(`devwatch-column-${this.rightColumnMode}`);
            this.rightColumnMode = mode;
            this.rightColumn.classList.add(`devwatch-column-${mode}`);
        }
    }
}

class LayoutManagerPanel extends DevWatchEnhancedPanel {
    constructor(options = {}) {
        super({
            title: 'Layout Manager',
            isResizable: true,
            resizeMode: 'both',
            minWidth: 250,
            minHeight: 300,
            ...options
        });

        this.initializeLayoutControls();
    }

    initializeLayoutControls() {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="layout-controls">
                <button id="resize-smallest">Resize Smallest</button>
                <button id="resize-largest">Resize Largest</button>
                <button id="arrange-panels">Pack Panels</button>
            </div>
        `;

        content.querySelector('#resize-smallest').addEventListener('click', () => this.resizePanelsToSmallest());
        content.querySelector('#resize-largest').addEventListener('click', () => this.resizePanelsToLargest());
        content.querySelector('#arrange-panels').addEventListener('click', () => this.arrangeClosestPack());

        this.setContent(content.outerHTML);
    }

    resizePanelsToSmallest() {
        const panels = this.getPanels();
        if (panels.length === 0) return;

        const smallestWidth = Math.min(...panels.map(panel => panel.minWidth || 250));
        const smallestHeight = Math.min(...panels.map(panel => panel.minHeight || 200));

        panels.forEach(panel => {
            panel.element.style.width = `${smallestWidth}px`;
            panel.element.style.height = `${smallestHeight}px`;
        });
    }

    resizePanelsToLargest() {
        const panels = this.getPanels();
        if (panels.length === 0) return;

        const largestWidth = Math.max(...panels.map(panel => panel.maxWidth || 800));
        const largestHeight = Math.max(...panels.map(panel => panel.maxHeight || 600));

        panels.forEach(panel => {
            panel.element.style.width = `${largestWidth}px`;
            panel.element.style.height = `${largestHeight}px`;
        });
    }

    arrangeClosestPack() {
        const panels = this.getPanels();
        if (panels.length === 0) return;

        const container = this.getParentContainer();
        const containerWidth = container.clientWidth;
        
        let currentX = 0;
        let currentY = 0;
        let maxRowHeight = 0;

        panels.forEach(panel => {
            if (currentX + panel.element.offsetWidth > containerWidth) {
                currentX = 0;
                currentY += maxRowHeight;
                maxRowHeight = 0;
            }

            panel.element.style.position = 'absolute';
            panel.element.style.left = `${currentX}px`;
            panel.element.style.top = `${currentY}px`;

            currentX += panel.element.offsetWidth;
            maxRowHeight = Math.max(maxRowHeight, panel.element.offsetHeight);
        });
    }

    getPanels() {
        const layout = this.element.closest('.devwatch-column-layout');
        const rightColumn = layout.querySelector('.devwatch-column--right');
        return Array.from(rightColumn.querySelectorAll('.devwatch-enhanced-panel'));
    }

    getParentContainer() {
        const layout = this.element.closest('.devwatch-column-layout');
        return layout.querySelector('.devwatch-column--right');
    }
}

// Modify DevWatchEnhancedColumnLayout to add Layout Manager
DevWatchEnhancedColumnLayout.prototype.createLayoutManagerPanel = function() {
    const layoutManagerPanel = new LayoutManagerPanel({
        id: 'layout-manager-panel'
    });

    this.addPanel(layoutManagerPanel, 'left');
    return layoutManagerPanel;
};

// Modify constructor to create layout manager
const originalConstructor = DevWatchEnhancedColumnLayout.prototype.constructor;
DevWatchEnhancedColumnLayout.prototype.constructor = function(options = {}) {
    originalConstructor.call(this, options);
    this.createLayoutManagerPanel();
};

// Export enhanced classes
window.DevWatchEnhancedPanel = DevWatchEnhancedPanel;
window.DevWatchEnhancedColumnLayout = DevWatchEnhancedColumnLayout;
window.LayoutManagerPanel = LayoutManagerPanel;
