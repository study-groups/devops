/**
 * SectionManager.js - Manages DOM Inspector sections with drag & drop reordering
 * Handles section creation, ordering, state preservation, and drag/drop functionality
 */

export class SectionManager {
    constructor() {
        this.sections = new Map(); // Track section states
        this.defaultOrder = [
            'breadcrumbs',
            'element-details', 
            'box-model',
            'computed-styles',
            'iframe-deep-dive',
            'events',
            'layout-engine'
        ];
        this.loadSectionOrder();
        this.loadSectionStates();
    }

    /**
     * Create a collapsible section with drag & drop capability
     */
    createCollapsibleSection(id, title, content, startCollapsed = false) {
        // Preserve existing collapsed state if section exists
        const existingState = this.sections.get(id);
        const isCollapsed = existingState ? existingState.collapsed : startCollapsed;
        
        const section = document.createElement('div');
        section.className = 'dom-inspector-section';
        section.dataset.sectionId = id;
        section.draggable = true;
        
        if (isCollapsed) {
            section.classList.add('collapsed');
        }
        
        const header = document.createElement('h4');
        header.className = 'dom-inspector-section-header';
        header.style.cssText = `
            cursor: grab;
            user-select: none;
            position: relative;
            padding-left: 20px;
        `;
        
        // Add drag handle
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 12px;
            color: #6c757d;
            line-height: 0.8;
        `;
        
        const arrow = document.createElement('span');
        arrow.className = 'dom-inspector-section-arrow';
        arrow.textContent = isCollapsed ? '▶' : '▼';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'dom-inspector-section-title';
        titleSpan.textContent = title;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'dom-inspector-section-content';
        contentDiv.appendChild(content);
        
        // Add click handler for collapsing (only on arrow and title, not drag handle)
        const toggleCollapse = () => {
            const wasCollapsed = section.classList.contains('collapsed');
            section.classList.toggle('collapsed');
            arrow.textContent = wasCollapsed ? '▼' : '▶';
            
            // Save state
            this.sections.set(id, { collapsed: !wasCollapsed });
            this.saveSectionStates();
        };
        
        arrow.addEventListener('click', toggleCollapse);
        titleSpan.addEventListener('click', toggleCollapse);
        
        // Drag and drop event handlers
        this.setupDragAndDrop(section);
        
        header.appendChild(dragHandle);
        header.appendChild(arrow);
        header.appendChild(titleSpan);
        section.appendChild(header);
        section.appendChild(contentDiv);
        
        // Track this section
        this.sections.set(id, { collapsed: isCollapsed });
        
        return section;
    }

    /**
     * Setup drag and drop for a section
     */
    setupDragAndDrop(section) {
        section.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', section.dataset.sectionId);
            section.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        section.addEventListener('dragend', () => {
            section.classList.remove('dragging');
        });

        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingSection = document.querySelector('.dragging');
            if (draggingSection === section) return;
            
            const rect = section.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                section.classList.add('drop-above');
                section.classList.remove('drop-below');
            } else {
                section.classList.add('drop-below');
                section.classList.remove('drop-above');
            }
        });

        section.addEventListener('dragleave', () => {
            section.classList.remove('drop-above', 'drop-below');
        });

        section.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            const draggedSection = document.querySelector(`[data-section-id="${draggedId}"]`);
            
            if (draggedSection === section) return;
            
            const rect = section.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                section.parentNode.insertBefore(draggedSection, section);
            } else {
                section.parentNode.insertBefore(draggedSection, section.nextSibling);
            }
            
            section.classList.remove('drop-above', 'drop-below');
            this.saveSectionOrder();
        });
    }

    /**
     * Render sections in the correct order (preserves existing non-section content)
     */
    renderSections(container, sectionsData) {
        // Find and preserve any non-section content (like breadcrumbs)
        const existingNonSections = Array.from(container.children).filter(
            child => !child.classList.contains('dom-inspector-section')
        );
        
        // Clear only the sections, not the entire container
        const existingSections = container.querySelectorAll('.dom-inspector-section');
        existingSections.forEach(section => section.remove());
        
        // Create sections map for quick lookup
        const sectionsMap = new Map();
        sectionsData.forEach(({ id, section }) => {
            sectionsMap.set(id, section);
        });
        
        // Render in stored order
        this.sectionOrder.forEach(id => {
            const section = sectionsMap.get(id);
            if (section) {
                container.appendChild(section);
                sectionsMap.delete(id); // Remove from map
            }
        });
        
        // Append any new sections not in the order (shouldn't happen normally)
        sectionsMap.forEach((section, id) => {
            container.appendChild(section);
            this.sectionOrder.push(id); // Add to order
        });
        
        this.saveSectionOrder();
    }

    /**
     * Load section order from localStorage
     */
    loadSectionOrder() {
        try {
            const saved = localStorage.getItem('dom-inspector-section-order');
            this.sectionOrder = saved ? JSON.parse(saved) : [...this.defaultOrder];
        } catch (e) {
            console.warn('Failed to load section order:', e);
            this.sectionOrder = [...this.defaultOrder];
        }
    }

    /**
     * Save section order to localStorage
     */
    saveSectionOrder() {
        try {
            // Get current order from DOM
            const container = document.querySelector('.dom-inspector-details');
            if (container) {
                const sections = Array.from(container.querySelectorAll('.dom-inspector-section'));
                this.sectionOrder = sections.map(s => s.dataset.sectionId).filter(id => id);
                localStorage.setItem('dom-inspector-section-order', JSON.stringify(this.sectionOrder));
                console.log('Saved section order:', this.sectionOrder);
            }
        } catch (e) {
            console.warn('Failed to save section order:', e);
        }
    }

    /**
     * Load section states from localStorage
     */
    loadSectionStates() {
        try {
            const saved = localStorage.getItem('dom-inspector-section-states');
            if (saved) {
                const states = JSON.parse(saved);
                Object.entries(states).forEach(([id, state]) => {
                    this.sections.set(id, state);
                });
            }
        } catch (e) {
            console.warn('Failed to load section states:', e);
        }
    }

    /**
     * Save section states to localStorage
     */
    saveSectionStates() {
        try {
            const states = {};
            this.sections.forEach((state, id) => {
                states[id] = state;
            });
            localStorage.setItem('dom-inspector-section-states', JSON.stringify(states));
        } catch (e) {
            console.warn('Failed to save section states:', e);
        }
    }

    /**
     * Add CSS for drag and drop styling
     */
    static addDragDropStyles() {
        const styleId = 'dom-inspector-drag-drop-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .dom-inspector-section.dragging {
                opacity: 0.5;
                transform: rotate(2deg);
            }
            
            .dom-inspector-section.drop-above {
                border-top: 2px solid #007bff;
            }
            
            .dom-inspector-section.drop-below {
                border-bottom: 2px solid #007bff;
            }
            
            .dom-inspector-section-header:active {
                cursor: grabbing;
            }
            
            .drag-handle {
                transition: color 0.2s ease;
            }
            
            .dom-inspector-section:hover .drag-handle {
                color: #007bff !important;
            }
        `;
        document.head.appendChild(style);
    }
} 