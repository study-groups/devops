/**
 * LogSettingsPanel.js - Logging system settings panel
 * 
 * Provides controls for console logging, type filtering, and log display options
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class LogSettingsPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'log-settings',
            title: 'Log Settings',
            defaultWidth: 400,
            defaultHeight: 500,
            ...config
        });
        
        this.container = null;
        this.logTypes = ['REDUX', 'API', 'SYSTEM', 'USER', 'BOOT', 'LIFECYCLE'];
        this.logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    }

    render() {
        try {
            this.element = document.createElement('div');
            this.element.className = 'log-settings-panel';
            this.element.innerHTML = this.renderPanelContent();
            return this.element;
        } catch (error) {
            console.error('[LogSettingsPanel] Rendering failed:', error);
            return null;
        }
    }

    renderContent() {
        try {
            return this.renderPanelContent();
        } catch (error) {
            console.error('[LogSettingsPanel] renderContent failed:', error);
            return '<div class="panel-error">Failed to render log settings panel</div>';
        }
    }

    renderPanelContent() {
        const isConsoleEnabled = this.isConsoleLoggingEnabled();
        
        return `
            <div class="log-settings-panel-content">
                <div class="log-section">
                    <h4>Console Output</h4>
                    <div class="console-controls">
                        <div class="control-group">
                            <label class="toggle-label">
                                <input type="checkbox" id="console-enabled" ${isConsoleEnabled ? 'checked' : ''}>
                                <span class="toggle-text">Enable Chrome Console Logging</span>
                            </label>
                            <p class="control-description">
                                When enabled, logs will appear in Chrome DevTools Console with format: 
                                <code>[CLIENT][REDUX][UI][DISPATCH] message [INFO]</code>
                            </p>
                        </div>
                        
                        <div class="status-indicator">
                            <div class="status-light ${isConsoleEnabled ? 'active' : 'inactive'}"></div>
                            <span class="status-text">Console logging is ${isConsoleEnabled ? 'ENABLED' : 'DISABLED'}</span>
                        </div>
                    </div>
                </div>

                <div class="log-section">
                    <h4>Log Type Filters</h4>
                    <div class="type-filters">
                        <p class="section-description">Choose which log types to display:</p>
                        <div class="filter-grid">
                            ${this.logTypes.map(type => `
                                <label class="filter-checkbox">
                                    <input type="checkbox" data-filter-type="${type}" checked>
                                    <span class="checkbox-text">${type}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="log-section">
                    <h4>Log Level Filters</h4>
                    <div class="level-filters">
                        <p class="section-description">Choose which log levels to display:</p>
                        <div class="filter-grid">
                            ${this.logLevels.map(level => `
                                <label class="filter-checkbox">
                                    <input type="checkbox" data-filter-level="${level}" checked>
                                    <span class="checkbox-text">${level}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="log-section">
                    <h4>Format Options</h4>
                    <div class="format-controls">
                        <div class="control-group">
                            <label class="toggle-label">
                                <input type="checkbox" id="show-timestamps" checked>
                                <span class="toggle-text">Show Timestamps</span>
                            </label>
                        </div>
                        
                        <div class="control-group">
                            <label class="toggle-label">
                                <input type="checkbox" id="show-source" checked>
                                <span class="toggle-text">Show Source Location</span>
                            </label>
                        </div>
                        
                        <div class="control-group">
                            <label class="toggle-label">
                                <input type="checkbox" id="compact-mode">
                                <span class="toggle-text">Compact Mode</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="log-section">
                    <h4>Buffer Management</h4>
                    <div class="buffer-controls">
                        <div class="buffer-info">
                            <span id="buffer-count">Loading...</span> entries in buffer
                        </div>
                        <div class="buffer-actions">
                            <button id="clear-buffer" class="btn btn-secondary">Clear Buffer</button>
                            <button id="export-buffer" class="btn btn-secondary">Export Buffer</button>
                        </div>
                    </div>
                </div>

                <div class="log-section">
                    <h4>Test & Debug</h4>
                    <div class="test-controls">
                        <button id="test-all-types" class="btn btn-primary">Test All Log Types</button>
                        <button id="test-redux" class="btn btn-secondary">Test Redux Logs</button>
                        <button id="test-console" class="btn btn-secondary">Test Console Output</button>
                    </div>
                </div>
            </div>

            <style>
                .log-settings-panel-content {
                    padding: 12px;
                    max-height: 100%;
                    overflow-y: auto;
                    font-size: 13px;
                }

                .log-section {
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .log-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }

                .log-section h4 {
                    margin: 0 0 8px 0;
                    color: #333;
                    font-size: 14px;
                    font-weight: 600;
                }

                .section-description {
                    margin: 0 0 8px 0;
                    color: #666;
                    font-size: 12px;
                    line-height: 1.3;
                }

                .control-group {
                    margin-bottom: 8px;
                }

                .toggle-label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    margin-bottom: 6px;
                }

                .toggle-label input[type="checkbox"] {
                    margin-right: 6px;
                    width: 14px;
                    height: 14px;
                }

                .toggle-text {
                    font-size: 13px;
                    color: #333;
                    font-weight: 500;
                }

                .control-description {
                    margin: 2px 0 0 20px;
                    font-size: 11px;
                    color: #666;
                    line-height: 1.3;
                }

                .control-description code {
                    background: #f5f5f5;
                    padding: 1px 3px;
                    border-radius: 2px;
                    font-family: monospace;
                    font-size: 10px;
                    white-space: nowrap;
                    display: inline-block;
                }

                .status-indicator {
                    display: flex;
                    align-items: center;
                    margin-top: 8px;
                    padding: 6px 8px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    border: 1px solid #e9ecef;
                }

                .status-light {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 6px;
                    flex-shrink: 0;
                }

                .status-light.active {
                    background: #28a745;
                    box-shadow: 0 0 3px rgba(40, 167, 69, 0.4);
                }

                .status-light.inactive {
                    background: #dc3545;
                }

                .status-text {
                    font-size: 11px;
                    font-weight: 500;
                    color: #495057;
                    white-space: nowrap;
                }

                .filter-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 4px;
                }

                .filter-checkbox {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 4px 6px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    background: #fafafa;
                    transition: all 0.2s ease;
                    min-height: 28px;
                }

                .filter-checkbox:hover {
                    background: #f0f0f0;
                    border-color: #ccc;
                }

                .filter-checkbox input {
                    margin-right: 4px;
                    width: 12px;
                    height: 12px;
                }

                .checkbox-text {
                    font-size: 11px;
                    font-weight: 500;
                    color: #444;
                }

                .buffer-info {
                    margin-bottom: 8px;
                    padding: 6px 8px;
                    background: #e9ecef;
                    border-radius: 3px;
                    font-size: 12px;
                }

                .buffer-actions {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .test-controls {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .btn {
                    padding: 6px 8px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .btn-primary {
                    background: #007bff;
                    color: white;
                }

                .btn-primary:hover {
                    background: #0056b3;
                }

                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .btn-secondary:hover {
                    background: #545b62;
                }
            </style>
        `;
    }

    onMount(container) {
        super.onMount(container);
        this.container = container;
        this.attachLogSettingsListeners();
        this.updateBufferInfo();
        console.log("LogSettingsPanel mounted in:", container);
    }

    attachLogSettingsListeners() {
        if (!this.container) return;

        // Console logging toggle
        const consoleToggle = this.container.querySelector('#console-enabled');
        if (consoleToggle) {
            consoleToggle.addEventListener('change', (e) => {
                this.toggleConsoleLogging(e.target.checked);
            });
        }

        // Type filters
        const typeFilters = this.container.querySelectorAll('[data-filter-type]');
        typeFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                this.updateTypeFilters();
            });
        });

        // Level filters
        const levelFilters = this.container.querySelectorAll('[data-filter-level]');
        levelFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                this.updateLevelFilters();
            });
        });

        // Format options
        const formatToggles = this.container.querySelectorAll('#show-timestamps, #show-source, #compact-mode');
        formatToggles.forEach(toggle => {
            toggle.addEventListener('change', () => {
                this.updateFormatOptions();
            });
        });

        // Buffer controls
        const clearBufferBtn = this.container.querySelector('#clear-buffer');
        const exportBufferBtn = this.container.querySelector('#export-buffer');
        
        if (clearBufferBtn) {
            clearBufferBtn.addEventListener('click', () => this.clearLogBuffer());
        }
        
        if (exportBufferBtn) {
            exportBufferBtn.addEventListener('click', () => this.exportLogBuffer());
        }

        // Test controls
        const testAllBtn = this.container.querySelector('#test-all-types');
        const testReduxBtn = this.container.querySelector('#test-redux');
        const testConsoleBtn = this.container.querySelector('#test-console');

        if (testAllBtn) {
            testAllBtn.addEventListener('click', () => this.testAllLogTypes());
        }
        
        if (testReduxBtn) {
            testReduxBtn.addEventListener('click', () => this.testReduxLogs());
        }
        
        if (testConsoleBtn) {
            testConsoleBtn.addEventListener('click', () => this.testConsoleOutput());
        }
    }

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
                    console.log('[LogSettingsPanel] Console logging enabled');
                }
            } else {
                if (typeof window.APP?.services?.disableConsoleLogging === 'function') {
                    window.APP.services.disableConsoleLogging(true);
                    console.log('[LogSettingsPanel] Console logging disabled');
                }
            }
            
            // Update status indicator
            this.updateStatusIndicator(enabled);
            
        } catch (error) {
            console.error('[LogSettingsPanel] Error toggling console logging:', error);
        }
    }

    updateStatusIndicator(enabled) {
        if (!this.container) return;
        
        const statusLight = this.container.querySelector('.status-light');
        const statusText = this.container.querySelector('.status-text');
        
        if (statusLight) {
            statusLight.className = `status-light ${enabled ? 'active' : 'inactive'}`;
        }
        
        if (statusText) {
            statusText.textContent = `Console logging is ${enabled ? 'ENABLED' : 'DISABLED'}`;
        }
    }

    updateTypeFilters() {
        // This would integrate with existing filtering system
        console.log('[LogSettingsPanel] Type filters updated');
    }

    updateLevelFilters() {
        // This would integrate with existing filtering system
        console.log('[LogSettingsPanel] Level filters updated');
    }

    updateFormatOptions() {
        // This would apply format changes to log display
        console.log('[LogSettingsPanel] Format options updated');
    }

    updateBufferInfo() {
        if (!this.container) return;
        
        const bufferCountElement = this.container.querySelector('#buffer-count');
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

    clearLogBuffer() {
        try {
            if (typeof window.APP?.services?.clearLogBuffer === 'function') {
                window.APP.services.clearLogBuffer();
                this.updateBufferInfo();
                console.log('[LogSettingsPanel] Log buffer cleared');
            }
        } catch (error) {
            console.error('[LogSettingsPanel] Error clearing log buffer:', error);
        }
    }

    exportLogBuffer() {
        try {
            if (typeof window.APP?.services?.getLogBuffer === 'function') {
                const logs = window.APP.services.getLogBuffer();
                const jsonStr = JSON.stringify(logs, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `devpages_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log('[LogSettingsPanel] Log buffer exported');
            }
        } catch (error) {
            console.error('[LogSettingsPanel] Error exporting log buffer:', error);
        }
    }

    testAllLogTypes() {
        // Import LogCore directly to test the new format
        import('../../log/LogCore.js').then(({ log: logCore }) => {
            this.logTypes.forEach((type, index) => {
                setTimeout(() => {
                    logCore({
                        message: `Test ${type} log message`,
                        source: 'CLIENT',
                        type: type,
                        module: 'SETTINGS',
                        action: 'TEST',
                        level: 'INFO',
                        forceConsole: true
                    });
                }, index * 100); // Stagger the logs
            });
        });
    }

    testReduxLogs() {
        // Dispatch a test Redux action to see Redux logging in action
        if (typeof appStore !== 'undefined' && appStore.dispatch) {
            appStore.dispatch({ 
                type: 'log/testReduxLogging', 
                payload: { source: 'LogSettingsPanel', timestamp: Date.now() }
            });
        }
    }

    testConsoleOutput() {
        // Test console output directly
        import('../../log/LogCore.js').then(({ log: logCore }) => {
            logCore({
                message: 'Console output test - you should see this in Chrome DevTools',
                source: 'CLIENT',
                type: 'TEST',
                module: 'CONSOLE',
                action: 'OUTPUT_TEST',
                level: 'INFO',
                forceConsole: true
            });
            
            console.log('[LogSettingsPanel] Test console output sent - check Chrome DevTools Console');
        });
    }
}

panelRegistry.registerType('log-settings', LogSettingsPanel);

// Factory function
export function createLogSettingsPanel(config = {}) {
    return new LogSettingsPanel(config);
}