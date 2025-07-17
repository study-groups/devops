/**
 * ContextPanel.js - Context Manager integrated as a panel
 * 
 * Converts the existing ContextManagerComponent into a panel-based component
 * that can be managed by the PanelManager system.
 */

import { BasePanel } from '../core/BasePanel.js';
import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import eventBus from '/client/eventBus.js';
import { settingsSectionRegistry } from '/client/settings/core/settingsSectionRegistry.js';
import { renderSettingsSections } from '/client/settings/core/SettingsSectionRenderer.js';

let contextManagerInstance = null;

export class ContextPanel extends BasePanel {
    constructor(options = {}) {
        super('context', {
            width: 280,
            minWidth: 250,
            maxWidth: 400,
            order: 0, // Leftmost panel
            ...options
        });

        this.log('ContextPanel initialized', 'info');
    }

    /**
     * Get panel title
     */
    getTitle() {
        return 'Context Manager';
    }

    /**
     * Setup event listeners
     */
    onSetupEventListeners() {
        // Subscribe to app store for context-related changes
        this.storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            this.handleStoreChange(newState, prevState);
        });
    }

    /**
     * Handle app store changes
     */
    handleStoreChange(newState, prevState) {
        const newAuthState = newState.auth;
        const newFileState = newState.file;
        const newSettingsState = newState.settings;
        
        const prevAuthState = prevState.auth || {};
        const prevFileState = prevState.file || {};
        const prevSettingsState = prevState.settings || {};

        const authRelevantChanged =
            newAuthState?.isInitializing !== prevAuthState?.isInitializing ||
            newAuthState?.isAuthenticated !== prevAuthState?.isAuthenticated;

        const fileRelevantChanged =
            newFileState?.isInitialized !== prevFileState?.isInitialized ||
            newFileState?.isLoading !== prevFileState?.isLoading ||
            newFileState?.isSaving !== prevFileState?.isSaving ||
            newFileState?.currentPathname !== prevFileState?.currentPathname ||
            newFileState?.isDirectorySelected !== prevFileState?.isDirectorySelected ||
            newFileState?.currentListing !== prevFileState?.currentListing ||
            newFileState?.parentListing !== prevFileState?.parentListing ||
            newFileState?.availableTopLevelDirs !== prevFileState?.availableTopLevelDirs;

        const settingsRelevantChanged = !prevSettingsState ||
            newSettingsState?.currentContentSubDir !== prevSettingsState?.currentContentSubDir;

        if (authRelevantChanged || fileRelevantChanged || settingsRelevantChanged) {
            this.render();
        }
    }

    /**
     * Render the context manager content
     */
    render() {
        const container = document.createElement('div');
        container.className = 'context-manager';

        // Placeholder for the new context management UI
        container.innerHTML = `
            <div class="context-placeholder" style="padding: 10px;">
                <h4>Context Manager</h4>
                <p style="font-size: 12px; color: #6c757d;">
                    This panel is for collecting files and links to create a named context for future use.
                </p>
            </div>
        `;
        
        return container;
    }

    /**
     * Called when panel is mounted
     */
    onMount() {
        this.log('ContextPanel mounted', 'info');
        // Initial render will be called by base class
    }

    /**
     * Called when panel is shown
     */
    onShow() {
        this.log('ContextPanel shown', 'debug');
        // Refresh content when shown
        this.render();
    }

    /**
     * Called when panel is hidden
     */
    onHide() {
        this.log('ContextPanel hidden', 'debug');
    }

    /**
     * Called when panel is resized
     */
    onResize() {
        // Handle any resize-specific logic here
        this.log(`ContextPanel resized to ${this.state.width}px`, 'debug');
    }
} 