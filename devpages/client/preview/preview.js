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

// If you're dynamically loading content, call this after new content is added
// observer.observe(...) or after markdown updates 