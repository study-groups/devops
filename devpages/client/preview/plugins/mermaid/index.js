/**
 * Enhanced Mermaid Plugin
 * 
 * Modular structure with features like hamburger menu, fullscreen support, etc.
 */

import { MermaidRenderer } from './renderer.js';
import { MermaidControls } from './controls.js';
import { MermaidFullscreen } from './fullscreen.js';

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

const MERMAID_CSS_ID = 'mermaid-plugin-styles';

// --- Helper to load CSS ---
function ensureMermaidCSSLoaded() {
    if (document.getElementById(MERMAID_CSS_ID)) {
        logMermaid('Mermaid CSS already loaded.', 'debug');
        return;
    }

    // Inject CSS directly (more reliable than CSS modules)
    injectMermaidCSS();
}

function injectMermaidCSS() {
    const css = `
/* Enhanced Mermaid Plugin Styles */
.mermaid {
    position: relative; 
    overflow: hidden;  
    display: inline-block;
}

.mermaid svg {
    display: block; 
    transform-origin: center center; 
    transition: transform 0.15s ease-out;
    cursor: default;
}

.mermaid-container {
    position: relative;
    overflow: hidden;
}

.mermaid-container svg {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    transition: transform 0.05s ease-out;
}

/* Enhanced Controls Container */
.mermaid-controls-container {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1000;
}

/* Enhanced Hamburger Button */
.mermaid-hamburger-button {
    background-color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(204, 204, 204, 0.8);
    color: #333;
    cursor: pointer;
    border-radius: 6px;
    font-size: 16px;
    font-weight: bold;
    padding: 6px 8px;
    line-height: 1;
    opacity: 0.7;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mermaid-hamburger-button:hover {
    background-color: rgba(255, 255, 255, 1);
    opacity: 1;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
}

.mermaid-hamburger-button:active {
    transform: translateY(0);
}

/* Enhanced Dropdown Menu */
.mermaid-dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    min-width: 140px;
    padding: 6px 0;
    margin-top: 4px;
    animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
}

.mermaid-dropdown-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    text-align: left;
    background-color: transparent;
    border: none;
    color: #333;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
    transition: background-color 0.2s ease;
    border-radius: 0;
}

.mermaid-dropdown-item:hover {
    background-color: #f8f9fa;
    color: #007bff;
}

.mermaid-dropdown-item:active {
    background-color: #e9ecef;
}

.mermaid-dropdown-item:first-child {
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
}

.mermaid-dropdown-item:last-child {
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
}

/* Fullscreen Styles */
.mermaid-fullscreen-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    animation: fadeInOverlay 0.3s ease-out;
}

@keyframes fadeInOverlay {
    from { opacity: 0; }
    to { opacity: 1; }
}

.mermaid-fullscreen-close {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.8);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    transition: all 0.3s ease;
}

.mermaid-fullscreen-close:hover {
    background-color: rgba(255, 255, 255, 1);
    transform: scale(1.1);
}

/* Fullscreen diagram container */
.mermaid-fullscreen-overlay .mermaid {
    position: relative;
    width: 95vw;
    height: 95vh;
    max-width: 95vw;
    max-height: 95vh;
    background-color: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    animation: scaleIn 0.3s ease-out;
}

/* Make SVG scale to fill the fullscreen container while preserving panning */
.mermaid-fullscreen-overlay .mermaid svg {
    min-width: 100%;
    min-height: calc(95vh - 40px);
    width: auto !important;
    height: auto !important;
    display: block;
    margin: 0 auto;
    cursor: grab;
    transform-origin: center center;
}

@keyframes scaleIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

/* Body modifications when fullscreen is active */
body.mermaid-fullscreen-active {
    overflow: hidden;
}

/* Responsive design */
@media (max-width: 768px) {
    .mermaid-fullscreen-overlay .mermaid {
        max-width: 95vw;
        max-height: 95vh;
        padding: 15px;
    }
    
    .mermaid-fullscreen-close {
        top: 15px;
        right: 15px;
        width: 36px;
        height: 36px;
        font-size: 20px;
    }
    
    .mermaid-dropdown-menu {
        min-width: 120px;
    }
    
    .mermaid-dropdown-item {
        padding: 8px 12px;
        font-size: 13px;
    }
}
`;

    const style = document.createElement('style');
    style.id = MERMAID_CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
    logMermaid('Injected enhanced CSS styles', 'info');
}

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
            console.log('[MERMAID DEBUG] Already initialized, loading CSS');
            logMermaid('Mermaid already initialized globally.');
            ensureMermaidCSSLoaded();
            return true;
        }
        
        console.log('[MERMAID DEBUG] Starting initialization');
        logMermaid('Initializing Enhanced Mermaid library and plugin CSS...');
        
        try {
            ensureMermaidCSSLoaded();
            
            if (!mermaidScriptLoaded && typeof window.mermaid === 'undefined') {
                logMermaid('Loading Mermaid script from CDN...');
                await this.loadMermaidScript();
                mermaidScriptLoaded = true;
            }
            
            if (typeof window.mermaid === 'undefined') {
                throw new Error('Mermaid library failed to load or define window.mermaid.');
            }
            
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
            return false;
        }
    }

    async loadMermaidScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
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
        console.log('[MERMAID DEBUG] Process called, initialized:', mermaidInitialized);
        console.log('[MERMAID DEBUG] Preview element:', previewElement);
        
        if (!mermaidInitialized) {
            logMermaid('Cannot process, Mermaid not initialized.', 'warning');
            return;
        }
        
        console.log('[MERMAID DEBUG] Processing Mermaid diagrams...');
        logMermaid('Processing Mermaid diagrams...');
        
        const mermaidDivsToProcess = previewElement.querySelectorAll('.mermaid:not([data-mermaid-processed="true"])');
        console.log('[MERMAID DEBUG] Found mermaid divs to process:', mermaidDivsToProcess.length);
        
        if (mermaidDivsToProcess.length > 0) {
            logMermaid(`Found ${mermaidDivsToProcess.length} new diagrams to process.`);
            console.log('[MERMAID DEBUG] About to call mermaid.run()');
            
            try {
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