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
        logMermaid('Creating HAMBURGER zoom controls and interactivity (TOP-RIGHT)...'); 
        
        // Ensure container is styled for positioning and overflow
        mermaidContainer.style.position = 'relative';
        mermaidContainer.style.overflow = 'hidden';
        // Ensure SVG is styled for transformation
        svgElement.style.display = 'block'; // Important for layout
        svgElement.style.transformOrigin = 'center center'; // Zoom from center

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
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        const applyTransform = () => {
            if (svgElement && svgElement.style) {
                svgElement.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
            }
        };
        applyTransform(); // Apply initial transform (identity)

        // --- Event Listeners for Zoom/Pan ---
        const wheelListener = (event) => {
            // REQUIRE Ctrl key (or Meta key for Mac) for zooming
            if (!event.ctrlKey && !event.metaKey) {
                return; // Do nothing if Ctrl/Meta is not pressed
            }
            event.preventDefault(); // Prevent page scroll only if we are zooming

            const zoomIntensity = 0.1; // Smaller steps
            const dir = event.deltaY < 0 ? 1 : -1;
            
            const rect = mermaidContainer.getBoundingClientRect(); // Use container for relative mouse pos
            const mouseXInContainer = event.clientX - rect.left;
            const mouseYInContainer = event.clientY - rect.top;

            const oldScale = scale;
            scale += dir * zoomIntensity * scale;
            scale = Math.max(0.2, Math.min(scale, 5)); // Clamp scale

            // For zooming towards the mouse pointer with 'center center' origin:
            const mouseRelToSVGCenterX = mouseXInContainer - (mermaidContainer.clientWidth / 2) - panX;
            const mouseRelToSVGCenterY = mouseYInContainer - (mermaidContainer.clientHeight / 2) - panY;

            panX -= mouseRelToSVGCenterX * (scale / oldScale - 1);
            panY -= mouseRelToSVGCenterY * (scale / oldScale - 1);

            applyTransform();
        };
        mermaidContainer.addEventListener('wheel', wheelListener, { passive: false }); // passive: false because we call preventDefault

        const mouseDownListener = (event) => {
            if (event.button !== 0) return; // Only left click
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            if (svgElement && svgElement.style) svgElement.style.cursor = 'grabbing';
        };
        svgElement.addEventListener('mousedown', mouseDownListener);
        
        const mouseUpListener = (event) => {
            if (isPanning) {
                isPanning = false;
                if (svgElement && svgElement.style) svgElement.style.cursor = 'grab';
            }
        };
        document.addEventListener('mouseup', mouseUpListener);
        this.activeListeners.push({ target: document, type: 'mouseup', listener: mouseUpListener });


        const mouseMoveListener = (event) => {
            if (isPanning) {
                const dx = event.clientX - lastMouseX;
                const dy = event.clientY - lastMouseY;
                panX += dx;
                panY += dy;
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
                applyTransform();
            }
        };
        document.addEventListener('mousemove', mouseMoveListener);
        this.activeListeners.push({ target: document, type: 'mousemove', listener: mouseMoveListener });

        // --- Dropdown Logic ---
        hamburgerButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            const isHidden = dropdownMenu.style.display === 'none';
            dropdownMenu.style.display = isHidden ? 'block' : 'none';
        });

        resetButtonInMenu.addEventListener('click', () => {
            scale = 1;
            panX = 0;
            panY = 0;
            applyTransform();
            dropdownMenu.style.display = 'none';
            logMermaid('Zoom reset via dropdown.');
        });

        const clickOutsideDropdownListener = (event) => {
            if (controlsContainer && !controlsContainer.contains(event.target) && dropdownMenu.style.display === 'block') {
                dropdownMenu.style.display = 'none';
            }
        };
        document.addEventListener('click', clickOutsideDropdownListener);
        this.activeListeners.push({ target: document, type: 'click', listener: clickOutsideDropdownListener });


        // --- Positioning for TOP-RIGHT hamburger ---
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.top = '5px';
        controlsContainer.style.right = '5px';
        controlsContainer.style.zIndex = '1000'; 

        mermaidContainer._mermaidWheelListener = wheelListener;
        svgElement._mermaidMouseDownListener = mouseDownListener;

        logMermaid('Hamburger zoom controls and interactivity setup complete. Zoom requires Ctrl/Meta key.');
    }

    destroy() {
        logMermaid('MermaidPlugin: Destroying listeners...');
        this.activeListeners.forEach(al => {
            al.target.removeEventListener(al.type, al.listener);
        });
        this.activeListeners = [];
        
        // If specific mermaid containers were tracked, remove their listeners too
        // This example assumes global listeners are the main ones to clean.
        // For individual element listeners added in createZoomControls, they would be cleaned
        // if the element itself is removed from DOM or if we tracked them.
        // The querySelectorAll approach is for a global "cleanup all mermaid interactions"
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

        logMermaid('MermaidPlugin cleanup finished. (Note: specific instance cleanup might need more targeted listener removal if elements persist).');
    }
} 