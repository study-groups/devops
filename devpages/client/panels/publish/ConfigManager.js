/**
 * ConfigManager.js - Modal for managing publish configurations
 *
 * Improved UX with:
 * - Section grouping (Connection, Credentials, Output Options)
 * - Env var hints showing actual variable names
 * - "Use Server Defaults" button
 * - Inline validation errors
 * - Better test result panel
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
        this.isSaving = false;
        this.validationErrors = {};
        this.collapsedSections = {};
    }

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
            inlineCSS: true,
            isDefault: false
        };
    }

    open() {
        if (this.modalElement) {
            this.modalElement.style.display = 'flex';
            return;
        }

        this.render();
        this.subscribeToStore();
        this.attachEventListeners();
    }

    close() {
        if (this.modalElement) {
            this.modalElement.style.display = 'none';
        }
        appStore.dispatch(publishConfigActions.closeConfigManager());
        this.editingId = null;
        this.formData = this.getEmptyFormData();
        this.validationErrors = {};
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.modalElement && this.modalElement.parentNode) {
            this.modalElement.parentNode.removeChild(this.modalElement);
        }
        this.modalElement = null;
    }

    subscribeToStore() {
        this.unsubscribe = appStore.subscribe(() => {
            if (this.isSaving) return;

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

    loadEditingConfig() {
        if (!this.editingId) {
            this.formData = this.getEmptyFormData();
            this.validationErrors = {};
            this.updateForm();
            return;
        }

        const state = appStore.getState();
        const config = selectEditingConfig(state);

        if (config) {
            this.formData = { ...config };
            this.validationErrors = {};
            this.updateForm();
        }
    }

    render() {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'config-manager-modal';
        this.modalElement.innerHTML = `
            <div class="config-manager-backdrop"></div>
            <div class="config-manager-container">
                <div class="config-manager-header">
                    <h2>Manage Publish Configurations</h2>
                    <button class="config-manager-close" data-action="close">&times;</button>
                </div>

                <div class="config-manager-body">
                    <!-- Left Panel: Configuration List -->
                    <div class="config-manager-list">
                        <div class="config-list-header">
                            <h3>Configurations</h3>
                            <button class="btn-new-config" data-action="new">+ New</button>
                        </div>
                        <div class="config-list-items" data-region="config-list"></div>
                    </div>

                    <!-- Right Panel: Configuration Form -->
                    <div class="config-manager-form">
                        <div class="form-header-row">
                            <h3 data-region="form-title">New Configuration</h3>
                            <button class="btn-server-defaults" data-action="load-defaults" title="Load settings from server environment">
                                Use Server Defaults
                            </button>
                        </div>

                        <form data-region="config-form">
                            <!-- Name Field -->
                            <div class="form-group">
                                <label for="config-name">Configuration Name *</label>
                                <input type="text" id="config-name" name="name" required placeholder="My CDN Config">
                                <div class="field-error" data-error="name"></div>
                            </div>

                            <!-- CONNECTION Section -->
                            <div class="form-section" data-section="connection">
                                <div class="section-header" data-action="toggle-section" data-target="connection">
                                    <span class="section-icon">&#x1F517;</span>
                                    <span class="section-title">CONNECTION</span>
                                    <span class="section-toggle">&#9662;</span>
                                </div>
                                <div class="section-content">
                                    <div class="form-group">
                                        <label for="config-endpoint">
                                            Endpoint *
                                            <span class="env-hint">DO_SPACES_ENDPOINT</span>
                                        </label>
                                        <input type="url" id="config-endpoint" name="endpoint" required
                                               placeholder="https://sfo3.digitaloceanspaces.com">
                                        <small>Full URL to your S3-compatible endpoint</small>
                                        <div class="field-error" data-error="endpoint"></div>
                                    </div>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="config-region">
                                                Region *
                                                <span class="env-hint">DO_SPACES_REGION</span>
                                            </label>
                                            <input type="text" id="config-region" name="region" required placeholder="sfo3">
                                            <div class="field-error" data-error="region"></div>
                                        </div>

                                        <div class="form-group">
                                            <label for="config-bucket">
                                                Bucket *
                                                <span class="env-hint">DO_SPACES_BUCKET</span>
                                            </label>
                                            <input type="text" id="config-bucket" name="bucket" required placeholder="devpages">
                                            <div class="field-error" data-error="bucket"></div>
                                        </div>
                                    </div>

                                    <button type="button" class="btn-test-inline" data-action="test">
                                        Test Connection
                                    </button>
                                </div>
                            </div>

                            <!-- CREDENTIALS Section -->
                            <div class="form-section" data-section="credentials">
                                <div class="section-header" data-action="toggle-section" data-target="credentials">
                                    <span class="section-icon">&#x1F511;</span>
                                    <span class="section-title">CREDENTIALS</span>
                                    <span class="section-toggle">&#9662;</span>
                                </div>
                                <div class="section-content">
                                    <div class="form-group">
                                        <label for="config-access-key">
                                            Access Key
                                            <span class="env-hint">DO_SPACES_KEY</span>
                                        </label>
                                        <input type="text" id="config-access-key" name="accessKey" placeholder="DO00XXXXXXXXXXXXX">
                                        <small>Optional if server has credentials configured</small>
                                    </div>

                                    <div class="form-group">
                                        <label for="config-secret-key">
                                            Secret Key
                                            <span class="env-hint">DO_SPACES_SECRET</span>
                                        </label>
                                        <input type="password" id="config-secret-key" name="secretKey" placeholder="Leave blank to use server credentials">
                                        <small>Optional if server has credentials configured</small>
                                    </div>
                                </div>
                            </div>

                            <!-- OUTPUT OPTIONS Section -->
                            <div class="form-section" data-section="output">
                                <div class="section-header" data-action="toggle-section" data-target="output">
                                    <span class="section-icon">&#x1F4C4;</span>
                                    <span class="section-title">OUTPUT OPTIONS</span>
                                    <span class="section-toggle">&#9662;</span>
                                </div>
                                <div class="section-content">
                                    <div class="form-group">
                                        <label for="config-prefix">Path Prefix</label>
                                        <input type="text" id="config-prefix" name="prefix" placeholder="published/">
                                        <small>Folder path within bucket (e.g., "published/")</small>
                                    </div>

                                    <div class="form-group">
                                        <label for="config-base-url">
                                            CDN Base URL
                                            <span class="env-hint">PUBLISH_BASE_URL</span>
                                        </label>
                                        <input type="url" id="config-base-url" name="baseUrl"
                                               placeholder="https://devpages.sfo3.cdn.digitaloceanspaces.com">
                                        <small>Public CDN URL for published files</small>
                                    </div>

                                    <div class="form-group">
                                        <label for="config-theme-url">Theme URL</label>
                                        <input type="url" id="config-theme-url" name="themeUrl" placeholder="">
                                        <small>Optional: URL to custom theme CSS</small>
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
                                </div>
                            </div>

                            <!-- Test Result -->
                            <div class="test-result" data-region="test-result" style="display: none;"></div>

                            <!-- Form Actions -->
                            <div class="form-actions">
                                <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
                                <button type="submit" class="btn-primary" data-action="save">Save Configuration</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);
        this.updateConfigList();
    }

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
                    <small>${this.escapeHtml(config.endpoint || 'No endpoint set')}</small>
                </div>
                <div class="config-item-actions">
                    <button class="btn-icon" data-action="edit" data-config-id="${config.id}" title="Edit">&#x270F;&#xFE0F;</button>
                    <button class="btn-icon" data-action="delete" data-config-id="${config.id}" title="Delete">&#x1F5D1;&#xFE0F;</button>
                </div>
            </div>
        `).join('');
    }

    updateForm() {
        if (!this.modalElement) return;

        const form = this.modalElement.querySelector('[data-region="config-form"]');
        if (!form) return;

        const titleElement = this.modalElement.querySelector('[data-region="form-title"]');
        if (titleElement) {
            titleElement.textContent = this.editingId ? 'Edit Configuration' : 'New Configuration';
        }

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

        // Clear validation errors
        this.clearValidationErrors();
    }

    updateTestResult() {
        if (!this.modalElement) return;

        const resultContainer = this.modalElement.querySelector('[data-region="test-result"]');
        if (!resultContainer) return;

        const state = appStore.getState();
        const managerState = selectConfigManagerState(state);

        if (managerState.isTestingConnection) {
            resultContainer.innerHTML = `
                <div class="test-result-loading">
                    <span class="loading-spinner"></span>
                    Testing connection...
                </div>
            `;
            resultContainer.style.display = 'block';
            return;
        }

        if (!managerState.testResult) {
            resultContainer.style.display = 'none';
            return;
        }

        const result = managerState.testResult;
        const className = result.success ? 'test-result-success' : 'test-result-error';
        const icon = result.success ? '&#x2705;' : '&#x274C;';

        let content = `<div class="${className}">
            <div class="test-result-header">
                <span class="test-icon">${icon}</span>
                <strong>${result.message}</strong>
            </div>
        `;

        if (result.errors && result.errors.length > 0) {
            content += '<ul class="test-errors">' + result.errors.map(err => `<li>${this.escapeHtml(err)}</li>`).join('') + '</ul>';
        }

        if (result.details && result.success) {
            content += `
                <div class="test-details">
                    <div class="test-detail-row"><span>Endpoint:</span> ${this.escapeHtml(result.details.endpoint || 'N/A')}</div>
                    <div class="test-detail-row"><span>Bucket:</span> ${this.escapeHtml(result.details.bucket || 'N/A')}</div>
                    <div class="test-detail-row"><span>Region:</span> ${this.escapeHtml(result.details.region || 'N/A')}</div>
                </div>
            `;
        }

        content += '</div>';
        resultContainer.innerHTML = content;
        resultContainer.style.display = 'block';
    }

    attachEventListeners() {
        if (!this.modalElement) return;

        // Close button
        this.modalElement.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close());

        // Backdrop click
        this.modalElement.querySelector('.config-manager-backdrop')?.addEventListener('click', () => this.close());

        // New config button
        this.modalElement.querySelector('[data-action="new"]')?.addEventListener('click', () => this.handleNew());

        // Cancel button
        this.modalElement.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.handleCancel());

        // Test button (inline)
        this.modalElement.querySelector('[data-action="test"]')?.addEventListener('click', () => this.handleTest());

        // Load server defaults button
        this.modalElement.querySelector('[data-action="load-defaults"]')?.addEventListener('click', () => this.handleLoadDefaults());

        // Form submission
        this.modalElement.querySelector('[data-region="config-form"]')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });

        // Section toggle
        this.modalElement.querySelectorAll('[data-action="toggle-section"]').forEach(header => {
            header.addEventListener('click', (e) => {
                const sectionName = e.currentTarget.dataset.target;
                this.toggleSection(sectionName);
            });
        });

        // List item actions
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
                // Clear validation error for this field
                this.clearFieldError(name);
            }
        });
    }

    toggleSection(sectionName) {
        const section = this.modalElement.querySelector(`[data-section="${sectionName}"]`);
        if (section) {
            section.classList.toggle('collapsed');
            this.collapsedSections[sectionName] = section.classList.contains('collapsed');
        }
    }

    async handleLoadDefaults() {
        try {
            const response = await fetch('/api/spaces/config');
            const result = await response.json();

            if (result.success && result.config) {
                const config = result.config;

                // Only update fields that have values from server
                if (config.endpointValue && config.endpointValue !== 'Not Set') {
                    this.formData.endpoint = config.endpointValue;
                }
                if (config.regionValue && config.regionValue !== 'Not Set') {
                    this.formData.region = config.regionValue;
                }
                if (config.bucketValue && config.bucketValue !== 'Not Set') {
                    this.formData.bucket = config.bucketValue;
                }
                if (config.publishBaseUrlValue && config.publishBaseUrlValue !== 'Not Set') {
                    this.formData.baseUrl = config.publishBaseUrlValue;
                }

                this.updateForm();

                // Show success message
                appStore.dispatch(publishConfigActions.setTestResult({
                    success: true,
                    message: 'Server defaults loaded successfully'
                }));
            } else {
                appStore.dispatch(publishConfigActions.setTestResult({
                    success: false,
                    message: 'No server defaults available',
                    errors: ['Server environment variables may not be configured']
                }));
            }
        } catch (error) {
            appStore.dispatch(publishConfigActions.setTestResult({
                success: false,
                message: 'Failed to load server defaults',
                errors: [error.message]
            }));
        }
    }

    handleNew() {
        appStore.dispatch(publishConfigActions.stopEditingConfig());
        appStore.dispatch(publishConfigActions.clearTestResult());
        this.editingId = null;
        this.formData = this.getEmptyFormData();
        this.validationErrors = {};
        this.updateForm();
        this.updateConfigList();
    }

    handleEdit(configId) {
        appStore.dispatch(publishConfigActions.startEditingConfig(configId));
    }

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

    handleCancel() {
        appStore.dispatch(publishConfigActions.stopEditingConfig());
        appStore.dispatch(publishConfigActions.clearTestResult());
        this.editingId = null;
        this.formData = this.getEmptyFormData();
        this.validationErrors = {};
        this.updateForm();
        this.updateConfigList();
    }

    async handleTest() {
        const errors = this.validateFormData();
        if (errors.length > 0) {
            this.showValidationErrors(errors);
            appStore.dispatch(publishConfigActions.setTestResult({
                success: false,
                message: 'Please fill in required fields',
                errors
            }));
            return;
        }

        const testId = this.editingId || 'temp-test';

        if (!this.editingId) {
            appStore.dispatch(publishConfigActions.addConfiguration({
                id: testId,
                ...this.formData
            }));
        }

        await appStore.dispatch(publishConfigThunks.testConfiguration(testId));

        if (!this.editingId) {
            appStore.dispatch(publishConfigActions.deleteConfiguration(testId));
        }
    }

    handleSave() {
        const errors = this.validateFormData();
        if (errors.length > 0) {
            this.showValidationErrors(errors);
            return;
        }

        this.isSaving = true;

        let savedConfigId;

        if (this.editingId) {
            appStore.dispatch(publishConfigActions.updateConfiguration({
                id: this.editingId,
                updates: this.formData
            }));
            savedConfigId = this.editingId;
        } else {
            appStore.dispatch(publishConfigActions.addConfiguration(this.formData));
            const newState = appStore.getState();
            const configs = selectAllConfigurations(newState);
            savedConfigId = configs[configs.length - 1]?.id;
        }

        appStore.dispatch(publishConfigActions.clearTestResult());
        this.editingId = savedConfigId;
        this.isSaving = false;
        this.updateConfigList();

        const state = appStore.getState();
        const managerState = selectConfigManagerState(state);
        if (managerState.editingConfigId !== savedConfigId) {
            appStore.dispatch(publishConfigActions.startEditingConfig(savedConfigId));
        }
    }

    validateFormData() {
        const errors = [];

        if (!this.formData.name || this.formData.name.trim() === '') {
            errors.push({ field: 'name', message: 'Name is required' });
        }

        if (!this.formData.endpoint || this.formData.endpoint.trim() === '') {
            errors.push({ field: 'endpoint', message: 'Endpoint is required' });
        }

        if (!this.formData.region || this.formData.region.trim() === '') {
            errors.push({ field: 'region', message: 'Region is required' });
        }

        if (!this.formData.bucket || this.formData.bucket.trim() === '') {
            errors.push({ field: 'bucket', message: 'Bucket is required' });
        }

        return errors;
    }

    showValidationErrors(errors) {
        this.clearValidationErrors();

        errors.forEach(({ field, message }) => {
            this.validationErrors[field] = message;

            const input = this.modalElement.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('input-error');
            }

            const errorElement = this.modalElement.querySelector(`[data-error="${field}"]`);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
        });
    }

    clearValidationErrors() {
        this.validationErrors = {};

        this.modalElement.querySelectorAll('.input-error').forEach(el => {
            el.classList.remove('input-error');
        });

        this.modalElement.querySelectorAll('.field-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    clearFieldError(fieldName) {
        delete this.validationErrors[fieldName];

        const input = this.modalElement.querySelector(`[name="${fieldName}"]`);
        if (input) {
            input.classList.remove('input-error');
        }

        const errorElement = this.modalElement.querySelector(`[data-error="${fieldName}"]`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export const configManager = new ConfigManager();
