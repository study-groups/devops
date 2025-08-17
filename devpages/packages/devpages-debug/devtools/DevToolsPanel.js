/**
 * DevToolsPanel.js - Modular DevTools panel for devpages
 * 
 * This panel provides debugging tools for:
 * - StateKit DevTools (action history, time travel, performance)
 * - Panel system debugging (registry, lifecycle, metadata)
 * - Application state inspection
 */

import { appStore } from "/client/appState.js";
import { logMessage } from "/client/log/index.js";
import { panelRegistry } from '/client/panels/panelRegistry.js';

// Import modular components from the new location
import { StateInspector } from './modules/StateInspector.js';
import { ActionHistory } from './modules/ActionHistory.js';
import { PerformanceMonitor } from './modules/PerformanceMonitor.js';
import { DevToolsUtilities } from './modules/DevToolsUtilities.js';
import { CacheManager } from './modules/CacheManager.js';

// Ensure icons.css is loaded
// This is now handled by the core.bundle.css
/*
const iconsLink = document.createElement('link');
iconsLink.rel = 'stylesheet';
iconsLink.href = '/client/styles/icons.css';
if (!document.head.querySelector('link[href="/client/styles/icons.css"]')) {
    document.head.appendChild(iconsLink);
}
*/

export class DevToolsPanel {
    static id = 'devtools-panel';

    constructor() {
        this.element = null;
        this.isInitialized = false;
        this.activeTab = 'statekit';
        this.devTools = null;
        this.consolePanel = null;
        
        // Modular components
        this.stateInspector = null;
        this.actionHistory = null;
        this.performanceMonitor = null;
        this.devToolsUtilities = null;
        this.cacheManager = null;
    }

    render() {
        if (this.element) return this.element;
        this.element = document.createElement('div');
        this.element.className = 'devtools-panel-container';
        this.createUI();
        return this.element;
    }

    onMount(container) {
        this.container = container;
        this.setupEventHandlers();
        this.initialize();
    }

    createUI() {
        this.element.innerHTML = `
            <div class="devtools-panel">
                <div class="panel-header">
                    <h3>DevTools</h3>
                    <div class="panel-controls">
                        <button id="refresh-devtools" class="btn btn-sm" title="Refresh">
                            <span class="icon icon-settings"></span>
                        </button>
                        <button id="export-devtools" class="btn btn-sm" title="Export Data">
                            <span class="icon icon-copy"></span>
                        </button>
                        <button id="clear-devtools" class="btn btn-sm" title="Clear Data">
                            <span class="icon icon-trash"></span>
                        </button>
                    </div>
                </div>
                
                <div class="panel-content">
                    <div class="tab-navigation">
                        <button class="tab-btn active" data-tab="statekit">StateKit</button>
                        <button class="tab-btn" data-tab="performance">Performance</button>
                        <button class="tab-btn" data-tab="cache">Cache</button>
                        <button class="tab-btn" data-tab="utilities">Utilities</button>
                    </div>
                    
                    <div class="tab-content">
                        <!-- StateKit Tab -->
                        <div id="statekit-tab" class="tab-pane active">
                            <div class="section">
                                <h4>Action History</h4>
                                <div class="action-history-container" id="action-history-container">
                                    <div class="loading">Loading action history...</div>
                                </div>
                            </div>
                            
                            <div class="section">
                                <h4>State Inspection</h4>
                                <div class="state-inspector-container" id="state-inspector-container">
                                    <div class="loading">Loading state inspector...</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Performance Tab -->
                        <div id="performance-tab" class="tab-pane">
                            <div class="performance-monitor-container" id="performance-monitor-container">
                                <div class="loading">Loading performance monitor...</div>
                            </div>
                        </div>
                        
                        <!-- Cache Tab -->
                        <div id="cache-tab" class="tab-pane">
                            <div class="cache-manager-container" id="cache-manager-container">
                                <div class="loading">Loading cache manager...</div>
                            </div>
                        </div>

                        <!-- Utilities Tab -->
                        <div id="utilities-tab" class="tab-pane">
                            <div class="devtools-utilities-container" id="devtools-utilities-container">
                                <div class="loading">Loading utilities...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .devtools-panel {
                padding: 16px;
                font-family: var(--font-family-sans, system-ui);
                height: 100%;
                display: flex;
                flex-direction: column;
                background-color: var(--color-bg, white);
                color: var(--color-fg, #333);
            }
            
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            
            .panel-header h3 {
                margin: 0;
                font-size: 16px;
                color: var(--color-fg, #333);
            }
            
            .panel-controls {
                display: flex;
                gap: 4px;
            }
            
            .tab-navigation {
                display: flex;
                gap: 4px;
                margin-bottom: 16px;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            
            .tab-btn {
                padding: 8px 16px;
                border: none;
                background: none;
                cursor: pointer;
                font-size: 12px;
                color: var(--color-fg-muted, #666);
                border-bottom: 2px solid transparent;
            }
            
            .tab-btn.active {
                color: var(--color-primary, #007bff);
                border-bottom-color: var(--color-primary, #007bff);
            }
            
            .tab-content {
                flex: 1;
                overflow-y: auto;
            }
            
            .tab-pane {
                display: none;
            }
            
            .tab-pane.active {
                display: block;
            }
            
            .section {
                margin-bottom: 24px;
            }
            
            .section h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: var(--color-fg, #333);
            }
            
            .loading {
                text-align: center;
                padding: 20px;
                color: var(--color-fg-muted, #666);
            }
            
            .error {
                color: var(--color-error, #dc3545);
                padding: 8px;
                background: var(--color-bg-error, #f8d7da);
                border: 1px solid var(--color-error, #dc3545);
                border-radius: 4px;
                margin-bottom: 8px;
            }
            
            .btn {
                padding: 6px 12px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                background: var(--color-bg, white);
                color: var(--color-fg, #333);
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }
            
            .btn:hover:not(:disabled) {
                background: var(--color-bg-hover, #f8f9fa);
            }
            
            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn-sm {
                padding: 4px 8px;
                font-size: 10px;
            }
            
            .btn .icon {
                width: 12px;
                height: 12px;
            }
        `;
        this.element.appendChild(style);
    }

    setupEventHandlers() {
        // Tab navigation
        this.element.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Control buttons
        this.element.querySelector('#refresh-devtools').addEventListener('click', () => {
            this.refreshAllData();
        });

        this.element.querySelector('#export-devtools').addEventListener('click', () => {
            this.exportDevToolsData();
        });

        this.element.querySelector('#clear-devtools').addEventListener('click', () => {
            this.clearDevToolsData();
        });
    }

    async initialize() {
        try {
            this.isInitialized = true;
            console.log('[DevToolsPanel] DevTools panel initialized successfully');
            
            // Try to get DevTools from window
            this.devTools = window.__STATEKIT_DEVTOOLS__;
            this.consolePanel = window.__STATEKIT_PANEL__;
            
            if (this.devTools) {
                console.log('[DevToolsPanel] StateKit DevTools found');
            } else {
                console.warn('[DevToolsPanel] StateKit DevTools not found');
            }
            
            // Initialize modular components
            this.initializeComponents();
            
            // Initial render
            this.refreshAllData();
            
        } catch (error) {
            console.error('[DevToolsPanel] Error initializing DevTools panel:', error);
            this.element.querySelector('.tab-content').innerHTML = 
                `<div class="error">Error initializing: ${error.message}</div>`;
        }
    }

    initializeComponents() {
        // Initialize StateInspector
        const stateInspectorContainer = this.element.querySelector('#state-inspector-container');
        if (stateInspectorContainer) {
            this.stateInspector = new StateInspector(stateInspectorContainer, appStore);
        }

        // Initialize ActionHistory
        const actionHistoryContainer = this.element.querySelector('#action-history-container');
        if (actionHistoryContainer) {
            this.actionHistory = new ActionHistory(actionHistoryContainer, this.devTools);
        }

        // Initialize PerformanceMonitor
        const performanceMonitorContainer = this.element.querySelector('#performance-monitor-container');
        if (performanceMonitorContainer) {
            this.performanceMonitor = new PerformanceMonitor(performanceMonitorContainer, this.devTools);
        }

        // Initialize DevToolsUtilities
        const devToolsUtilitiesContainer = this.element.querySelector('#devtools-utilities-container');
        if (devToolsUtilitiesContainer) {
            this.devToolsUtilities = new DevToolsUtilities(devToolsUtilitiesContainer);
        }

        // Initialize CacheManager
        const cacheManagerContainer = this.element.querySelector('#cache-manager-container');
        if (cacheManagerContainer) {
            this.cacheManager = new CacheManager(cacheManagerContainer);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        this.element.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        this.element.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });

        this.activeTab = tabName;
        this.refreshTabData(tabName);
    }

    refreshTabData(tabName) {
        switch (tabName) {
            case 'statekit':
                if (this.actionHistory) this.actionHistory.updateActionHistory();
                if (this.stateInspector) this.stateInspector.updateStateDisplay();
                break;
            case 'performance':
                if (this.performanceMonitor) {
                    this.performanceMonitor.updatePerformanceMetrics();
                    this.performanceMonitor.updateMemoryUsage();
                }
                break;
            case 'cache':
                if (this.cacheManager) {
                    this.cacheManager.updateCacheStatus();
                }
                break;
            case 'utilities':
                if (this.devToolsUtilities) {
                    this.devToolsUtilities.updateSystemInfo();
                }
                break;
        }
    }

    refreshAllData() {
        this.refreshTabData(this.activeTab);
    }

    exportDevToolsData() {
        console.log('[DevToolsPanel] Exporting DevTools data...');
        
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                devTools: this.devTools ? {
                    actionHistory: this.devTools.getActionHistory().length,
                    performanceMetrics: this.devTools.getPerformanceMetrics()
                } : null,
                state: appStore ? appStore.getState() : null,
                systemInfo: {
                    userAgent: navigator.userAgent,
                    url: window.location.href
                }
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `devtools-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            
            console.log('DevTools data exported');
            
        } catch (error) {
            console.error('Error exporting DevTools data:', error);
        }
    }

    clearDevToolsData() {
        console.log('[DevToolsPanel] Clearing DevTools data...');
        
        try {
            // Clear DevTools history
            if (this.devTools) {
                this.devTools.clearHistory();
            }
            
            // Clear component data
            if (this.actionHistory) {
                this.actionHistory.clearHistory();
            }
            
            // Refresh displays
            this.refreshAllData();
            
            console.log('DevTools data cleared');
            
        } catch (error) {
            console.error('Error clearing DevTools data:', error);
        }
    }

    destroy() {
        // Destroy all components
        if (this.stateInspector) this.stateInspector.destroy();
        if (this.actionHistory) this.actionHistory.destroy();
        if (this.performanceMonitor) this.performanceMonitor.destroy();
        if (this.devToolsUtilities) this.devToolsUtilities.destroy();
        if (this.cacheManager) this.cacheManager.destroy();
        
        console.log('[DevToolsPanel] DevTools panel destroyed');
    }
} 