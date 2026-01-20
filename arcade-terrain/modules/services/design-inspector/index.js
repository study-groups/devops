/**
 * DesignInspector - Element-level style editor
 * Main orchestrator module
 */

import { createEmptyOverrides } from './config.js';
import {
  generateDesignId,
  getCurrentTheme,
  getElementSelector,
  getCssSelector,
  isInspectorElement
} from './selectors.js';
import {
  loadOverrides,
  saveOverrides,
  createStyleElement,
  applyOverrides,
  exportJSON,
  exportCSS,
  importJSON,
  storeOverride,
  clearElementOverrides
} from './persistence.js';
import {
  createPanel,
  initPanelDrag,
  updatePanelInfo,
  updatePanelBody,
  showPanel,
  hidePanel,
  flashFeedback,
  copyInfoToClipboard,
  getPathElement
} from './panel.js';
import {
  createSelectionOverlay,
  createHoverOverlay,
  showHoverOverlay,
  hideHoverOverlay,
  showSelectionOverlay,
  hideSelectionOverlay,
  removeOverlays
} from './overlays.js';

export const DesignInspector = {
  // State
  _inspectMode: false,
  _selectedElement: null,
  _panel: null,
  _selectionOverlay: null,
  _hoverOverlay: null,
  _styleElement: null,
  _overrides: null,

  // =========================================================================
  // Lifecycle
  // =========================================================================

  init() {
    this._overrides = loadOverrides();
    this._styleElement = createStyleElement();
    applyOverrides(this._overrides, this._styleElement);
    this._selectionOverlay = createSelectionOverlay();
    this._hoverOverlay = createHoverOverlay();
    this._bindGlobalEvents();
    console.log('[DesignInspector] Initialized');
  },

  destroy() {
    this.exitInspectMode();
    if (this._panel) this._panel.remove();
    removeOverlays(this._selectionOverlay, this._hoverOverlay);
    if (this._styleElement) this._styleElement.remove();
  },

  // =========================================================================
  // Inspect Mode
  // =========================================================================

  toggleInspectMode() {
    if (this._inspectMode) {
      this.exitInspectMode();
    } else {
      this.enterInspectMode();
    }
  },

  enterInspectMode() {
    this._inspectMode = true;
    document.body.classList.add('inspector-active');
    document.body.style.cursor = 'crosshair';
    console.log('[DesignInspector] Inspect mode ON');
  },

  exitInspectMode() {
    this._inspectMode = false;
    document.body.classList.remove('inspector-active');
    document.body.style.cursor = '';
    hideHoverOverlay(this._hoverOverlay);
    console.log('[DesignInspector] Inspect mode OFF');
  },

  isInspectMode() {
    return this._inspectMode;
  },

  // =========================================================================
  // Element Selection
  // =========================================================================

  selectElement(el) {
    if (isInspectorElement(el)) return;

    // Assign design ID if not present
    if (!el.dataset.designId) {
      el.dataset.designId = generateDesignId();
    }

    // Store selector mapping
    const runtimeSelector = getElementSelector(el);
    const cssSelector = getCssSelector(el);
    if (!this._overrides.selectorMap) this._overrides.selectorMap = {};
    this._overrides.selectorMap[runtimeSelector] = cssSelector;

    this._selectedElement = el;
    showSelectionOverlay(this._selectionOverlay, el);
    this.exitInspectMode();
    this._showPanel(el);
  },

  deselectElement() {
    this._selectedElement = null;
    hideSelectionOverlay(this._selectionOverlay);
    this._hidePanel();
  },

  // =========================================================================
  // Panel Management
  // =========================================================================

  _showPanel(el) {
    if (!this._panel) {
      this._panel = createPanel();
      initPanelDrag(this._panel);
      this._bindPanelEvents();
    }
    this._updatePanel(el);
    showPanel(this._panel);
  },

  _hidePanel() {
    if (this._panel) {
      hidePanel(this._panel);
    }
  },

  _updatePanel(el) {
    if (!this._panel) return;
    updatePanelInfo(this._panel, el);
    updatePanelBody(this._panel, el, this._overrides);
  },

  _bindPanelEvents() {
    this._panel.addEventListener('click', (e) => this._handlePanelClick(e));
    this._panel.addEventListener('input', (e) => this._handlePanelInput(e));
    this._panel.addEventListener('change', (e) => this._handlePanelInput(e));
  },

  _handlePanelClick(e) {
    const action = e.target.dataset.action;

    // Handle path link clicks
    const pathLink = e.target.closest('.inspector-path-link');
    if (pathLink) {
      e.preventDefault();
      const index = parseInt(pathLink.dataset.pathIndex, 10);
      const el = getPathElement(index);
      if (el) {
        this.selectElement(el);
      }
      return;
    }

    if (action === 'close') {
      this.deselectElement();
    } else if (action === 'copyInfo') {
      if (this._selectedElement) {
        copyInfoToClipboard(this._selectedElement, this._overrides)
          .then(() => flashFeedback(e.target, 'Copied!'))
          .catch(err => console.error('Copy failed:', err));
      }
    } else if (action === 'pick') {
      this._hidePanel();
      hideSelectionOverlay(this._selectionOverlay);
      this.enterInspectMode();
    } else if (action === 'apply') {
      saveOverrides(this._overrides);
      applyOverrides(this._overrides, this._styleElement);
      flashFeedback(e.target, 'Saved!');
    } else if (action === 'clear') {
      this._clearCurrentElementOverrides();
    } else if (action === 'exportCss') {
      exportCSS(this._overrides);
      flashFeedback(e.target, 'Copied!');
    } else if (action === 'export') {
      exportJSON(this._overrides);
    } else if (action === 'import') {
      importJSON().then(data => {
        this._overrides = data;
        saveOverrides(this._overrides);
        applyOverrides(this._overrides, this._styleElement);
        if (this._selectedElement) {
          this._updatePanel(this._selectedElement);
        }
        alert('Design overrides imported successfully!');
      }).catch(err => {
        alert('Failed to import: ' + err.message);
      });
    }

    // Section toggle
    const header = e.target.closest('.inspector-section-header');
    if (header) {
      const section = header.closest('.inspector-section');
      section.classList.toggle('collapsed');
      const icon = header.querySelector('.toggle-icon');
      icon.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
    }
  },

  _handlePanelInput(e) {
    const prop = e.target.dataset.prop;
    const scope = e.target.dataset.scope || 'global';
    if (!prop || !this._selectedElement) return;

    const value = e.target.value;
    const theme = getCurrentTheme();
    const selector = getElementSelector(this._selectedElement);

    if (!selector) return;

    // Store override
    this._overrides = storeOverride(this._overrides, selector, prop, value, scope, theme);

    // Live preview
    if (value) {
      this._selectedElement.style.setProperty(prop, value);
    } else {
      this._selectedElement.style.removeProperty(prop);
    }

    // Mark as overridden
    const row = e.target.closest('.inspector-prop-row, .inspector-quad-field, .inspector-grid-field');
    if (row) {
      row.classList.toggle('overridden', !!value);
    }
  },

  _clearCurrentElementOverrides() {
    if (!this._selectedElement) return;

    const theme = getCurrentTheme();
    const selector = getElementSelector(this._selectedElement);
    const { overrides, clearedProps } = clearElementOverrides(this._overrides, selector, theme);

    // Remove inline styles
    for (const prop of clearedProps) {
      this._selectedElement.style.removeProperty(prop);
    }

    this._overrides = overrides;
    saveOverrides(this._overrides);
    applyOverrides(this._overrides, this._styleElement);
    this._updatePanel(this._selectedElement);
  },

  // =========================================================================
  // Global Events
  // =========================================================================

  _bindGlobalEvents() {
    // Hover in inspect mode
    document.addEventListener('mousemove', (e) => {
      if (!this._inspectMode) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && !isInspectorElement(el)) {
        showHoverOverlay(this._hoverOverlay, el, this._selectedElement);
      }
    });

    // Click in inspect mode
    document.addEventListener('click', (e) => {
      if (!this._inspectMode) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        this.selectElement(el);
      }
    }, true);

    // Theme change listener
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          applyOverrides(this._overrides, this._styleElement);
          if (this._selectedElement) {
            this._updatePanel(this._selectedElement);
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    // Escape to exit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._inspectMode) {
          this.exitInspectMode();
        } else if (this._panel?.classList.contains('visible')) {
          this.deselectElement();
        }
      }
    });
  },

  // =========================================================================
  // Public API
  // =========================================================================

  getOverrides() {
    return this._overrides;
  },

  setOverrides(data) {
    this._overrides = data;
    saveOverrides(this._overrides);
    applyOverrides(this._overrides, this._styleElement);
  },

  clearAllOverrides() {
    this._overrides = createEmptyOverrides();
    saveOverrides(this._overrides);
    applyOverrides(this._overrides, this._styleElement);
  }
};

export default DesignInspector;
