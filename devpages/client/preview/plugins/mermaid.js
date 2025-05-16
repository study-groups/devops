/**
 * Mermaid Diagram Plugin
 * 
 * Adds support for rendering Mermaid diagrams in markdown
 */

// Helper for logging within this module
function logMermaid(message, level = 'debug') {
    const prefix = '[MERMAID PLUGIN]';
    const type = 'MERMAID_PLUGIN'; // Keep specific type
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

const MERMAID_CSS_ID = 'mermaid-plugin-styles'; // An ID for the link tag

// --- Helper to load CSS ---
function ensureMermaidCSSLoaded() {
    if (document.getElementById(MERMAID_CSS_ID)) {
        logMermaid('Mermaid CSS already loaded.', 'debug');
        return;
    }

    const link = document.createElement('link');
    link.id = MERMAID_CSS_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    // Assuming mermaid.css is in the same directory as mermaid.js
    // and paths are resolved relative to the HTML page or a base URL.
    // If your server setup serves client/preview/plugins/ as /client/preview/plugins/,
    // then './mermaid.css' might not work as expected depending on the page URL.
    // A more robust path might be an absolute one from the web server's root:
    link.href = '/client/preview/plugins/mermaid.css'; 
    // Or, if you know the base path for your scripts:
    // link.href = (window.yourAppBasePath || '') + '/client/preview/plugins/mermaid.css';

    document.head.appendChild(link);
    logMermaid(`Injected CSS: ${link.href}`, 'info');
}

// --- REMOVED OLD HELPER FUNCTIONS ---
// Removed global createMermaidZoomControls (was lines 43-50)
// Removed global setupInteractiveSVG (was lines 53-250)

export class MermaidPlugin {
    constructor(options = {}) {
        console.log('[MERMAID PLUGIN DIAG] MermaidPlugin constructor called with options:', options); // DIAGNOSTIC LOG
        this.options = {
            theme: 'default',
            securityLevel: 'loose',
            startOnLoad: false,
            ...options
        };
        this.activeListeners = []; // To keep track of document/window level listeners
        logMermaid('MermaidPlugin instance created.');
    }

    async init() {
        if (mermaidInitialized) {
            logMermaid('Mermaid already initialized globally.');
            ensureMermaidCSSLoaded();
            return true;
        }
        logMermaid('Initializing Mermaid library and plugin CSS...');
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
            logMermaid('Mermaid library initialized successfully.');
            
            // Set up global pan handlers on init
            this._setupGlobalPanHandlers();
            
            return true;
        } catch (error) {
            logMermaid(`Initialization failed: ${error.message}`, 'error');
            console.error('[MERMAID INIT ERROR]', error);
            return false;
        }
    }
    
    // Add a method to set up the global document handlers for panning
    _setupGlobalPanHandlers() {
        // Global tracking variables for panning
        this._activePanSvg = null;
        
        // Pan move handler
        const mouseMoveHandler = (event) => {
            if (!this._activePanSvg) return;
            
            const dx = event.clientX - this._lastX;
            const dy = event.clientY - this._lastY;
            
            this._currentPanX += dx;
            this._currentPanY += dy;
            this._lastX = event.clientX;
            this._lastY = event.clientY;
            
            this._activePanSvg.style.transform = 
                `translate(${this._currentPanX}px, ${this._currentPanY}px) scale(${this._currentScale})`;
        };
        
        // Pan end handler
        const mouseUpHandler = () => {
            if (this._activePanSvg) {
                this._activePanSvg.style.cursor = 'grab';
                this._activePanSvg = null;
                logMermaid('Pan ended');
            }
        };
        
        // Add the event listeners to document
        document.addEventListener('mousemove', mouseMoveHandler, { capture: true });
        document.addEventListener('mouseup', mouseUpHandler, { capture: true });
        
        // Keep track of these listeners for cleanup
        this.activeListeners.push(
            { target: document, type: 'mousemove', listener: mouseMoveHandler },
            { target: document, type: 'mouseup', listener: mouseUpHandler }
        );
        
        logMermaid('Global pan handlers set up');
    }

    async loadMermaidScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'; // Use specific version if needed
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
        if (!mermaidInitialized) {
            logMermaid('Cannot process, Mermaid not initialized.', 'warning');
            return;
        }
        logMermaid('Processing Mermaid diagrams...');
        
        const mermaidDivsToProcess = previewElement.querySelectorAll('.mermaid:not([data-mermaid-processed="true"])');
        
        if (mermaidDivsToProcess.length > 0) {
            logMermaid(`Found ${mermaidDivsToProcess.length} new diagrams to process.`);
            try {
                await window.mermaid.run({ nodes: mermaidDivsToProcess });
                logMermaid('Mermaid.run() completed.');
            } catch (error) {
                logMermaid(`Error during mermaid.run(): ${error.message}`, 'error');
            }

            mermaidDivsToProcess.forEach(mermaidContainer => {
                const svgElement = mermaidContainer.querySelector('svg');
                if (!svgElement) {
                    if (!mermaidContainer.querySelector('.mermaid-error')) {
                        logMermaid('No SVG found in a .mermaid element after run, skipping controls.', 'warn');
                    }
                    mermaidContainer.setAttribute('data-mermaid-processed', 'true'); // Mark as attempted
                    return; 
                }
                
                // Add controls and interactivity
                this.createZoomControls(mermaidContainer, svgElement);
                mermaidContainer.setAttribute('data-mermaid-processed', 'true'); // Mark as fully processed
            });
        }
    }

    createZoomControls(mermaidContainer, svgElement) {
        logMermaid('Creating zoom controls and interactivity...'); 
        
        // Ensure container is styled for positioning and overflow
        mermaidContainer.style.position = 'relative';
        mermaidContainer.style.overflow = 'hidden';
        
        // Ensure SVG is styled for transformation
        svgElement.style.display = 'block'; 
        svgElement.style.transformOrigin = 'center center';
        svgElement.style.cursor = 'grab';

        // Remove any pre-existing controls from previous runs (if any)
        const oldControls = mermaidContainer.querySelector('.mermaid-controls-container');
        if (oldControls) {
            oldControls.remove();
        }

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'mermaid-controls-container'; 

        const hamburgerButton = document.createElement('button');
        hamburgerButton.innerHTML = '☰'; 
        hamburgerButton.title = 'Menu';
        hamburgerButton.className = 'mermaid-hamburger-button';

        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'mermaid-dropdown-menu';
        dropdownMenu.style.display = 'none'; 

        const resetButtonInMenu = document.createElement('button');
        resetButtonInMenu.textContent = 'Reset Zoom';
        resetButtonInMenu.className = 'mermaid-dropdown-item';

        dropdownMenu.appendChild(resetButtonInMenu);
        controlsContainer.appendChild(hamburgerButton);
        controlsContainer.appendChild(dropdownMenu);
        
        if (mermaidContainer && typeof mermaidContainer.appendChild === 'function') {
            mermaidContainer.appendChild(controlsContainer);
        } else {
            logMermaid('Error: mermaidContainer is invalid. Cannot append controls.', 'error');
            return; 
        }

        // --- Pan and Zoom State ---
        // Initialize transform state for this SVG
        const svgState = {
            scale: 1,
            panX: 0,
            panY: 0
        };
        
        // Store the state on the SVG for global handlers
        svgElement._mermaidState = svgState;
        
        // Apply transform function
        const applyTransform = () => {
            svgElement.style.transform = `translate(${svgState.panX}px, ${svgState.panY}px) scale(${svgState.scale})`;
        };
        
        // --- Event Listeners for Zoom/Pan ---
        const wheelListener = (event) => {
            // Only zoom with Ctrl/Meta key
            if (!event.ctrlKey && !event.metaKey) return;
            
            event.preventDefault();
            event.stopPropagation();
            
            const rect = mermaidContainer.getBoundingClientRect();
            const mouseXInContainer = event.clientX - rect.left;
            const mouseYInContainer = event.clientY - rect.top;
            
            const oldScale = svgState.scale;
            const dir = event.deltaY < 0 ? 1 : -1;
            svgState.scale += dir * 0.1 * svgState.scale;
            svgState.scale = Math.max(0.2, Math.min(svgState.scale, 5));
            
            // Zoom toward mouse position
            const mouseRelToSVGCenterX = mouseXInContainer - (mermaidContainer.clientWidth / 2) - svgState.panX;
            const mouseRelToSVGCenterY = mouseYInContainer - (mermaidContainer.clientHeight / 2) - svgState.panY;
            
            svgState.panX -= mouseRelToSVGCenterX * (svgState.scale / oldScale - 1);
            svgState.panY -= mouseRelToSVGCenterY * (svgState.scale / oldScale - 1);
            
            applyTransform();
        };
        
        const mouseDownListener = (event) => {
            if (event.button !== 0) return; // Only left click
            
            event.preventDefault();
            event.stopPropagation();
            
            // Set global pan tracking state
            this._activePanSvg = svgElement;
            this._lastX = event.clientX;
            this._lastY = event.clientY;
            this._currentPanX = svgState.panX;
            this._currentPanY = svgState.panY;
            this._currentScale = svgState.scale;
            
            svgElement.style.cursor = 'grabbing';
        };
        
        // Attach event listeners
        mermaidContainer.addEventListener('wheel', wheelListener, { passive: false, capture: true });
        svgElement.addEventListener('mousedown', mouseDownListener, { capture: true });
        
        // Store references for potential cleanup
        mermaidContainer._mermaidWheelListener = wheelListener;
        svgElement._mermaidMouseDownListener = mouseDownListener;
        
        logMermaid('Zoom and pan handlers attached');
    }

    destroy() {
        // Clean up global event listeners
        logMermaid('MermaidPlugin: Destroying listeners...');
        this.activeListeners.forEach(al => {
            al.target.removeEventListener(al.type, al.listener);
        });
        this.activeListeners = [];
        
        // Clean up individual element listeners
        document.querySelectorAll('.mermaid').forEach(mermaidContainer => {
            if (mermaidContainer._mermaidWheelListener) {
                mermaidContainer.removeEventListener('wheel', mermaidContainer._mermaidWheelListener);
                delete mermaidContainer._mermaidWheelListener;
            }
            
            const svg = mermaidContainer.querySelector('svg');
            if (svg && svg._mermaidMouseDownListener) {
                svg.removeEventListener('mousedown', svg._mermaidMouseDownListener);
                delete svg._mermaidMouseDownListener;
            }
            
            const controls = mermaidContainer.querySelector('.mermaid-controls-container');
            if (controls) {
                controls.remove();
            }
        });
        
        logMermaid('MermaidPlugin cleanup finished.');
    }
}

// Clear all previous direct fix code, then add this simple, direct fix:
(function() {
  console.log('[MERMAID SUPER SIMPLE FIX] Adding one-time handler setup');
  
  // Add mousemove and mouseup handlers to document body
  if (!document.body.hasAttribute('data-mermaid-fix')) {
    document.body.setAttribute('onmousemove', `
      const activeSvg = document.querySelector('.mermaid svg[data-is-panning="true"]');
      if (activeSvg) {
        const dx = event.clientX - activeSvg.lastMouseX;
        const dy = event.clientY - activeSvg.lastMouseY;
        activeSvg.panX = (activeSvg.panX || 0) + dx;
        activeSvg.panY = (activeSvg.panY || 0) + dy;
        activeSvg.lastMouseX = event.clientX;
        activeSvg.lastMouseY = event.clientY;
        activeSvg.style.transform = 'translate('+activeSvg.panX+'px, '+activeSvg.panY+'px) scale('+(activeSvg.scale || 1)+')';
        console.log('[MERMAID] Panning', dx, dy);
      }
    `);
    
    document.body.setAttribute('onmouseup', `
      const panning = document.querySelector('.mermaid svg[data-is-panning="true"]');
      if (panning) {
        panning.style.cursor = 'grab';
        panning.removeAttribute('data-is-panning');
        console.log('[MERMAID] Pan ended');
      }
    `);
    
    document.body.setAttribute('data-mermaid-fix', 'true');
    console.log('[MERMAID SUPER SIMPLE FIX] Added body handlers');
  }
  
  // Find all mermaid SVGs every 1 second and set them up with event handlers 
  // This is simple and will keep looking for new diagrams
  setInterval(() => {
    document.querySelectorAll('.mermaid svg').forEach(svg => {
      if (!svg.hasAttribute('data-zoom-fix')) {
        // Style setup
        svg.style.transformOrigin = 'center center';
        svg.style.cursor = 'grab';
        
        // Initialize state
        svg.scale = 1;
        svg.panX = 0;
        svg.panY = 0;
        
        // Add wheel handler for zooming
        svg.setAttribute('onwheel', `
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const rect = this.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const oldScale = this.scale || 1;
            const dir = event.deltaY < 0 ? 1 : -1;
            this.scale = oldScale + (dir * 0.1 * oldScale);
            this.scale = Math.max(0.2, Math.min(this.scale, 5));
            const mouseRelX = mouseX - (rect.width / 2) - (this.panX || 0);
            const mouseRelY = mouseY - (rect.height / 2) - (this.panY || 0);
            this.panX = (this.panX || 0) - mouseRelX * (this.scale / oldScale - 1);
            this.panY = (this.panY || 0) - mouseRelY * (this.scale / oldScale - 1);
            this.style.transform = 'translate('+this.panX+'px, '+this.panY+'px) scale('+this.scale+')';
            return false;
          }
        `);
        
        // Add mousedown handler for panning
        svg.setAttribute('onmousedown', `
          if (event.button === 0) {
            // Clear any other svg that might be in panning state
            document.querySelectorAll('.mermaid svg[data-is-panning="true"]').forEach(s => 
              s.removeAttribute('data-is-panning'));
            
            // Set this svg as the active panning element
            this.setAttribute('data-is-panning', 'true');
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.style.cursor = 'grabbing';
            this.panX = this.panX || 0;
            this.panY = this.panY || 0;
            event.preventDefault();
            console.log('[MERMAID] Pan started');
          }
        `);
        
        svg.setAttribute('data-zoom-fix', 'true');
        console.log('[MERMAID SUPER SIMPLE FIX] Added handlers to:', svg.id);
      }
    });
  }, 1000);
})(); 