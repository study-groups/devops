/**
 * PublishTray.js - Publishing tray for the top bar
 *
 * Provides a horizontal interface for publishing files.
 */

import { topBarTray } from '../TopBarTray.js';
import { appStore } from '/client/appState.js';
import {
    publishConfigActions,
    selectAllConfigurations,
    selectActiveConfigurationDecrypted
} from '/client/store/slices/publishConfigSlice.js';
import { PublishAPI } from '../publish/PublishAPI.js';
import { publishService } from '/client/services/PublishService.js';
import { findEditor } from '../publish/PublishUtils.js';

const log = window.APP?.services?.log?.createLogger('UI', 'PublishTray') || {
    info: () => {},
    error: () => {},
    debug: () => {}
};

let currentState = {
    isProcessing: false,
    progressPercent: 0,
    statusMessage: '',
    publishStatus: { isPublished: false, url: null },
    error: null
};

let storeUnsubscribe = null;

/**
 * Register the publish tray
 */
export function registerPublishTray() {
    topBarTray.register('publish', {
        title: 'Publish',
        closeOnClickOutside: false,
        render: () => renderPublishForm(),
        onOpen: async (container) => {
            if (!container) return;

            // Load current publish status
            await loadPublishStatus();
            updateTrayContent();

            // Subscribe to store changes
            storeUnsubscribe = appStore.subscribe(() => {
                updateTrayContent();
            });

            attachFormListeners(container);
        },
        onClose: () => {
            if (storeUnsubscribe) {
                storeUnsubscribe();
                storeUnsubscribe = null;
            }
            // Reset state
            currentState = {
                isProcessing: false,
                progressPercent: 0,
                statusMessage: '',
                publishStatus: currentState.publishStatus,
                error: null
            };
        }
    });
}

/**
 * Open the publish tray
 */
export function openPublishTray() {
    topBarTray.open('publish');
}

/**
 * Render the publish form
 */
function renderPublishForm() {
    const state = appStore.getState();
    const configurations = selectAllConfigurations(state);
    const activeConfig = selectActiveConfigurationDecrypted(state);
    const currentFile = state.file?.currentFile?.pathname || null;
    const filename = currentFile ? currentFile.split('/').pop() : 'No file selected';

    const { isProcessing, progressPercent, statusMessage, publishStatus, error } = currentState;

    return `
        <div class="tray-form">
            <div class="tray-form-row centered">
                <!-- Config selector -->
                <div class="tray-section">
                    <span class="tray-label">Config:</span>
                    <select id="publish-config" class="tray-input" style="min-width: 150px;">
                        ${configurations.length === 0 ? '<option value="">None configured</option>' : ''}
                        ${configurations.map(config => `
                            <option value="${config.id}" ${activeConfig?.id === config.id ? 'selected' : ''}>
                                ${config.name}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="tray-divider"></div>

                <!-- File status -->
                <div class="tray-section">
                    <div class="tray-status">
                        <span class="tray-status-dot ${publishStatus.isPublished ? 'published' : 'unpublished'}"></span>
                        <span style="font-family: monospace; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                              title="${currentFile || ''}">
                            ${filename}
                        </span>
                    </div>
                </div>

                ${isProcessing ? `
                    <div class="tray-divider"></div>
                    <div class="tray-progress">
                        <div class="tray-progress-bar">
                            <div class="tray-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="tray-progress-text">${statusMessage}</span>
                    </div>
                ` : ''}

                ${error ? `
                    <span class="tray-error">${error}</span>
                ` : ''}

                ${publishStatus.isPublished && publishStatus.url && !isProcessing ? `
                    <div class="tray-divider"></div>
                    <div class="tray-url">
                        <span class="tray-url-text" title="${publishStatus.url}">${publishStatus.url}</span>
                        <button id="publish-copy" class="tray-btn ghost" title="Copy URL">📋</button>
                        <button id="publish-open" class="tray-btn ghost" title="Open URL">🔗</button>
                    </div>
                ` : ''}

                <div class="tray-divider"></div>

                <!-- Actions -->
                <div class="tray-section">
                    ${publishStatus.isPublished ? `
                        <button id="publish-republish" class="tray-btn primary" ${isProcessing || !currentFile || !activeConfig ? 'disabled' : ''}>
                            ${isProcessing ? 'Publishing...' : 'Republish'}
                        </button>
                        <button id="publish-unpublish" class="tray-btn danger" ${isProcessing ? 'disabled' : ''}>
                            Unpublish
                        </button>
                    ` : `
                        <button id="publish-submit" class="tray-btn primary" ${isProcessing || !currentFile || !activeConfig ? 'disabled' : ''}>
                            ${isProcessing ? 'Publishing...' : 'Publish'}
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

/**
 * Update tray content without full re-render
 */
function updateTrayContent() {
    const content = topBarTray.getTrayContent();
    if (content && topBarTray.isOpen('publish')) {
        content.innerHTML = renderPublishForm();
        attachFormListeners(content);
    }
}

/**
 * Load publish status for current file
 */
async function loadPublishStatus() {
    const state = appStore.getState();
    const currentFile = state.file?.currentFile?.pathname;

    if (!currentFile) {
        currentState.publishStatus = { isPublished: false, url: null };
        return;
    }

    try {
        currentState.publishStatus = await PublishAPI.checkStatus(currentFile);
    } catch (error) {
        currentState.publishStatus = { isPublished: false, url: null };
    }
}

/**
 * Attach form event listeners
 */
function attachFormListeners(container) {
    // Config change
    const configSelect = container.querySelector('#publish-config');
    if (configSelect) {
        configSelect.addEventListener('change', (e) => {
            appStore.dispatch(publishConfigActions.setActiveConfiguration(e.target.value));
        });
    }

    // Publish button
    const publishBtn = container.querySelector('#publish-submit');
    if (publishBtn) {
        publishBtn.addEventListener('click', handlePublish);
    }

    // Republish button
    const republishBtn = container.querySelector('#publish-republish');
    if (republishBtn) {
        republishBtn.addEventListener('click', handlePublish);
    }

    // Unpublish button
    const unpublishBtn = container.querySelector('#publish-unpublish');
    if (unpublishBtn) {
        unpublishBtn.addEventListener('click', handleUnpublish);
    }

    // Copy URL
    const copyBtn = container.querySelector('#publish-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', handleCopyUrl);
    }

    // Open URL
    const openBtn = container.querySelector('#publish-open');
    if (openBtn) {
        openBtn.addEventListener('click', handleOpenUrl);
    }
}

/**
 * Handle publish
 */
async function handlePublish() {
    if (currentState.isProcessing) return;

    const state = appStore.getState();
    const currentFile = state.file?.currentFile?.pathname;
    const activeConfig = selectActiveConfigurationDecrypted(state);

    if (!currentFile || !activeConfig) {
        currentState.error = 'No file or configuration selected';
        updateTrayContent();
        return;
    }

    currentState.isProcessing = true;
    currentState.error = null;
    currentState.progressPercent = 0;
    currentState.statusMessage = 'Starting...';
    updateTrayContent();

    try {
        currentState.progressPercent = 20;
        currentState.statusMessage = 'Reading content...';
        updateTrayContent();

        const editor = findEditor();
        if (!editor) throw new Error('Editor not found');

        const content = editor.value || '';
        if (!content.trim()) throw new Error('Content is empty');

        currentState.progressPercent = 40;
        currentState.statusMessage = 'Generating HTML...';
        updateTrayContent();

        const htmlContent = await publishService.generatePublishHtml(content, currentFile);
        if (!htmlContent) throw new Error('HTML generation failed');

        currentState.progressPercent = 70;
        currentState.statusMessage = 'Uploading...';
        updateTrayContent();

        const result = await PublishAPI.publish(currentFile, htmlContent, true, activeConfig);

        currentState.progressPercent = 100;
        currentState.statusMessage = 'Complete!';
        currentState.publishStatus = { isPublished: true, url: result.url };

        log.info('PUBLISH_SUCCESS', `Published: ${currentFile}`);

    } catch (error) {
        log.error('PUBLISH_ERROR', error.message);
        currentState.error = error.message;
        currentState.publishStatus = { isPublished: false, url: null };
    } finally {
        currentState.isProcessing = false;
        updateTrayContent();
    }
}

/**
 * Handle unpublish
 */
async function handleUnpublish() {
    if (currentState.isProcessing) return;

    const state = appStore.getState();
    const currentFile = state.file?.currentFile?.pathname;
    const activeConfig = selectActiveConfigurationDecrypted(state);

    if (!currentFile || !activeConfig) return;

    currentState.isProcessing = true;
    currentState.statusMessage = 'Unpublishing...';
    updateTrayContent();

    try {
        await PublishAPI.unpublish(currentFile, activeConfig);
        currentState.publishStatus = { isPublished: false, url: null };
        log.info('UNPUBLISH_SUCCESS', `Unpublished: ${currentFile}`);
    } catch (error) {
        log.error('UNPUBLISH_ERROR', error.message);
        currentState.error = error.message;
    } finally {
        currentState.isProcessing = false;
        updateTrayContent();
    }
}

/**
 * Handle copy URL
 */
async function handleCopyUrl() {
    if (currentState.publishStatus.url) {
        try {
            await navigator.clipboard.writeText(currentState.publishStatus.url);
            const btn = topBarTray.getTrayContent()?.querySelector('#publish-copy');
            if (btn) {
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = '📋'; }, 1500);
            }
        } catch (error) {
            log.error('COPY_ERROR', error.message);
        }
    }
}

/**
 * Handle open URL
 */
function handleOpenUrl() {
    if (currentState.publishStatus.url) {
        window.open(currentState.publishStatus.url, '_blank');
    }
}

// Auto-register on import
registerPublishTray();
