/**
 * client/settings/core/SettingsPanel.js
 * Main Settings Panel Container - The "Style Panel" you're looking for!
 * 
 * This is the main settings panel that contains all individual setting panels
 * like Design Tokens, Themes, etc.
 */

import { settingsRegistry } from './settingsRegistry.js';
import { storageService } from '/client/services/storageService.js';

export class SettingsPanel {
    constructor() {
        this.isVisible = false;
        this.element = null;
        this.panelInstances = new Map();
        this.collapsedSections = new Set();
        
        // Logger for this component
        this.log = window.APP?.services?.log?.createLogger('SettingsPanel') || console;
        
        this.log.info('INIT', 'Settings Panel constructed');
    }

    /**
     * Create the main settings panel DOM structure
     */
    render() {
        if (this.element) {
            return this.element;
        }

        this.element = document.createElement('div');
        this.element.className = 'settings-panel';
        this.element.id = 'main-settings-panel';
        
        this.element.innerHTML = `
            <div class="settings-panel-header">
                <h2 class="settings-panel-title">🎨 Style Panel</h2>
                <div class="settings-panel-controls">
                    <button class="settings-panel-close" aria-label="Close Settings">×</button>
                </div>
            </div>
            <div class="settings-panel-content" id="settings-content">
                <div class="settings-loading">
                    <div class="spinner"></div>
                    <p>Loading settings panels...</p>
                </div>
            </div>
        `;

        // Add event listeners
        this.attachEventListeners();
        
        // Load the CSS
        this.loadCSS();
        
        this.log.info('RENDER', 'Settings panel DOM created');
        return this.element;
    }

    /**
     * Load CSS styles for the settings panel
     */
    loadCSS() {
        const cssPath = '/client/settings/core/settings.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            link.onload = () => this.log.info('CSS', 'Settings CSS loaded');
            link.onerror = () => this.log.error('CSS', 'Failed to load settings CSS');
            document.head.appendChild(link);
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const closeBtn = this.element.querySelector('.settings-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Allow clicking outside to close (if desired)
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.element.contains(e.target)) {
                // Optional: uncomment to close on outside click
                // this.hide();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Load and render all registered panels
     */
    async loadPanels() {
        this.log.info('LOAD_PANELS', 'Starting to load panels...');
        
        const contentContainer = this.element.querySelector('#settings-content');
        if (!contentContainer) {
            this.log.error('LOAD_PANELS', 'Content container not found');
            return;
        }

        // Clear loading state
        contentContainer.innerHTML = '';

        // Get all registered panels
        const panels = settingsRegistry.getPanels();
        this.log.info('LOAD_PANELS', `Found ${panels.length} registered panels`);

        if (panels.length === 0) {
            contentContainer.innerHTML = `
                <div class="settings-empty">
                    <h3>No Settings Panels Available</h3>
                    <p>No settings panels have been registered yet.</p>
                    <button class="btn btn-primary" onclick="window.location.reload()">Reload Page</button>
                </div>
            `;
            return;
        }

        // Sort panels by order
        panels.sort((a, b) => (a.order || 50) - (b.order || 50));

        // Create sections for each panel
        for (const panelConfig of panels) {
            try {
                await this.createPanelSection(panelConfig, contentContainer);
            } catch (error) {
                this.log.error('LOAD_PANELS', `Failed to create panel ${panelConfig.id}:`, error);
            }
        }

        this.log.info('LOAD_PANELS', 'All panels loaded successfully');
    }

    /**
     * Create a section for an individual panel
     */
    async createPanelSection(panelConfig, container) {
        const sectionId = `settings-section-${panelConfig.id}`;
        
        // Create section container
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.id = sectionId;
        
        const isCollapsed = this.collapsedSections.has(panelConfig.id);
        
        section.innerHTML = `
            <div class="settings-section-header" data-section="${panelConfig.id}">
                <h3 class="settings-section-title">
                    <span class="section-toggle ${isCollapsed ? 'collapsed' : ''}">${isCollapsed ? '▶' : '▼'}</span>
                    ${panelConfig.title || panelConfig.id}
                </h3>
            </div>
            <div class="settings-section-content ${isCollapsed ? 'collapsed' : ''}" id="${sectionId}-content">
                <div class="panel-loading">Loading ${panelConfig.title}...</div>
            </div>
        `;

        container.appendChild(section);

        // Add collapse/expand functionality
        const header = section.querySelector('.settings-section-header');
        header.addEventListener('click', () => this.toggleSection(panelConfig.id));

        // Load the actual panel
        const contentDiv = section.querySelector(`#${sectionId}-content`);
        
        try {
            // Instantiate the panel
            if (panelConfig.component) {
                const panelInstance = new panelConfig.component(contentDiv);
                this.panelInstances.set(panelConfig.id, panelInstance);
                
                // Clear loading message
                contentDiv.innerHTML = '';
                
                this.log.info('PANEL_LOADED', `Panel ${panelConfig.id} loaded successfully`);
            } else {
                throw new Error('No component defined for panel');
            }
        } catch (error) {
            contentDiv.innerHTML = `
                <div class="panel-error">
                    <p>Failed to load ${panelConfig.title}</p>
                    <details>
                        <summary>Error details</summary>
                        <pre>${error.message}</pre>
                    </details>
                </div>
            `;
            this.log.error('PANEL_ERROR', `Failed to load panel ${panelConfig.id}:`, error);
        }
    }

    /**
     * Toggle section collapse/expand
     */
    toggleSection(sectionId) {
        const section = this.element.querySelector(`#settings-section-${sectionId}`);
        const content = section.querySelector('.settings-section-content');
        const toggle = section.querySelector('.section-toggle');
        
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            content.classList.remove('collapsed');
            toggle.classList.remove('collapsed');
            toggle.textContent = '▼';
            this.collapsedSections.delete(sectionId);
        } else {
            content.classList.add('collapsed');
            toggle.classList.add('collapsed');
            toggle.textContent = '▶';
            this.collapsedSections.add(sectionId);
        }

        // Save state to localStorage
        this.saveState();
        
        this.log.info('TOGGLE', `Section ${sectionId} ${isCollapsed ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Show the settings panel
     */
    show() {
        if (!this.element) {
            this.render();
        }

        // Mount to document if not already mounted
        if (!this.element.parentNode) {
            document.body.appendChild(this.element);
        }

        this.element.style.display = 'block';
        this.isVisible = true;
        
        // Load panels if not already loaded
        if (this.panelInstances.size === 0) {
            this.loadPanels();
        }

        this.log.info('SHOW', 'Settings panel shown');
    }

    /**
     * Hide the settings panel
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
        this.isVisible = false;
        this.log.info('HIDE', 'Settings panel hidden');
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Save panel state to localStorage
     */
    saveState() {
        try {
            const state = {
                collapsedSections: Array.from(this.collapsedSections),
            };
            storageService.setItem('settings_panel_state', state);
        } catch (error) {
            this.log.warn('SAVE_STATE', 'Failed to save state:', error);
        }
    }

    /**
     * Load panel state from localStorage
     */
    loadState() {
        try {
            const state = storageService.getItem('settings_panel_state');
            if (state && state.collapsedSections) {
                this.collapsedSections = new Set(state.collapsedSections);
            }
        } catch (error) {
            this.log.warn('LOAD_STATE', 'Failed to load state:', error);
        }
    }

    /**
     * Destroy the panel and clean up
     */
    destroy() {
        // Destroy all panel instances
        for (const [panelId, instance] of this.panelInstances) {
            if (typeof instance.destroy === 'function') {
                try {
                    instance.destroy();
                } catch (error) {
                    this.log.warn('DESTROY', `Failed to destroy panel ${panelId}:`, error);
                }
            }
        }

        // Remove from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        // Clean up
        this.panelInstances.clear();
        this.element = null;
        this.isVisible = false;

        this.log.info('DESTROY', 'Settings panel destroyed');
    }
}

// Create default instance and expose globally for easy access
export const mainSettingsPanel = new SettingsPanel();