/**
 * AddMountDialog.js - Dialog for adding new mount points
 *
 * A modal dialog for adding new data mount points with path validation.
 * Uses the File System Access API when available for browsing.
 */

import { dispatch } from '../appState.js';
import { dataMountThunks } from '../store/slices/dataMountSlice.js';

export class AddMountDialog {
    static instance = null;
    static styleInjected = false;

    /**
     * Show the add mount dialog and return a promise that resolves with the result
     */
    static show() {
        return new Promise((resolve) => {
            const dialog = new AddMountDialog(resolve);
            dialog.open();
        });
    }

    constructor(resolve) {
        this.resolve = resolve;
        this.modal = null;
        this.isValidating = false;

        if (!AddMountDialog.styleInjected) {
            this.injectStyles();
            AddMountDialog.styleInjected = true;
        }
    }

    injectStyles() {
        const style = document.createElement('style');
        style.id = 'add-mount-dialog-styles';
        style.textContent = `
            .add-mount-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgb(0 0 0 / 50%);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: var(--z-modal-backdrop, 1040);
                animation: addMountFadeIn 150ms ease;
            }

            @keyframes addMountFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes addMountSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes addMountFadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }

            .add-mount-content {
                background: var(--color-bg-elevated, #ffffff);
                border-radius: var(--radius-xl, 12px);
                box-shadow: var(--shadow-xl);
                max-width: 500px;
                width: 90%;
                animation: addMountSlideIn 200ms ease;
            }

            .add-mount-header {
                padding: var(--space-6, 1.5rem);
                border-bottom: 1px solid var(--color-border);
                background: var(--color-bg-alt);
                border-radius: var(--radius-xl, 12px) var(--radius-xl, 12px) 0 0;
            }

            .add-mount-title {
                font-size: var(--font-size-lg, 1.125rem);
                font-weight: var(--font-weight-semibold, 600);
                color: var(--color-fg, #111827);
                margin: 0;
                display: flex;
                align-items: center;
                gap: var(--space-2, 0.5rem);
            }

            .add-mount-body {
                padding: var(--space-6, 1.5rem);
            }

            .add-mount-form-group {
                margin-bottom: var(--space-4, 1rem);
            }

            .add-mount-form-group:last-child {
                margin-bottom: 0;
            }

            .add-mount-label {
                display: block;
                font-size: var(--font-size-sm, 0.875rem);
                font-weight: var(--font-weight-medium, 500);
                color: var(--color-fg, #374151);
                margin-bottom: var(--space-2, 0.5rem);
            }

            .add-mount-input-row {
                display: flex;
                gap: var(--space-2, 0.5rem);
            }

            .add-mount-input {
                flex: 1;
                padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                border: 1px solid var(--color-border, #d1d5db);
                border-radius: var(--radius-md, 6px);
                font-size: var(--font-size-sm, 0.875rem);
                background: var(--color-bg, #ffffff);
                color: var(--color-fg, #111827);
                font-family: var(--font-mono);
            }

            .add-mount-input:focus {
                outline: none;
                border-color: var(--color-primary, #3b82f6);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .add-mount-input.error {
                border-color: var(--color-red-500, #ea5a5a);
            }

            .add-mount-browse-btn {
                padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                border: 1px solid var(--color-border, #d1d5db);
                border-radius: var(--radius-md, 6px);
                background: var(--color-bg-alt, #f9fafb);
                color: var(--color-fg, #374151);
                cursor: pointer;
                font-size: var(--font-size-sm, 0.875rem);
                white-space: nowrap;
            }

            .add-mount-browse-btn:hover {
                background: var(--color-bg-hover, #f3f4f6);
                border-color: var(--color-fg-muted, #9ca3af);
            }

            .add-mount-browse-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .add-mount-hint {
                font-size: var(--font-size-xs, 0.75rem);
                color: var(--color-fg-muted, #6b7280);
                margin-top: var(--space-1, 0.25rem);
            }

            .add-mount-error {
                font-size: var(--font-size-xs, 0.75rem);
                color: var(--color-red-500, #ea5a5a);
                margin-top: var(--space-1, 0.25rem);
            }

            .add-mount-footer {
                padding: var(--space-6, 1.5rem);
                border-top: 1px solid var(--color-border);
                display: flex;
                gap: var(--space-2, 0.5rem);
                justify-content: flex-end;
                background: var(--color-bg-alt);
                border-radius: 0 0 var(--radius-xl, 12px) var(--radius-xl, 12px);
            }

            .add-mount-btn {
                padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
                border-radius: var(--radius-md, 6px);
                font-size: var(--font-size-sm, 0.875rem);
                font-weight: var(--font-weight-medium, 500);
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 150ms ease;
                font-family: inherit;
            }

            .add-mount-btn:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .add-mount-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .add-mount-btn-cancel {
                background: var(--color-bg, #ffffff);
                color: var(--color-fg, #374151);
                border-color: var(--color-border, #d1d5db);
            }

            .add-mount-btn-cancel:hover:not(:disabled) {
                background: var(--color-bg-alt, #f9fafb);
                border-color: var(--color-fg-muted, #9ca3af);
            }

            .add-mount-btn-confirm {
                background: var(--color-primary, #3b82f6);
                color: #ffffff;
                border-color: var(--color-primary, #3b82f6);
            }

            .add-mount-btn-confirm:hover:not(:disabled) {
                background: var(--color-blue-600, #2563eb);
            }

            .add-mount-spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid transparent;
                border-top-color: currentColor;
                border-radius: 50%;
                animation: addMountSpin 0.8s linear infinite;
                margin-right: 6px;
            }

            @keyframes addMountSpin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    open() {
        this.modal = document.createElement('div');
        this.modal.className = 'add-mount-backdrop';

        const hasFSAPI = typeof window.showDirectoryPicker === 'function';

        this.modal.innerHTML = `
            <div class="add-mount-content">
                <div class="add-mount-header">
                    <h3 class="add-mount-title">Add Mount Point</h3>
                </div>
                <div class="add-mount-body">
                    <div class="add-mount-form-group">
                        <label class="add-mount-label">Directory Path</label>
                        <div class="add-mount-input-row">
                            <input type="text" class="add-mount-input" id="mount-path-input"
                                   placeholder="/absolute/path/to/directory">
                            ${hasFSAPI ? `
                                <button type="button" class="add-mount-browse-btn" data-action="browse">
                                    Browse
                                </button>
                            ` : ''}
                        </div>
                        <div class="add-mount-hint">Enter the absolute path to a directory containing data files</div>
                        <div class="add-mount-error" id="mount-path-error" style="display: none;"></div>
                    </div>
                    <div class="add-mount-form-group">
                        <label class="add-mount-label">Display Name (optional)</label>
                        <input type="text" class="add-mount-input" id="mount-name-input"
                               placeholder="My Data Directory">
                        <div class="add-mount-hint">A friendly name for this mount point</div>
                    </div>
                </div>
                <div class="add-mount-footer">
                    <button class="add-mount-btn add-mount-btn-cancel" data-action="cancel">
                        Cancel
                    </button>
                    <button class="add-mount-btn add-mount-btn-confirm" data-action="confirm">
                        Add Mount Point
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Focus path input
        setTimeout(() => {
            const input = this.modal.querySelector('#mount-path-input');
            if (input) input.focus();
        }, 100);

        this.attachListeners();
    }

    attachListeners() {
        // Button clicks
        this.modal.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            if (action === 'confirm') {
                await this.handleConfirm();
            } else if (action === 'cancel') {
                this.close(null);
            } else if (action === 'browse') {
                await this.handleBrowse();
            }
        });

        // Backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close(null);
            }
        });

        // Keyboard shortcuts
        this.handleKeydown = async (e) => {
            if (e.key === 'Escape') {
                this.close(null);
            } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                await this.handleConfirm();
            }
        };
        document.addEventListener('keydown', this.handleKeydown);

        // Clear error on input
        const pathInput = this.modal.querySelector('#mount-path-input');
        pathInput?.addEventListener('input', () => {
            this.clearError();
        });
    }

    async handleBrowse() {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read'
            });

            // Unfortunately, File System Access API doesn't give us the full path
            // We can only get the directory name
            const pathInput = this.modal.querySelector('#mount-path-input');
            const nameInput = this.modal.querySelector('#mount-name-input');

            // Set the name from the directory handle
            if (nameInput && !nameInput.value) {
                nameInput.value = dirHandle.name;
            }

            // Show a message that they need to enter the full path
            this.showError('File System API selected: ' + dirHandle.name + '. Please enter the full absolute path.');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('[AddMountDialog] Browse error:', err);
            }
        }
    }

    async handleConfirm() {
        if (this.isValidating) return;

        const pathInput = this.modal.querySelector('#mount-path-input');
        const nameInput = this.modal.querySelector('#mount-name-input');
        const confirmBtn = this.modal.querySelector('[data-action="confirm"]');

        const path = pathInput?.value?.trim();
        const name = nameInput?.value?.trim();

        if (!path) {
            this.showError('Please enter a path');
            pathInput?.focus();
            return;
        }

        if (!path.startsWith('/')) {
            this.showError('Path must be absolute (start with /)');
            pathInput?.focus();
            return;
        }

        // Show loading state
        this.isValidating = true;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="add-mount-spinner"></span>Validating...';

        try {
            // Try to add the mount point
            const result = await dispatch(dataMountThunks.addAndLoadMountPoint(path, name));

            if (result.success) {
                this.close({ success: true, mountId: result.mountId });
            } else {
                this.showError(result.error || 'Failed to add mount point');
            }
        } catch (err) {
            this.showError(err.message || 'Failed to validate path');
        } finally {
            this.isValidating = false;
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Add Mount Point';
        }
    }

    showError(message) {
        const errorEl = this.modal?.querySelector('#mount-path-error');
        const pathInput = this.modal?.querySelector('#mount-path-input');

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        if (pathInput) {
            pathInput.classList.add('error');
        }
    }

    clearError() {
        const errorEl = this.modal?.querySelector('#mount-path-error');
        const pathInput = this.modal?.querySelector('#mount-path-input');

        if (errorEl) {
            errorEl.style.display = 'none';
        }
        if (pathInput) {
            pathInput.classList.remove('error');
        }
    }

    close(result) {
        if (this.handleKeydown) {
            document.removeEventListener('keydown', this.handleKeydown);
        }

        if (this.modal) {
            this.modal.style.animation = 'addMountFadeOut 150ms ease';
            setTimeout(() => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.parentNode.removeChild(this.modal);
                }
                this.resolve(result);
            }, 150);
        } else {
            this.resolve(result);
        }
    }
}

/**
 * Convenience function to show the add mount dialog
 */
export function showAddMountDialog() {
    return AddMountDialog.show();
}

// Register on window.APP.services
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};
    window.APP.services.addMountDialog = AddMountDialog;
}
