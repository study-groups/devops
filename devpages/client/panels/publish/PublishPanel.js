/**
 * PublishPanel.js - Unified publishing panel for sidebar
 *
 * THE single source of truth for all publishing operations.
 * Based on the PublishModal (Ctrl+Shift+P) design but optimized for sidebar display.
 *
 * Features:
 * - Multiple S3 Spaces configuration support
 * - File status tracking (published/unpublished)
 * - Real-time progress indication
 * - Configuration management
 * - Test and debug tools
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';
import { publishConfigActions, selectAllConfigurations, selectActiveConfigurationDecrypted } from '../../store/slices/publishConfigSlice.js';
import { PublishAPI } from '../../components/publish/PublishAPI.js';
import { publishService } from '../../services/PublishService.js';
import { findEditor } from '../../components/publish/PublishUtils.js';
import { configManager } from './ConfigManager.js';

const log = window.APP.services.log.createLogger('UI', 'PublishPanel');

export class PublishPanel extends BasePanel {
    constructor(config = {}) {
        super({
            id: 'publish-manager',
            title: 'Publish',
            type: 'publish',
            ...config
        });

        this.currentFile = null;
        this.publishStatus = { isPublished: false, url: null };
        this.isProcessing = false;
        this.progressPercent = 0;
        this.statusMessage = '';

        // Bind methods
        this.handlePublish = this.handlePublish.bind(this);
        this.handleUnpublish = this.handleUnpublish.bind(this);
        this.handleConfigChange = this.handleConfigChange.bind(this);
        this.handleOpenConfigManager = this.handleOpenConfigManager.bind(this);
        this.handleTestSetup = this.handleTestSetup.bind(this);
        this.handleCopyUrl = this.handleCopyUrl.bind(this);
        this.handleOpenUrl = this.handleOpenUrl.bind(this);
    }

    /**
     * Render the panel content
     */
    renderContent() {
        const state = appStore.getState();
        const configurations = selectAllConfigurations(state);
        const activeConfig = selectActiveConfigurationDecrypted(state);
        const currentFile = state.file?.currentFile?.pathname || null;

        return `
            <div class="publish-panel-content">
                <!-- Configuration Selector -->
                <div class="publish-section">
                    <div class="config-selector">
                        <label class="config-label">Configuration:</label>
                        <div class="config-select-row">
                            <select class="config-select" id="config-select">
                                ${configurations.length === 0 ? '<option value="">No configurations</option>' : ''}
                                ${configurations.map(config => `
                                    <option value="${config.id}" ${activeConfig && activeConfig.id === config.id ? 'selected' : ''}>
                                        ${config.name}${config.isDefault ? ' (Default)' : ''}
                                    </option>
                                `).join('')}
                            </select>
                            <button class="btn btn-sm btn-secondary config-manage-btn" id="config-manage-btn" title="Manage Configurations">
                                ⚙️
                            </button>
                        </div>
                    </div>
                    ${configurations.length === 0 ? `
                        <div class="config-empty-state">
                            <p>No configurations found.</p>
                            <button class="btn btn-primary btn-sm" id="create-first-config-btn">
                                + Create Configuration
                            </button>
                        </div>
                    ` : ''}
                </div>

                <!-- File Status -->
                <div class="publish-section">
                    <div class="file-status-card">
                        <div class="file-info">
                            <span class="file-icon">📄</span>
                            <span class="file-name" id="current-file-name">
                                ${currentFile || 'No file selected'}
                            </span>
                        </div>
                        <div class="publish-status">
                            <span class="status-indicator ${this.publishStatus.isPublished ? 'published' : 'unpublished'}" id="status-indicator">●</span>
                            <span class="status-text" id="status-text">
                                ${this.publishStatus.isPublished ? 'Published' : 'Not published'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Configuration Status (if active config exists) -->
                ${activeConfig ? `
                    <div class="publish-section">
                        <div class="config-status">
                            <div class="config-status-header">
                                <h4 class="config-status-title">Active Configuration</h4>
                                <button class="btn btn-sm btn-ghost test-setup-btn" id="test-setup-btn" title="Test Connection">
                                    🔧
                                </button>
                            </div>
                            <div class="config-details">
                                <div class="config-detail-row">
                                    <span class="detail-label">Bucket:</span>
                                    <span class="detail-value">${activeConfig.bucket || 'Not set'}</span>
                                </div>
                                <div class="config-detail-row">
                                    <span class="detail-label">Region:</span>
                                    <span class="detail-value">${activeConfig.region || 'Not set'}</span>
                                </div>
                                <div class="config-detail-row">
                                    <span class="detail-label">Prefix:</span>
                                    <span class="detail-value">${activeConfig.prefix || '/'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- Publishing Options -->
                <div class="publish-section">
                    <h4 class="section-title">Options</h4>
                    <label class="publish-option-checkbox">
                        <input type="checkbox" id="bundle-css-checkbox" ${activeConfig && activeConfig.inlineCSS ? 'checked' : ''}>
                        <span>Bundle CSS inline</span>
                    </label>
                    ${activeConfig && activeConfig.themeUrl ? `
                        <label class="publish-option-checkbox">
                            <input type="checkbox" id="use-external-theme-checkbox">
                            <span>Use external theme</span>
                        </label>
                    ` : ''}
                </div>

                <!-- Progress Indicator -->
                <div class="publish-section progress-section" id="progress-section" style="display: none;">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar" style="width: 0%;"></div>
                    </div>
                    <div class="progress-message" id="progress-message">Ready to publish</div>
                </div>

                <!-- Success Display -->
                <div class="publish-section success-section" id="success-section" style="display: ${this.publishStatus.isPublished ? 'block' : 'none'};">
                    <div class="success-header">
                        <span class="success-icon">✅</span>
                        <span class="success-title">Published Successfully!</span>
                    </div>
                    <div class="success-url-container">
                        <input type="text" class="success-url-input" id="success-url-input" readonly value="${this.publishStatus.url || ''}">
                        <button class="btn btn-sm btn-ghost copy-url-btn" id="copy-url-btn" title="Copy URL">📋</button>
                        <button class="btn btn-sm btn-ghost open-url-btn" id="open-url-btn" title="Open in new tab">🔗</button>
                    </div>
                </div>

                <!-- Error Display -->
                <div class="publish-section error-section" id="error-section" style="display: none;">
                    <div class="error-header">
                        <span class="error-icon">⚠️</span>
                        <span class="error-title" id="error-title">Error</span>
                    </div>
                    <div class="error-message" id="error-message"></div>
                </div>

                <!-- Action Buttons -->
                <div class="publish-section action-buttons">
                    ${this.publishStatus.isPublished ? `
                        <button class="btn btn-secondary btn-block unpublish-btn" id="unpublish-btn">
                            <span class="btn-text">Unpublish</span>
                            <span class="btn-spinner" style="display: none;">⟳</span>
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-block publish-btn" id="publish-btn" ${!currentFile || !activeConfig ? 'disabled' : ''}>
                            <span class="btn-text">🚀 Publish</span>
                            <span class="btn-spinner" style="display: none;">⟳</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Initialize panel after mounting
     */
    async onMount(container) {
        super.onMount(container);
        this.container = container || this.element;

        // Subscribe to Redux store updates
        this.unsubscribe = appStore.subscribe(() => this.handleStoreChange());

        // Load initial data
        await this.loadPublishStatus();

        // Attach event listeners
        this.attachEventListeners();
    }

    /**
     * Cleanup when panel is unmounted
     */
    onUnmount() {
        super.onUnmount();
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    /**
     * Attach all event listeners
     */
    attachEventListeners() {
        if (!this.container) return;

        const publishBtn = this.container.querySelector('#publish-btn');
        const unpublishBtn = this.container.querySelector('#unpublish-btn');
        const configSelect = this.container.querySelector('#config-select');
        const configManageBtn = this.container.querySelector('#config-manage-btn');
        const createFirstConfigBtn = this.container.querySelector('#create-first-config-btn');
        const testSetupBtn = this.container.querySelector('#test-setup-btn');
        const copyUrlBtn = this.container.querySelector('#copy-url-btn');
        const openUrlBtn = this.container.querySelector('#open-url-btn');

        if (publishBtn) {
            publishBtn.addEventListener('click', this.handlePublish);
        }

        if (unpublishBtn) {
            unpublishBtn.addEventListener('click', this.handleUnpublish);
        }

        if (configSelect) {
            configSelect.addEventListener('change', this.handleConfigChange);
        }

        if (configManageBtn || createFirstConfigBtn) {
            const btn = configManageBtn || createFirstConfigBtn;
            btn.addEventListener('click', this.handleOpenConfigManager);
        }

        if (testSetupBtn) {
            testSetupBtn.addEventListener('click', this.handleTestSetup);
        }

        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', this.handleCopyUrl);
        }

        if (openUrlBtn) {
            openUrlBtn.addEventListener('click', this.handleOpenUrl);
        }
    }

    /**
     * Handle Redux store changes
     */
    handleStoreChange() {
        const state = appStore.getState();
        const currentFile = state.file?.currentFile?.pathname;

        // If current file changed, update status
        if (currentFile !== this.currentFile) {
            this.currentFile = currentFile;
            this.loadPublishStatus();
            this.refresh();
        }
    }

    /**
     * Load publish status for current file
     */
    async loadPublishStatus() {
        const state = appStore.getState();
        const currentFile = state.file?.currentFile?.pathname;

        if (!currentFile) {
            this.publishStatus = { isPublished: false, url: null };
            return;
        }

        try {
            this.publishStatus = await PublishAPI.checkStatus(currentFile);
        } catch (error) {
            log.error('LOAD_STATUS_ERROR', `Failed to load publish status: ${error.message}`);
            this.publishStatus = { isPublished: false, url: null };
        }
    }

    /**
     * Handle publish button click
     */
    async handlePublish() {
        if (this.isProcessing) return;

        const state = appStore.getState();
        const currentFile = state.file?.currentFile?.pathname;
        const activeConfig = selectActiveConfigurationDecrypted(state);

        if (!currentFile || !activeConfig) {
            this.showError('Cannot publish', 'No file or configuration selected');
            return;
        }

        this.setProcessing(true);
        this.showProgress(true);
        this.hideError();

        try {
            // Update progress: Reading content
            this.updateProgress(20, '📝 Reading editor content...');

            const editor = findEditor();
            if (!editor) {
                throw new Error('Markdown editor not found');
            }

            const content = editor.value || '';
            if (!content.trim()) {
                throw new Error('Editor content is empty');
            }

            // Update progress: Generating HTML
            this.updateProgress(40, '🔄 Generating self-contained HTML...');

            const htmlContent = await publishService.generatePublishHtml(content, currentFile);
            if (!htmlContent) {
                throw new Error('HTML generation failed');
            }

            // Update progress: Publishing
            this.updateProgress(60, `🚀 Publishing to ${activeConfig.name}...`);

            const result = await PublishAPI.publish(currentFile, htmlContent, true, activeConfig);

            // Update progress: Complete
            this.updateProgress(100, '✅ Upload complete!');

            this.publishStatus = { isPublished: true, url: result.url };
            this.refresh();

            log.info('PUBLISH_SUCCESS', `Successfully published: ${currentFile} to ${result.url}`);

        } catch (error) {
            log.error('PUBLISH_ERROR', `Publish error: ${error.message}`, { stack: error.stack });
            this.showError('Failed to publish', error.message);
            this.updateProgress(0, '❌ Failed');
        } finally {
            this.setProcessing(false);
            setTimeout(() => this.showProgress(false), 2000);
        }
    }

    /**
     * Handle unpublish button click
     */
    async handleUnpublish() {
        if (this.isProcessing) return;

        const state = appStore.getState();
        const currentFile = state.file?.currentFile?.pathname;
        const activeConfig = selectActiveConfigurationDecrypted(state);

        if (!currentFile) {
            this.showError('Cannot unpublish', 'No file selected');
            return;
        }

        if (!activeConfig) {
            this.showError('Cannot unpublish', 'No configuration selected');
            return;
        }

        this.setProcessing(true);
        this.hideError();

        try {
            await PublishAPI.unpublish(currentFile, activeConfig);

            this.publishStatus = { isPublished: false, url: null };
            this.refresh();

            log.info('UNPUBLISH_SUCCESS', `Successfully unpublished: ${currentFile}`);

        } catch (error) {
            log.error('UNPUBLISH_ERROR', `Unpublish error: ${error.message}`, { stack: error.stack });
            this.showError('Failed to unpublish', error.message);
        } finally {
            this.setProcessing(false);
        }
    }

    /**
     * Handle configuration selection change
     */
    handleConfigChange(event) {
        const configId = event.target.value;
        appStore.dispatch(publishConfigActions.setActiveConfiguration(configId));
        this.refresh();
    }

    /**
     * Handle open configuration manager
     */
    handleOpenConfigManager() {
        appStore.dispatch(publishConfigActions.openConfigManager());
        configManager.open();
        log.info('CONFIG_MANAGER', 'Configuration manager opened');
    }

    /**
     * Handle test setup
     */
    async handleTestSetup() {
        const state = appStore.getState();
        const activeConfig = selectActiveConfigurationDecrypted(state);

        if (!activeConfig) {
            this.showError('Cannot test', 'No configuration selected');
            return;
        }

        try {
            const result = await PublishAPI.testSetup();
            log.info('TEST_SETUP_SUCCESS', 'Setup test passed', result);
            // TODO: Show success message
        } catch (error) {
            log.error('TEST_SETUP_ERROR', `Setup test failed: ${error.message}`);
            this.showError('Test failed', error.message);
        }
    }

    /**
     * Handle copy URL
     */
    async handleCopyUrl() {
        if (!this.publishStatus.url) return;

        try {
            await navigator.clipboard.writeText(this.publishStatus.url);
            log.info('COPY_URL_SUCCESS', 'URL copied to clipboard');

            const btn = this.container.querySelector('#copy-url-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = originalText; }, 1500);
            }
        } catch (error) {
            log.error('COPY_URL_ERROR', `Failed to copy URL: ${error.message}`);
        }
    }

    /**
     * Handle open URL
     */
    handleOpenUrl() {
        if (this.publishStatus.url) {
            window.open(this.publishStatus.url, '_blank');
        }
    }

    /**
     * Update progress indicator
     */
    updateProgress(percent, message) {
        this.progressPercent = percent;
        this.statusMessage = message;

        const progressBar = this.container?.querySelector('#progress-bar');
        const progressMessage = this.container?.querySelector('#progress-message');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (progressMessage) {
            progressMessage.textContent = message;
        }
    }

    /**
     * Show/hide progress section
     */
    showProgress(show) {
        const progressSection = this.container?.querySelector('#progress-section');
        if (progressSection) {
            progressSection.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Show error message
     */
    showError(title, message) {
        const errorSection = this.container?.querySelector('#error-section');
        const errorTitle = this.container?.querySelector('#error-title');
        const errorMessage = this.container?.querySelector('#error-message');

        if (errorTitle) errorTitle.textContent = title;
        if (errorMessage) errorMessage.textContent = message;
        if (errorSection) errorSection.style.display = 'block';
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorSection = this.container?.querySelector('#error-section');
        if (errorSection) {
            errorSection.style.display = 'none';
        }
    }

    /**
     * Set processing state
     */
    setProcessing(processing) {
        this.isProcessing = processing;

        const publishBtn = this.container?.querySelector('#publish-btn');
        const unpublishBtn = this.container?.querySelector('#unpublish-btn');

        [publishBtn, unpublishBtn].forEach(btn => {
            if (!btn) return;
            btn.disabled = processing;

            const btnText = btn.querySelector('.btn-text');
            const btnSpinner = btn.querySelector('.btn-spinner');

            if (btnText) btnText.style.display = processing ? 'none' : 'inline';
            if (btnSpinner) btnSpinner.style.display = processing ? 'inline' : 'none';
        });
    }

    /**
     * Refresh panel content
     */
    refresh() {
        if (this.container) {
            this.container.innerHTML = this.renderContent();
            this.attachEventListeners();
        }
    }
}

// Register with panel registry
panelRegistry.registerType('publish-manager', PublishPanel);
