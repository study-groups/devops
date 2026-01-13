/**
 * DataMountsPanel.js - Sidebar panel for managing data mount points
 *
 * Displayed in the Settings category of the sidebar.
 * Provides a compact interface for:
 * - Viewing current mount points
 * - Switching active mount
 * - Adding new mount points
 * - Viewing pdata.json configurations
 */

import { BasePanel, panelRegistry } from './BasePanel.js';
import { appStore } from '../appState.js';
import {
    dataMountActions,
    dataMountThunks,
    selectAllMountPoints,
    selectActiveMountPoint
} from '../store/slices/dataMountSlice.js';

export class DataMountsPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'data-mounts',
            title: 'Data Mounts',
            defaultWidth: 350,
            defaultHeight: 400,
            ...config
        });

        this.boundRefresh = this.refresh.bind(this);
    }

    renderContent() {
        const state = appStore.getState();
        const mountPoints = selectAllMountPoints(state) || [];
        const activeMountPoint = selectActiveMountPoint(state);

        return `
            <div class="data-mounts-panel">
                <div class="mounts-header">
                    <span class="mounts-title">Mount Points</span>
                    <span class="mounts-count">${mountPoints.length}</span>
                </div>

                <div class="mounts-list">
                    ${mountPoints.length === 0 ? `
                        <div class="mounts-empty">No mount points configured</div>
                    ` : mountPoints.map(mount => `
                        <div class="mount-row ${mount.isActive ? 'active' : ''}" data-mount-id="${mount.id}">
                            <div class="mount-indicator ${mount.isActive ? 'active' : ''}"></div>
                            <div class="mount-details">
                                <div class="mount-name">
                                    ${mount.name}
                                    ${mount.isDefault ? '<span class="badge default">Default</span>' : ''}
                                </div>
                                <div class="mount-path" title="${mount.path}">${this.truncatePath(mount.path)}</div>
                                ${mount.publishConfigs?.length > 0 ? `
                                    <div class="mount-info">${mount.publishConfigs.length} publish config(s)</div>
                                ` : ''}
                            </div>
                            <div class="mount-actions">
                                ${!mount.isActive ? `
                                    <button class="mount-btn select" data-action="select" data-mount-id="${mount.id}" title="Select">
                                        <span>&#10003;</span>
                                    </button>
                                ` : ''}
                                ${!mount.isDefault ? `
                                    <button class="mount-btn remove" data-action="remove" data-mount-id="${mount.id}" title="Remove">
                                        <span>&times;</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="mounts-add">
                    <input type="text" id="mount-path" class="mount-input" placeholder="Directory path..." />
                    <input type="text" id="mount-name" class="mount-input" placeholder="Name (optional)" />
                    <div class="mount-add-row">
                        <button class="mount-add-btn" id="add-mount">+ Add</button>
                        <span id="mount-error" class="mount-error-msg"></span>
                    </div>
                </div>

                <style>
                    .data-mounts-panel {
                        font-size: 12px;
                    }

                    .mounts-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 0;
                        margin-bottom: 8px;
                        border-bottom: 1px solid var(--color-border, #ddd);
                    }

                    .mounts-title {
                        font-weight: 600;
                        color: var(--color-text-primary, #333);
                    }

                    .mounts-count {
                        background: var(--color-accent, #007bff);
                        color: white;
                        padding: 2px 8px;
                        border-radius: 10px;
                        font-size: 10px;
                    }

                    .mounts-list {
                        max-height: 200px;
                        overflow-y: auto;
                        margin-bottom: 12px;
                    }

                    .mount-row {
                        display: flex;
                        align-items: center;
                        padding: 8px;
                        margin-bottom: 4px;
                        background: var(--color-bg-secondary, #f8f9fa);
                        border-radius: 4px;
                        border: 1px solid transparent;
                    }

                    .mount-row.active {
                        border-color: var(--color-accent, #007bff);
                        background: var(--color-bg-accent-light, #e7f1ff);
                    }

                    .mount-indicator {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: var(--color-text-tertiary, #adb5bd);
                        margin-right: 10px;
                        flex-shrink: 0;
                    }

                    .mount-indicator.active {
                        background: var(--color-success, #28a745);
                    }

                    .mount-details {
                        flex: 1;
                        min-width: 0;
                    }

                    .mount-name {
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .badge {
                        font-size: 9px;
                        padding: 1px 5px;
                        border-radius: 8px;
                        font-weight: 400;
                    }

                    .badge.default {
                        background: var(--color-bg-tertiary, #e9ecef);
                        color: var(--color-text-secondary, #6c757d);
                    }

                    .mount-path {
                        font-family: monospace;
                        font-size: 10px;
                        color: var(--color-text-secondary, #6c757d);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .mount-info {
                        font-size: 9px;
                        color: var(--color-text-tertiary, #adb5bd);
                        margin-top: 2px;
                    }

                    .mount-actions {
                        display: flex;
                        gap: 4px;
                        margin-left: 8px;
                    }

                    .mount-btn {
                        width: 22px;
                        height: 22px;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        transition: all 0.15s;
                    }

                    .mount-btn.select {
                        background: var(--color-accent, #007bff);
                        color: white;
                    }

                    .mount-btn.select:hover {
                        background: var(--color-accent-dark, #0056b3);
                    }

                    .mount-btn.remove {
                        background: transparent;
                        border: 1px solid var(--color-border, #ddd);
                        color: var(--color-text-secondary, #6c757d);
                    }

                    .mount-btn.remove:hover {
                        background: var(--color-danger, #dc3545);
                        border-color: var(--color-danger, #dc3545);
                        color: white;
                    }

                    .mounts-empty {
                        text-align: center;
                        padding: 16px;
                        color: var(--color-text-secondary, #6c757d);
                        font-style: italic;
                    }

                    .mounts-add {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        padding-top: 8px;
                        border-top: 1px solid var(--color-border, #ddd);
                    }

                    .mount-input {
                        width: 100%;
                        padding: 6px 8px;
                        border: 1px solid var(--color-border, #ced4da);
                        border-radius: 3px;
                        font-size: 11px;
                        box-sizing: border-box;
                    }

                    .mount-input:focus {
                        outline: none;
                        border-color: var(--color-accent, #007bff);
                    }

                    .mount-add-btn {
                        padding: 6px 12px;
                        background: var(--color-accent, #007bff);
                        color: white;
                        border: none;
                        border-radius: 3px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: background 0.15s;
                    }

                    .mount-add-btn:hover {
                        background: var(--color-accent-dark, #0056b3);
                    }

                    .mount-add-btn:disabled {
                        background: var(--color-bg-disabled, #ccc);
                        cursor: not-allowed;
                    }

                    .mount-add-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .mount-error-msg {
                        color: var(--color-danger, #dc3545);
                        font-size: 11px;
                        display: none;
                    }

                    .mount-error-msg.visible {
                        display: inline;
                    }
                </style>
            </div>
        `;
    }

    truncatePath(path, maxLength = 35) {
        if (!path || path.length <= maxLength) return path;
        return '...' + path.slice(-(maxLength - 3));
    }

    onMount(container) {
        super.onMount(container);

        // Subscribe to store changes
        this.unsubscribe = appStore.subscribe(this.boundRefresh);

        // Initialize mount points if needed
        appStore.dispatch(dataMountThunks.initializeFromServer());

        this.attachEventListeners(container);
    }

    onUnmount() {
        super.onUnmount();
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    attachEventListeners(container) {
        if (!container) return;

        // Delegated event handling with inline confirmation
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const mountId = btn.dataset.mountId;

            if (action === 'select' && mountId) {
                appStore.dispatch(dataMountThunks.switchToMountPoint(mountId));
            } else if (action === 'remove' && mountId) {
                // Two-click confirmation: first click shows "Sure?", second click removes
                if (btn.dataset.confirming === 'true') {
                    appStore.dispatch(dataMountActions.removeMountPoint(mountId));
                } else {
                    btn.dataset.confirming = 'true';
                    btn.innerHTML = '<span style="font-size:9px">Sure?</span>';
                    btn.style.width = 'auto';
                    btn.style.padding = '2px 6px';
                    // Reset after 2 seconds if not clicked
                    setTimeout(() => {
                        if (btn.dataset.confirming === 'true') {
                            btn.dataset.confirming = 'false';
                            btn.innerHTML = '<span>&times;</span>';
                            btn.style.width = '22px';
                            btn.style.padding = '';
                        }
                    }, 2000);
                }
            }
        });

        // Add mount button
        const addBtn = container.querySelector('#add-mount');
        const pathInput = container.querySelector('#mount-path');
        const nameInput = container.querySelector('#mount-name');
        const errorSpan = container.querySelector('#mount-error');

        const showError = (msg) => {
            if (errorSpan) {
                errorSpan.textContent = msg;
                errorSpan.classList.add('visible');
            }
        };

        const clearError = () => {
            if (errorSpan) {
                errorSpan.textContent = '';
                errorSpan.classList.remove('visible');
            }
        };

        if (addBtn && pathInput) {
            pathInput.addEventListener('input', clearError);

            addBtn.addEventListener('click', async () => {
                const path = pathInput.value.trim();
                const name = nameInput?.value.trim() || '';

                if (!path) {
                    showError('Enter a directory path');
                    pathInput.focus();
                    return;
                }

                clearError();
                addBtn.disabled = true;
                addBtn.textContent = '...';

                const result = await appStore.dispatch(dataMountThunks.addAndLoadMountPoint(path, name));

                addBtn.disabled = false;
                addBtn.textContent = '+ Add';

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
            this.attachEventListeners(container);
        }
    }
}

// Register with panel registry
panelRegistry.registerType('data-mounts', DataMountsPanel);

export default DataMountsPanel;
