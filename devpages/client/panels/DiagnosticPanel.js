/**
 * DiagnosticPanel.js - Example diagnostic panel implementation
 * 
 * Demonstrates how to extend BasePanel for specific functionality
 */

import { BasePanel } from './BasePanel.js';
import { appStore } from '../appState.js';

export class DiagnosticPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'diagnostic',
            title: 'System Diagnostics',
            defaultWidth: 600,
            defaultHeight: 400,
            ...config
        });
        
        this.refreshInterval = null;
        this.diagnosticData = {};
    }

    renderContent() {
        return `
            <div class="diagnostic-panel-content">
                <div class="diagnostic-header">
                    <button id="refresh-diagnostics" class="btn btn-sm">Refresh</button>
                    <label>
                        <input type="checkbox" id="auto-refresh" /> Auto-refresh (5s)
                    </label>
                </div>
                <div class="diagnostic-sections">
                    <div class="diagnostic-section">
                        <h4>System Status</h4>
                        <div id="system-status" class="diagnostic-content">Loading...</div>
                    </div>
                    <div class="diagnostic-section">
                        <h4>Component Registry</h4>
                        <div id="component-status" class="diagnostic-content">Loading...</div>
                    </div>
                    <div class="diagnostic-section">
                        <h4>Redux State</h4>
                        <div id="redux-status" class="diagnostic-content">Loading...</div>
                    </div>
                    <div class="diagnostic-section">
                        <h4>Performance Metrics</h4>
                        <div id="performance-metrics" class="diagnostic-content">Loading...</div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount() {
        super.onMount();
        this.attachDiagnosticListeners();
        this.refreshDiagnostics();
    }

    attachDiagnosticListeners() {
        const refreshBtn = this.element.querySelector('#refresh-diagnostics');
        const autoRefreshCheckbox = this.element.querySelector('#auto-refresh');

        refreshBtn?.addEventListener('click', () => {
            this.refreshDiagnostics();
        });

        autoRefreshCheckbox?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    refreshDiagnostics() {
        this.updateSystemStatus();
        this.updateComponentStatus();
        this.updateReduxStatus();
        this.updatePerformanceMetrics();
    }

    updateSystemStatus() {
        const systemStatus = {
            timestamp: new Date().toLocaleString(),
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
            } : 'Not available',
            online: navigator.onLine,
            cookiesEnabled: navigator.cookieEnabled
        };

        const container = this.element.querySelector('#system-status');
        if (container) {
            container.innerHTML = `
                <div class="status-grid">
                    <div><strong>Timestamp:</strong> ${systemStatus.timestamp}</div>
                    <div><strong>Viewport:</strong> ${systemStatus.viewport}</div>
                    <div><strong>Online:</strong> ${systemStatus.online ? '✅' : '❌'}</div>
                    <div><strong>Cookies:</strong> ${systemStatus.cookiesEnabled ? '✅' : '❌'}</div>
                    ${typeof systemStatus.memory === 'object' ? `
                        <div><strong>Memory Used:</strong> ${systemStatus.memory.used}</div>
                        <div><strong>Memory Total:</strong> ${systemStatus.memory.total}</div>
                    ` : `<div><strong>Memory:</strong> ${systemStatus.memory}</div>`}
                </div>
            `;
        }
    }

    updateComponentStatus() {
        const components = [];
        
        // Check bootloader components
        if (window.APP?.bootloader) {
            components.push({
                name: 'Bootloader',
                status: window.APP.bootloader.phase || 'unknown',
                type: 'system'
            });
        }

        // Check panel registry
        if (window.APP?.panels?.registry) {
            const panelCount = window.APP.panels.registry.getAllPanels().length;
            components.push({
                name: 'Panel Registry',
                status: `${panelCount} panels`,
                type: 'system'
            });
        }

        // Check services
        if (window.APP?.services) {
            Object.keys(window.APP.services).forEach(serviceName => {
                components.push({
                    name: serviceName,
                    status: 'active',
                    type: 'service'
                });
            });
        }

        const container = this.element.querySelector('#component-status');
        if (container) {
            container.innerHTML = components.length > 0 ? `
                <div class="component-list">
                    ${components.map(comp => `
                        <div class="component-item">
                            <span class="component-name">${comp.name}</span>
                            <span class="component-type">(${comp.type})</span>
                            <span class="component-status">${comp.status}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '<div>No components detected</div>';
        }
    }

    updateReduxStatus() {
        const store = appStore;
        if (!store) {
            const container = this.element.querySelector('#redux-status');
            if (container) {
                container.innerHTML = '<div>Redux store not available</div>';
            }
            return;
        }

        const state = store.getState();
        const stateKeys = Object.keys(state);
        
        const container = this.element.querySelector('#redux-status');
        if (container) {
            container.innerHTML = `
                <div class="redux-info">
                    <div><strong>State Keys:</strong> ${stateKeys.join(', ')}</div>
                    <div><strong>Panel Count:</strong> ${Object.keys(state.panels?.panels || {}).length}</div>
                    <div><strong>Active Panel:</strong> ${state.panels?.activePanel || 'None'}</div>
                    <details>
                        <summary>Full State (click to expand)</summary>
                        <pre class="state-dump">${JSON.stringify(state, null, 2)}</pre>
                    </details>
                </div>
            `;
        }
    }

    updatePerformanceMetrics() {
        const metrics = {
            loadTime: performance.timing ? 
                performance.timing.loadEventEnd - performance.timing.navigationStart : 'N/A',
            domContentLoaded: performance.timing ?
                performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : 'N/A',
            entries: performance.getEntriesByType('navigation').length,
            resources: performance.getEntriesByType('resource').length
        };

        const container = this.element.querySelector('#performance-metrics');
        if (container) {
            container.innerHTML = `
                <div class="metrics-grid">
                    <div><strong>Page Load:</strong> ${metrics.loadTime}ms</div>
                    <div><strong>DOM Ready:</strong> ${metrics.domContentLoaded}ms</div>
                    <div><strong>Navigation Entries:</strong> ${metrics.entries}</div>
                    <div><strong>Resource Entries:</strong> ${metrics.resources}</div>
                </div>
            `;
        }
    }

    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing interval
        this.refreshInterval = setInterval(() => {
            this.refreshDiagnostics();
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    onDestroy() {
        this.stopAutoRefresh();
        super.onDestroy();
    }
}

// Factory function for bootloader compatibility
export function createDiagnosticPanel(config = {}) {
    return new DiagnosticPanel(config);
}
