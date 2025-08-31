/**
 * DragDropManager.js - Handles drag and drop functionality for panel reordering
 * 
 * Uses SortableJS library for reliable drag-and-drop functionality.
 * Provides a clean API for drag-and-drop panel reordering with visual feedback.
 */

// Import SortableJS
import '/client/libs/Sortable.min.js';

export class DragDropManager {
    constructor(onReorder) {
        this.onReorder = onReorder; // Callback when reorder happens
        this.container = null;
        this.sortable = null;
    }

    /**
     * Initialize drag and drop for a container using SortableJS
     */
    initialize(container) {
        // If same container and sortable still exists, don't recreate
        if (this.container === container && this.sortable && this.sortable.el === container) {
            return;
        }
        
        if (this.container) {
            this.cleanup(); // Clean up previous container
        }
        
        this.container = container;
        
        // Create SortableJS instance
        this.sortable = new Sortable(container, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.panel-header',
            draggable: '.panel-item',
            onEnd: (evt) => {
                const { oldIndex, newIndex } = evt;
                
                if (oldIndex !== newIndex && this.onReorder) {
                    this.onReorder(oldIndex, newIndex);
                }
            }
        });
    }

    /**
     * Clean up SortableJS instance
     */
    cleanup() {
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
        this.container = null;
    }

    /**
     * Destroy the manager and clean up all resources
     */
    destroy() {
        this.cleanup();
        this.onReorder = null;
    }
}
