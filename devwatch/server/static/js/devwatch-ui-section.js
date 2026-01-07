/**
 * DevWatchUiSection - Reusable collapsible section component for PJA interfaces
 * Supports left/right positioning, auto-collapse when space is constrained,
 * and drag-drop reordering within column containers.
 */

class DevWatchUiSection {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.title = options.title || 'Section';
        this.content = options.content || '';
        this.isOpen = options.isOpen !== false; // Default to open
        this.position = options.position || 'left'; // 'left' or 'right'
        this.isDraggable = options.isDraggable !== false; // Default to draggable
        this.autoCollapse = options.autoCollapse !== false; // Auto-collapse when space limited
        this.className = options.className || '';
        this.parentContainer = options.parentContainer;
        
        this.element = this.createElement();
        this.setupEventListeners();
        
        if (this.parentContainer) {
            this.parentContainer.appendChild(this.element);
        }
    }
    
    generateId() {
        return 'devwatch-section-' + Math.random().toString(36).substr(2, 9);
    }
    
    createElement() {
        const section = document.createElement('details');
        section.id = this.id;
        section.className = `pja-ui-section ${this.className} position-${this.position}`;
        section.open = this.isOpen;
        
        if (this.isDraggable) {
            section.draggable = true;
            section.classList.add('pja-draggable');
        }
        
        section.innerHTML = `
            <summary class="devwatch-section-header" style="cursor:pointer;">
                <div class="devwatch-section-title-area">
                    ${this.isDraggable ? '<span class="pja-drag-handle">⋮⋮</span>' : ''}
                    <span class="devwatch-section-title">${this.title}</span>
                </div>
                <div class="devwatch-section-controls">
                    <!-- ARROWS REMOVED AS REQUESTED -->
                </div>
            </summary>
            <div class="devwatch-section-content">
                ${this.content}
            </div>
        `;
        
        return section;
    }
    
    setupEventListeners() {
        const summary = this.element.querySelector('summary');
        
        // Toggle functionality - just click on header
        summary.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggle();
        });
        
        // Drag and drop if enabled
        if (this.isDraggable) {
            this.setupDragAndDrop();
        }
        
        // Auto-collapse on resize if enabled
        if (this.autoCollapse) {
            this.setupAutoCollapse();
        }
    }
    
    setupDragAndDrop() {
        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', this.id);
            this.element.classList.add('dragging');
        });
        
        this.element.addEventListener('dragend', (e) => {
            this.element.classList.remove('dragging');
            this.removeDragOverClasses();
            this.saveState();
        });
        
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.element.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!this.element.classList.contains('dragging')) {
                this.element.classList.add('drag-over');
            }
        });

        this.element.addEventListener('dragleave', (e) => {
            if (!this.element.contains(e.relatedTarget)) {
                this.element.classList.remove('drag-over');
            }
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId && draggedId !== this.id) {
                this.handleSectionDrop(draggedId);
            }
            this.removeDragOverClasses();
        });
    }

    handleSectionDrop(draggedSectionId) {
        const draggedSection = document.getElementById(draggedSectionId);
        const targetColumn = this.element.closest('.devwatch-column');
        
        if (draggedSection && targetColumn) {
            // Insert the dragged section after this section
            targetColumn.insertBefore(draggedSection, this.element.nextSibling);
            this.updateColumnLayouts();
            this.saveState();
        }
    }

    removeDragOverClasses() {
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }
    
    setupAutoCollapse() {
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const container = entry.target;
                const containerWidth = container.clientWidth;
                
                // Auto-collapse when container gets narrow (< 400px)
                if (containerWidth < 400 && this.isOpen) {
                    this.collapse();
                } else if (containerWidth >= 400 && !this.isOpen && this.autoCollapse) {
                    this.expand();
                }
            }
        });
        
        const container = this.element.closest('.devwatch-column-container') || this.element.parentElement;
        if (container) {
            resizeObserver.observe(container);
        }
    }
    
    toggle() {
        if (this.isOpen) {
            this.collapse();
        } else {
            this.expand();
        }
    }
    
    collapse() {
        this.isOpen = false;
        this.element.open = false;
        this.element.dispatchEvent(new CustomEvent('pja:section:collapsed', { detail: this }));
        this.updateColumnLayouts();
        this.saveState();
    }
    
    expand() {
        this.isOpen = true;
        this.element.open = true;
        this.element.dispatchEvent(new CustomEvent('pja:section:expanded', { detail: this }));
        this.updateColumnLayouts();
        this.saveState();
    }

    updateColumnLayouts() {
        // Update column flex properties based on section states
        const columns = document.querySelectorAll('.devwatch-column');
        
        columns.forEach(column => {
            const openSections = column.querySelectorAll('.devwatch-ui-section[open]');
            const totalSections = column.querySelectorAll('.devwatch-ui-section');
            
            // Check if column has been manually resized (has data attribute)
            const hasManualResize = column.dataset.manuallyResized === 'true';
            
            // Only mark column as collapsed if it has no sections at all
            // If it has sections (even if all closed), keep it expanded to fill space
            // Don't override manually resized columns
            if (totalSections.length === 0) {
                column.classList.add('collapsed');
                column.classList.remove('expanded');
                // Clear manual resize if column is empty
                if (hasManualResize) {
                    column.style.removeProperty('flex');
                    delete column.dataset.manuallyResized;
                }
            } else if (!hasManualResize) {
                // Only apply expanded class if not manually resized
                column.classList.remove('collapsed');
                column.classList.add('expanded');
            } else {
                // Column is manually resized, remove both classes to let inline style take precedence
                column.classList.remove('collapsed');
                column.classList.remove('expanded');
            }
        });
    }

    saveState() {
        try {
            const state = DevWatchUiSection.collectLayoutState();
            localStorage.setItem('pja-ui-layout', JSON.stringify(state));
        } catch (e) {
            console.warn('Could not save UI layout state:', e);
        }
    }

    static collectLayoutState() {
        const state = {
            sections: {},
            columns: {}
        };

        // Collect section states
        document.querySelectorAll('.devwatch-ui-section').forEach(section => {
            const column = section.closest('.devwatch-column');
            state.sections[section.id] = {
                isOpen: section.hasAttribute('open'),
                columnId: column?.dataset.columnId || 'left'
            };
        });

        // Collect column order
        document.querySelectorAll('.devwatch-column').forEach(column => {
            const columnId = column.dataset.columnId;
            if (columnId) {
                const sectionIds = Array.from(column.querySelectorAll('.devwatch-ui-section')).map(s => s.id);
                state.columns[columnId] = sectionIds;
            }
        });

        return state;
    }

    static loadState() {
        try {
            const saved = localStorage.getItem('pja-ui-layout');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.warn('Could not load UI layout state:', e);
            return null;
        }
    }

    static restoreLayout(state, delay = 100) {
        if (!state) return;

        setTimeout(() => {
            // Restore section states
            Object.entries(state.sections || {}).forEach(([sectionId, sectionState]) => {
                const section = document.getElementById(sectionId);
                if (section) {
                    if (sectionState.isOpen) {
                        section.setAttribute('open', '');
                    } else {
                        section.removeAttribute('open');
                    }
                }
            });

            // Restore column order
            Object.entries(state.columns || {}).forEach(([columnId, sectionIds]) => {
                const column = document.querySelector(`[data-column-id="${columnId}"]`);
                if (column && sectionIds) {
                    sectionIds.forEach(sectionId => {
                        const section = document.getElementById(sectionId);
                        if (section && section.parentNode !== column) {
                            column.appendChild(section);
                        }
                    });
                }
            });

            // Update column layouts after restore
            const anySection = document.querySelector('.devwatch-ui-section');
            if (anySection) {
                // Create a temporary instance to call updateColumnLayouts
                const tempSection = Object.create(DevWatchUiSection.prototype);
                tempSection.updateColumnLayouts();
            }
        }, delay);
    }
    
    setContent(newContent) {
        this.content = newContent;
        const contentEl = this.element.querySelector('.devwatch-section-content');
        if (contentEl) {
            contentEl.innerHTML = newContent;
        }
    }
    
    setTitle(newTitle) {
        this.title = newTitle;
        const titleEl = this.element.querySelector('.devwatch-section-title');
        if (titleEl) {
            titleEl.textContent = newTitle;
        }
    }
    
    destroy() {
        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }
    }
}

/**
 * DevWatchColumnContainer - Container for resizable columns with drag-drop reordering
 */
class DevWatchColumnContainer {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.columns = options.columns || ['left', 'right'];
        this.resizable = options.resizable !== false;
        this.className = options.className || '';
        this.parentContainer = options.parentContainer;
        
        this.element = this.createElement();
        this.sections = new Map();
        
        if (this.resizable) {
            this.setupResizing();
        }
        
        if (this.parentContainer) {
            this.parentContainer.appendChild(this.element);
        }
    }
    
    generateId() {
        return 'pja-container-' + Math.random().toString(36).substr(2, 9);
    }
    
    createElement() {
        const container = document.createElement('div');
        container.id = this.id;
        container.className = `devwatch-column-container ${this.className}`;
        
        this.columns.forEach((columnId, index) => {
            const column = document.createElement('div');
            column.className = `devwatch-column devwatch-column-${columnId}`;
            column.dataset.columnId = columnId;
            
            // Add default flex basis - ensure columns maintain size
            if (index === 0) {
                column.style.flex = '0 0 280px'; // Left column: fixed width
                column.style.minWidth = '280px';
                column.style.maxWidth = '280px';
                column.dataset.position = 'left';
            } else {
                column.style.flex = '1 1 0'; // Right column: takes remaining space
                column.style.minWidth = '400px'; // Minimum width for right column
                column.dataset.position = 'right';
            }
            
            // Ensure column maintains its size regardless of content
            column.style.height = '100%';
            column.style.overflowY = 'auto';
            column.style.overflowX = 'hidden';
            
            container.appendChild(column);
            
            // Add resizer between columns (except after last)
            if (index < this.columns.length - 1 && this.resizable) {
                const resizer = document.createElement('div');
                resizer.className = 'devwatch-column-resizer';
                resizer.dataset.leftColumn = columnId;
                resizer.dataset.rightColumn = this.columns[index + 1];
                container.appendChild(resizer);
            }
        });
        
        return container;
    }
    
    setupResizing() {
        this.element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('devwatch-column-resizer')) {
                this.startResize(e);
            }
        });
    }
    
    startResize(e) {
        e.preventDefault();
        const resizer = e.target;
        const leftColumnId = resizer.dataset.leftColumn;
        const rightColumnId = resizer.dataset.rightColumn;
        const leftColumn = this.element.querySelector(`[data-column-id="${leftColumnId}"]`);
        const rightColumn = this.element.querySelector(`[data-column-id="${rightColumnId}"]`);
        
        const startX = e.clientX;
        const startLeftWidth = leftColumn.offsetWidth;
        const startRightWidth = rightColumn.offsetWidth;
        
        const doDrag = (e) => {
            const deltaX = e.clientX - startX;
            const newLeftWidth = Math.max(200, Math.min(800, startLeftWidth + deltaX));
            const newRightWidth = Math.max(300, startRightWidth - deltaX);
            
            // Use setProperty with important to override CSS classes
            leftColumn.style.setProperty('flex', `0 0 ${newLeftWidth}px`, 'important');
            rightColumn.style.setProperty('flex', `0 0 ${newRightWidth}px`, 'important');
            
            // Mark columns as manually resized
            leftColumn.dataset.manuallyResized = 'true';
            rightColumn.dataset.manuallyResized = 'true';
        };
        
        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            resizer.classList.remove('pja-resizing');
        };
        
        resizer.classList.add('pja-resizing');
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    addSection(section, columnId = 'left') {
        const column = this.element.querySelector(`[data-column-id="${columnId}"]`);
        if (column && section instanceof DevWatchUiSection) {
            column.appendChild(section.element);
            this.sections.set(section.id, section);
            section.parentContainer = column;
            
            // Setup drop zones for columns
            this.setupColumnDropZones(column);
        }
    }

    setupColumnDropZones(column) {
        if (column.dataset.dropSetup) return; // Already setup
        
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        column.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!column.querySelector('.dragging')) {
                column.classList.add('drag-over');
            }
        });

        column.addEventListener('dragleave', (e) => {
            if (!column.contains(e.relatedTarget)) {
                column.classList.remove('drag-over');
            }
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            const draggedSection = document.getElementById(draggedId);
            
            if (draggedSection && draggedSection.parentNode !== column) {
                column.appendChild(draggedSection);
                
                // Update layouts and save state
                const tempSection = Object.create(DevWatchUiSection.prototype);
                tempSection.updateColumnLayouts();
                tempSection.saveState();
            }
            
            column.classList.remove('drag-over');
        });

        column.dataset.dropSetup = 'true';
    }
    
    removeSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (section) {
            section.destroy();
            this.sections.delete(sectionId);
        }
    }
    
    getColumn(columnId) {
        return this.element.querySelector(`[data-column-id="${columnId}"]`);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DevWatchUiSection, DevWatchColumnContainer };
} else if (typeof window !== 'undefined') {
    window.DevWatchUiSection = DevWatchUiSection;
    window.DevWatchColumnContainer = DevWatchColumnContainer;
}
