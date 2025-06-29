import { UIManager } from '/client/ui/UIManager.js';

// --- Module-level state ---
let editorInstance = null;

// --- Private Functions ---

/**
 * Initializes the Editor component.
 */
function init() {
    if (editorInstance) return;

    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) {
        console.error('[Editor] Container #editor-container not found.');
        return;
    }
    editorInstance = new Editor(editorContainer);
    console.log('[Editor] Component Initialized.');
}

/**
 * Refreshes the editor, potentially by reloading the current file.
 */
function refresh() {
    if (!editorInstance) {
        init();
        return;
    }
    console.log('[Editor] Component Refreshed. (Stub - implement content reload logic)');
    // A real implementation would be:
    // const { currentFile, currentDir } = appStore.getState().file;
    // editorInstance.loadFile(currentFile, currentDir);
}

/**
 * Destroys the editor instance and cleans up.
 */
function destroy() {
    if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
    }
    console.log('[Editor] Component Destroyed.');
}

// Example of a modular Editor component
export class Editor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        
        // Check if user is already logged in before initializing
        this.checkAndRestoreAuthState();
        
        this.initialize();
        
        // Listen for application state events
        document.addEventListener('app:stateChange', this.handleAppStateChange.bind(this));
        document.addEventListener('file:selected', this.handleFileSelected.bind(this));
        document.addEventListener('file:loaded', this.handleFileLoaded.bind(this));
        
        // Also listen for auth:login events directly for backward compatibility
        document.addEventListener('auth:login', this.handleAuthLogin.bind(this));
    }
    
    checkAndRestoreAuthState() {
        try {
            const storedAuth = localStorage.getItem('authState');
            if (storedAuth) {
                const parsedAuth = JSON.parse(storedAuth);
                if (parsedAuth.isLoggedIn && parsedAuth.expiresAt > Date.now()) {
                    console.log('[EDITOR] Found valid auth state in localStorage');
                    
                    // Update UI to reflect logged-in state
                    const displayElement = document.getElementById('pwd-display');
                    if (displayElement) {
                        const remainingTime = Math.round((parsedAuth.expiresAt - Date.now()) / 1000 / 60);
                        displayElement.textContent = `${parsedAuth.username} (${remainingTime}m)`;
                    }
                    
                    const loginForm = document.getElementById('login-form');
                    const logoutBtn = document.getElementById('logout-btn');
                    
                    if (loginForm) loginForm.style.display = 'none';
                    if (logoutBtn) logoutBtn.style.display = 'inline-block';
                    
                    document.body.setAttribute('data-auth-state', 'logged-in');
                    
                    // Initialize file manager if needed
                    if (!document.body.hasAttribute('data-app-state') || 
                        document.body.getAttribute('data-app-state') !== 'ready') {
                        setTimeout(() => {
                            this.triggerFileManagerInit(parsedAuth.username);
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error('[EDITOR] Error restoring auth state:', error);
        }
    }
    
    initialize() {
        // Create editor elements
        this.textarea = document.createElement('textarea');
        this.textarea.placeholder = "Write Markdown here...";
        this.textarea.classList.add('editor-textarea');
        
        // Add event listeners
        this.textarea.addEventListener('input', this.handleInput.bind(this));
        this.textarea.addEventListener('scroll', this.handleScroll.bind(this));
        
        // Append to container
        this.container.appendChild(this.textarea);
        
        // Log initialization
        console.log('[EDITOR] Editor component initialized');
        
        // Check if user is already logged in and restore state
        this.checkLoginStateAndRestore();
    }
    
    checkLoginStateAndRestore() {
        try {
            const storedAuth = localStorage.getItem('authState');
            if (storedAuth) {
                const parsedAuth = JSON.parse(storedAuth);
                if (parsedAuth.isLoggedIn && parsedAuth.expiresAt > Date.now()) {
                    console.log('[EDITOR] User already logged in, restoring state');
                    // Trigger file manager initialization if needed
                    if (!document.body.hasAttribute('data-app-state') || 
                        document.body.getAttribute('data-app-state') !== 'ready') {
                        // Manually trigger file manager initialization
                        setTimeout(() => {
                            this.triggerFileManagerInit(parsedAuth.username);
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error('[EDITOR] Error checking login state:', error);
        }
    }
    
    triggerFileManagerInit(username) {
        console.log('[EDITOR] Triggering file manager initialization for', username);
        import('../fileManager/index.js').then(module => {
            if (module.initializeFileManager) {
                module.initializeFileManager().then(() => {
                    console.log('[EDITOR] File manager initialized');
                    this.restoreLastDirectoryAndFile();
                });
            }
        }).catch(error => {
            console.error('[EDITOR] Failed to import fileManager:', error);
        });
    }
    
    restoreLastDirectoryAndFile() {
        try {
            // Get last selected file and directory
            const lastFile = localStorage.getItem('lastFile');
            const lastDir = localStorage.getItem('lastDir');
            const authState = JSON.parse(localStorage.getItem('authState') || '{}');
            
            console.log('[EDITOR] Restoring last directory and file:', lastDir, lastFile);
            
            if (lastDir) {
                // Set directory
                this.setDirectory(lastDir);
                
                // If we also have a file, load it after a delay
                if (lastFile) {
                    setTimeout(() => {
                        this.loadFile(lastFile, lastDir);
                    }, 300);
                }
            } else if (authState.username) {
                // If no last directory but user is logged in, set directory to username
                this.setDirectory(authState.username);
            }
        } catch (error) {
            console.error('[EDITOR] Failed to restore last directory and file:', error);
        }
    }
    
    setDirectory(directory) {
        console.log('[EDITOR] Setting directory to:', directory);
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            // Find or create the option
            let option = Array.from(dirSelect.options).find(opt => opt.value === directory);
            if (!option && directory) {
                option = document.createElement('option');
                option.value = directory;
                option.textContent = directory;
                dirSelect.appendChild(option);
            }
            
            if (option) {
                dirSelect.value = directory;
                // Trigger change event
                dirSelect.dispatchEvent(new Event('change'));
            }
        }
    }
    
    loadFile(filename, directory) {
        console.log('[EDITOR] Loading file:', filename, 'in directory:', directory);
        // Dispatch event to load the file
        document.dispatchEvent(new CustomEvent('file:load', {
            detail: { 
                filename: filename,
                directory: directory
            }
        }));
    }
    
    handleInput(event) {
        // Dispatch custom event for other components to listen to
        const customEvent = new CustomEvent('editor:change', {
            detail: { content: this.textarea.value }
        });
        document.dispatchEvent(customEvent);
        
        // Save current content to localStorage for recovery
        this.saveCurrentContent();
    }
    
    saveCurrentContent() {
        try {
            // Only save if content is not empty
            if (this.textarea.value.trim()) {
                localStorage.setItem('editorContent', this.textarea.value);
                localStorage.setItem('editorTimestamp', Date.now());
            }
        } catch (error) {
            console.error('[EDITOR ERROR] Failed to save editor content to localStorage', error);
        }
    }
    
    handleScroll(event) {
        // Handle scroll events
        // Save scroll position for restoration
        try {
            localStorage.setItem('editorScrollPosition', this.textarea.scrollTop);
        } catch (error) {
            console.error('[EDITOR ERROR] Failed to save scroll position', error);
        }
    }
    
    getValue() {
        return this.textarea.value;
    }
    
    setValue(content) {
        this.textarea.value = content || '';
        
        // Trigger change event to update any dependent components
        this.handleInput();
        
        // Restore scroll position if available
        this.restoreScrollPosition();
    }
    
    restoreScrollPosition() {
        try {
            const scrollPosition = localStorage.getItem('editorScrollPosition');
            if (scrollPosition) {
                this.textarea.scrollTop = parseInt(scrollPosition, 10);
            }
        } catch (error) {
            console.error('[EDITOR ERROR] Failed to restore scroll position', error);
        }
    }
    
    handleAppStateChange(event) {
        const { previousState, currentState } = event.detail;
        console.log(`[EDITOR] App state changed: ${previousState} -> ${currentState}`);
        
        // Handle login state change
        if (previousState === 'logged-out' && currentState === 'logged-in') {
            this.handleLogin(event.detail.userData);
        } 
        // Handle logout state change
        else if (previousState === 'logged-in' && currentState === 'logged-out') {
            this.handleLogout();
        }
        // Handle ready state (when app is fully initialized)
        else if (currentState === 'ready') {
            this.updateEditorState(event.detail.userData);
        }
    }
    
    handleLogin(userData) {
        console.log('[EDITOR] Handling login event');
        
        // Update editor UI based on login state
        this.updateEditorState({ isLoggedIn: true, ...userData });
        
        // No need to manually trigger file manager init - the AppState will handle that
        // Just update the editor UI to reflect logged-in state
        this.textarea.classList.add('logged-in');
    }
    
    handleLogout() {
        console.log('[EDITOR] Handling logout event');
        
        // Clear editor content
        this.setValue('');
        
        // Update editor UI to reflect logged-out state
        this.textarea.classList.remove('logged-in');
        
        // Update editor state
        this.updateEditorState({ isLoggedIn: false });
    }
    
    handleFileSelected(event) {
        // When a file is selected, save its info for restoration
        const { filename, directory } = event.detail;
        if (filename && directory) {
            console.log(`[EDITOR] File selected: ${filename} in ${directory}`);
            // We don't need to save this here - the AppState will handle it
        }
    }
    
    handleFileLoaded(event) {
        // When a file is loaded, update the editor content
        const { content, filename, directory } = event.detail;
        console.log(`[EDITOR] File loaded: ${filename}`);
        
        if (content !== undefined) {
            this.setValue(content);
        }
    }
    
    updateEditorState(userData) {
        // Update editor UI or functionality based on user state
        if (userData && userData.isLoggedIn) {
            // Enable additional features for logged-in users
            this.textarea.classList.add('logged-in');
            
            // You might want to enable additional buttons or features
            if (this.options.onLoginStateChange) {
                this.options.onLoginStateChange(true);
            }
        } else {
            // Reset to default state for logged-out users
            this.textarea.classList.remove('logged-in');
            
            if (this.options.onLoginStateChange) {
                this.options.onLoginStateChange(false);
            }
        }
    }
    
    // Add this method to handle direct auth:login events
    handleAuthLogin(event) {
        console.log('[EDITOR] Handling direct auth:login event');
        const userData = event.detail;
        
        // Update editor UI based on login state
        this.updateEditorState({ 
            isLoggedIn: true, 
            username: userData.username 
        });
        
        // Update UI to reflect logged-in state
        this.textarea.classList.add('logged-in');
        
        // Trigger file manager initialization
        setTimeout(() => {
            this.triggerFileManagerInit(userData.username);
        }, 100);
    }
    
    // Clean up event listeners when editor is destroyed
    destroy() {
        document.removeEventListener('app:stateChange', this.handleAppStateChange);
        document.removeEventListener('file:selected', this.handleFileSelected);
        document.removeEventListener('file:loaded', this.handleFileLoaded);
        document.removeEventListener('auth:login', this.handleAuthLogin);
        this.textarea.removeEventListener('input', this.handleInput);
        this.textarea.removeEventListener('scroll', this.handleScroll);
        
        if (this.container.contains(this.textarea)) {
            this.container.removeChild(this.textarea);
        }
        
        // Clear container
        this.container.innerHTML = '';
        console.log('[EDITOR] Editor instance destroyed');
    }
} 

// --- Component Definition ---

const EditorComponent = {
    name: 'Editor',
    init,
    refresh,
    destroy
};

// --- Registration ---
UIManager.register(EditorComponent);