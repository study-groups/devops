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
import { ASTPreviewView } from '../views/ASTPreviewView.js';
import { detectFileType, supportsAstPreview } from '../utils/fileTypeDetector.js';
import { CodeMirrorEditor } from './CodeMirrorEditor.js';


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
        this.astPreviewView = null; // AST-based preview for JS files
        this.codeMirrorEditor = null; // CodeMirror editor instance
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

        // Fast early-exit: skip if none of the slices we care about have changed (reference equality)
        const fileSlice = state.file;
        const uiSlice = state.ui;
        const editorSlice = state.editor;

        if (fileSlice === this._lastFileSlice &&
            uiSlice === this._lastUISlice &&
            editorSlice === this._lastEditorSlice) {
            return; // Nothing we care about has changed
        }

        this._lastFileSlice = fileSlice;
        this._lastUISlice = uiSlice;
        this._lastEditorSlice = editorSlice;

        const fileContent = fileSlice?.currentFile?.content;
        const filePath = fileSlice?.currentFile?.pathname;
        const editorContent = editorSlice?.content;

        // Handle UI visibility changes
        const leftSidebarVisible = uiSlice?.leftSidebarVisible;
        const editorVisible = uiSlice?.editorVisible;
        const previewVisible = uiSlice?.previewVisible;

        if (leftSidebarVisible !== this._lastLeftSidebarVisible ||
            editorVisible !== this._lastEditorVisible ||
            previewVisible !== this._lastPreviewVisible) {
            this.updateZoneVisibility(state);
            this._lastLeftSidebarVisible = leftSidebarVisible;
            this._lastEditorVisible = editorVisible;
            this._lastPreviewVisible = previewVisible;
        }

        // Handle file content changes (skip if content is null = still loading)
        if (fileContent != null && (fileContent !== this.lastFileContent || filePath !== this.lastFilePath)) {
            this.setupWorkspaceForFile(fileContent, filePath);
            this.updateEditorContent(fileContent);
            this.lastFileContent = fileContent;
            this.lastFilePath = filePath;
        }

        // Auto-update preview when editor content changes
        if (editorContent && editorContent !== this.lastEditorContent && filePath) {
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
        // Cancel any pending setup to prevent race conditions with stale closures
        // This ensures only the LAST content value is used
        if (this._setupWorkspaceTimeout) {
            clearTimeout(this._setupWorkspaceTimeout);
        }

        // Wait for UI state to update, then populate containers
        this._setupWorkspaceTimeout = setTimeout(() => {
            this.populateWorkspaceContainers(content, filePath);
            this.initializeZoneTopBars();
            this._setupWorkspaceTimeout = null;
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
                <div id="codemirror-container" class="codemirror-container"></div>
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

        // Detect file type
        const fileType = detectFileType(fileName);

        // Set initial stats with file type
        this.editorTopBar.setStats({
            'type': fileType.label,
            'chars': content.length,
            'lines': content.split('\n').length
        });

        // Create CodeMirror editor
        const cmContainer = container.querySelector('#codemirror-container');
        if (cmContainer) {
            // Destroy previous instance if exists
            if (this.codeMirrorEditor) {
                this.codeMirrorEditor.destroy();
            }

            // Create new CodeMirror editor
            this.codeMirrorEditor = new CodeMirrorEditor({
                filePath,
                onChange: (newContent) => {
                    // Update Redux state
                    appStore.dispatch({ type: 'editor/setContent', payload: newContent });

                    // Update stats in real-time
                    this.editorTopBar.setStats({
                        'chars': newContent.length,
                        'lines': newContent.split('\n').length
                    });
                }
            });

            this.codeMirrorEditor.mount(cmContainer, content, filePath);

            // Listen for goto-line events from AST preview
            import('../eventBus.js').then(({ eventBus }) => {
                eventBus.off('editor:goto-line'); // Remove old listener
                eventBus.on('editor:goto-line', ({ line }) => {
                    if (this.codeMirrorEditor) {
                        this.codeMirrorEditor.gotoLine(line);
                    }
                });
            });
        }
    }

    setupImagePasteHandler(textarea) {
        textarea.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        await this.uploadAndInsertImage(textarea, file);
                    }
                }
            }
        });
    }

    setupImageDragDropHandler(textarea) {
        // Prevent default drag behaviors
        textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            textarea.classList.add('drag-over');
        });

        textarea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            textarea.classList.remove('drag-over');
        });

        textarea.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            textarea.classList.remove('drag-over');

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    await this.uploadAndInsertImage(textarea, file);
                }
            }
        });
    }

    async uploadAndInsertImage(textarea, file) {
        const originalCursorPos = textarea.selectionStart;
        const originalBorder = textarea.style.border;

        try {
            console.log('[WorkspaceManager] Uploading image:', file.name);
            textarea.style.border = '2px dashed orange';
            textarea.style.cursor = 'wait';

            // Upload the image
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch('/api/images/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const result = await response.json();
            const imageUrl = result.url;

            console.log('[WorkspaceManager] Image uploaded:', imageUrl);

            // Insert markdown at cursor position with width styling
            const textBefore = textarea.value.substring(0, originalCursorPos);
            const textAfter = textarea.value.substring(originalCursorPos);
            const fileName = file.name || 'Image';
            const markdownToInsert = `\n<img src="${imageUrl}" alt="${fileName}" style="width: 40%; max-width: 600px; margin: auto; display: block;">\n`;

            textarea.value = `${textBefore}${markdownToInsert}${textAfter}`;

            // Update cursor position
            const newCursorPos = originalCursorPos + markdownToInsert.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);

            // Trigger input event to update state
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Reset styling
            textarea.style.border = originalBorder;
            textarea.style.cursor = 'text';

        } catch (error) {
            console.error('[WorkspaceManager] Image upload failed:', error);
            alert(`Image upload failed: ${error.message}`);
            textarea.style.border = originalBorder;
            textarea.style.cursor = 'text';
        }
    }

    createPreview(container, content, filePath) {
        // Check if this file type supports AST preview (JavaScript)
        const useAstPreview = supportsAstPreview(filePath);

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

        if (useAstPreview) {
            // Use AST preview for JavaScript files
            if (!this.astPreviewView) {
                this.astPreviewView = new ASTPreviewView();
            }

            // Mount AST preview view
            this.astPreviewView.mount(previewSection);

            // Set initial stats and status
            this.previewTopBar
                .setStats({ 'mode': 'AST' })
                .setStatus('loading', 'Parsing...');

            // Update top bar when ready
            setTimeout(() => {
                this.previewTopBar
                    .setStats({
                        'mode': 'AST',
                        'size': content ? `${Math.round(content.length / 1024)}kb` : '0kb'
                    })
                    .setStatus('ready');
            }, 200);

        } else {
            // Use markdown preview for other files
            if (!this.previewView) {
                this.previewView = new PreviewView();
            }

            // Mount preview view in the preview section
            this.previewView.onMount(previewSection);

            // Set initial stats and status
            this.previewTopBar
                .setStats({ 'mode': 'markdown' })
                .setStatus('loading', 'Rendering...');

            // Add refresh button to preview top bar (after previewView is created)
            this.previewTopBar.addAction({
                id: 'refresh-preview',
                label: '↻',
                title: 'Refresh Preview',
                className: 'refresh-btn',
                onClick: () => {
                    if (this.previewView) {
                        this.previewView.forceRefresh();
                    }
                }
            });

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



    updateEditorContent(content) {
        // Update the CodeMirror editor when file content changes
        if (this.codeMirrorEditor && this.codeMirrorEditor.getContent() !== content) {
            console.log('[WorkspaceManager] Updating editor content');
            this.codeMirrorEditor.setContent(content);

            // Update stats if available
            if (this.editorTopBar) {
                this.editorTopBar.setStats({
                    'chars': content.length,
                    'lines': content.split('\n').length
                });
            }
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
