/**
 * DiagnosticPanel.js - Example diagnostic panel implementation
 * 
 * Demonstrates how to extend BasePanel for specific functionality
 */

import { BasePanel, panelRegistry } from './BasePanel.js';
import { appStore } from '../appState.js';
import { JsonViewer } from '../components/JsonViewer.js';

export class DiagnosticPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'diagnostic',
            title: 'System Diagnostics',
            defaultWidth: 600,
            defaultHeight: 400,
            ...config
        });
        
        this.refreshInterval = null;
        this.diagnosticData = {};
        this.jsonViewer = new JsonViewer();
    }

    renderContent() {
        return `
            <div class="devpages-panel-content">
                <!-- Panel Toolbar -->
                <div class="devpages-panel-toolbar">
                    <button id="refresh-diagnostics" class="devpages-btn-ghost devpages-btn-primary">
                        <span>↻</span>
                        <span>Refresh</span>
                    </button>
                </div>

                <!-- Diagnostic Sections -->
                <div class="devpages-panel-sections">
                    <!-- System Overview Section -->
                    <div class="devpages-panel-row collapsed" data-section="system">
                        <div class="devpages-panel-row-header" data-toggle="system">
                            <span class="devpages-panel-row-icon">▶</span>
                            <span class="devpages-panel-row-title">System Overview</span>
                            <span class="devpages-type-badge" id="system-badge">●</span>
                        </div>
                        <div class="devpages-panel-row-content" id="system-content">
                            <div class="devpages-panel-subsection collapsed">
                                <div class="devpages-panel-subsection-header" data-toggle="system-status">
                                    <span class="devpages-panel-subsection-icon">▶</span>
                                    <span class="devpages-panel-subsection-title">Status</span>
                                </div>
                                <div class="devpages-panel-subsection-content collapsed" id="system-status">Loading...</div>
                            </div>
                            <div class="devpages-panel-subsection collapsed">
                                <div class="devpages-panel-subsection-header" data-toggle="system-health">
                                    <span class="devpages-panel-subsection-icon">▶</span>
                                    <span class="devpages-panel-subsection-title">Health Checks</span>
                                </div>
                                <div class="devpages-panel-subsection-content collapsed" id="system-health">Loading...</div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Section -->
                    <div class="devpages-panel-row collapsed" data-section="performance">
                        <div class="devpages-panel-row-header" data-toggle="performance">
                            <span class="devpages-panel-row-icon">▶</span>
                            <span class="devpages-panel-row-title">Performance</span>
                            <span class="devpages-type-badge" id="performance-badge">●</span>
                        </div>
                        <div class="devpages-panel-row-content" id="performance-content">
                            <div class="devpages-panel-subsection collapsed">
                                <div class="devpages-panel-subsection-header" data-toggle="performance-metrics">
                                    <span class="devpages-panel-subsection-icon">▶</span>
                                    <span class="devpages-panel-subsection-title">Metrics</span>
                                </div>
                                <div class="devpages-panel-subsection-content collapsed" id="performance-metrics">Loading...</div>
                            </div>
                            <div class="devpages-panel-subsection collapsed">
                                <div class="devpages-panel-subsection-header" data-toggle="performance-memory">
                                    <span class="devpages-panel-subsection-icon">▶</span>
                                    <span class="devpages-panel-subsection-title">Memory Usage</span>
                                </div>
                                <div class="devpages-panel-subsection-content collapsed" id="performance-memory">Loading...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container = null) {
        console.log('[DiagnosticPanel] onMount called', { container });
        
        // Set container if provided
        if (container) {
            this.sidebarContainer = container;
        }

        // Call parent onMount
        super.onMount(container);

        // Add diagnostic-specific styles
        this.addDiagnosticStyles();

        // Attach listeners to the correct container
        this.attachDiagnosticListeners();
        this.attachCollapseListeners();
        this.refreshDiagnostics();
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

    escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    isStringifiedJson(str) {
        if (typeof str !== 'string') {
            return false;
        }
        const trimmed = str.trim();
        if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
            return false;
        }

        try {
            const parsed = JSON.parse(str);
            return typeof parsed === 'object' && parsed !== null;
        } catch (e) {
            return false;
        }
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
            // Handle slice header clicks
            const sliceHeader = e.target.closest('.devpages-slice-header');
            if (sliceHeader) {
                const sliceKey = sliceHeader.dataset.toggleSlice;
                const sliceItem = sliceHeader.closest('.devpages-slice-item');
                const sliceContent = sliceItem.querySelector('.devpages-slice-content');
                const sliceIcon = sliceHeader.querySelector('.devpages-slice-icon');

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
                return;
            }
        });
    }

    attachCollapseListeners() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[DiagnosticPanel] No container found for collapse listeners');
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

    attachDiagnosticListeners() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[DiagnosticPanel] No container found for attaching listeners');
            return;
        }

        // Find buttons within the container
        const refreshBtn = container.querySelector('#refresh-diagnostics');

        refreshBtn?.addEventListener('click', () => {
            this.refreshDiagnostics();
        });
    }

    refreshDiagnostics() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[DiagnosticPanel] No container found for refreshing diagnostics');
            return;
        }

        this.updateSystemStatus(container);
        this.updatePerformanceMetrics(container);
    }

    updateSystemStatus(container) {
        const systemStatus = {
            timestamp: new Date().toLocaleString(),
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
            } : 'Not available',
            online: navigator.onLine,
            cookiesEnabled: navigator.cookieEnabled
        };

        const statusContainer = container.querySelector('#system-status');
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="dp-data-grid">
                    <span class="dp-data-label">Timestamp:</span>
                    <span class="dp-data-value">${this.escapeHtml(systemStatus.timestamp)}</span>
                    <span class="dp-data-label">Viewport:</span>
                    <span class="dp-data-value">${this.escapeHtml(systemStatus.viewport)}</span>
                    <span class="dp-data-label">Online:</span>
                    <span class="dp-data-value">${systemStatus.online ? '✅' : '❌'}</span>
                    <span class="dp-data-label">Cookies:</span>
                    <span class="dp-data-value">${systemStatus.cookiesEnabled ? '✅' : '❌'}</span>
                    ${typeof systemStatus.memory === 'object' ? `
                        <span class="dp-data-label">Memory Used:</span>
                        <span class="dp-data-value">${this.escapeHtml(systemStatus.memory.used)}</span>
                        <span class="dp-data-label">Memory Total:</span>
                        <span class="dp-data-value">${this.escapeHtml(systemStatus.memory.total)}</span>
                    ` : `
                        <span class="dp-data-label">Memory:</span>
                        <span class="dp-data-value">${this.escapeHtml(systemStatus.memory)}</span>
                    `}
                </div>
            `;
        }
    }

    updatePerformanceMetrics(container) {
        const metrics = {
            loadTime: performance.timing ? 
                performance.timing.loadEventEnd - performance.timing.navigationStart : 'N/A',
            domContentLoaded: performance.timing ?
                performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : 'N/A',
            entries: performance.getEntriesByType('navigation').length,
            resources: performance.getEntriesByType('resource').length
        };

        const metricsContainer = container.querySelector('#performance-metrics');
        if (metricsContainer) {
            metricsContainer.innerHTML = `
                <div class="dp-data-grid">
                    <span class="dp-data-label">Page Load:</span>
                    <span class="dp-data-value">${metrics.loadTime}ms</span>
                    <span class="dp-data-label">DOM Ready:</span>
                    <span class="dp-data-value">${metrics.domContentLoaded}ms</span>
                    <span class="dp-data-label">Navigation:</span>
                    <span class="dp-data-value">${metrics.entries}</span>
                    <span class="dp-data-label">Resources:</span>
                    <span class="dp-data-value">${metrics.resources}</span>
                </div>
            `;
        }
    }


    addDiagnosticStyles() {
        if (document.getElementById('diagnostic-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'diagnostic-panel-styles';
        style.textContent = `
            /* === Diagnostic Panel Design System === */
            
            /* Container */
            .devpages-panel-content {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-size: var(--devpages-panel-font-size-compact);
                font-family: var(--devpages-panel-font-mono);
                line-height: var(--devpages-panel-line-height-tight);
                background: var(--devpages-panel-bg);
            }

            /* Toolbar */
            .devpages-panel-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--devpages-panel-toolbar-padding);
                background: var(--devpages-panel-toolbar-bg);
                border-bottom: var(--devpages-panel-toolbar-border);
                height: var(--devpages-panel-toolbar-height);
                gap: var(--devpages-panel-gap);
            }

            /* Sections */
            .devpages-panel-sections {
                flex: 1;
                overflow-y: auto;
                padding: var(--space-3);
            }

            /* Panel Rows */
            .devpages-panel-row {
                margin-bottom: var(--space-3);
                border: var(--devpages-panel-border);
                border-radius: var(--radius-lg);
                background: var(--color-bg);
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .devpages-panel-row:last-child {
                margin-bottom: 0;
            }

            .devpages-panel-row-header {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-3);
                background: var(--devpages-panel-table-header-bg);
                border-bottom: var(--devpages-panel-table-border);
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s ease;
                min-height: 40px;
            }

            .devpages-panel-row-header:hover {
                background: var(--devpages-panel-table-hover-bg);
            }

            .devpages-panel-row-icon {
                font-size: 8px;
                line-height: 1;
                width: 10px;
                text-align: center;
                transition: transform 0.15s ease;
            }

            .devpages-panel-row.collapsed .devpages-panel-row-icon {
                transform: rotate(-90deg);
            }

            .devpages-panel-row-title {
                flex: 1;
                font-weight: var(--font-weight-semibold);
                font-size: var(--font-size-base);
                color: var(--color-text);
            }

            .devpages-panel-row-content {
                padding: var(--space-3);
                transition: all 0.2s ease;
            }

            .devpages-panel-row.collapsed .devpages-panel-row-content {
                display: none;
            }

            /* Subsections */
            .devpages-panel-subsection {
                margin-bottom: var(--space-3);
            }

            .devpages-panel-subsection:last-child {
                margin-bottom: 0;
            }

            .devpages-panel-subsection-header {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-2);
                cursor: pointer;
                user-select: none;
                border-radius: var(--radius-base);
                transition: background-color 0.15s ease;
                min-height: 32px;
            }

            .devpages-panel-subsection-header:hover {
                background: var(--color-bg-hover);
            }

            .devpages-panel-subsection-icon {
                font-size: 7px;
                line-height: 1;
                width: 8px;
                text-align: center;
                transition: transform 0.15s ease;
                opacity: 0.7;
            }

            .devpages-panel-subsection.collapsed .devpages-panel-subsection-icon {
                transform: rotate(-90deg);
            }

            .devpages-panel-subsection-title {
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-medium);
                color: var(--color-text);
            }

            .devpages-panel-subsection-content {
                padding-left: calc(8px + var(--space-2) + var(--space-2));
                margin-top: var(--space-2);
                font-size: var(--font-size-sm);
                line-height: 1.4;
                transition: all 0.2s ease;
            }

            .devpages-panel-subsection-content.collapsed {
                display: none;
            }

            /* Content Styling */
            .dp-data-grid {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: var(--space-2) var(--space-3);
                font-size: var(--font-size-sm);
                align-items: baseline;
            }

            .dp-data-label {
                font-weight: var(--font-weight-medium);
                color: var(--color-text-secondary);
                white-space: nowrap;
            }

            .dp-data-value {
                font-family: var(--font-family-mono);
                color: var(--color-text);
                word-break: break-word;
            }

            .dp-component-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .dp-component-item {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                padding: var(--space-3);
                border-radius: var(--radius-base);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                font-size: var(--font-size-sm);
                min-height: 48px;
                gap: var(--space-3);
                transition: background-color 0.15s ease;
            }

            .dp-component-item:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-border-hover, var(--color-border));
            }

            .dp-component-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }

            .dp-component-name {
                font-weight: var(--font-weight-bold);
                font-size: var(--font-size-sm);
                color: var(--color-text);
                line-height: 1.2;
            }

            .dp-component-type {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                opacity: 0.8;
                font-family: var(--font-family-mono);
            }

            .dp-component-status {
                padding: 4px 8px;
                border-radius: var(--radius-base);
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-semibold);
                background: var(--color-success);
                color: white;
                white-space: nowrap;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                min-width: 60px;
                text-align: center;
            }

            .dp-component-status.warning {
                background: var(--color-warning);
            }

            .dp-component-status.error {
                background: var(--color-danger);
            }

            /* State Display */
            .dp-state-summary {
                font-family: var(--font-family-mono);
                font-size: var(--devpages-panel-font-size-sm);
                background: var(--color-bg-alt);
                padding: var(--devpages-panel-gap-sm);
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
            }

            /* Scrollbar */
            .devpages-panel-sections::-webkit-scrollbar {
                width: 4px;
            }

            .devpages-panel-sections::-webkit-scrollbar-track {
                background: transparent;
            }

            .devpages-panel-sections::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 2px;
            }

            .devpages-panel-sections::-webkit-scrollbar-thumb:hover {
                background: var(--color-text-secondary);
            }

            /* === Redux Accordion Design System === */
            
            .dp-redux-overview {
                margin-bottom: var(--space-3);
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border-radius: var(--radius-base);
                border: 1px solid var(--color-border);
            }

            .dp-redux-accordion {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            /* Slice Item Container */
            .devpages-slice-item {
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                background: var(--color-bg);
                overflow: hidden;
                transition: all 0.2s ease;
            }

            .devpages-slice-item:hover {
                border-color: var(--color-border-hover, var(--color-primary-light));
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .devpages-slice-item.expanded {
                border-color: var(--color-primary);
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }

            /* Slice Header */
            .devpages-slice-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-3);
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s ease;
                min-height: 56px;
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
                gap: var(--space-1);
                min-width: 0;
            }

            .devpages-slice-name {
                font-weight: var(--font-weight-bold);
                font-size: var(--font-size-base);
                color: var(--color-text);
                line-height: 1.2;
            }

            .devpages-slice-meta {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                flex-wrap: wrap;
            }

            .devpages-slice-type {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                background: var(--color-bg-alt);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                font-weight: var(--font-weight-medium);
            }

            .devpages-slice-size {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                font-family: var(--font-family-mono);
                opacity: 0.8;
            }

            .devpages-slice-count {
                font-size: var(--font-size-xs);
                color: var(--color-primary);
                font-weight: var(--font-weight-medium);
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
                background: var(--color-success);
            }

            .devpages-slice-status.loading {
                background: var(--color-warning);
                animation: pulse 1.5s ease-in-out infinite;
            }

            .devpages-slice-status.error {
                background: var(--color-danger);
            }

            .devpages-slice-status.pending {
                background: var(--color-text-secondary);
            }

            .devpages-slice-status.empty {
                background: var(--color-border);
            }

            .devpages-slice-icon {
                font-size: 10px;
                color: var(--color-text-secondary);
                transition: transform 0.2s ease;
                width: 12px;
                text-align: center;
            }

            .devpages-slice-item.expanded .devpages-slice-icon {
                transform: rotate(90deg);
            }

            /* Slice Content */
            .devpages-slice-content {
                padding: var(--space-3);
                border-top: 1px solid var(--color-border);
                background: var(--color-bg);
                transition: all 0.2s ease;
            }

            .devpages-slice-content.collapsed {
                display: none;
            }

            /* Slice Properties Grid */
            .devpages-slice-props-grid {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
                margin-bottom: var(--space-3);
            }

            .devpages-slice-prop {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: var(--space-2);
                align-items: center;
                padding: var(--space-1) var(--space-2);
                background: var(--color-bg-alt);
                border-radius: var(--radius-sm);
                font-size: var(--font-size-xs);
                min-height: 28px;
            }

            .devpages-slice-prop-key {
                font-weight: var(--font-weight-medium);
                color: var(--color-text);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .devpages-slice-prop-type {
                font-size: 10px;
                color: var(--color-text-secondary);
                background: var(--color-bg);
                padding: 1px 4px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                font-family: var(--font-family-mono);
                text-align: center;
                min-width: 50px;
            }

            .devpages-slice-prop-value {
                font-family: var(--font-family-mono);
                color: var(--color-text-secondary);
                text-align: right;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .devpages-slice-more {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                text-align: center;
                padding: var(--space-1);
                font-style: italic;
            }

            .devpages-slice-primitive,
            .devpages-slice-empty {
                font-family: var(--font-family-mono);
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                padding: var(--space-2);
                background: var(--color-bg-alt);
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                margin-bottom: var(--space-3);
            }

            /* Raw Data Section */
            .devpages-slice-raw {
                margin-top: var(--space-2);
            }

            .devpages-slice-raw summary {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                cursor: pointer;
                padding: var(--space-1);
                border-radius: var(--radius-sm);
                transition: background-color 0.15s ease;
            }

            .devpages-slice-raw summary:hover {
                background: var(--color-bg-hover);
            }

            /* Animations */
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* === Generic JSON Viewer Components === */
            
            /* JSON Object/Array Headers */
            .dp-json-object-header,
            .dp-json-array-header {
                display: flex;
                align-items: center;
                gap: var(--space-1);
                padding: var(--space-1) var(--space-2);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
                cursor: pointer;
                user-select: none;
                transition: background-color 0.15s ease;
                margin-bottom: var(--space-1);
            }

            .dp-json-object-header:hover,
            .dp-json-array-header:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary-light);
            }

            .dp-json-expand-icon {
                font-size: 8px;
                color: var(--color-text-secondary);
                transition: transform 0.15s ease;
                width: 10px;
                text-align: center;
            }

            .dp-json-object-label,
            .dp-json-array-label {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-medium);
                color: var(--color-text-secondary);
            }

            .dp-json-object-count,
            .dp-json-array-count {
                font-size: var(--font-size-xs);
                color: var(--color-primary);
                font-family: var(--font-family-mono);
                margin-left: auto;
            }

            /* JSON Content Areas */
            .dp-json-object-content,
            .dp-json-array-content {
                transition: all 0.2s ease;
                overflow: hidden;
            }

            .dp-json-object-content.collapsed,
            .dp-json-array-content.collapsed {
                display: none;
            }

            .dp-json-nested {
                margin-left: var(--space-2);
                border-left: 2px solid var(--color-border);
                padding-left: var(--space-2);
            }

            /* JSON Properties */
            .dp-json-props-grid {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .dp-json-prop {
                border-radius: var(--radius-sm);
                transition: background-color 0.15s ease;
            }

            .dp-json-prop-expandable {
                cursor: pointer;
            }

            .dp-json-prop-expandable:hover {
                background: var(--color-bg-hover);
            }

            .dp-json-prop-header {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: var(--space-2);
                align-items: center;
                padding: var(--space-1) var(--space-2);
                min-height: 28px;
            }

            .dp-json-prop-expandable .dp-json-prop-header {
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
            }

            .dp-json-prop-expandable .dp-json-prop-header:hover {
                border-color: var(--color-primary-light);
            }

            .dp-json-prop-key {
                font-weight: var(--font-weight-medium);
                color: var(--color-text);
                font-size: var(--font-size-xs);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .dp-json-prop-expandable .dp-json-prop-key {
                font-weight: var(--font-weight-bold);
            }

            .dp-json-prop-type {
                font-size: 10px;
                color: var(--color-text-secondary);
                background: var(--color-bg);
                padding: 1px 4px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                font-family: var(--font-family-mono);
                text-align: center;
                min-width: 50px;
            }

            .dp-json-prop-preview {
                font-family: var(--font-family-mono);
                color: var(--color-text-secondary);
                font-size: var(--font-size-xs);
                text-align: right;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .dp-json-prop-content {
                display: none;
                padding: var(--space-2);
                margin-top: var(--space-1);
                border-top: 1px solid var(--color-border);
                background: var(--color-bg);
            }

            .dp-json-prop.expanded .dp-json-prop-content {
                display: block;
            }

            /* JSON Array Items */
            .dp-json-array-items {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .dp-json-array-item {
                display: flex;
                align-items: flex-start;
                gap: var(--space-2);
                padding: var(--space-1);
                background: var(--color-bg-alt);
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
            }

            .dp-json-array-index {
                font-family: var(--font-family-mono);
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                font-weight: var(--font-weight-medium);
                min-width: 30px;
                text-align: right;
            }

            .dp-json-array-value {
                flex: 1;
                min-width: 0;
            }

            /* JSON Primitives */
            .dp-json-primitive {
                font-family: var(--font-family-mono);
                font-size: var(--font-size-xs);
                padding: var(--space-1);
                border-radius: var(--radius-sm);
                display: inline-block;
            }

            .dp-json-primitive.dp-json-string {
                color: var(--color-success);
            }

            .dp-json-primitive.dp-json-number {
                color: var(--color-primary);
            }

            .dp-json-primitive.dp-json-boolean {
                color: var(--color-warning);
            }

            .dp-json-primitive.dp-json-null {
                color: var(--color-text-secondary);
                font-style: italic;
            }

            .dp-json-empty,
            .dp-json-truncated,
            .dp-json-more {
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                font-style: italic;
                padding: var(--space-1);
                text-align: center;
            }

            .dp-json-truncated {
                background: var(--color-bg-alt);
                border: 1px dashed var(--color-border);
                border-radius: var(--radius-sm);
            }

            .dp-json-stringified {
                font-weight: bold;
                color: var(--color-warning);
                cursor: help;
                margin-right: var(--space-1);
            }

            .dp-json-base64 {
                color: var(--color-text-secondary);
                background: var(--color-bg-alt);
                padding: 0 4px;
                border-radius: var(--radius-sm);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get the container element where our content lives
     * STANDARD PATTERN - queries .panel-body first
     */
    getContainer() {
        return this.element?.querySelector('.panel-body') || this.element || this.container;
    }

    onDestroy() {
        // Cleanup on destroy
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        super.onDestroy();
    }
}

panelRegistry.registerType('system-diagnostics', DiagnosticPanel);

// Factory function for bootloader compatibility
export function createDiagnosticPanel(config = {}) {
    return new DiagnosticPanel(config);
}
