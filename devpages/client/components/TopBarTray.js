/**
 * TopBarTray.js - Unified tray system for top bar actions
 *
 * Manages revealing trays that slide down from the top bar.
 * Features:
 * - Only one tray open at a time
 * - Smooth reveal/hide animations
 * - Centered content with ample padding
 * - Keyboard support (Escape to close)
 * - Click outside to close
 */

import { appStore } from '/client/appState.js';

const log = window.APP?.services?.log?.createLogger('UI', 'TopBarTray') || {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
};

class TopBarTrayManager {
    constructor() {
        this.trays = new Map();
        this.activeTrayId = null;
        this.container = null;
        this.initialized = false;
    }

    /**
     * Initialize the tray system
     */
    initialize() {
        if (this.initialized) return;

        this.injectStyles();
        this.createContainer();
        this.attachGlobalListeners();

        this.initialized = true;
        log.info('INIT', 'TopBarTray system initialized');
    }

    /**
     * Create the tray container element
     */
    createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'topbar-tray-container';
        this.container.className = 'topbar-tray-container';

        // Insert after top-bar
        const topBar = document.querySelector('.top-bar');
        if (topBar && topBar.parentNode) {
            topBar.parentNode.insertBefore(this.container, topBar.nextSibling);
        } else {
            document.body.insertBefore(this.container, document.body.firstChild);
        }
    }

    /**
     * Register a tray configuration
     */
    register(id, config) {
        this.trays.set(id, {
            id,
            title: config.title || '',
            render: config.render,
            onOpen: config.onOpen,
            onClose: config.onClose,
            height: config.height || 'auto',
            ...config
        });
        log.debug('REGISTER', `Registered tray: ${id}`);
    }

    /**
     * Unregister a tray
     */
    unregister(id) {
        if (this.activeTrayId === id) {
            this.close();
        }
        this.trays.delete(id);
    }

    /**
     * Open a tray by ID
     */
    open(id) {
        if (!this.initialized) this.initialize();

        const tray = this.trays.get(id);
        if (!tray) {
            log.warn('OPEN_FAILED', `Tray not found: ${id}`);
            return;
        }

        // Close current tray if different
        if (this.activeTrayId && this.activeTrayId !== id) {
            this.close();
        }

        // If same tray, toggle off
        if (this.activeTrayId === id) {
            this.close();
            return;
        }

        this.activeTrayId = id;
        this.renderTray(tray);

        // Call onOpen callback
        if (tray.onOpen) {
            tray.onOpen(this.getTrayContent());
        }

        log.info('OPEN', `Opened tray: ${id}`);
    }

    /**
     * Close the active tray
     */
    close() {
        if (!this.activeTrayId) return;

        const tray = this.trays.get(this.activeTrayId);

        // Call onClose callback
        if (tray?.onClose) {
            tray.onClose();
        }

        // Animate close
        this.container.classList.remove('visible');
        document.body.classList.remove('topbar-tray-open');

        // Clear content after animation
        setTimeout(() => {
            if (!this.activeTrayId) {
                this.container.innerHTML = '';
            }
        }, 200);

        log.info('CLOSE', `Closed tray: ${this.activeTrayId}`);
        this.activeTrayId = null;
    }

    /**
     * Toggle a tray
     */
    toggle(id) {
        if (this.activeTrayId === id) {
            this.close();
        } else {
            this.open(id);
        }
    }

    /**
     * Check if a specific tray is open
     */
    isOpen(id) {
        return this.activeTrayId === id;
    }

    /**
     * Get the active tray ID
     */
    getActiveTrayId() {
        return this.activeTrayId;
    }

    /**
     * Get the tray content element
     */
    getTrayContent() {
        return this.container?.querySelector('.topbar-tray-content');
    }

    /**
     * Render a tray
     */
    renderTray(tray) {
        const content = typeof tray.render === 'function' ? tray.render() : tray.render;

        this.container.innerHTML = `
            <div class="topbar-tray" data-tray-id="${tray.id}">
                <div class="topbar-tray-inner">
                    ${tray.title ? `
                        <div class="topbar-tray-header">
                            <span class="topbar-tray-title">${tray.title}</span>
                            <button class="topbar-tray-close" data-action="close-tray">&times;</button>
                        </div>
                    ` : ''}
                    <div class="topbar-tray-content">
                        ${content}
                    </div>
                </div>
            </div>
        `;

        // Attach close button listener
        const closeBtn = this.container.querySelector('[data-action="close-tray"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Trigger animation
        requestAnimationFrame(() => {
            this.container.classList.add('visible');
            document.body.classList.add('topbar-tray-open');
        });
    }

    /**
     * Update the content of the active tray
     */
    updateContent(content) {
        const contentEl = this.getTrayContent();
        if (contentEl) {
            contentEl.innerHTML = content;
        }
    }

    /**
     * Attach global event listeners
     */
    attachGlobalListeners() {
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeTrayId) {
                this.close();
            }
        });

        // Click outside to close (optional - can be disabled per tray)
        document.addEventListener('click', (e) => {
            if (!this.activeTrayId) return;

            const tray = this.trays.get(this.activeTrayId);
            if (tray?.closeOnClickOutside === false) return;

            const isInTray = e.target.closest('.topbar-tray-container');
            const isInTopBar = e.target.closest('.top-bar');
            const isTrayTrigger = e.target.closest('[data-tray-trigger]');

            if (!isInTray && !isInTopBar && !isTrayTrigger) {
                this.close();
            }
        });
    }

    /**
     * Inject CSS styles
     */
    injectStyles() {
        if (document.getElementById('topbar-tray-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'topbar-tray-styles';
        styles.textContent = `
            .topbar-tray-container {
                position: fixed;
                top: 48px;
                left: 0;
                right: 0;
                z-index: 999;
                overflow: hidden;
                max-height: 0;
                transition: max-height 0.25s ease-out;
                background: var(--color-bg-alt);
                border-bottom: 1px solid var(--color-border);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .topbar-tray-container.visible {
                max-height: 300px;
            }

            .topbar-tray {
                width: 100%;
            }

            .topbar-tray-inner {
                max-width: 900px;
                margin: 0 auto;
                padding: 16px 48px;
            }

            .topbar-tray-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--color-border);
            }

            .topbar-tray-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--color-text);
            }

            .topbar-tray-close {
                background: none;
                border: none;
                font-size: 20px;
                color: var(--color-text-secondary);
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
            }

            .topbar-tray-close:hover {
                color: var(--color-text);
            }

            .topbar-tray-content {
                color: var(--color-text);
            }

            /* Adjust workspace when tray is open */
            body.topbar-tray-open .workspace-container {
                margin-top: 0;
                transition: margin-top 0.25s ease-out;
            }

            /* Tray-specific form styles */
            .tray-form {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .tray-form-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .tray-form-row.centered {
                justify-content: center;
            }

            .tray-input {
                padding: 10px 14px;
                border: 1px solid var(--color-border);
                border-radius: 6px;
                font-size: 14px;
                background: var(--color-surface);
                color: var(--color-text);
                min-width: 200px;
            }

            .tray-input:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
            }

            .tray-input::placeholder {
                color: var(--color-text-muted);
            }

            .tray-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .tray-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .tray-btn.primary {
                background: var(--color-primary);
                color: var(--color-text-inverse);
            }

            .tray-btn.primary:hover:not(:disabled) {
                background: var(--color-primary-emphasis);
            }

            .tray-btn.secondary {
                background: var(--color-surface);
                border: 1px solid var(--color-border);
                color: var(--color-text);
            }

            .tray-btn.secondary:hover:not(:disabled) {
                background: var(--color-bg-alt);
            }

            .tray-btn.danger {
                background: var(--color-error);
                color: var(--color-text-inverse);
            }

            .tray-btn.danger:hover:not(:disabled) {
                background: var(--color-error-border);
            }

            .tray-btn.ghost {
                background: none;
                border: none;
                color: var(--color-text-secondary);
                padding: 8px 12px;
            }

            .tray-btn.ghost:hover:not(:disabled) {
                color: var(--color-text);
                background: var(--color-bg-alt);
            }

            .tray-label {
                font-size: 13px;
                color: var(--color-text-secondary);
                min-width: 80px;
            }

            .tray-error {
                color: var(--color-error);
                font-size: 13px;
                margin-left: 12px;
            }

            .tray-success {
                color: var(--color-success);
                font-size: 13px;
                margin-left: 12px;
            }

            .tray-divider {
                width: 1px;
                height: 24px;
                background: var(--color-border);
                margin: 0 8px;
            }

            .tray-section {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .tray-status {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: var(--color-surface);
                border: 1px solid var(--color-border);
                border-radius: 6px;
                font-size: 13px;
            }

            .tray-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--color-text-muted);
            }

            .tray-status-dot.published {
                background: var(--color-success);
            }

            .tray-status-dot.unpublished {
                background: var(--color-warning);
            }

            .tray-progress {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }

            .tray-progress-bar {
                flex: 1;
                height: 6px;
                background: var(--color-bg-elevated);
                border-radius: 3px;
                overflow: hidden;
            }

            .tray-progress-fill {
                height: 100%;
                background: var(--color-primary);
                border-radius: 3px;
                transition: width 0.3s ease;
            }

            .tray-progress-text {
                font-size: 12px;
                color: var(--color-text-secondary);
                min-width: 100px;
            }

            .tray-url {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: var(--color-success-bg);
                border: 1px solid var(--color-success);
                border-radius: 6px;
            }

            .tray-url-text {
                font-size: 13px;
                font-family: monospace;
                color: var(--color-success);
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .topbar-tray-inner {
                    padding: 12px 16px;
                }

                .tray-form-row {
                    flex-wrap: wrap;
                }

                .tray-input {
                    min-width: 150px;
                    flex: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Create singleton instance
export const topBarTray = new TopBarTrayManager();

// Export for direct use
export default topBarTray;
