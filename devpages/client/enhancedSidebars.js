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
        
        if (!window.CodeManager) {
            console.error('[EnhancedSidebars] CodeManager not found on window. Ensure code-manager.js is loaded.');
            return;
        }
        this.codeManager = new window.CodeManager();
        window.codeManager = this.codeManager; // If global access is still needed
        
        this.fileList = new FileListComponent('code-sidebar-content');
        window.fileList = this.fileList; // If global access is still needed
        
        this.setupViewModeListener();
        this.setupCodeAnalysisListeners();
        this.checkInitialViewMode();
        
        await this.fileList.loadFiles();
    }
    
    setupViewModeListener() {
        document.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'setView') {
                const viewMode = e.target.dataset.viewMode;
                console.log('[EnhancedSidebars] View button clicked:', viewMode);
                setTimeout(() => {
                    this.handleViewModeChange(viewMode);
                }, 100);
            }
        });
        
        const observer = new MutationObserver(() => {
            this.checkBodyClasses();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    
    setupCodeAnalysisListeners() {
        if (window.eventBus) {
            window.eventBus.on('code:analysis-complete', (data) => {
                console.log('[EnhancedSidebars] Code analysis complete:', data);
                this.updateFileAnalysisStatus(data.filename, data);
            });
            
            window.eventBus.on('file:open', (data) => {
                console.log('[EnhancedSidebars] File opened:', data.filename);
            });
        } else {
            console.warn('[EnhancedSidebars] eventBus not found on window.');
        }
    }
    
    updateFileAnalysisStatus(filename, analysisData) {
        const fileCards = this.container.querySelectorAll('.file-card');
        fileCards.forEach(card => {
            if (card.dataset.name === filename.split('/').pop()) {
                const statsContainer = card.querySelector('.file-card-stats');
                if (statsContainer) {
                    statsContainer.innerHTML = ''; // Clear previous stats
                    const funcCount = analysisData.functions?.length || 0;
                    if (funcCount > 0) {
                        const funcBadge = document.createElement('span');
                        funcBadge.className = 'stat-item';
                        funcBadge.textContent = `${funcCount} fn`;
                        funcBadge.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
                        funcBadge.style.color = '#28a745';
                        statsContainer.appendChild(funcBadge);
                    }
                    
                    const depCount = (analysisData.dependencies?.imports?.length || 0) + 
                                   (analysisData.dependencies?.requires?.length || 0);
                    if (depCount > 0) {
                        const depBadge = document.createElement('span');
                        depBadge.className = 'stat-item';
                        depBadge.textContent = `${depCount} deps`;
                        depBadge.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
                        depBadge.style.color = '#007bff';
                        statsContainer.appendChild(depBadge);
                    }
                }
            }
        });
    }
    
    checkInitialViewMode() {
        this.checkBodyClasses();
    }
    
    checkBodyClasses() {
        const showSidebars = document.body.classList.contains('view-code') || document.body.classList.contains('view-split');
        console.log('[EnhancedSidebars] Body classes:', document.body.className, 'showSidebars:', showSidebars);
        
        if (showSidebars) {
            this.showSidebars();
        } else {
            this.hideSidebars();
        }
    }
    
    handleViewModeChange(viewMode) {
        console.log('[EnhancedSidebars] Handling view mode change:', viewMode);
        if (viewMode === 'editor' || viewMode === 'split') {
            this.showSidebars();
        } else {
            this.hideSidebars();
        }
    }
    
    showSidebars() {
        if (this.leftSidebar) {
            console.log('[EnhancedSidebars] Showing left sidebar');
            this.leftSidebar.style.display = 'flex';
        }
        if (this.rightSidebar) {
            console.log('[EnhancedSidebars] Showing right sidebar');
            this.rightSidebar.style.display = 'flex';
        }
    }
    
    hideSidebars() {
        if (this.leftSidebar) {
            console.log('[EnhancedSidebars] Hiding left sidebar');
            this.leftSidebar.style.display = 'none';
        }
        if (this.rightSidebar) {
            console.log('[EnhancedSidebars] Hiding right sidebar');
            this.rightSidebar.style.display = 'none';
        }
    }
    
    // Public API (if needed by other modules)
    getCodeManager() { return this.codeManager; }
    getFileList() { return this.fileList; }
    async analyzeCurrentProject() { /* ... */ }
}

// Initialize enhanced sidebar and attach to window if global access is needed
window.enhancedSidebars = new EnhancedSidebars(); // Renamed global instance

// Test function for debugging (can also be part of the class or standalone)
window.testEnhancedSidebars = function() { // Renamed test function
    const leftSidebar = document.getElementById('code-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');
    if (leftSidebar && rightSidebar) {
        leftSidebar.style.display = 'flex';
        leftSidebar.style.backgroundColor = 'lightblue';
        // ... other test styles ...

        rightSidebar.style.display = 'flex';
        rightSidebar.style.backgroundColor = 'lightcoral';
        // ... other test styles ...
        console.log('[EnhancedSidebars] Test: Both sidebars forced visible');
        
        if (window.fileList) {
            window.fileList.loadFiles();
        }
    } else {
        console.error('[EnhancedSidebars] Test: One or both sidebars not found');
    }
};

console.log('[EnhancedSidebars] Initialization complete via external file.'); 