/**
 * Left Sidebar for Code Mode
 * Displays file and directory listing for the current context
 */

console.log("Code sidebar component loaded");

class CodeSidebar {
    constructor() {
        this.container = null;
        this.sidebar = null;
        this.currentPath = '';
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.init();
    }

    init() {
        console.log('[CodeSidebar] Initializing...');
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('[CodeSidebar] Setting up...');
        this.container = document.getElementById('code-sidebar-content');
        this.sidebar = document.getElementById('code-sidebar');
        
        if (!this.container || !this.sidebar) {
            console.warn(`[CodeSidebar] Elements not found - container: ${!!this.container}, sidebar: ${!!this.sidebar}`);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`[CodeSidebar] Retrying setup in 500ms (attempt ${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => this.setup(), 500);
                return;
            } else {
                console.error('[CodeSidebar] Max retries reached, setup failed');
                return;
            }
        }

        console.log('[CodeSidebar] Main sidebar element found');
        console.log('[CodeSidebar] Current body classes:', document.body.className);

        // Listen for view mode changes to show/hide sidebar
        this.setupViewModeListener();
        
        // Check initial view mode
        this.checkInitialViewMode();
        
        // Load initial file list
        this.loadFileList();
        
        this.isInitialized = true;
        console.log('[CodeSidebar] Setup complete');
    }

    checkInitialViewMode() {
        // Check if we're currently in code mode
        if (document.body.classList.contains('view-code')) {
            console.log('[CodeSidebar] Already in code mode, showing sidebar');
            this.showSidebar();
        } else {
            console.log('[CodeSidebar] Not in code mode, hiding sidebar');
            this.hideSidebar();
        }
        
        // Also check app state if available
        if (window.appStore) {
            const state = window.appStore.getState();
            const viewMode = state.ui?.viewMode;
            console.log('[CodeSidebar] Current viewMode from appStore:', viewMode);
            if (viewMode === 'editor') {
                this.showSidebar();
            } else {
                this.hideSidebar();
            }
        }
    }

    setupViewModeListener() {
        console.log('[CodeSidebar] Setting up view mode listeners...');
        
        // Listen for app state changes (if eventBus is available)
        if (window.eventBus) {
            window.eventBus.on('ui:viewModeChanged', (mode) => {
                console.log('[CodeSidebar] EventBus viewMode changed to:', mode);
                this.toggleSidebarVisibility(mode);
            });
            console.log('[CodeSidebar] EventBus listener attached');
            
            // Listen for file system navigation events to refresh the sidebar
            window.eventBus.on('navigate:pathname', (data) => {
                console.log('[CodeSidebar] Navigation event:', data);
                if (data.isDirectory) {
                    // Refresh the sidebar when navigating to a directory
                    setTimeout(() => this.loadFileList(), 100);
                }
            });
        } else {
            console.warn('[CodeSidebar] EventBus not available');
        }

        // Listen for app store changes to refresh when current path changes
        if (window.appStore) {
            window.appStore.subscribe((newState, prevState) => {
                // Handle viewMode changes
                const currentViewMode = newState.ui?.viewMode;
                const prevViewMode = prevState.ui?.viewMode;
                
                if (currentViewMode !== prevViewMode) {
                    console.log('[CodeSidebar] AppStore viewMode changed from', prevViewMode, 'to', currentViewMode);
                    this.toggleSidebarVisibility(currentViewMode);
                }
                
                // Handle path changes
                const currentPath = newState.file?.currentPathname;
                const prevPath = prevState.file?.currentPathname;
                
                if (currentPath !== prevPath) {
                    console.log('[CodeSidebar] AppStore path changed from', prevPath, 'to', currentPath);
                    // Current path changed, refresh the file list
                    setTimeout(() => this.loadFileList(), 100);
                }
            });
            console.log('[CodeSidebar] AppStore listener attached');
        } else {
            console.warn('[CodeSidebar] AppStore not available');
        }

        // Also listen for body class changes as fallback
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const body = document.body;
                    const hasViewCode = body.classList.contains('view-code');
                    console.log('[CodeSidebar] Body class changed, view-code:', hasViewCode);
                    if (hasViewCode) {
                        this.showSidebar();
                    } else {
                        this.hideSidebar();
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
        console.log('[CodeSidebar] MutationObserver attached to body');
    }

    toggleSidebarVisibility(mode) {
        if (mode === 'editor') {
            this.showSidebar();
        } else {
            this.hideSidebar();
        }
    }

    showSidebar() {
        const sidebar = document.getElementById('code-sidebar');
        if (sidebar) {
            console.log('[CodeSidebar] Showing sidebar');
            sidebar.style.display = 'block';
        } else {
            console.warn('[CodeSidebar] Sidebar element not found when trying to show');
        }
    }

    hideSidebar() {
        const sidebar = document.getElementById('code-sidebar');
        if (sidebar) {
            console.log('[CodeSidebar] Hiding sidebar');
            sidebar.style.display = 'none';
        } else {
            console.warn('[CodeSidebar] Sidebar element not found when trying to hide');
        }
    }

    async loadFileList() {
        if (!this.container) return;

        try {
            // Show loading state
            this.container.innerHTML = '<div style="padding: 10px; color: #666;">Loading...</div>';
            
            // Get current directory from app state if available
            const currentPath = this.getCurrentPath();
            
            // Fetch file listing from API
            const response = await fetch(`/api/files/list?pathname=${encodeURIComponent(currentPath)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.renderFileList(data);
            
        } catch (error) {
            console.error('Error loading file list:', error);
            this.container.innerHTML = `
                <div style="padding: 10px; color: #d63384;">
                    Error loading files:<br>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    getCurrentPath() {
        // Try to get current path from app state
        if (window.appStore) {
            const state = window.appStore.getState();
            return state.file?.currentPathname || '';
        }
        return this.currentPath || '';
    }

    renderFileList(data) {
        if (!this.container) return;

        const { dirs = [], files = [] } = data;
        
        // Clear container
        this.container.innerHTML = '';

        // Create file list
        const listContainer = document.createElement('div');
        listContainer.className = 'file-list';

        // Add directories first
        dirs.forEach(dir => {
            const item = this.createFileItem(dir, 'directory');
            listContainer.appendChild(item);
        });

        // Add files
        files.forEach(file => {
            const item = this.createFileItem(file, 'file');
            listContainer.appendChild(item);
        });

        // If no files or directories
        if (dirs.length === 0 && files.length === 0) {
            listContainer.innerHTML = '<div style="padding: 10px; color: #666; font-style: italic;">No files found</div>';
        }

        this.container.appendChild(listContainer);
    }

    createFileItem(name, type) {
        const item = document.createElement('div');
        item.className = `file-item file-item-${type}`;
        item.style.cssText = `
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 3px;
            margin: 1px 0;
            font-size: 13px;
            display: flex;
            align-items: center;
            color: #333;
        `;

        // Add icon
        const icon = document.createElement('span');
        icon.style.cssText = 'margin-right: 6px; width: 12px; text-align: center;';
        icon.textContent = type === 'directory' ? '📁' : '📄';
        
        // Add name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

        item.appendChild(icon);
        item.appendChild(nameSpan);

        // Add hover effects
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#e9ecef';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
        });

        // Add click handler
        item.addEventListener('click', () => {
            this.handleFileItemClick(name, type);
        });

        return item;
    }

    handleFileItemClick(name, type) {
        console.log(`Clicked on ${type}: ${name}`);
        
        if (type === 'file') {
            // Load file content into editor
            this.loadFileContent(name);
        } else if (type === 'directory') {
            // Navigate to directory
            this.navigateToDirectory(name);
        }
    }

    async loadFileContent(filename) {
        try {
            const currentPath = this.getCurrentPath();
            const fullPath = currentPath ? `${currentPath}/${filename}` : filename;
            
            // Use the fileManager's loadFile function directly
            const fileManager = await import('/client/filesystem/fileManager.js');
            if (fileManager.loadFile) {
                await fileManager.loadFile(fullPath);
                console.log(`Loaded file: ${fullPath}`);
            } else {
                console.log(`Would load file: ${fullPath}`);
            }
        } catch (error) {
            console.error('Error loading file:', error);
        }
    }

    async navigateToDirectory(dirname) {
        try {
            const currentPath = this.getCurrentPath();
            const newPath = currentPath ? `${currentPath}/${dirname}` : dirname;
            
            // Use the eventBus to navigate to the directory
            if (window.eventBus) {
                window.eventBus.emit('navigate:pathname', { 
                    pathname: newPath, 
                    isDirectory: true 
                });
                console.log(`Navigated to directory: ${newPath}`);
            } else {
                // Fallback: update local state and reload
                this.currentPath = newPath;
                await this.loadFileList();
            }
        } catch (error) {
            console.error('Error navigating to directory:', error);
        }
    }

    refresh() {
        this.loadFileList();
    }

    // Add a manual test function
    testSidebar() {
        console.log('[CodeSidebar] Manual test function called');
        const sidebar = document.getElementById('code-sidebar');
        const body = document.body;
        
        console.log('[CodeSidebar] Sidebar element:', sidebar);
        console.log('[CodeSidebar] Body classes:', body.className);
        console.log('[CodeSidebar] Sidebar display style:', sidebar?.style.display);
        console.log('[CodeSidebar] Sidebar computed display:', window.getComputedStyle(sidebar)?.display);
        
        if (sidebar) {
            // Force show the sidebar
            sidebar.style.display = 'block !important';
            sidebar.style.backgroundColor = 'yellow';
            sidebar.style.border = '3px solid red';
            sidebar.style.zIndex = '9999';
            console.log('[CodeSidebar] Forced sidebar to be visible');
        }
    }
}

// Initialize the sidebar
window.codeSidebar = new CodeSidebar();

// Make test function globally accessible for debugging
window.testSidebar = () => {
    if (window.codeSidebar) {
        window.codeSidebar.testSidebar();
    } else {
        console.error('CodeSidebar not initialized');
    }
};

console.log('[CodeSidebar] Global test function available: window.testSidebar()');
