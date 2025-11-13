/**
 * ConfigManager.js - Modal for managing publish configurations
 *
 * Allows users to:
 * - View all configurations
 * - Create new configurations
 * - Edit existing configurations
 * - Delete configurations
 * - Test connections
 * - Set default configuration
 */

import { appStore } from '/client/appState.js';
import {
    publishConfigActions,
    publishConfigThunks,
    selectAllConfigurations,
    selectEditingConfig,
    selectConfigManagerState
} from '/client/store/slices/publishConfigSlice.js';

export class ConfigManager {
    constructor() {
        this.modalElement = null;
        this.unsubscribe = null;
        this.editingId = null;
        this.formData = this.getEmptyFormData();
        this.isSaving = false; // Prevent form updates during save
    }

    /**
     * Get empty form data structure
     */
    getEmptyFormData() {
        return {
            name: '',
            endpoint: '',
            region: '',
            bucket: '',
            accessKey: '',
            secretKey: '',
            prefix: 'published/',
            baseUrl: '',
            themeUrl: '',
            themeName: '',
            inlineCSS: true,
            isDefault: false
        };
    }

    /**
     * Open the configuration manager modal
     */
    open() {
        if (this.modalElement) {
            this.modalElement.style.display = 'flex';
            return;
        }

        this.render();
        this.subscribeToStore();
        this.attachEventListeners();
    }

    /**
     * Close the configuration manager modal
     */
    close() {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
        }
        appStore.dispatch(publishConfigActions.closeConfigManager());
        this.editingId = null;
        this.formData = this.getEmptyFormData();
    }

    /**
     * Destroy the modal and clean up
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.modalElement && this.modalElement.parentNode) {
            this.modalElement.parentNode.removeChild(this.modalElement);
        }
        this.modalElement = null;
    }

    /**
     * Subscribe to Redux store updates
     */
    subscribeToStore() {
        this.unsubscribe = appStore.subscribe(() => {
            // Don't update form while saving to prevent clearing user input
            if (this.isSaving) {
                return;
            }

            const state = appStore.getState();
            const managerState = selectConfigManagerState(state);

            if (!managerState.showConfigManager && this.modalElement) {
                this.close();
            }

            if (managerState.editingConfigId !== this.editingId) {
                this.editingId = managerState.editingConfigId;
                this.loadEditingConfig();
            }

            this.updateConfigList();
            this.updateTestResult();
        });
    }

    /**
     * Load configuration being edited into form
     */
    loadEditingConfig() {
        if (!this.editingId) {
            this.formData = this.getEmptyFormData();
            this.updateForm();
            return;
        }

        const state = appStore.getState();
        const config = selectEditingConfig(state);

        if (config) {
            this.formData = { ...config };
            this.updateForm();
        }
    }

    /**
     * Render the modal
     */
    render() {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'config-manager-modal';
        this.modalElement.innerHTML = `
            <div class="config-manager-backdrop"></div>
            <div class="config-manager-container">
                <div class="config-manager-header">
                    <h2>Manage Publish Configurations</h2>
                    <button class="config-manager-close" data-action="close">×</button>
                </div>

                <div class="config-manager-body">
                    <!-- Left Panel: Configuration List -->
                    <div class="config-manager-list">
                        <div class="config-list-header">
                            <h3>Configurations</h3>
                            <button class="btn-new-config" data-action="new">+ New</button>
                        </div>
                        <div class="config-list-items" data-region="config-list">
                            <!-- Populated by updateConfigList() -->
                        </div>
                    </div>

                    <!-- Right Panel: Configuration Form -->
                    <div class="config-manager-form">
                        <h3 data-region="form-title">New Configuration</h3>

                        <form data-region="config-form">
                            <div class="form-group">
                                <label for="config-name">Name *</label>
                                <input type="text" id="config-name" name="name" required placeholder="My CDN Config">
                            </div>

                            <div class="form-group">
                                <label for="config-endpoint">Endpoint *</label>
                                <input type="url" id="config-endpoint" name="endpoint" required
                                       placeholder="https://devpages.sfo3.digitaloceanspaces.com">
                                <small>Full URL to your S3-compatible endpoint</small>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="config-region">Region *</label>
                                    <input type="text" id="config-region" name="region" required placeholder="sfo3">
                                </div>

                                <div class="form-group">
                                    <label for="config-bucket">Bucket *</label>
                                    <input type="text" id="config-bucket" name="bucket" required placeholder="devpages">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="config-access-key">Access Key</label>
                                <input type="text" id="config-access-key" name="accessKey" placeholder="DO00XXXXXXXXXXXXX">
                                <small>Optional if using server-side credentials</small>
                            </div>

                            <div class="form-group">
                                <label for="config-secret-key">Secret Key</label>
                                <input type="password" id="config-secret-key" name="secretKey" placeholder="••••••••••••">
                                <small>Optional if using server-side credentials</small>
                            </div>

                            <div class="form-group">
                                <label for="config-prefix">Path Prefix</label>
                                <input type="text" id="config-prefix" name="prefix" placeholder="published/">
                                <small>Folder path within bucket (e.g., "published/")</small>
                            </div>

                            <div class="form-group">
                                <label for="config-base-url">Base URL</label>
                                <input type="url" id="config-base-url" name="baseUrl"
                                       placeholder="https://devpages.sfo3.cdn.digitaloceanspaces.com">
                                <small>Public CDN URL for published files</small>
                            </div>

                            <div class="form-group">
                                <label for="config-theme-url">Theme URL</label>
                                <input type="url" id="config-theme-url" name="themeUrl" placeholder="">
                                <small>Optional: URL to custom theme CSS</small>
                            </div>

                            <div class="form-group">
                                <label for="config-theme-name">Theme Name</label>
                                <input type="text" id="config-theme-name" name="themeName" placeholder="default">
                                <small>Optional: Name of theme to apply</small>
                            </div>

                            <div class="form-group form-checkbox">
                                <label>
                                    <input type="checkbox" id="config-inline-css" name="inlineCSS" checked>
                                    Inline CSS (recommended for better portability)
                                </label>
                            </div>

                            <div class="form-group form-checkbox">
                                <label>
                                    <input type="checkbox" id="config-is-default" name="isDefault">
                                    Set as default configuration
                                </label>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
                                <button type="button" class="btn-test" data-action="test">Test Connection</button>
                                <button type="submit" class="btn-primary" data-action="save">Save Configuration</button>
                            </div>

                            <div class="test-result" data-region="test-result" style="display: none;">
                                <!-- Test result will be shown here -->
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);
        this.updateConfigList();
    }

    /**
     * Update the configuration list
     */
    updateConfigList() {
        if (!this.modalElement) return;

        const listContainer = this.modalElement.querySelector('[data-region="config-list"]');
        if (!listContainer) return;

        const state = appStore.getState();
        const configurations = selectAllConfigurations(state);

        if (configurations.length === 0) {
            listContainer.innerHTML = '<p class="config-list-empty">No configurations yet. Click "+ New" to create one.</p>';
            return;
        }

        listContainer.innerHTML = configurations.map(config => `
            <div class="config-list-item ${config.id === this.editingId ? 'active' : ''}" data-config-id="${config.id}">
                <div class="config-item-header">
                    <span class="config-item-name">${this.escapeHtml(config.name)}</span>
                    ${config.isDefault ? '<span class="config-item-badge">Default</span>' : ''}
                </div>
                <div class="config-item-details">
                    <small>${this.escapeHtml(config.endpoint)}</small>
                </div>
                <div class="config-item-actions">
                    <button class="btn-icon" data-action="edit" data-config-id="${config.id}" title="Edit">✏️</button>
                    <button class="btn-icon" data-action="delete" data-config-id="${config.id}" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Update the form with current formData
     */
    updateForm() {
        if (!this.modalElement) return;

        const form = this.modalElement.querySelector('[data-region="config-form"]');
        if (!form) return;

        // Update form title
        const titleElement = this.modalElement.querySelector('[data-region="form-title"]');
        if (titleElement) {
            titleElement.textContent = this.editingId ? 'Edit Configuration' : 'New Configuration';
        }

        // Update form fields
        Object.keys(this.formData).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = this.formData[key];
                } else {
                    input.value = this.formData[key] || '';
                }
            }
        });
    }

    /**
     * Update test result display
     */
    updateTestResult() {
        if (!this.modalElement) return;

        const resultContainer = this.modalElement.querySelector('[data-region="test-result"]');
        if (!resultContainer) return;

        const state = appStore.getState();
        const managerState = selectConfigManagerState(state);

        if (managerState.isTestingConnection) {
            resultContainer.innerHTML = '<div class="test-result-loading">Testing connection...</div>';
            resultContainer.style.display = 'block';
            return;
        }

        if (!managerState.testResult) {
            resultContainer.style.display = 'none';
            return;
        }

        const result = managerState.testResult;
        const className = result.success ? 'test-result-success' : 'test-result-error';

        let content = `<div class="${className}">
            <strong>${result.success ? '✅' : '❌'} ${result.message}</strong>
        `;

        if (result.errors && result.errors.length > 0) {
            content += '<ul>' + result.errors.map(err => `<li>${this.escapeHtml(err)}</li>`).join('') + '</ul>';
        }

        if (result.details) {
            content += '<pre>' + JSON.stringify(result.details, null, 2) + '</pre>';
        }

        content += '</div>';
        resultContainer.innerHTML = content;
        resultContainer.style.display = 'block';
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.modalElement) return;

        // Close button
        this.modalElement.querySelector('[data-action="close"]')?.addEventListener('click', () => {
            this.close();
        });

        // Backdrop click
        this.modalElement.querySelector('.config-manager-backdrop')?.addEventListener('click', () => {
            this.close();
        });

        // New config button
        this.modalElement.querySelector('[data-action="new"]')?.addEventListener('click', () => {
            this.handleNew();
        });

        // Cancel button
        this.modalElement.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
            this.handleCancel();
        });

        // Test button
        this.modalElement.querySelector('[data-action="test"]')?.addEventListener('click', () => {
            this.handleTest();
        });

        // Form submission
        this.modalElement.querySelector('[data-region="config-form"]')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });

        // List item actions (event delegation)
        this.modalElement.querySelector('[data-region="config-list"]')?.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const configId = button.dataset.configId;

            if (action === 'edit' && configId) {
                this.handleEdit(configId);
            } else if (action === 'delete' && configId) {
                this.handleDelete(configId);
            }
        });

        // Form input changes
        this.modalElement.querySelector('[data-region="config-form"]')?.addEventListener('input', (e) => {
            const input = e.target;
            const name = input.name;

            if (name) {
                if (input.type === 'checkbox') {
                    this.formData[name] = input.checked;
                } else {
                    this.formData[name] = input.value;
                }
            }
        });
    }

    /**
     * Handle new configuration
     */
    handleNew() {
        appStore.dispatch(publishConfigActions.stopEditingConfig());
        appStore.dispatch(publishConfigActions.clearTestResult());
        this.editingId = null;
        this.formData = this.getEmptyFormData();
        this.updateForm();
        this.updateConfigList();
    }

    /**
     * Handle edit configuration
     */
    handleEdit(configId) {
        appStore.dispatch(publishConfigActions.startEditingConfig(configId));
    }

    /**
     * Handle delete configuration
     */
    handleDelete(configId) {
        const state = appStore.getState();
        const configurations = selectAllConfigurations(state);
        const config = configurations.find(c => c.id === configId);

        if (!config) return;

        const confirmed = confirm(`Are you sure you want to delete "${config.name}"?`);
        if (confirmed) {
            appStore.dispatch(publishConfigActions.deleteConfiguration(configId));

            if (this.editingId === configId) {
                this.handleCancel();
            }
        }
    }

    /**
     * Handle cancel editing
     */
    handleCancel() {
        appStore.dispatch(publishConfigActions.stopEditingConfig());
        appStore.dispatch(publishConfigActions.clearTestResult());
        this.editingId = null;
        this.formData = this.getEmptyFormData();
        this.updateForm();
        this.updateConfigList();
    }

    /**
     * Handle test connection
     */
    async handleTest() {
        // Validate required fields
        const errors = this.validateFormData();
        if (errors.length > 0) {
            appStore.dispatch(publishConfigActions.setTestResult({
                success: false,
                message: 'Please fill in all required fields',
                errors
            }));
            return;
        }

        // Create a temporary config ID for testing
        const testId = this.editingId || 'temp-test';

        // If not editing, create a temporary config for testing
        if (!this.editingId) {
            appStore.dispatch(publishConfigActions.addConfiguration({
                id: testId,
                ...this.formData
            }));
        }

        // Test the configuration
        await appStore.dispatch(publishConfigThunks.testConfiguration(testId));

        // Remove temporary config if it was created
        if (!this.editingId) {
            appStore.dispatch(publishConfigActions.deleteConfiguration(testId));
        }
    }

    /**
     * Handle save configuration
     */
    handleSave() {
        // Validate form data
        const errors = this.validateFormData();
        if (errors.length > 0) {
            alert('Please fill in all required fields:\n' + errors.join('\n'));
            return;
        }

        // Set flag to prevent subscription from clearing form during save
        this.isSaving = true;

        let savedConfigId;

        if (this.editingId) {
            // Update existing configuration
            appStore.dispatch(publishConfigActions.updateConfiguration({
                id: this.editingId,
                updates: this.formData
            }));
            savedConfigId = this.editingId;
        } else {
            // Create new configuration - need to get the ID from the action
            appStore.dispatch(publishConfigActions.addConfiguration(this.formData));
            // Get the newly created config ID
            const newState = appStore.getState();
            const configs = selectAllConfigurations(newState);
            savedConfigId = configs[configs.length - 1]?.id;
        }

        // Clear test result
        appStore.dispatch(publishConfigActions.clearTestResult());

        // Update local state to keep the saved config in editing mode
        // Do this BEFORE resetting isSaving to prevent subscription interference
        this.editingId = savedConfigId;

        // Re-enable subscription updates
        this.isSaving = false;

        // Now update the UI - subscription is now active and will handle form population
        this.updateConfigList();

        // Only dispatch startEditingConfig if we're not already editing this config
        // This prevents the infinite loop
        const state = appStore.getState();
        const managerState = selectConfigManagerState(state);
        if (managerState.editingConfigId !== savedConfigId) {
            appStore.dispatch(publishConfigActions.startEditingConfig(savedConfigId));
        }
    }

    /**
     * Validate form data
     */
    validateFormData() {
        const errors = [];

        if (!this.formData.name || this.formData.name.trim() === '') {
            errors.push('Name is required');
        }

        if (!this.formData.endpoint || this.formData.endpoint.trim() === '') {
            errors.push('Endpoint is required');
        }

        if (!this.formData.region || this.formData.region.trim() === '') {
            errors.push('Region is required');
        }

        if (!this.formData.bucket || this.formData.bucket.trim() === '') {
            errors.push('Bucket is required');
        }

        return errors;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create singleton instance
export const configManager = new ConfigManager();
