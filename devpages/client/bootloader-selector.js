/**
 * Bootloader Selector - Choose State Management System
 * 
 * Provides a splash screen interface to select between:
 * - StateKit (existing system)
 * - Redux (new vanilla Redux system)
 * 
 * Stores user preference and initializes the selected system.
 */

import { logMessage } from './log/index.js';

class BootloaderSelector {
    constructor() {
        this.selectedSystem = null;
        this.storageKey = 'devpages-bootloader-preference';
        this.splashContainer = null;
    }

    async initialize() {
        logMessage('Bootloader selector initializing...', 'info');
        
        // Always show selector - no memory/preferences
        this.showSplashScreen();
    }

    // No preference saving - always show selector

    showSplashScreen() {
        logMessage('Showing bootloader selection screen', 'info');
        
        // Hide existing splash if present
        const existingSplash = document.getElementById('devpages-splash');
        if (existingSplash) {
            existingSplash.style.display = 'none';
        }

        // Create selector splash screen
        this.splashContainer = document.createElement('div');
        this.splashContainer.id = 'bootloader-selector-splash';
        this.splashContainer.innerHTML = this.createSplashHTML();
        
        document.body.appendChild(this.splashContainer);
        document.body.classList.add('bootloader-selector-active');
        
        // Add event listeners
        this.attachEventListeners();
    }

    createSplashHTML() {
        return `
            <div class="bootloader-selector-overlay">
                <div class="bootloader-selector-modal">
                    <div class="bootloader-selector-header">
                        <h3>Choose System</h3>
                    </div>
                    
                    <div class="bootloader-selector-options">
                        <button class="btn btn-sm bootloader-option" data-system="statekit">
                            <span class="bootloader-option-icon">🏛️</span>
                            <span class="bootloader-option-text">StateKit</span>
                        </button>
                        
                        <button class="btn btn-sm bootloader-option" data-system="redux">
                            <span class="bootloader-option-icon">⚡</span>
                            <span class="bootloader-option-text">Redux</span>
                        </button>
                    </div>
                    
                    <div class="bootloader-selector-footer">
                        <small>Press 1 or 2, or click to choose</small>
                    </div>
                </div>
            </div>
            
            <style>
                                 .bootloader-selector-overlay {
                     position: fixed;
                     top: 0;
                     left: 0;
                     width: 100%;
                     height: 100%;
                     background: rgba(0, 0, 0, 0.6);
                     backdrop-filter: blur(3px);
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     z-index: var(--z-modal);
                 }
                
                                 .bootloader-selector-modal {
                     background: var(--color-bg-elevated);
                     border-radius: var(--radius-lg);
                     border: 1px solid var(--color-border);
                     max-width: 320px;
                     width: 90%;
                     color: var(--color-fg);
                     box-shadow: var(--shadow-lg);
                 }
                 
                 .bootloader-selector-header {
                     padding: var(--space-6) var(--space-6) var(--space-4) var(--space-6);
                     text-align: center;
                 }
                 
                 .bootloader-selector-header h3 {
                     margin: 0;
                     color: var(--color-fg);
                     font-size: var(--font-size-lg);
                     font-weight: var(--font-weight-medium);
                 }
                 
                 .bootloader-selector-options {
                     display: flex;
                     flex-direction: column;
                     gap: var(--space-2);
                     padding: 0 var(--space-6);
                 }
                 
                 .bootloader-option {
                     width: 100%;
                     justify-content: flex-start;
                     gap: var(--space-3);
                     padding: var(--space-3) var(--space-4);
                 }
                 
                 .bootloader-option-icon {
                     font-size: 1.2rem;
                     flex-shrink: 0;
                 }
                 
                 .bootloader-option-text {
                     font-size: var(--font-size-sm);
                     font-weight: var(--font-weight-medium);
                 }
                 
                 .bootloader-selector-footer {
                     padding: var(--space-4) var(--space-6) var(--space-6) var(--space-6);
                     text-align: center;
                 }
                 
                 .bootloader-selector-footer small {
                     color: var(--color-fg-muted);
                     font-size: var(--font-size-xs);
                 }
                
                body.bootloader-selector-active {
                    overflow: hidden;
                }
                
                                 @media (max-width: 480px) {
                     .bootloader-selector-modal {
                         margin: var(--space-4);
                         width: calc(100% - var(--space-8));
                         max-width: none;
                     }
                     
                     .bootloader-selector-options {
                         padding: 0 var(--space-4);
                     }
                 }
            </style>
        `;
    }

    attachEventListeners() {
        // Option selection and immediate choice
        const options = this.splashContainer.querySelectorAll('.bootloader-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const system = option.dataset.system;
                this.handleSystemSelection(system);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '1') this.handleSystemSelection('statekit');
            if (e.key === '2') this.handleSystemSelection('redux');
            if (e.key === 'Escape') this.handleSystemSelection('statekit'); // Default to StateKit
        });
    }

    async handleSystemSelection(system) {
        logMessage(`Selected system: ${system}`, 'info');
        
        // Hide splash screen
        this.hideSplashScreen();
        
        // Start selected system
        await this.startSystem(system);
    }

    hideSplashScreen() {
        if (this.splashContainer) {
            this.splashContainer.remove();
            this.splashContainer = null;
        }
        document.body.classList.remove('bootloader-selector-active');
    }

    async startSystem(system) {
        logMessage(`Starting ${system} system...`, 'info');
        
        try {
            if (system === 'redux') {
                // Start Redux bootloader
                if (window.ReduxBootloader) {
                    await window.ReduxBootloader.start();
                    logMessage('Redux system started successfully', 'info');
                } else {
                    throw new Error('Redux bootloader not available');
                }
            } else {
                // StateKit is already running, just log it
                logMessage('StateKit system is already running', 'info');
                
                // Hide the default splash screen if it exists
                const defaultSplash = document.getElementById('devpages-splash');
                if (defaultSplash) {
                    defaultSplash.style.display = 'none';
                }
                
                // Emit event to indicate system is ready
                window.dispatchEvent(new CustomEvent('statekit-bootloader-ready'));
            }
            
            // Emit global ready event
            window.dispatchEvent(new CustomEvent('bootloader-system-ready', {
                detail: { system }
            }));
            
        } catch (error) {
            logMessage(`Failed to start ${system} system: ${error.message}`, 'error');
            
            // Fallback to StateKit if Redux fails
            if (system === 'redux') {
                logMessage('Falling back to StateKit...', 'warn');
                await this.startSystem('statekit');
            }
        }
    }

    // No saved preferences in this version
}

// Global utility functions
window.DevPagesBootloader = {
    showSelector: () => {
        const selector = new BootloaderSelector();
        selector.showSplashScreen();
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const selector = new BootloaderSelector();
        selector.initialize();
    });
} else {
    const selector = new BootloaderSelector();
    selector.initialize();
}

logMessage('Bootloader selector module loaded', 'info'); 