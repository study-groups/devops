/**
 * WorkspaceManager.js - Manages workspace UI state and content display
 * Automatically sets up editor and preview when files are loaded
 */

import { appStore } from '/client/appState.js';
import { ZoneTopBar } from './ZoneTopBar.js';
import { panelRegistry } from '../panels/BasePanel.js';
import { DiagnosticPanel } from '../panels/DiagnosticPanel.js';
import { ThemeManagementPanel } from '../panels/ThemeManagementPanel.js';
import { DesignTokensPanel } from '../panels/DesignTokensPanel.js';
import { PublishPanel } from '../panels/publish/PublishPanel.js';
import { FileBrowserPanel } from '../panels/dev/FileBrowserPanel.js';
import { UIInspectorPanel } from '../panels/UIInspectorPanel.js';
import { PreviewRenderingPanel } from '../panels/PreviewRenderingPanel.js';
import { sidebarVisibilityController } from '../layout/SidebarVisibilityController.js';
import { PreviewView } from '../views/PreviewView.js';


class WorkspaceManager {
    constructor() {
        this.initialized = false;
        this.lastFileContent = null;
        this.lastFilePath = null;
        this.lastUIState = null; // Track UI state changes
        this.sidebarTopBar = null;
        this.editorTopBar = null;
        this.previewTopBar = null;
        this.sidebarTabs = new Map(); // Track sidebar content tabs
        this.panelsInitialized = false;
        this.previewView = null; // Iframe-based preview view
    }

    initialize() {
        if (this.initialized) return;
        
        console.log('[WorkspaceManager] Initializing...');
        
        // Subscribe to Redux state changes
        appStore.subscribe(() => {
            this.handleStateChange();
        });
        
        // Set initial zone visibility
        this.updateZoneVisibility(appStore.getState());
        
        // Initialize panel system
        this.initializePanelSystem();
        
        // Initialize sidebar system
        this.initializeSidebarSystem();
        
        // Initialize sidebar visibility controller
        this.initializeSidebarVisibility();
        
        this.initialized = true;
        console.log('[WorkspaceManager] Initialized');
    }

    handleStateChange() {
        const state = appStore.getState();
        const fileContent = state.file?.currentFile?.content;
        const filePath = state.file?.currentFile?.pathname;
        const editorContent = state.editor?.content;
        
        // CRITICAL FIX: Only handle UI visibility changes when they actually change
        // Don't call updateZoneVisibility on every state change
        const currentUI = {
            leftSidebarVisible: state.ui?.leftSidebarVisible,
            editorVisible: state.ui?.editorVisible,
            previewVisible: state.ui?.previewVisible
        };
        
        if (!this.lastUIState || JSON.stringify(currentUI) !== JSON.stringify(this.lastUIState)) {
            console.log('[WorkspaceManager] UI visibility changed, updating zones');
            this.updateZoneVisibility(state);
            this.lastUIState = currentUI;
        }
        
        // Only act when file content changes
        if (fileContent && fileContent !== this.lastFileContent) {
            console.log(`[WorkspaceManager] New file content detected: ${filePath} (${fileContent.length} chars)`);
            this.setupWorkspaceForFile(fileContent, filePath);
            this.lastFileContent = fileContent;
            this.lastFilePath = filePath;
        }
        
        // Auto-update preview when editor content changes
        if (editorContent && editorContent !== this.lastEditorContent && filePath) {
            console.log(`[WorkspaceManager] Editor content changed, updating preview (${editorContent.length} chars)`);
            this.updatePreviewFromEditor(editorContent, filePath);
            this.lastEditorContent = editorContent;
        }
    }

    initializePanelSystem() {
        if (this.panelsInitialized) return;
        
        console.log('[WorkspaceManager] Initializing unified panel system...');
        
        try {
            // Register panel type classes with the unified registry
            // The registry will automatically use PanelConfigLoader for configuration
            panelRegistry.registerType('system-diagnostics', DiagnosticPanel);
            panelRegistry.registerType('design-tokens', DesignTokensPanel);
            panelRegistry.registerType('theme-management', ThemeManagementPanel);
            panelRegistry.registerType('publish-manager', PublishPanel);
            panelRegistry.registerType('file-browser', FileBrowserPanel);
            panelRegistry.registerType('ui-inspector', UIInspectorPanel);
            panelRegistry.registerType('preview-rendering', PreviewRenderingPanel);
            
            // Register debug panels
            panelRegistry.registerType('panel-browser', DiagnosticPanel);
            panelRegistry.registerType('state-monitor', DiagnosticPanel);
            panelRegistry.registerType('performance-panel', DiagnosticPanel);
            panelRegistry.registerType('log-viewer', DiagnosticPanel);
            
            // Expose unified panel system globally
            window.APP = window.APP || {};
            window.APP.panels = {
                // Unified registry methods (PREFERRED)
                registry: panelRegistry,
                createPanel: async (type, config) => await panelRegistry.createPanel(type, config),
                getPanel: (id) => panelRegistry.getPanel(id),
                getAllPanels: () => panelRegistry.getAllPanels(),
                destroyPanel: (id) => panelRegistry.destroyPanel(id),
                getDebugInfo: () => panelRegistry.getDebugInfo(),
                isTypeAvailable: (type) => panelRegistry.isTypeAvailable(type),
                getRegisteredTypes: () => panelRegistry.getRegisteredTypes(),
                
                // Utility methods (will be populated by debug utilities)
                list: null,
                inspect: null,
                createTest: null,
                showAll: null,
                hideAll: null,
                cascade: null,
                tile: null,
                getState: null,
                monitor: null,
                performanceTest: null,
                cleanup: null,
                export: null,
                help: null,
                
                // Registry access for advanced usage
                registry: panelRegistry,
                BasePanel: null // Will be set lazily
            };
            
            // Load panel debug utilities in development
            if (window.location.hostname === 'localhost' || 
                window.location.hostname.includes('dev') ||
                window.location.search.includes('debug=true')) {
                this.loadPanelDebugUtilities();
            }
            
            // Add panel management to sidebar
            this.addPanelManagementTab();
            
            this.panelsInitialized = true;
            console.log('[WorkspaceManager] ✅ Panel system initialized successfully');
        } catch (error) {
            console.warn('[WorkspaceManager] ⚠️ Failed to initialize panel system:', error);
        }
    }

    loadPanelDebugUtilities() {
        console.log('[WorkspaceManager] Debug utilities disabled - script not found');
        // Skip loading debug utilities - they don't exist
    }

    addPanelManagementTab() {
        // Add a panels tab to the sidebar when it's created
        // This will be called later when sidebar tabs are initialized
        this.pendingPanelTab = {
            id: 'panels',
            title: 'Panels',
            content: this.createPanelManagementContent()
        };
    }

    createPanelManagementContent() {
        return `
            <div class="panel-management">
                <div class="panel-section">
                    <h4>Quick Actions</h4>
                    <button class="btn btn-secondary btn-sm" onclick="window.APP.panels.createPanel('diagnostic', {title: 'System Diagnostics'}).mount().show()">
                        Create Diagnostic Panel
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.APP.panels.list?.()">
                        List All Panels
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.APP.panels.cascade?.()">
                        Cascade Panels
                    </button>
                </div>
                <div class="panel-section">
                    <h4>Active Panels</h4>
                    <div id="active-panels-list">
                        <div class="panel-placeholder">No panels active</div>
                    </div>
                </div>
                <div class="panel-section">
                    <h4>Debug Console</h4>
                    <div class="debug-info">
                        <small>Use browser console for advanced panel operations:</small>
                        <code>window.APP.panels.help()</code>
                    </div>
                </div>
            </div>
        `;
    }

    initializeSidebarSystem() {
        console.log('[WorkspaceManager] Initializing SidebarManager...');
        
        const sidebarZone = document.getElementById('workspace-sidebar');
        if (sidebarZone) {
            // Import and initialize SidebarManager
            import('../layout/SidebarManager.js').then(async ({ SidebarManager }) => {
                this.sidebarManager = new SidebarManager();
                await this.sidebarManager.initialize(sidebarZone);
                
                // Expose to global APP for external access
                window.APP = window.APP || {};
                window.APP.services = window.APP.services || {};
                window.APP.services.sidebarManager = this.sidebarManager;
                
                console.log('[WorkspaceManager] ✅ SidebarManager initialized');
            }).catch(error => {
                console.warn('[WorkspaceManager] Failed to load SidebarManager:', error);
            });
        }
    }

    initializeSidebarVisibility() {
        console.log('[WorkspaceManager] Initializing SidebarVisibilityController...');
        
        try {
            sidebarVisibilityController.initialize();
            console.log('[WorkspaceManager] ✅ SidebarVisibilityController initialized');
        } catch (error) {
            console.warn('[WorkspaceManager] Failed to initialize SidebarVisibilityController:', error);
        }
    }

    updateZoneVisibility(state) {
        const ui = state.ui || {};
        
        // CRITICAL FIX: Apply proper default values when undefined
        // These should match the defaults in uiSlice.js
        const leftSidebarVisible = ui.leftSidebarVisible !== false; // Default to true
        const editorVisible = ui.editorVisible !== false; // Default to true  
        const previewVisible = ui.previewVisible !== false; // Default to true
        
        console.log('[WorkspaceManager] Updating zone visibility:', {
            leftSidebarVisible,
            editorVisible,
            previewVisible,
            uiState: ui
        });
        
        // Update sidebar zone visibility
        const sidebarZone = document.getElementById('workspace-sidebar');
        if (sidebarZone) {
            sidebarZone.style.display = leftSidebarVisible ? 'flex' : 'none';
        }
        
        // Update editor zone visibility
        const editorZone = document.getElementById('workspace-editor');
        if (editorZone) {
            editorZone.style.display = editorVisible ? 'flex' : 'none';
        }
        
        // Update preview zone visibility
        const previewZone = document.getElementById('workspace-preview');
        if (previewZone) {
            previewZone.style.display = previewVisible ? 'flex' : 'none';
        }
    }

    setupWorkspaceForFile(content, filePath) {
        const state = appStore.getState();
        
        console.log('[WorkspaceManager] Setting up workspace for file...');
        
        // Respect user's persisted visibility preferences - don't force zones visible
        
        // Wait for UI state to update, then populate containers
        setTimeout(() => {
            this.populateWorkspaceContainers(content, filePath);
            this.initializeZoneTopBars();
        }, 100);
    }

    initializeZoneTopBars() {
        // Simple sidebar - no complex management needed
        // Skip old tab bar creation

        // Initialize editor top bar
        if (!this.editorTopBar) {
            const editorContainer = document.getElementById('workspace-editor');
            if (editorContainer) {
                this.editorTopBar = new ZoneTopBar(editorContainer, { title: '', showStats: true, showStatus: false });
                editorContainer.prepend(this.editorTopBar.getElement());
            }
        }

        // Initialize preview top bar
        if (!this.previewTopBar) {
            const previewContainer = document.getElementById('workspace-preview');
            if (previewContainer) {
                this.previewTopBar = new ZoneTopBar(previewContainer, { title: '' });
                previewContainer.prepend(this.previewTopBar.getElement());
            }
        }
    }

    createSidebarTabBar(container) {
        // Load sidebar CSS
        if (!document.querySelector('link[href="/client/styles/sidebar.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/client/styles/sidebar.css';
            document.head.appendChild(link);
        }
        
        // Create tab bar element
        const tabBar = document.createElement('div');
        tabBar.className = 'sidebar-tab-bar';
        tabBar.innerHTML = `
            <div class="sidebar-tabs"></div>
        `;
        
        // Create content area
        const contentArea = document.createElement('div');
        contentArea.className = 'sidebar-content-area';
        
        // Clear container and add tab system
        container.innerHTML = '';
        container.appendChild(tabBar);
        container.appendChild(contentArea);
        
        this.sidebarTabBar = tabBar;
        this.sidebarContentArea = contentArea;
    }

    addSidebarTab(id, title, content, active = false) {
        if (!this.sidebarTabBar) return;
        
        const tabsContainer = this.sidebarTabBar.querySelector('.sidebar-tabs');
        if (!tabsContainer) return;
        
        // Create tab button
        const tabButton = document.createElement('button');
        tabButton.className = `btn btn-secondary btn-sm sidebar-tab ${active ? 'active' : ''}`;
        tabButton.dataset.tabId = id;
        tabButton.textContent = title;
        
        // Add click handler
        tabButton.addEventListener('click', () => {
            this.activateSidebarTab(id);
        });
        
        tabsContainer.appendChild(tabButton);
        this.sidebarTabs.set(id, { title, content, active });
        
        if (active) {
            this.setSidebarContent(content);
        }
    }

    activateSidebarTab(id) {
        // Deactivate all tabs
        const allTabs = this.sidebarTabBar.querySelectorAll('.sidebar-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Activate selected tab
        const selectedTab = this.sidebarTabBar.querySelector(`[data-tab-id="${id}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Show content
        const tabData = this.sidebarTabs.get(id);
        if (tabData) {
            this.setSidebarContent(tabData.content);
        }
    }

    setSidebarContent(content) {
        if (this.sidebarContentArea) {
            this.sidebarContentArea.innerHTML = content;
        }
    }

    populateWorkspaceContainers(content, filePath) {
        const editorContainer = document.getElementById('workspace-editor');
        const previewContainer = document.getElementById('workspace-preview');
        
        if (!editorContainer || !previewContainer) {
            console.warn('[WorkspaceManager] Workspace containers not found');
            return;
        }
        
        // Set up editor if empty or has placeholder content
        if (this.shouldPopulateContainer(editorContainer)) {
            console.log('[WorkspaceManager] Populating editor container...');
            this.createEditor(editorContainer, content, filePath);
        }
        
        // Set up preview if empty or has placeholder content
        if (this.shouldPopulateContainer(previewContainer)) {
            console.log('[WorkspaceManager] Populating preview container...');
            this.createPreview(previewContainer, content, filePath);
        }
        
        // Update button states
        // Button states are now managed by TopBarController
    }

    shouldPopulateContainer(container) {
        return container.children.length === 0 || 
               container.textContent.includes('No content') ||
               container.textContent.includes('Loading') ||
               container.textContent.includes('Preview will appear here');
    }

    createEditor(container, content, filePath) {
        const fileName = filePath ? filePath.split('/').pop() : 'file.md';
        
        container.innerHTML = `
            <div class="editor-section">
                <textarea 
                    id="md-editor" 
                    class="markdown-editor" 
                    placeholder="Start typing..."
                >${content}</textarea>
            </div>
        `;
        
        // Create programmable top bar
        this.editorTopBar = new ZoneTopBar(container, {
            title: '',
            showStats: true,
            showStatus: false
        });
        
        // Insert top bar at the beginning
        const editorSection = container.querySelector('.editor-section');
        editorSection.insertBefore(this.editorTopBar.getElement(), editorSection.firstChild);
        
        // Set initial stats
        this.editorTopBar.setStats({
            'chars': content.length,
            'lines': content.split('\n').length,
            'file': fileName
        });
        
        // Set up editor functionality
        const textarea = container.querySelector('#md-editor');
        if (textarea) {
            // Auto-save on changes
            textarea.addEventListener('input', () => {
                // Update Redux state
                appStore.dispatch({ type: 'editor/setContent', payload: textarea.value });
                
                // Update stats in real-time
                this.editorTopBar.setStats({
                    'chars': textarea.value.length,
                    'lines': textarea.value.split('\n').length
                });
            });
        }
    }

    createPreview(container, content, filePath) {
        // Create wrapper structure with top bar
        container.innerHTML = `
            <div class="preview-section">
            </div>
        `;

        // Create programmable top bar
        this.previewTopBar = new ZoneTopBar(container, {
            title: '',
            showStats: true,
            showStatus: true
        });

        // Insert top bar at the beginning
        const previewSection = container.querySelector('.preview-section');
        previewSection.insertBefore(this.previewTopBar.getElement(), previewSection.firstChild);

        // Set initial stats and status
        this.previewTopBar
            .setStats({ 'mode': 'markdown' })
            .setStatus('loading', 'Rendering...');

        // Create and mount iframe-based PreviewView
        if (!this.previewView) {
            this.previewView = new PreviewView();
        }

        // Mount preview view in the preview section
        this.previewView.onMount(previewSection);

        // Update top bar when preview updates
        setTimeout(() => {
            this.previewTopBar
                .setStats({
                    'mode': 'markdown',
                    'size': content ? `${Math.round(content.length / 1024)}kb` : '0kb'
                })
                .setStatus('ready');
        }, 200);
    }

    async renderPreview(container, content, filePath) {
        // Preview now updates automatically via Redux subscription in PreviewView
        // This method kept for compatibility but does nothing
        console.log('[WorkspaceManager] renderPreview called (handled by PreviewView)');
    }

    renderFallbackPreview(previewDiv, content) {
        // No longer needed - PreviewView handles all rendering
        console.log('[WorkspaceManager] renderFallbackPreview called (deprecated)');
    }

    async updatePreviewFromEditor(content, filePath) {
        const previewContainer = document.getElementById('workspace-preview');
        if (!previewContainer) return;
        
        const previewDiv = previewContainer.querySelector('.preview-container');
        if (!previewDiv) return;
        
        // Update preview top bar status
        if (this.previewTopBar) {
            this.previewTopBar.setStatus('loading', 'Updating...');
        }
        
        try {
            // Try to use the proper preview system
            const { updatePreview } = await import('/client/preview/index.js');
            
            appStore.dispatch(updatePreview({ content, filePath })).then(() => {
                console.log('[WorkspaceManager] Preview updated from editor content');
                
                // Update the preview container with rendered content
                setTimeout(() => {
                    const previewState = appStore.getState().preview;
                    if (previewState?.htmlContent) {
                        previewDiv.innerHTML = previewState.htmlContent;
                        
                        // Update preview top bar
                        if (this.previewTopBar) {
                            this.previewTopBar
                                .setStats({ 
                                    'mode': 'markdown',
                                    'size': `${Math.round(previewState.htmlContent.length / 1024)}kb`
                                })
                                .setStatus('ready');
                        }
                    }
                }, 100);
            }).catch(err => {
                console.warn('[WorkspaceManager] Preview update failed, using fallback:', err.message);
                if (this.previewTopBar) {
                    this.previewTopBar.setStatus('error', 'Render failed');
                }
                this.renderFallbackPreview(previewDiv, content);
            });
        } catch (error) {
            console.warn('[WorkspaceManager] Could not import preview system:', error.message);
            if (this.previewTopBar) {
                this.previewTopBar.setStatus('error', 'System error');
            }
            this.renderFallbackPreview(previewDiv, content);
        }
    }



    async loadPanelConfigurations() {
        // Log any API request attempts
        console.warn('[WorkspaceManager] Attempting to load panel configurations', {
            timestamp: new Date().toISOString(),
            origin: window.location.origin,
            pathname: window.location.pathname
        });

        // Load YAML panel configurations
        const panelConfigs = [
            { path: './panels/pdata/auth-panel.yaml', id: 'pdata-auth-panel' },
            { path: './panels/debug/redux-inspector.yaml', id: 'redux-inspector' },
            { path: './panels/publish/deployment-panel.yaml', id: 'deployment-settings' },
            { path: './panels/settings/theme-panel.yaml', id: 'theme-settings' }
        ];

        for (const config of panelConfigs) {
            try {
                // For now, create mock configs based on the YAML structure we saw
                const mockConfig = this.createMockPanelConfig(config.id);
                this.panelConfigs.set(config.id, mockConfig);
                
                // Simple panel config - no complex tag organization needed
            } catch (error) {
                console.error(`[WorkspaceManager] Failed to load panel config ${config.id}:`, error);
            }
        }
    }
}

// Create and export singleton instance
export const workspaceManager = new WorkspaceManager();

// Auto-initialize when module is loaded
workspaceManager.initialize();
