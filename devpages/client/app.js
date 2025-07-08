/*
/**
 * @file app.js
 * @description Main application entry point.
 * This file imports all major UI components to ensure they register with the UIManager,
 * and then starts the application by calling UIManager.init().
 */
/*
import { UIManager } from './ui/UIManager.js';
import { LayoutManager } from './layout/LayoutManager.js';
import { WorkspacePanelManager } from './layout/WorkspacePanelManager.js';
import { EditorPanel } from './panels/types/EditorPanel.js';

// Import UI components
// By importing them here, we ensure their registration code runs.
import './components/topBar.js';

// Import debug functions to make them available
import './debug/index.js';

// Initialize the application once the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[App] DOM ready. Initializing application...');
    
    // Initialize layout managers
    const layoutManager = new LayoutManager();
    const workspacePanelManager = new WorkspacePanelManager();
    
    // Initialize the editor panel in the editor container
    const editorContainer = document.getElementById('editor-container');
    console.log(`[DEBUG_APP] editorContainer found: ${!!editorContainer}`);
    if (editorContainer) {
        const editorPanel = new EditorPanel({
            id: 'main-editor'
        });
        editorPanel.mount(editorContainer);
        console.log('[App] EditorPanel mounted to editor-container');
    } else {
        console.error('[App] Editor container not found');
    }
    
    // Initialize the preview panel in the preview container  
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
        const { PreviewPanel } = await import('./panels/types/PreviewPanel.js');
        const previewPanel = new PreviewPanel({
            id: 'main-preview'
        });
        await previewPanel.mount(previewContainer);
        
        // Expose to window for debugging
        window.previewPanel = previewPanel;
        
        console.log('[App] PreviewPanel mounted to preview-container');
    } else {
        console.error('[App] Preview container not found');
    }
    
    // Initialize the workspace panel manager AFTER the main panels
    try {
        await workspacePanelManager.initialize();
        console.log('[App] WorkspacePanelManager initialized');
    } catch (error) {
        console.warn('[App] WorkspacePanelManager initialization failed:', error);
    }
    
    // Initialize UI Manager
    UIManager.init();
});
*/ 