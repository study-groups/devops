/**
 * Graphviz DOT Diagram Plugin
 * 
 * Adds support for rendering Graphviz DOT language diagrams in markdown
 */

// Helper for logging within this module
function logMessage(message, type = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, type, 'GRAPHVIZ_PLUGIN');
    } else {
        console.log(`[GRAPHVIZ_PLUGIN] ${message}`);
    }
}

// Global flag to ensure Viz.js library is loaded only once
let vizScriptLoaded = false;
let vizInitialized = false;

export class GraphvizPlugin {
    constructor(options = {}) {
        this.options = {
            engine: 'dot', // Default engine
            format: 'svg', // Output format
            ...options
        };
        logMessage('GraphvizPlugin instance created.');
    }

    async init() {
        if (vizInitialized) {
            logMessage('Viz.js already initialized globally.');
            return true;
        }
        logMessage('Initializing Viz.js library...');
        try {
            // Load Viz.js script if not already loaded
            if (!vizScriptLoaded && typeof window.Viz === 'undefined') {
                logMessage('Loading Viz.js script from CDN...');
                await this.loadVizScript();
                vizScriptLoaded = true;
            }
            
            if (typeof window.Viz === 'undefined') {
                throw new Error('Viz.js library failed to load or define window.Viz.');
            }

            vizInitialized = true;
            logMessage('Viz.js library initialized successfully.');
            return true;
        } catch (error) {
            logMessage(`Initialization failed: ${error.message}`, 'error');
            console.error('[GRAPHVIZ INIT ERROR]', error);
            return false;
        }
    }

    async loadVizScript() {
        return new Promise((resolve, reject) => {
            // First, load viz.js
            const vizScript = document.createElement('script');
            vizScript.src = '/client/vendor/scripts/viz-render.umd.js';
            vizScript.async = true;
            
            vizScript.onload = () => {
                logMessage('Viz.js script loaded successfully.');
                
                // Then load the rendering worker
                const workerScript = document.createElement('script');
                workerScript.src = '/client/vendor/scripts/viz-render.umd.js'; // This seems odd, but follows the original logic
                workerScript.async = true;
                
                workerScript.onload = () => {
                    logMessage('Viz.js worker script loaded successfully.');
                    resolve();
                };
                
                workerScript.onerror = (err) => {
                    logMessage('Failed to load Viz.js worker script.', 'error');
                    reject(err);
                };
                
                document.head.appendChild(workerScript);
            };
            
            vizScript.onerror = (err) => {
                logMessage('Failed to load Viz.js script.', 'error');
                reject(err);
            };
            
            document.head.appendChild(vizScript);
        });
    }

    process(previewElement) {
        if (!vizInitialized) {
            logMessage('Cannot process, Viz.js not initialized.', 'warning');
            this.init().then(() => {
                this.renderDiagrams(previewElement);
            }).catch(error => {
                logMessage(`Failed to initialize on-demand: ${error.message}`, 'error');
            });
            return;
        }
        
        this.renderDiagrams(previewElement);
    }
    
    renderDiagrams(previewElement) {
        logMessage('Processing Graphviz diagrams...');
        const elements = previewElement.querySelectorAll('.graphviz:not([data-processed="true"])');
        
        if (elements.length > 0) {
            logMessage(`Found ${elements.length} diagrams to render.`);
            
            // Initialize viz renderer once
            const viz = new window.Viz();
            
            // Process each diagram
            elements.forEach(async (element) => {
                try {
                    const dotCode = element.textContent.trim();
                    
                    // Set as processing to prevent duplicate renders
                    element.setAttribute('data-processed', 'processing');
                    element.innerHTML = '<div class="graphviz-loading">Rendering diagram...</div>';
                    
                    // Render the graph
                    const result = await viz.renderString(dotCode, {
                        engine: this.options.engine,
                        format: this.options.format
                    });
                    
                    // Replace content with rendered diagram
                    element.innerHTML = result;
                    element.setAttribute('data-processed', 'true');
                    
                    // Apply some CSS for better display
                    const svg = element.querySelector('svg');
                    if (svg) {
                        svg.style.maxWidth = '100%';
                        svg.style.height = 'auto';
                    }
                    
                    logMessage('Diagram rendered successfully.');
                } catch (error) {
                    logMessage(`Error rendering diagram: ${error.message}`, 'error');
                    console.error('[GRAPHVIZ RENDER ERROR]', error);
                    
                    // Display error message
                    element.innerHTML = `
                        <div class="graphviz-error">
                            <div class="graphviz-error-header">Graphviz Error</div>
                            <pre class="graphviz-error-message">${error.message}</pre>
                        </div>
                    `;
                    element.setAttribute('data-processed', 'error');
                }
            });
        } else {
            logMessage('No new diagrams found to process.');
        }
    }
} 