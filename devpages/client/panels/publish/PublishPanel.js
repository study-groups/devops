/**
 * PublishPanel.js - Publishing and deployment management panel
 * 
 * Provides interface for:
 * - Content publishing
 * - Deployment management
 * - Publish history
 * - Configuration settings
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class PublishPanel extends BasePanel {
    constructor(config = {}) {
        super({
            id: 'publish-manager',
            title: 'Publish Manager',
            type: 'publish',
            ...config
        });
        
        this.publishHistory = [];
        this.deploymentConfig = {};
    }

    /**
     * Render the panel content
     */
    renderContent() {
        return `
            <div class="publish-panel-content">
                <div class="publish-section">
                    <h3 class="section-title">Quick Publish</h3>
                    <div class="publish-actions">
                        <button class="btn btn-primary" onclick="this.publishCurrent()">
                            🚀 Publish Current File
                        </button>
                        <button class="btn btn-secondary" onclick="this.publishAll()">
                            📦 Publish All Changes
                        </button>
                    </div>
                </div>

                <div class="publish-section">
                    <h3 class="section-title">Deployment Status</h3>
                    <div class="deployment-status">
                        <div class="status-item">
                            <span class="status-label">Last Deploy:</span>
                            <span class="status-value" id="last-deploy-time">Never</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Status:</span>
                            <span class="status-value status-ready" id="deploy-status">Ready</span>
                        </div>
                    </div>
                </div>

                <div class="publish-section">
                    <h3 class="section-title">Publish History</h3>
                    <div class="publish-history" id="publish-history-list">
                        <div class="history-empty">No publish history yet</div>
                    </div>
                </div>

                <div class="publish-section">
                    <h3 class="section-title">Configuration</h3>
                    <div class="config-form">
                        <div class="form-group">
                            <label class="form-label">Target Environment</label>
                            <select class="form-control" id="target-env">
                                <option value="staging">Staging</option>
                                <option value="production">Production</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Auto-publish</label>
                            <input type="checkbox" class="form-check-input" id="auto-publish">
                            <span class="form-check-label">Enable automatic publishing</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize panel after mounting
     */
    onMount() {
        super.onMount();
        this.loadPublishHistory();
        this.updateDeploymentStatus();
        this.bindEvents();
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        const publishCurrentBtn = this.element.querySelector('button[onclick*="publishCurrent"]');
        const publishAllBtn = this.element.querySelector('button[onclick*="publishAll"]');
        
        if (publishCurrentBtn) {
            publishCurrentBtn.onclick = () => this.publishCurrent();
        }
        
        if (publishAllBtn) {
            publishAllBtn.onclick = () => this.publishAll();
        }
    }

    /**
     * Publish current file
     */
    async publishCurrent() {
        try {
            const state = appStore.getState();
            const currentFile = state.file?.currentFile?.pathname;
            
            if (!currentFile) {
                this.showNotification('No file selected', 'warning');
                return;
            }

            this.showNotification('Publishing current file...', 'info');
            
            // Simulate publish process
            await this.simulatePublish(currentFile);
            
            this.addToHistory({
                type: 'file',
                target: currentFile,
                timestamp: new Date(),
                status: 'success'
            });
            
            this.showNotification('File published successfully!', 'success');
            this.updateDeploymentStatus();
            
        } catch (error) {
            console.error('Publish failed:', error);
            this.showNotification('Publish failed: ' + error.message, 'error');
        }
    }

    /**
     * Publish all changes
     */
    async publishAll() {
        try {
            this.showNotification('Publishing all changes...', 'info');
            
            // Simulate publish process
            await this.simulatePublish('all');
            
            this.addToHistory({
                type: 'full',
                target: 'All changes',
                timestamp: new Date(),
                status: 'success'
            });
            
            this.showNotification('All changes published successfully!', 'success');
            this.updateDeploymentStatus();
            
        } catch (error) {
            console.error('Publish failed:', error);
            this.showNotification('Publish failed: ' + error.message, 'error');
        }
    }

    /**
     * Simulate publish process (replace with real implementation)
     */
    async simulatePublish(target) {
        return new Promise(resolve => {
            setTimeout(resolve, 2000); // Simulate 2 second deploy
        });
    }

    /**
     * Add entry to publish history
     */
    addToHistory(entry) {
        this.publishHistory.unshift(entry);
        this.renderPublishHistory();
    }

    /**
     * Load publish history from storage
     */
    loadPublishHistory() {
        try {
            const stored = localStorage.getItem('devpages_publish_history');
            if (stored) {
                this.publishHistory = JSON.parse(stored);
                this.renderPublishHistory();
            }
        } catch (error) {
            console.warn('Failed to load publish history:', error);
        }
    }

    /**
     * Render publish history list
     */
    renderPublishHistory() {
        const historyContainer = this.element.querySelector('#publish-history-list');
        if (!historyContainer) return;

        if (this.publishHistory.length === 0) {
            historyContainer.innerHTML = '<div class="history-empty">No publish history yet</div>';
            return;
        }

        historyContainer.innerHTML = this.publishHistory.map(entry => `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-type">${entry.type === 'file' ? '📄' : '📦'}</span>
                    <span class="history-target">${entry.target}</span>
                    <span class="history-status status-${entry.status}">${entry.status}</span>
                </div>
                <div class="history-time">${this.formatTime(entry.timestamp)}</div>
            </div>
        `).join('');

        // Save to localStorage
        localStorage.setItem('devpages_publish_history', JSON.stringify(this.publishHistory));
    }

    /**
     * Update deployment status display
     */
    updateDeploymentStatus() {
        const lastDeployElement = this.element.querySelector('#last-deploy-time');
        const statusElement = this.element.querySelector('#deploy-status');
        
        if (this.publishHistory.length > 0) {
            const lastDeploy = this.publishHistory[0];
            if (lastDeployElement) {
                lastDeployElement.textContent = this.formatTime(lastDeploy.timestamp);
            }
            if (statusElement) {
                statusElement.textContent = 'Up to date';
                statusElement.className = 'status-value status-success';
            }
        }
    }

    /**
     * Format timestamp for display
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to panel
        this.element.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * Get panel debug information
     */
    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            publishHistory: this.publishHistory.length,
            deploymentConfig: Object.keys(this.deploymentConfig).length
        };
    }
}

panelRegistry.registerType('publish-manager', PublishPanel);
