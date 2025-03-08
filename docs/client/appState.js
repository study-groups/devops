import { authState } from './auth.js';
import { logMessage } from './log/index.js';
import { initializeFileManager } from '../fileManager.js';

// Application states
export const APP_STATES = {
    INITIALIZING: 'initializing',
    LOGGED_OUT: 'logged-out',
    LOGGING_IN: 'logging-in',
    LOGGED_IN: 'logged-in',
    LOADING_FILES: 'loading-files',
    READY: 'ready',
    ERROR: 'error'
};

// Create a singleton AppState manager
class AppStateManager {
    constructor() {
        this.currentState = APP_STATES.INITIALIZING;
        this.previousState = null;
        this.userData = null;
        this.error = null;
        
        // Initialize the application
        this.init();
    }
    
    async init() {
        logMessage('[APP] Initializing application state manager');
        
        // Check if user is already logged in (from localStorage)
        const storedAuth = localStorage.getItem('authState');
        
        if (storedAuth) {
            try {
                const parsedAuth = JSON.parse(storedAuth);
                const remainingTime = parsedAuth.expiresAt - Date.now();
                
                if (remainingTime > 0) {
                    // Valid session exists
                    this.userData = {
                        username: parsedAuth.username,
                        isLoggedIn: true,
                        expiresAt: parsedAuth.expiresAt
                    };
                    
                    // Update auth state
                    Object.assign(authState, {
                        isLoggedIn: true,
                        username: parsedAuth.username,
                        hashedPassword: parsedAuth.hashedPassword,
                        loginTime: parsedAuth.loginTime,
                        expiresAt: parsedAuth.expiresAt
                    });
                    
                    // Transition to logged in state
                    this.setState(APP_STATES.LOGGED_IN);
                    
                    // Initialize file manager
                    this.setState(APP_STATES.LOADING_FILES);
                    await this.initializeFileManager();
                    
                    // Transition to ready state
                    this.setState(APP_STATES.READY);
                } else {
                    // Session expired
                    logMessage('[APP] Session expired, transitioning to logged out state');
                    localStorage.removeItem('authState');
                    this.setState(APP_STATES.LOGGED_OUT);
                }
            } catch (error) {
                logMessage('[APP ERROR] Failed to restore login state: ' + error.message);
                localStorage.removeItem('authState');
                this.setState(APP_STATES.LOGGED_OUT);
            }
        } else {
            // No stored auth, transition to logged out
            this.setState(APP_STATES.LOGGED_OUT);
        }
        
        // Set up event listeners for auth events
        document.addEventListener('auth:login', this.handleLogin.bind(this));
        document.addEventListener('auth:logout', this.handleLogout.bind(this));
        document.addEventListener('fileManager:ready', this.handleFileManagerReady.bind(this));
        
        logMessage('[APP] Application state manager initialized');
    }
    
    setState(newState, data = {}) {
        if (this.currentState === newState) return;
        
        logMessage(`[APP] State transition: ${this.currentState} -> ${newState}`);
        
        this.previousState = this.currentState;
        this.currentState = newState;
        
        // Update additional data if provided
        if (data.userData) {
            this.userData = data.userData;
        }
        
        if (data.error) {
            this.error = data.error;
        }
        
        // Dispatch state change event
        document.dispatchEvent(new CustomEvent('app:stateChange', {
            detail: {
                previousState: this.previousState,
                currentState: this.currentState,
                userData: this.userData,
                error: this.error
            }
        }));
        
        // Update document body attribute for CSS styling
        document.body.setAttribute('data-app-state', this.currentState);
    }
    
    async handleLogin(event) {
        const userData = event.detail;
        
        this.setState(APP_STATES.LOGGING_IN);
        
        // Update user data
        this.userData = {
            username: userData.username,
            isLoggedIn: true,
            expiresAt: userData.expiresAt
        };
        
        // Transition to logged in state
        this.setState(APP_STATES.LOGGED_IN, { userData: this.userData });
        
        // Initialize file manager
        this.setState(APP_STATES.LOADING_FILES);
        await this.initializeFileManager();
        
        // Transition to ready state
        this.setState(APP_STATES.READY);
    }
    
    handleLogout() {
        // Clear user data
        this.userData = null;
        
        // Transition to logged out state
        this.setState(APP_STATES.LOGGED_OUT);
    }
    
    handleFileManagerReady() {
        // If we're in the loading files state, transition to ready
        if (this.currentState === APP_STATES.LOADING_FILES) {
            this.setState(APP_STATES.READY);
        }
    }
    
    async initializeFileManager() {
        try {
            // Initialize file manager
            const success = await initializeFileManager();
            
            if (!success) {
                throw new Error('Failed to initialize file manager');
            }
            
            // Restore last directory and file
            this.restoreLastDirectoryAndFile();
            
            return true;
        } catch (error) {
            logMessage('[APP ERROR] Failed to initialize file manager: ' + error.message);
            this.setState(APP_STATES.ERROR, { error });
            return false;
        }
    }
    
    restoreLastDirectoryAndFile() {
        try {
            // Get last selected file and directory
            const lastFile = localStorage.getItem('lastFile');
            const lastDir = localStorage.getItem('lastDir');
            
            if (lastDir) {
                // Dispatch event to set directory
                document.dispatchEvent(new CustomEvent('directory:set', {
                    detail: { directory: lastDir }
                }));
                
                // If we also have a file, load it
                if (lastFile) {
                    document.dispatchEvent(new CustomEvent('file:load', {
                        detail: { 
                            filename: lastFile,
                            directory: lastDir
                        }
                    }));
                }
            } else if (this.userData && this.userData.username) {
                // If no last directory but user is logged in, set directory to username
                document.dispatchEvent(new CustomEvent('directory:set', {
                    detail: { directory: this.userData.username }
                }));
            }
        } catch (error) {
            logMessage('[APP ERROR] Failed to restore last directory and file: ' + error.message);
        }
    }
}

// Create and export the singleton instance
export const appState = new AppStateManager(); 