/**
 * Markdown Utility Handler
 *
 * Provides a general system for markdown files to call devpages utilities.
 * Buttons in markdown can trigger server-side actions by using data-action attributes.
 *
 * Usage in markdown (via HTML):
 * <button data-action="utility-name" data-param1="value1" data-param2="value2">
 *   Action Button
 * </button>
 *
 * The handler will:
 * 1. Listen for clicks on elements with data-action attributes
 * 2. Extract all data-* attributes as parameters
 * 3. Call the registered utility function
 * 4. Handle the response and update UI accordingly
 */

/**
 * Registry of available utility actions
 * Each action is a function that receives the button element and extracted params
 */
const utilityActions = {
    /**
     * Delete a specific image
     * Expected params: data-image-name="filename.jpg"
     */
    async 'delete-image'(button, params) {
        const imageName = params.imageName || params['image-name'];

        if (!imageName) {
            showFeedback(button, 'Error: No image specified', 'error');
            return;
        }

        // Confirm deletion
        if (!confirm(`Delete image "${decodeURIComponent(imageName)}"? This cannot be undone.`)) {
            return;
        }

        try {
            // Disable button during operation
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Deleting...';

            // Call delete API
            const response = await fetch('/api/images/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    url: `/uploads/${decodeURIComponent(imageName)}`
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to delete image: ${response.status}`);
            }

            const result = await response.json();

            // Show success feedback
            showFeedback(button, 'Image deleted successfully!', 'success');

            // Reload the page to refresh the index after a short delay
            setTimeout(() => {
                if (window.parent && window.parent.APP) {
                    // Notify parent to reload the current file
                    window.parent.postMessage({
                        type: 'reload-current-file'
                    }, '*');
                } else {
                    // Fallback: reload iframe
                    window.location.reload();
                }
            }, 1000);

        } catch (error) {
            console.error('Error deleting image:', error);
            showFeedback(button, `Error: ${error.message}`, 'error');
            button.disabled = false;
            button.textContent = originalText;
        }
    },

    /**
     * Refresh stats or other data
     * Can be extended for various refresh operations
     */
    async 'refresh-data'(button, params) {
        const dataType = params.dataType || params['data-type'] || 'stats';

        try {
            button.disabled = true;
            const originalText = button.textContent;
            button.textContent = 'Refreshing...';

            // Add specific refresh logic based on dataType
            if (dataType === 'stats') {
                // Reload the current view
                window.location.reload();
            }

            showFeedback(button, 'Data refreshed!', 'success');
            button.textContent = originalText;
            button.disabled = false;

        } catch (error) {
            console.error('Error refreshing data:', error);
            showFeedback(button, `Error: ${error.message}`, 'error');
            button.disabled = false;
        }
    }
};

/**
 * Show feedback message near the button
 */
function showFeedback(button, message, type = 'info') {
    // Remove any existing feedback
    const existingFeedback = button.parentElement.querySelector('.utility-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `utility-feedback utility-feedback-${type}`;
    feedback.textContent = message;
    feedback.style.cssText = `
        display: inline-block;
        margin-left: 1rem;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-size: 0.875rem;
        animation: fadeIn 0.3s ease-in;
        ${type === 'success' ? 'background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;' : ''}
        ${type === 'error' ? 'background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;' : ''}
        ${type === 'info' ? 'background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;' : ''}
    `;

    // Insert after button or in parent
    if (button.nextSibling) {
        button.parentElement.insertBefore(feedback, button.nextSibling);
    } else {
        button.parentElement.appendChild(feedback);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transition = 'opacity 0.3s';
        setTimeout(() => feedback.remove(), 300);
    }, 5000);
}

/**
 * Extract all data-* attributes from an element
 */
function extractDataParams(element) {
    const params = {};
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
            // Convert data-foo-bar to fooBar
            const key = attr.name
                .slice(5) // Remove 'data-'
                .replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            params[key] = attr.value;
        }
    }
    return params;
}

/**
 * Initialize the utility handler system
 * Call this when the preview document loads
 */
export function initMarkdownUtilityHandler() {
    console.log('[MarkdownUtility] Initializing utility handler');

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        button[data-action] {
            cursor: pointer;
            transition: opacity 0.2s;
        }

        button[data-action]:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);

    // Use event delegation on the document
    document.addEventListener('click', async (e) => {
        const button = e.target.closest('[data-action]');

        if (!button) return;

        // Prevent default behavior
        e.preventDefault();
        e.stopPropagation();

        const action = button.dataset.action;
        const handler = utilityActions[action];

        if (!handler) {
            console.warn(`[MarkdownUtility] No handler registered for action: ${action}`);
            showFeedback(button, `Unknown action: ${action}`, 'error');
            return;
        }

        // Extract all data params
        const params = extractDataParams(button);

        console.log(`[MarkdownUtility] Executing action: ${action}`, params);

        try {
            await handler(button, params);
        } catch (error) {
            console.error(`[MarkdownUtility] Error executing action ${action}:`, error);
            showFeedback(button, `Error: ${error.message}`, 'error');
        }
    });

    console.log('[MarkdownUtility] Handler initialized with actions:', Object.keys(utilityActions));
}

/**
 * Inline version for injection into HTML
 * Returns the handler code as a string
 */
export function getInlineUtilityHandler() {
    // Return the entire handler as a self-contained script
    return `
(function() {
    ${utilityActions.toString()}
    ${showFeedback.toString()}
    ${extractDataParams.toString()}
    ${initMarkdownUtilityHandler.toString()}

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMarkdownUtilityHandler);
    } else {
        initMarkdownUtilityHandler();
    }
})();
`;
}
