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

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('MermaidPlugin');

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
        
        log.info('MERMAID', 'PLUGIN_CREATED', 'Enhanced MermaidPlugin instance created');
    }

    async init() {
        // Defer script loading and initialization until a diagram is actually found.
        log.info('MERMAID', 'PLUGIN_INITIALIZED', 'Mermaid plugin initialized. Ready to process diagrams on demand.');
        
        try {
            await this.fullscreen.init();
            log.info('MERMAID', 'FULLSCREEN_INITIALIZED', 'Mermaid fullscreen handler initialized.');
            return true;
        } catch (error) {
            log.error('MERMAID', 'FULLSCREEN_INIT_FAILED', `Fullscreen handler initialization failed: ${error.message}`, error);
            return false;
        }
    }

    async loadMermaidScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            //script.src = 'https://cdn.jsdelivr.net/npm/mermaid@latest/dist/mermaid.min.js';
            script.src = '/client/vendor/scripts/mermaid.min.js';

            script.async = true;
            script.onload = () => {
                log.info('MERMAID', 'SCRIPT_LOADED', 'Mermaid script loaded successfully.');
                resolve();
            };
            script.onerror = (err) => {
                log.error('MERMAID', 'SCRIPT_LOAD_FAILED', 'Failed to load Mermaid script.', err);
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
        
        if (!this.renderer || !this.renderer.shadowRoot) {
            log.warn('MERMAID', 'RENDERER_UNAVAILABLE', 'Renderer or shadowRoot not available.');
            return;
        }
        
        const mermaidDivsToProcess = previewElement.querySelectorAll('.mermaid:not([data-mermaid-processed="true"])');
        
        // If no diagrams are found, do nothing.
        if (mermaidDivsToProcess.length === 0) {
            return;
        }
        
        // If diagrams are found, ensure the script is loaded and initialized.
        if (!mermaidInitialized) {
            log.info('MERMAID', 'LIBRARY_INIT_REQUIRED', `Found ${mermaidDivsToProcess.length} Mermaid diagrams, ensuring library is loaded.`);
            await this.initializeMermaid();
        }

        if (!mermaidInitialized) {
            log.warn('MERMAID', 'LIBRARY_INIT_FAILED', 'Mermaid initialization failed. Aborting processing.');
            return;
        }

        log.info('MERMAID', 'PROCESSING_DIAGRAMS', `Processing ${mermaidDivsToProcess.length} Mermaid diagrams...`);
        
        if (mermaidDivsToProcess.length > 0) {
            log.info('MERMAID', 'NEW_DIAGRAMS_FOUND', `Found ${mermaidDivsToProcess.length} new diagrams to process.`);
            
            try {
                await window.mermaid.run({ nodes: mermaidDivsToProcess });
                log.info('MERMAID', 'MERMAID_RUN_COMPLETED', 'Mermaid.run() completed.');
            } catch (error) {
                log.error('MERMAID', 'MERMAID_RUN_ERROR', `Error during mermaid.run(): ${error.message}`, error);
            }

            mermaidDivsToProcess.forEach((mermaidContainer, index) => {
                const svgElement = mermaidContainer.querySelector('svg');
                
                if (!svgElement) {
                    if (!mermaidContainer.querySelector('.mermaid-error')) {
                        log.warn('MERMAID', 'NO_SVG_FOUND', 'No SVG found in a .mermaid element after run, skipping controls.');
                    }
                    mermaidContainer.setAttribute('data-mermaid-processed', 'true');
                    return; 
                }
                
                // Setup enhanced controls with fullscreen support
                this.setupDiagramControls(mermaidContainer, svgElement);
                mermaidContainer.setAttribute('data-mermaid-processed', 'true');
            });
        }
    }

    /**
     * Centralized initialization function that loads the script and runs Mermaid setup.
     * This is only called when a diagram is first encountered.
     */
    async initializeMermaid() {
        if (mermaidInitialized) {
            return true;
        }

        log.info('MERMAID', 'INITIALIZING_LIBRARY', 'Initializing Enhanced Mermaid library...');

        try {
            // Load the script from the CDN
            if (!mermaidScriptLoaded) {
                await this.loadMermaidScript();
                mermaidScriptLoaded = true;
            }

            // Configure and initialize Mermaid
            window.mermaid.initialize({
                startOnLoad: false,
                theme: document.body.classList.contains('dark-mode') ? 'dark' : 'default',
                securityLevel: 'strict',
                logLevel: 5, // 1=debug, 5=fatal
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                }
            });

            mermaidInitialized = true;
            log.info('MERMAID', 'LIBRARY_INITIALIZED', 'Enhanced Mermaid library initialized successfully.');

            return true;
        } catch (error) {
            log.error('MERMAID', 'INITIALIZATION_FAILED', `Initialization failed: ${error.message}`, error);

            // Store the error for debugging
            window.mermaidLastError = error.message;

            return false;
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
        log.info('MERMAID', 'PLUGIN_DESTROYED', 'Enhanced MermaidPlugin cleanup finished.');
        
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
        
        log.info('MERMAID', 'PLUGIN_DESTROYED', 'Enhanced MermaidPlugin cleanup finished.');
    }


} 