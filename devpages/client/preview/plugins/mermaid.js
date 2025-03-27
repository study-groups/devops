/**
 * Mermaid Diagram Plugin
 * 
 * Adds support for rendering Mermaid diagrams in markdown
 */

import { logMessage } from '../../log/index.js';

// Consolidate Mermaid plugin with working methods
const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
let mermaid = null;

const config = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  themeVariables: {
    background: '#f8f9fa',
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    tertiaryColor: '#dee2e6'
  }
};

export class MermaidPlugin {
  constructor() {
    this.name = 'mermaid';
    this.initialized = false;
  }

  async init(options = {}) {
    logMessage('[PREVIEW] Initializing Mermaid plugin');
    
    // Check if mermaid is available
    if (typeof window.mermaid === 'undefined') {
      logMessage('[PREVIEW] Mermaid not found, loading from CDN');
      
      // Load mermaid from CDN if not already loaded
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = MERMAID_CDN;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    // Initialize mermaid with proper settings
    window.mermaid.initialize({
      startOnLoad: false,
      theme: options.theme || 'default',
      securityLevel: 'loose',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true
      }
    });
    
    this.initialized = true;
    logMessage('[PREVIEW] Mermaid plugin initialized');
    
    return true;
  }

  // Optional pre-process method
  async preProcess(content) {
    return content; // Mermaid doesn't need pre-processing
  }

  // Required post-process method
  async postProcess(html, element) {
    if (!this.initialized || typeof window.mermaid === 'undefined') {
      logMessage('[PREVIEW] Mermaid not initialized, skipping post-process');
      return html;
    }
    
    logMessage('[PREVIEW] Mermaid post-processing HTML');
    
    try {
      // Check if element exists before trying to query it
      if (!element) {
        logMessage('[PREVIEW WARNING] Element is undefined, cannot process Mermaid diagrams');
        return html;
      }
      
      // Find all mermaid diagrams in the rendered content
      const diagrams = element.querySelectorAll('.mermaid');
      
      if (diagrams.length > 0) {
        logMessage(`[PREVIEW] Found ${diagrams.length} Mermaid diagrams`);
        
        // Force mermaid to re-render all diagrams
        window.mermaid.init(undefined, diagrams);
        
        logMessage('[PREVIEW] Mermaid diagrams rendered');
      } else {
        logMessage('[PREVIEW] No Mermaid diagrams found in content');
      }
    } catch (error) {
      logMessage(`[PREVIEW ERROR] Mermaid rendering error: ${error.message}`);
      console.error('[PREVIEW ERROR] Mermaid error:', error);
    }
    
    return html;
  }

  async render(element) {
    if (!this.initialized) {
      await this.init();
    }

    if (!mermaid) {
      console.warn('Mermaid not loaded yet');
      return;
    }

    // Find all unprocessed mermaid diagrams
    const mermaidDivs = element.querySelectorAll('.mermaid:not([data-processed])');
    
    for (const div of mermaidDivs) {
      try {
        // Clean up any previous error states
        div.classList.remove('mermaid-error');
        
        // Generate unique ID for this diagram
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        div.id = id;
        
        // Render the diagram
        await mermaid.render(id, div.textContent.trim());
        div.setAttribute('data-processed', 'true');
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        div.classList.add('mermaid-error');
        div.innerHTML = `
          <div class="mermaid-error">
            <div class="mermaid-error-header">⚠️ Mermaid Syntax Error</div>
            <pre class="mermaid-error-message">${error.message || error.str || 'Unknown error'}</pre>
          </div>
        `;
      }
    }
  }

  setTheme(theme) {
    config.theme = theme === 'dark' ? 'dark' : 'default';
    if (mermaid) {
      mermaid.initialize({
        ...config,
        theme: config.theme
      });
    }
  }
}

// Add custom renderer for marked
export function createMermaidRenderer() {
  return {
    code(code, infostring) {
      if (infostring === 'mermaid') {
        return `<div class="mermaid">${code}</div>`;
      }
      return false; // Use default renderer
    }
  };
} 