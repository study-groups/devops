/**
 * Graphviz DOT Diagram Plugin
 * 
 * Adds support for rendering Graphviz DOT language diagrams in markdown
 */

// Helper for logging within this module
function logGraphviz(message, level = 'text') {
    const prefix = '[GRAPHVIZ PLUGIN]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
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
        logGraphviz('GraphvizPlugin instance created.');
    }

    async init() {
        if (vizInitialized) {
            logGraphviz('Viz.js already initialized globally.');
            return true;
        }
        logGraphviz('Initializing Viz.js library...');
        try {
            // Load Viz.js script if not already loaded
            if (!vizScriptLoaded && typeof window.Viz === 'undefined') {
                logGraphviz('Loading Viz.js script from CDN...');
                await this.loadVizScript();
                vizScriptLoaded = true;
            }
            
            if (typeof window.Viz === 'undefined') {
                throw new Error('Viz.js library failed to load or define window.Viz.');
            }

            vizInitialized = true;
            logGraphviz('Viz.js library initialized successfully.');
            return true;
        } catch (error) {
            logGraphviz(`Initialization failed: ${error.message}`, 'error');
            console.error('[GRAPHVIZ INIT ERROR]', error);
            return false;
        }
    }

    async loadVizScript() {
        return new Promise((resolve, reject) => {
            // First, load viz.js
            const vizScript = document.createElement('script');
            vizScript.src = 'https://cdn.jsdelivr.net/npm/viz.js@2.1.2/viz.min.js';
            vizScript.async = true;
            
            vizScript.onload = () => {
                logGraphviz('Viz.js script loaded successfully.');
                
                // Then load the rendering worker
                const workerScript = document.createElement('script');
                workerScript.src = 'https://cdn.jsdelivr.net/npm/viz.js@2.1.2/full.render.js';
                workerScript.async = true;
                
                workerScript.onload = () => {
                    logGraphviz('Viz.js worker script loaded successfully.');
                    resolve();
                };
                
                workerScript.onerror = (err) => {
                    logGraphviz('Failed to load Viz.js worker script.', 'error');
                    reject(err);
                };
                
                document.head.appendChild(workerScript);
            };
            
            vizScript.onerror = (err) => {
                logGraphviz('Failed to load Viz.js script.', 'error');
                reject(err);
            };
            
            document.head.appendChild(vizScript);
        });
    }

    process(previewElement) {
        if (!vizInitialized) {
            logGraphviz('Cannot process, Viz.js not initialized.', 'warning');
            this.init().then(() => {
                this.renderDiagrams(previewElement);
            }).catch(error => {
                logGraphviz(`Failed to initialize on-demand: ${error.message}`, 'error');
            });
            return;
        }
        
        this.renderDiagrams(previewElement);
    }
    
    renderDiagrams(previewElement) {
        logGraphviz('Processing Graphviz diagrams...');
        const elements = previewElement.querySelectorAll('.graphviz:not([data-processed="true"])');
        
        if (elements.length > 0) {
            logGraphviz(`Found ${elements.length} diagrams to render.`);
            
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
                    
                    logGraphviz('Diagram rendered successfully.');
                } catch (error) {
                    logGraphviz(`Error rendering diagram: ${error.message}`, 'error');
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
            logGraphviz('No new diagrams found to process.');
        }
    }
} 