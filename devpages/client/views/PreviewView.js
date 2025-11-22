/**
 * PreviewView.js - Iframe-based Markdown preview
 * Renders preview in isolated iframe using PublishService for exact publish matching
 */

import { ViewInterface } from '/client/layout/ViewInterface.js';
import { appStore } from '/client/appState.js';
import { publishService } from '/client/services/PublishService.js';
import { themeService } from '/client/services/ThemeService.js';

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
        console.log('[PreviewView] Mounting preview view with iframe');

        // Create element if not exists
        if (!this.element) {
            this.element = this.render();
            if (container && container.appendChild) {
                container.appendChild(this.element);
                console.log('[PreviewView] Element appended to container');
            }
        }

        // Get iframe reference
        this.previewIframe = this.element.querySelector('#preview-iframe');

        if (!this.previewIframe) {
            console.error('[PreviewView] Failed to find preview iframe');
            return;
        }

        console.log('[PreviewView] Iframe mounted successfully');

        // Subscribe to store updates
        this.subscribeToStoreUpdates();

        // Subscribe to theme changes for instant preview updates
        this.unsubscribeTheme = themeService.subscribe((theme) => {
            console.log('[PreviewView] Theme changed callback received:', theme.id, theme.mode);
            console.log('[PreviewView] Forcing preview regeneration...');
            this.updatePreviewFromState(true); // Force update even if content unchanged
        });

        // Initial render - wait for theme to be ready
        this.waitForThemeAndRender();
    }

    async waitForThemeAndRender() {
        console.log('[PreviewView] Waiting for theme to be initialized...');

        // Wait for ThemeService to be initialized with a theme
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait

        while (attempts < maxAttempts) {
            if (themeService.initialized && themeService.currentTheme) {
                console.log('[PreviewView] Theme ready:', themeService.currentTheme.id);
                this.updatePreviewFromState();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.warn('[PreviewView] Theme initialization timeout, rendering anyway');
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
        console.log('[PreviewView] Preview view unmounted');
    }

    subscribeToStoreUpdates() {
        // Subscribe to content changes
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

            // Trigger preview update
            this.triggerPreviewUpdate(content, filePath);
        });
    }

    async triggerPreviewUpdate(content, filePath, force = false) {
        console.log('[PreviewView] triggerPreviewUpdate called, force:', force, 'isUpdating:', this.isUpdating);

        if (!content || this.isUpdating || !this.previewIframe) {
            console.log('[PreviewView] Aborting: no content:', !content, 'isUpdating:', this.isUpdating, 'no iframe:', !this.previewIframe);
            return;
        }

        // Skip if content hasn't changed (unless forced)
        if (!force && content === this.lastProcessedContent) {
            console.log('[PreviewView] Content unchanged, skipping update');
            return;
        }

        console.log('[PreviewView] Proceeding with preview update (force:', force, ')');

        try {
            this.isUpdating = true;

            // Generate complete HTML document using PublishService
            console.log('[PreviewView] Generating preview HTML...', {
                contentLength: content?.length,
                filePath,
                hasTheme: !!themeService.currentTheme,
                themeId: themeService.currentTheme?.id
            });

            const html = await publishService.generatePreviewHtml(
                content,
                filePath,
                themeService.currentTheme
            );

            console.log('[PreviewView] Generated HTML length:', html?.length);
            console.log('[PreviewView] HTML starts with:', html?.substring(0, 200));

            // Update iframe srcdoc (browser handles the re-render)
            // Force reload by clearing first if this is a forced update (theme change)
            if (force) {
                console.log('[PreviewView] Forcing iframe reload for theme change');
                this.previewIframe.srcdoc = '';
                // Small delay to ensure browser processes the clear
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            this.previewIframe.srcdoc = html;

            console.log('[PreviewView] Preview iframe srcdoc updated');

            // Debug: Check iframe after a brief delay to see what actually rendered
            setTimeout(() => {
                const iframeDoc = this.previewIframe.contentDocument || this.previewIframe.contentWindow?.document;
                if (iframeDoc) {
                    console.log('[PreviewView] Iframe document exists');
                    console.log('[PreviewView] Iframe <head> HTML:', iframeDoc.head?.innerHTML?.substring(0, 500));
                    console.log('[PreviewView] Iframe <body> HTML:', iframeDoc.body?.innerHTML?.substring(0, 500));
                    const styles = iframeDoc.querySelectorAll('style');
                    console.log('[PreviewView] Number of <style> tags in iframe:', styles.length);
                    styles.forEach((style, idx) => {
                        console.log(`[PreviewView] Style tag ${idx} length:`, style.textContent?.length);
                    });
                } else {
                    console.error('[PreviewView] Could not access iframe document!');
                }
            }, 100);

            console.log('[PreviewView] Preview updated successfully');

            // Track last processed content
            this.lastProcessedContent = content;
        } catch (error) {
            console.error('[PreviewView] Failed to update preview:', error);

            // Show error in iframe
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
    <div class="error-details">${error.message}</div>
</body>
</html>`;
        } finally {
            // Reset updating flag after delay for async operations
            setTimeout(() => {
                this.isUpdating = false;
            }, 100);
        }
    }

    updatePreviewFromState(force = false) {
        console.log('[PreviewView] updatePreviewFromState called, force:', force);
        const state = appStore.getState();
        const currentFile = state.file?.currentFile;

        if (!currentFile || !currentFile.content) {
            console.log('[PreviewView] No content to preview');
            return;
        }

        console.log('[PreviewView] Calling triggerPreviewUpdate with force:', force);
        this.triggerPreviewUpdate(currentFile.content, currentFile.pathname, force);
    }
}
