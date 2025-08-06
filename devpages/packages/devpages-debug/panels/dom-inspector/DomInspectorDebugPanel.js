/**
 * DomInspectorDebugPanel.js - DOM Inspector panel for the debug panel
 * 
 * This panel provides a simplified interface to the DOM Inspector functionality
 * within the debug panel system.
 */

import { appStore } from "/client/appState.js";
// REMOVED: messageQueue import (file deleted)

export class DomInspectorDebugPanel {
    constructor(container) {
        console.log('[DomInspectorDebugPanel] Constructor called.');
        this.container = container;
        if (!this.container) {
            console.error('[DomInspectorDebugPanel] Constructor: container is null!');
        }
        this.domInspector = window.devPages?.domInspector || null;
        this.isInitialized = !!this.domInspector;
        this.currentElement = null;
        
        this.createUI();
        this.setupEventHandlers();

        if (this.isInitialized) {
            this.updateStatus('Ready');
            this.updateInfo();
            this.updateInterval = setInterval(() => this.updateInfo(), 1000);
            console.log('[DomInspectorDebugPanel] DOM Inspector instance found and hooked.');
        } else {
            this.updateStatus('Not Found');
            console.error('[DomInspectorDebugPanel] DOM Inspector instance not found on window.devPages.');
        }
    }

    createUI() {
        this.container.innerHTML = `
            <div class="dom-inspector-debug-panel">
                <div class="panel-header">
                    <h3>DOM Inspector</h3>
                    <div class="status-indicator" id="dom-inspector-status">Initializing...</div>
                </div>
                
                <div class="panel-content">
                    <div class="summary-section">
                        <h4>Current Selection</h4>
                        <div class="element-summary" id="element-summary">
                            <div class="no-selection">
                                <p>No element selected</p>
                                <p class="hint">Use Ctrl+Shift+I to open the full DOM Inspector</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <div class="info-item">
                            <label>Status:</label>
                            <span id="inspector-status">Not initialized</span>
                        </div>
                        <div class="info-item">
                            <label>Current Element:</label>
                            <span id="current-element">None</span>
                        </div>
                        <div class="info-item">
                            <label>Highlight Active:</label>
                            <span id="highlight-status">No</span>
                        </div>
                    </div>
                    
                    <div class="quick-actions">
                        <h4>Quick Actions</h4>
                        <div class="action-buttons">
                            <button id="open-dom-inspector" class="btn btn-primary">Open DOM Inspector</button>
                            <button id="inspect-body" class="btn btn-sm">Inspect Body</button>
                            <button id="inspect-main" class="btn btn-sm">Inspect Main</button>
                            <button id="inspect-header" class="btn btn-sm">Inspect Header</button>
                        </div>
                    </div>
                    
                    <div class="element-details" id="element-details">
                        <!-- Element details will be populated here -->
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .dom-inspector-debug-panel {
                padding: 16px;
                font-family: var(--font-family-sans, system-ui);
            }
            
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            
            .panel-header h3 {
                margin: 0;
                font-size: 16px;
                color: var(--color-foreground, #333);
            }
            
            .status-indicator {
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 4px;
                background: var(--color-background-secondary, #f8f9fa);
                color: var(--color-foreground-muted, #666);
            }
            
            .summary-section {
                margin-bottom: 16px;
            }
            
            .summary-section h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                color: var(--color-foreground, #333);
            }
            
            .element-summary {
                padding: 12px;
                background: var(--color-background-secondary, #f8f9fa);
                border-radius: 4px;
                border: 1px solid var(--color-border, #eee);
                min-height: 60px;
            }
            
            .no-selection {
                text-align: center;
                color: var(--color-foreground-muted, #666);
            }
            
            .no-selection p {
                margin: 4px 0;
                font-size: 12px;
            }
            
            .no-selection .hint {
                font-size: 11px;
                color: var(--color-foreground-muted, #999);
            }
            
            .element-info {
                font-family: var(--font-family-mono, monospace);
                font-size: 12px;
            }
            
            .element-tag {
                font-weight: bold;
                color: var(--color-blue-600, #2563eb);
            }
            
            .element-id {
                color: var(--color-green-600, #16a34a);
            }
            
            .element-classes {
                color: var(--color-purple-600, #9333ea);
            }
            
            .element-text {
                margin-top: 8px;
                padding: 8px;
                background: var(--color-background, white);
                border: 1px solid var(--color-border, #ddd);
                border-radius: 2px;
                font-size: 11px;
                max-height: 60px;
                overflow: hidden;
                color: var(--color-foreground-muted, #666);
            }
            
            .info-section {
                margin-bottom: 16px;
                padding: 12px;
                background: var(--color-background-secondary, #f8f9fa);
                border-radius: 4px;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
                font-size: 12px;
            }
            
            .info-item label {
                font-weight: 500;
                color: var(--color-foreground-muted, #666);
            }
            
            .quick-actions, .element-details {
                margin-bottom: 16px;
            }
            
            .quick-actions h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                color: var(--color-foreground, #333);
            }
            
            .action-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            
            .btn {
                padding: 8px 12px;
                margin: 4px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                background: var(--color-background, white);
                color: var(--color-foreground, #333);
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            
            .btn:hover:not(:disabled) {
                background: var(--color-background-secondary, #f8f9fa);
            }
            
            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn-primary {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }
            
            .btn-primary:hover:not(:disabled) {
                background: var(--color-primary-hover, #0056b3);
            }
            
            .btn-sm {
                padding: 4px 8px;
                font-size: 11px;
            }
            
            .element-details {
                font-family: var(--font-family-mono, monospace);
                font-size: 11px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 2px 0;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            
            .detail-row:last-child {
                border-bottom: none;
            }
            
            .detail-label {
                font-weight: 500;
                color: var(--color-foreground-muted, #666);
                min-width: 80px;
            }
            
            .detail-value {
                color: var(--color-foreground, #333);
                text-align: right;
                word-break: break-all;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventHandlers() {
        console.log('[DomInspectorDebugPanel] setupEventHandlers called.');
        const openButton = this.container.querySelector('#open-dom-inspector');
        
        if (openButton) {
            console.log('[DomInspectorDebugPanel] Found #open-dom-inspector button. Attaching listener.', openButton);
            openButton.addEventListener('click', () => {
                this.openDomInspector();
            });
        } else {
            console.error('[DomInspectorDebugPanel] Could not find #open-dom-inspector button to attach listener.');
            console.log('[DomInspectorDebugPanel] Container contents:', this.container.innerHTML);
        }

        // Quick action buttons
        this.container.querySelector('#inspect-body').addEventListener('click', () => {
            this.inspectElement('body');
        });

        this.container.querySelector('#inspect-main').addEventListener('click', () => {
            this.inspectElement('main');
        });

        this.container.querySelector('#inspect-header').addEventListener('click', () => {
            this.inspectElement('header');
        });
    }



    updateStatus(status) {
        const statusElement = this.container.querySelector('#dom-inspector-status');
        const statusIndicator = this.container.querySelector('.status-indicator');
        
        if (statusElement) statusElement.textContent = status;
        if (statusIndicator) statusIndicator.textContent = status;
        
        // Update status indicator color
        if (statusIndicator) {
            statusIndicator.style.background = status === 'Ready' ? '#d4edda' : '#f8d7da';
            statusIndicator.style.color = status === 'Ready' ? '#155724' : '#721c24';
        }
    }

    updateInfo() {
        if (!this.domInspector) return;

        try {
            // Update current element info
            const currentElementSpan = this.container.querySelector('#current-element');
            if (currentElementSpan) {
                const currentElement = this.domInspector.currentElement;
                if (currentElement) {
                    const tagName = currentElement.tagName.toLowerCase();
                    const id = currentElement.id ? `#${currentElement.id}` : '';
                    const className = currentElement.className ? `.${currentElement.className.split(' ')[0]}` : '';
                    currentElementSpan.textContent = `${tagName}${id}${className}`;
                } else {
                    currentElementSpan.textContent = 'None';
                }
            }

            // Update highlight status
            const highlightStatusSpan = this.container.querySelector('#highlight-status');
            if (highlightStatusSpan) {
                const isHighlighted = this.domInspector.highlightOverlay && 
                                    this.domInspector.highlightOverlay.isVisible;
                highlightStatusSpan.textContent = isHighlighted ? 'Yes' : 'No';
            }

            // Update inspector status
            const inspectorStatusSpan = this.container.querySelector('#inspector-status');
            if (inspectorStatusSpan) {
                const isVisible = this.domInspector.panel && 
                                this.domInspector.panel.style.display !== 'none';
                inspectorStatusSpan.textContent = isVisible ? 'Open' : 'Closed';
            }

            // Update element summary
            this.updateElementSummary();
        } catch (error) {
            console.error('[DomInspectorDebugPanel] Error updating info:', error);
        }
    }

    updateElementSummary() {
        const summaryContainer = this.container.querySelector('#element-summary');
        const detailsContainer = this.container.querySelector('#element-details');
        
        if (!summaryContainer || !detailsContainer) return;

        const currentElement = this.domInspector?.currentElement;
        
        if (!currentElement) {
            summaryContainer.innerHTML = `
                <div class="no-selection">
                    <p>No element selected</p>
                    <p class="hint">Use Ctrl+Shift+I to open the full DOM Inspector</p>
                </div>
            `;
            detailsContainer.innerHTML = '';
            return;
        }

        // Create element summary
        const tagName = currentElement.tagName.toLowerCase();
        const id = currentElement.id ? `#${currentElement.id}` : '';
        const classes = currentElement.className ? `.${currentElement.className.split(' ').join('.')}` : '';
        const textContent = currentElement.textContent?.trim().substring(0, 100) || '';
        
        summaryContainer.innerHTML = `
            <div class="element-info">
                <div>
                    <span class="element-tag">${tagName}</span>
                    <span class="element-id">${id}</span>
                    <span class="element-classes">${classes}</span>
                </div>
                ${textContent ? `<div class="element-text">${textContent}${textContent.length >= 100 ? '...' : ''}</div>` : ''}
            </div>
        `;

        // Create element details
        const computedStyle = window.getComputedStyle(currentElement);
        const details = [
            ['Tag', tagName],
            ['ID', currentElement.id || 'None'],
            ['Classes', currentElement.className || 'None'],
            ['Display', computedStyle.display],
            ['Position', computedStyle.position],
            ['Z-Index', computedStyle.zIndex],
            ['Width', computedStyle.width],
            ['Height', computedStyle.height],
            ['Children', currentElement.children.length],
            ['Text Length', currentElement.textContent?.length || 0]
        ];

        detailsContainer.innerHTML = `
            <h4>Element Details</h4>
            ${details.map(([label, value]) => `
                <div class="detail-row">
                    <span class="detail-label">${label}:</span>
                    <span class="detail-value">${value}</span>
                </div>
            `).join('')}
        `;
    }

    openDomInspector() {
        console.log('[DomInspectorDebugPanel] openDomInspector button clicked.');
        
        if (!this.domInspector) {
            console.error('[DomInspectorDebugPanel] DOM Inspector instance is not available.');
            return;
        }

        console.log('[DomInspectorDebugPanel] domInspector instance:', this.domInspector);
        console.log('[DomInspectorDebugPanel] Methods available on instance:', Object.keys(this.domInspector));

        try {
            if (typeof this.domInspector.toggle === 'function') {
                console.log('[DomInspectorDebugPanel] Calling domInspector.toggle()');
                this.domInspector.toggle();
            } else {
                console.error('[DomInspectorDebugPanel] domInspector.toggle() is not a function.');
                console.log('[DomInspectorDebugPanel] Attempting to find the instance on window.devPages...');
                if (window.devPages && window.devPages.domInspector && typeof window.devPages.domInspector.toggle === 'function') {
                    console.log('[DomInspectorDebugPanel] Found toggle() on window.devPages.domInspector. Calling it.');
                    window.devPages.domInspector.toggle();
                } else {
                    console.error('[DomInspectorDebugPanel] Could not find a valid toggle method.');
                }
            }
        } catch (error) {
            console.error('[DomInspectorDebugPanel] Error calling toggle() on DOM Inspector:', error);
        }
    }

    inspectElement(selector) {
        if (!this.domInspector) return;
        
        try {
            const element = document.querySelector(selector);
            if (element) {
                this.domInspector.selectElement(element);
            } else {
                console.warn(`[DomInspectorDebugPanel] Element with selector '${selector}' not found`);
            }
        } catch (error) {
            console.error('[DomInspectorDebugPanel] Error inspecting element:', error);
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
} 