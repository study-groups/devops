// Assuming appStore is available globally or imported
import { appStore } from '/client/appState.js'; // Adjust path as necessary

// Add Mermaid configuration and initialization
const initMermaid = () => {
  mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    themeVariables: {
      background: '#f8f9fa',
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      tertiaryColor: '#dee2e6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }
  });
};

// Function to process Mermaid diagrams
const processMermaidDiagrams = () => {
  // Check if Mermaid plugin is enabled in the state
  const state = appStore.getState();
  const isMermaidEnabled = state.plugins?.mermaid?.enabled ?? false; // Default to false if state/plugin/enabled is missing

  if (!isMermaidEnabled) {
    console.log('[Preview] Mermaid plugin is disabled. Skipping rendering.');
    // Optionally clear existing diagrams or show a placeholder
    document.querySelectorAll('.mermaid[data-processed]').forEach(el => {
        el.innerHTML = '<div class="mermaid-disabled-placeholder">Mermaid rendering is disabled</div>';
        el.removeAttribute('data-processed');
        // Remove Mermaid generated IDs/styles if necessary
        const svg = el.querySelector('svg');
        if (svg) svg.remove();
    });
    return; // Don't process if disabled
  }

  const mermaidDivs = document.querySelectorAll('.mermaid');
  
  mermaidDivs.forEach((element) => {
    // Only process if not already rendered
    if (!element.hasAttribute('data-processed')) {
      try {
        mermaid.init(undefined, element);
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        element.innerHTML = `<div class="mermaid-error">Failed to render diagram: ${error.message}</div>`;
      }
    }
  });
};

// Call this after markdown is rendered
const setupMermaid = () => {
  if (typeof mermaid !== 'undefined') {
    initMermaid();
    processMermaidDiagrams();
  } else {
    console.error('Mermaid library not loaded');
  }
};

// Make sure to add this to your markdown rendering process
document.addEventListener('DOMContentLoaded', setupMermaid);

// Subscribe to state changes to re-process diagrams if the plugin is toggled
if (appStore && typeof appStore.subscribe === 'function') {
    appStore.subscribe((newState, prevState) => {
        const newMermaidState = newState.plugins?.mermaid?.enabled;
        const oldMermaidState = prevState.plugins?.mermaid?.enabled;
        if (newMermaidState !== oldMermaidState) {
            console.log('[Preview] Mermaid plugin state changed. Re-processing diagrams.');
            // Re-run setup or processing logic
            // Be careful to avoid infinite loops if processing triggers state changes
            setupMermaid(); 
        }
    });
} else {
    console.warn('[Preview] Could not subscribe to appStore for plugin updates.');
}

// If you're dynamically loading content, call this after new content is added
// observer.observe(...) or after markdown updates 