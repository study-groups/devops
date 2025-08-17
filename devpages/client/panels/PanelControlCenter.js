/**
 * PanelControlCenter.js - Main panel management interface
 * 
 * This is the leftmost panel that contains cards for managing all other panels.
 * Cards are draggable, reorderable, and provide individual panel controls.
 */

import { BasePanel } from './BasePanel.js';
import { appStore } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';

export class PanelControlCenter extends BasePanel {
    constructor(options = {}) {
        super({
            id: 'panel-control-center',
            title: 'Panel Manager',
            order: -1, // Always leftmost
            width: 280,
            resizable: false, // Fixed width
            collapsible: false, // Always visible when shown
            ...options
        });

        this.managedPanels = new Map();
        this.cardOrder = [];
        this.dragState = null;
        
        this.loadControlState();
    }

    /**
     * Register a panel to be managed by this control center
     */
    registerManagedPanel(panel) {
        const panelId = panel.state.id;
        
        // Create panel control state
        const controlState = {
            id: panelId,
            title: panel.state.title,
            panel: panel,
            visible: panel.state.visible,
            width: panel.state.width,
            order: panel.state.order,
            cardExpanded: true, // Whether the card is expanded in the control center
            ...this.loadPanelControlState(panelId)
        };

        this.managedPanels.set(panelId, controlState);
        
        // Add to card order if not already present
        if (!this.cardOrder.includes(panelId)) {
            this.cardOrder.push(panelId);
        }

        // Sort card order
        this.cardOrder.sort((a, b) => {
            const panelA = this.managedPanels.get(a);
            const panelB = this.managedPanels.get(b);
            return (panelA?.order || 0) - (panelB?.order || 0);
        });

        this.render();
        this.log(`Registered panel: ${panelId}`, 'debug');
    }

    /**
     * Load control state from localStorage
     */
    loadControlState() {
        try {
            const saved = localStorage.getItem('panelControlCenter_state');
            if (saved) {
                const state = JSON.parse(saved);
                this.cardOrder = state.cardOrder || [];
            }
        } catch (error) {
            this.log(`Failed to load control state: ${error.message}`, 'warn');
        }
    }

    /**
     * Load individual panel control state
     */
    loadPanelControlState(panelId) {
        try {
            const saved = localStorage.getItem(`panelControl_${panelId}`);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            this.log(`Failed to load control state for ${panelId}: ${error.message}`, 'warn');
        }
        return {};
    }

    /**
     * Save control state to localStorage
     */
    saveControlState() {
        try {
            // Save overall state
            localStorage.setItem('panelControlCenter_state', JSON.stringify({
                cardOrder: this.cardOrder
            }));

            // Save individual panel states
            for (const [panelId, controlState] of this.managedPanels) {
                localStorage.setItem(`panelControl_${panelId}`, JSON.stringify({
                    visible: controlState.visible,
                    width: controlState.width,
                    order: controlState.order,
                    cardExpanded: controlState.cardExpanded
                }));
            }
        } catch (error) {
            this.log(`Failed to save control state: ${error.message}`, 'warn');
        }
    }

    /**
     * Override createElement to set up elements object
     */
    createElement(container) {
        // Call parent createElement first
        super.createElement(container);
        
        // Set up elements object for control center
        this.elements = {
            content: this.contentElement
        };
    }

    /**
     * Render the control center content
     */
    render() {
        if (!this.elements.content) return;

        const cardsHTML = this.cardOrder.map(panelId => {
            const controlState = this.managedPanels.get(panelId);
            if (!controlState) return '';

            return this.renderPanelCard(controlState);
        }).join('');

        this.elements.content.innerHTML = `
            <div class="panel-control-header">
                <h3>Panel Manager</h3>
                <div class="control-actions">
                    <button class="btn-collapse-all" title="Collapse All">⊟</button>
                    <button class="btn-expand-all" title="Expand All">⊞</button>
                </div>
            </div>
            <div class="panel-cards-container">
                ${cardsHTML}
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render individual panel card
     */
    renderPanelCard(controlState) {
        const { id, title, visible, width, cardExpanded, panel } = controlState;
        
        return `
            <div class="panel-card" data-panel-id="${id}" draggable="true">
                <div class="panel-card-header">
                    <div class="drag-handle">⋮⋮</div>
                    <div class="panel-card-title">${title}</div>
                    <div class="panel-card-controls">
                        <button class="btn-toggle-visibility ${visible ? 'active' : ''}" 
                                title="${visible ? 'Hide' : 'Show'} Panel">
                            ${visible ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button class="btn-card-expand ${cardExpanded ? 'expanded' : ''}" 
                                title="${cardExpanded ? 'Collapse' : 'Expand'} Card">
                            ${cardExpanded ? '▼' : '▶'}
                        </button>
                    </div>
                </div>
                <div class="panel-card-body ${cardExpanded ? 'expanded' : 'collapsed'}">
                    <div class="panel-preview">
                        ${this.renderPanelPreview(panel)}
                    </div>
                    <div class="panel-controls">
                        <label class="control-group">
                            <span>Width:</span>
                            <input type="range" class="width-slider" 
                                   min="200" max="500" value="${width}"
                                   data-panel-id="${id}">
                            <span class="width-value">${width}px</span>
                        </label>
                        <div class="panel-actions">
                            <button class="btn-panel-settings" data-panel-id="${id}">Settings</button>
                            <button class="btn-panel-reset" data-panel-id="${id}">Reset</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render preview of managed panel
     */
    renderPanelPreview(panel) {
        // Create a mini preview of the panel content
        // This could be a thumbnail or simplified view
        return `
            <div class="panel-mini-preview">
                <div class="preview-header">${panel.state.title}</div>
                <div class="preview-content">
                    ${this.getPanelPreviewContent(panel)}
                </div>
            </div>
        `;
    }

    /**
     * Get preview content for specific panel types
     */
    getPanelPreviewContent(panel) {
        switch (panel.state.id) {
            case 'context-panel':
                return `
                    <div class="mini-breadcrumbs">📁 Root / Project</div>
                    <div class="mini-files">📄 Files: 3</div>
                `;
            case 'code-panel':
                return `
                    <div class="mini-file-tree">🌳 File Tree</div>
                    <div class="mini-file-count">📁 Dirs: 2, 📄 Files: 5</div>
                `;
            default:
                return `<div class="mini-placeholder">Panel Preview</div>`;
        }
    }

    /**
     * Attach event listeners for card interactions
     */
    attachEventListeners() {
        if (!this.elements.content) return;

        // Visibility toggles
        this.elements.content.querySelectorAll('.btn-toggle-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panelId = btn.closest('.panel-card').dataset.panelId;
                this.togglePanelVisibility(panelId);
            });
        });

        // Card expand/collapse
        this.elements.content.querySelectorAll('.btn-card-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panelId = btn.closest('.panel-card').dataset.panelId;
                this.toggleCardExpansion(panelId);
            });
        });

        // Width sliders
        this.elements.content.querySelectorAll('.width-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const panelId = e.target.dataset.panelId;
                const width = parseInt(e.target.value);
                this.updatePanelWidth(panelId, width);
            });
        });

        // Drag and drop
        this.setupDragAndDrop();

        // Header actions
        const collapseAllBtn = this.elements.content.querySelector('.btn-collapse-all');
        const expandAllBtn = this.elements.content.querySelector('.btn-expand-all');
        
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', () => this.collapseAllCards());
        }
        if (expandAllBtn) {
            expandAllBtn.addEventListener('click', () => this.expandAllCards());
        }
    }

    /**
     * Setup drag and drop for card reordering
     */
    setupDragAndDrop() {
        const cards = this.elements.content.querySelectorAll('.panel-card');
        
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.dragState = {
                    draggedId: card.dataset.panelId,
                    startIndex: Array.from(cards).indexOf(card)
                };
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.dragState = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.dragState && card.dataset.panelId !== this.dragState.draggedId) {
                    const rect = card.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    
                    if (e.clientY < midpoint) {
                        card.classList.add('drop-above');
                        card.classList.remove('drop-below');
                    } else {
                        card.classList.add('drop-below');
                        card.classList.remove('drop-above');
                    }
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drop-above', 'drop-below');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drop-above', 'drop-below');
                
                if (this.dragState) {
                    this.reorderCard(this.dragState.draggedId, card.dataset.panelId, e.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
                }
            });
        });
    }

    /**
     * Toggle panel visibility
     */
    togglePanelVisibility(panelId) {
        const controlState = this.managedPanels.get(panelId);
        if (!controlState) return;

        controlState.visible = !controlState.visible;
        
        // Update the actual panel
        if (controlState.visible) {
            controlState.panel.show();
        } else {
            controlState.panel.hide();
        }

        this.saveControlState();
        this.render();
        
        this.log(`Panel ${panelId} visibility: ${controlState.visible}`, 'debug');
    }

    /**
     * Toggle card expansion
     */
    toggleCardExpansion(panelId) {
        const controlState = this.managedPanels.get(panelId);
        if (!controlState) return;

        controlState.cardExpanded = !controlState.cardExpanded;
        this.saveControlState();
        this.render();
    }

    /**
     * Update panel width
     */
    updatePanelWidth(panelId, width) {
        const controlState = this.managedPanels.get(panelId);
        if (!controlState) return;

        controlState.width = width;
        controlState.panel.setWidth(width);

        // Update the width display
        const widthValue = this.elements.content.querySelector(`input[data-panel-id="${panelId}"]`)?.nextElementSibling;
        if (widthValue) {
            widthValue.textContent = `${width}px`;
        }

        this.saveControlState();
    }

    /**
     * Reorder cards
     */
    reorderCard(draggedId, targetId, insertBefore) {
        const draggedIndex = this.cardOrder.indexOf(draggedId);
        const targetIndex = this.cardOrder.indexOf(targetId);
        
        if (draggedIndex === -1 || targetIndex === -1) return;

        // Remove dragged item
        this.cardOrder.splice(draggedIndex, 1);
        
        // Insert at new position
        const newTargetIndex = this.cardOrder.indexOf(targetId);
        const insertIndex = insertBefore ? newTargetIndex : newTargetIndex + 1;
        this.cardOrder.splice(insertIndex, 0, draggedId);

        // Update panel orders
        this.cardOrder.forEach((panelId, index) => {
            const controlState = this.managedPanels.get(panelId);
            if (controlState) {
                controlState.order = index;
                controlState.panel.updateOrder(index);
            }
        });

        this.saveControlState();
        this.render();
        
        // Dispatch reorder action
        const dockId = this.managedPanels.get(draggedId)?.panel.state.dockId;
        if (dockId) {
            appStore.dispatch(panelActions.reorderPanels({ dockId, panelOrder: this.cardOrder.slice() }));
        }
    }

    /**
     * Collapse all cards
     */
    collapseAllCards() {
        for (const controlState of this.managedPanels.values()) {
            controlState.cardExpanded = false;
        }
        this.saveControlState();
        this.render();
    }

    /**
     * Expand all cards
     */
    expandAllCards() {
        for (const controlState of this.managedPanels.values()) {
            controlState.cardExpanded = true;
        }
        this.saveControlState();
        this.render();
    }

    /**
     * Get current panel states for external access
     */
    getPanelStates() {
        const states = {};
        for (const [panelId, controlState] of this.managedPanels) {
            states[panelId] = {
                visible: controlState.visible,
                width: controlState.width,
                order: controlState.order,
                cardExpanded: controlState.cardExpanded
            };
        }
        return states;
    }

    /**
     * Initialize the control center
     */
    mount(container) {
        const result = super.mount(container);
        
        // Load external CSS for panel control center
        this.loadControlCenterCSS();
        
        this.log('Panel Control Center mounted', 'info');
        return result;
    }

    /**
     * Cleanup
     */
    destroy() {
        super.destroy();
        this.managedPanels.clear();
        this.cardOrder = [];
    }
} 