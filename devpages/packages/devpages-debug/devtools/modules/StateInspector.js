/**
 * StateInspector.js - State introspection component for the DevToolsPanel
 *
 * This component provides comprehensive introspection of all reducer state slices
 * with real-time updates, search capabilities, and detailed state exploration.
 */

import { appStore } from "/appState.js";

export class StateInspector {
    constructor(container, store) {
        this.container = container;
        this.store = store || appStore;
        this.isInitialized = false;
        this.updateInterval = null;
        this.searchTerm = '';
        this.expandedPaths = new Set();
        this.expandedValues = new Set();
        this.lastState = null;
        this.changedPaths = new Set();
        
        this.createUI();
        this.setupEventHandlers();
        this.initialize();
    }

    createUI() {
        this.container.innerHTML = `
            <div class="state-inspector">
                <div class="search-section">
                    <input type="text" id="state-search" placeholder="Search state properties..." />
                </div>
                <div class="state-tree-container" id="state-tree-container">
                    <div class="loading">Loading state...</div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .state-inspector {
                font-family: var(--font-family-sans, system-ui);
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            .search-section {
                padding-bottom: 10px;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            .search-section input {
                width: 100%;
                padding: 8px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
            }
            .state-tree-container {
                flex: 1;
                overflow: auto;
                font-family: var(--font-family-mono, monospace);
                font-size: 13px;
            }
            .state-tree ul {
                padding-left: 20px;
                margin: 0;
                list-style: none;
            }
            .state-tree li {
                position: relative;
            }
            .state-tree .tree-node {
                padding: 4px;
            }
            .state-tree .key {
                color: var(--color-primary, #905);
            }
            .state-tree .value {
                color: var(--color-fg, #333);
            }
            .state-tree .value.string { color: var(--color-success, #07a); }
            .state-tree .value.number { color: var(--color-warning, #d14); }
            .state-tree .value.boolean { color: var(--color-error, #d14); }
            .state-tree .value.null { color: var(--color-fg-muted, #aaa); }
            .state-tree .toggle {
                cursor: pointer;
                display: inline-block;
                width: 1em;
                text-align: center;
            }
             .state-tree .toggle.collapsed::before { content: '▸'; }
             .state-tree .toggle.expanded::before { content: '▾'; }
            .state-tree ul.collapsed {
                display: none;
            }
            .search-highlight {
                background-color: yellow;
            }
            .changed-node {
                background-color: #fffbe6;
            }
        `;
        this.container.appendChild(style);
    }
    
    setupEventHandlers() {
        const searchInput = this.container.querySelector('#state-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.renderState();
            });
        }
        
        const contentDiv = this.container.querySelector('#state-tree-container');
        if (contentDiv) {
            contentDiv.addEventListener('click', (e) => {
                if (e.target.classList.contains('toggle')) {
                    this.togglePathExpansion(e.target);
                }
            });
        }
    }
    
    initialize() {
        this.isInitialized = true;
        this.updateStateDisplay();
        this.startAutoRefresh();
    }
    
    updateStateDisplay() {
        if (!this.isInitialized) return;
        this.detectChanges();
        this.renderState();
    }

    detectChanges() {
        const currentState = this.store.getState();
        this.changedPaths.clear();
        if (this.lastState) {
            this.findChanges('', this.lastState, currentState);
        }
        this.lastState = currentState;
    }

    findChanges(path, oldObj, newObj) {
        if (oldObj === newObj) return;

        for (const key in newObj) {
            if (Object.prototype.hasOwnProperty.call(newObj, key)) {
                const newPath = path ? `${path}.${key}` : key;
                if (!Object.prototype.hasOwnProperty.call(oldObj, key) || oldObj[key] !== newObj[key]) {
                    if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                        if (!oldObj[key] || typeof oldObj[key] !== 'object') {
                            this.changedPaths.add(newPath); // Mark parent as changed
                        }
                        this.findChanges(newPath, oldObj[key] || {}, newObj[key]);
                    } else {
                        this.changedPaths.add(newPath);
                    }
                }
            }
        }
    }

    renderState() {
        const state = this.store.getState();
        const treeContainer = this.container.querySelector('#state-tree-container');
        if (treeContainer) {
            treeContainer.innerHTML = `<div class="state-tree">${this.buildTreeHtml(state)}</div>`;
        }
    }

    buildTreeHtml(obj, path = '') {
        if (typeof obj !== 'object' || obj === null) {
            return '';
        }

        let html = '<ul>';
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const currentPath = path ? `${path}.${key}` : key;
                const value = obj[key];
                const isExpandable = typeof value === 'object' && value !== null && Object.keys(value).length > 0;
                const isExpanded = this.expandedPaths.has(currentPath);
                
                let valueHtml = this.formatValue(value);
                if (this.searchTerm && valueHtml.includes(this.searchTerm)) {
                    valueHtml = valueHtml.replace(new RegExp(this.searchTerm, 'gi'), `<span class="search-highlight">$&</span>`);
                }

                html += `<li>`;
                if (isExpandable) {
                    html += `<span class="toggle ${isExpanded ? 'expanded' : 'collapsed'}" data-path="${currentPath}"></span>`;
                } else {
                    html += `<span class="toggle"></span>`; // Placeholder for alignment
                }
                
                html += `<span class="key">"${key}"</span>: ${valueHtml}`;
                
                if (isExpandable && isExpanded) {
                    html += this.buildTreeHtml(value, currentPath);
                }
                
                html += `</li>`;
            }
        }
        html += '</ul>';
        return html;
    }

    formatValue(value) {
        const type = typeof value;
        if (value === null) return `<span class="value null">null</span>`;
        if (type === 'string') return `<span class="value string">"${value}"</span>`;
        if (type === 'number') return `<span class="value number">${value}</span>`;
        if (type === 'boolean') return `<span class="value boolean">${value}</span>`;
        if (type === 'object') return Array.isArray(value) ? `Array[${value.length}]` : `Object`;
        return String(value);
    }

    togglePathExpansion(element) {
        const path = element.dataset.path;
        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
        }
        this.renderState();
    }
    
    toggleValueExpansion(element) {
        const path = element.dataset.path;
        if(this.expandedValues.has(path)) {
            this.expandedValues.delete(path);
        } else {
            this.expandedValues.add(path);
        }
        this.renderState();
    }

    escapeHtml(text) {
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    startAutoRefresh() {
        if (!this.updateInterval) {
            this.updateInterval = setInterval(() => this.updateStateDisplay(), 2000);
        }
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
        if (this.container) this.container.innerHTML = '';
    }
} 