/**
 * ReduxInspectorPanel.js - Redux state inspector panel
 * 
 * Provides detailed Redux state inspection and action monitoring
 */

import { BasePanel } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class ReduxInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'redux-inspector',
            title: 'Redux Inspector',
            defaultWidth: 500,
            defaultHeight: 600,
            ...config
        });
        
        this.stateHistory = [];
        this.actionHistory = [];
        this.maxHistorySize = 50;
        this.unsubscribe = null;
    }

    renderContent() {
        return `
            <div class="redux-inspector-content">
                <div class="inspector-tabs">
                    <button class="inspector-tab active" data-tab="state">State</button>
                    <button class="inspector-tab" data-tab="actions">Actions</button>
                    <button class="inspector-tab" data-tab="history">History</button>
                </div>
                
                <div class="inspector-controls">
                    <button id="refresh-state" class="btn btn-sm">Refresh</button>
                    <button id="clear-history" class="btn btn-sm">Clear History</button>
                    <label>
                        <input type="checkbox" id="auto-track" checked /> Auto-track
                    </label>
                </div>
                
                <div class="inspector-panels">
                    <div class="inspector-panel active" data-panel="state">
                        <div class="state-tree" id="state-tree">Loading...</div>
                    </div>
                    
                    <div class="inspector-panel" data-panel="actions">
                        <div class="action-list" id="action-list">No actions recorded</div>
                    </div>
                    
                    <div class="inspector-panel" data-panel="history">
                        <div class="history-list" id="history-list">No history available</div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount() {
        super.onMount();
        this.attachInspectorListeners();
        this.startTracking();
        this.refreshState();
    }

    attachInspectorListeners() {
        // Tab switching
        this.element.addEventListener('click', (e) => {
            if (e.target.classList.contains('inspector-tab')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // Controls
        const refreshBtn = this.element.querySelector('#refresh-state');
        const clearBtn = this.element.querySelector('#clear-history');
        const autoTrackCheckbox = this.element.querySelector('#auto-track');

        refreshBtn?.addEventListener('click', () => this.refreshState());
        clearBtn?.addEventListener('click', () => this.clearHistory());
        autoTrackCheckbox?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startTracking();
            } else {
                this.stopTracking();
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        this.element.querySelectorAll('.inspector-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update panels
        this.element.querySelectorAll('.inspector-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });

        // Refresh content for the active tab
        switch (tabName) {
            case 'state':
                this.refreshState();
                break;
            case 'actions':
                this.refreshActions();
                break;
            case 'history':
                this.refreshHistory();
                break;
        }
    }

    startTracking() {
        if (this.unsubscribe) return;

        let previousState = appStore.getState();
        
        this.unsubscribe = appStore.subscribe(() => {
            const currentState = appStore.getState();
            
            // Record state change
            this.stateHistory.push({
                timestamp: Date.now(),
                state: JSON.parse(JSON.stringify(currentState))
            });
            
            // Limit history size
            if (this.stateHistory.length > this.maxHistorySize) {
                this.stateHistory.shift();
            }
            
            previousState = currentState;
            
            // Update active panel if it's visible
            const activePanel = this.element.querySelector('.inspector-panel.active');
            if (activePanel) {
                const panelType = activePanel.dataset.panel;
                if (panelType === 'state') {
                    this.refreshState();
                } else if (panelType === 'history') {
                    this.refreshHistory();
                }
            }
        });
    }

    stopTracking() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    refreshState() {
        const stateTree = this.element.querySelector('#state-tree');
        if (!stateTree) return;

        try {
            const state = appStore.getState();
            stateTree.innerHTML = this.renderStateTree(state);
        } catch (error) {
            stateTree.innerHTML = `<div class="error">Error loading state: ${error.message}</div>`;
        }
    }

    renderStateTree(obj, path = '', level = 0) {
        if (level > 3) return '<div class="truncated">... (truncated)</div>';
        
        const indent = '  '.repeat(level);
        
        if (obj === null) return '<span class="null">null</span>';
        if (typeof obj === 'undefined') return '<span class="undefined">undefined</span>';
        if (typeof obj === 'string') return `<span class="string">"${obj}"</span>`;
        if (typeof obj === 'number') return `<span class="number">${obj}</span>`;
        if (typeof obj === 'boolean') return `<span class="boolean">${obj}</span>`;
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '<span class="array">[]</span>';
            
            let html = '<div class="array-container">';
            html += '<span class="array-bracket">[</span>';
            obj.slice(0, 10).forEach((item, index) => {
                html += `<div class="array-item">${indent}  ${index}: ${this.renderStateTree(item, `${path}[${index}]`, level + 1)}</div>`;
            });
            if (obj.length > 10) {
                html += `<div class="truncated">${indent}  ... ${obj.length - 10} more items</div>`;
            }
            html += `${indent}<span class="array-bracket">]</span>`;
            html += '</div>';
            return html;
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '<span class="object">{}</span>';
            
            let html = '<div class="object-container">';
            html += '<span class="object-bracket">{</span>';
            keys.slice(0, 10).forEach(key => {
                html += `<div class="object-property">${indent}  <span class="key">${key}</span>: ${this.renderStateTree(obj[key], `${path}.${key}`, level + 1)}</div>`;
            });
            if (keys.length > 10) {
                html += `<div class="truncated">${indent}  ... ${keys.length - 10} more properties</div>`;
            }
            html += `${indent}<span class="object-bracket">}</span>`;
            html += '</div>';
            return html;
        }
        
        return `<span class="unknown">${String(obj)}</span>`;
    }

    refreshActions() {
        const actionList = this.element.querySelector('#action-list');
        if (!actionList) return;

        if (this.actionHistory.length === 0) {
            actionList.innerHTML = '<div class="no-actions">No actions recorded</div>';
            return;
        }

        actionList.innerHTML = this.actionHistory
            .slice(-20)
            .reverse()
            .map(action => `
                <div class="action-item">
                    <div class="action-type">${action.type}</div>
                    <div class="action-time">${new Date(action.timestamp).toLocaleTimeString()}</div>
                    <div class="action-payload">${JSON.stringify(action.payload || {}, null, 2)}</div>
                </div>
            `).join('');
    }

    refreshHistory() {
        const historyList = this.element.querySelector('#history-list');
        if (!historyList) return;

        if (this.stateHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">No history available</div>';
            return;
        }

        historyList.innerHTML = this.stateHistory
            .slice(-10)
            .reverse()
            .map((entry, index) => `
                <div class="history-item">
                    <div class="history-time">${new Date(entry.timestamp).toLocaleTimeString()}</div>
                    <div class="history-summary">State snapshot ${this.stateHistory.length - index}</div>
                </div>
            `).join('');
    }

    clearHistory() {
        this.stateHistory = [];
        this.actionHistory = [];
        this.refreshHistory();
        this.refreshActions();
    }

    onDestroy() {
        this.stopTracking();
        super.onDestroy();
    }
}

// Factory function
export function createReduxInspector(config = {}) {
    return new ReduxInspectorPanel(config);
}
