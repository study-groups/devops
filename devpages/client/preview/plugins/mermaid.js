/**
 * Mermaid Diagram Plugin
 * 
 * Adds support for rendering Mermaid diagrams in markdown
 */

// Helper for logging within this module
function logMermaid(message, level = 'text') {
    const prefix = '[MERMAID PLUGIN]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

// Global flag to ensure Mermaid library is loaded only once
let mermaidScriptLoaded = false;
let mermaidInitialized = false;

export class MermaidPlugin {
    constructor(options = {}) {
        this.options = {
            theme: 'default',
            securityLevel: 'loose',
            startOnLoad: false,
            ...options
        };
        logMermaid('MermaidPlugin instance created.');
    }

    async init() {
        if (mermaidInitialized) {
            logMermaid('Mermaid already initialized globally.');
            return true;
        }
        logMermaid('Initializing Mermaid library...');
        try {
            // Load Mermaid script if not already loaded
            if (!mermaidScriptLoaded && typeof window.mermaid === 'undefined') {
                logMermaid('Loading Mermaid script from CDN...');
                await this.loadMermaidScript();
                mermaidScriptLoaded = true;
            }
            
            if (typeof window.mermaid === 'undefined') {
                 throw new Error('Mermaid library failed to load or define window.mermaid.');
            }

            // Configure Mermaid
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

    process(previewElement) {
        if (!mermaidInitialized) {
            logMermaid('Cannot process, Mermaid not initialized.', 'warning');
            return;
        }
        logMermaid('Processing Mermaid diagrams...');
        const elements = previewElement.querySelectorAll('.mermaid:not([data-processed="true"])');
        if (elements.length > 0) {
            logMermaid(`Found ${elements.length} diagrams to render.`);
            try {
                // Use mermaid.run() for dynamic rendering
                window.mermaid.run({ nodes: elements });
                logMermaid('Diagrams rendered.');
            } catch (error) {
                logMermaid(`Error rendering diagrams: ${error.message}`, 'error');
                console.error('[MERMAID RENDER ERROR]', error);
                // Optionally display error messages in place of diagrams
                elements.forEach(el => {
                     el.innerHTML = `<div class="mermaid-error"><div class="mermaid-error-header">Mermaid Error</div><pre class="mermaid-error-message">${error.message}</pre></div>`;
                     el.setAttribute('data-processed', 'true'); // Mark as processed even on error
                 });
            }
        } else {
            logMermaid('No new diagrams found to process.');
        }
    }
} 