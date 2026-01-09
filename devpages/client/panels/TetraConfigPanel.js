/**
 * @file TetraConfigPanel.js
 * @description Panel for viewing and testing TETRA configuration
 * Shows parsed tetra.toml, publishing configs, and debug info
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class TetraConfigPanel extends BasePanel {
    constructor(config = {}) {
        super({
            id: 'tetra-config',
            title: 'TETRA Config',
            type: 'tetra-config',
            ...config
        });
        this.debugInfo = null;
        this.publishingConfigs = null;
        this.loading = false;
        this.error = null;
    }

    async onMount(container) {
        super.onMount(container);

        await this.loadConfig();
        this.attachListeners();
    }

    async loadConfig() {
        this.loading = true;
        this.error = null;
        this.refresh();

        try {
            // Fetch debug info
            const debugResponse = await fetch('/api/tetra/config/debug');
            this.debugInfo = await debugResponse.json();

            // Fetch publishing configs if available
            if (this.debugInfo.available) {
                const publishResponse = await fetch('/api/tetra/config/publishing');
                const publishData = await publishResponse.json();
                this.publishingConfigs = publishData.configs;
            }

            this.loading = false;
            this.refresh();
        } catch (error) {
            this.error = error.message;
            this.loading = false;
            this.refresh();
        }
    }

    renderContent() {
        if (this.loading) {
            return `
                <div class="tetra-config-panel">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Loading TETRA configuration...</p>
                    </div>
                </div>
            `;
        }

        if (this.error) {
            return `
                <div class="tetra-config-panel">
                    <div class="error-state">
                        <h3>⚠️ Error Loading Configuration</h3>
                        <p>${this.error}</p>
                        <button class="btn-reload">Reload</button>
                    </div>
                </div>
            `;
        }

        if (!this.debugInfo) {
            return `
                <div class="tetra-config-panel">
                    <div class="empty-state">
                        <p>No configuration data</p>
                        <button class="btn-reload">Load Configuration</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="tetra-config-panel">
                ${this.renderHeader()}
                ${this.renderOverview()}
                ${this.renderEnvironmentVars()}
                ${this.renderPublishingConfigs()}
                ${this.renderDebugInfo()}
            </div>
        `;
    }

    renderHeader() {
        const statusClass = this.debugInfo.available ? 'status-success' : 'status-error';
        const statusIcon = this.debugInfo.available ? '✅' : '❌';
        const statusText = this.debugInfo.available ? 'Loaded' : 'Not Available';

        return `
            <div class="config-header">
                <div class="status ${statusClass}">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
                <div class="actions">
                    <button class="btn-reload" title="Reload configuration">
                        🔄 Reload
                    </button>
                </div>
            </div>
        `;
    }

    renderOverview() {
        if (!this.debugInfo.available) {
            return `
                <div class="config-section unavailable">
                    <h3>⚠️ TETRA Configuration Not Available</h3>
                    <p class="error-message">${this.debugInfo.error || 'Configuration not initialized'}</p>
                    <div class="help-text">
                        <p>To enable TETRA configuration, ensure these environment variables are set:</p>
                        <ul>
                            <li><code>TETRA_CONFIG</code> - Path to tetra.toml</li>
                            <li><code>TETRA_SECRETS</code> - Path to secrets.env</li>
                            <li><code>TETRA_ORG</code> - Organization name</li>
                        </ul>
                    </div>
                </div>
            `;
        }

        return `
            <div class="config-section overview">
                <h3>📋 Configuration Overview</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Config File:</label>
                        <span class="path">${this.debugInfo.configPath}</span>
                    </div>
                    <div class="info-item">
                        <label>Secrets File:</label>
                        <span class="path">${this.debugInfo.secretsPath}</span>
                    </div>
                    <div class="info-item">
                        <label>Publishing Configs:</label>
                        <span class="count">${this.debugInfo.publishingConfigCount}</span>
                    </div>
                    <div class="info-item">
                        <label>Environments:</label>
                        <span class="count">${this.debugInfo.environmentCount}</span>
                    </div>
                    <div class="info-item">
                        <label>Secret Keys:</label>
                        <span class="count">${this.debugInfo.secretKeys.length}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderEnvironmentVars() {
        return `
            <div class="config-section">
                <h3>🌍 Environment Variables</h3>
                <table class="env-table">
                    <thead>
                        <tr>
                            <th>Variable</th>
                            <th>Value</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.renderEnvRow('TETRA_CONFIG', this.debugInfo.env.TETRA_CONFIG)}
                        ${this.renderEnvRow('TETRA_SECRETS', this.debugInfo.env.TETRA_SECRETS)}
                        ${this.renderEnvRow('TETRA_ORG', this.debugInfo.env.TETRA_ORG)}
                    </tbody>
                </table>
                ${this.debugInfo.secretKeys.length > 0 ? `
                    <div class="secrets-info">
                        <h4>🔐 Loaded Secrets</h4>
                        <div class="secret-keys">
                            ${this.debugInfo.secretKeys.map(key => `
                                <span class="secret-key">${key}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderEnvRow(name, value) {
        const hasValue = value && value !== 'undefined';
        const statusIcon = hasValue ? '✅' : '❌';
        const statusClass = hasValue ? 'set' : 'unset';
        const displayValue = hasValue ? value : '<em>not set</em>';

        return `
            <tr class="${statusClass}">
                <td><code>${name}</code></td>
                <td class="value">${displayValue}</td>
                <td class="status">${statusIcon}</td>
            </tr>
        `;
    }

    renderPublishingConfigs() {
        if (!this.publishingConfigs || this.publishingConfigs.length === 0) {
            return `
                <div class="config-section">
                    <h3>📤 Publishing Configurations</h3>
                    <p class="empty">No publishing configurations found in tetra.toml</p>
                </div>
            `;
        }

        return `
            <div class="config-section">
                <h3>📤 Publishing Configurations (${this.publishingConfigs.length})</h3>
                <div class="publish-configs">
                    ${this.publishingConfigs.map(cfg => this.renderPublishConfig(cfg)).join('')}
                </div>
            </div>
        `;
    }

    renderPublishConfig(config) {
        const isSpaces = config.type === 'spaces';
        const icon = isSpaces ? '☁️' : '📁';

        return `
            <div class="publish-config-card">
                <div class="config-header-row">
                    <div class="config-title">
                        <span class="config-icon">${icon}</span>
                        <span class="config-name">${config.name}</span>
                        <span class="config-symbol">${config.symbol}</span>
                    </div>
                    <span class="config-type">${config.type}</span>
                </div>
                ${config.description ? `<p class="config-description">${config.description}</p>` : ''}
                <div class="config-details">
                    ${isSpaces ? `
                        <div class="detail-row">
                            <label>Bucket:</label>
                            <span>${config.bucket}</span>
                        </div>
                        <div class="detail-row">
                            <label>Endpoint:</label>
                            <span class="path">${config.endpoint}</span>
                        </div>
                        <div class="detail-row">
                            <label>Region:</label>
                            <span>${config.region}</span>
                        </div>
                        <div class="detail-row">
                            <label>Prefix:</label>
                            <span>${config.prefix || '<em>none</em>'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Base URL:</label>
                            <span class="path">${config.baseUrl}</span>
                        </div>
                        <div class="detail-row">
                            <label>Access Key:</label>
                            <span class="secret">${config.accessKey ? '••••••' + config.accessKey.slice(-4) : '<em>none</em>'}</span>
                        </div>
                    ` : `
                        <div class="detail-row">
                            <label>Path:</label>
                            <span class="path">${config.path || '<em>not set</em>'}</span>
                        </div>
                    `}
                    <div class="detail-row">
                        <label>Theme:</label>
                        <span>${config.theme}</span>
                    </div>
                    <div class="detail-row">
                        <label>Inline CSS:</label>
                        <span>${config.inlineCss ? '✅ Yes' : '❌ No'}</span>
                    </div>
                </div>
                <div class="config-source">
                    Source: <code>${config.source}</code>
                </div>
            </div>
        `;
    }

    renderDebugInfo() {
        if (!this.debugInfo.errors || this.debugInfo.errors.length === 0) {
            return '';
        }

        return `
            <div class="config-section errors">
                <h3>⚠️ Errors</h3>
                <ul class="error-list">
                    ${this.debugInfo.errors.map(err => `<li>${err}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    attachListeners() {
        const container = this.getContainer();
        if (!container) return;

        const reloadButtons = container.querySelectorAll('.btn-reload');
        reloadButtons.forEach(btn => {
            btn.addEventListener('click', () => this.handleReload());
        });
    }

    refresh() {
        const panelBody = this.getContainer();
        if (panelBody) {
            panelBody.innerHTML = this.renderContent();
            this.attachListeners();
        }
    }

    async handleReload() {
        try {
            const response = await fetch('/api/tetra/config/reload', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                console.log('[TetraConfigPanel] Configuration reloaded successfully');
                await this.loadConfig();
            } else {
                this.error = result.error || 'Failed to reload configuration';
                this.refresh();
            }
        } catch (error) {
            this.error = error.message;
            this.refresh();
        }
    }

    destroy() {
        // Cleanup if needed
    }
}

// Register panel
panelRegistry.registerType('tetra-config', TetraConfigPanel);

export default TetraConfigPanel;
