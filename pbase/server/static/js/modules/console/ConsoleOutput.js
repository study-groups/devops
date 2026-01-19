/**
 * ConsoleOutput.js - Console Output Display
 * Handles log entries, message formatting, and output rendering
 */

import { CATEGORIES } from './ConsoleCommands.js';

// Output entry types with styling
const ENTRY_TYPES = {
    command: { prefix: '>', color: '#4fc3f7' },
    result: { prefix: '←', color: '#81c784' },
    error: { prefix: '✗', color: '#ef5350' },
    info: { prefix: 'ℹ', color: '#90a4ae' },
    warn: { prefix: '⚠', color: '#ffb74d' },
    message: { prefix: '◆', color: '#ba68c8' },
    game: { prefix: '🎮', color: '#f06292' },
    system: { prefix: '⚙', color: '#78909c' }
};

export class ConsoleOutput {
    constructor(options = {}) {
        this.maxEntries = options.maxEntries || 500;
        this.element = null;
        this.entries = [];
    }

    /**
     * Render the output component
     * @returns {HTMLElement}
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'console-output';

        // Welcome message
        this.log('system', 'PBase Console v1.0 - PJA-SDK Testing Interface');
        this.log('info', 'Type "help" for commands, press Tab for completion');

        return this.element;
    }

    /**
     * Log an entry
     * @param {string} type - Entry type (command, result, error, etc.)
     * @param {string|object} content - Content to display
     * @param {object} options - Additional options
     */
    log(type, content, options = {}) {
        const entry = this._createEntry(type, content, options);
        this.entries.push(entry);

        // Trim old entries
        while (this.entries.length > this.maxEntries) {
            const removed = this.entries.shift();
            removed.element?.remove();
        }

        this.element.appendChild(entry.element);
        this._scrollToBottom();
    }

    /**
     * Create an entry element
     */
    _createEntry(type, content, options) {
        const typeConfig = ENTRY_TYPES[type] || ENTRY_TYPES.info;
        const element = document.createElement('div');
        element.className = `console-entry console-entry-${type}`;

        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Format content
        let formattedContent = content;
        if (typeof content === 'object') {
            formattedContent = this._formatObject(content);
        } else if (typeof content === 'string') {
            formattedContent = this._escapeHtml(content);
        }

        // Build HTML
        let html = `
            <span class="entry-timestamp">${timestamp}</span>
            <span class="entry-prefix" style="color: ${typeConfig.color}">${typeConfig.prefix}</span>
            <span class="entry-content">${formattedContent}</span>
        `;

        // Add category badge if provided
        if (options.category && CATEGORIES[options.category]) {
            const cat = CATEGORIES[options.category];
            html = `
                <span class="entry-timestamp">${timestamp}</span>
                <span class="entry-category" style="background: ${cat.color}20; color: ${cat.color}">${cat.label}</span>
                <span class="entry-prefix" style="color: ${typeConfig.color}">${typeConfig.prefix}</span>
                <span class="entry-content">${formattedContent}</span>
            `;
        }

        element.innerHTML = html;

        return { type, content, timestamp, element };
    }

    /**
     * Format object for display
     */
    _formatObject(obj) {
        try {
            const json = JSON.stringify(obj, null, 2);
            return `<pre class="entry-json">${this._escapeHtml(json)}</pre>`;
        } catch (e) {
            return `[Object: ${typeof obj}]`;
        }
    }

    /**
     * Escape HTML
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Scroll to bottom
     */
    _scrollToBottom() {
        requestAnimationFrame(() => {
            this.element.scrollTop = this.element.scrollHeight;
        });
    }

    /**
     * Clear output
     */
    clear() {
        this.entries = [];
        this.element.innerHTML = '';
        this.log('system', 'Console cleared');
    }

    /**
     * Log a command (echo what user typed)
     */
    command(cmd) {
        this.log('command', cmd);
    }

    /**
     * Log a result
     */
    result(content, category) {
        this.log('result', content, { category });
    }

    /**
     * Log an error
     */
    error(message) {
        this.log('error', message);
    }

    /**
     * Log info
     */
    info(message) {
        this.log('info', message);
    }

    /**
     * Log warning
     */
    warn(message) {
        this.log('warn', message);
    }

    /**
     * Log a message from game
     */
    message(type, data) {
        const content = data ? `${type}: ${JSON.stringify(data)}` : type;
        this.log('message', content);
    }

    /**
     * Log game event
     */
    gameEvent(event, data) {
        this.log('game', `${event}${data ? ': ' + JSON.stringify(data) : ''}`);
    }

    /**
     * Get all entries
     */
    getEntries() {
        return this.entries.map(e => ({
            type: e.type,
            content: e.content,
            timestamp: e.timestamp
        }));
    }
}
