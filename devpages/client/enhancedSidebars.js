console.log('[EnhancedSidebars] Initializing...'); // Changed log prefix for clarity

import FileListComponent from '/client/code/file-list-component.js';
// CodeManager is loaded globally via script tag in index.html, so window.CodeManager should be available
// eventBus is also assumed to be globally available via window.eventBus

class EnhancedSidebars { // Renamed class slightly for the new file
    constructor() {
        this.leftSidebar = null;
        this.rightSidebar = null;
        this.container = null; // Content of left sidebar
        this.fileList = null;
        this.codeManager = null;
        // this.currentPath = ''; // Not currently used, can be removed if not needed
        this.init();
    }
    
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    async setup() {
        this.leftSidebar = document.getElementById('code-sidebar');
        this.rightSidebar = document.getElementById('right-sidebar');
        this.container = document.getElementById('code-sidebar-content');
        
        if (!this.leftSidebar || !this.container || !this.rightSidebar) {
            console.warn('[EnhancedSidebars] Essential sidebar elements not found, retrying...');
            setTimeout(() => this.setup(), 500);
            return;
        }
        
        console.log('[EnhancedSidebars] Elements found, setting up components...');
        
        // This component should not be managing code or files directly anymore.
        // This will be handled by dedicated managers.
        // if (!window.CodeManager) {
        //     console.error('[EnhancedSidebars] CodeManager not found on window. Ensure code-manager.js is loaded.');
        //     return;
        // }
        // this.codeManager = new window.CodeManager();
        // window.codeManager = this.codeManager;
        
        this.fileList = new FileListComponent('code-sidebar-content');
        window.fileList = this.fileList; // Expose globally for now
        
        this.setupLayoutListener(); // REPLACED old listeners
        
        await this.fileList.loadFiles();
        
        // After setup, check the initial state from the layout manager
        if (window.layoutManager) {
            this.handleLayoutChange(window.layoutManager.getState());
        }
    }
    
    // Setup listener for layout changes
    setupLayoutListener() {
        if (window.eventBus) {
            window.eventBus.on('layout:modernStateChanged', (layoutState) => {
                console.log('[EnhancedSidebars] Received layout:modernStateChanged event:', layoutState);
                this.handleLayoutChange(layoutState);
            });
        } else {
            console.warn('[EnhancedSidebars] eventBus not found on window.');
        }
    }

    // Handle layout state changes
    handleLayoutChange(layoutState) {
        if (layoutState.editorType === 'raw-text') {
            this.hideSidebars();
        } else {
            this.setLeftSidebarVisibility(layoutState.leftSidebarVisible);
            this.setRightSidebarVisibility(layoutState.rightSidebarVisible);
        }
    }

    setLeftSidebarVisibility(visible) {
        if (this.leftSidebar) {
            this.leftSidebar.style.display = visible ? 'flex' : 'none';
        }
    }

    setRightSidebarVisibility(visible) {
        if (this.rightSidebar) {
            this.rightSidebar.style.display = visible ? 'flex' : 'none';
        }
    }
    
    showSidebars() {
        this.setLeftSidebarVisibility(true);
        this.setRightSidebarVisibility(true);
    }
    
    hideSidebars() {
        this.setLeftSidebarVisibility(false);
        this.setRightSidebarVisibility(false);
    }
    
    // Public API (if needed by other modules)
    getCodeManager() { return this.codeManager; }
    getFileList() { return this.fileList; }
    async analyzeCurrentProject() { /* ... */ }
}

// Initialize enhanced sidebar and attach to window if global access is needed
window.enhancedSidebars = new EnhancedSidebars();

// REMOVED the rogue window.layoutManager and test functions

console.log('[EnhancedSidebars] Initialization complete via external file.'); 