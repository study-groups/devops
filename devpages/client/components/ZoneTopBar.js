/**
 * ZoneTopBar.js - Programmatic control for workspace zone top bars
 * Provides clean API for managing editor and preview zone headers
 */

export class ZoneTopBar {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            title: options.title || 'Zone',
            showStats: options.showStats !== false,
            showStatus: options.showStatus !== false,
            ...options
        };
        
        this.stats = {};
        this.status = 'ready';
        this.element = null;
        
        this.create();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'zone-top-bar';
        
        this.element.innerHTML = `
            <div class="zone-title">${this.options.title}</div>
            <div class="zone-stats">
                ${this.options.showStats ? '<span class="stats-content"></span>' : ''}
                ${this.options.showStatus ? '<span class="zone-status ready">Ready</span>' : ''}
            </div>
        `;
        
        this.statsElement = this.element.querySelector('.stats-content');
        this.statusElement = this.element.querySelector('.zone-status');
        
        return this.element;
    }

    /**
     * Update the zone title
     */
    setTitle(title) {
        const titleElement = this.element.querySelector('.zone-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
        return this;
    }

    /**
     * Update stats display
     * @param {Object} stats - Key-value pairs of stats to display
     */
    setStats(stats) {
        this.stats = { ...this.stats, ...stats };
        
        if (this.statsElement) {
            const statsText = Object.entries(this.stats)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' • ');
            this.statsElement.textContent = statsText;
        }
        return this;
    }

    /**
     * Update status
     * @param {string} status - 'ready', 'loading', 'error'
     * @param {string} message - Optional status message
     */
    setStatus(status, message = null) {
        this.status = status;
        
        if (this.statusElement) {
            // Remove old status classes
            this.statusElement.classList.remove('ready', 'loading', 'error');
            // Add new status class
            this.statusElement.classList.add(status);
            
            // Set status text
            const statusText = message || status.charAt(0).toUpperCase() + status.slice(1);
            this.statusElement.textContent = statusText;
        }
        return this;
    }

    /**
     * Clear all stats
     */
    clearStats() {
        this.stats = {};
        if (this.statsElement) {
            this.statsElement.textContent = '';
        }
        return this;
    }

    /**
     * Hide/show the entire top bar
     */
    setVisible(visible) {
        if (this.element) {
            this.element.style.display = visible ? 'flex' : 'none';
        }
        return this;
    }

    /**
     * Get the DOM element
     */
    getElement() {
        return this.element;
    }

    /**
     * Destroy the top bar
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.statsElement = null;
        this.statusElement = null;
    }
}

/**
 * Factory function for creating zone top bars
 */
export function createZoneTopBar(container, options) {
    return new ZoneTopBar(container, options);
}
