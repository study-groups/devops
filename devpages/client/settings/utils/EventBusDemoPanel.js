/**
 * client/settings/EventBusDemoPanel.js
 * Demo panel showcasing the event bus system for cross-panel communication
 */

import { panelRegistry } from '../core/panelRegistry.js';
import { panelEventBus, PanelEvents, createPanelMixin } from '../core/panelEventBus.js';

const PANEL_ID = 'event-bus-demo-panel';

class EventBusDemoPanel {
    constructor(container) {
        if (!container) {
            console.error('Container not provided for EventBusDemoPanel');
            return;
        }
        this.container = container;
        this.messageLog = [];
        this.maxLogSize = 20;

        // Setup event bus
        this.setupEventBus();
        this.setupEventHandlers();

        this.render();
        this.attachEventListeners();
    }

    // ===== EVENT BUS INTEGRATION =====
    
    setupEventBus() {
        // Apply the event bus mixin
        Object.assign(this, createPanelMixin(PANEL_ID));
        this.setupEventBus();
    }
    
    setupEventHandlers() {
        // Listen to ALL panel events for demonstration
        Object.values(PanelEvents).forEach(eventType => {
            this.on(eventType, (message) => {
                this.logEventMessage('RECEIVED', eventType, message);
            });
        });
    }

    logEventMessage(direction, eventType, message) {
        const logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            direction,
            eventType,
            source: message.source || 'unknown',
            data: message.data || message,
            id: message.id
        };

        this.messageLog.unshift(logEntry);
        if (this.messageLog.length > this.maxLogSize) {
            this.messageLog.pop();
        }

        this.updateMessageLog();
    }

    render() {
        this.container.innerHTML = `
            <div class="event-bus-demo-content">
                <div class="demo-description">
                    <p><strong>Event Bus Demo Panel</strong></p>
                    <p>This panel demonstrates cross-panel communication using the DevPages event bus system. 
                    It listens to all panel events and provides tools to test event broadcasting.</p>
                </div>

                <!-- Event Broadcasting Section -->
                <div class="demo-section">
                    <h4>Send Events</h4>
                    <div class="demo-controls">
                        <div class="control-row">
                            <label>Event Type:</label>
                            <select id="event-type-select">
                                <option value="${PanelEvents.THEME_CHANGED}">Theme Changed</option>
                                <option value="${PanelEvents.CSS_PREVIEW_REFRESH}">CSS Preview Refresh</option>
                                <option value="${PanelEvents.PANEL_VALIDATION_REQUEST}">Validation Request</option>
                                <option value="${PanelEvents.UI_NOTIFICATION}">UI Notification</option>
                                <option value="custom">Custom Event</option>
                            </select>
                        </div>
                        <div class="control-row" id="custom-event-row" style="display: none;">
                            <label>Custom Event:</label>
                            <input type="text" id="custom-event-input" placeholder="panel:custom:event">
                        </div>
                        <div class="control-row">
                            <label>Message Data:</label>
                            <textarea id="event-data-input" rows="3" placeholder='{"key": "value"}'></textarea>
                        </div>
                        <div class="control-row">
                            <button id="send-event-btn" class="demo-btn">Send Event</button>
                            <button id="broadcast-event-btn" class="demo-btn">Broadcast Event</button>
                        </div>
                    </div>
                </div>

                <!-- Cross-Panel Actions Section -->
                <div class="demo-section">
                    <h4>Cross-Panel Actions</h4>
                    <div class="demo-controls">
                        <button id="validate-all-btn" class="demo-btn">Validate All Panels</button>
                        <button id="collect-publish-data-btn" class="demo-btn">Collect Publish Data</button>
                        <button id="reload-theme-btn" class="demo-btn">Request Theme Reload</button>
                        <button id="refresh-preview-btn" class="demo-btn">Refresh Preview</button>
                    </div>
                </div>

                <!-- Event Bus Stats Section -->
                <div class="demo-section">
                    <h4>Event Bus Stats</h4>
                    <div id="event-bus-stats" class="stats-display">
                        Loading stats...
                    </div>
                    <button id="refresh-stats-btn" class="demo-btn">Refresh Stats</button>
                </div>

                <!-- Message Log Section -->
                <div class="demo-section">
                    <h4>Event Log <span class="log-count">(0 messages)</span></h4>
                    <div class="log-controls">
                        <button id="clear-log-btn" class="demo-btn small">Clear Log</button>
                        <button id="export-log-btn" class="demo-btn small">Export Log</button>
                        <label>
                            <input type="checkbox" id="auto-scroll-log" checked> Auto-scroll
                        </label>
                    </div>
                    <div id="message-log" class="message-log">
                        <div class="log-empty">No messages yet. Try interacting with other panels!</div>
                    </div>
                </div>
            </div>
        `;

        this.updateStats();
        this.updateMessageLog();
    }

    attachEventListeners() {
        // Event type selector
        const eventTypeSelect = this.container.querySelector('#event-type-select');
        const customEventRow = this.container.querySelector('#custom-event-row');
        eventTypeSelect.addEventListener('change', (e) => {
            customEventRow.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Send event button
        this.container.querySelector('#send-event-btn').addEventListener('click', () => {
            this.sendTestEvent();
        });

        // Broadcast event button
        this.container.querySelector('#broadcast-event-btn').addEventListener('click', () => {
            this.broadcastTestEvent();
        });

        // Cross-panel action buttons
        this.container.querySelector('#validate-all-btn').addEventListener('click', () => {
            this.validateAllPanels();
        });

        this.container.querySelector('#collect-publish-data-btn').addEventListener('click', () => {
            this.collectPublishData();
        });

        this.container.querySelector('#reload-theme-btn').addEventListener('click', () => {
            this.requestThemeReload();
        });

        this.container.querySelector('#refresh-preview-btn').addEventListener('click', () => {
            this.refreshPreview();
        });

        // Stats and log controls
        this.container.querySelector('#refresh-stats-btn').addEventListener('click', () => {
            this.updateStats();
        });

        this.container.querySelector('#clear-log-btn').addEventListener('click', () => {
            this.clearLog();
        });

        this.container.querySelector('#export-log-btn').addEventListener('click', () => {
            this.exportLog();
        });
    }

    // ===== EVENT SENDING METHODS =====

    sendTestEvent() {
        const eventTypeSelect = this.container.querySelector('#event-type-select');
        const customEventInput = this.container.querySelector('#custom-event-input');
        const dataInput = this.container.querySelector('#event-data-input');

        let eventType = eventTypeSelect.value;
        if (eventType === 'custom') {
            eventType = customEventInput.value.trim();
            if (!eventType) {
                alert('Please enter a custom event type');
                return;
            }
        }

        let eventData = {};
        const dataText = dataInput.value.trim();
        if (dataText) {
            try {
                eventData = JSON.parse(dataText);
            } catch (e) {
                alert('Invalid JSON in message data');
                return;
            }
        }

        const messageId = this.emit(eventType, eventData);
        this.logEventMessage('SENT', eventType, { 
            id: messageId, 
            source: PANEL_ID, 
            data: eventData 
        });
    }

    broadcastTestEvent() {
        const eventTypeSelect = this.container.querySelector('#event-type-select');
        const dataInput = this.container.querySelector('#event-data-input');

        let eventType = eventTypeSelect.value;
        let eventData = {};
        
        try {
            const dataText = dataInput.value.trim();
            if (dataText) {
                eventData = JSON.parse(dataText);
            }
        } catch (e) {
            alert('Invalid JSON in message data');
            return;
        }

        const messageId = panelEventBus.broadcast(eventType, eventData, PANEL_ID);
        this.logEventMessage('BROADCAST', eventType, { 
            id: messageId, 
            source: PANEL_ID, 
            data: eventData 
        });
    }

    // ===== CROSS-PANEL ACTION METHODS =====

    async validateAllPanels() {
        try {
            const results = await panelEventBus.validateAcrossPanels('all', {
                requestedBy: PANEL_ID,
                timestamp: Date.now()
            });

            this.logEventMessage('RESPONSE', 'validation_results', {
                source: 'event-bus',
                data: results
            });

            alert(`Validation Results:\nOverall: ${results.overall ? 'PASS' : 'FAIL'}\nErrors: ${results.errors.length}\nWarnings: ${results.warnings.length}`);
        } catch (error) {
            alert(`Validation failed: ${error.message}`);
        }
    }

    async collectPublishData() {
        try {
            const data = await panelEventBus.collectPublishData('spaces');
            
            this.logEventMessage('RESPONSE', 'publish_data_collected', {
                source: 'event-bus',
                data: data
            });

            alert(`Collected data from ${Object.keys(data.panels).length} panels`);
        } catch (error) {
            alert(`Data collection failed: ${error.message}`);
        }
    }

    requestThemeReload() {
        this.emit(PanelEvents.THEME_RELOAD_REQUESTED, {
            requestedBy: PANEL_ID,
            reason: 'demo_panel_request'
        });
    }

    refreshPreview() {
        this.emit(PanelEvents.CSS_PREVIEW_REFRESH, {
            requestedBy: PANEL_ID,
            reason: 'demo_panel_request'
        });
    }

    // ===== UI UPDATE METHODS =====

    updateStats() {
        const stats = panelEventBus.getStats();
        const statsDisplay = this.container.querySelector('#event-bus-stats');
        
        statsDisplay.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Registered Panels:</span>
                <span class="stat-value">${stats.registeredPanels}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Pending Requests:</span>
                <span class="stat-value">${stats.pendingRequests}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Message History:</span>
                <span class="stat-value">${stats.messageHistory}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Debug Enabled:</span>
                <span class="stat-value">${stats.debugEnabled ? 'Yes' : 'No'}</span>
            </div>
        `;
    }

    updateMessageLog() {
        const logContainer = this.container.querySelector('#message-log');
        const logCount = this.container.querySelector('.log-count');
        const autoScroll = this.container.querySelector('#auto-scroll-log')?.checked;

        logCount.textContent = `(${this.messageLog.length} messages)`;

        if (this.messageLog.length === 0) {
            logContainer.innerHTML = '<div class="log-empty">No messages yet. Try interacting with other panels!</div>';
            return;
        }

        const logHtml = this.messageLog.map(entry => `
            <div class="log-entry ${entry.direction.toLowerCase()}">
                <div class="log-header">
                    <span class="log-time">${entry.timestamp}</span>
                    <span class="log-direction ${entry.direction.toLowerCase()}">${entry.direction}</span>
                    <span class="log-event-type">${entry.eventType}</span>
                    <span class="log-source">from: ${entry.source}</span>
                </div>
                <div class="log-data">
                    <pre>${JSON.stringify(entry.data, null, 2)}</pre>
                </div>
            </div>
        `).join('');

        logContainer.innerHTML = logHtml;

        if (autoScroll) {
            logContainer.scrollTop = 0; // Scroll to top since we prepend new messages
        }
    }

    clearLog() {
        this.messageLog = [];
        this.updateMessageLog();
    }

    exportLog() {
        const logData = {
            timestamp: new Date().toISOString(),
            panelId: PANEL_ID,
            messages: this.messageLog
        };

        const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `event-bus-log-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    destroy() {
        // Clean up event bus
        if (this.destroyEventBus) {
            this.destroyEventBus();
        }
        
        console.log('EventBusDemoPanel destroyed');
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: PANEL_ID,
    title: 'Event Bus Demo',
    component: EventBusDemoPanel,
    order: 999, // Put it at the end
    defaultCollapsed: true
});

// Add some basic styling
const style = document.createElement('style');
style.textContent = `
.event-bus-demo-content {
    font-family: var(--font-family-sans, system-ui);
    font-size: 14px;
    line-height: 1.4;
}

.demo-description {
    background: var(--color-background-secondary, #f8f9fa);
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;
    border-left: 3px solid var(--color-primary, #2563eb);
}

.demo-section {
    margin-bottom: 20px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    padding: 12px;
}

.demo-section h4 {
    margin: 0 0 12px 0;
    color: var(--color-text-primary, #111827);
    font-size: 16px;
}

.demo-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.control-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.control-row label {
    min-width: 100px;
    font-weight: 500;
}

.control-row select,
.control-row input,
.control-row textarea {
    flex: 1;
    min-width: 200px;
    padding: 6px 8px;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 4px;
    font-size: 14px;
}

.demo-btn {
    padding: 8px 16px;
    background: var(--color-primary, #2563eb);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

.demo-btn:hover {
    background: var(--color-primary-hover, #1d4ed8);
}

.demo-btn.small {
    padding: 4px 8px;
    font-size: 12px;
}

.stats-display {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    background: var(--color-background-secondary, #f8f9fa);
    border-radius: 4px;
}

.stat-label {
    font-weight: 500;
}

.stat-value {
    font-family: var(--font-family-mono, monospace);
    color: var(--color-primary, #2563eb);
}

.log-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.log-count {
    color: var(--color-text-secondary, #6b7280);
    font-size: 12px;
}

.message-log {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    background: var(--color-background, white);
}

.log-empty {
    padding: 20px;
    text-align: center;
    color: var(--color-text-secondary, #6b7280);
    font-style: italic;
}

.log-entry {
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    padding: 8px;
}

.log-entry:last-child {
    border-bottom: none;
}

.log-entry.sent {
    background: #f0f9ff;
}

.log-entry.received {
    background: #f0fdf4;
}

.log-entry.broadcast {
    background: #fef3c7;
}

.log-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 12px;
    flex-wrap: wrap;
}

.log-time {
    font-family: var(--font-family-mono, monospace);
    color: var(--color-text-secondary, #6b7280);
}

.log-direction {
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
}

.log-direction.sent {
    background: #dbeafe;
    color: #1e40af;
}

.log-direction.received {
    background: #dcfce7;
    color: #166534;
}

.log-direction.broadcast {
    background: #fef3c7;
    color: #92400e;
}

.log-event-type {
    font-family: var(--font-family-mono, monospace);
    font-weight: 500;
    color: var(--color-primary, #2563eb);
}

.log-source {
    color: var(--color-text-secondary, #6b7280);
    font-style: italic;
}

.log-data {
    margin-left: 8px;
}

.log-data pre {
    font-size: 11px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--color-text-secondary, #374151);
    background: var(--color-background-secondary, #f9fafb);
    padding: 4px 6px;
    border-radius: 3px;
    max-height: 100px;
    overflow-y: auto;
}

@media (max-width: 768px) {
    .control-row {
        flex-direction: column;
        align-items: stretch;
    }
    
    .control-row label {
        min-width: auto;
    }
    
    .log-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }
}
`;

if (!document.getElementById('event-bus-demo-styles')) {
    style.id = 'event-bus-demo-styles';
    document.head.appendChild(style);
} 