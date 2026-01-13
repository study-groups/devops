/**
 * AppSettingsPanel.js - Application Settings Panel
 *
 * General settings panel including:
 * - Data Mount Points management
 * - Application preferences
 * - Publishing configurations overview
 */

import { BasePanel, panelRegistry } from './BasePanel.js';
import { appStore } from '../appState.js';
import {
    dataMountActions,
    dataMountThunks,
    selectAllMountPoints,
    selectActiveMountPoint
} from '../store/slices/dataMountSlice.js';

const log = window.APP?.services?.log?.createLogger('UI', 'AppSettingsPanel') || {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
};

export class AppSettingsPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'app-settings',
            title: 'Settings',
            defaultWidth: 500,
            defaultHeight: 600,
            ...config
        });

        this.boundRefresh = this.refresh.bind(this);
    }

    renderContent() {
        const state = appStore.getState();
        const mountPoints = selectAllMountPoints(state) || [];
        const activeMountPoint = selectActiveMountPoint(state);

        return `
            <div class="app-settings-panel">
                <div class="settings-toolbar">
                    <h3 class="settings-title">Application Settings</h3>
                </div>

                <div class="settings-sections">
                    <!-- Data Mount Points Section -->
                    <div class="settings-section">
                        <div class="section-header" data-section="mounts">
                            <span class="section-caret">&#9662;</span>
                            <span class="section-title">Data Mount Points</span>
                            <span class="section-badge">${mountPoints.length}</span>
                        </div>
                        <div class="section-content" id="mounts-content">
                            <div class="section-description">
                                Configure directories as data mount points. Each can have its own
                                <code>pdata.json</code> with publishing configurations.
                            </div>

                            <div class="mount-list">
                                ${mountPoints.length === 0 ? `
                                    <div class="mount-empty">No mount points configured</div>
                                ` : mountPoints.map(mount => `
                                    <div class="mount-item ${mount.isActive ? 'active' : ''}" data-mount-id="${mount.id}">
                                        <div class="mount-info">
                                            <div class="mount-name">
                                                ${mount.name}
                                                ${mount.isDefault ? '<span class="mount-badge default">Default</span>' : ''}
                                                ${mount.isActive ? '<span class="mount-badge active">Active</span>' : ''}
                                            </div>
                                            <div class="mount-path">${mount.path}</div>
                                            ${mount.metadata?.description ? `
                                                <div class="mount-meta">${mount.metadata.description}</div>
                                            ` : ''}
                                            ${mount.publishConfigs?.length > 0 ? `
                                                <div class="mount-configs">${mount.publishConfigs.length} publish config(s)</div>
                                            ` : ''}
                                        </div>
                                        <div class="mount-actions">
                                            ${!mount.isActive ? `
                                                <button class="settings-btn small" data-action="select-mount" data-mount-id="${mount.id}">
                                                    Select
                                                </button>
                                            ` : ''}
                                            ${!mount.isDefault ? `
                                                <button class="settings-btn small danger" data-action="remove-mount" data-mount-id="${mount.id}">
                                                    Remove
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="add-mount-form">
                                <div class="form-row">
                                    <input type="text" id="mount-path-input" class="settings-input" placeholder="Directory path..." />
                                </div>
                                <div class="form-row">
                                    <input type="text" id="mount-name-input" class="settings-input" placeholder="Display name (optional)" />
                                </div>
                                <div class="form-row" style="display: flex; align-items: center; gap: 12px;">
                                    <button class="settings-btn primary" id="add-mount-btn">Add Mount Point</button>
                                    <span id="mount-form-error" class="form-error"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Application Info Section -->
                    <div class="settings-section">
                        <div class="section-header" data-section="info">
                            <span class="section-caret">&#9662;</span>
                            <span class="section-title">Application Info</span>
                        </div>
                        <div class="section-content" id="info-content">
                            <div class="info-grid">
                                <div class="info-row">
                                    <span class="info-label">Active Mount:</span>
                                    <span class="info-value">${activeMountPoint?.name || 'None'}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Data Path:</span>
                                    <span class="info-value mono">${activeMountPoint?.path || 'N/A'}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">PD_DIR:</span>
                                    <span class="info-value mono">${state.dataMount?.defaultDataPath || 'Not set'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <style>
                    .app-settings-panel {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        background: var(--color-bg-primary, #fff);
                    }

                    .settings-toolbar {
                        padding: 12px 16px;
                        border-bottom: 1px solid var(--color-border, #dee2e6);
                        background: var(--color-bg-secondary, #f8f9fa);
                    }

                    .settings-title {
                        margin: 0;
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--color-text-primary, #212529);
                    }

                    .settings-sections {
                        flex: 1;
                        overflow-y: auto;
                        padding: 16px;
                    }

                    .settings-section {
                        margin-bottom: 16px;
                        border: 1px solid var(--color-border, #dee2e6);
                        border-radius: 6px;
                        overflow: hidden;
                    }

                    .section-header {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 12px 16px;
                        background: var(--color-bg-secondary, #f8f9fa);
                        cursor: pointer;
                        user-select: none;
                    }

                    .section-header:hover {
                        background: var(--color-bg-tertiary, #e9ecef);
                    }

                    .section-caret {
                        font-size: 12px;
                        color: var(--color-text-secondary, #6c757d);
                        transition: transform 0.2s;
                    }

                    .section-header.collapsed .section-caret {
                        transform: rotate(-90deg);
                    }

                    .section-title {
                        flex: 1;
                        font-weight: 600;
                        font-size: 14px;
                    }

                    .section-badge {
                        padding: 2px 8px;
                        background: var(--color-accent, #007bff);
                        color: white;
                        border-radius: 10px;
                        font-size: 11px;
                    }

                    .section-content {
                        padding: 16px;
                        background: var(--color-bg-primary, #fff);
                    }

                    .section-header.collapsed + .section-content {
                        display: none;
                    }

                    .section-description {
                        font-size: 13px;
                        color: var(--color-text-secondary, #6c757d);
                        margin-bottom: 16px;
                        line-height: 1.5;
                    }

                    .section-description code {
                        background: var(--color-bg-secondary, #f8f9fa);
                        padding: 1px 4px;
                        border-radius: 3px;
                        font-size: 12px;
                    }

                    .mount-list {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        margin-bottom: 16px;
                    }

                    .mount-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px;
                        background: var(--color-bg-secondary, #f8f9fa);
                        border-radius: 6px;
                        border: 2px solid transparent;
                    }

                    .mount-item.active {
                        border-color: var(--color-accent, #007bff);
                        background: var(--color-bg-accent-light, #e7f1ff);
                    }

                    .mount-info {
                        flex: 1;
                        min-width: 0;
                    }

                    .mount-name {
                        font-weight: 600;
                        margin-bottom: 4px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .mount-badge {
                        font-size: 10px;
                        padding: 2px 6px;
                        border-radius: 10px;
                        font-weight: 500;
                    }

                    .mount-badge.default {
                        background: var(--color-bg-tertiary, #e9ecef);
                        color: var(--color-text-secondary, #6c757d);
                    }

                    .mount-badge.active {
                        background: var(--color-success, #28a745);
                        color: white;
                    }

                    .mount-path {
                        font-family: monospace;
                        font-size: 12px;
                        color: var(--color-text-secondary, #6c757d);
                        word-break: break-all;
                    }

                    .mount-meta, .mount-configs {
                        font-size: 11px;
                        color: var(--color-text-tertiary, #adb5bd);
                        margin-top: 4px;
                    }

                    .mount-actions {
                        display: flex;
                        gap: 8px;
                        margin-left: 12px;
                    }

                    .mount-empty {
                        text-align: center;
                        padding: 20px;
                        color: var(--color-text-secondary, #6c757d);
                        font-style: italic;
                    }

                    .add-mount-form {
                        padding-top: 16px;
                        border-top: 1px solid var(--color-border, #dee2e6);
                    }

                    .form-row {
                        margin-bottom: 8px;
                    }

                    .settings-input {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid var(--color-border, #ced4da);
                        border-radius: 4px;
                        font-size: 13px;
                        box-sizing: border-box;
                    }

                    .settings-input:focus {
                        outline: none;
                        border-color: var(--color-accent, #007bff);
                        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
                    }

                    .settings-btn {
                        padding: 8px 16px;
                        border: 1px solid var(--color-border, #ced4da);
                        border-radius: 4px;
                        background: var(--color-bg-primary, #fff);
                        font-size: 13px;
                        cursor: pointer;
                        transition: all 0.15s;
                    }

                    .settings-btn:hover {
                        background: var(--color-bg-secondary, #f8f9fa);
                    }

                    .settings-btn.primary {
                        background: var(--color-accent, #007bff);
                        color: white;
                        border-color: var(--color-accent, #007bff);
                    }

                    .settings-btn.primary:hover {
                        background: var(--color-accent-dark, #0056b3);
                    }

                    .settings-btn.small {
                        padding: 4px 10px;
                        font-size: 12px;
                    }

                    .settings-btn.danger {
                        color: var(--color-danger, #dc3545);
                        border-color: var(--color-danger, #dc3545);
                    }

                    .settings-btn.danger:hover {
                        background: var(--color-danger, #dc3545);
                        color: white;
                    }

                    .info-grid {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .info-row {
                        display: flex;
                        gap: 12px;
                    }

                    .info-label {
                        min-width: 100px;
                        font-weight: 500;
                        color: var(--color-text-secondary, #6c757d);
                        font-size: 13px;
                    }

                    .info-value {
                        color: var(--color-text-primary, #212529);
                        font-size: 13px;
                    }

                    .info-value.mono {
                        font-family: monospace;
                        font-size: 12px;
                    }

                    .form-error {
                        color: var(--color-danger, #dc3545);
                        font-size: 12px;
                    }
                </style>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);

        // Subscribe to store changes
        this.unsubscribe = appStore.subscribe(this.boundRefresh);

        // Initialize mount points if needed
        appStore.dispatch(dataMountThunks.initializeFromServer());

        this.attachEventListeners();
    }

    onUnmount() {
        super.onUnmount();
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    attachEventListeners() {
        const container = this.getContainer();
        if (!container) return;

        // Section collapse toggles
        container.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
            });
        });

        // Select mount button
        container.querySelectorAll('[data-action="select-mount"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mountId = btn.dataset.mountId;
                if (mountId) {
                    appStore.dispatch(dataMountThunks.switchToMountPoint(mountId));
                }
            });
        });

        // Remove mount button with inline confirmation
        container.querySelectorAll('[data-action="remove-mount"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mountId = btn.dataset.mountId;
                if (!mountId) return;

                // Two-click confirmation
                if (btn.dataset.confirming === 'true') {
                    appStore.dispatch(dataMountActions.removeMountPoint(mountId));
                } else {
                    btn.dataset.confirming = 'true';
                    const originalText = btn.textContent;
                    btn.textContent = 'Sure?';
                    setTimeout(() => {
                        if (btn.dataset.confirming === 'true') {
                            btn.dataset.confirming = 'false';
                            btn.textContent = originalText;
                        }
                    }, 2000);
                }
            });
        });

        // Add mount button with inline error
        const addMountBtn = container.querySelector('#add-mount-btn');
        const pathInput = container.querySelector('#mount-path-input');
        const nameInput = container.querySelector('#mount-name-input');
        const errorSpan = container.querySelector('#mount-form-error');

        const showError = (msg) => {
            if (errorSpan) errorSpan.textContent = msg;
        };
        const clearError = () => {
            if (errorSpan) errorSpan.textContent = '';
        };

        if (addMountBtn && pathInput) {
            pathInput.addEventListener('input', clearError);

            addMountBtn.addEventListener('click', async () => {
                const path = pathInput.value.trim();
                const name = nameInput?.value.trim() || '';

                if (!path) {
                    showError('Enter a directory path');
                    pathInput.focus();
                    return;
                }

                clearError();
                addMountBtn.disabled = true;
                addMountBtn.textContent = 'Adding...';

                const result = await appStore.dispatch(dataMountThunks.addAndLoadMountPoint(path, name));

                addMountBtn.disabled = false;
                addMountBtn.textContent = 'Add Mount Point';

                if (result.success) {
                    pathInput.value = '';
                    if (nameInput) nameInput.value = '';
                } else {
                    showError(result.error || 'Failed to add');
                }
            });
        }
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
panelRegistry.registerType('app-settings', AppSettingsPanel);

export default AppSettingsPanel;
