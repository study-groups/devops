/**
 * UIUtilities.js - Generic UI utility methods
 * Contains helper functions for HTML escaping and other utilities
 */

export class UIUtilities {
    /**
     * Escape HTML content
     */
    static escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Render empty details when no element is selected
     */
    static renderEmptyDetails(container) {
        if (!container) return;
        
        container.innerHTML = `
            <div class="dom-inspector-empty-state">
                <h3>No Element Selected</h3>
                <p>Click on an element in the tree or use the selector input to inspect an element.</p>
            </div>
        `;
    }

    /**
     * Get element display name for UI
     */
    static getElementDisplayName(element) {
        let name = element.tagName.toLowerCase();
        
        // Add ID if present
        if (element.id) {
            name += `#${element.id}`;
        }
        
        // Add first class if present
        if (element.className && typeof element.className === 'string') {
            const firstClass = element.className.split(' ')[0];
            if (firstClass) {
                name += `.${firstClass}`;
            }
        }
        
        return name;
    }
} 