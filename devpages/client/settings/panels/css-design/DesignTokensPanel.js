/**
 * DesignTokensPanel.js - Design Tokens Viewer (Settings Integration)
 * Uses the reusable DesignTokensPanel component from sidebar/panels
 * Provides full-featured design tokens browser for settings
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';
// import { DesignTokensPanel as ReusableDesignTokensPanel } from '/client/sidebar/panels/DesignTokensPanel.js';

class DesignTokensPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.reusablePanel = null;
    
    this.init();
  }

  async init() {
    // Load component CSS
    this.loadComponentCSS();
    
    // Create the reusable panel with full settings features
    // DISABLED - ReusableDesignTokensPanel not available
    /*
    this.reusablePanel = new ReusableDesignTokensPanel({
      container: this.containerElement,
      sortable: true,
      filterable: true,
      showStats: true,
      showTypeBadges: true
    });
    */
    
    // Fallback implementation
    this.containerElement.innerHTML = '<div class="design-tokens-placeholder">Design Tokens panel temporarily disabled</div>';
    
    console.log('[DesignTokensPanel] Settings panel initialized with reusable component');
  }

  /**
   * Load component CSS file
   */
  loadComponentCSS() {
    const cssPath = '/client/settings/panels/css-design/DesignTokensPanel.css';
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * Refresh tokens (delegate to reusable panel)
   */
  async refreshTokens() {
    if (this.reusablePanel) {
      this.reusablePanel.update();
    }
  }

  /**
   * Export tokens as JSON
   */
  exportTokensAsJSON() {
    if (this.reusablePanel && this.reusablePanel.tokens) {
      const tokensObject = {};
      
      this.reusablePanel.tokens.forEach(token => {
        tokensObject[token.variable] = {
          variable: token.variable,
          value: token.value,
          type: token.type,
          source: token.source
        };
      });
      
      const dataStr = JSON.stringify(tokensObject, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'design-tokens.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Destroy the panel
   */
  destroy() {
    if (this.reusablePanel) {
      // The reusable panel doesn't have a destroy method, but we can clear the container
      this.containerElement.innerHTML = '';
      this.reusablePanel = null;
    }
  }
}

// Register the section
settingsSectionRegistry.register('css-design-tokens', {
  title: 'Design Tokens',
  category: 'CSS & Design',
  icon: '🎨',
  description: 'Browse and manage CSS design tokens',
  component: DesignTokensPanel,
  order: 2
});

export { DesignTokensPanel }; 