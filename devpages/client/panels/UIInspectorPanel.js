/**
 * UIInspectorPanel.js - UI Inspector panel implementation
 * 
 * Provides detailed UI inspection and performance monitoring
 */

import { BasePanel, panelRegistry } from './BasePanel.js';
import { appStore } from '../appState.js';
import { JsonViewer } from '../components/JsonViewer.js';

export class UIInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'ui-inspector',
            title: 'UI Inspector',
            defaultWidth: 700,
            defaultHeight: 500,
            ...config
        });
        
        this.inspectorData = {};
        this.jsonViewer = new JsonViewer();
    }

    renderContent() {
        return `
            <div class="devpages-panel-content">
                <!-- UI Inspector Sections -->
                <div class="devpages-panel-sections">
                    <!-- Slice Overview Section -->
                    <div class="devpages-panel-row collapsed" data-section="slice-overview">
                        <div class="devpages-panel-row-header" data-toggle="slice-overview">
                            <span class="devpages-panel-row-icon">▶</span>
                            <span class="devpages-panel-row-title">Redux State Slices</span>
                            <span class="devpages-type-badge" id="slice-badge">●</span>
                        </div>
                        <div class="devpages-panel-row-content" id="slice-overview-content">
                            <!-- Content will be rendered by refreshSliceOverview -->
                        </div>
                    </div>

                    <!-- Dependency Map Section -->
                    <div class="devpages-panel-row collapsed" data-section="dependency-map">
                        <div class="devpages-panel-row-header" data-toggle="dependency-map">
                            <span class="devpages-panel-row-icon">▶</span>
                            <span class="devpages-panel-row-title">Dependency Map</span>
                            <span class="devpages-type-badge" id="dependency-badge">●</span>
                        </div>
                        <div class="devpages-panel-row-content" id="dependency-map-content">
                            <div class="devpages-panel-subsection collapsed">
                                <div class="devpages-panel-subsection-header" data-toggle="dependency-details">
                                    <span class="devpages-panel-subsection-icon">▶</span>
                                    <span class="devpages-panel-subsection-title">Dependencies</span>
                                </div>
                                <div class="devpages-panel-subsection-content collapsed" id="dependency-details">
                                    <div class="dependency-map">
                                        <div class="dependency-section">
                                            <h3 class="dependency-title">UI Dependencies</h3>
                                            <div class="dependency-graph">
                                                <div class="dependency-item">
                                                    <div class="dependency-source">BasePanel</div>
                                                    <div class="dependency-arrow">
                                                        <div class="arrow-line"></div>
                                                        <div class="arrow-head"></div>
                                                    </div>
                                                    <div class="dependency-target">UIInspectorPanel</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Metrics Section -->
                    <div class="devpages-panel-row collapsed" data-section="performance">
                        <div class="devpages-panel-row-header" data-toggle="performance">
                            <span class="devpages-panel-row-icon">▶</span>
                            <span class="devpages-panel-row-title">Performance Metrics</span>
                            <span class="devpages-type-badge" id="performance-badge">●</span>
                        </div>
                        <div class="devpages-panel-row-content" id="performance-content">
                            <div class="devpages-panel-subsection collapsed">
                                <div class="devpages-panel-subsection-header" data-toggle="performance-details">
                                    <span class="devpages-panel-subsection-icon">▶</span>
                                    <span class="devpages-panel-subsection-title">Metrics</span>
                                </div>
                                <div class="devpages-panel-subsection-content collapsed" id="performance-details">
                                    <div class="metrics-overview">
                                        <div class="metric-card">
                                            <div class="metric-value-large">2.3s</div>
                                            <div class="metric-label-large">Load Time</div>
                                        </div>
                                        <div class="metric-card">
                                            <div class="metric-value-large">45MB</div>
                                            <div class="metric-label-large">Memory Usage</div>
                                        </div>
                                        <div class="metric-card">
                                            <div class="metric-value-large">8</div>
                                            <div class="metric-label-large">Components</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    addUIInspectorStyles() {
        if (document.getElementById('ui-inspector-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'ui-inspector-panel-styles';
        style.textContent = `
            /* === UI Inspector Panel Styles === */
            
            /* Slice Metrics Table */
            .slice-metrics-table {
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                overflow: hidden;
            }

            .table-header {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 60px;
                gap: var(--space-2);
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border-bottom: 1px solid var(--color-border);
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-semibold);
                color: var(--color-text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .table-row {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 60px;
                gap: var(--space-2);
                padding: var(--space-2);
                border-bottom: 1px solid var(--color-border);
                font-size: var(--font-size-sm);
                align-items: center;
                transition: background-color 0.15s ease;
            }

            .table-row:hover {
                background: var(--color-bg-hover);
            }

            .table-row:last-child {
                border-bottom: none;
            }

            .table-row.loading {
                background: rgba(245, 158, 11, 0.05);
            }

            .slice-name {
                font-weight: 500;
                color: var(--color-text);
            }

            .slice-type {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                background: var(--color-bg-alt);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                text-align: center;
            }

            .slice-size {
                font-family: var(--font-family-mono);
                color: var(--color-text-secondary);
                text-align: right;
            }

            .slice-items {
                font-family: var(--font-family-mono);
                color: var(--color-text-secondary);
                text-align: right;
            }

            .slice-status-indicator {
                text-align: center;
                font-size: var(--font-size-base);
            }

            /* Dependency Map Styles */
            .dependency-map {
                padding: var(--space-2);
            }

            .dependency-section {
                margin-bottom: var(--space-3);
                padding-bottom: var(--space-2);
                border-bottom: 1px solid var(--color-border);
            }

            .dependency-section:last-child {
                border-bottom: none;
            }

            .dependency-title {
                font-size: var(--font-size-base);
                font-weight: var(--font-weight-semibold);
                color: var(--color-text);
                margin: 0 0 var(--space-2) 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .dependency-graph {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .dependency-item {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                transition: all 0.15s ease;
            }

            .dependency-item:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary);
            }

            .dependency-source,
            .dependency-target {
                font-weight: var(--font-weight-medium);
                color: var(--color-text);
                padding: var(--space-1) var(--space-2);
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
                text-align: center;
                font-size: var(--font-size-sm);
            }

            .dependency-arrow {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: var(--space-1);
            }

            .arrow-line {
                width: 30px;
                height: 1px;
                background: var(--color-border);
            }

            .arrow-head {
                color: var(--color-text-secondary);
                font-size: var(--font-size-xs);
            }

            /* Performance Metrics */
            .metrics-overview {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: var(--space-2);
            }

            .metric-card {
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                padding: var(--space-2);
                text-align: center;
            }

            .metric-value-large {
                font-size: var(--font-size-xl);
                font-weight: var(--font-weight-bold);
                color: var(--color-text);
                margin-bottom: var(--space-1);
            }

            .metric-label-large {
                font-size: var(--font-size-sm);
                color: var(--color-text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* === Redux Accordion Styles (from DiagnosticPanel) === */
            .dp-redux-accordion {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }
            .devpages-slice-item {
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                background: var(--color-bg);
                overflow: hidden;
                transition: all 0.2s ease;
            }
            .devpages-slice-item:hover {
                border-color: var(--color-primary-light);
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .devpages-slice-item.expanded {
                border-color: var(--color-primary);
            }
            .devpages-slice-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-2) var(--space-3);
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s ease;
            }
            .devpages-slice-header:hover {
                background: var(--color-bg-hover);
            }
            .devpages-slice-item.expanded .devpages-slice-header {
                background: var(--color-bg-alt);
                border-bottom: 1px solid var(--color-border);
            }
            .devpages-slice-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .devpages-slice-name {
                font-weight: var(--font-weight-bold);
                color: var(--color-text);
            }
            .devpages-slice-meta {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
            }
            .devpages-slice-type {
                background: var(--color-bg-alt);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
            }
            .devpages-slice-controls {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }
            .devpages-slice-status {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--color-border);
            }
            .devpages-slice-status.ready { background: var(--color-success); }
            .devpages-slice-status.loading { background: var(--color-warning); }
            .devpages-slice-status.error { background: var(--color-danger); }
            .devpages-slice-status.empty { background: var(--color-text-secondary); }
            .devpages-slice-icon {
                font-size: 10px;
                color: var(--color-text-secondary);
                transition: transform 0.2s ease;
            }
            .devpages-slice-content {
                padding: var(--space-2) var(--space-3) var(--space-3);
                border-top: 1px solid var(--color-border);
                background: var(--color-bg);
            }
            .devpages-slice-content.collapsed {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    onMount(container = null) {
        console.log('[UIInspectorPanel] onMount called', { container });
        super.onMount(container);

        this.addUIInspectorStyles();
        this.attachCollapseListeners();
        this.refresh();
    }

    attachCollapseListeners() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[UIInspectorPanel] No container found for collapse listeners');
            return;
        }

        // Section collapse/expand
        container.addEventListener('click', (e) => {
            const sectionHeader = e.target.closest('.devpages-panel-row-header');
            if (sectionHeader) {
                const section = sectionHeader.closest('.devpages-panel-row');
                const icon = sectionHeader.querySelector('.devpages-panel-row-icon');
                
                section.classList.toggle('collapsed');
                icon.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
                return;
            }

            // Subsection collapse/expand
            const subsectionHeader = e.target.closest('.devpages-panel-subsection-header');
            if (subsectionHeader) {
                const subsection = subsectionHeader.closest('.devpages-panel-subsection');
                const content = subsection.querySelector('.devpages-panel-subsection-content');
                const icon = subsectionHeader.querySelector('.devpages-panel-subsection-icon');
                
                subsection.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
                icon.textContent = subsection.classList.contains('collapsed') ? '▶' : '▼';
            }
        });
    }

    refresh() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[UIInspectorPanel] No container found for refreshing');
            return;
        }

        this.refreshSliceOverview(container);
        this.refreshDependencyMap(container);
        this.refreshPerformanceMetrics(container);
    }

    // --- Slice Helper Methods (adapted from DiagnosticPanel) ---
    getSliceType(sliceKey, sliceData) {
        if (sliceKey === 'panels') return 'Panel Mgmt';
        if (sliceKey === 'ui') return 'UI State';
        if (sliceKey === 'auth') return 'Authentication';
        if (sliceKey === 'settings') return 'Configuration';
        if (sliceKey === 'system') return 'System State';
        if (Array.isArray(sliceData)) return 'Array';
        if (typeof sliceData === 'object' && sliceData !== null) return 'Object';
        return 'Primitive';
    }

    getSliceItemCount(sliceData) {
        if (Array.isArray(sliceData)) return sliceData.length;
        if (typeof sliceData === 'object' && sliceData !== null) {
            return Object.keys(sliceData).length;
        }
        return 1;
    }

    getSliceStatus(sliceData) {
        if (sliceData === null || sliceData === undefined) return 'empty';
        if (typeof sliceData === 'object') {
            if (sliceData.error) return 'error';
            if (sliceData.loading) return 'loading';
        }
        return 'ready';
    }
    // --- End of Slice Helper Methods ---

    refreshSliceOverview(container) {
        const content = container?.querySelector('#slice-overview-content');
        if (!content) {
            console.error('Could not find slice overview content', {
                container: container,
                selector: '#slice-overview-content'
            });
            return;
        }

        const state = appStore.getState();
        const accordionHtml = Object.entries(state).map(([key, sliceData]) => {
            const type = this.getSliceType(key, sliceData);
            const items = this.getSliceItemCount(sliceData);
            const status = this.getSliceStatus(sliceData);

            return `
                <div class="devpages-slice-item" data-slice-key="${key}">
                    <div class="devpages-slice-header">
                        <div class="devpages-slice-main">
                            <span class="devpages-slice-name">${key}</span>
                            <div class="devpages-slice-meta">
                                <span class="devpages-slice-type">${type}</span>
                                <span class="devpages-slice-count">${items} items</span>
                            </div>
                        </div>
                        <div class="devpages-slice-controls">
                            <span class="devpages-slice-status ${status}"></span>
                            <span class="devpages-slice-icon">▶</span>
                        </div>
                    </div>
                    <div class="devpages-slice-content collapsed">
                        ${this.jsonViewer.render(sliceData)}
                    </div>
                </div>
            `;
        }).join('');
        
        content.innerHTML = `<div class="dp-redux-accordion">${accordionHtml}</div>`;
        
        // Attach event listeners for the new accordion
        this.attachSliceAccordionListeners(content);
    }

    attachSliceAccordionListeners(container) {
        container.addEventListener('click', (e) => {
            const header = e.target.closest('.devpages-slice-header');
            if (!header) return;

            const item = header.closest('.devpages-slice-item');
            const content = item.querySelector('.devpages-slice-content');
            const icon = header.querySelector('.devpages-slice-icon');

            const isCollapsed = content.classList.toggle('collapsed');
            item.classList.toggle('expanded', !isCollapsed);
            icon.textContent = isCollapsed ? '▶' : '▼';
        });
    }

    refreshDependencyMap(container) {
        const content = container?.querySelector('#dependency-details');
        if (!content) {
            console.error('Could not find dependency map content', {
                container: container,
                selector: '#dependency-details'
            });
            return;
        }

        // Populate dependency map
        content.innerHTML = `
            <div class="dependency-map">
                <div class="dependency-section">
                    <h3 class="dependency-title">UI Dependencies</h3>
                    <div class="dependency-graph">
                        <div class="dependency-item">
                            <div class="dependency-source">BasePanel</div>
                            <div class="dependency-arrow">
                                <div class="arrow-line"></div>
                                <div class="arrow-head"></div>
                            </div>
                            <div class="dependency-target">UIInspectorPanel</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    refreshPerformanceMetrics(container) {
        const content = container?.querySelector('#performance-details');
        if (!content) {
            console.error('Could not find performance metrics content', {
                container: container,
                selector: '#performance-details'
            });
            return;
        }

        // Populate performance metrics
        content.innerHTML = `
            <div class="metrics-overview">
                <div class="metric-card">
                    <div class="metric-value-large">2.3s</div>
                    <div class="metric-label-large">Load Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value-large">45MB</div>
                    <div class="metric-label-large">Memory Usage</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value-large">8</div>
                    <div class="metric-label-large">Components</div>
                </div>
            </div>
        `;
    }

    // Hash generation utility for component identification
    generateHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
}

export function createUIInspectorPanel(config = {}) {
    return new UIInspectorPanel(config);
}

panelRegistry.registerType('ui-inspector', UIInspectorPanel);