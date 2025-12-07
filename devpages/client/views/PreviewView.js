/**
 * PreviewView v2 - Iframe-based Markdown preview with Redux integration
 * Uses new Redux-based rendering pipeline
 */

import { ViewInterface } from '/layout/ViewInterface.js';
import { appStore } from '/appState.js';
import {
    renderMarkdown,
    postProcessContent,
    initializePreviewSystem,
    selectPreviewStatus,
    selectRenderResult,
    selectIsInitialized,
    clearCache
} from '/store/slices/previewSlice.js';
import { publishService } from '/services/PublishService.js';
import { themeService } from '/services/ThemeService.js';

const log = window.APP?.services?.log?.createLogger('PreviewView') || console;

export class PreviewView extends ViewInterface {
    constructor(options = {}) {
        super({
            id: 'preview-view',
            title: 'Preview',
            ...options,
        });

        this.previewIframe = null;
        this.unsubscribe = null;
        this.unsubscribeTheme = null;
        this.lastProcessedContent = null;
        this.isUpdating = false;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'preview-container';

        // Create iframe for isolated preview rendering
        const iframe = document.createElement('iframe');
        iframe.id = 'preview-iframe';
        iframe.className = 'preview-iframe';
        iframe.setAttribute('title', 'Markdown Preview');

        // Initial placeholder content
        iframe.srcdoc = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 2rem;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="preview-placeholder">Ready to preview</div>
</body>
</html>`;

        container.appendChild(iframe);
        return container;
    }

    async onMount(container) {
        log.info?.('VIEW', 'MOUNT_START', 'Mounting preview view');

        // Create element if not exists
        if (!this.element) {
            this.element = this.render();
            if (container && container.appendChild) {
                container.appendChild(this.element);
            }
        }

        // Get iframe reference
        this.previewIframe = this.element.querySelector('#preview-iframe');

        if (!this.previewIframe) {
            log.error?.('VIEW', 'MOUNT_ERROR', 'Failed to find preview iframe');
            return;
        }

        // Listen for messages from iframe
        window.addEventListener('message', (event) => {
            // Handle preview ready message
            if (event.data === 'preview-ready' && this.previewIframe) {
                // Only show if currently in loading state (prevents stale messages)
                if (this.previewIframe.classList.contains('loading')) {
                    log.info?.('VIEW', 'IFRAME_READY', 'Preview content fully rendered');

                    // Small delay before showing to ensure smooth transition
                    setTimeout(() => {
                        if (this.previewIframe && this.previewIframe.classList.contains('loading')) {
                            this.previewIframe.classList.add('ready');
                            this.previewIframe.classList.remove('loading');
                        }
                    }, 50);
                }
            }

            // Handle reload current file request from markdown utilities
            if (event.data && event.data.type === 'reload-current-file') {
                log.info?.('VIEW', 'RELOAD_REQUEST', 'Markdown utility requested file reload');
                this.reloadCurrentFile();
            }
        });

        // Initialize preview system if not already initialized
        const state = appStore.getState();
        const isInitialized = selectIsInitialized(state);

        if (!isInitialized) {
            log.info?.('VIEW', 'INITIALIZING', 'Initializing preview system');
            await appStore.dispatch(initializePreviewSystem());
        }

        // Subscribe to store updates
        this.subscribeToStoreUpdates();

        // Subscribe to theme changes for instant preview updates
        this.unsubscribeTheme = themeService.subscribe((theme) => {
            log.info?.('VIEW', 'THEME_CHANGE', `Theme changed: ${theme.id} (${theme.mode})`);
            this.updatePreviewFromState(true); // Force update
        });

        // Initial render - wait for theme to be ready
        await this.waitForThemeAndRender();

        log.info?.('VIEW', 'MOUNT_COMPLETE', 'Preview view mounted successfully');
    }

    async waitForThemeAndRender() {
        log.info?.('VIEW', 'WAIT_THEME', 'Waiting for theme initialization');

        // Wait for ThemeService to be initialized
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait

        while (attempts < maxAttempts) {
            if (themeService.initialized && themeService.currentTheme) {
                log.info?.('VIEW', 'THEME_READY', `Theme ready: ${themeService.currentTheme.id}`);
                this.updatePreviewFromState();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        log.warn?.('VIEW', 'THEME_TIMEOUT', 'Theme initialization timeout, rendering anyway');
        this.updatePreviewFromState();
    }

    onUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.unsubscribeTheme) {
            this.unsubscribeTheme();
            this.unsubscribeTheme = null;
        }
        log.info?.('VIEW', 'UNMOUNT', 'Preview view unmounted');
    }

    subscribeToStoreUpdates() {
        let lastState = null;

        this.unsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            const currentFile = state.file?.currentFile;

            if (!currentFile) return;

            const content = currentFile.content;
            const filePath = currentFile.pathname;

            // Avoid unnecessary updates
            if (content === this.lastProcessedContent || this.isUpdating) {
                return;
            }

            // Check if preview status changed to succeeded (render completed)
            const previewStatus = selectPreviewStatus(state);

            if (lastState) {
                const lastPreviewStatus = selectPreviewStatus(lastState);

                // If render just completed, update the iframe
                if (lastPreviewStatus === 'loading' && previewStatus === 'succeeded') {
                    log.info?.('VIEW', 'RENDER_COMPLETE', 'Render completed, updating iframe');
                    this.updateIframeFromRedux();
                }
            }

            lastState = state;

            // Trigger preview update for content changes
            this.triggerPreviewUpdate(content, filePath);
        });
    }

    async triggerPreviewUpdate(content, filePath, force = false) {
        if (!content || this.isUpdating || !this.previewIframe) {
            return;
        }

        // Skip if content hasn't changed (unless forced)
        if (!force && content === this.lastProcessedContent) {
            return;
        }

        try {
            this.isUpdating = true;

            log.info?.('VIEW', 'RENDER_REQUEST', `Requesting render: ${filePath}`);

            // Dispatch Redux thunk to render markdown
            const result = await appStore.dispatch(renderMarkdown({ content, filePath }));

            if (result.type === renderMarkdown.fulfilled.type) {
                // Render succeeded, update iframe
                await this.updateIframeFromRedux(force);
            } else if (result.type === renderMarkdown.rejected.type) {
                // Render failed, show error
                this.showError(result.payload?.message || result.error.message);
            }

            // Track last processed content
            this.lastProcessedContent = content;

        } catch (error) {
            log.error?.('VIEW', 'RENDER_ERROR', `Render error: ${error.message}`, error);
            this.showError(error.message);
        } finally {
            // Reset updating flag after delay for async operations
            setTimeout(() => {
                this.isUpdating = false;
            }, 100);
        }
    }

    async updateIframeFromRedux(force = false) {
        if (!this.previewIframe) return;

        try {
            const state = appStore.getState();
            const currentFile = state.file?.currentFile;

            if (!currentFile?.content) {
                log.info?.('VIEW', 'NO_CONTENT', 'No content to preview');
                return;
            }

            log.info?.('VIEW', 'UPDATE_IFRAME', 'Generating preview HTML');

            // Keep iframe hidden during update to prevent layout shift from async plugins
            // First add loading class (which sets transition:none), then remove ready
            // This ensures the fade-out happens instantly
            this.previewIframe.classList.add('loading');
            this.previewIframe.classList.remove('ready');

            // Use PublishService for complete HTML document with theme
            const html = await publishService.generatePreviewHtml(
                currentFile.content,
                currentFile.pathname,
                themeService.currentTheme
            );

            // Update content
            this.previewIframe.srcdoc = html;

            // Note: iframe will be shown when it posts 'preview-ready' message

            log.info?.('VIEW', 'UPDATE_SUCCESS', 'Preview iframe updated successfully');

        } catch (error) {
            log.error?.('VIEW', 'UPDATE_ERROR', `Failed to update iframe: ${error.message}`, error);
            this.previewIframe.classList.remove('loading');
            this.showError(error.message);
        }
    }

    updatePreviewFromState(force = false) {
        const state = appStore.getState();
        const currentFile = state.file?.currentFile;

        if (!currentFile || !currentFile.content) {
            log.info?.('VIEW', 'NO_CONTENT', 'No content to preview');
            return;
        }

        log.info?.('VIEW', 'TRIGGER_UPDATE', `Triggering update (force: ${force})`);
        this.triggerPreviewUpdate(currentFile.content, currentFile.pathname, force);
    }

    /**
     * Force refresh preview - called by refresh button
     */
    forceRefresh() {
        log.info?.('VIEW', 'FORCE_REFRESH', 'Manual refresh triggered');

        // Clear Redux cache to bypass condition check
        appStore.dispatch(clearCache());

        // Reset local cache
        this.lastProcessedContent = null;

        // Trigger update
        this.updatePreviewFromState(true);
    }

    /**
     * Reload the current file from server
     * Called by markdown utilities after performing server-side actions
     */
    async reloadCurrentFile() {
        log.info?.('VIEW', 'RELOAD_FILE', 'Reloading current file from server');

        const state = appStore.getState();
        const currentPathname = state.path?.currentPathname;

        if (!currentPathname) {
            log.warn?.('VIEW', 'NO_FILE', 'No current file to reload');
            return;
        }

        // Import necessary modules
        const { pathThunks } = await import('/client/store/slices/pathSlice.js');

        // Clear cache and reload the file
        appStore.dispatch(clearCache());
        this.lastProcessedContent = null;

        // Navigate to the same file (this will reload it)
        await appStore.dispatch(pathThunks.navigateToPath({
            pathname: currentPathname,
            isDirectory: false
        }));

        log.info?.('VIEW', 'RELOAD_COMPLETE', 'File reloaded successfully');
    }

    showError(message) {
        if (!this.previewIframe) return;

        this.previewIframe.srcdoc = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 2rem;
            color: #e53e3e;
        }
        .error-details {
            background: #fed7d7;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1rem;
            font-family: monospace;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <h2>Preview Error</h2>
    <p>Failed to render preview</p>
    <div class="error-details">${this.escapeHtml(message)}</div>
</body>
</html>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
