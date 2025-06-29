/**
 * client/dom-inspector/interaction/HighlightOverlay.js
 * Manages element highlighting overlay for the DOM Inspector
 */

const HIGHLIGHT_MODES = ['none', 'border', 'shade', 'both'];

export class HighlightOverlay {
    constructor(settings = {}) {
        this.overlay = null;
        this.settings = {
            mode: 'border',
            color: '#448AFF',
            zIndex: 999999,
            ...settings
        };
        
        this.createOverlay();
    }

    /**
     * Create the highlight overlay element
     */
    createOverlay() {
        if (this.overlay) {
            this.overlay.remove();
        }
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'dom-inspector-highlight-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: ${this.settings.zIndex};
            top: 0;
            left: 0;
            width: 0;
            height: 0;
            transition: all 0.1s ease;
            border-radius: 2px;
            display: none;
        `;
        
        document.body.appendChild(this.overlay);
        this.updateStyles();
    }

    /**
     * Update overlay styles based on current settings
     */
    updateStyles() {
        if (!this.overlay) return;
        
        const { mode, color, zIndex } = this.settings;
        
        this.overlay.style.zIndex = zIndex;
        
        if (mode === 'none') {
            this.overlay.style.border = 'none';
            this.overlay.style.backgroundColor = 'transparent';
        } else if (mode === 'border') {
            this.overlay.style.border = `2px solid ${color}`;
            this.overlay.style.backgroundColor = 'transparent';
        } else if (mode === 'shade') {
            this.overlay.style.border = 'none';
            // Create a translucent version of the color for shade-only mode
            const rgb = this.hexToRgb(color);
            this.overlay.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
        } else if (mode === 'both') {
            this.overlay.style.border = `2px solid ${color}`;
            // Create a translucent version of the color
            const rgb = this.hexToRgb(color);
            this.overlay.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
        }
    }

    /**
     * Highlight an element
     * @param {Element} element - Element to highlight
     */
    highlight(element) {
        if (!this.overlay || !element) return;
        
        const rect = element.getBoundingClientRect();
        const { mode } = this.settings;
        
        if (mode === 'none') {
            this.overlay.style.display = 'none';
            return;
        }
        
        this.overlay.style.display = 'block';
        this.overlay.style.top = `${rect.top}px`;
        this.overlay.style.left = `${rect.left}px`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
        
        this.updateStyles();
    }

    /**
     * Hide the highlight overlay
     */
    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    /**
     * Flash the highlight to make it more visible
     */
    flash() {
        if (!this.overlay) return;
        
        // Add a flash animation class
        this.overlay.classList.add('flash-highlight');
        
        // Remove the class after animation completes
        setTimeout(() => {
            if (this.overlay) {
                this.overlay.classList.remove('flash-highlight');
            }
        }, 600);
    }

    /**
     * Update highlight settings
     * @param {Object} newSettings - New settings to apply
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.updateStyles();
    }

    /**
     * Get current settings
     * @returns {Object} Current highlight settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get available highlight modes
     * @returns {Array} Array of available modes
     */
    static getModes() {
        return [...HIGHLIGHT_MODES];
    }

    /**
     * Get the next mode in the cycle
     * @param {string} currentMode - Current highlight mode
     * @returns {string} Next mode in the cycle
     */
    static getNextMode(currentMode) {
        const modeIndex = HIGHLIGHT_MODES.indexOf(currentMode);
        return HIGHLIGHT_MODES[(modeIndex + 1) % HIGHLIGHT_MODES.length];
    }

    /**
     * Convert hex color to RGB object
     * @param {string} hex - Hex color string
     * @returns {Object} RGB color object
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 68, g: 138, b: 255 }; // Default blue
    }

    /**
     * Create a temporary highlight dot at specific coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Options for the dot
     */
    showClickableDot(x, y, options = {}) {
        const dot = document.createElement('div');
        dot.className = 'dom-inspector-clickable-dot';
        dot.style.cssText = `
            position: fixed;
            width: ${options.size || 10}px;
            height: ${options.size || 10}px;
            background: ${options.color || '#00ff00'};
            border: 2px solid #fff;
            border-radius: 50%;
            z-index: 999999;
            pointer-events: none;
            left: ${x - (options.size || 10) / 2}px;
            top: ${y - (options.size || 10) / 2}px;
            animation: pulse 1s infinite;
        `;
        
        // Add pulse animation if not already present
        if (!document.querySelector('#clickable-dot-animation')) {
            const style = document.createElement('style');
            style.id = 'clickable-dot-animation';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(dot);
        
        // Remove after specified duration
        const duration = options.duration || 3000;
        setTimeout(() => {
            dot.remove();
        }, duration);
        
        return dot;
    }

    /**
     * Destroy the overlay and clean up
     */
    destroy() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
} 