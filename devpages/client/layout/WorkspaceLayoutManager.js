/**
 * WorkspaceLayoutManager.js
 * A headless service for managing the three-panel workspace layout.
 */
import { panelStateService } from '../panels/PanelStateManager.js';

class WorkspaceLayoutService {
    constructor() {
        this.sidebarContainer = null;
        this.editorContainer = null;
        this.previewContainer = null;
        this.logContainer = null;

        this.isSidebarVisible = false;
        this.isEditorVisible = true;
    }

    initialize() {
        this.sidebarContainer = document.getElementById('sidebar-container');
        this.editorContainer = document.getElementById('editor-container');
        this.previewContainer = document.getElementById('preview-container');
        this.logContainer = document.getElementById('log-container');

        if (!this.sidebarContainer || !this.editorContainer || !this.previewContainer) {
            console.warn('[WorkspaceLayoutService] Required panel elements not found in DOM.');
            return;
        }

        this.updateLayout();
    }

    updateLayout() {
        const visiblePanels = panelStateService.getVisiblePanels();
        const sidebarVisible = visiblePanels.some(p => p.uiState.visible && ['left', 'right'].includes(p.config.defaultZone));

        if (this.isSidebarVisible !== sidebarVisible) {
            this.sidebarContainer.classList.toggle('hidden', !sidebarVisible);
            this.isSidebarVisible = sidebarVisible;
        }
    }

    toggleSidebar() {
        panelStateService.togglePanelVisibility('file-browser');
        this.updateLayout();
    }
}

export const workspaceLayoutService = new WorkspaceLayoutService(); 