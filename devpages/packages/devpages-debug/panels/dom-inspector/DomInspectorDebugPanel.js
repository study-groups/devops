/**
 * DomInspectorDebugPanel.js - DOM Inspector panel for the debug panel
 * 
 * This panel provides a simplified interface to the DOM Inspector functionality
 * within the debug panel system.
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from "/client/appState.js";

export class DomInspectorDebugPanel extends BasePanel {
    constructor(options) {
        super({
            id: 'dom-inspector-debug-panel',
            title: 'DOM Inspector',
            ...options
        });
        
        this.domInspector = window.devPages?.domInspector || null;
        this.isInitialized = !!this.domInspector;
        this.currentElement = null;
        this.updateInterval = null;
    }

    renderContent() {
        if (!this.isInitialized) {
            return `
                <div style="padding: 16px; text-align: center;">
                    <div style="color: var(--color-warning, #ffc107); margin-bottom: 12px;">
                        ⚠️ DOM Inspector Not Available
                    </div>
                    <p style="color: var(--color-text-secondary, #666); font-size: 14px; margin-bottom: 16px;">
                        The DOM Inspector service is not initialized.
                    </p>
                    <button class="retry-init-btn" style="padding: 8px 16px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Retry Initialization
                    </button>
                </div>
            `;
        }

        return `
            <div style="padding: 12px; font-family: var(--font-family-monospace, monospace); font-size: 12px;">
                <div class="inspector-header" style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border, #e0e0e0);">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">DOM Inspector</h4>
                    <div class="inspector-status" style="font-size: 11px; color: var(--color-success, #28a745);">
                        ✅ Inspector Active
                    </div>
                </div>
                
                <div class="inspector-controls" style="margin-bottom: 16px;">
                    <button class="start-inspection-btn" style="padding: 6px 12px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 8px;">
                        🔍 Start Inspection
                    </button>
                    <button class="stop-inspection-btn" style="padding: 6px 12px; background: var(--color-danger, #dc3545); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 8px;">
                        ⏹️ Stop
                    </button>
                    <button class="refresh-btn" style="padding: 6px 12px; background: var(--color-secondary, #6c757d); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        🔄 Refresh
                    </button>
                </div>
                
                <div class="current-element-info" style="margin-bottom: 16px; padding: 8px; background: var(--color-background-secondary, #f5f5f5); border-radius: 4px;">
                    <div class="element-title" style="font-weight: 600; margin-bottom: 4px;">Current Element:</div>
                    <div class="element-details">
                        <div class="element-tag">No element selected</div>
                        <div class="element-classes"></div>
                        <div class="element-id"></div>
                    </div>
                </div>
                
                <div class="inspector-stats" style="margin-bottom: 16px;">
                    <div class="stats-title" style="font-weight: 600; margin-bottom: 8px;">Statistics:</div>
                    <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                        <div>Total Elements: <span class="total-elements">-</span></div>
                        <div>Inspected: <span class="inspected-count">0</span></div>
                        <div>With Classes: <span class="with-classes">-</span></div>
                        <div>With IDs: <span class="with-ids">-</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);
        this.setupEventListeners();
        this.startUpdateInterval();
        this.updateStats();
    }

    setupEventListeners() {
        if (!this.element) return;

        const startBtn = this.element.querySelector('.start-inspection-btn');
        const stopBtn = this.element.querySelector('.stop-inspection-btn');
        const refreshBtn = this.element.querySelector('.refresh-btn');
        const retryBtn = this.element.querySelector('.retry-init-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startInspection());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopInspection());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.updateStats());
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryInitialization());
        }
    }

    startInspection() {
        if (!this.domInspector) {
            console.warn('[DomInspectorDebugPanel] DOM Inspector not available');
            return;
        }

        try {
            if (this.domInspector.startInspection) {
                this.domInspector.startInspection();
                this.updateStatus('🔍 Inspecting... (Click elements to inspect)');
            }
        } catch (error) {
            console.error('[DomInspectorDebugPanel] Error starting inspection:', error);
            this.updateStatus('❌ Error starting inspection');
        }
    }

    stopInspection() {
        if (!this.domInspector) return;

        try {
            if (this.domInspector.stopInspection) {
                this.domInspector.stopInspection();
                this.updateStatus('⏹️ Inspection stopped');
            }
        } catch (error) {
            console.error('[DomInspectorDebugPanel] Error stopping inspection:', error);
        }
    }

    retryInitialization() {
        this.domInspector = window.devPages?.domInspector || null;
        this.isInitialized = !!this.domInspector;
        
        if (this.isInitialized) {
            this.render();
            this.setupEventListeners();
            this.updateStats();
        }
    }

    updateStatus(message) {
        const statusEl = this.element?.querySelector('.inspector-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    updateStats() {
        if (!this.element) return;

        const totalElements = document.querySelectorAll('*').length;
        const withClasses = document.querySelectorAll('[class]').length;
        const withIds = document.querySelectorAll('[id]').length;

        const totalEl = this.element.querySelector('.total-elements');
        const withClassesEl = this.element.querySelector('.with-classes');
        const withIdsEl = this.element.querySelector('.with-ids');

        if (totalEl) totalEl.textContent = totalElements;
        if (withClassesEl) withClassesEl.textContent = withClasses;
        if (withIdsEl) withIdsEl.textContent = withIds;
    }

    startUpdateInterval() {
        if (this.updateInterval) return;

        this.updateInterval = setInterval(() => {
            this.updateStats();
        }, 2000);
    }

    stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.stopUpdateInterval();
        this.stopInspection();
        super.destroy();
    }
}