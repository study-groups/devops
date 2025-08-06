/**
 * LogPanel.js
 * REFACTORED to use the new PanelInterface.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { clearEntries, selectFilteredEntries } from '/client/store/slices/logSlice.js';
import { createLogPanelDOM } from './logPanelDOM.js';
import { updateTagsBar, applyFiltersToLogEntries } from './LogFilterBar.js';

export class LogPanel extends BasePanel {
    constructor(options) {
        super(options);
        this.logOrder = 'recent';
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'log-panel';
        // The createLogPanelDOM function will populate this element.
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        // createLogPanelDOM expects the instance to be passed to attach elements to it.
        createLogPanelDOM(this, '1.0');
        
        // Add event listener only if clearButton was created
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.store.dispatch(clearEntries()));
        }
        
        const state = this.store.getState();
        this.onStateChange(state.log);
    }

    onStateChange(logState) {
        if (!this.logElement || !logState) return;

        const filteredEntries = selectFilteredEntries({ log: logState });
        
        this.logElement.innerHTML = '';

        filteredEntries.forEach((entry, index) => {
            this.renderLogEntry(entry, index);
        });

        this.updateEntryCount(logState);
    }

    renderLogEntry(entry, index) {
        const logEntryDiv = document.createElement('div');
        logEntryDiv.className = `log-entry log-level-${(entry.level || 'info').toLowerCase()}`;
        
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();

        logEntryDiv.innerHTML = `
            <span class="log-entry-timestamp">${timestamp}</span>
            <span class="log-entry-level">${entry.level || 'INFO'}</span>
            <span class="log-entry-type">${entry.type || 'GENERAL'}</span>
            <span class="log-entry-message">${entry.message || ''}</span>
        `;
        
        logEntryDiv.dataset.logType = entry.type || 'GENERAL';
        logEntryDiv.dataset.logLevel = entry.level || 'INFO';

        if (this.logOrder === 'recent') {
            this.logElement.insertBefore(logEntryDiv, this.logElement.firstChild);
        } else {
            this.logElement.appendChild(logEntryDiv);
        }
    }

    updateEntryCount(logState) {
        if (!this.statusElement) return;
        
        const total = logState.entries.length;
        const filtered = selectFilteredEntries({ log: logState }).length;
        
        let statusText = `${total} entries`;
        if (total !== filtered) {
            statusText += ` (${filtered} shown)`;
        }
        
        this.statusElement.textContent = statusText;
    }
}
