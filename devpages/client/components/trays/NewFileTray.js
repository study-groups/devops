/**
 * NewFileTray.js - New file creation tray
 *
 * Provides a centered form for creating new files.
 */

import { topBarTray } from '../TopBarTray.js';
import { appStore } from '/client/appState.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';

const log = window.APP?.services?.log?.createLogger('UI', 'NewFileTray') || {
    info: () => {},
    error: () => {}
};

// Helper functions
function getParentPath(pathname) {
    if (!pathname) return '';
    const parts = pathname.split('/');
    parts.pop();
    return parts.join('/') || '/';
}

function pathJoin(...parts) {
    return parts
        .filter(Boolean)
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '') || '/';
}

/**
 * Register the new file tray
 */
export function registerNewFileTray() {
    topBarTray.register('new-file', {
        title: 'Create New File',
        closeOnClickOutside: true,
        render: () => renderNewFileForm(),
        onOpen: (container) => {
            if (!container) return;

            const input = container.querySelector('#new-file-name');
            if (input) {
                input.focus();
                input.select();
            }

            attachFormListeners(container);
        }
    });
}

/**
 * Open the new file tray
 */
export function openNewFileTray() {
    topBarTray.open('new-file');
}

/**
 * Render the new file form
 */
function renderNewFileForm() {
    const state = appStore.getState();
    const pathState = state.path;
    const currentDir = pathState.current?.type === 'directory'
        ? pathState.current?.pathname
        : getParentPath(pathState.current?.pathname || '');

    return `
        <div class="tray-form">
            <div class="tray-form-row centered">
                <span class="tray-label">Location:</span>
                <span style="font-family: monospace; font-size: 13px; color: var(--color-text-secondary);">
                    ${currentDir || '/'}
                </span>
            </div>
            <div class="tray-form-row centered">
                <span class="tray-label">Filename:</span>
                <input type="text"
                       id="new-file-name"
                       class="tray-input"
                       placeholder="filename.md"
                       value="untitled.md"
                       style="width: 280px;" />
                <button id="new-file-create" class="tray-btn primary">Create</button>
                <button id="new-file-cancel" class="tray-btn secondary">Cancel</button>
                <span id="new-file-error" class="tray-error"></span>
            </div>
        </div>
    `;
}

/**
 * Attach form event listeners
 */
function attachFormListeners(container) {
    const input = container.querySelector('#new-file-name');
    const createBtn = container.querySelector('#new-file-create');
    const cancelBtn = container.querySelector('#new-file-cancel');
    const errorSpan = container.querySelector('#new-file-error');

    const showError = (msg) => {
        if (errorSpan) errorSpan.textContent = msg;
    };

    const clearError = () => {
        if (errorSpan) errorSpan.textContent = '';
    };

    if (input) {
        input.addEventListener('input', clearError);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createBtn?.click();
            } else if (e.key === 'Escape') {
                topBarTray.close();
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => topBarTray.close());
    }

    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const filename = input?.value.trim();

            if (!filename) {
                showError('Enter a filename');
                input?.focus();
                return;
            }

            const state = appStore.getState();
            const pathState = state.path;
            const currentDir = pathState.current?.type === 'directory'
                ? pathState.current?.pathname
                : getParentPath(pathState.current?.pathname || '');

            const newPath = pathJoin(currentDir || '', filename);

            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';
            clearError();

            try {
                const response = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ pathname: newPath, content: '' })
                });

                if (response.ok) {
                    log.info('CREATE_SUCCESS', `Created: ${newPath}`);
                    topBarTray.close();
                    appStore.dispatch(pathThunks.navigateToPath({ pathname: newPath, isDirectory: false }));
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to create file');
                }
            } catch (error) {
                log.error('CREATE_ERROR', error.message);
                showError(error.message);
                createBtn.disabled = false;
                createBtn.textContent = 'Create';
            }
        });
    }
}

// Auto-register on import
registerNewFileTray();
