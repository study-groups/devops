/**
 * client/settings/PreviewSettingsPanel.js
 * Preview-specific settings panel for controlling preview behavior and appearance.
 */

import { appStore } from '/client/appState.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';
import { updatePreview, resetPreview } from '/client/store/slices/settingsSlice.js';
import { renderMarkdown, clearCache } from '/client/store/slices/previewSlice.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('PreviewSettingsPanel');

export class PreviewSettingsPanel {
    constructor(container) {
        this.container = container;
        this.initialized = false;
        this.stateUnsubscribe = null;
        
        this.init();
    }

    async init() {
        if (this.initialized) return;

        try {
            this.render();
            this.attachEventListeners();
            this.subscribeToState();
            
            // Make instance globally accessible for testing
            window.previewSettingsPanel = this;
            
            this.initialized = true;
            log.info('PANEL_INIT', 'SUCCESS', 'PreviewSettingsPanel initialized successfully');
        } catch (error) {
            log.error('PANEL_INIT', 'FAILED', `PreviewSettingsPanel initialization failed: ${error.message}`, error);
            this.container.innerHTML = '<p style="color: var(--color-warning, #f59e0b); background-color: var(--color-warning-background, #fff3cd); padding: 1rem; border-radius: 0.375rem; border: 1px solid var(--color-warning, #f59e0b);">Error loading preview settings.</p>';
        }
    }

    render() {
        const state = appStore.getState();
        const previewSettings = state.settings?.preview || {};
        
        this.container.innerHTML = `
            <div class="preview-settings-panel">
                <!-- Error Handling Section -->
                <div class="preview-settings-section">
                    <h5 class="preview-settings-section-title">Error Handling</h5>
                    
                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-smooth-errors" 
                                   ${previewSettings.smoothErrors !== false ? 'checked' : ''}>
                            <span>Smooth error transitions (prevents red flash)</span>
                        </label>
                        <p class="preview-setting-description">
                            Uses gentle animations and warning colors instead of harsh red error states
                        </p>
                    </div>

                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-retry-button" 
                                   ${previewSettings.showRetryButton !== false ? 'checked' : ''}>
                            <span>Show retry button on errors</span>
                        </label>
                        <p class="preview-setting-description">
                            Adds a retry button to error messages for easy recovery
                        </p>
                    </div>

                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="number" 
                                   id="preview-error-timeout" 
                                   value="${previewSettings.errorTimeout || 5000}"
                                   min="1000" 
                                   max="30000" 
                                   step="1000">
                            <span>Auto-retry timeout (ms)</span>
                        </label>
                        <p class="preview-setting-description">
                            Automatically retry failed renders after this delay
                        </p>
                    </div>
                </div>

                <!-- Performance Section -->
                <div class="preview-settings-section">
                    <h5 class="preview-settings-section-title">Performance</h5>
                    
                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="number" 
                                   id="preview-debounce-delay" 
                                   value="${previewSettings.debounceDelay || 150}"
                                   min="50" 
                                   max="1000" 
                                   step="50">
                            <span>Update debounce delay (ms)</span>
                        </label>
                        <p class="preview-setting-description">
                            Delay between keystrokes before updating preview
                        </p>
                    </div>

                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-skip-unchanged" 
                                   ${previewSettings.skipUnchanged !== false ? 'checked' : ''}>
                            <span>Skip rendering unchanged content</span>
                        </label>
                        <p class="preview-setting-description">
                            Improves performance by avoiding unnecessary re-renders
                        </p>
                    </div>

                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-queue-updates" 
                                   ${previewSettings.queueUpdates !== false ? 'checked' : ''}>
                            <span>Queue rapid updates</span>
                        </label>
                        <p class="preview-setting-description">
                            Prevents render conflicts by queuing simultaneous updates
                        </p>
                    </div>
                </div>

                <!-- Visual Feedback Section -->
                <div class="preview-settings-section">
                    <h5 class="preview-settings-section-title">Visual Feedback</h5>
                    
                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-loading-animation" 
                                   ${previewSettings.showLoadingAnimation !== false ? 'checked' : ''}>
                            <span>Show loading animations</span>
                        </label>
                        <p class="preview-setting-description">
                            Display animated loading indicators during rendering
                            <button class="btn btn-primary btn-sm preview-test-button" onclick="window.previewSettingsPanel?.testLoadingAnimations()">
                                Test Animation
                            </button>
                        </p>
                    </div>

                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-success-feedback" 
                                   ${previewSettings.showSuccessFeedback !== false ? 'checked' : ''}>
                            <span>Show success feedback</span>
                        </label>
                        <p class="preview-setting-description">
                            Brief visual confirmation when rendering completes successfully
                        </p>
                    </div>

                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-shimmer-effect" 
                                   ${previewSettings.showShimmerEffect !== false ? 'checked' : ''}>
                            <span>Show shimmer effect during updates</span>
                        </label>
                        <p class="preview-setting-description">
                            Subtle shimmer animation to indicate content is updating
                        </p>
                    </div>
                </div>

                <!-- Rendering Mode Section -->
                <div class="preview-settings-section">
                    <h5 class="preview-settings-section-title">Display Options</h5>
                    
                    <div class="preview-setting-item">
                        <label class="preview-setting-label">
                            <input type="checkbox" 
                                   id="preview-auto-scroll" 
                                   ${previewSettings.autoScroll !== false ? 'checked' : ''}>
                            <span>Auto-scroll to changes</span>
                        </label>
                        <p class="preview-setting-description">
                            Automatically scroll to show newly rendered content
                        </p>
                    </div>
                </div>

                <!-- Actions Section -->
                <div class="preview-settings-section">
                    <h5 class="preview-settings-section-title">Actions</h5>
                    
                    <div class="preview-settings-actions">
                        <button id="preview-force-refresh" class="btn btn-secondary preview-action-button">
                            🔄 Force Refresh
                        </button>
                        <button id="preview-clear-cache" class="btn btn-secondary preview-action-button">
                            🗑️ Clear Cache
                        </button>
                        <button id="preview-reset-settings" class="btn btn-ghost preview-action-button preview-action-button--danger">
                            ↺ Reset to Defaults
                        </button>
                    </div>
                </div>

                <!-- Status Section -->
                <div class="preview-settings-section">
                    <h5 class="preview-settings-section-title">Status</h5>
                    <div id="preview-status" class="preview-status">
                        <div class="preview-status-item">
                            <span class="preview-status-label">Last Update:</span>
                            <span class="preview-status-value" id="preview-last-update">Never</span>
                        </div>
                        <div class="preview-status-item">
                            <span class="preview-status-label">Render Time:</span>
                            <span class="preview-status-value" id="preview-render-time">-</span>
                        </div>
                        <div class="preview-status-item">
                            <span class="preview-status-label">Content Length:</span>
                            <span class="preview-status-value" id="preview-content-length">0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Error handling settings
        this.container.querySelector('#preview-smooth-errors')?.addEventListener('change', (e) => {
            this.updateSetting('smoothErrors', e.target.checked);
        });

        this.container.querySelector('#preview-retry-button')?.addEventListener('change', (e) => {
            this.updateSetting('showRetryButton', e.target.checked);
        });

        this.container.querySelector('#preview-error-timeout')?.addEventListener('change', (e) => {
            this.updateSetting('errorTimeout', parseInt(e.target.value));
        });

        // Performance settings
        this.container.querySelector('#preview-debounce-delay')?.addEventListener('change', (e) => {
            this.updateSetting('debounceDelay', parseInt(e.target.value));
        });

        this.container.querySelector('#preview-skip-unchanged')?.addEventListener('change', (e) => {
            this.updateSetting('skipUnchanged', e.target.checked);
        });

        this.container.querySelector('#preview-queue-updates')?.addEventListener('change', (e) => {
            this.updateSetting('queueUpdates', e.target.checked);
        });

        // Visual feedback settings
        this.container.querySelector('#preview-loading-animation')?.addEventListener('change', (e) => {
            this.updateSetting('showLoadingAnimation', e.target.checked);
        });

        this.container.querySelector('#preview-success-feedback')?.addEventListener('change', (e) => {
            this.updateSetting('showSuccessFeedback', e.target.checked);
        });

        this.container.querySelector('#preview-shimmer-effect')?.addEventListener('change', (e) => {
            this.updateSetting('showShimmerEffect', e.target.checked);
        });

        // Rendering mode settings
        this.container.querySelector('#preview-auto-scroll')?.addEventListener('change', (e) => {
            this.updateSetting('autoScroll', e.target.checked);
        });

        // Action buttons
        this.container.querySelector('#preview-force-refresh')?.addEventListener('click', () => {
            this.forceRefresh();
        });

        this.container.querySelector('#preview-clear-cache')?.addEventListener('click', () => {
            this.clearCache();
        });

        this.container.querySelector('#preview-reset-settings')?.addEventListener('click', () => {
            this.resetSettings();
        });
    }

    updateSetting(key, value) {
        appStore.dispatch(updatePreview({ [key]: value }));
        log.debug('SETTINGS', 'UPDATE', `Preview setting updated: ${key} = ${value}`);
    }

    forceRefresh() {
        const { editor } = appStore.getState();
        appStore.dispatch(renderMarkdown(editor.content));
        log.info('ACTIONS', 'FORCE_REFRESH', 'Force refresh triggered');
    }

    clearCache() {
        appStore.dispatch(clearCache());
        log.info('ACTIONS', 'CLEAR_CACHE', 'Preview cache cleared');
    }

    resetSettings() {
        const defaultSettings = {
            smoothErrors: true,
            showRetryButton: true,
            errorTimeout: 5000,
            debounceDelay: 150,
            skipUnchanged: true,
            queueUpdates: true,
            showLoadingAnimation: true,
            showSuccessFeedback: true,
            showShimmerEffect: true,
            autoScroll: true
        };

        appStore.dispatch(resetPreview(defaultSettings));

        this.render(); // Re-render with default values
        log.info('ACTIONS', 'RESET_SETTINGS', 'Preview settings reset to defaults');
    }

    updateStatus(data) {
        const lastUpdateEl = this.container.querySelector('#preview-last-update');
        const renderTimeEl = this.container.querySelector('#preview-render-time');
        const contentLengthEl = this.container.querySelector('#preview-content-length');

        if (lastUpdateEl) {
            lastUpdateEl.textContent = new Date().toLocaleTimeString();
        }

        if (data?.renderTime && renderTimeEl) {
            renderTimeEl.textContent = `${data.renderTime}ms`;
        }

        if (data?.contentLength && contentLengthEl) {
            contentLengthEl.textContent = data.contentLength.toLocaleString();
        }
    }

    subscribeToState() {
        let prevState = appStore.getState(); // Initialize previous state
        this.stateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            this.handleStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });
    }

    handleStateChange(newState, prevState) {
        const newSettings = newState.settings.preview;
        const oldSettings = prevState.settings.preview;

        if (JSON.stringify(newSettings) !== JSON.stringify(oldSettings)) {
            this.render();
        }
        
        const newPreview = newState.preview;
        const oldPreview = prevState.preview;
        
        if (JSON.stringify(newPreview) !== JSON.stringify(oldPreview)) {
            this.updateStatus(newPreview);
        }
    }

    destroy() {
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }

        log.info('PANEL_DESTROY', 'DESTROYED', 'PreviewSettingsPanel destroyed');
    }

    testLoadingAnimations() {
        const state = appStore.getState();
        const showLoadingAnimation = state.settings?.preview?.showLoadingAnimation !== false;
        
        // Find a preview container to test with
        const previewContainer = document.querySelector('.preview-container, .preview');
        if (!previewContainer) {
            log.warn('TEST', 'NO_PREVIEW_CONTAINER', 'No preview container found for testing loading animations');
            return;
        }
        
        // Show test feedback
        const testMessage = document.createElement('div');
        testMessage.className = 'preview-test-message';
        testMessage.innerHTML = `
            <small>
                <strong>Testing Loading Animations...</strong><br>
                Setting: ${showLoadingAnimation ? 'Enabled' : 'Disabled'}<br>
                Expected: ${showLoadingAnimation ? 'Animations should appear' : 'No animations should appear'}
            </small>
        `;
        testMessage.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            padding: 12px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 12px;
            max-width: 250px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(testMessage);
        
        // Test the loading state
        if (showLoadingAnimation) {
            previewContainer.classList.add('preview-updating');
            previewContainer.innerHTML = '<div class="preview-loading">Testing loading animation...</div>';
        } else {
            previewContainer.classList.remove('preview-updating');
            previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">Loading animations disabled - no animation shown</div>';
        }
        
        // Clean up after 3 seconds
        setTimeout(() => {
            previewContainer.classList.remove('preview-updating');
            testMessage.remove();
            log.info('TEST', 'ANIMATION_TEST_COMPLETE', 'Loading animation test completed');
        }, 3000);
    }
} 

// Register this panel with the registry
panelRegistry.register({
    id: 'preview-settings',
    title: 'Preview',
    component: PreviewSettingsPanel,
    defaultCollapsed: true
}); 