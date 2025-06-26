/**
 * client/dom-inspector/interaction/ElementPicker.js
 * Handles element selection by pointing/clicking for the DOM Inspector
 */

export class ElementPicker {
    constructor(options = {}) {
        this.isActive = false;
        this.deepSelectMode = false;
        this.highlightCallback = options.onHighlight || null;
        this.selectCallback = options.onSelect || null;
        this.excludeSelectors = options.excludeSelectors || [];
        
        // Bind methods to preserve 'this' context
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    /**
     * Activate the element picker
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.deepSelectMode = false;
        
        // Add event listeners with capture to intercept events
        document.addEventListener('mousemove', this.handleMouseMove, { capture: true, passive: true });
        document.addEventListener('click', this.handleClick, { capture: true });
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        
        // Change cursor to indicate picker mode
        document.body.style.cursor = 'crosshair';
        
        console.log('DOM Inspector: Element picker activated');
    }

    /**
     * Deactivate the element picker
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.deepSelectMode = false;
        
        // Remove event listeners
        document.removeEventListener('mousemove', this.handleMouseMove, { capture: true, passive: true });
        document.removeEventListener('click', this.handleClick, { capture: true });
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Restore cursor
        document.body.style.cursor = '';
        
        // Hide highlight when deactivating
        if (this.highlightCallback) {
            this.highlightCallback(null);
        }
        
        console.log('DOM Inspector: Element picker deactivated');
    }

    /**
     * Toggle the picker active state
     */
    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    /**
     * Check if the picker is currently active
     * @returns {boolean} True if picker is active
     */
    isPickerActive() {
        return this.isActive;
    }

    /**
     * Check if element should be excluded from selection
     * @param {Element} element - Element to check
     * @returns {boolean} True if element should be excluded
     */
    isExcludedElement(element) {
        return this.excludeSelectors.some(selector => {
            try {
                return element.matches(selector) || element.closest(selector);
            } catch (e) {
                return false;
            }
        });
    }

    /**
     * Check if element should allow normal click behavior
     * @param {Element} element - Element to check
     * @returns {boolean} True if element should allow normal clicks
     */
    shouldAllowNormalClick(element) {
        if (!element) return false;

        const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
        const tagName = element.tagName.toLowerCase();

        if (interactiveTags.includes(tagName) && !element.disabled) {
            return true;
        }

        if (element.isContentEditable) {
            return true;
        }

        const role = element.getAttribute('role');
        if (role && ['button', 'link', 'menuitem', 'checkbox', 'radio', 'tab'].includes(role)) {
            return true;
        }

        if (element.hasAttribute('onclick')) {
            return true;
        }

        return false;
    }

    /**
     * Handle mouse move events during picking
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        if (!this.isActive) return;
        
        // Skip if hovering over excluded elements
        if (this.isExcludedElement(e.target)) {
            if (this.highlightCallback) {
                this.highlightCallback(null);
            }
            return;
        }
        
        // Highlight the element under cursor
        if (this.highlightCallback) {
            this.highlightCallback(e.target);
        }
    }

    /**
     * Handle click events during picking
     * @param {MouseEvent} e - Mouse event
     */
    handleClick(e) {
        if (!this.isActive) return;
        
        // Skip if clicking on excluded elements
        if (this.isExcludedElement(e.target)) {
            return;
        }
        
        // In normal mode, allow interactive elements to work normally
        if (!this.deepSelectMode && this.shouldAllowNormalClick(e.target)) {
            this.showForcePickHint();
            return;
        }
        
        // Prevent the default action and stop propagation
        e.preventDefault();
        e.stopPropagation();
        
        // Deactivate picker and select the element
        this.deactivate();
        
        if (this.selectCallback) {
            this.selectCallback(e.target);
        }
    }

    /**
     * Handle keydown events for deep select mode
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        if (!this.isActive) return;
        
        if (e.key === 'Shift') {
            this.deepSelectMode = true;
            document.body.style.cursor = 'crosshair';
            console.log('DOM Inspector: Deep select mode enabled');
        } else if (e.key === 'Escape') {
            this.deactivate();
        }
    }

    /**
     * Handle keyup events for deep select mode
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyUp(e) {
        if (!this.isActive) return;
        
        if (e.key === 'Shift') {
            this.deepSelectMode = false;
            document.body.style.cursor = 'crosshair';
            console.log('DOM Inspector: Deep select mode disabled');
        }
    }

    /**
     * Show a hint to the user about force picking
     */
    showForcePickHint() {
        console.log('DOM Inspector: Use Shift+Click to force select interactive elements');
        
        // Show temporary tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'dom-inspector-force-pick-hint';
        tooltip.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000000;
            font-size: 14px;
            pointer-events: none;
        `;
        tooltip.textContent = 'Hold Shift and click to select interactive elements';
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.remove();
        }, 2000);
    }

    /**
     * Set the highlight callback function
     * @param {Function} callback - Function to call when highlighting elements
     */
    setHighlightCallback(callback) {
        this.highlightCallback = callback;
    }

    /**
     * Set the select callback function
     * @param {Function} callback - Function to call when selecting elements
     */
    setSelectCallback(callback) {
        this.selectCallback = callback;
    }

    /**
     * Add selectors to exclude from picking
     * @param {string|Array} selectors - CSS selectors to exclude
     */
    addExcludeSelectors(selectors) {
        if (Array.isArray(selectors)) {
            this.excludeSelectors.push(...selectors);
        } else {
            this.excludeSelectors.push(selectors);
        }
    }

    /**
     * Remove selectors from exclusion list
     * @param {string|Array} selectors - CSS selectors to remove from exclusion
     */
    removeExcludeSelectors(selectors) {
        const toRemove = Array.isArray(selectors) ? selectors : [selectors];
        this.excludeSelectors = this.excludeSelectors.filter(s => !toRemove.includes(s));
    }

    /**
     * Clean up and destroy the picker
     */
    destroy() {
        this.deactivate();
        this.highlightCallback = null;
        this.selectCallback = null;
        this.excludeSelectors = [];
    }
} 