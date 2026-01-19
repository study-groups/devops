/**
 * PublishPanel.js - DO Spaces Browser Panel
 *
 * Redesigned as a file browser showing:
 * - Connection info (endpoint, bucket, prefix)
 * - Current file status with actions
 * - Published files list from bucket
 *
 * Uses PublishManager for all operations.
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';
import { publishConfigActions, selectAllConfigurations, selectActiveConfigurationDecrypted } from '../../store/slices/publishConfigSlice.js';
import { publishManager } from '../../services/PublishManager.js';
import { configManager } from './ConfigManager.js';

const log = window.APP?.services?.log?.createLogger('UI', 'PublishPanel') || {
    info: () => {},
    error: () => {},
    debug: () => {}
};

export class PublishPanel extends BasePanel {
    constructor(config = {}) {
        super({
            id: 'publish-manager',
            title: 'Publish',
            type: 'publish',
            ...config
        });

        this.filesExpanded = true;
        this.lastActiveConfigId = null;  // Track config changes

        // Bind methods
        this.handlePublish = this.handlePublish.bind(this);
        this.handleUnpublish = this.handleUnpublish.bind(this);
        this.handleRefresh = this.handleRefresh.bind(this);
        this.handleConfigChange = this.handleConfigChange.bind(this);
        this.handleOpenConfigManager = this.handleOpenConfigManager.bind(this);
        this.handleCopyUrl = this.handleCopyUrl.bind(this);
        this.handleOpenUrl = this.handleOpenUrl.bind(this);
        this.handleToggleFiles = this.handleToggleFiles.bind(this);
        this.handleManagerUpdate = this.handleManagerUpdate.bind(this);
        this.handleCssStrategyChange = this.handleCssStrategyChange.bind(this);
    }

    renderContent() {
        const state = appStore.getState();
        const configurations = selectAllConfigurations(state);
        const activeConfig = selectActiveConfigurationDecrypted(state);
        const managerState = publishManager.getState();
        const { currentFile, publishStatus, isProcessing, progressPercent, statusMessage, error, publishedFiles, isLoadingFiles } = managerState;

        const filename = currentFile ? currentFile.split('/').pop() : 'No file selected';

        return `
            <div class="publish-panel-browser">
                <!-- Header with Config Selector -->
                <div class="panel-header-row">
                    <select class="config-select" id="config-select">
                        ${configurations.length === 0 ? '<option value="">No configurations</option>' : ''}
                        ${configurations.map(config => `
                            <option value="${config.id}" ${activeConfig && activeConfig.id === config.id ? 'selected' : ''}>
                                ${config.name}${config.isDefault ? ' (Default)' : ''}
                            </option>
                        `).join('')}
                    </select>
                    <button class="btn-icon-sm" id="config-manage-btn" title="Manage Configurations">
                        <span>&#9881;</span>
                    </button>
                    <button class="btn-icon-sm" id="refresh-btn" title="Refresh">
                        <span>&#8635;</span>
                    </button>
                </div>

                <!-- Connection Info -->
                ${activeConfig ? `
                    <div class="connection-info">
                        <div class="connection-row">
                            <span class="conn-label">Endpoint:</span>
                            <span class="conn-value">${this.formatEndpoint(activeConfig.endpoint)}</span>
                        </div>
                        <div class="connection-row">
                            <span class="conn-label">Bucket:</span>
                            <span class="conn-value">${activeConfig.bucket || 'Not set'}</span>
                            <span class="conn-sep">|</span>
                            <span class="conn-label">Prefix:</span>
                            <span class="conn-value">${activeConfig.prefix || '/'}</span>
                        </div>
                    </div>
                ` : `
                    <div class="connection-empty">
                        <p>No configuration selected</p>
                        <button class="btn-sm btn-primary" id="create-config-btn">Create Configuration</button>
                    </div>
                `}

                <!-- Current File Section -->
                <div class="current-file-section">
                    <div class="section-header-small">CURRENT FILE</div>
                    <div class="current-file-card">
                        <div class="file-row">
                            <span class="status-dot ${publishStatus.isPublished ? 'published' : 'unpublished'}"></span>
                            <span class="file-name" title="${currentFile || ''}">${filename}</span>
                        </div>
                        ${publishStatus.isPublished && publishStatus.url ? `
                            <div class="url-row">
                                <input type="text" class="url-input" id="url-input" readonly value="${publishStatus.url}">
                                <button class="btn-icon-xs" id="copy-url-btn" title="Copy URL">
                                    <span>&#128203;</span>
                                </button>
                                <button class="btn-icon-xs" id="open-url-btn" title="Open URL">
                                    <span>&#128279;</span>
                                </button>
                            </div>
                        ` : ''}
                        ${error ? `
                            <div class="error-row">
                                <span class="error-text">${error}</span>
                            </div>
                        ` : ''}
                        ${isProcessing ? `
                            <div class="progress-row">
                                <div class="progress-bar-mini">
                                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                                <span class="progress-text">${statusMessage}</span>
                            </div>
                        ` : ''}
                        <div class="action-row">
                            ${publishStatus.isPublished ? `
                                <button class="btn-sm btn-primary" id="republish-btn" ${!currentFile || !activeConfig || isProcessing ? 'disabled' : ''}>
                                    ${isProcessing ? 'Publishing...' : 'Republish'}
                                </button>
                                <button class="btn-sm btn-danger" id="unpublish-btn" ${isProcessing ? 'disabled' : ''}>
                                    Unpublish
                                </button>
                            ` : `
                                <button class="btn-sm btn-primary btn-full" id="publish-btn" ${!currentFile || !activeConfig || isProcessing ? 'disabled' : ''}>
                                    ${isProcessing ? 'Publishing...' : 'Publish'}
                                </button>
                            `}
                        </div>
                        <div class="strategy-row">
                            <label class="strategy-label">CSS:</label>
                            <select class="strategy-select" id="css-strategy-select">
                                <option value="embedded" ${managerState.cssStrategy === 'embedded' ? 'selected' : ''}>Embedded (archival)</option>
                                <option value="hybrid" ${managerState.cssStrategy === 'hybrid' ? 'selected' : ''}>Hybrid (recommended)</option>
                                <option value="linked" ${managerState.cssStrategy === 'linked' ? 'selected' : ''}>Linked (themeable)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Published Files Section -->
                <div class="published-files-section">
                    <div class="section-header-collapsible" id="files-header">
                        <span class="section-title">PUBLISHED FILES (${publishedFiles.length})</span>
                        <span class="toggle-icon">${this.filesExpanded ? '&#9662;' : '&#9656;'}</span>
                    </div>
                    ${this.filesExpanded ? `
                        <div class="files-list">
                            ${isLoadingFiles ? `
                                <div class="loading-row">Loading files...</div>
                            ` : publishedFiles.length === 0 ? `
                                <div class="empty-row">No published files yet</div>
                            ` : publishedFiles.slice(0, 10).map(file => `
                                <div class="file-item">
                                    <span class="file-item-name" title="${file.key}">${this.formatFilename(file.key)}</span>
                                    <span class="file-item-time">${publishManager.formatRelativeTime(file.lastModified)}</span>
                                    <button class="btn-icon-xs file-open-btn" data-url="${file.url || ''}" title="Open">
                                        <span>&#128279;</span>
                                    </button>
                                </div>
                            `).join('')}
                            ${publishedFiles.length > 10 ? `
                                <div class="more-files-row">+ ${publishedFiles.length - 10} more files</div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    async onMount(container) {
        super.onMount(container);

        // Initialize config tracking to prevent spurious refreshes
        const state = appStore.getState();
        this.lastActiveConfigId = state.publishConfig?.activeConfigurationId;

        // Subscribe to PublishManager updates (handles file changes, publish status)
        this.managerUnsubscribe = publishManager.subscribe(this.handleManagerUpdate);

        // Subscribe to Redux store updates (handles config list changes)
        this.storeUnsubscribe = appStore.subscribe(() => this.handleStoreChange());

        // Load initial data
        await publishManager.loadConnectionInfo();
        await publishManager.loadPublishedFiles();

        this.attachEventListeners();
    }

    onUnmount() {
        super.onUnmount();
        if (this.managerUnsubscribe) {
            this.managerUnsubscribe();
        }
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
    }

    attachEventListeners() {
        const container = this.getContainer();
        if (!container) return;

        // Publish buttons
        container.querySelector('#publish-btn')?.addEventListener('click', this.handlePublish);
        container.querySelector('#republish-btn')?.addEventListener('click', this.handlePublish);
        container.querySelector('#unpublish-btn')?.addEventListener('click', this.handleUnpublish);

        // Config selector
        container.querySelector('#config-select')?.addEventListener('change', this.handleConfigChange);

        // Config manager button
        container.querySelector('#config-manage-btn')?.addEventListener('click', this.handleOpenConfigManager);
        container.querySelector('#create-config-btn')?.addEventListener('click', this.handleOpenConfigManager);

        // Refresh button
        container.querySelector('#refresh-btn')?.addEventListener('click', this.handleRefresh);

        // URL actions
        container.querySelector('#copy-url-btn')?.addEventListener('click', this.handleCopyUrl);
        container.querySelector('#open-url-btn')?.addEventListener('click', this.handleOpenUrl);

        // Files section toggle
        container.querySelector('#files-header')?.addEventListener('click', this.handleToggleFiles);

        // CSS strategy selector
        container.querySelector('#css-strategy-select')?.addEventListener('change', this.handleCssStrategyChange);

        // File open buttons
        container.querySelectorAll('.file-open-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                if (url) window.open(url, '_blank');
            });
        });
    }

    handleManagerUpdate() {
        this.refresh();
    }

    handleStoreChange() {
        const state = appStore.getState();
        const activeConfigId = state.publishConfig?.activeConfigurationId;

        // Only refresh if active config actually changed
        // File changes are handled by PublishManager subscription
        if (activeConfigId !== this.lastActiveConfigId) {
            this.lastActiveConfigId = activeConfigId;
            this.refresh();
        }
    }

    async handlePublish() {
        const result = await publishManager.publish();
        if (!result.success) {
            log.error('PUBLISH_FAILED', result.error);
        }
    }

    async handleUnpublish() {
        const result = await publishManager.unpublish();
        if (!result.success) {
            log.error('UNPUBLISH_FAILED', result.error);
        }
    }

    handleRefresh() {
        publishManager.loadPublishStatus();
        publishManager.loadPublishedFiles();
    }

    handleConfigChange(event) {
        const configId = event.target.value;
        appStore.dispatch(publishConfigActions.setActiveConfiguration(configId));
        // Reload files for new config
        publishManager.loadPublishedFiles();
    }

    handleOpenConfigManager() {
        appStore.dispatch(publishConfigActions.openConfigManager());
        configManager.open();
    }

    async handleCopyUrl() {
        const managerState = publishManager.getState();
        if (!managerState.publishStatus.url) return;

        try {
            await navigator.clipboard.writeText(managerState.publishStatus.url);
            const container = this.getContainer();
            const btn = container?.querySelector('#copy-url-btn span');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '&#10003;';
                setTimeout(() => { btn.innerHTML = orig; }, 1500);
            }
        } catch (error) {
            log.error('COPY_URL_ERROR', error.message);
        }
    }

    handleOpenUrl() {
        const managerState = publishManager.getState();
        if (managerState.publishStatus.url) {
            window.open(managerState.publishStatus.url, '_blank');
        }
    }

    handleToggleFiles() {
        this.filesExpanded = !this.filesExpanded;
        this.refresh();
    }

    handleCssStrategyChange(event) {
        const strategy = event.target.value;
        publishManager.setCssStrategy(strategy);
    }

    formatEndpoint(endpoint) {
        if (!endpoint) return 'Not set';
        try {
            const url = new URL(endpoint);
            return url.hostname;
        } catch {
            return endpoint;
        }
    }

    formatFilename(key) {
        if (!key) return '';
        // Remove prefix if present
        const parts = key.split('/');
        return parts[parts.length - 1] || key;
    }

    refresh() {
        const container = this.getContainer();
        if (container) {
            container.innerHTML = this.renderContent();
            this.attachEventListeners();
        }
    }
}

// Register with panel registry
panelRegistry.registerType('publish-manager', PublishPanel);
