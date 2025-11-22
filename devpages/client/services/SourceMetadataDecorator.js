/**
 * SourceMetadataDecorator.js
 *
 * Decorates the existing ElementPicker with source metadata display.
 * Adds shift-click handler to show source information overlay.
 *
 * Features:
 * - Shift+click on any element to see source info
 * - Quick overlay tooltip with file paths
 * - Links to open in editor
 * - "View Details" button to open Source Tracker panel
 * - Non-invasive enhancement of existing ElementPicker
 * - Self-registering to window.APP.services
 *
 * Integration:
 * - Works with existing window.APP.utils.elementPicker
 * - Uses window.APP.services.sourceTracker for metadata
 * - Uses window.APP.services.editorLink for editor integration
 */

export class SourceMetadataDecorator {
  constructor() {
    this.enabled = false;
    this.overlay = null;
    this.boundShiftClickHandler = this.handleShiftClick.bind(this);
    this.currentElement = null;

    console.log('[SourceMetadataDecorator] Service created (not enabled)');
  }

  /**
   * Enable shift-click source tracking
   */
  enable() {
    if (this.enabled) {
      console.log('[SourceMetadataDecorator] Already enabled');
      return;
    }

    // Create overlay elements
    this.createOverlay();

    // Add global shift+click listener
    document.addEventListener('click', this.boundShiftClickHandler, true);

    this.enabled = true;
    console.log('[SourceMetadataDecorator] Enabled (shift+click to inspect)');
  }

  /**
   * Disable shift-click source tracking
   */
  disable() {
    if (!this.enabled) return;

    // Remove listener
    document.removeEventListener('click', this.boundShiftClickHandler, true);

    // Remove overlay
    if (this.overlay) {
      this.hideOverlay();
    }

    this.enabled = false;
    console.log('[SourceMetadataDecorator] Disabled');
  }

  /**
   * Create overlay elements for source info display
   */
  createOverlay() {
    if (this.overlay) return;

    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'source-tracker-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      z-index: 2000000;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 16px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      line-height: 1.6;
      display: none;
      max-width: 500px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(59, 130, 246, 0.5);
      backdrop-filter: blur(10px);
    `;

    document.body.appendChild(this.overlay);
  }

  /**
   * Handle shift+click events
   * @param {MouseEvent} event - Click event
   */
  handleShiftClick(event) {
    // Only respond to shift+click
    if (!event.shiftKey) return;

    // Prevent default and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = event.target;
    this.showSourceInfo(element, event.clientX, event.clientY);

    return false;
  }

  /**
   * Show source information for an element
   * @param {HTMLElement} element - Element to inspect
   * @param {number} x - Mouse X position
   * @param {number} y - Mouse Y position
   */
  showSourceInfo(element, x, y) {
    if (!element) return;

    this.currentElement = element;

    // Get source tracker service
    const sourceTracker = window.APP?.services?.sourceTracker;
    if (!sourceTracker) {
      this.showError('Source tracker service not available');
      return;
    }

    // Get source info
    const sourceInfo = sourceTracker.getSourceInfo(element);
    if (!sourceInfo) {
      this.showError('No source information available');
      return;
    }

    // Render overlay content
    this.renderOverlay(sourceInfo);

    // Position overlay
    this.positionOverlay(x, y);

    // Show overlay
    this.overlay.style.display = 'block';

    // Add click-outside-to-close handler
    setTimeout(() => {
      document.addEventListener('click', this.hideOverlay.bind(this), { once: true });
    }, 100);
  }

  /**
   * Render overlay content with source information
   * @param {Object} sourceInfo - Source information
   */
  renderOverlay(sourceInfo) {
    const editorLink = window.APP?.services?.editorLink;

    // Build HTML content
    let html = '<div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2);">';
    html += `<div style="font-size: 16px; font-weight: bold; color: #60A5FA; margin-bottom: 8px;">📍 Source Information</div>`;

    // Component info
    if (sourceInfo.componentName) {
      html += `<div><span style="color: #9CA3AF;">Component:</span> <strong>${sourceInfo.componentName}</strong></div>`;
    }

    // File path
    if (sourceInfo.filePath) {
      if (editorLink) {
        const link = editorLink.generateLink(sourceInfo.filePath, sourceInfo.lineNumber);
        html += `<div><span style="color: #9CA3AF;">File:</span> <a href="${link}" class="source-file-link" style="color: #60A5FA; text-decoration: none; cursor: pointer;">${sourceInfo.filePath}${sourceInfo.lineNumber ? `:${sourceInfo.lineNumber}` : ''}</a></div>`;
      } else {
        html += `<div><span style="color: #9CA3AF;">File:</span> ${sourceInfo.filePath}${sourceInfo.lineNumber ? `:${sourceInfo.lineNumber}` : ''}</div>`;
      }
    } else {
      html += `<div style="color: #FCD34D;"><em>Source file not tracked (inferred)</em></div>`;
    }

    // Inferred indicator
    if (sourceInfo.inferred) {
      html += `<div style="color: #FCD34D; font-size: 11px; margin-top: 4px;">⚠️ Inferred from ${sourceInfo.inferredFrom || 'heuristics'}</div>`;
    }

    html += '</div>';

    // CSS sources
    if (sourceInfo.css && sourceInfo.css.files && sourceInfo.css.files.length > 0) {
      html += '<div style="margin-bottom: 12px;">';
      html += `<div style="color: #9CA3AF; margin-bottom: 4px;">CSS Files:</div>`;
      html += '<div style="font-size: 11px; margin-left: 8px;">';
      sourceInfo.css.files.slice(0, 3).forEach(file => {
        html += `<div>• ${file}</div>`;
      });
      if (sourceInfo.css.files.length > 3) {
        html += `<div style="color: #9CA3AF;">...and ${sourceInfo.css.files.length - 3} more</div>`;
      }
      html += '</div></div>';
    }

    // Design tokens
    if (sourceInfo.tokens && sourceInfo.tokens.applied && Object.keys(sourceInfo.tokens.applied).length > 0) {
      html += '<div style="margin-bottom: 12px;">';
      html += `<div style="color: #9CA3AF; margin-bottom: 4px;">Design Tokens:</div>`;
      html += '<div style="font-size: 11px; margin-left: 8px;">';
      const tokenEntries = Object.entries(sourceInfo.tokens.applied).slice(0, 3);
      tokenEntries.forEach(([prop, value]) => {
        html += `<div>• ${prop}: ${value}</div>`;
      });
      if (Object.keys(sourceInfo.tokens.applied).length > 3) {
        html += `<div style="color: #9CA3AF;">...and ${Object.keys(sourceInfo.tokens.applied).length - 3} more</div>`;
      }
      html += '</div></div>';
    }

    // Action buttons
    html += '<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; gap: 8px;">';
    html += '<button id="source-tracker-details-btn" style="flex: 1; padding: 6px 12px; background: #60A5FA; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">View Full Details</button>';
    html += '<button id="source-tracker-close-btn" style="padding: 6px 12px; background: #374151; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Close</button>';
    html += '</div>';

    this.overlay.innerHTML = html;

    // Attach event listeners
    this.attachOverlayListeners(sourceInfo);
  }

  /**
   * Attach event listeners to overlay buttons
   * @param {Object} sourceInfo - Source information
   */
  attachOverlayListeners(sourceInfo) {
    // Editor link clicks
    const fileLinks = this.overlay.querySelectorAll('.source-file-link');
    fileLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const editorLink = window.APP?.services?.editorLink;
        if (editorLink && sourceInfo.filePath) {
          editorLink.open(sourceInfo.filePath, sourceInfo.lineNumber);
        }
      });
    });

    // View Details button
    const detailsBtn = this.overlay.querySelector('#source-tracker-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', () => {
        this.openSourceTrackerPanel(sourceInfo);
        this.hideOverlay();
      });
    }

    // Close button
    const closeBtn = this.overlay.querySelector('#source-tracker-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideOverlay();
      });
    }
  }

  /**
   * Open Source Tracker panel with detailed information
   * @param {Object} sourceInfo - Source information
   */
  openSourceTrackerPanel(sourceInfo) {
    // Try to open Source Tracker panel
    // This requires the panel to be registered
    console.log('[SourceMetadataDecorator] Opening Source Tracker panel with:', sourceInfo);

    // Dispatch event that panel can listen to
    const event = new CustomEvent('sourcetracker:open-panel', {
      detail: {
        element: this.currentElement,
        sourceInfo: sourceInfo
      }
    });
    window.dispatchEvent(event);

    // TODO: Integrate with panel system when SourceTrackerPanel is created
  }

  /**
   * Position overlay near mouse cursor
   * @param {number} x - Mouse X position
   * @param {number} y - Mouse Y position
   */
  positionOverlay(x, y) {
    if (!this.overlay) return;

    const padding = 10;
    const rect = this.overlay.getBoundingClientRect();

    let left = x + padding;
    let top = y + padding;

    // Keep on screen
    if (left + rect.width > window.innerWidth) {
      left = x - rect.width - padding;
    }
    if (top + rect.height > window.innerHeight) {
      top = y - rect.height - padding;
    }

    // Ensure not off left/top edges
    left = Math.max(padding, left);
    top = Math.max(padding, top);

    this.overlay.style.left = `${left}px`;
    this.overlay.style.top = `${top}px`;
  }

  /**
   * Hide overlay
   */
  hideOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    this.currentElement = null;
  }

  /**
   * Show error message in overlay
   * @param {string} message - Error message
   */
  showError(message) {
    if (!this.overlay) this.createOverlay();

    this.overlay.innerHTML = `
      <div style="color: #FCA5A5;">
        <div style="font-size: 16px; margin-bottom: 8px;">⚠️ Error</div>
        <div>${message}</div>
        <button id="source-tracker-close-btn" style="margin-top: 12px; padding: 6px 12px; background: #374151; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      </div>
    `;

    const closeBtn = this.overlay.querySelector('#source-tracker-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideOverlay());
    }

    this.overlay.style.display = 'block';
    this.overlay.style.left = '50%';
    this.overlay.style.top = '20%';
    this.overlay.style.transform = 'translateX(-50%)';
  }

  /**
   * Check if decorator is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Toggle enabled state
   * @returns {boolean} New enabled state
   */
  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.enabled;
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const sourceMetadataDecorator = new SourceMetadataDecorator();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.sourceMetadataDecorator = sourceMetadataDecorator;

console.log('[SourceMetadataDecorator] Service registered to window.APP.services.sourceMetadataDecorator');

// Auto-enable on load (can be configured)
// Uncomment to enable by default:
// sourceMetadataDecorator.enable();

// Export singleton instance as default
export default sourceMetadataDecorator;
