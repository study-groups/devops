/**
 * UIUtilities.js - Generic UI utility methods
 * Contains helper functions for HTML escaping and other utilities
 */

export class UIUtilities {
    /**
     * Shows a temporary tooltip next to a given element.
     * @param {HTMLElement} targetElement - The element to anchor the tooltip to.
     * @param {string} message - The message to display in the tooltip.
     * @param {'success' | 'error'} type - The type of tooltip, for styling.
     * @param {number} duration - How long the tooltip should be visible, in milliseconds.
     */
    static showTemporaryTooltip(targetElement, message, type = 'success', duration = 1500) {
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip ${type}`;
        tooltip.textContent = message;
        document.body.appendChild(tooltip);

        const targetRect = targetElement.getBoundingClientRect();
        
        // Position tooltip to the right of the element
        tooltip.style.left = `${targetRect.right + 5}px`;
        tooltip.style.top = `${targetRect.top + (targetRect.height / 2) - (tooltip.offsetHeight / 2)}px`;

        // Fade in
        requestAnimationFrame(() => {
            tooltip.classList.add('visible');
        });

        // Hide and remove after duration
        setTimeout(() => {
            tooltip.classList.remove('visible');
            tooltip.addEventListener('transitionend', () => {
                if (tooltip.parentElement) {
                    tooltip.parentElement.removeChild(tooltip);
                }
            });
        }, duration);
    }

    /**
     * Escape HTML content
     */
    static escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
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
        if (!element) return 'N/A';
        
        let name = element.tagName.toLowerCase();
        if (element.id) {
            name += `#${element.id}`;
        } else if (element.classList && element.classList.length > 0) {
            name += `.${Array.from(element.classList).join('.')}`;
        }
        
        return name;
    }
} 