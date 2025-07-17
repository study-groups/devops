/**
 * client/settings/utils/EventBusDemoPanel.js
 * Simplified demo panel showcasing the main event bus system
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';
import { eventBus } from '/client/eventBus.js';
import { SettingsEvents, emitCssSettingsChanged, emitThemeChanged } from '../core/settingsEvents.js';

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

        // Setup simplified event handlers
        this.setupEventHandlers();

        this.render();
        this.attachEventListeners();
    }

    setupEventHandlers() {
        // Listen to all settings-related events
        eventBus.on('preview:cssSettingsChanged', (data) => {
            this.addToLog('CSS Settings Changed', data);
        });
        
        eventBus.on(SettingsEvents.THEME_CHANGED, (data) => {
            this.addToLog('Theme Changed', data);
        });
        
        eventBus.on(SettingsEvents.SETTINGS_UPDATED, (data) => {
            this.addToLog('Settings Updated', data);
        });
    }

    render() {
        this.container.innerHTML = `
            <div class="event-bus-demo-content">
                <div class="demo-description">
                    <p><strong>Event Bus Demo Panel (Simplified)</strong></p>
                    <p>This panel demonstrates the simplified event bus system using the main eventBus. 
                    No more complex panelEventBus - just simple, direct events!</p>
                </div>

                <!-- Event Broadcasting Section -->
                <div class="demo-section">
                    <h4>Send Events</h4>
                    <div class="demo-controls">
                        <div class="control-row">
                            <label>Event Type:</label>
                            <select id="event-type-select">
                                <option value="${SettingsEvents.THEME_CHANGED}">Theme Changed</option>
                                <option value="${SettingsEvents.CSS_FILES_UPDATED}">CSS Files Updated</option>
                                <option value="${SettingsEvents.SETTINGS_UPDATED}">Settings Updated</option>
                                <option value="preview:cssSettingsChanged">CSS Settings Changed</option>
                            </select>
                        </div>
                        <div class="control-row">
                            <label>Event Data:</label>
                            <input type="text" id="event-data-input" placeholder='{"test": "data"}' />
                        </div>
                        <div class="control-row">
                            <button id="send-event-btn" class="primary-btn">Send Event</button>
                            <button id="send-css-event-btn" class="secondary-btn">Send CSS Event (Debounced)</button>
                        </div>
                    </div>
                </div>

                <!-- Event Log Section -->
                <div class="demo-section">
                    <h4>Event Log (Last ${this.maxLogSize})</h4>
                    <div id="event-log" class="event-log">
                        <p class="log-empty">No events logged yet. Send some events to see them here!</p>
                    </div>
                    <div class="log-controls">
                        <button id="clear-log-btn" class="secondary-btn">Clear Log</button>
                    </div>
                </div>

                <!-- Event Bus Status -->
                <div class="demo-section">
                    <h4>Event Bus Status</h4>
                    <div id="event-bus-status" class="status-display">
                        <div class="status-item">
                            <span class="status-label">Main Event Bus:</span>
                            <span class="status-value connected">Connected ✓</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Panel Event Bus:</span>
                            <span class="status-value deprecated">Deprecated (Simplified!) ⚠️</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Send Event Button
        const sendEventBtn = this.container.querySelector('#send-event-btn');
        sendEventBtn?.addEventListener('click', () => {
            this.sendEvent();
        });

        // Send CSS Event Button (uses our debounced helper)
        const sendCssEventBtn = this.container.querySelector('#send-css-event-btn');
        sendCssEventBtn?.addEventListener('click', () => {
            this.sendCssEvent();
        });

        // Clear Log Button
        const clearLogBtn = this.container.querySelector('#clear-log-btn');
        clearLogBtn?.addEventListener('click', () => {
            this.clearLog();
        });
    }

    sendEvent() {
        const eventTypeSelect = this.container.querySelector('#event-type-select');
        const eventDataInput = this.container.querySelector('#event-data-input');
        
        const eventType = eventTypeSelect.value;
        let eventData;
        
        try {
            eventData = eventDataInput.value ? JSON.parse(eventDataInput.value) : { demo: true, timestamp: Date.now() };
        } catch (e) {
            eventData = { error: 'Invalid JSON', input: eventDataInput.value, timestamp: Date.now() };
        }

        // Emit the event directly using main eventBus
        eventBus.emit(eventType, eventData);
        
        this.addToLog(`Sent: ${eventType}`, eventData);
    }

    sendCssEvent() {
        // Use our debounced CSS helper
        emitCssSettingsChanged(eventBus, 'demo_panel', { 
            demo: true, 
            timestamp: Date.now(),
            message: 'This event was sent using the debounced helper!'
        });
        
        this.addToLog('Sent Debounced CSS Event', { debounced: true });
    }

    addToLog(eventName, data) {
        const logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            eventName,
            data: data || {}
        };

        this.messageLog.unshift(logEntry);
        if (this.messageLog.length > this.maxLogSize) {
            this.messageLog.pop();
        }

        this.updateEventLog();
    }

    updateEventLog() {
        const logContainer = this.container.querySelector('#event-log');
        if (!logContainer) return;

        if (this.messageLog.length === 0) {
            logContainer.innerHTML = '<p class="log-empty">No events logged yet. Send some events to see them here!</p>';
            return;
        }

        const logHtml = this.messageLog.map(entry => `
            <div class="log-entry">
                <div class="log-header">
                    <span class="log-time">${entry.timestamp}</span>
                    <span class="log-event">${entry.eventName}</span>
                </div>
                <div class="log-data">
                    <pre>${JSON.stringify(entry.data, null, 2)}</pre>
                </div>
            </div>
        `).join('');

        logContainer.innerHTML = logHtml;
    }

    clearLog() {
        this.messageLog = [];
        this.updateEventLog();
        this.addToLog('Log Cleared', { action: 'clear', timestamp: Date.now() });
    }

    destroy() {
        // Clean up event listeners
        if (eventBus && typeof eventBus.off === 'function') {
            eventBus.off('preview:cssSettingsChanged');
            eventBus.off(SettingsEvents.THEME_CHANGED);
            eventBus.off(SettingsEvents.SETTINGS_UPDATED);
        }
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: PANEL_ID,
    title: 'Event Bus Demo (Simplified)',
    component: EventBusDemoPanel,
    defaultCollapsed: true
});

// Add some basic styling for the simplified demo
const style = document.createElement('style');
style.textContent = `
.event-bus-demo-content {
    font-family: var(--font-family-sans, system-ui);
    padding: 1rem;
}

.demo-description {
    background: var(--color-background-secondary, #f8f9fa);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    border-left: 3px solid var(--color-primary, #2563eb);
}

.demo-section {
    margin-bottom: 1.5rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    padding: 1rem;
}

.demo-section h4 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary, #111827);
}

.control-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.control-row label {
    min-width: 100px;
    font-weight: 500;
}

.control-row select,
.control-row input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 4px;
}

.primary-btn, .secondary-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
}

.primary-btn {
    background: var(--color-primary, #2563eb);
    color: white;
}

.secondary-btn {
    background: var(--color-secondary, #6b7280);
    color: white;
}

.event-log {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    padding: 0.5rem;
}

.log-entry {
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    padding: 0.5rem 0;
}

.log-header {
    display: flex;
    gap: 0.5rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
}

.log-time {
    color: var(--color-text-secondary, #6b7280);
    font-size: 0.75rem;
}

.log-event {
    color: var(--color-primary, #2563eb);
}

.log-data pre {
    background: var(--color-background-secondary, #f8f9fa);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    overflow-x: auto;
}

.status-display {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.status-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--color-background-secondary, #f8f9fa);
    border-radius: 4px;
}

.status-value.connected {
    color: var(--color-success, #10b981);
}

.status-value.deprecated {
    color: var(--color-warning, #f59e0b);
}
`;

document.head.appendChild(style); 