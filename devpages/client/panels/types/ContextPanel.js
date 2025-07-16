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

        // Context-specific state
        this.contextState = {
            activeSiblingDropdownPath: null,
            fetchingParentPath: null
        };

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
        
        // Use the centralized renderer to build the settings sections
        renderSettingsSections(container);

        return container;
    }

    /**
     * Apply panel-specific styles to the context manager
     */
    applyPanelStyles() {
        if (!this.contentElement) return;

        // Add styles for compact panel layout
        const style = document.createElement('style');
        style.textContent = `
            .panel-context .context-path-wrapper {
                margin-bottom: 8px;
            }
            
            .panel-context .context-breadcrumbs {
                font-size: 10px;
                gap: 1px;
                flex-wrap: wrap;
                line-height: 1.2;
                color: #6c757d;
            }
            
            .panel-context .breadcrumb-item {
                padding: 1px 2px;
                font-size: 10px;
                cursor: pointer;
                border-radius: 2px;
            }
            
            .panel-context .breadcrumb-item:hover {
                background-color: #e9ecef;
            }
            
            .panel-context .context-selection-row {
                margin-bottom: 8px;
            }
            
            .panel-context .context-selector {
                width: 100%;
                font-size: 11px;
                padding: 4px 6px;
                border: 1px solid #ced4da;
                border-radius: 3px;
                background-color: #fff;
            }
            
            .panel-context .context-actions {
                display: flex;
                gap: 4px;
            }
            
            .panel-context .context-actions button {
                flex: 1;
                font-size: 10px;
                padding: 4px 8px;
                border: 1px solid #ced4da;
                border-radius: 3px;
                background-color: #fff;
                cursor: pointer;
            }
            
            .panel-context .context-actions button:hover:not(:disabled) {
                background-color: #e9ecef;
            }
            
            .panel-context .context-actions button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        `;
        
        // Add class to content element
        this.contentElement.classList.add('panel-context');
        
        // Append style if not already present
        if (!document.head.querySelector('style[data-context-panel]')) {
            style.setAttribute('data-context-panel', 'true');
            document.head.appendChild(style);
        }
    }

    /**
     * Attach context-specific event listeners
     */
    attachContextEventListeners() {
        // Primary select change handler
        const primarySelect = this.contentElement?.querySelector('#context-primary-select');
        if (primarySelect) {
            this.addEventListener(primarySelect, 'change', this.handlePrimarySelectChange.bind(this));
        }

        // Save button handler
        const saveBtn = this.contentElement?.querySelector('#save-btn');
        if (saveBtn) {
            this.addEventListener(saveBtn, 'click', this.handleSaveButtonClick.bind(this));
        }

        // Publish button handler
        const publishBtn = this.contentElement?.querySelector('#publish-btn');
        if (publishBtn) {
            this.addEventListener(publishBtn, 'click', this.handlePublishButtonClick.bind(this));
        }

        // Breadcrumb navigation handler
        const breadcrumbContainer = this.contentElement?.querySelector('.context-breadcrumbs');
        if (breadcrumbContainer) {
            this.addEventListener(breadcrumbContainer, 'click', this.handleBreadcrumbClick.bind(this));
        }
    }

    /**
     * Generate breadcrumbs HTML
     */
    generateBreadcrumbsHTML(selectedDirectoryPath, selectedOrg, username, isAuthenticated) {
        let breadcrumbHTML = '';
        
        // Settings trigger (/) - opens popup from panel
        breadcrumbHTML += `
            <span id="context-settings-trigger"
                  class="breadcrumb-item breadcrumb-separator root-settings-trigger clickable"
                  title="Click: Open Settings | Current Org: ${selectedOrg}">
                /
            </span>`;

        if (isAuthenticated && selectedDirectoryPath !== null) {
            const pathSegments = selectedDirectoryPath === '' ? [] : selectedDirectoryPath.split('/');
            let currentBuiltPath = '';

            pathSegments.forEach((segment, index) => {
                if (!segment) return;
                
                currentBuiltPath = currentBuiltPath ? pathJoin(currentBuiltPath, segment) : segment;
                const isLast = index === pathSegments.length - 1;
                
                breadcrumbHTML += `
                    <span class="breadcrumb-item ${isLast ? 'current' : 'clickable'}"
                          ${!isLast ? `data-navigate-path="${currentBuiltPath}" data-is-directory="true"` : ''}>
                        ${segment}
                    </span>`;
                
                if (!isLast) {
                    breadcrumbHTML += `<span class="breadcrumb-separator">/</span>`;
                }
            });
        }

        return breadcrumbHTML;
    }

    /**
     * Handle breadcrumb click navigation
     */
    handleBreadcrumbClick(event) {
        const target = event.target;
        
        // Handle settings trigger click
        if (target.id === 'context-settings-trigger') {
            this.handleSettingsClick(event);
            return;
        }
        
        // Handle path navigation clicks
        if (target.classList.contains('clickable') && target.hasAttribute('data-navigate-path')) {
            event.preventDefault();
            event.stopPropagation();
            
            const pathname = target.dataset.navigatePath;
            const isDirectory = target.dataset.isDirectory === 'true';
            
            this.log(`Breadcrumb navigation: '${pathname}' (directory: ${isDirectory})`, 'debug');
            
            if (pathname === '') {
                eventBus.emit('navigate:pathname', { pathname: '', isDirectory: true });
            } else {
                eventBus.emit('navigate:pathname', { pathname, isDirectory });
            }
        }
    }

    /**
     * Handle primary select change
     */
    handlePrimarySelectChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) return;

        const selectedValue = selectedOption.value;
        const selectedType = selectedOption.dataset.type;

        // Handle parent directory navigation
        if (selectedType === 'parent') {
            const parentPath = selectedOption.dataset.parentPath;
            this.log(`Navigating to parent directory: '${parentPath}'`, 'debug');
            eventBus.emit('navigate:pathname', { pathname: parentPath, isDirectory: true });
            return;
        }

        const fileState = appStore.getState().file;
        const currentPathname = fileState.currentPathname;
        const isDirectorySelected = fileState.isDirectorySelected;

        let baseRelativeDirectoryPath = null;
        if (currentPathname !== null) {
            baseRelativeDirectoryPath = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
        }
        if (baseRelativeDirectoryPath === null || baseRelativeDirectoryPath === undefined) {
            if (currentPathname === '' && isDirectorySelected) {
                baseRelativeDirectoryPath = '';
            } else {
                this.log(`Error: Cannot determine base directory for primary selection.`, 'error');
                return;
            }
        }

        const newRelativePath = pathJoin(baseRelativeDirectoryPath, selectedValue);
        this.log(`Primary select change: Base='${baseRelativeDirectoryPath}', Sel='${selectedValue}', Type='${selectedType}', New Path='${newRelativePath}'`, 'debug');

        if (selectedType === 'dir') {
            eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: true });
        } else if (selectedType === 'file') {
            eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: false });
        }
    }

    /**
     * Handle save button click
     */
    handleSaveButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.log('Save button clicked', 'debug');
        
        const authState = appStore.getState().auth;
        if (!authState.isAuthenticated || !authState.user) {
            this.log('Cannot save: User not authenticated', 'warn');
            return;
        }
        
        eventBus.emit('file:save');
    }

    /**
     * Handle publish button click
     */
    handlePublishButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.log('Publish button clicked', 'debug');
        
        const fileState = appStore.getState().file;
        if (fileState.isDirectorySelected || !fileState.currentPathname) {
            this.log('Cannot publish: No file selected or directory view.', 'warn');
            alert('Please select a file to publish.');
            return;
        }
        
        if (typeof window.triggerActions?.publishToSpaces === 'function') {
            window.triggerActions.publishToSpaces();
        } else {
            this.log('Cannot publish: triggerActions.publishToSpaces is not available.', 'warn');
            alert('Publish action is not configured correctly.');
        }
    }

    /**
     * Handle settings click - show popup from panel
     */
    handleSettingsClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.log('Settings trigger clicked in panel', 'debug');
        
        // Check if UI components system is available
        if (typeof window.uiComponents?.showPopup === 'function') {
            this.log('UI Components system available, showing popup', 'debug');
            
            // Get current state to pass to popup
            const fileState = appStore.getState().file;
            const settingsState = appStore.getState().settings;
            
            const availableTopDirs = fileState.availableTopLevelDirs || ['data'];
            
            const popupProps = {
                pdDirBase: '/root/pj/pd/',
                contentSubDir: settingsState?.currentContentSubDir || 'data',
                availableSubDirs: availableTopDirs,
                displayPathname: fileState?.currentPathname || '',
                doEnvVars: settingsState?.doEnvVars || []
            };
            
            const success = window.uiComponents.showPopup('contextSettings', popupProps);
            if (success) {
                this.log('Context settings popup displayed successfully', 'debug');
            } else {
                this.log('Failed to display context settings popup', 'warn');
                alert('Unable to open settings panel. Please check console for details.');
            }
        } else {
            this.log('UI Components system not available yet', 'warn');
            alert('Settings panel is not ready yet. Please wait for the app to finish loading.');
        }
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