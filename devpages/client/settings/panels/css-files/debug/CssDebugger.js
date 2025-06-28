/**
 * CSS Debugger - Handles comprehensive CSS debugging functionality
 */

export class CssDebugger {
  constructor() {
    this.activeDebugPanels = new Set();
  }

  /**
   * Open debug panel for a CSS file
   */
  openDebugPanel(href, options = {}) {
    const { analyzer, conflictDetector, onNotification } = options;
    
    try {
      // Find CSS file info
      const cssFile = this.findCssFileInfo(href);
      
      // Analyze conflicts
      const conflicts = conflictDetector?.detectCssConflicts(cssFile, href) || [];
      
      // Find affected elements
      const affectedElements = analyzer?.findAffectedElements(href) || [];
      
      // Create enhanced debug panel
      const panel = this.createEnhancedCssDebugPanel(href, cssFile, conflicts, affectedElements);
      document.body.appendChild(panel);
      
      // Track active panel
      this.activeDebugPanels.add(panel);
      
      // Setup event handlers
      this.setupDebugPanelEventHandlers(panel, cssFile, href, options);
      
      if (onNotification) {
        onNotification(`Opened debug panel for ${this.getFileNameFromHref(href)}`, 'info');
      }
      
    } catch (error) {
      console.error('Error opening debug panel:', error);
      if (onNotification) {
        onNotification('Error opening debug panel', 'error');
      }
    }
  }

  /**
   * Create enhanced CSS debug panel
   */
  createEnhancedCssDebugPanel(href, cssFile, conflicts, affectedElements) {
    const panel = document.createElement('div');
    panel.className = 'css-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50px;
      right: 50px;
      width: 800px;
      max-width: 90vw;
      max-height: 80vh;
      background: var(--color-background, white);
      border: 1px solid var(--color-border, #ccc);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10001;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-family-sans, system-ui);
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--color-border, #eee);">
        <h2 style="margin: 0; font-size: 20px; color: var(--color-foreground, #333);">
          🎨 CSS Debug: ${this.getFileNameFromHref(href)}
        </h2>
        <button class="debug-close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-foreground-muted, #666);">×</button>
      </div>

      <div class="debug-tabs" style="display: flex; border-bottom: 1px solid var(--color-border, #eee);">
        <button class="debug-tab-btn active" data-tab="overview" style="padding: 12px 20px; border: none; background: var(--color-primary, #007bff); color: white; cursor: pointer; font-size: 14px;">Overview</button>
        <button class="debug-tab-btn" data-tab="conflicts" style="padding: 12px 20px; border: none; background: none; color: var(--color-foreground, #333); cursor: pointer; font-size: 14px;">Conflicts (${conflicts.length})</button>
        <button class="debug-tab-btn" data-tab="elements" style="padding: 12px 20px; border: none; background: none; color: var(--color-foreground, #333); cursor: pointer; font-size: 14px;">Elements (${affectedElements.length})</button>
        <button class="debug-tab-btn" data-tab="preview" style="padding: 12px 20px; border: none; background: none; color: var(--color-foreground, #333); cursor: pointer; font-size: 14px;">Preview</button>
      </div>

      <div class="debug-content" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div class="debug-tab-content active" data-tab-content="overview">
          ${this.renderOverviewTab(cssFile, href)}
        </div>
        <div class="debug-tab-content" data-tab-content="conflicts" style="display: none;">
          ${this.renderConflictsTab(conflicts)}
        </div>
        <div class="debug-tab-content" data-tab-content="elements" style="display: none;">
          ${this.renderElementsTab(affectedElements)}
        </div>
        <div class="debug-tab-content" data-tab-content="preview" style="display: none;">
          ${this.renderPreviewTab(href)}
        </div>
      </div>
    `;

    return panel;
  }

  /**
   * Render overview tab content
   */
  renderOverviewTab(cssFile, href) {
    return `
      <div class="overview-section">
        <h3 style="margin: 0 0 16px 0; font-size: 16px;">📊 File Information</h3>
        <div style="background: var(--color-background-secondary, #f8f9fa); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 14px;">
            <strong>URL:</strong> <span style="font-family: var(--font-family-mono, monospace); word-break: break-all;">${href}</span>
            <strong>Status:</strong> <span style="color: ${cssFile?.disabled ? '#f44336' : '#4caf50'};">${cssFile?.disabled ? 'Disabled' : 'Enabled'}</span>
            <strong>Type:</strong> <span>${cssFile?.type || 'External'}</span>
            <strong>Size:</strong> <span id="css-file-size">Loading...</span>
          </div>
        </div>

        <h3 style="margin: 0 0 16px 0; font-size: 16px;">🛠️ Quick Actions</h3>
        <div style="display: flex; flex-wrap: gap: 8px;">
          <button class="quick-action-btn" data-action="view-source" style="padding: 8px 12px; background: var(--color-secondary, #6c757d); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            📄 View Source
          </button>
          <button class="quick-action-btn" data-action="check-conflicts" style="padding: 8px 12px; background: var(--color-warning, #ffc107); color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            ⚠️ Check Conflicts
          </button>
          <button class="quick-action-btn" data-action="preview-without" style="padding: 8px 12px; background: var(--color-info, #17a2b8); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            👁️ Preview Without
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render conflicts tab content
   */
  renderConflictsTab(conflicts) {
    if (conflicts.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: var(--color-foreground-muted, #666);">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h3 style="margin: 0 0 8px 0;">No Conflicts Detected</h3>
          <p style="margin: 0;">This CSS file doesn't appear to have any obvious conflicts with other stylesheets.</p>
        </div>
      `;
    }

    return `
      <div class="conflicts-section">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: var(--color-warning, #f59e0b);">
          ⚠️ ${conflicts.length} Potential Conflicts Found
        </h3>
        
        <div style="max-height: 400px; overflow-y: auto;">
          ${conflicts.map((conflict, index) => `
            <div style="background: var(--color-warning-background, #fff3cd); border: 1px solid var(--color-warning, #ffc107); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <h4 style="margin: 0; font-size: 14px; color: var(--color-warning-foreground, #856404);">
                  ${conflict.type} Conflict
                </h4>
                <span style="background: var(--color-warning, #ffc107); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                  ${conflict.severity}
                </span>
              </div>
              <p style="margin: 0 0 8px 0; font-size: 13px;">${conflict.description}</p>
              <div style="font-family: var(--font-family-mono, monospace); font-size: 12px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px;">
                ${conflict.selector}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render elements tab content
   */
  renderElementsTab(elements) {
    return `
      <div class="elements-section">
        <h3 style="margin: 0 0 16px 0; font-size: 16px;">🎯 Affected Elements (${elements.length})</h3>
        
        ${elements.length === 0 ? 
          '<p style="color: var(--color-foreground-muted, #666); text-align: center; padding: 20px;">No elements found that are directly affected by this CSS file.</p>' :
          `<div style="max-height: 300px; overflow-y: auto;">
            ${elements.map(element => `
              <div style="border: 1px solid var(--color-border, #eee); border-radius: 6px; padding: 12px; margin-bottom: 8px; background: var(--color-background, white);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <code style="font-family: var(--font-family-mono, monospace); font-size: 12px; background: var(--color-background-secondary, #f8f9fa); padding: 2px 6px; border-radius: 3px;">
                    ${element.selector}
                  </code>
                  <button class="inspect-element-btn" data-selector="${element.selector}" style="background: var(--color-primary, #007bff); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">
                    Inspect
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--color-foreground-secondary, #666);">
                  ${element.properties.slice(0, 3).join(', ')}${element.properties.length > 3 ? ` +${element.properties.length - 3} more` : ''}
                </div>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    `;
  }

  /**
   * Render preview tab content
   */
  renderPreviewTab(href) {
    return `
      <div class="preview-section">
        <h3 style="margin: 0 0 16px 0; font-size: 16px;">👁️ Preview Impact</h3>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: var(--color-foreground-secondary, #666);">
          See how the page looks with this CSS file enabled or disabled.
        </p>
        
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <button class="preview-toggle-btn" data-state="without" style="flex: 1; padding: 12px; background: var(--color-secondary, #6c757d); color: white; border: none; border-radius: 6px; cursor: pointer;">
            🚫 Preview Without This CSS
          </button>
          <button class="preview-toggle-btn" data-state="with" style="flex: 1; padding: 12px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 6px; cursor: pointer;">
            ✅ Preview With This CSS
          </button>
        </div>
        
        <div id="preview-comparison" style="border: 1px solid var(--color-border, #eee); border-radius: 8px; min-height: 200px; background: var(--color-background-secondary, #f8f9fa); display: flex; align-items: center; justify-content: center; color: var(--color-foreground-muted, #666);">
          Click a preview button above to see the impact
        </div>
      </div>
    `;
  }

  /**
   * Setup event handlers for the debug panel
   */
  setupDebugPanelEventHandlers(panel, cssFile, href, options) {
    // Close button
    panel.querySelector('.debug-close-btn').addEventListener('click', () => {
      this.closeDebugPanel(panel);
    });

    // Tab switching
    panel.querySelectorAll('.debug-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update active tab button
        panel.querySelectorAll('.debug-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'none';
          b.style.color = 'var(--color-foreground, #333)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--color-primary, #007bff)';
        btn.style.color = 'white';
        
        // Update active tab content
        panel.querySelectorAll('.debug-tab-content').forEach(content => {
          content.style.display = 'none';
          content.classList.remove('active');
        });
        const targetContent = panel.querySelector(`[data-tab-content="${targetTab}"]`);
        if (targetContent) {
          targetContent.style.display = 'block';
          targetContent.classList.add('active');
        }
      });
    });

    // Quick action buttons
    panel.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleQuickAction(btn.dataset.action, href, options);
      });
    });

    // Preview toggle buttons
    panel.querySelectorAll('.preview-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handlePreviewToggle(btn.dataset.state, href, panel, options);
      });
    });

    // Element inspect buttons
    panel.querySelectorAll('.inspect-element-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.inspectElement(btn.dataset.selector, options);
      });
    });

    // Load file size asynchronously
    this.loadCssFileSize(href).then(size => {
      const sizeElement = panel.querySelector('#css-file-size');
      if (sizeElement) {
        sizeElement.textContent = size;
      }
    });
  }

  /**
   * Close debug panel
   */
  closeDebugPanel(panel) {
    if (panel.parentElement) {
      panel.parentElement.removeChild(panel);
    }
    this.activeDebugPanels.delete(panel);
  }

  /**
   * Handle quick actions
   */
  handleQuickAction(action, href, options) {
    const { onNotification } = options;
    
    switch (action) {
      case 'view-source':
        this.viewCssSource(href, onNotification);
        break;
      case 'check-conflicts':
        this.highlightCssConflicts(href, onNotification);
        break;
      case 'preview-without':
        this.previewWithoutCss(href, onNotification);
        break;
    }
  }

  /**
   * Handle preview toggle
   */
  handlePreviewToggle(state, href, panel, options) {
    const { onNotification } = options;
    
    if (state === 'without') {
      this.previewWithoutCss(href, onNotification);
    } else {
      this.previewWithCss(href, onNotification);
    }
    
    // Update comparison display
    const comparisonDiv = panel.querySelector('#preview-comparison');
    if (comparisonDiv) {
      comparisonDiv.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h4 style="margin: 0 0 10px 0; color: var(--color-foreground, #333);">
            Preview ${state === 'without' ? 'WITHOUT' : 'WITH'} ${this.getFileNameFromHref(href)}
          </h4>
          <p style="margin: 0; color: var(--color-foreground-secondary, #666);">
            CSS file is currently ${state === 'without' ? 'disabled' : 'enabled'}. 
            Check the main page to see the changes.
          </p>
        </div>
      `;
    }
  }

  /**
   * Inspect element
   */
  inspectElement(selector, options) {
    const { onNotification } = options;
    
    try {
      const element = document.querySelector(selector);
      if (element) {
        // Highlight element
        element.style.outline = '3px solid #007bff';
        element.style.outlineOffset = '2px';
        
        setTimeout(() => {
          element.style.outline = '';
          element.style.outlineOffset = '';
        }, 3000);
        
        console.log('Element selected for inspection:', element);
        console.log('Computed styles:', window.getComputedStyle(element));
        
        if (onNotification) {
          onNotification(`Inspecting: ${selector}`, 'info');
        }
      } else {
        if (onNotification) {
          onNotification(`Element not found: ${selector}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error inspecting element:', error);
      if (onNotification) {
        onNotification('Error inspecting element', 'error');
      }
    }
  }

  /**
   * View CSS source
   */
  async viewCssSource(href, onNotification) {
    try {
      const response = await fetch(href);
      const cssText = await response.text();
      
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); 
        display: flex; align-items: center; justify-content: center; z-index: 10000;
      `;
      
      modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 20px; max-width: 90vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 18px;">📄 CSS Source: ${this.getFileNameFromHref(href)}</h2>
            <button class="close-source" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
          </div>
          
          <div style="flex: 1; overflow: hidden;">
            <pre style="background: #f8f9fa; padding: 16px; border-radius: 6px; overflow: auto; height: 100%; margin: 0; font-family: var(--font-family-mono, monospace); font-size: 12px; line-height: 1.4;">${this.escapeHtml(cssText)}</pre>
          </div>
          
          <div style="margin-top: 16px; text-align: right;">
            <button class="close-source" style="padding: 8px 16px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;">
              Close
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close handlers
      modal.querySelectorAll('.close-source').forEach(btn => {
        btn.addEventListener('click', () => {
          document.body.removeChild(modal);
        });
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      });
      
    } catch (error) {
      console.error('Error loading CSS source:', error);
      if (onNotification) {
        onNotification('Error loading CSS source', 'error');
      }
    }
  }

  /**
   * Highlight CSS conflicts
   */
  highlightCssConflicts(href, onNotification) {
    // Simple implementation - highlight all elements affected by this CSS
    fetch(href)
      .then(response => response.text())
      .then(cssText => {
        const selectorMatches = cssText.match(/[^{}]+(?=\s*{)/g) || [];
        let highlightCount = 0;
        
        selectorMatches.forEach(selector => {
          const cleanSelector = selector.trim().split(',')[0].trim();
          if (!cleanSelector.startsWith('@')) {
            try {
              const elements = document.querySelectorAll(cleanSelector);
              elements.forEach(el => {
                el.style.outline = '2px dashed #ff6b6b';
                el.style.outlineOffset = '2px';
                highlightCount++;
              });
            } catch (e) {
              // Invalid selector, ignore
            }
          }
        });

        if (onNotification) {
          onNotification(`Highlighted ${highlightCount} elements`, 'info');
        }

        // Remove highlights after 5 seconds
        setTimeout(() => {
          document.querySelectorAll('*').forEach(el => {
            if (el.style.outline === '2px dashed rgb(255, 107, 107)') {
              el.style.outline = '';
              el.style.outlineOffset = '';
            }
          });
        }, 5000);
      })
      .catch(error => {
        console.error('Error highlighting conflicts:', error);
        if (onNotification) {
          onNotification('Error analyzing conflicts', 'error');
        }
      });
  }

  /**
   * Preview without CSS file
   */
  previewWithoutCss(href, onNotification) {
    const link = document.querySelector(`link[href="${href}"]`);
    if (link) {
      const originalState = link.disabled;
      link.disabled = true;
      
      if (onNotification) {
        onNotification(`Previewing without ${this.getFileNameFromHref(href)}`, 'info');
      }
      
      // Auto-restore after 10 seconds
      setTimeout(() => {
        link.disabled = originalState;
        if (onNotification) {
          onNotification('CSS file restored', 'info');
        }
      }, 10000);
    } else {
      if (onNotification) {
        onNotification('CSS file link not found', 'error');
      }
    }
  }

  /**
   * Preview with CSS file
   */
  previewWithCss(href, onNotification) {
    const link = document.querySelector(`link[href="${href}"]`);
    if (link) {
      link.disabled = false;
      if (onNotification) {
        onNotification(`Restored ${this.getFileNameFromHref(href)}`, 'success');
      }
    } else {
      if (onNotification) {
        onNotification('CSS file link not found', 'error');
      }
    }
  }

  /**
   * Find CSS file information
   */
  findCssFileInfo(href) {
    const link = document.querySelector(`link[href="${href}"]`);
    if (link) {
      return {
        disabled: link.disabled,
        type: 'external',
        element: link
      };
    }
    
    return { disabled: false, type: 'unknown' };
  }

  /**
   * Load CSS file size
   */
  async loadCssFileSize(href) {
    try {
      const response = await fetch(href, { method: 'HEAD' });
      const contentLength = response.headers.get('Content-Length');
      
      if (contentLength) {
        const sizeKB = (parseInt(contentLength) / 1024).toFixed(1);
        return `${sizeKB} KB`;
      } else {
        // Fallback: fetch the content to get size
        const fullResponse = await fetch(href);
        const text = await fullResponse.text();
        return `${(text.length / 1024).toFixed(1)} KB`;
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get filename from href
   */
  getFileNameFromHref(href) {
    if (href.startsWith('<style')) {
      return href;
    }
    try {
      const url = new URL(href);
      return url.pathname.split('/').pop() || 'unknown.css';
    } catch (e) {
      return href.split('/').pop() || 'unknown.css';
    }
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup all debug panels
   */
  destroy() {
    this.activeDebugPanels.forEach(panel => {
      this.closeDebugPanel(panel);
    });
    this.activeDebugPanels.clear();
  }
} 