/**
 * Enhanced Mermaid Plugin
 * 
 * Modular structure with features like hamburger menu, fullscreen support, etc.
 */

import { MermaidRenderer } from './renderer.js';
import { MermaidControls } from './controls.js';
import { MermaidFullscreen } from './fullscreen.js';
import { appStore } from '/client/appState.js';
import { getIsPluginEnabled } from '/client/store/selectors.js';

// Helper for logging within this module
function logMermaid(message, level = 'debug') {
    const prefix = '[MERMAID PLUGIN]';
    const type = 'MERMAID_PLUGIN';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

// Global flag to ensure Mermaid library is loaded only once
let mermaidScriptLoaded = false;
let mermaidInitialized = false;

// CSS is now handled by theme files (light.css/dark.css)
// No need for inline CSS injection

export class MermaidPlugin {
    constructor(options = {}) {
        this.options = {
            theme: 'default',
            securityLevel: 'loose',
            startOnLoad: false,
            ...options
        };
        this.activeListeners = [];
        this.renderer = new MermaidRenderer(this.options);
        this.controls = new MermaidControls();
        this.fullscreen = new MermaidFullscreen();
        
        console.log('[MERMAID DEBUG] Enhanced MermaidPlugin instance created');
        logMermaid('Enhanced MermaidPlugin instance created.');
    }

    async init() {
        console.log('[MERMAID DEBUG] Init called');
        if (mermaidInitialized) {
            console.log('[MERMAID DEBUG] Already initialized');
            logMermaid('Mermaid already initialized globally.');
            return true;
        }
        
        console.log('[MERMAID DEBUG] Starting initialization');
        logMermaid('Initializing Enhanced Mermaid library...');
        
        try {
            
            // Check if Mermaid is already available from HTML script tag
            if (typeof window.mermaid !== 'undefined') {
                console.log('[MERMAID DEBUG] Mermaid already available from HTML');
                logMermaid('Mermaid script already loaded from HTML.');
                mermaidScriptLoaded = true;
            } else if (!mermaidScriptLoaded) {
                // Only try to load dynamically if not already loaded
                console.log('[MERMAID DEBUG] Loading Mermaid script dynamically');
                logMermaid('Loading Mermaid script from CDN...');
                await this.loadMermaidScript();
                mermaidScriptLoaded = true;
            }
            
            if (typeof window.mermaid === 'undefined') {
                throw new Error('Mermaid library failed to load or define window.mermaid.');
            }
            
            console.log('[MERMAID DEBUG] Mermaid object:', window.mermaid);
            console.log('[MERMAID DEBUG] Mermaid keys:', Object.keys(window.mermaid || {}));
            console.log('[MERMAID DEBUG] Mermaid version:', window.mermaid.version);
            console.log('[MERMAID DEBUG] Mermaid initialize function:', typeof window.mermaid.initialize);
            console.log('[MERMAID DEBUG] Mermaid run function:', typeof window.mermaid.run);
            logMermaid(`Mermaid library loaded successfully. Version: ${window.mermaid.version || 'unknown'}`);
            
            // Initialize Mermaid with options
            console.log('[MERMAID DEBUG] Calling mermaid.initialize with options:', this.options);
            window.mermaid.initialize(this.options);
            mermaidInitialized = true;
            
            // Initialize components
            await this.renderer.init();
            await this.controls.init();
            await this.fullscreen.init();
            
            logMermaid('Enhanced Mermaid library initialized successfully.');
            
            return true;
        } catch (error) {
            logMermaid(`Initialization failed: ${error.message}`, 'error');
            console.error('[MERMAID INIT ERROR]', error);
            
            // Store the error for debugging
            window.mermaidLastError = error.message;
            
            return false;
        }
    }

    async loadMermaidScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@latest/dist/mermaid.min.js';
            script.async = true;
            script.onload = () => {
                logMermaid('Mermaid script loaded successfully.');
                resolve();
            };
            script.onerror = (err) => {
                logMermaid('Failed to load Mermaid script.', 'error');
                reject(err);
            };
            document.head.appendChild(script);
        });
    }

    async process(previewElement) {
        // CHECK ENABLED STATE FIRST
        const state = appStore.getState();
        if (!getIsPluginEnabled(state, 'mermaid')) {
            console.log('[MERMAID DEBUG] Plugin disabled, skipping processing');
            this.cleanup(previewElement); // Remove existing diagrams
            return;
        }
        
        if (!mermaidInitialized) {
            logMermaid('Cannot process, Mermaid not initialized.', 'warning');
            return;
        }
        
        console.log('[MERMAID DEBUG] Process called, initialized:', mermaidInitialized);
        console.log('[MERMAID DEBUG] Preview element:', previewElement);
        console.log('[MERMAID DEBUG] window.mermaid available:', typeof window.mermaid);
        console.log('[MERMAID DEBUG] window.mermaid.run available:', typeof window.mermaid?.run);
        
        console.log('[MERMAID DEBUG] Processing Mermaid diagrams...');
        logMermaid('Processing Mermaid diagrams...');
        
        const mermaidDivsToProcess = previewElement.querySelectorAll('.mermaid:not([data-mermaid-processed="true"])');
        console.log('[MERMAID DEBUG] Found mermaid divs to process:', mermaidDivsToProcess.length);
        
        // Log the content of each mermaid div
        mermaidDivsToProcess.forEach((div, index) => {
            console.log(`[MERMAID DEBUG] Div ${index + 1} content:`, div.textContent.trim().substring(0, 100));
            console.log(`[MERMAID DEBUG] Div ${index + 1} HTML:`, div.innerHTML.substring(0, 200));
        });
        
        if (mermaidDivsToProcess.length > 0) {
            logMermaid(`Found ${mermaidDivsToProcess.length} new diagrams to process.`);
            console.log('[MERMAID DEBUG] About to call mermaid.run()');
            
            try {
                console.log('[MERMAID DEBUG] Calling window.mermaid.run with nodes:', mermaidDivsToProcess);
                await window.mermaid.run({ nodes: mermaidDivsToProcess });
                console.log('[MERMAID DEBUG] mermaid.run() completed successfully');
                logMermaid('Mermaid.run() completed.');
            } catch (error) {
                console.error('[MERMAID DEBUG] Error during mermaid.run():', error);
                logMermaid(`Error during mermaid.run(): ${error.message}`, 'error');
            }

            console.log('[MERMAID DEBUG] Setting up controls for each diagram...');
            mermaidDivsToProcess.forEach((mermaidContainer, index) => {
                console.log(`[MERMAID DEBUG] Processing diagram ${index + 1}/${mermaidDivsToProcess.length}`);
                const svgElement = mermaidContainer.querySelector('svg');
                console.log(`[MERMAID DEBUG] Found SVG for diagram ${index + 1}:`, !!svgElement);
                
                if (!svgElement) {
                    if (!mermaidContainer.querySelector('.mermaid-error')) {
                        logMermaid('No SVG found in a .mermaid element after run, skipping controls.', 'warn');
                    }
                    mermaidContainer.setAttribute('data-mermaid-processed', 'true');
                    return; 
                }
                
                console.log(`[MERMAID DEBUG] Setting up controls for diagram ${index + 1}`);
                // Setup enhanced controls with fullscreen support
                this.setupDiagramControls(mermaidContainer, svgElement);
                mermaidContainer.setAttribute('data-mermaid-processed', 'true');
                console.log(`[MERMAID DEBUG] Completed setup for diagram ${index + 1}`);
            });
            console.log('[MERMAID DEBUG] Finished setting up all diagrams');
        } else {
            console.log('[MERMAID DEBUG] No new mermaid diagrams found to process');
        }
    }

    setupDiagramControls(mermaidContainer, svgElement) {
        console.log('[MERMAID DEBUG] Setting up diagram controls for:', mermaidContainer, svgElement);
        
        try {
            // Store controls instance reference on container for fullscreen access
            mermaidContainer._mermaidControlsInstance = this.controls;
            
            // Setup controls using the modular components
            console.log('[MERMAID DEBUG] About to setup zoom controls...');
            this.controls.setupZoomControls(mermaidContainer, svgElement);
            console.log('[MERMAID DEBUG] Zoom controls set up successfully');
            
            console.log('[MERMAID DEBUG] About to setup hamburger menu...');
            this.controls.setupHamburgerMenu(mermaidContainer, svgElement, {
                onFullscreen: () => this.fullscreen.toggleFullscreen(mermaidContainer, svgElement)
            });
            console.log('[MERMAID DEBUG] Hamburger menu set up successfully');
        } catch (error) {
            console.error('[MERMAID DEBUG] Error setting up diagram controls:', error);
        }
    }

    cleanup(previewElement) {
        // Remove processed mermaid elements
        const processedElements = previewElement.querySelectorAll('.mermaid[data-mermaid-processed="true"]');
        processedElements.forEach(element => {
            // Restore original text content
            const textContent = element.textContent;
            element.innerHTML = textContent;
            element.removeAttribute('data-mermaid-processed');
        });
    }

    destroy() {
        logMermaid('Enhanced MermaidPlugin: Destroying...');
        
        if (this.controls) {
            this.controls.destroy();
        }
        if (this.fullscreen) {
            this.fullscreen.destroy();
        }
        if (this.renderer) {
            this.renderer.destroy();
        }
        
        this.activeListeners.forEach(al => {
            al.target.removeEventListener(al.type, al.listener);
        });
        this.activeListeners = [];
        
        logMermaid('Enhanced MermaidPlugin cleanup finished.');
    }


} 