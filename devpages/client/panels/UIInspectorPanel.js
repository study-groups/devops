import { BasePanel, panelRegistry } from './BasePanel.js';
import { appStore } from '../appState.js';
import { JsonViewer } from '../components/JsonViewer.js';

export class UIInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'ui-inspector',
            title: 'UI Inspector',
            defaultWidth: 600,
            defaultHeight: 400,
            ...config
        });
        
        this.jsonViewer = new JsonViewer();
    }

    renderContent() {
        return `
            <div class="dp-container">
                <!-- Diagnostic Sections -->
                <div class="dp-sections">
                    <!-- Component Registry Section -->
                    <div class="dp-section collapsed" data-section="components">
                        <div class="dp-section-header" data-toggle="components">
                            <span class="dp-section-icon">▶</span>
                            <span class="dp-section-title">Component Registry</span>
                            <span class="dp-section-badge" id="components-badge">●</span>
                        </div>
                        <div class="dp-section-content" id="components-content">
                            <div class="dp-subsection collapsed">
                                <div class="dp-subsection-header" data-toggle="component-status">
                                    <span class="dp-subsection-icon">▶</span>
                                    <span class="dp-subsection-title">Active Components</span>
                                </div>
                                <div class="dp-subsection-content collapsed" id="component-status">Loading...</div>
                            </div>
                            <div class="dp-subsection collapsed">
                                <div class="dp-subsection-header" data-toggle="component-services">
                                    <span class="dp-subsection-icon">▶</span>
                                    <span class="dp-subsection-title">Services</span>
                                </div>
                                <div class="dp-subsection-content collapsed" id="component-services">Loading...</div>
                            </div>
                        </div>
                    </div>

                    <!-- Redux State Section -->
                    <div class="dp-section collapsed" data-section="redux">
                        <div class="dp-section-header" data-toggle="redux">
                            <span class="dp-section-icon">▶</span>
                            <span class="dp-section-title">Redux State</span>
                            <span class="dp-section-badge" id="redux-badge">●</span>
                        </div>
                        <div class="dp-section-content" id="redux-content">
                            <div class="dp-subsection collapsed">
                                <div class="dp-subsection-header" data-toggle="redux-status">
                                    <span class="dp-subsection-icon">▶</span>
                                    <span class="dp-subsection-title">Store Status</span>
                                </div>
                                <div class="dp-subsection-content collapsed" id="redux-status">Loading...</div>
                            </div>
                            <div class="dp-subsection collapsed">
                                <div class="dp-subsection-header" data-toggle="redux-slices">
                                    <span class="dp-subsection-icon">▶</span>
                                    <span class="dp-subsection-title">Slice Overview</span>
                                </div>
                                <div class="dp-subsection-content collapsed" id="redux-slices">Loading...</div>
                            </div>
                            <div class="dp-subsection collapsed">
                                <div class="dp-subsection-header" data-toggle="slice-dependencies">
                                    <span class="dp-subsection-icon">▶</span>
                                    <span class="dp-subsection-title">Dependency Map</span>
                                </div>
                                <div class="dp-subsection-content collapsed" id="slice-dependencies">Loading...</div>
                            </div>
                            <div class="dp-subsection collapsed">
                                <div class="dp-subsection-header" data-toggle="slice-health">
                                    <span class="dp-subsection-icon">▶</span>
                                    <span class="dp-subsection-title">Health Monitor</span>
                                </div>
                                <div class="dp-subsection-content collapsed" id="slice-health">Loading...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container = null) {
        if (container) {
            this.container = container;
        }
        super.onMount(container);
        this.addUIInspectorStyles();
        this.attachCollapseListeners();
        this.refresh();
    }

    refresh() {
        if (!this.container) return;
        this.updateComponentStatus(this.container);
        this.updateReduxStatus(this.container);
    }
    
    // Redux Slice Helper Methods
    getSliceType(sliceKey, sliceData) {
        if (sliceKey === 'panels') return 'Panel Management';
        if (sliceKey === 'ui') return 'User Interface';
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
            const keys = Object.keys(sliceData);
            if (keys.includes('panels') && typeof sliceData.panels === 'object') {
                return Object.keys(sliceData.panels).length;
            }
            return keys.length;
        }
        return null;
    }

    getSliceStatus(sliceData) {
        if (!sliceData) return 'empty';
        if (typeof sliceData === 'object' && sliceData !== null) {
            if (sliceData.error) return 'error';
            if (sliceData.loading) return 'loading';
            if (sliceData._initialized === false) return 'pending';
        }
        return 'ready';
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + 'KB';
        return Math.round(bytes / (1024 * 1024)) + 'MB';
    }

    renderSliceProperties(sliceData) {
        return this.jsonViewer.render(sliceData);
    }

    attachSliceAccordionListeners(container) {
        container.addEventListener('click', (e) => {
            const sliceHeader = e.target.closest('.dp-slice-header');
            if (sliceHeader) {
                const sliceKey = sliceHeader.dataset.toggleSlice;
                const sliceItem = sliceHeader.closest('.dp-slice-item');
                const sliceContent = sliceItem.querySelector('.dp-slice-content');
                const sliceIcon = sliceHeader.querySelector('.dp-slice-icon');
                const isCollapsed = sliceContent.classList.contains('collapsed');
                
                if (isCollapsed) {
                    sliceContent.classList.remove('collapsed');
                    sliceIcon.textContent = '▼';
                    sliceItem.classList.add('expanded');
                } else {
                    sliceContent.classList.add('collapsed');
                    sliceIcon.textContent = '▶';
                    sliceItem.classList.remove('expanded');
                }
            }
        });
    }

    attachCollapseListeners() {
        if (!this.container) return;
        this.container.addEventListener('click', (e) => {
            const sectionHeader = e.target.closest('.dp-section-header');
            if (sectionHeader) {
                const section = sectionHeader.closest('.dp-section');
                const icon = sectionHeader.querySelector('.dp-section-icon');
                section.classList.toggle('collapsed');
                icon.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
                return;
            }

            const subsectionHeader = e.target.closest('.dp-subsection-header');
            if (subsectionHeader) {
                const subsection = subsectionHeader.closest('.dp-subsection');
                const content = subsection.querySelector('.dp-subsection-content');
                const icon = subsectionHeader.querySelector('.dp-subsection-icon');
                subsection.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
                icon.textContent = subsection.classList.contains('collapsed') ? '▶' : '▼';
            }
        });
    }

    updateComponentStatus(container) {
        const components = [];
        if (window.APP?.bootloader) {
            components.push({ name: 'Bootloader', status: window.APP.bootloader.phase || 'unknown', type: 'system' });
        }
        if (window.APP?.panels?.registry) {
            const panelCount = window.APP.panels.registry.getAllPanels().length;
            components.push({ name: 'Panel Registry', status: `${panelCount} panels`, type: 'system' });
        }
        if (window.APP?.services) {
            Object.keys(window.APP.services).forEach(serviceName => {
                components.push({ name: serviceName, status: 'active', type: 'service' });
            });
        }

        const componentContainer = container.querySelector('#component-status');
        if (componentContainer) {
            componentContainer.innerHTML = components.length > 0 ? `
                <div class="dp-component-list">
                    ${components.map(comp => `<div class="dp-component-item"><div class="dp-component-main"><div class="dp-component-name">${comp.name}</div><div class="dp-component-type">${comp.type}</div></div><div class="dp-component-status ${comp.status.toLowerCase()}">${comp.status}</div></div>`).join('')}
                </div>
            ` : '<div class="dp-data-value">No components detected</div>';
        }
    }

    updateReduxStatus(container) {
        const store = appStore;
        const reduxContainer = container.querySelector('#redux-status');
        const slicesContainer = container.querySelector('#redux-slices');
        if (!store || !reduxContainer) return;

        const state = store.getState();
        const stateKeys = Object.keys(state);
        
        // Update main Redux status - just show basic info
        reduxContainer.innerHTML = `
            <div class="dp-redux-overview">
                <div class="dp-data-grid">
                    <span class="dp-data-label">Total Slices:</span>
                    <span class="dp-data-value">${stateKeys.length}</span>
                    <span class="dp-data-label">Active Panel:</span>
                    <span class="dp-data-value">${state.panels?.activePanel || 'None'}</span>
                    <span class="dp-data-label">Total Size:</span>
                    <span class="dp-data-value">${this.formatBytes(JSON.stringify(state).length)}</span>
                </div>
            </div>
            <div class="dp-redux-accordion">
                ${stateKeys.map(sliceKey => {
                    const sliceData = state[sliceKey];
                    const sliceSize = JSON.stringify(sliceData).length;
                    const sliceType = this.getSliceType(sliceKey, sliceData);
                    const itemCount = this.getSliceItemCount(sliceData);
                    return `
                        <div class="dp-slice-item" data-slice="${sliceKey}">
                            <div class="dp-slice-header" data-toggle-slice="${sliceKey}">
                                <div class="dp-slice-main">
                                    <div class="dp-slice-name">${sliceKey}</div>
                                    <div class="dp-slice-meta">
                                        <span class="dp-slice-type">${sliceType}</span>
                                        <span class="dp-slice-size">${this.formatBytes(sliceSize)}</span>
                                        ${itemCount ? `<span class="dp-slice-count">${itemCount} items</span>` : ''}
                                    </div>
                                </div>
                                <div class="dp-slice-controls">
                                    <span class="dp-slice-status ${this.getSliceStatus(sliceData)}"></span>
                                    <span class="dp-slice-icon">▶</span>
                                </div>
                            </div>
                            <div class="dp-slice-content collapsed" id="slice-${sliceKey}">
                                ${this.renderSliceProperties(sliceData)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Update slice overview dashboard
        if (slicesContainer) {
            slicesContainer.innerHTML = this.renderSliceOverviewDashboard(state, stateKeys);
        }

        // Update dependency map
        const dependenciesContainer = container.querySelector('#slice-dependencies');
        if (dependenciesContainer) {
            dependenciesContainer.innerHTML = this.renderSliceDependencyMap(state, stateKeys);
        }

        // Update health monitor
        const healthContainer = container.querySelector('#slice-health');
        if (healthContainer) {
            healthContainer.innerHTML = this.renderSliceHealthMonitor(state, stateKeys);
        }
        
        this.attachSliceAccordionListeners(reduxContainer);
    }

    renderSliceOverviewDashboard(state, stateKeys) {
        const sliceMetrics = stateKeys.map(sliceKey => {
            const sliceData = state[sliceKey];
            const sliceSize = JSON.stringify(sliceData).length;
            const sliceType = this.getSliceType(sliceKey, sliceData);
            const itemCount = this.getSliceItemCount(sliceData);
            const status = this.getSliceStatus(sliceData);
            
            return {
                key: sliceKey,
                size: sliceSize,
                type: sliceType,
                itemCount,
                status,
                hasErrors: status === 'error',
                isLoading: status === 'loading',
                isEmpty: status === 'empty'
            };
        });

        // Sort by size (largest first)
        sliceMetrics.sort((a, b) => b.size - a.size);

        const totalSize = sliceMetrics.reduce((sum, slice) => sum + slice.size, 0);
        const errorCount = sliceMetrics.filter(s => s.hasErrors).length;
        const loadingCount = sliceMetrics.filter(s => s.isLoading).length;
        const emptyCount = sliceMetrics.filter(s => s.isEmpty).length;

        return `
            <div class="slice-overview-dashboard">
                <div class="dashboard-summary">
                    <div class="summary-card">
                        <div class="summary-value">${this.formatBytes(totalSize)}</div>
                        <div class="summary-label">Total State Size</div>
                    </div>
                    <div class="summary-card ${errorCount > 0 ? 'error' : ''}">
                        <div class="summary-value">${errorCount}</div>
                        <div class="summary-label">Errors</div>
                    </div>
                    <div class="summary-card ${loadingCount > 0 ? 'loading' : ''}">
                        <div class="summary-value">${loadingCount}</div>
                        <div class="summary-label">Loading</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${emptyCount}</div>
                        <div class="summary-label">Empty</div>
                    </div>
                </div>
                
                <div class="slice-metrics-table">
                    <div class="table-header">
                        <span>Slice</span>
                        <span>Type</span>
                        <span>Size</span>
                        <span>Items</span>
                        <span>Status</span>
                    </div>
                    ${sliceMetrics.map(slice => `
                        <div class="table-row ${slice.status}">
                            <span class="slice-name">${slice.key}</span>
                            <span class="slice-type">${slice.type}</span>
                            <span class="slice-size">${this.formatBytes(slice.size)}</span>
                            <span class="slice-items">${slice.itemCount || '-'}</span>
                            <span class="slice-status-indicator ${slice.status}">
                                ${slice.hasErrors ? '❌' : slice.isLoading ? '⏳' : slice.isEmpty ? '⚪' : '✅'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderSliceDependencyMap(state, stateKeys) {
        // Analyze slice relationships and dependencies
        const dependencies = this.analyzeSliceDependencies(state, stateKeys);
        const components = this.detectComponentSubscriptions(state);
        
        return `
            <div class="dependency-map">
                <div class="dependency-section">
                    <h4 class="dependency-title">Slice Relationships</h4>
                    <div class="dependency-graph">
                        ${dependencies.map(dep => `
                            <div class="dependency-item">
                                <div class="dependency-source">${dep.source}</div>
                                <div class="dependency-arrow">
                                    <span class="arrow-line"></span>
                                    <span class="arrow-head">→</span>
                                    <span class="dependency-type">${dep.type}</span>
                                </div>
                                <div class="dependency-target">${dep.target}</div>
                            </div>
                        `).join('')}
                        ${dependencies.length === 0 ? '<div class="no-dependencies">No cross-slice dependencies detected</div>' : ''}
                    </div>
                </div>

                <div class="dependency-section">
                    <h4 class="dependency-title">Component Subscriptions</h4>
                    <div class="component-subscriptions">
                        ${components.map(comp => `
                            <div class="subscription-item">
                                <div class="component-info">
                                    <span class="component-name">${comp.name}</span>
                                    <span class="component-type">${comp.type}</span>
                                </div>
                                <div class="subscribed-slices">
                                    ${comp.slices.map(slice => `
                                        <span class="slice-tag ${this.getSliceStatus(state[slice])}">${slice}</span>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                        ${components.length === 0 ? '<div class="no-subscriptions">No component subscriptions detected</div>' : ''}
                    </div>
                </div>

                <div class="dependency-section">
                    <h4 class="dependency-title">Data Flow Analysis</h4>
                    <div class="data-flow">
                        ${this.renderDataFlowAnalysis(state, stateKeys)}
                    </div>
                </div>
            </div>
        `;
    }

    analyzeSliceDependencies(state, stateKeys) {
        const dependencies = [];
        
        stateKeys.forEach(sourceSlice => {
            const sliceData = state[sourceSlice];
            
            // Look for references to other slices in the data
            stateKeys.forEach(targetSlice => {
                if (sourceSlice !== targetSlice) {
                    const sliceString = JSON.stringify(sliceData);
                    
                    // Check for direct references
                    if (sliceString.includes(`"${targetSlice}"`)) {
                        dependencies.push({
                            source: sourceSlice,
                            target: targetSlice,
                            type: 'reference'
                        });
                    }
                    
                    // Check for ID-based relationships
                    if (sliceData && typeof sliceData === 'object') {
                        const targetData = state[targetSlice];
                        if (this.hasIdBasedRelationship(sliceData, targetData)) {
                            dependencies.push({
                                source: sourceSlice,
                                target: targetSlice,
                                type: 'id-based'
                            });
                        }
                    }
                }
            });
        });
        
        return dependencies;
    }

    hasIdBasedRelationship(sourceData, targetData) {
        // Look for common ID patterns between slices
        if (!sourceData || !targetData || typeof sourceData !== 'object' || typeof targetData !== 'object') {
            return false;
        }
        
        const sourceIds = this.extractIds(sourceData);
        const targetIds = this.extractIds(targetData);
        
        return sourceIds.some(id => targetIds.includes(id));
    }

    extractIds(data, path = '') {
        const ids = [];
        
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                ids.push(...this.extractIds(item, `${path}[${index}]`));
            });
        } else if (data && typeof data === 'object') {
            Object.entries(data).forEach(([key, value]) => {
                if (key.toLowerCase().includes('id') && (typeof value === 'string' || typeof value === 'number')) {
                    ids.push(value);
                } else if (typeof value === 'object') {
                    ids.push(...this.extractIds(value, `${path}.${key}`));
                }
            });
        }
        
        return ids;
    }

    detectComponentSubscriptions(state) {
        const components = [];
        
        // Detect panel subscriptions
        if (state.panels) {
            components.push({
                name: 'Panel System',
                type: 'system',
                slices: ['panels', 'ui'].filter(slice => state[slice])
            });
        }
        
        // Detect UI subscriptions
        if (state.ui) {
            components.push({
                name: 'UI Manager',
                type: 'system',
                slices: ['ui', 'panels'].filter(slice => state[slice])
            });
        }
        
        // Detect file system subscriptions
        if (state.file) {
            components.push({
                name: 'File Manager',
                type: 'system',
                slices: ['file', 'ui'].filter(slice => state[slice])
            });
        }
        
        // Detect preview subscriptions
        if (state.preview) {
            components.push({
                name: 'Preview System',
                type: 'system',
                slices: ['preview', 'file'].filter(slice => state[slice])
            });
        }
        
        return components;
    }

    renderDataFlowAnalysis(state, stateKeys) {
        const flows = [];
        
        // Analyze typical Redux patterns
        stateKeys.forEach(sliceKey => {
            const sliceData = state[sliceKey];
            
            if (sliceData && typeof sliceData === 'object') {
                // Check for loading states
                if (sliceData.loading !== undefined) {
                    flows.push(`${sliceKey} → implements async loading pattern`);
                }
                
                // Check for error states
                if (sliceData.error !== undefined) {
                    flows.push(`${sliceKey} → implements error handling`);
                }
                
                // Check for cached data
                if (sliceData.cache || sliceData.cached) {
                    flows.push(`${sliceKey} → implements data caching`);
                }
                
                // Check for timestamps
                if (sliceData.lastUpdated || sliceData.timestamp) {
                    flows.push(`${sliceKey} → tracks data freshness`);
                }
            }
        });
        
        return flows.length > 0 ? 
            `<ul class="flow-list">${flows.map(flow => `<li>${flow}</li>`).join('')}</ul>` :
            '<div class="no-flows">No data flow patterns detected</div>';
    }

    renderSliceHealthMonitor(state, stateKeys) {
        const healthMetrics = this.analyzeSliceHealth(state, stateKeys);
        const performanceIssues = this.detectPerformanceIssues(state, stateKeys);
        const memoryAnalysis = this.analyzeMemoryUsage(state, stateKeys);
        
        return `
            <div class="health-monitor">
                <div class="health-section">
                    <h4 class="health-title">Performance Metrics</h4>
                    <div class="performance-grid">
                        ${healthMetrics.map(metric => `
                            <div class="performance-card ${metric.severity}">
                                <div class="metric-header">
                                    <span class="metric-name">${metric.slice}</span>
                                    <span class="metric-status ${metric.severity}">
                                        ${metric.severity === 'critical' ? '🔴' : 
                                          metric.severity === 'warning' ? '🟡' : '🟢'}
                                    </span>
                                </div>
                                <div class="metric-details">
                                    <div class="metric-row">
                                        <span>Size:</span>
                                        <span class="metric-value">${this.formatBytes(metric.size)}</span>
                                    </div>
                                    <div class="metric-row">
                                        <span>Complexity:</span>
                                        <span class="metric-value">${metric.complexity}</span>
                                    </div>
                                    <div class="metric-row">
                                        <span>Depth:</span>
                                        <span class="metric-value">${metric.depth}</span>
                                    </div>
                                </div>
                                ${metric.issues.length > 0 ? `
                                    <div class="metric-issues">
                                        ${metric.issues.map(issue => `
                                            <div class="issue-item ${issue.type}">
                                                <span class="issue-icon">${issue.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                                                <span class="issue-text">${issue.message}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="health-section">
                    <h4 class="health-title">Memory Analysis</h4>
                    <div class="memory-analysis">
                        <div class="memory-chart">
                            ${memoryAnalysis.slices.map(slice => `
                                <div class="memory-bar-container">
                                    <div class="memory-bar-label">
                                        <span>${slice.name}</span>
                                        <span>${this.formatBytes(slice.size)}</span>
                                    </div>
                                    <div class="memory-bar">
                                        <div class="memory-bar-fill" style="width: ${slice.percentage}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="memory-summary">
                            <div class="memory-stat">
                                <span class="stat-label">Total:</span>
                                <span class="stat-value">${this.formatBytes(memoryAnalysis.total)}</span>
                            </div>
                            <div class="memory-stat">
                                <span class="stat-label">Largest:</span>
                                <span class="stat-value">${memoryAnalysis.largest.name} (${this.formatBytes(memoryAnalysis.largest.size)})</span>
                            </div>
                            <div class="memory-stat">
                                <span class="stat-label">Average:</span>
                                <span class="stat-value">${this.formatBytes(memoryAnalysis.average)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="health-section">
                    <h4 class="health-title">Detected Issues</h4>
                    <div class="issues-list">
                        ${performanceIssues.length > 0 ? performanceIssues.map(issue => `
                            <div class="issue-card ${issue.severity}">
                                <div class="issue-header">
                                    <span class="issue-type">${issue.type}</span>
                                    <span class="issue-severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                                </div>
                                <div class="issue-description">${issue.description}</div>
                                <div class="issue-recommendation">
                                    <strong>Recommendation:</strong> ${issue.recommendation}
                                </div>
                                ${issue.affectedSlices.length > 0 ? `
                                    <div class="affected-slices">
                                        <strong>Affected slices:</strong>
                                        ${issue.affectedSlices.map(slice => `<span class="slice-tag">${slice}</span>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('') : '<div class="no-issues">No performance issues detected! 🎉</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    analyzeSliceHealth(state, stateKeys) {
        return stateKeys.map(sliceKey => {
            const sliceData = state[sliceKey];
            const size = JSON.stringify(sliceData).length;
            const complexity = this.calculateComplexity(sliceData);
            const depth = this.calculateDepth(sliceData);
            const issues = [];

            // Determine severity based on metrics
            let severity = 'healthy';
            if (size > 50000) {
                severity = 'critical';
                issues.push({
                    type: 'error',
                    message: 'Slice is very large (>50KB)'
                });
            } else if (size > 20000) {
                severity = 'warning';
                issues.push({
                    type: 'warning',
                    message: 'Slice is getting large (>20KB)'
                });
            }

            if (depth > 8) {
                severity = severity === 'healthy' ? 'warning' : severity;
                issues.push({
                    type: 'warning',
                    message: `Deep nesting detected (${depth} levels)`
                });
            }

            if (complexity > 100) {
                severity = severity === 'healthy' ? 'warning' : severity;
                issues.push({
                    type: 'warning',
                    message: 'High complexity score'
                });
            }

            return {
                slice: sliceKey,
                size,
                complexity,
                depth,
                severity,
                issues
            };
        });
    }

    calculateComplexity(data, visited = new Set()) {
        if (data === null || data === undefined || typeof data !== 'object') {
            return 1;
        }

        // Prevent infinite recursion
        if (visited.has(data)) {
            return 1;
        }
        visited.add(data);

        let complexity = 1;
        
        if (Array.isArray(data)) {
            complexity += data.length;
            data.forEach(item => {
                complexity += this.calculateComplexity(item, visited);
            });
        } else {
            const keys = Object.keys(data);
            complexity += keys.length;
            keys.forEach(key => {
                complexity += this.calculateComplexity(data[key], visited);
            });
        }

        visited.delete(data);
        return complexity;
    }

    calculateDepth(data, currentDepth = 0) {
        if (data === null || data === undefined || typeof data !== 'object') {
            return currentDepth;
        }

        let maxDepth = currentDepth;
        
        if (Array.isArray(data)) {
            data.forEach(item => {
                maxDepth = Math.max(maxDepth, this.calculateDepth(item, currentDepth + 1));
            });
        } else {
            Object.values(data).forEach(value => {
                maxDepth = Math.max(maxDepth, this.calculateDepth(value, currentDepth + 1));
            });
        }

        return maxDepth;
    }

    analyzeMemoryUsage(state, stateKeys) {
        const slices = stateKeys.map(sliceKey => {
            const size = JSON.stringify(state[sliceKey]).length;
            return { name: sliceKey, size };
        });

        const total = slices.reduce((sum, slice) => sum + slice.size, 0);
        const largest = slices.reduce((max, slice) => slice.size > max.size ? slice : max, slices[0]);
        const average = total / slices.length;

        // Calculate percentages for visualization
        slices.forEach(slice => {
            slice.percentage = total > 0 ? (slice.size / total) * 100 : 0;
        });

        // Sort by size for better visualization
        slices.sort((a, b) => b.size - a.size);

        return {
            slices,
            total,
            largest,
            average
        };
    }

    detectPerformanceIssues(state, stateKeys) {
        const issues = [];
        const totalSize = JSON.stringify(state).length;

        // Check for oversized state
        if (totalSize > 100000) {
            issues.push({
                type: 'Memory Usage',
                severity: 'critical',
                description: `Total Redux state is very large (${this.formatBytes(totalSize)}). This can impact performance.`,
                recommendation: 'Consider normalizing data, removing unused properties, or implementing data pagination.',
                affectedSlices: stateKeys.filter(key => JSON.stringify(state[key]).length > 20000)
            });
        }

        // Check for circular references
        stateKeys.forEach(sliceKey => {
            try {
                JSON.stringify(state[sliceKey]);
            } catch (error) {
                if (error.message.includes('circular')) {
                    issues.push({
                        type: 'Circular Reference',
                        severity: 'critical',
                        description: `Circular reference detected in ${sliceKey} slice.`,
                        recommendation: 'Remove circular references to prevent serialization issues.',
                        affectedSlices: [sliceKey]
                    });
                }
            }
        });

        // Check for deeply nested structures
        const deepSlices = stateKeys.filter(sliceKey => {
            return this.calculateDepth(state[sliceKey]) > 6;
        });

        if (deepSlices.length > 0) {
            issues.push({
                type: 'Deep Nesting',
                severity: 'warning',
                description: 'Some slices have deeply nested structures that may impact performance.',
                recommendation: 'Consider flattening data structures or using normalization patterns.',
                affectedSlices: deepSlices
            });
        }

        // Check for duplicate data
        const duplicateIssues = this.detectDuplicateData(state, stateKeys);
        issues.push(...duplicateIssues);

        return issues;
    }

    detectDuplicateData(state, stateKeys) {
        const issues = [];
        const dataHashes = new Map();

        stateKeys.forEach(sliceKey => {
            const sliceData = state[sliceKey];
            if (sliceData && typeof sliceData === 'object') {
                const dataString = JSON.stringify(sliceData);
                const hash = this.simpleHash(dataString);
                
                if (dataHashes.has(hash)) {
                    const existingSlice = dataHashes.get(hash);
                    issues.push({
                        type: 'Duplicate Data',
                        severity: 'warning',
                        description: `Potential duplicate data detected between ${existingSlice} and ${sliceKey}.`,
                        recommendation: 'Consider normalizing shared data or using references.',
                        affectedSlices: [existingSlice, sliceKey]
                    });
                } else {
                    dataHashes.set(hash, sliceKey);
                }
            }
        });

        return issues;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    addUIInspectorStyles() {
        if (document.getElementById('ui-inspector-styles')) return;

        const style = document.createElement('style');
        style.id = 'ui-inspector-styles';
        style.textContent = `
            /* Slice Overview Dashboard Styles */
            .slice-overview-dashboard {
                padding: var(--space-2);
            }

            .dashboard-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: var(--space-2);
                margin-bottom: var(--space-3);
            }

            .summary-card {
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                padding: var(--space-2);
                text-align: center;
                transition: all 0.15s ease;
            }

            .summary-card.error {
                border-color: var(--color-danger);
                background: rgba(220, 53, 69, 0.1);
            }

            .summary-card.loading {
                border-color: var(--color-warning);
                background: rgba(255, 193, 7, 0.1);
            }

            .summary-value {
                font-size: var(--font-size-lg);
                font-weight: var(--font-weight-bold);
                color: var(--color-text);
                line-height: 1.2;
            }

            .summary-label {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                margin-top: 2px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

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

            .table-row.error {
                background: rgba(220, 53, 69, 0.05);
            }

            .table-row.loading {
                background: rgba(255, 193, 7, 0.05);
            }

            .slice-name {
                font-weight: var(--font-weight-medium);
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
                font-size: 14px;
            }

            /* Dependency Map Styles */
            .dependency-map {
                padding: var(--space-2);
            }

            .dependency-section {
                margin-bottom: var(--space-4);
                padding-bottom: var(--space-3);
                border-bottom: 1px solid var(--color-border);
            }

            .dependency-section:last-child {
                border-bottom: none;
            }

            .dependency-title {
                font-size: var(--font-size-sm);
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
                border-color: var(--color-primary-light);
            }

            .dependency-source,
            .dependency-target {
                font-weight: var(--font-weight-medium);
                color: var(--color-text);
                padding: 4px 8px;
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
                gap: 2px;
            }

            .arrow-line {
                width: 30px;
                height: 1px;
                background: var(--color-border);
            }

            .arrow-head {
                color: var(--color-text-secondary);
                font-size: 12px;
            }

            .dependency-type {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                background: var(--color-bg-alt);
                padding: 1px 4px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
            }

            .component-subscriptions {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .subscription-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                transition: all 0.15s ease;
            }

            .subscription-item:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary-light);
            }

            .component-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .component-name {
                font-weight: var(--font-weight-medium);
                color: var(--color-text);
                font-size: var(--font-size-sm);
            }

            .component-type {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .subscribed-slices {
                display: flex;
                gap: var(--space-1);
                flex-wrap: wrap;
            }

            .slice-tag {
                font-size: var(--font-size-xs);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                background: var(--color-bg);
                color: var(--color-text-secondary);
                font-family: var(--font-family-mono);
            }

            .slice-tag.ready {
                border-color: var(--color-success);
                background: rgba(40, 167, 69, 0.1);
                color: var(--color-success);
            }

            .slice-tag.error {
                border-color: var(--color-danger);
                background: rgba(220, 53, 69, 0.1);
                color: var(--color-danger);
            }

            .slice-tag.loading {
                border-color: var(--color-warning);
                background: rgba(255, 193, 7, 0.1);
                color: var(--color-warning);
            }

            .data-flow {
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
            }

            .flow-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .flow-list li {
                padding: var(--space-1) 0;
                font-size: var(--font-size-sm);
                color: var(--color-text-secondary);
                border-bottom: 1px solid var(--color-border);
            }

            .flow-list li:last-child {
                border-bottom: none;
            }

            .no-dependencies,
            .no-subscriptions,
            .no-flows {
                text-align: center;
                color: var(--color-text-secondary);
                font-style: italic;
                padding: var(--space-3);
                background: var(--color-bg-alt);
                border: 1px dashed var(--color-border);
                border-radius: var(--radius-base);
            }

            /* Health Monitor Styles */
            .health-monitor {
                padding: var(--space-2);
            }

            .health-section {
                margin-bottom: var(--space-4);
                padding-bottom: var(--space-3);
                border-bottom: 1px solid var(--color-border);
            }

            .health-section:last-child {
                border-bottom: none;
            }

            .health-title {
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-semibold);
                color: var(--color-text);
                margin: 0 0 var(--space-2) 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .performance-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: var(--space-2);
            }

            .performance-card {
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                padding: var(--space-2);
                transition: all 0.15s ease;
            }

            .performance-card:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary-light);
            }

            .performance-card.warning {
                border-color: var(--color-warning);
                background: rgba(255, 193, 7, 0.05);
            }

            .performance-card.critical {
                border-color: var(--color-danger);
                background: rgba(220, 53, 69, 0.05);
            }

            .metric-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--space-2);
                padding-bottom: var(--space-1);
                border-bottom: 1px solid var(--color-border);
            }

            .metric-name {
                font-weight: var(--font-weight-bold);
                color: var(--color-text);
                font-size: var(--font-size-sm);
            }

            .metric-status {
                font-size: 16px;
            }

            .metric-details {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
                margin-bottom: var(--space-2);
            }

            .metric-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: var(--font-size-xs);
            }

            .metric-value {
                font-family: var(--font-family-mono);
                color: var(--color-text-secondary);
                font-weight: var(--font-weight-medium);
            }

            .metric-issues {
                border-top: 1px solid var(--color-border);
                padding-top: var(--space-1);
            }

            .issue-item {
                display: flex;
                align-items: center;
                gap: var(--space-1);
                padding: 2px 0;
                font-size: var(--font-size-xs);
            }

            .issue-icon {
                font-size: 12px;
            }

            .issue-text {
                color: var(--color-text-secondary);
            }

            .memory-analysis {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: var(--space-3);
            }

            .memory-chart {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .memory-bar-container {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .memory-bar-label {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
            }

            .memory-bar {
                height: 8px;
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
                overflow: hidden;
            }

            .memory-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
                transition: width 0.3s ease;
            }

            .memory-summary {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                height: fit-content;
            }

            .memory-stat {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: var(--font-size-xs);
            }

            .stat-label {
                color: var(--color-text-secondary);
                font-weight: var(--font-weight-medium);
            }

            .stat-value {
                font-family: var(--font-family-mono);
                color: var(--color-text);
                font-weight: var(--font-weight-bold);
            }

            .issues-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .issue-card {
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                padding: var(--space-2);
                transition: all 0.15s ease;
            }

            .issue-card:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary-light);
            }

            .issue-card.warning {
                border-color: var(--color-warning);
                background: rgba(255, 193, 7, 0.05);
            }

            .issue-card.critical {
                border-color: var(--color-danger);
                background: rgba(220, 53, 69, 0.05);
            }

            .issue-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--space-1);
            }

            .issue-type {
                font-weight: var(--font-weight-bold);
                color: var(--color-text);
                font-size: var(--font-size-sm);
            }

            .issue-severity {
                font-size: var(--font-size-xs);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                font-weight: var(--font-weight-bold);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .issue-severity.warning {
                background: var(--color-warning);
                color: white;
            }

            .issue-severity.critical {
                background: var(--color-danger);
                color: white;
            }

            .issue-description {
                font-size: var(--font-size-sm);
                color: var(--color-text);
                margin-bottom: var(--space-1);
                line-height: 1.4;
            }

            .issue-recommendation {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                margin-bottom: var(--space-1);
                line-height: 1.4;
            }

            .affected-slices {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                display: flex;
                align-items: center;
                gap: var(--space-1);
                flex-wrap: wrap;
            }

            .no-issues {
                text-align: center;
                color: var(--color-success);
                font-weight: var(--font-weight-bold);
                padding: var(--space-3);
                background: rgba(40, 167, 69, 0.1);
                border: 1px solid var(--color-success);
                border-radius: var(--radius-base);
                font-size: var(--font-size-sm);
            }

            /* === Redux Accordion Design System === */
            
            #redux-status .dp-redux-overview {
                margin-bottom: var(--space-3);
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border-radius: var(--radius-base);
                border: 1px solid var(--color-border);
            }

            #redux-status .dp-redux-accordion {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
                list-style: none !important;
                padding: 0 !important;
                margin: 0 !important;
            }

            /* Slice Item Container */
            #redux-status .dp-slice-item {
                border: 1px solid var(--color-border) !important;
                border-radius: var(--radius-base) !important;
                background: var(--color-bg) !important;
                overflow: hidden;
                transition: all 0.2s ease;
                list-style: none !important;
                margin: 0 !important;
                padding: 0 !important;
                display: block !important;
            }

            #redux-status .dp-slice-item:hover {
                border-color: var(--color-border-hover, var(--color-primary-light));
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            #redux-status .dp-slice-item.expanded {
                border-color: var(--color-primary);
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }

            /* Slice Header */
            #redux-status .dp-slice-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-3);
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s ease;
                min-height: 56px;
            }

            #redux-status .dp-slice-header:hover {
                background: var(--color-bg-hover);
            }

            #redux-status .dp-slice-item.expanded .dp-slice-header {
                background: var(--color-bg-alt);
                border-bottom: 1px solid var(--color-border);
            }

            #redux-status .dp-slice-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
                min-width: 0;
            }

            #redux-status .dp-slice-name {
                font-weight: 600;
                font-size: var(--font-size-base);
                color: var(--color-fg);
                line-height: 1.2;
            }

            #redux-status .dp-slice-meta {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                flex-wrap: wrap;
            }

            #redux-status .dp-slice-type {
                font-size: var(--font-size-xs);
                color: var(--color-fg-muted);
                background: var(--color-bg-alt);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                font-weight: 500;
            }

            #redux-status .dp-slice-size {
                font-size: var(--font-size-xs);
                color: var(--color-fg-muted);
                font-family: var(--font-family-mono, 'SF Mono', Consolas, monospace);
                opacity: 0.8;
            }

            #redux-status .dp-slice-count {
                font-size: var(--font-size-xs);
                color: var(--color-primary);
                font-weight: 500;
            }

            #redux-status .dp-slice-controls {
                display: flex;
                align-items: center;
                gap: var(--space-2);
            }

            #redux-status .dp-slice-status {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--color-success);
            }

            #redux-status .dp-slice-status.loading {
                background: var(--color-warning);
                animation: pulse 1.5s ease-in-out infinite;
            }

            #redux-status .dp-slice-status.error {
                background: var(--color-danger);
            }

            #redux-status .dp-slice-status.pending {
                background: var(--color-text-secondary);
            }

            #redux-status .dp-slice-status.empty {
                background: var(--color-border);
            }

            #redux-status .dp-slice-icon {
                font-size: 10px;
                color: var(--color-fg-muted);
                transition: transform 0.2s ease;
                width: 12px;
                text-align: center;
            }

            #redux-status .dp-slice-item.expanded .dp-slice-icon {
                transform: rotate(90deg);
            }

            /* Slice Content */
            #redux-status .dp-slice-content {
                padding: var(--space-3);
                border-top: 1px solid var(--color-border);
                background: var(--color-bg);
                transition: all 0.2s ease;
            }

            #redux-status .dp-slice-content.collapsed {
                display: none;
            }

            /* Animations */
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
}

export function createUIInspectorPanel(config = {}) {
    return new UIInspectorPanel(config);
}

panelRegistry.registerType('ui-inspector', UIInspectorPanel);
