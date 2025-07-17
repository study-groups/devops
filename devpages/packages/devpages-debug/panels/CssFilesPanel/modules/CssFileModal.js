/**
 * CSS File Modal Handler
 * Handles modal display for CSS file content and analysis
 */

export class CssFileModal {
  /**
   * Show CSS content in a modal with analysis
   */
  static show(content, title, isHtml = false) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; 
      z-index: 10000; font-family: var(--font-family-sans, system-ui);
    `;
    
    modal.innerHTML = `
      <div style="
        background: var(--color-background, white); 
        border: 1px solid var(--color-border, #e1e5e9);
        padding: 24px; 
        border-radius: 6px; 
        max-width: 90vw; 
        max-height: 90vh; 
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border, #e1e5e9);">
          <h3 style="margin: 0; color: var(--color-foreground); font-size: 16px; font-weight: 600;">${title}</h3>
          <button class="close-modal" style="
            background: var(--color-error); 
            color: var(--color-error-foreground); 
            border: 1px solid var(--color-error); 
            padding: var(--space-2) var(--space-4); 
            border-radius: var(--radius-md); 
            cursor: pointer;
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            transition: var(--transition-all);
          " onmouseover="this.style.background='var(--color-error-background)'; this.style.color='var(--color-error)'" onmouseout="this.style.background='var(--color-error)'; this.style.color='var(--color-error-foreground)'">
            Close
          </button>
        </div>
        ${isHtml ? `
          <div style="
            background: var(--color-background-secondary, #f8f9fa); 
            border: 1px solid var(--color-border, #e1e5e9);
            padding: 20px; 
            border-radius: 4px; 
            overflow: auto; 
            flex: 1;
            color: var(--color-foreground);
          ">${content}</div>
        ` : `
          <pre style="
            background: var(--color-background-secondary, #f8f9fa); 
            border: 1px solid var(--color-border, #e1e5e9);
            padding: 20px; 
            border-radius: 4px; 
            overflow: auto; 
            flex: 1;
            margin: 0;
            font-family: var(--font-family-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace); 
            font-size: 12px; 
            line-height: 1.5; 
            white-space: pre-wrap;
            color: var(--color-foreground);
          ">${content}</pre>
        `}
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Simple, bulletproof close function
    const closeModal = () => {
      try {
        if (modal && modal.parentNode) {
          modal.remove();
        }
      } catch (e) {
        console.warn('Modal close error:', e);
      }
    };
    
    // Close button - single click only
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', closeModal, { once: true });
    
    // Click outside to close - single click only  
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    }, { once: true });
    
    // Escape key to close - single use
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    return modal;
  }

  /**
   * Show CSS analysis modal with split view
   */
  static showAnalysis(cssContent, fileName, analysisSidebar) {
    const modalContent = `
      <div style="display: grid; grid-template-columns: 1fr 300px; gap: var(--space-4); height: 70vh;">
        <!-- CSS Content -->
        <div style="display: flex; flex-direction: column;">
          <h4 style="margin: 0 0 var(--space-3) 0; color: var(--color-foreground); font-size: var(--font-size-base);">${fileName}</h4>
          <pre style="
            background: var(--color-background-secondary); 
            border: 1px solid var(--color-border);
            padding: var(--space-4); 
            border-radius: var(--radius-md); 
            overflow: auto; 
            flex: 1;
            margin: 0;
            font-family: var(--font-family-mono); 
            font-size: var(--font-size-xs); 
            line-height: 1.4; 
            white-space: pre-wrap;
            color: var(--color-foreground);
          ">${cssContent}</pre>
        </div>
        
        <!-- Analysis Sidebar -->
        ${analysisSidebar}
      </div>
    `;
    
    return this.show(modalContent, `CSS Analysis: ${fileName}`, true);
  }
} 