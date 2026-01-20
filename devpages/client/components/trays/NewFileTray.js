/**
 * NewFileTray.js - New file creation tray
 *
 * Provides a compact form for creating new files.
 * Supports creating directories inline (e.g., "newdir/file.md").
 * Blocks parent directory traversal (../) for security.
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
 * Validate path input - blocks dangerous patterns
 */
function validatePath(input) {
    // Block parent directory traversal
    if (input.includes('../') || input.includes('..\\') || input === '..') {
        return { valid: false, error: 'Parent directory traversal (../) not allowed' };
    }
    // Block absolute paths
    if (input.startsWith('/')) {
        return { valid: false, error: 'Absolute paths not allowed - use relative paths' };
    }
    // Block empty or whitespace-only
    if (!input.trim()) {
        return { valid: false, error: 'Enter a filename' };
    }
    // Block dangerous characters
    if (/[<>:"|?*\x00-\x1f]/.test(input)) {
        return { valid: false, error: 'Invalid characters in path' };
    }
    return { valid: true };
}

/**
 * Register the new file tray
 */
export function registerNewFileTray() {
    topBarTray.register('new-file', {
        title: 'New',
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
 * Render the new file form - compact single-row layout
 */
function renderNewFileForm() {
    const state = appStore.getState();
    const pathState = state.path;
    const currentDir = pathState.current?.type === 'directory'
        ? pathState.current?.pathname
        : getParentPath(pathState.current?.pathname || '');

    return `
        <div class="tray-form" style="gap: 8px;">
            <div class="tray-form-row" style="justify-content: flex-start; gap: 8px;">
                <span style="font-family: monospace; font-size: 13px; color: var(--color-text-secondary); white-space: nowrap;">
                    ${currentDir || '/'}/</span>
                <input type="text"
                       id="new-file-name"
                       class="tray-input"
                       placeholder="path/to/file.md"
                       value="untitled.md"
                       style="flex: 1; min-width: 200px; max-width: 300px;" />
                <button id="new-file-create" class="tray-btn primary">Create</button>
                <button id="new-file-cancel" class="tray-btn secondary">Cancel</button>
                <span id="new-file-error" class="tray-error"></span>
            </div>
            <div style="font-size: 11px; color: var(--color-text-muted); margin-left: 4px;">
                Tip: Use slashes to create directories (e.g., <code>newdir/file.md</code>)
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
        // Validate on input change
        input.addEventListener('input', () => {
            clearError();
            const validation = validatePath(input.value);
            if (!validation.valid) {
                showError(validation.error);
            }
        });

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
            const inputValue = input?.value.trim();

            // Validate the path
            const validation = validatePath(inputValue);
            if (!validation.valid) {
                showError(validation.error);
                input?.focus();
                return;
            }

            const state = appStore.getState();
            const pathState = state.path;
            const currentDir = pathState.current?.type === 'directory'
                ? pathState.current?.pathname
                : getParentPath(pathState.current?.pathname || '');

            const newPath = pathJoin(currentDir || '', inputValue);

            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';
            clearError();

            try {
                // Use the same save endpoint as the editor (/api/files/save)
                // The PData system handles creating parent directories automatically
                const response = await fetch('/api/files/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        pathname: newPath,
                        content: ''
                    })
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
