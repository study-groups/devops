/**
 * DebugLoggingPanel.js - Unified Debug & Logging Control Panel
 *
 * Consolidates:
 * - TetraSettingsPanel (TETRA analytics tracking)
 * - LogSettingsPanel (Application logging)
 *
 * Features:
 * - TETRA event tracking controls (mouse, clicks, analytics, performance)
 * - Application log filtering (types, levels)
 * - Smart log level defaults (MOUSE_MOVE = DEBUG only)
 * - Unified buffer management and export
 * - Session info and statistics
 * - NO auto-refresh (manual only)
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class DebugLoggingPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'debug-logging',
            title: 'Debug & Logging',
            defaultWidth: 650,
            defaultHeight: 750,
            ...config
        });

        this.tetra = window.tetra;
        this.logTypes = ['REDUX', 'API', 'SYSTEM', 'USER', 'BOOT', 'LIFECYCLE', 'TETRA_INTERACTION'];
        this.logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

        // Load saved log filters
        this.loadLogFilters();
    }

    renderContent() {
        const config = this.tetra?.config || {};
        const sessionId = this.tetra?.sessionId || 'N/A';
        const bufferSize = this.tetra?.buffer?.length || 0;
        const isConsoleEnabled = this.isConsoleLoggingEnabled();

        return `
            <div class="devpages-panel-content">
                <div class="devpages-panel-toolbar">
                    <div class="toolbar-left">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Debug & Logging Control</h3>
                    </div>
                    <div class="toolbar-right">
                        <button id="refresh-btn" class="devpages-btn-icon" title="Refresh">
                            <span>↻</span>
                        </button>
                    </div>
                </div>

                <div class="debug-logging-container" style="padding: 16px; overflow-y: auto; height: calc(100% - 48px);">

                    <!-- TETRA Logging -->
                    <div class="devpages-panel-row">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-caret">⌄</span>
                            <span class="devpages-panel-row-title">TETRA Logging</span>
                        </div>
                        <div class="devpages-panel-row-content" id="tetra-analytics-content">

                            <!-- Session Info -->
                            <div class="info-card">
                                <div class="info-card-title">Session Information</div>
                                <div class="info-card-body">
                                    <div><strong>Session ID:</strong> <code>${sessionId}</code></div>
                                    <div><strong>Buffer Size:</strong> ${bufferSize} events</div>
                                    <div><strong>Environment:</strong> ${config.environment || 'N/A'}</div>
                                    <div><strong>User ID:</strong> ${config.userId || 'Anonymous'}</div>
                                </div>
                            </div>

                            <!-- Tracking Controls -->
                            <div class="controls-group">
                                <div class="controls-group-title">Event Tracking</div>

                                <label class="control-item">
                                    <input type="checkbox" id="enable-console-logging" ${config.enableConsoleLogging ? 'checked' : ''}>
                                    <div>
                                        <div class="control-label">Console Logging</div>
                                        <div class="control-description">Log TETRA events to browser console</div>
                                    </div>
                                </label>

                                <label class="control-item">
                                    <input type="checkbox" id="enable-analytics" ${config.enableAnalytics ? 'checked' : ''}>
                                    <div>
                                        <div class="control-label">Analytics Tracking</div>
                                        <div class="control-description">Track user interactions and behavior</div>
                                    </div>
                                </label>

                                <label class="control-item">
                                    <input type="checkbox" id="enable-performance" ${config.enablePerformanceTracking ? 'checked' : ''}>
                                    <div>
                                        <div class="control-label">Performance Tracking</div>
                                        <div class="control-description">Monitor performance metrics</div>
                                    </div>
                                </label>

                                <label class="control-item warning">
                                    <input type="checkbox" id="enable-mouse-tracking" ${config.enableMouseTracking ? 'checked' : ''}>
                                    <div>
                                        <div class="control-label">Mouse Movement Tracking</div>
                                        <div class="control-description">⚠️ Track mouse movements (very noisy - DEBUG level only)</div>
                                    </div>
                                </label>
                            </div>

                            <!-- TETRA Statistics -->
                            <div class="info-card">
                                <div class="info-card-title">Event Statistics</div>
                                <div class="info-card-body" id="tetra-stats-display">
                                    Loading statistics...
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- System Logging -->
                    <div class="devpages-panel-row">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-caret">⌄</span>
                            <span class="devpages-panel-row-title">System Logging</span>
                        </div>
                        <div class="devpages-panel-row-content" id="app-logs-content">

                            <!-- Console Toggle -->
                            <div class="controls-group">
                                <label class="control-item">
                                    <input type="checkbox" id="app-console-enabled" ${isConsoleEnabled ? 'checked' : ''}>
                                    <div>
                                        <div class="control-label">Enable Application Console Logging</div>
                                        <div class="control-description">
                                            Logs appear in DevTools: <code>[CLIENT][TYPE][MODULE][ACTION] message [LEVEL]</code>
                                        </div>
                                    </div>
                                </label>
                                <div class="status-indicator">
                                    <div class="status-light ${isConsoleEnabled ? 'active' : 'inactive'}"></div>
                                    <span class="status-text">Console logging is ${isConsoleEnabled ? 'ENABLED' : 'DISABLED'}</span>
                                </div>
                            </div>

                            <!-- Log Type Filters -->
                            <div class="controls-group">
                                <div class="controls-group-title">Log Type Filters</div>
                                <div class="filter-grid">
                                    ${this.logTypes.map(type => `
                                        <label class="filter-checkbox">
                                            <input type="checkbox" data-filter-type="${type}" ${this.isTypeEnabled(type) ? 'checked' : ''}>
                                            <span class="checkbox-text">${type}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Log Level Filters -->
                            <div class="controls-group">
                                <div class="controls-group-title">Log Level Filters</div>
                                <div class="filter-grid">
                                    ${this.logLevels.map(level => `
                                        <label class="filter-checkbox">
                                            <input type="checkbox" data-filter-level="${level}" ${this.isLevelEnabled(level) ? 'checked' : ''}>
                                            <span class="checkbox-text">${level}</span>
                                        </label>
                                    `).join('')}
                                </div>
                                <div class="filter-note">
                                    💡 <strong>Tip:</strong> TETRA MOUSE_MOVE events only show at DEBUG level
                                </div>
                            </div>

                            <!-- Format Options -->
                            <div class="controls-group">
                                <div class="controls-group-title">Format Options</div>
                                <label class="control-item compact">
                                    <input type="checkbox" id="show-timestamps" ${this.getFormatOption('timestamps') ? 'checked' : ''}>
                                    <span>Show Timestamps</span>
                                </label>
                                <label class="control-item compact">
                                    <input type="checkbox" id="show-source" ${this.getFormatOption('source') ? 'checked' : ''}>
                                    <span>Show Source Location</span>
                                </label>
                                <label class="control-item compact">
                                    <input type="checkbox" id="compact-mode" ${this.getFormatOption('compact') ? 'checked' : ''}>
                                    <span>Compact Mode</span>
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

                            <!-- Buffer Management -->
                            <div class="controls-group">
                                <div class="controls-group-title">Buffer Management</div>
                                <div class="buffer-info" id="buffer-info">
                                    <strong>TETRA:</strong> ${bufferSize} events |
                                    <strong>App Logs:</strong> <span id="app-buffer-count">0</span> entries
                                </div>
                                <div class="action-buttons">
                                    <button id="flush-tetra-buffer" class="devpages-btn-ghost">Flush TETRA Buffer</button>
                                    <button id="clear-all-buffers" class="devpages-btn-ghost">Clear All Buffers</button>
                                </div>
                            </div>

                            <!-- Export -->
                            <div class="controls-group">
                                <div class="controls-group-title">Export Data</div>
                                <div class="action-buttons">
                                    <button id="export-tetra-data" class="devpages-btn-ghost">Export TETRA Data</button>
                                    <button id="export-app-logs" class="devpages-btn-ghost">Export App Logs</button>
                                    <button id="export-all-data" class="devpages-btn-ghost devpages-btn-primary">Export All</button>
                                </div>
                            </div>

                            <!-- Testing -->
                            <div class="controls-group">
                                <div class="controls-group-title">Test Logging</div>
                                <div class="action-buttons">
                                    <button id="test-all-types" class="devpages-btn-ghost">Test All Log Types</button>
                                    <button id="test-levels" class="devpages-btn-ghost">Test All Levels</button>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

                ${this.renderStyles()}
            </div>
        `;
    }

    renderStyles() {
        return `
            <style>
                /* Debug Logging Panel - Uses DevPages Design System */
                .debug-logging-container {
                    font-size: var(--devpages-panel-font-size-compact);
                }

                .devpages-panel-row {
                    margin-bottom: var(--space-3);
                    border: 1px solid var(--devpages-panel-border);
                    border-radius: var(--radius-base);
                    overflow: hidden;
                    background: var(--devpages-panel-bg);
                }

                .devpages-panel-row-header {
                    display: flex;
                    align-items: center;
                    padding: var(--space-3);
                    background: var(--devpages-panel-header-bg);
                    cursor: pointer;
                    user-select: none;
                    transition: background-color var(--devpages-panel-transition);
                }

                .devpages-panel-row-header:hover {
                    background: var(--devpages-panel-table-hover);
                }

                .devpages-panel-row-caret {
                    display: inline-block;
                    margin-right: var(--space-2);
                    font-size: var(--font-size-sm);
                    transition: transform var(--devpages-panel-transition);
                    color: var(--devpages-panel-text-muted);
                }

                .devpages-panel-row.collapsed .devpages-panel-row-caret {
                    transform: rotate(-90deg);
                }

                .devpages-panel-row-title {
                    font-weight: var(--font-weight-semibold);
                    font-size: var(--font-size-sm);
                    color: var(--devpages-panel-text);
                }

                .devpages-panel-row-content {
                    padding: var(--space-3);
                    max-height: 2000px;
                    overflow: hidden;
                    transition: max-height 0.3s ease, padding 0.3s ease;
                }

                .devpages-panel-row.collapsed .devpages-panel-row-content {
                    max-height: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                }

                /* Info Cards */
                .info-card {
                    margin-bottom: var(--space-3);
                    padding: var(--space-3);
                    background: var(--devpages-panel-bg-alt);
                    border: 1px solid var(--devpages-panel-border);
                    border-radius: var(--radius-base);
                }

                .info-card-title {
                    font-weight: var(--font-weight-semibold);
                    font-size: var(--devpages-panel-font-size-micro);
                    color: var(--devpages-panel-text-muted);
                    margin-bottom: var(--space-2);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .info-card-body {
                    font-family: var(--devpages-panel-font-mono);
                    font-size: var(--devpages-panel-font-size-compact);
                    line-height: 1.6;
                    color: var(--devpages-panel-text);
                }

                .info-card-body div {
                    margin-bottom: var(--space-1);
                }

                .info-card-body code {
                    background: var(--devpages-panel-bg);
                    padding: var(--space-0-5) var(--space-1-5);
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--devpages-panel-border);
                    font-size: var(--devpages-panel-font-size-micro);
                }

                /* Controls */
                .controls-group {
                    margin-bottom: var(--space-3);
                }

                .controls-group-title {
                    font-weight: var(--font-weight-semibold);
                    font-size: var(--devpages-panel-font-size-micro);
                    color: var(--devpages-panel-text-muted);
                    margin-bottom: var(--space-2);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .control-item {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    margin-bottom: var(--space-2);
                    border: 1px solid var(--devpages-panel-border);
                    border-radius: var(--radius-base);
                    cursor: pointer;
                    transition: all var(--devpages-panel-hover-transition);
                    background: var(--devpages-panel-bg);
                }

                .control-item:hover {
                    background-color: var(--devpages-panel-table-hover);
                    border-color: var(--color-primary);
                }

                .control-item.warning {
                    border-color: var(--color-warning);
                    background: var(--color-warning-background);
                }

                .control-item.warning:hover {
                    background: var(--devpages-panel-table-hover);
                }

                .control-item.compact {
                    flex-direction: row;
                    align-items: center;
                    padding: var(--space-2) var(--space-3);
                    gap: var(--space-2);
                }

                .control-item input[type="checkbox"] {
                    margin-top: 2px;
                    cursor: pointer;
                    flex-shrink: 0;
                }

                .control-label {
                    font-weight: var(--font-weight-semibold);
                    font-size: var(--devpages-panel-font-size-compact);
                    color: var(--devpages-panel-text);
                    margin-bottom: var(--space-0-5);
                }

                .control-description {
                    font-size: var(--devpages-panel-font-size-micro);
                    color: var(--devpages-panel-text-muted);
                    line-height: 1.4;
                }

                .control-description code {
                    background: var(--devpages-panel-bg-alt);
                    padding: 1px var(--space-1);
                    border-radius: var(--radius-sm);
                    font-family: var(--devpages-panel-font-mono);
                    font-size: var(--devpages-panel-font-size-micro);
                }

                /* Status Indicator */
                .status-indicator {
                    display: flex;
                    align-items: center;
                    margin-top: var(--space-2);
                    padding: var(--space-2) var(--space-3);
                    background: var(--devpages-panel-bg);
                    border-radius: var(--radius-base);
                    border: 1px solid var(--devpages-panel-border);
                }

                .status-light {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: var(--space-2);
                    flex-shrink: 0;
                }

                .status-light.active {
                    background: var(--color-success);
                    box-shadow: 0 0 4px var(--color-success-background);
                }

                .status-light.inactive {
                    background: var(--color-danger);
                }

                .status-text {
                    font-size: var(--devpages-panel-font-size-compact);
                    font-weight: var(--font-weight-medium);
                    color: var(--devpages-panel-text);
                }

                /* Filters */
                .filter-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: var(--space-1-5);
                    margin-bottom: var(--space-2);
                }

                .filter-checkbox {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: var(--space-1-5) var(--space-2);
                    border: 1px solid var(--devpages-panel-border);
                    border-radius: var(--radius-base);
                    background: var(--devpages-panel-bg-alt);
                    transition: all var(--devpages-panel-hover-transition);
                }

                .filter-checkbox:hover {
                    background: var(--devpages-panel-table-hover);
                    border-color: var(--color-primary);
                }

                .filter-checkbox input {
                    margin-right: var(--space-1-5);
                    cursor: pointer;
                }

                .checkbox-text {
                    font-size: var(--devpages-panel-font-size-micro);
                    font-weight: var(--font-weight-medium);
                    color: var(--devpages-panel-text);
                }

                .filter-note {
                    padding: var(--space-2) var(--space-3);
                    background: var(--color-info-background);
                    border-left: 3px solid var(--color-info);
                    border-radius: var(--radius-base);
                    font-size: var(--devpages-panel-font-size-micro);
                    line-height: 1.4;
                    color: var(--devpages-panel-text);
                }

                /* Buffer Info */
                .buffer-info {
                    padding: var(--space-2) var(--space-3);
                    background: var(--devpages-panel-bg-alt);
                    border-radius: var(--radius-base);
                    font-size: var(--devpages-panel-font-size-compact);
                    margin-bottom: var(--space-2);
                    font-family: var(--devpages-panel-font-mono);
                    color: var(--devpages-panel-text);
                }

                /* Action Buttons */
                .action-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-1-5);
                }

                .devpages-btn-ghost {
                    padding: var(--space-2) var(--space-3);
                    border: 1px solid var(--devpages-panel-border);
                    background: var(--devpages-btn-ghost-bg);
                    color: var(--devpages-panel-text);
                    border-radius: var(--radius-base);
                    cursor: pointer;
                    font-size: var(--devpages-panel-font-size-compact);
                    transition: all var(--devpages-panel-hover-transition);
                    white-space: nowrap;
                }

                .devpages-btn-ghost:hover {
                    background-color: var(--devpages-btn-ghost-hover-bg);
                    border-color: var(--color-primary);
                }

                .devpages-btn-ghost.devpages-btn-primary {
                    background: var(--color-primary);
                    color: var(--color-bg);
                    border-color: var(--color-primary);
                }

                .devpages-btn-ghost.devpages-btn-primary:hover {
                    background: var(--color-primary-hover);
                    border-color: var(--color-primary-hover);
                }

                .devpages-btn-icon {
                    padding: var(--space-1-5) var(--space-2-5);
                    border: 1px solid var(--devpages-panel-border);
                    background: var(--devpages-panel-bg);
                    color: var(--devpages-panel-text);
                    border-radius: var(--radius-base);
                    cursor: pointer;
                    font-size: var(--font-size-base);
                    transition: all var(--devpages-panel-hover-transition);
                }

                .devpages-btn-icon:hover {
                    background: var(--devpages-panel-table-hover);
                    border-color: var(--color-primary);
                }
            </style>
        `;
    }

    onMount(container) {
        super.onMount(container);
        this.attachListeners();
        this.attachCollapseListeners();
        this.updateTetraStatistics();
        this.updateAppBufferInfo();
    }

    attachListeners() {
        const container = this.getContainer();
        if (!container) return;

        // Refresh button
        container.querySelector('#refresh-btn')?.addEventListener('click', () => this.refresh());

        // TETRA Controls
        container.querySelector('#enable-console-logging')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enableConsoleLogging = e.target.checked;
                this.saveTetraPreferences();
                this.showNotification('TETRA console logging ' + (e.target.checked ? 'enabled' : 'disabled'));
            }
        });

        container.querySelector('#enable-analytics')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enableAnalytics = e.target.checked;
                this.saveTetraPreferences();
                this.showNotification('Analytics ' + (e.target.checked ? 'enabled' : 'disabled'));
            }
        });

        container.querySelector('#enable-performance')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enablePerformanceTracking = e.target.checked;
                this.saveTetraPreferences();
                this.showNotification('Performance tracking ' + (e.target.checked ? 'enabled' : 'disabled'));
            }
        });

        container.querySelector('#enable-mouse-tracking')?.addEventListener('change', (e) => {
            if (this.tetra) {
                this.tetra.config.enableMouseTracking = e.target.checked;
                this.saveTetraPreferences();
                this.showNotification('Mouse tracking ' + (e.target.checked ? 'enabled' : 'disabled') + ' (reload page)');
            }
        });

        // App Console Toggle
        container.querySelector('#app-console-enabled')?.addEventListener('change', (e) => {
            this.toggleConsoleLogging(e.target.checked);
        });

        // Type Filters
        container.querySelectorAll('[data-filter-type]').forEach(filter => {
            filter.addEventListener('change', (e) => {
                this.updateTypeFilter(e.target.dataset.filterType, e.target.checked);
            });
        });

        // Level Filters
        container.querySelectorAll('[data-filter-level]').forEach(filter => {
            filter.addEventListener('change', (e) => {
                this.updateLevelFilter(e.target.dataset.filterLevel, e.target.checked);
            });
        });

        // Format Options
        container.querySelector('#show-timestamps')?.addEventListener('change', (e) => {
            this.setFormatOption('timestamps', e.target.checked);
        });

        container.querySelector('#show-source')?.addEventListener('change', (e) => {
            this.setFormatOption('source', e.target.checked);
        });

        container.querySelector('#compact-mode')?.addEventListener('change', (e) => {
            this.setFormatOption('compact', e.target.checked);
        });

        // Buffer Actions
        container.querySelector('#flush-tetra-buffer')?.addEventListener('click', () => {
            if (this.tetra?.flush) {
                this.tetra.flush();
                this.showNotification('TETRA buffer flushed');
                this.refresh();
            }
        });

        container.querySelector('#clear-all-buffers')?.addEventListener('click', () => {
            if (this.tetra) {
                this.tetra.buffer = [];
            }
            if (typeof window.APP?.services?.clearLogBuffer === 'function') {
                window.APP.services.clearLogBuffer();
            }
            this.showNotification('All buffers cleared');
            this.refresh();
        });

        // Export Actions
        container.querySelector('#export-tetra-data')?.addEventListener('click', () => this.exportTetraData());
        container.querySelector('#export-app-logs')?.addEventListener('click', () => this.exportAppLogs());
        container.querySelector('#export-all-data')?.addEventListener('click', () => this.exportAllData());

        // Test Actions
        container.querySelector('#test-all-types')?.addEventListener('click', () => this.testAllLogTypes());
        container.querySelector('#test-levels')?.addEventListener('click', () => this.testAllLevels());
    }

    attachCollapseListeners() {
        const container = this.getContainer();
        if (!container) return;

        container.addEventListener('click', (e) => {
            const header = e.target.closest('.devpages-panel-row-header');
            if (header) {
                const row = header.closest('.devpages-panel-row');
                if (row) {
                    row.classList.toggle('collapsed');
                }
            }
        });
    }

    // TETRA Methods
    updateTetraStatistics() {
        const container = this.getContainer();
        if (!container || !this.tetra) return;

        const statsDisplay = container.querySelector('#tetra-stats-display');
        if (!statsDisplay) return;

        const buffer = this.tetra.buffer || [];
        const eventCounts = {};
        buffer.forEach(event => {
            const type = event.token;
            eventCounts[type] = (eventCounts[type] || 0) + 1;
        });

        let html = `<div><strong>Total Events:</strong> ${buffer.length}</div>`;

        if (Object.keys(eventCounts).length === 0) {
            html += '<div style="color: #999; margin-top: 8px;">No events in buffer</div>';
        } else {
            html += '<div style="margin-top: 12px;"><strong>Event Breakdown:</strong></div>';
            html += '<div style="margin-left: 12px; margin-top: 6px;">';
            Object.entries(eventCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([type, count]) => {
                    html += `<div>${type}: ${count}</div>`;
                });
            html += '</div>';
        }

        statsDisplay.innerHTML = html;
    }

    saveTetraPreferences() {
        if (!this.tetra) {
            console.warn('[DebugLoggingPanel] Cannot save TETRA preferences - window.tetra not available');
            return;
        }

        const preferences = {
            enableConsoleLogging: this.tetra.config.enableConsoleLogging,
            enableAnalytics: this.tetra.config.enableAnalytics,
            enablePerformanceTracking: this.tetra.config.enablePerformanceTracking,
            enableMouseTracking: this.tetra.config.enableMouseTracking
        };

        localStorage.setItem('tetraPreferences', JSON.stringify(preferences));
        console.log('[DebugLoggingPanel] Saved TETRA preferences:', preferences);
    }

    exportTetraData() {
        if (!this.tetra?.buffer) return;

        const data = JSON.stringify(this.tetra.buffer, null, 2);
        this.downloadFile(data, `tetra-data-${Date.now()}.json`, 'application/json');
        this.showNotification('TETRA data exported');
    }

    // App Logging Methods
    isConsoleLoggingEnabled() {
        if (typeof window.APP?.services?.isConsoleLoggingEnabled === 'function') {
            return window.APP.services.isConsoleLoggingEnabled();
        }
        return false;
    }

    toggleConsoleLogging(enabled) {
        try {
            if (enabled) {
                if (typeof window.APP?.services?.enableConsoleLogging === 'function') {
                    window.APP.services.enableConsoleLogging(true);
                }
            } else {
                if (typeof window.APP?.services?.disableConsoleLogging === 'function') {
                    window.APP.services.disableConsoleLogging(true);
                }
            }
            this.updateStatusIndicator(enabled);
        } catch (error) {
            console.error('[DebugLoggingPanel] Error toggling console logging:', error);
        }
    }

    updateStatusIndicator(enabled) {
        const container = this.getContainer();
        if (!container) return;

        const statusLight = container.querySelector('.status-light');
        const statusText = container.querySelector('.status-text');

        if (statusLight) {
            statusLight.className = `status-light ${enabled ? 'active' : 'inactive'}`;
        }
        if (statusText) {
            statusText.textContent = `Console logging is ${enabled ? 'ENABLED' : 'DISABLED'}`;
        }
    }

    updateAppBufferInfo() {
        const container = this.getContainer();
        if (!container) return;

        const bufferCountElement = container.querySelector('#app-buffer-count');
        if (bufferCountElement) {
            try {
                if (typeof window.APP?.services?.getLogBuffer === 'function') {
                    const buffer = window.APP.services.getLogBuffer();
                    bufferCountElement.textContent = buffer.length;
                } else {
                    bufferCountElement.textContent = '0';
                }
            } catch (error) {
                bufferCountElement.textContent = 'Error';
            }
        }
    }

    exportAppLogs() {
        try {
            if (typeof window.APP?.services?.getLogBuffer === 'function') {
                const logs = window.APP.services.getLogBuffer();
                const jsonStr = JSON.stringify(logs, null, 2);
                this.downloadFile(jsonStr, `app-logs-${Date.now()}.json`, 'application/json');
                this.showNotification('App logs exported');
            }
        } catch (error) {
            console.error('[DebugLoggingPanel] Error exporting app logs:', error);
        }
    }

    exportAllData() {
        const allData = {
            tetra: this.tetra?.buffer || [],
            appLogs: window.APP?.services?.getLogBuffer?.() || [],
            exportedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(allData, null, 2);
        this.downloadFile(jsonStr, `debug-data-${Date.now()}.json`, 'application/json');
        this.showNotification('All data exported');
    }

    // Log Filters
    loadLogFilters() {
        try {
            const saved = localStorage.getItem('debugLoggingFilters');
            if (saved) {
                this.logFilters = JSON.parse(saved);
            } else {
                // Default filters - TETRA_INTERACTION is OFF by default
                this.logFilters = {
                    types: this.logTypes.reduce((acc, type) => ({
                        ...acc,
                        [type]: type !== 'TETRA_INTERACTION' // All ON except TETRA_INTERACTION
                    }), {}),
                    levels: this.logLevels.reduce((acc, level) => ({ ...acc, [level]: true }), {}),
                    format: {
                        timestamps: true,
                        source: true,
                        compact: false
                    }
                };
            }
        } catch (error) {
            console.error('[DebugLoggingPanel] Error loading filters:', error);
            this.logFilters = { types: {}, levels: {}, format: {} };
        }
    }

    saveLogFilters() {
        try {
            localStorage.setItem('debugLoggingFilters', JSON.stringify(this.logFilters));
        } catch (error) {
            console.error('[DebugLoggingPanel] Error saving filters:', error);
        }
    }

    isTypeEnabled(type) {
        return this.logFilters?.types?.[type] !== false;
    }

    isLevelEnabled(level) {
        return this.logFilters?.levels?.[level] !== false;
    }

    updateTypeFilter(type, enabled) {
        if (!this.logFilters.types) this.logFilters.types = {};
        this.logFilters.types[type] = enabled;
        this.saveLogFilters();
    }

    updateLevelFilter(level, enabled) {
        if (!this.logFilters.levels) this.logFilters.levels = {};
        this.logFilters.levels[level] = enabled;
        this.saveLogFilters();
    }

    getFormatOption(option) {
        return this.logFilters?.format?.[option] !== false;
    }

    setFormatOption(option, value) {
        if (!this.logFilters.format) this.logFilters.format = {};
        this.logFilters.format[option] = value;
        this.saveLogFilters();
    }

    // Test Methods
    testAllLogTypes() {
        import('/client/log/LogCore.js').then(({ log: logCore }) => {
            this.logTypes.forEach((type, index) => {
                setTimeout(() => {
                    logCore({
                        message: `Test ${type} log message`,
                        source: 'CLIENT',
                        type: type,
                        module: 'DEBUG_PANEL',
                        action: 'TEST',
                        level: 'INFO',
                        forceConsole: true
                    });
                }, index * 100);
            });
        });
    }

    testAllLevels() {
        import('/client/log/LogCore.js').then(({ log: logCore }) => {
            this.logLevels.forEach((level, index) => {
                setTimeout(() => {
                    logCore({
                        message: `Test ${level} level message`,
                        source: 'CLIENT',
                        type: 'SYSTEM',
                        module: 'DEBUG_PANEL',
                        action: 'TEST_LEVEL',
                        level: level,
                        forceConsole: true
                    });
                }, index * 100);
            });
        });
    }

    // Utility Methods
    refresh() {
        this.updateTetraStatistics();
        this.updateAppBufferInfo();

        const container = this.getContainer();
        if (container && this.tetra) {
            const bufferSize = this.tetra.buffer?.length || 0;
            const bufferInfo = container.querySelector('#buffer-info');
            if (bufferInfo) {
                const appCount = container.querySelector('#app-buffer-count')?.textContent || '0';
                bufferInfo.innerHTML = `<strong>TETRA:</strong> ${bufferSize} events | <strong>App Logs:</strong> ${appCount} entries`;
            }
        }

        this.showNotification('Refreshed');
    }

    showNotification(message) {
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

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    getContainer() {
        return this.element?.querySelector('.panel-body') || this.element || this.container;
    }

    onDestroy() {
        super.onDestroy();
    }
}

// Register panel
panelRegistry.registerType('debug-logging', DebugLoggingPanel);

export default DebugLoggingPanel;
