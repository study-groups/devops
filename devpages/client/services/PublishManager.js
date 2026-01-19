/**
 * PublishManager.js - Centralized publish state and operations
 *
 * Single source of truth for:
 * - Current file publish status
 * - Published files list from bucket
 * - Publish/unpublish operations
 * - Progress tracking
 *
 * Both PublishPanel and PublishTray subscribe to this manager.
 */

import { appStore } from '/client/appState.js';
import { selectActiveConfigurationDecrypted } from '/client/store/slices/publishConfigSlice.js';
import { PublishAPI } from '/client/components/publish/PublishAPI.js';
import { publishService } from './PublishService.js';
import { findEditor } from '/client/components/publish/PublishUtils.js';

const log = window.APP?.services?.log?.createLogger('PublishManager') || {
    info: (...args) => console.log('[PublishManager]', ...args),
    error: (...args) => console.error('[PublishManager]', ...args),
    debug: (...args) => console.debug('[PublishManager]', ...args),
    warn: (...args) => console.warn('[PublishManager]', ...args)
};

class PublishManager {
    constructor() {
        // State
        this.state = {
            // Current file status
            currentFile: null,
            publishStatus: { isPublished: false, url: null },

            // Operation state
            isProcessing: false,
            progressPercent: 0,
            statusMessage: '',
            error: null,

            // Published files from bucket
            publishedFiles: [],
            isLoadingFiles: false,
            filesError: null,

            // Connection info
            connectionInfo: null,

            // CSS strategy for publishing (embedded | linked | hybrid)
            cssStrategy: this.loadCssStrategy()
        };

        // Subscribers
        this.subscribers = new Set();

        // Store subscription for file changes
        this.storeUnsubscribe = null;
    }

    /**
     * Load CSS strategy from localStorage
     */
    loadCssStrategy() {
        try {
            const saved = localStorage.getItem('devpages:publish:cssStrategy');
            if (saved && ['embedded', 'linked', 'hybrid'].includes(saved)) {
                return saved;
            }
        } catch (e) {
            // localStorage may not be available
        }
        return 'embedded'; // default
    }

    /**
     * Save CSS strategy to localStorage
     */
    saveCssStrategy(strategy) {
        try {
            localStorage.setItem('devpages:publish:cssStrategy', strategy);
        } catch (e) {
            // localStorage may not be available
        }
    }

    /**
     * Initialize the manager
     */
    init() {
        if (this.storeUnsubscribe) return;

        // Subscribe to store to track current file changes
        this.storeUnsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            const currentFile = state.file?.currentFile?.pathname || null;

            if (currentFile !== this.state.currentFile) {
                this.state.currentFile = currentFile;
                this.loadPublishStatus();
            }
        });

        // Load initial status
        const state = appStore.getState();
        this.state.currentFile = state.file?.currentFile?.pathname || null;
        this.loadPublishStatus();

        log.info('INIT', 'PublishManager initialized');
    }

    /**
     * Subscribe to state changes
     * Lazily initializes the manager on first subscription
     */
    subscribe(callback) {
        // Lazy init on first subscription
        if (!this.storeUnsubscribe) {
            this.init();
        }
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Notify all subscribers
     */
    notify() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (e) {
                log.error('NOTIFY_ERROR', e.message);
            }
        });
    }

    /**
     * Update state and notify
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notify();
    }

    /**
     * Get current state
     * Lazily initializes if needed
     */
    getState() {
        if (!this.storeUnsubscribe) {
            this.init();
        }
        return { ...this.state };
    }

    /**
     * Load publish status for current file
     */
    async loadPublishStatus() {
        if (!this.state.currentFile) {
            this.setState({ publishStatus: { isPublished: false, url: null } });
            return;
        }

        try {
            const status = await PublishAPI.checkStatus(this.state.currentFile);
            this.setState({ publishStatus: status, error: null });
        } catch (error) {
            log.error('LOAD_STATUS_ERROR', error.message);
            this.setState({
                publishStatus: { isPublished: false, url: null },
                error: null // Don't show error for status check
            });
        }
    }

    /**
     * Load connection info from server
     */
    async loadConnectionInfo() {
        try {
            const config = await PublishAPI.getSpacesConfig();
            if (config) {
                this.setState({
                    connectionInfo: {
                        endpoint: config.endpointValue !== 'Not Set' ? config.endpointValue : null,
                        region: config.regionValue !== 'Not Set' ? config.regionValue : null,
                        bucket: config.bucketValue !== 'Not Set' ? config.bucketValue : null,
                        baseUrl: config.publishBaseUrlValue !== 'Not Set' ? config.publishBaseUrlValue : null
                    }
                });
            }
        } catch (error) {
            log.error('LOAD_CONFIG_ERROR', error.message);
        }
    }

    /**
     * Load published files from bucket
     */
    async loadPublishedFiles() {
        const state = appStore.getState();
        const activeConfig = selectActiveConfigurationDecrypted(state);

        if (!activeConfig) {
            this.setState({ publishedFiles: [], filesError: 'No configuration selected' });
            return;
        }

        this.setState({ isLoadingFiles: true, filesError: null });

        try {
            const response = await fetch(
                `/api/spaces/list-files?bucket=${encodeURIComponent(activeConfig.bucket)}&prefix=${encodeURIComponent(activeConfig.prefix || 'published/')}`
            );

            if (!response.ok) {
                throw new Error(`Failed to list files: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.files)) {
                // Sort by lastModified descending (newest first)
                const sortedFiles = data.files.sort((a, b) => {
                    return new Date(b.lastModified) - new Date(a.lastModified);
                });

                this.setState({
                    publishedFiles: sortedFiles,
                    isLoadingFiles: false
                });
            } else {
                throw new Error(data.error || 'Failed to load files');
            }
        } catch (error) {
            log.error('LOAD_FILES_ERROR', error.message);
            this.setState({
                publishedFiles: [],
                isLoadingFiles: false,
                filesError: error.message
            });
        }
    }

    /**
     * Publish current file
     */
    async publish() {
        if (this.state.isProcessing) return { success: false, error: 'Already processing' };

        const reduxState = appStore.getState();
        const currentFile = reduxState.file?.currentFile?.pathname;
        const activeConfig = selectActiveConfigurationDecrypted(reduxState);

        if (!currentFile) {
            return { success: false, error: 'No file selected' };
        }

        if (!activeConfig) {
            return { success: false, error: 'No configuration selected' };
        }

        this.setState({
            isProcessing: true,
            progressPercent: 0,
            statusMessage: 'Starting...',
            error: null
        });

        try {
            // Read content
            this.setState({ progressPercent: 20, statusMessage: 'Reading content...' });

            const editor = findEditor();
            if (!editor) {
                throw new Error('Editor not found');
            }

            const content = editor.value || '';
            if (!content.trim()) {
                throw new Error('Content is empty');
            }

            // Generate HTML with current CSS strategy
            this.setState({ progressPercent: 40, statusMessage: 'Generating HTML...' });

            const htmlContent = await publishService.generatePublishHtml(content, currentFile, {
                cssStrategy: this.state.cssStrategy
            });
            if (!htmlContent) {
                throw new Error('HTML generation failed');
            }

            // Upload
            this.setState({ progressPercent: 70, statusMessage: 'Uploading...' });

            const result = await PublishAPI.publish(currentFile, htmlContent, true, activeConfig);

            // Success
            this.setState({
                progressPercent: 100,
                statusMessage: 'Complete!',
                publishStatus: { isPublished: true, url: result.url },
                isProcessing: false
            });

            log.info('PUBLISH_SUCCESS', `Published: ${currentFile} to ${result.url}`);

            // Refresh files list
            this.loadPublishedFiles();

            return { success: true, url: result.url };

        } catch (error) {
            log.error('PUBLISH_ERROR', error.message);

            this.setState({
                isProcessing: false,
                progressPercent: 0,
                statusMessage: '',
                error: error.message
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Unpublish current file
     */
    async unpublish() {
        if (this.state.isProcessing) return { success: false, error: 'Already processing' };

        const reduxState = appStore.getState();
        const currentFile = reduxState.file?.currentFile?.pathname;
        const activeConfig = selectActiveConfigurationDecrypted(reduxState);

        if (!currentFile) {
            return { success: false, error: 'No file selected' };
        }

        if (!activeConfig) {
            return { success: false, error: 'No configuration selected' };
        }

        this.setState({
            isProcessing: true,
            statusMessage: 'Unpublishing...',
            error: null
        });

        try {
            await PublishAPI.unpublish(currentFile, activeConfig);

            this.setState({
                publishStatus: { isPublished: false, url: null },
                isProcessing: false,
                statusMessage: ''
            });

            log.info('UNPUBLISH_SUCCESS', `Unpublished: ${currentFile}`);

            // Refresh files list
            this.loadPublishedFiles();

            return { success: true };

        } catch (error) {
            log.error('UNPUBLISH_ERROR', error.message);

            this.setState({
                isProcessing: false,
                statusMessage: '',
                error: error.message
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Clear error state
     */
    clearError() {
        this.setState({ error: null });
    }

    /**
     * Set CSS strategy for publishing
     * @param {string} strategy - 'embedded' | 'linked' | 'hybrid'
     */
    setCssStrategy(strategy) {
        if (['embedded', 'linked', 'hybrid'].includes(strategy)) {
            this.setState({ cssStrategy: strategy });
            this.saveCssStrategy(strategy);
            log.info('CSS_STRATEGY', `Set CSS strategy to: ${strategy}`);
        } else {
            log.warn('CSS_STRATEGY', `Invalid strategy: ${strategy}`);
        }
    }

    /**
     * Get filename from path
     */
    getFilename(pathname) {
        if (!pathname) return null;
        return pathname.split('/').pop();
    }

    /**
     * Format relative time
     */
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        this.subscribers.clear();
    }
}

// Create singleton instance
export const publishManager = new PublishManager();

// Note: init() is called lazily when first subscriber registers
// This avoids issues with import order and store initialization
