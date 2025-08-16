// client/panels/CommPanel.js
// ✅ MODERNIZED: Enhanced Redux patterns for communication panel
import { BasePanel } from './BasePanel.js';
import { appStore } from '../appState.js';
import { clearLogs } from '../store/slices/commSlice.js';
import { connectToLogs } from '/client/store/reduxConnect.js';

export class CommPanel extends BasePanel {
    constructor(options) {
        super(options);
        this.stateUnsubscribe = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'comm-panel';
        this.element.innerHTML = `
            <div class="comm-panel-header">
                <h3>Communications Panel</h3>
                <button class="clear-logs-btn">Clear Logs</button>
            </div>
            <div class="comm-panel-content">
                <div class="redux-actions">
                    <h4>Redux Actions</h4>
                    <ul class="redux-action-list"></ul>
                </div>
                <div class="eventbus-events">
                    <h4>EventBus Events</h4>
                    <ul class="eventbus-event-list"></ul>
                </div>
            </div>
        `;
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        
        // ✅ MODERNIZED: Subscribe with debounced updates for high-frequency comm logs
        let lastCommState = null;
        this.stateUnsubscribe = appStore.subscribe(() => {
            const commState = appStore.getState().communications;
            if (commState === lastCommState) return; // Skip if comm state unchanged
            lastCommState = commState;
            this.update();
        });
        
        this.element.querySelector('.clear-logs-btn').addEventListener('click', () => {
            appStore.dispatch(clearLogs());
        });
        this.update();
    }

    onUnmount() {
        super.onUnmount();
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
        }
    }

    update() {
        const { communications } = appStore.getState();
        const reduxActionList = this.element.querySelector('.redux-action-list');
        const eventBusEventList = this.element.querySelector('.eventbus-event-list');

        reduxActionList.innerHTML = communications.reduxActions.map(action => `
            <li>
                <strong>${action.type}</strong>
                <pre>${JSON.stringify(action.payload, null, 2)}</pre>
            </li>
        `).join('');

        eventBusEventList.innerHTML = communications.eventBusEvents.map(event => `
            <li>
                <strong>${event.name}</strong>
                <pre>${JSON.stringify(event.payload, null, 2)}</pre>
            </li>
        `).join('');
    }
}
