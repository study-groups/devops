/**
 * PublishTray.js - Minimal publishing tray
 *
 * Simplified UI showing:
 * - Current file status
 * - Published URL (if published)
 * - Publish/Unpublish action
 *
 * Uses PublishManager for all operations.
 * Config selection is handled in the Panel.
 */

import { topBarTray } from '../TopBarTray.js';
import { appStore } from '/client/appState.js';
import { selectActiveConfigurationDecrypted } from '/client/store/slices/publishConfigSlice.js';
import { publishManager } from '/client/services/PublishManager.js';

const log = window.APP?.services?.log?.createLogger('UI', 'PublishTray') || {
    info: () => {},
    error: () => {},
    debug: () => {}
};

let managerUnsubscribe = null;

/**
 * Register the publish tray
 */
export function registerPublishTray() {
    topBarTray.register('publish', {
        title: 'Publish',
        closeOnClickOutside: false,
        render: () => renderTray(),
        onOpen: async (container) => {
            if (!container) return;

            // Subscribe to PublishManager updates
            managerUnsubscribe = publishManager.subscribe(() => {
                updateTrayContent();
            });

            attachListeners(container);
        },
        onClose: () => {
            if (managerUnsubscribe) {
                managerUnsubscribe();
                managerUnsubscribe = null;
            }
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
 * Render the tray content
 */
function renderTray() {
    const state = appStore.getState();
    const activeConfig = selectActiveConfigurationDecrypted(state);
    const managerState = publishManager.getState();
    const { currentFile, publishStatus, isProcessing, error, cssStrategy } = managerState;

    const filename = currentFile ? currentFile.split('/').pop() : 'No file';

    // CSS strategy short labels for compact display
    const strategyLabels = {
        embedded: 'Embed',
        hybrid: 'Hybrid',
        linked: 'Link'
    };

    // Simple one-line layout
    return `
        <div class="publish-tray">
            <div class="publish-tray-content">
                <!-- Status indicator and filename -->
                <div class="tray-file-info">
                    <span class="tray-status-dot ${publishStatus.isPublished ? 'published' : 'unpublished'}"></span>
                    <span class="tray-filename" title="${currentFile || ''}">${filename}</span>
                </div>

                <!-- Bucket info (minimal) -->
                ${activeConfig ? `
                    <span class="tray-bucket">${activeConfig.bucket || ''}</span>
                ` : ''}

                <!-- CSS Strategy selector (compact) -->
                <div class="tray-strategy">
                    <select class="tray-strategy-select" id="tray-css-strategy" title="CSS Strategy">
                        <option value="embedded" ${cssStrategy === 'embedded' ? 'selected' : ''}>Embed</option>
                        <option value="hybrid" ${cssStrategy === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                        <option value="linked" ${cssStrategy === 'linked' ? 'selected' : ''}>Link</option>
                    </select>
                </div>

                <!-- Published URL with copy -->
                ${publishStatus.isPublished && publishStatus.url ? `
                    <div class="tray-url-section">
                        <span class="tray-url" title="${publishStatus.url}">${truncateUrl(publishStatus.url)}</span>
                        <button class="tray-btn-icon" id="tray-copy-url" title="Copy URL">
                            <span>&#128203;</span>
                        </button>
                    </div>
                ` : ''}

                <!-- Error display -->
                ${error && !isProcessing ? `
                    <span class="tray-error" title="${error}">Error</span>
                ` : ''}

                <!-- Action button -->
                <div class="tray-actions">
                    ${publishStatus.isPublished ? `
                        <button class="tray-btn tray-btn-secondary" id="tray-unpublish" ${isProcessing ? 'disabled' : ''}>
                            Unpublish
                        </button>
                    ` : `
                        <button class="tray-btn tray-btn-primary" id="tray-publish" ${!currentFile || !activeConfig || isProcessing ? 'disabled' : ''}>
                            ${isProcessing ? 'Publishing...' : 'Publish'}
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

/**
 * Update tray content
 */
function updateTrayContent() {
    const content = topBarTray.getTrayContent();
    if (content && topBarTray.isOpen('publish')) {
        content.innerHTML = renderTray();
        attachListeners(content);
    }
}

/**
 * Attach event listeners
 */
function attachListeners(container) {
    // Publish button
    container.querySelector('#tray-publish')?.addEventListener('click', async () => {
        const result = await publishManager.publish();
        if (!result.success) {
            log.error('PUBLISH_FAILED', result.error);
        }
    });

    // Unpublish button
    container.querySelector('#tray-unpublish')?.addEventListener('click', async () => {
        const result = await publishManager.unpublish();
        if (!result.success) {
            log.error('UNPUBLISH_FAILED', result.error);
        }
    });

    // Copy URL button
    container.querySelector('#tray-copy-url')?.addEventListener('click', async () => {
        const managerState = publishManager.getState();
        if (managerState.publishStatus.url) {
            try {
                await navigator.clipboard.writeText(managerState.publishStatus.url);
                const btn = container.querySelector('#tray-copy-url span');
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '&#10003;';
                    setTimeout(() => { btn.innerHTML = orig; }, 1500);
                }
            } catch (e) {
                log.error('COPY_ERROR', e.message);
            }
        }
    });

    // CSS Strategy selector
    container.querySelector('#tray-css-strategy')?.addEventListener('change', (e) => {
        publishManager.setCssStrategy(e.target.value);
    });
}

/**
 * Truncate URL for display
 */
function truncateUrl(url) {
    if (!url) return '';
    if (url.length <= 40) return url;
    // Show last 35 chars with ellipsis
    return '...' + url.slice(-35);
}

// Auto-register on import
registerPublishTray();
