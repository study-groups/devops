/**
 * PJA Resizable Grid System
 * A flexible grid layout system with resizable cards that persist their state
 */

class DevWatchResizableCard {
    constructor(options = {}) {
        this.id = options.id || `devwatch-card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.title = options.title || 'Card';
        this.content = options.content || '';
        this.width = options.width || 300;
        this.height = options.height || 200;
        this.minWidth = options.minWidth || 200;
        this.minHeight = options.minHeight || 150;
        this.maxWidth = options.maxWidth || 800;
        this.maxHeight = options.maxHeight || 600;
        this.isCollapsed = options.isCollapsed || false;
        this.isDraggable = options.isDraggable !== false;
        this.isResizable = options.isResizable !== false;
        this.onResize = options.onResize || null;
        this.onMove = options.onMove || null;
        this.onCollapse = options.onCollapse || null;
        
        this.element = null;
        this.contentElement = null;
        this.headerElement = null;
        this.resizeObserver = null;
        
        this.createElement();
        this.setupEventListeners();
        this.loadState();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'pja-resizable-card';
        this.element.id = this.id;
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        
        this.element.innerHTML = `
            <div class="devwatch-card-header">
                <div class="devwatch-card-title-area">
                    ${this.isDraggable ? '<div class="devwatch-card-drag-handle">⋮⋮</div>' : ''}
                    <span class="devwatch-card-title">${this.title}</span>
                </div>
                <div class="devwatch-card-controls">
                    <button class="devwatch-card-collapse-btn" title="Toggle collapse">
                        <span class="collapse-icon">${this.isCollapsed ? '▶' : '▼'}</span>
                    </button>
                </div>
            </div>
            <div class="devwatch-card-content ${this.isCollapsed ? 'collapsed' : ''}">
                ${this.content}
            </div>
            ${this.isResizable ? '<div class="devwatch-card-resize-handle"></div>' : ''}
        `;

        this.headerElement = this.element.querySelector('.devwatch-card-header');
        this.contentElement = this.element.querySelector('.devwatch-card-content');
        
        if (this.isCollapsed) {
            this.element.classList.add('collapsed');
        }
    }

    setupEventListeners() {
        // Collapse toggle
        const collapseBtn = this.element.querySelector('.devwatch-card-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => this.toggleCollapse());
        }

        // Dragging
        if (this.isDraggable) {
            const dragHandle = this.element.querySelector('.devwatch-card-drag-handle');
            if (dragHandle) {
                this.setupDragging(dragHandle);
            }
        }

        // Resizing
        if (this.isResizable) {
            const resizeHandle = this.element.querySelector('.devwatch-card-resize-handle');
            if (resizeHandle) {
                this.setupResizing(resizeHandle);
            }
        }
    }

    setupDragging(handle) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = this.element.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            this.element.style.position = 'absolute';
            this.element.style.zIndex = '1000';
            this.element.classList.add('dragging');
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            this.element.style.left = `${startLeft + deltaX}px`;
            this.element.style.top = `${startTop + deltaY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.element.classList.remove('dragging');
                this.element.style.zIndex = '';
                this.saveState();
                
                if (this.onMove) {
                    this.onMove(this);
                }
            }
        });
    }

    setupResizing(handle) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(this.element).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(this.element).height, 10);
            
            this.element.classList.add('resizing');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, startWidth + e.clientX - startX));
            const newHeight = Math.max(this.minHeight, Math.min(this.maxHeight, startHeight + e.clientY - startY));
            
            this.element.style.width = `${newWidth}px`;
            this.element.style.height = `${newHeight}px`;
            
            this.width = newWidth;
            this.height = newHeight;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                this.element.classList.remove('resizing');
                this.saveState();
                
                if (this.onResize) {
                    this.onResize(this);
                }
            }
        });
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.element.classList.toggle('collapsed', this.isCollapsed);
        this.contentElement.classList.toggle('collapsed', this.isCollapsed);
        
        const icon = this.element.querySelector('.collapse-icon');
        if (icon) {
            icon.textContent = this.isCollapsed ? '▶' : '▼';
        }
        
        this.saveState();
        
        if (this.onCollapse) {
            this.onCollapse(this, this.isCollapsed);
        }
    }

    updateContent(content) {
        this.content = content;
        this.contentElement.innerHTML = content;
    }

    updateTitle(title) {
        this.title = title;
        const titleElement = this.element.querySelector('.devwatch-card-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    saveState() {
        const state = {
            id: this.id,
            width: this.width,
            height: this.height,
            isCollapsed: this.isCollapsed,
            position: {
                left: this.element.style.left,
                top: this.element.style.top
            }
        };
        
        localStorage.setItem(`devwatch-card-${this.id}`, JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem(`devwatch-card-${this.id}`);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.width = state.width || this.width;
                this.height = state.height || this.height;
                this.isCollapsed = state.isCollapsed || this.isCollapsed;
                
                if (state.position && state.position.left && state.position.top) {
                    this.element.style.position = 'absolute';
                    this.element.style.left = state.position.left;
                    this.element.style.top = state.position.top;
                }
                
                this.element.style.width = `${this.width}px`;
                this.element.style.height = `${this.height}px`;
            } catch (e) {
                console.warn('Failed to load card state:', e);
            }
        }
    }

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

class DevWatchResizableGrid {
    constructor(options = {}) {
        this.containerId = options.containerId || 'devwatch-grid-container';
        this.gridGap = options.gridGap || 16;
        this.autoLayout = options.autoLayout !== false;
        this.useColumnLayout = options.useColumnLayout || false;
        this.leftColumnWidth = options.leftColumnWidth || 320;
        this.cards = new Map();
        
        this.container = null;
        this.leftColumn = null;
        this.rightColumn = null;
        this.createElement();
        this.setupStyles();
    }

    createElement() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = this.containerId;
            document.body.appendChild(this.container);
        }
        
        if (this.useColumnLayout) {
            this.container.classList.add('pja-resizable-grid', 'devwatch-column-layout');
            
            // Create left column for controls
            this.leftColumn = document.createElement('div');
            this.leftColumn.className = 'pja-left-column';
            this.leftColumn.style.width = `${this.leftColumnWidth}px`;
            
            // Create right column for resizable cards
            this.rightColumn = document.createElement('div');
            this.rightColumn.className = 'pja-right-column';
            
            this.container.appendChild(this.leftColumn);
            this.container.appendChild(this.rightColumn);
        } else {
            this.container.classList.add('pja-resizable-grid');
        }
    }

    setupStyles() {
        // Inject CSS if not already present
        if (!document.getElementById('pja-resizable-grid-styles')) {
            const style = document.createElement('style');
            style.id = 'pja-resizable-grid-styles';
            style.textContent = `
                .devwatch-resizable-grid {
                    position: relative;
                    width: 100%;
                    height: 100vh;
                    overflow: auto;
                    padding: var(--devwatch-spacing-md, 16px);
                    background: var(--devwatch-color-surface, rgba(255, 255, 255, 0.02));
                }

                .devwatch-resizable-grid.devwatch-column-layout {
                    display: flex;
                    padding: 0;
                    overflow: hidden;
                }

                .devwatch-left-column {
                    flex-shrink: 0;
                    overflow-y: auto;
                    padding: var(--devwatch-spacing-md, 16px);
                    background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.03));
                    border-right: 1px solid var(--devwatch-color-border, rgba(255, 255, 255, 0.1));
                }

                .devwatch-right-column {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--devwatch-spacing-md, 16px);
                    display: flex;
                    flex-direction: column;
                    gap: var(--devwatch-spacing-md, 16px);
                }

                .devwatch-column-layout .devwatch-resizable-card {
                    position: relative;
                    margin: 0;
                    flex-shrink: 0;
                }

                .devwatch-resizable-card {
                    position: relative;
                    background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.05));
                    border: 1px solid var(--devwatch-color-border, rgba(255, 255, 255, 0.1));
                    border-radius: var(--devwatch-border-radius, 8px);
                    box-shadow: var(--devwatch-shadow-sm, 0 2px 4px rgba(0, 0, 0, 0.1));
                    transition: all 0.2s ease;
                    overflow: hidden;
                    display: inline-block;
                    margin: 8px;
                    vertical-align: top;
                }

                .devwatch-resizable-card:hover {
                    box-shadow: var(--devwatch-shadow-md, 0 4px 8px rgba(0, 0, 0, 0.15));
                    border-color: var(--devwatch-color-accent, #0066cc);
                }

                .devwatch-resizable-card.dragging {
                    transform: rotate(2deg);
                    box-shadow: var(--devwatch-shadow-lg, 0 8px 16px rgba(0, 0, 0, 0.2));
                }

                .devwatch-resizable-card.resizing {
                    box-shadow: var(--devwatch-shadow-lg, 0 8px 16px rgba(0, 0, 0, 0.2));
                    border-color: var(--devwatch-color-accent, #0066cc);
                }

                .devwatch-resizable-card.collapsed {
                    height: auto !important;
                }

                .devwatch-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--devwatch-spacing-sm, 12px) var(--devwatch-spacing-md, 16px);
                    background: var(--devwatch-color-surface-accent, rgba(255, 255, 255, 0.08));
                    border-bottom: 1px solid var(--devwatch-color-border-subtle, rgba(255, 255, 255, 0.05));
                    cursor: default;
                }

                .devwatch-card-title-area {
                    display: flex;
                    align-items: center;
                    gap: var(--devwatch-spacing-xs, 8px);
                }

                .devwatch-card-drag-handle {
                    color: var(--devwatch-color-text-muted, #666);
                    cursor: move;
                    user-select: none;
                    padding: 2px;
                    border-radius: 2px;
                    transition: background-color 0.2s ease;
                }

                .devwatch-card-drag-handle:hover {
                    background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.1));
                    color: var(--devwatch-color-text, #fff);
                }

                .devwatch-card-title {
                    font-size: var(--devwatch-font-size-sm, 14px);
                    font-weight: var(--devwatch-font-weight-semibold, 600);
                    color: var(--devwatch-color-text, #fff);
                    margin: 0;
                }

                .devwatch-card-controls {
                    display: flex;
                    gap: var(--devwatch-spacing-xs, 8px);
                }

                .devwatch-card-collapse-btn {
                    background: none;
                    border: none;
                    color: var(--devwatch-color-text-muted, #666);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: var(--devwatch-border-radius-sm, 4px);
                    transition: all 0.2s ease;
                    font-size: 12px;
                }

                .devwatch-card-collapse-btn:hover {
                    background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.1));
                    color: var(--devwatch-color-text, #fff);
                }

                .devwatch-card-content {
                    padding: var(--devwatch-spacing-md, 16px);
                    height: calc(100% - 60px);
                    overflow: auto;
                    transition: all 0.3s ease;
                }

                .devwatch-card-content.collapsed {
                    display: none;
                }

                .devwatch-card-resize-handle {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    width: 16px;
                    height: 16px;
                    cursor: nw-resize;
                    background: linear-gradient(
                        -45deg,
                        transparent 0%,
                        transparent 40%,
                        var(--devwatch-color-border, rgba(255, 255, 255, 0.2)) 40%,
                        var(--devwatch-color-border, rgba(255, 255, 255, 0.2)) 60%,
                        transparent 60%
                    );
                    opacity: 0.6;
                    transition: opacity 0.2s ease;
                }

                .devwatch-card-resize-handle:hover {
                    opacity: 1;
                }

                /* Design token highlights for lists */
                .devwatch-card-content .result-row {
                    padding: var(--devwatch-spacing-sm, 12px);
                    margin-bottom: var(--devwatch-spacing-xs, 8px);
                    background: var(--devwatch-color-surface, rgba(255, 255, 255, 0.03));
                    border: 1px solid var(--devwatch-color-border-subtle, rgba(255, 255, 255, 0.05));
                    border-radius: var(--devwatch-border-radius-sm, 6px);
                    transition: all 0.2s ease;
                }

                .devwatch-card-content .result-row:hover {
                    background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.08));
                    border-color: var(--devwatch-color-accent, #0066cc);
                    transform: translateY(-1px);
                }

                .devwatch-card-content .result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--devwatch-spacing-xs, 8px);
                }

                .devwatch-card-content .result-status {
                    padding: 2px 8px;
                    border-radius: var(--devwatch-border-radius-sm, 4px);
                    font-size: var(--devwatch-font-size-xs, 12px);
                    font-weight: var(--devwatch-font-weight-medium, 500);
                    text-transform: uppercase;
                }

                .devwatch-card-content .result-status.success {
                    background: var(--devwatch-color-success-bg, rgba(34, 197, 94, 0.2));
                    color: var(--devwatch-color-success, #22c55e);
                    border: 1px solid var(--devwatch-color-success, #22c55e);
                }

                .devwatch-card-content .result-status.error {
                    background: var(--devwatch-color-danger-bg, rgba(239, 68, 68, 0.2));
                    color: var(--devwatch-color-danger, #ef4444);
                    border: 1px solid var(--devwatch-color-danger, #ef4444);
                }

                .devwatch-card-content .result-status.running {
                    background: var(--devwatch-color-warning-bg, rgba(245, 158, 11, 0.2));
                    color: var(--devwatch-color-warning, #f59e0b);
                    border: 1px solid var(--devwatch-color-warning, #f59e0b);
                    animation: pulse 2s infinite;
                }

                .devwatch-card-content .result-time {
                    font-size: var(--devwatch-font-size-xs, 12px);
                    color: var(--devwatch-color-text-muted, #666);
                }

                .devwatch-card-content .result-command {
                    font-family: var(--devwatch-font-mono, 'Monaco', 'Menlo', monospace);
                    font-size: var(--devwatch-font-size-xs, 12px);
                    color: var(--devwatch-color-text-secondary, #aaa);
                    background: var(--devwatch-color-surface-variant, rgba(255, 255, 255, 0.05));
                    padding: 4px 8px;
                    border-radius: var(--devwatch-border-radius-sm, 4px);
                    margin-top: 4px;
                }

                .devwatch-card-content .empty-state {
                    text-align: center;
                    color: var(--devwatch-color-text-muted, #666);
                    font-style: italic;
                    padding: var(--devwatch-spacing-lg, 24px);
                    background: var(--devwatch-color-surface, rgba(255, 255, 255, 0.02));
                    border: 2px dashed var(--devwatch-color-border-subtle, rgba(255, 255, 255, 0.1));
                    border-radius: var(--devwatch-border-radius, 8px);
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    addCard(cardOptions) {
        const card = new DevWatchResizableCard(cardOptions);
        this.cards.set(card.id, card);
        
        // Determine which column to add the card to
        const targetColumn = cardOptions.column || 'right';
        
        if (this.useColumnLayout) {
            if (targetColumn === 'left' && this.leftColumn) {
                this.leftColumn.appendChild(card.element);
            } else if (this.rightColumn) {
                this.rightColumn.appendChild(card.element);
            }
        } else {
            this.container.appendChild(card.element);
            
            if (this.autoLayout && !card.element.style.position) {
                this.layoutCards();
            }
        }
        
        return card;
    }

    removeCard(cardId) {
        const card = this.cards.get(cardId);
        if (card) {
            card.destroy();
            this.cards.delete(cardId);
            localStorage.removeItem(`devwatch-card-${cardId}`);
        }
    }

    getCard(cardId) {
        return this.cards.get(cardId);
    }

    layoutCards() {
        // Simple auto-layout for cards that don't have absolute positioning
        let x = 0, y = 0, maxHeight = 0;
        const containerWidth = this.container.clientWidth - 32; // Account for padding
        
        this.cards.forEach(card => {
            if (card.element.style.position !== 'absolute') {
                if (x + card.width > containerWidth) {
                    x = 0;
                    y += maxHeight + this.gridGap;
                    maxHeight = 0;
                }
                
                card.element.style.position = 'absolute';
                card.element.style.left = `${x + 16}px`;
                card.element.style.top = `${y + 16}px`;
                
                x += card.width + this.gridGap;
                maxHeight = Math.max(maxHeight, card.height);
            }
        });
    }

    saveLayout() {
        const layout = {};
        this.cards.forEach((card, id) => {
            layout[id] = {
                width: card.width,
                height: card.height,
                isCollapsed: card.isCollapsed,
                position: {
                    left: card.element.style.left,
                    top: card.element.style.top
                }
            };
        });
        
        localStorage.setItem('devwatch-grid-layout', JSON.stringify(layout));
    }

    loadLayout() {
        const saved = localStorage.getItem('devwatch-grid-layout');
        if (saved) {
            try {
                const layout = JSON.parse(saved);
                this.cards.forEach((card, id) => {
                    if (layout[id]) {
                        const state = layout[id];
                        card.width = state.width || card.width;
                        card.height = state.height || card.height;
                        card.isCollapsed = state.isCollapsed || card.isCollapsed;
                        
                        if (state.position) {
                            card.element.style.position = 'absolute';
                            card.element.style.left = state.position.left || '16px';
                            card.element.style.top = state.position.top || '16px';
                        }
                        
                        card.element.style.width = `${card.width}px`;
                        card.element.style.height = `${card.height}px`;
                    }
                });
            } catch (e) {
                console.warn('Failed to load grid layout:', e);
            }
        }
    }

    clear() {
        this.cards.forEach(card => card.destroy());
        this.cards.clear();
    }
}

// Export for use in other modules
window.DevWatchResizableCard = DevWatchResizableCard;
window.DevWatchResizableGrid = DevWatchResizableGrid;
