/**
 * TetraSettingsPanel.js - Control Tetra Analytics Settings
 *
 * Features:
 * - Toggle tracking options (mouse, analytics, performance, console logging)
 * - View current session info
 * - Clear tracking buffer
 * - Export tracking data
 * - View tracking statistics
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class TetraSettingsPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'tetra-settings',
            title: 'Tetra Settings',
            defaultWidth: 600,
            defaultHeight: 700,
            ...config
        });

        this.tetra = window.tetra;
        this.refreshInterval = null;
    }

    renderContent() {
        const config = this.tetra?.config || {};
        const sessionId = this.tetra?.sessionId || 'N/A';
        const bufferSize = this.tetra?.buffer?.length || 0;

        return `
            <div class="devpages-panel-content">
                <div class="devpages-panel-toolbar">
                    <div class="toolbar-left">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Tetra Analytics Control</h3>
                    </div>
                </div>

                <div class="tetra-settings-container" style="padding: 16px; overflow-y: auto; height: calc(100% - 48px);">

                    <!-- Session Info -->
                    <div class="devpages-panel-row">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-caret">⌄</span>
                            <span class="devpages-panel-row-title">Session Information</span>
                        </div>
                        <div class="devpages-panel-row-content" id="session-info-content">
                            <div style="font-family: monospace; font-size: 12px; line-height: 1.6;">
                                <div><strong>Session ID:</strong> ${sessionId}</div>
                                <div><strong>Buffer Size:</strong> ${bufferSize} events</div>
                                <div><strong>Environment:</strong> ${config.environment || 'N/A'}</div>
                                <div><strong>User ID:</strong> ${config.userId || 'Anonymous'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Tracking Controls -->
                    <div class="devpages-panel-row">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-caret">⌄</span>
                            <span class="devpages-panel-row-title">Tracking Controls</span>
                        </div>
                        <div class="devpages-panel-row-content" id="tracking-controls-content">
                            <div style="display: flex; flex-direction: column; gap: 12px;">

                                <label class="tetra-control-item">
                                    <input type="checkbox" id="enable-console-logging" ${config.enableConsoleLogging ? 'checked' : ''}>
                                    <div>
                                        <div style="font-weight: 600;">Console Logging</div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #666);">
                                            Log tracking events to browser console
                                        </div>
                                    </div>
                                </label>

                                <label class="tetra-control-item">
                                    <input type="checkbox" id="enable-analytics" ${config.enableAnalytics ? 'checked' : ''}>
                                    <div>
                                        <div style="font-weight: 600;">Analytics</div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #666);">
                                            Track user interactions and behavior
                                        </div>
                                    </div>
                                </label>

                                <label class="tetra-control-item">
                                    <input type="checkbox" id="enable-performance" ${config.enablePerformanceTracking ? 'checked' : ''}>
                                    <div>
                                        <div style="font-weight: 600;">Performance Tracking</div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #666);">
                                            Monitor performance metrics
                                        </div>
                                    </div>
                                </label>

                                <label class="tetra-control-item">
                                    <input type="checkbox" id="enable-mouse-tracking" ${config.enableMouseTracking ? 'checked' : ''}>
                                    <div>
                                        <div style="font-weight: 600;">Mouse Movement Tracking</div>
                                        <div style="font-size: 12px; color: var(--text-secondary, #666);">
                                            Track mouse movements (can be noisy)
                                        </div>
                                    </div>
                                </label>

                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="devpages-panel-row">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-caret">⌄</span>
                            <span class="devpages-panel-row-title">Actions</span>
                        </div>
                        <div class="devpages-panel-row-content" id="actions-content">
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button id="flush-buffer-btn" class="devpages-btn-ghost">
                                    <span>Flush Event Buffer</span>
                                </button>
                                <button id="export-data-btn" class="devpages-btn-ghost">
                                    <span>Export Tracking Data</span>
                                </button>
                                <button id="clear-buffer-btn" class="devpages-btn-ghost">
                                    <span>Clear Buffer</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Statistics -->
                    <div class="devpages-panel-row">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-caret">⌄</span>
                            <span class="devpages-panel-row-title">Statistics</span>
                        </div>
                        <div class="devpages-panel-row-content" id="statistics-content">
                            <div id="stats-display" style="font-family: monospace; font-size: 12px; line-height: 1.6;">
                                Loading statistics...
                            </div>
                        </div>
                    </div>

                </div>

                <style>
                    .devpages-panel-row {
                        margin-bottom: 12px;
                        border: 1px solid var(--border-color, #ddd);
                        border-radius: 6px;
                        overflow: hidden;
                    }

                    .devpages-panel-row-header {
                        display: flex;
                        align-items: center;
                        padding: 12px;
                        background: var(--header-bg, #f8f9fa);
                        cursor: pointer;
                        user-select: none;
                        transition: background-color 0.2s;
                    }

                    .devpages-panel-row-header:hover {
                        background: var(--header-hover-bg, #e9ecef);
                    }

                    .devpages-panel-row-caret {
                        display: inline-block;
                        margin-right: 8px;
                        font-size: 14px;
                        transition: transform 0.2s;
                        color: #666;
                    }

                    .devpages-panel-row-title {
                        font-weight: 600;
                        font-size: 14px;
                        color: #333;
                    }

                    .devpages-panel-row-content {
                        padding: 16px;
                        background: white;
                        max-height: 1000px;
                        overflow: hidden;
                        transition: max-height 0.3s ease, padding 0.3s ease;
                    }

                    .devpages-panel-row.collapsed .devpages-panel-row-content {
                        max-height: 0;
                        padding-top: 0;
                        padding-bottom: 0;
                    }

                    .tetra-control-item {
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        padding: 12px;
                        border: 1px solid var(--border-color, #ddd);
                        border-radius: 6px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }

                    .tetra-control-item:hover {
                        background-color: var(--hover-bg, #f5f5f5);
                    }

                    .tetra-control-item input[type="checkbox"] {
                        margin-top: 2px;
                        cursor: pointer;
                    }

                    .devpages-btn-ghost {
                        width: 100%;
                        padding: 10px 16px;
                        border: 1px solid var(--border-color, #ddd);
                        background: transparent;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.2s;
                    }

                    .devpages-btn-ghost:hover {
                        background-color: var(--hover-bg, #f5f5f5);
                        border-color: var(--border-hover, #999);
                    }
                </style>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);

        this.attachListeners();
        this.attachCollapseListeners();
        this.updateStatistics();

        // Auto-refresh statistics every 2 seconds
        this.refreshInterval = setInterval(() => {
            this.updateStatistics();
        }, 2000);
    }

    attachListeners() {
        const container = this.getContainer();
        if (!container) return;

        // Tracking controls
        container.querySelector('#enable-console-logging')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enableConsoleLogging = e.target.checked;
                this.savePreferences();
                this.showNotification('Console logging ' + (e.target.checked ? 'enabled' : 'disabled'));
            }
        });

        container.querySelector('#enable-analytics')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enableAnalytics = e.target.checked;
                this.savePreferences();
                this.showNotification('Analytics ' + (e.target.checked ? 'enabled' : 'disabled'));
            }
        });

        container.querySelector('#enable-performance')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enablePerformanceTracking = e.target.checked;
                this.savePreferences();
                this.showNotification('Performance tracking ' + (e.target.checked ? 'enabled' : 'disabled'));
            }
        });

        container.querySelector('#enable-mouse-tracking')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enableMouseTracking = e.target.checked;
                this.savePreferences();
                this.showNotification('Mouse tracking ' + (e.target.checked ? 'enabled' : 'disabled') + ' (requires reload)');
            }
        });

        // Actions
        container.querySelector('#flush-buffer-btn')?.addEventListener('click', () => {
            if (this.tetra?.flush) {
                this.tetra.flush();
                this.showNotification('Event buffer flushed');
                this.updateStatistics();
            }
        });

        container.querySelector('#export-data-btn')?.addEventListener('click', () => this.exportData());

        container.querySelector('#clear-buffer-btn')?.addEventListener('click', () => {
            if (this.tetra) {
                this.tetra.buffer = [];
                this.showNotification('Buffer cleared');
                this.updateStatistics();
            }
        });
    }

    attachCollapseListeners() {
        const container = this.getContainer();
        if (!container) return;

        container.addEventListener('click', (e) => {
            const header = e.target.closest('.devpages-panel-row-header');
            if (header) {
                const row = header.closest('.devpages-panel-row');
                if (row) {
                    this.toggleCollapse(row);
                }
            }
        });
    }

    toggleCollapse(row) {
        const content = row.querySelector('.devpages-panel-row-content');
        const caret = row.querySelector('.devpages-panel-row-caret');

        if (content && caret) {
            if (row.classList.contains('collapsed')) {
                row.classList.remove('collapsed');
                caret.textContent = '⌄';
            } else {
                row.classList.add('collapsed');
                caret.textContent = '›';
            }
        }
    }

    updateStatistics() {
        const container = this.getContainer();
        if (!container || !this.tetra) return;

        const statsDisplay = container.querySelector('#stats-display');
        if (!statsDisplay) return;

        const buffer = this.tetra.buffer || [];

        // Count event types
        const eventCounts = {};
        buffer.forEach(event => {
            const type = event.token;
            eventCounts[type] = (eventCounts[type] || 0) + 1;
        });

        // Format statistics
        let html = `<div><strong>Total Events:</strong> ${buffer.length}</div>`;
        html += `<div style="margin-top: 12px;"><strong>Event Breakdown:</strong></div>`;
        html += '<div style="margin-left: 16px; margin-top: 8px;">';

        if (Object.keys(eventCounts).length === 0) {
            html += '<div style="color: #999;">No events in buffer</div>';
        } else {
            Object.entries(eventCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([type, count]) => {
                    html += `<div>${type}: ${count}</div>`;
                });
        }

        html += '</div>';
        statsDisplay.innerHTML = html;
    }

    exportData() {
        if (!this.tetra?.buffer) return;

        const data = JSON.stringify(this.tetra.buffer, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `tetra-data-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showNotification('Data exported');
    }

    showNotification(message) {
        const container = this.getContainer();
        if (!container) return;

        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    refresh() {
        this.updateStatistics();
        const container = this.getContainer();
        if (container) {
            // Update session info
            const sessionInfoContent = container.querySelector('#session-info-content');
            if (sessionInfoContent && this.tetra) {
                const config = this.tetra.config || {};
                const sessionId = this.tetra.sessionId || 'N/A';
                const bufferSize = this.tetra.buffer?.length || 0;

                sessionInfoContent.innerHTML = `
                    <div style="font-family: monospace; font-size: 12px; line-height: 1.6;">
                        <div><strong>Session ID:</strong> ${sessionId}</div>
                        <div><strong>Buffer Size:</strong> ${bufferSize} events</div>
                        <div><strong>Environment:</strong> ${config.environment || 'N/A'}</div>
                        <div><strong>User ID:</strong> ${config.userId || 'Anonymous'}</div>
                    </div>
                `;
            }
        }
        this.showNotification('Refreshed');
    }

    savePreferences() {
        if (!this.tetra) return;

        const preferences = {
            enableConsoleLogging: this.tetra.config.enableConsoleLogging,
            enableAnalytics: this.tetra.config.enableAnalytics,
            enablePerformanceTracking: this.tetra.config.enablePerformanceTracking,
            enableMouseTracking: this.tetra.config.enableMouseTracking
        };

        console.log('[TetraSettings] Saving preferences:', preferences);
        localStorage.setItem('tetraPreferences', JSON.stringify(preferences));
        console.log('[TetraSettings] Preferences saved to localStorage');
    }

    static loadPreferences() {
        try {
            const saved = localStorage.getItem('tetraPreferences');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('[TetraSettings] Failed to load preferences:', error);
            return null;
        }
    }

    onDestroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        super.onDestroy();
    }
}

// Register panel
panelRegistry.registerType('tetra-settings', TetraSettingsPanel);

export default TetraSettingsPanel;
