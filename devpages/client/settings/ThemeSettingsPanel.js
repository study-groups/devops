/**
 * client/settings/ThemeSettingsPanel.js
 * Streamlined theme and design system settings panel
 * Integrates with the appState and reducer system
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from './panelRegistry.js';

function logThemeSettings(message, level = 'info') {
  const type = 'THEME_SETTINGS';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

export class ThemeSettingsPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.contentElement = null;
    this.stateUnsubscribe = null;
    this.systemThemeListener = null;
    this.handleSystemThemeChange = null;
    this.collapsedSections = this.loadCollapsedState();
    
    // Initialize the panel DOM first
    this.initializePanel();
    
    // Then subscribe to state changes
    this.subscribeToState();
    
    // Finally render with current state (now that DOM is ready)
    const initialState = appStore.getState();
    logThemeSettings(`Initial state on init: ${JSON.stringify(initialState.ui)}`, 'debug');
    this.render(initialState.ui);
    
    logThemeSettings('ThemeSettingsPanel initialized.');
  }

  loadCollapsedState() {
    try {
      const saved = localStorage.getItem('theme_subsection_collapsed_state');
      return saved ? JSON.parse(saved) : {
        'theme-controls': false,
        'design-system': true // Start collapsed by default
      };
    } catch (e) {
      return {
        'theme-controls': false,
        'design-system': true
      };
    }
  }

  saveCollapsedState() {
    try {
      localStorage.setItem('theme_subsection_collapsed_state', JSON.stringify(this.collapsedSections));
    } catch (e) {
      console.error('Failed to save collapsed state:', e);
    }
  }

  initializePanel() {
    // Create the content section within the container
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('theme-settings-content');
    
    // Add custom CSS
    this.loadCSS();
    
    this.containerElement.appendChild(contentDiv);
    this.contentElement = contentDiv;
    
    logThemeSettings('Panel DOM initialized.', 'debug');
  }

  loadCSS() {
    if (!document.getElementById('theme-settings-panel-css')) {
      const link = document.createElement('link');
      link.id = 'theme-settings-panel-css';
      link.rel = 'stylesheet';
      link.href = '/client/settings/ThemeSettingsPanel.css';
      document.head.appendChild(link);
    }
  }

  createCollapsibleSection(id, title, content, isCollapsed = false) {
    const collapsed = this.collapsedSections[id] || isCollapsed;
    const collapsedClass = collapsed ? 'collapsed' : '';
    const ariaExpanded = collapsed ? 'false' : 'true';
    const indicatorIcon = collapsed ? '&#9654;' : '&#9660;';

    return `
      <div class="theme-subsection ${collapsedClass}" data-section-id="${id}">
        <div class="theme-subsection-header" data-toggle="${id}" tabindex="0" role="button" aria-expanded="${ariaExpanded}">
          <span class="theme-collapse-indicator">${indicatorIcon}</span>
          <h5 class="theme-subsection-title">${title}</h5>
        </div>
        <div class="theme-subsection-content">
          ${content}
        </div>
      </div>
    `;
  }

  render(uiState) {
    if (!this.contentElement) {
      logThemeSettings('Render called but contentElement not ready', 'warn');
      return;
    }

    logThemeSettings(`Rendering with state: theme=${uiState.theme}, density=${uiState.designDensity}, colorScheme=${uiState.colorScheme}`, 'debug');

    // Render with simplified structure
    this.contentElement.innerHTML = `
      ${this.createCollapsibleSection('theme-controls', 'Theme Controls', this.renderThemeControls(uiState), false)}
      ${this.createCollapsibleSection('design-system', 'Design System', this.renderDesignSystem(), true)}
    `;

    this.attachEventListeners();

    // Setup system theme listener if needed
    if (uiState.theme === 'auto') {
      this.setupSystemThemeListener();
    }
  }

  renderThemeControls(uiState) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme = prefersDark ? 'dark' : 'light';
    const currentTheme = uiState.theme || 'light';
    const appliedTheme = currentTheme === 'auto' ? systemTheme : currentTheme;

    return `
      <div class="theme-control-grid">
        <div class="theme-control-group">
          <label class="theme-label">Theme</label>
          <select class="theme-select" data-action="theme-change">
            <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="auto" ${currentTheme === 'auto' ? 'selected' : ''}>Auto (System)</option>
          </select>
        </div>

        <div class="theme-control-group">
          <label class="theme-label">Density</label>
          <select class="theme-select" data-action="density-change">
            <option value="compact" ${uiState.designDensity === 'compact' ? 'selected' : ''}>Compact</option>
            <option value="comfortable" ${uiState.designDensity === 'comfortable' ? 'selected' : ''}>Comfortable</option>
            <option value="spacious" ${uiState.designDensity === 'spacious' ? 'selected' : ''}>Spacious</option>
          </select>
        </div>

        <div class="theme-control-group">
          <button class="theme-toggle-btn" data-action="theme-toggle">
            <span class="theme-toggle-icon">${appliedTheme === 'dark' ? '☀️' : '🌙'}</span>
            <span class="theme-toggle-text">
              ${appliedTheme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </span>
          </button>
        </div>
      </div>

      <div class="theme-status-display">
        <div class="theme-status-item">
          <span class="status-label">System:</span>
          <span class="status-value status-value--${systemTheme}">${systemTheme}</span>
        </div>
        <div class="theme-status-item">
          <span class="status-label">Current:</span>
          <span class="status-value status-value--${currentTheme}">${currentTheme}</span>
        </div>
        <div class="theme-status-item">
          <span class="status-label">Applied:</span>
          <span class="status-value status-value--${appliedTheme}">${appliedTheme}</span>
        </div>
      </div>
    `;
  }

  renderColorPalette() {
    const colorCategories = [
      {
        name: 'Semantic Colors',
        colors: [
          { name: 'Background', var: '--color-background' },
          { name: 'Background Elevated', var: '--color-background-elevated' },
          { name: 'Background Secondary', var: '--color-background-secondary' },
          { name: 'Foreground', var: '--color-foreground' },
          { name: 'Foreground Secondary', var: '--color-foreground-secondary' },
          { name: 'Foreground Muted', var: '--color-foreground-muted' },
          { name: 'Border', var: '--color-border' },
          { name: 'Primary', var: '--color-primary' },
          { name: 'Primary Hover', var: '--color-primary-hover' },
          { name: 'Success', var: '--color-success' },
          { name: 'Warning', var: '--color-warning' },
          { name: 'Error', var: '--color-error' },
          { name: 'Info', var: '--color-info' }
        ]
      },
      {
        name: 'Base Palette',
        colors: [
          { name: 'Gray 50', var: '--color-gray-50' },
          { name: 'Gray 100', var: '--color-gray-100' },
          { name: 'Gray 200', var: '--color-gray-200' },
          { name: 'Gray 300', var: '--color-gray-300' },
          { name: 'Gray 400', var: '--color-gray-400' },
          { name: 'Gray 500', var: '--color-gray-500' },
          { name: 'Gray 600', var: '--color-gray-600' },
          { name: 'Gray 700', var: '--color-gray-700' },
          { name: 'Gray 800', var: '--color-gray-800' },
          { name: 'Gray 900', var: '--color-gray-900' },
          { name: 'Gray 950', var: '--color-gray-950' }
        ]
      },
      {
        name: 'Accent Colors',
        colors: [
          { name: 'Blue 300', var: '--color-blue-300' },
          { name: 'Blue 500', var: '--color-blue-500' },
          { name: 'Blue 600', var: '--color-blue-600' },
          { name: 'Blue 700', var: '--color-blue-700' },
          { name: 'Green 500', var: '--color-green-500' },
          { name: 'Green 600', var: '--color-green-600' },
          { name: 'Red 500', var: '--color-red-500' },
          { name: 'Red 600', var: '--color-red-600' },
          { name: 'Yellow 500', var: '--color-yellow-500' }
        ]
      }
    ];

    return colorCategories.map(category => `
      <div class="color-category">
        <h6 class="color-category-title">${category.name}</h6>
        <div class="color-grid">
          ${category.colors.map(color => `
            <div class="color-item" data-var="${color.var}">
              <div class="color-swatch" style="background-color: var(${color.var})"></div>
              <div class="color-info">
                <div class="color-name">${color.name}</div>
                <div class="color-var">${color.var}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  renderDesignSystem() {
    return `
      <div class="design-system-tabs">
        <div class="design-system-content">
          <div class="design-section">
            <h6 class="design-section-title">Color Palette</h6>
            ${this.renderColorPalette()}
          </div>
          <div class="design-section">
            <h6 class="design-section-title">Design Tokens</h6>
            ${this.renderDesignTokens()}
          </div>
        </div>
      </div>
    `;
  }

  renderDesignTokens() {
    const tokenCategories = [
      {
        name: 'Typography',
        tokens: [
          { name: 'Header Font', var: '--font-family-header' },
          { name: 'Text Font', var: '--font-family-text' },
          { name: 'Code Font', var: '--font-family-code' },
          { name: 'Font Size Base', var: '--font-size-base' },
          { name: 'Font Size Small', var: '--font-size-sm' },
          { name: 'Font Size Large', var: '--font-size-lg' },
          { name: 'Line Height Normal', var: '--line-height-normal' }
        ]
      },
      {
        name: 'Spacing',
        tokens: [
          { name: 'Space 1', var: '--space-1' },
          { name: 'Space 2', var: '--space-2' },
          { name: 'Space 4', var: '--space-4' },
          { name: 'Space 6', var: '--space-6' },
          { name: 'Space 8', var: '--space-8' },
          { name: 'Density Space MD', var: '--density-space-md' }
        ]
      },
      {
        name: 'Border & Effects',
        tokens: [
          { name: 'Radius Base', var: '--radius-base' },
          { name: 'Radius MD', var: '--radius-md' },
          { name: 'Radius LG', var: '--radius-lg' },
          { name: 'Shadow SM', var: '--shadow-sm' },
          { name: 'Shadow MD', var: '--shadow-md' },
          { name: 'Shadow LG', var: '--shadow-lg' }
        ]
      }
    ];

    return tokenCategories.map(category => `
      <div class="token-category">
        <h6 class="token-category-title">${category.name}</h6>
        <div class="token-list">
          ${category.tokens.map(token => `
            <div class="token-item" data-var="${token.var}">
              <div class="token-name">${token.name}</div>
              <div class="token-var">${token.var}</div>
              <div class="token-value" data-computed-value="${token.var}">
                <span class="token-value-text">Loading...</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  toggleSubsection(sectionId) {
    const section = this.contentElement.querySelector(`[data-section-id="${sectionId}"]`);
    const header = this.contentElement.querySelector(`[data-toggle="${sectionId}"]`);
    const indicator = header.querySelector('.theme-collapse-indicator');
    
    if (!section || !header || !indicator) return;

    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
      section.classList.remove('collapsed');
      header.setAttribute('aria-expanded', 'true');
      indicator.innerHTML = '&#9660;'; // Down arrow (expanded)
      this.collapsedSections[sectionId] = false;
    } else {
      section.classList.add('collapsed');
      header.setAttribute('aria-expanded', 'false');
      indicator.innerHTML = '&#9654;'; // Right arrow (collapsed)
      this.collapsedSections[sectionId] = true;
    }
    
    this.saveCollapsedState();
  }

  attachEventListeners() {
    // Remove existing listeners to prevent duplicates
    const oldHandler = this.contentElement._themeEventHandler;
    if (oldHandler) {
      this.contentElement.removeEventListener('click', oldHandler);
      this.contentElement.removeEventListener('change', oldHandler.changeHandler);
      this.contentElement.removeEventListener('keypress', oldHandler.keyHandler);
    }

    const clickHandler = (e) => {
      const action = e.target.dataset.action;
      const toggle = e.target.dataset.toggle || e.target.closest('[data-toggle]')?.dataset.toggle;
      const varName = e.target.closest('[data-var]')?.dataset.var;

      if (toggle) {
        e.preventDefault();
        this.toggleSubsection(toggle);
        return;
      }

      // Handle copying CSS variables
      if (varName && (e.target.closest('.color-item') || e.target.closest('.token-item'))) {
        this.copyToClipboard(varName);
        return;
      }

      switch (action) {
        case 'theme-toggle':
          this.handleThemeToggle();
          break;
      }
    };

    const changeHandler = (e) => {
      const action = e.target.dataset.action;
      
      switch (action) {
        case 'theme-change':
          this.handleThemeChange(e.target.value);
          break;
        case 'density-change':
          this.handleDensityChange(e.target.value);
          break;
      }
    };

    const keyHandler = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.toggle) {
        e.preventDefault();
        this.toggleSubsection(e.target.dataset.toggle);
      }
    };

    this.contentElement.addEventListener('click', clickHandler);
    this.contentElement.addEventListener('change', changeHandler);
    this.contentElement.addEventListener('keypress', keyHandler);

    // Store handlers for cleanup
    this.contentElement._themeEventHandler = clickHandler;
    this.contentElement._themeEventHandler.changeHandler = changeHandler;
    this.contentElement._themeEventHandler.keyHandler = keyHandler;

    // Update computed values for design tokens
    this.updateComputedValues();
  }

  copyToClipboard(varName) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(`var(${varName})`).then(() => {
        logThemeSettings(`Copied ${varName} to clipboard`);
        this.showCopyFeedback(varName);
      }).catch(err => {
        console.warn('Failed to copy to clipboard:', err);
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = `var(${varName})`;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        logThemeSettings(`Copied ${varName} to clipboard`);
        this.showCopyFeedback(varName);
      } catch (err) {
        console.warn('Failed to copy to clipboard:', err);
      }
      document.body.removeChild(textArea);
    }
  }

  showCopyFeedback(varName) {
    // Find the element that was clicked
    const element = this.contentElement.querySelector(`[data-var="${varName}"]`);
    if (!element) return;

    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = 'Copied!';
    feedback.style.cssText = `
      position: absolute;
      top: -2px;
      right: -2px;
      background: var(--color-success);
      color: white;
      font-size: var(--font-size-xs);
      padding: var(--space-0-5) var(--space-1);
      border-radius: var(--radius-sm);
      pointer-events: none;
      z-index: 100;
    `;

    element.style.position = 'relative';
    element.appendChild(feedback);

    // Remove feedback after animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }

  updateComputedValues() {
    // Update computed CSS values for design tokens
    const tokenItems = this.contentElement.querySelectorAll('.token-item[data-var]');
    tokenItems.forEach(item => {
      const varName = item.dataset.var;
      const valueElement = item.querySelector('.token-value-text');
      
      if (valueElement) {
        const computedValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        valueElement.textContent = computedValue || 'undefined';
      }
    });
  }

  subscribeToState() {
    this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
      // Only re-render if UI state changed
      if (newState.ui !== prevState.ui) {
        logThemeSettings(`State changed, re-rendering: ${JSON.stringify(newState.ui)}`, 'debug');
        this.render(newState.ui);
      }
    });
  }

  // Event Handlers - These dispatch to the reducer
  handleThemeChange(theme) {
    logThemeSettings(`Theme changed to: ${theme}`);
    dispatch({
      type: ActionTypes.UI_SET_THEME,
      payload: theme
    });
  }

  handleDensityChange(density) {
    logThemeSettings(`Design density changed to: ${density}`);
    dispatch({
      type: ActionTypes.UI_SET_DESIGN_DENSITY,
      payload: density
    });
  }

  handleThemeToggle() {
    const currentTheme = appStore.getState().ui.theme;
    logThemeSettings(`Theme toggle clicked, current theme: ${currentTheme}`);
    dispatch({
      type: ActionTypes.UI_TOGGLE_THEME
    });
  }

  // System theme listener setup
  setupSystemThemeListener() {
    // Clean up existing listener
    if (this.systemThemeListener && this.handleSystemThemeChange) {
      this.systemThemeListener.removeEventListener('change', this.handleSystemThemeChange);
    }
    
    this.systemThemeListener = window.matchMedia('(prefers-color-scheme: dark)');
    this.handleSystemThemeChange = (e) => {
      const currentTheme = appStore.getState().ui.theme;
      if (currentTheme === 'auto') {
        // Trigger a re-render to update the status display
        this.render(appStore.getState().ui);
        logThemeSettings(`System theme changed: ${e.matches ? 'dark' : 'light'}`);
      }
    };
    
    this.systemThemeListener.addEventListener('change', this.handleSystemThemeChange);
  }

  destroy() {
    logThemeSettings('Destroying ThemeSettingsPanel...');
    
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
    
    if (this.systemThemeListener && this.handleSystemThemeChange) {
      this.systemThemeListener.removeEventListener('change', this.handleSystemThemeChange);
      this.systemThemeListener = null;
      this.handleSystemThemeChange = null;
    }
    
    // Clean up event listeners
    const oldHandler = this.contentElement._themeEventHandler;
    if (oldHandler) {
      this.contentElement.removeEventListener('click', oldHandler);
      this.contentElement.removeEventListener('change', oldHandler.changeHandler);
      this.contentElement.removeEventListener('keypress', oldHandler.keyHandler);
    }
    
    if (this.contentElement && this.contentElement.parentNode) {
      this.contentElement.parentNode.removeChild(this.contentElement);
    }
    
    this.contentElement = null;
    this.containerElement = null;
    
    logThemeSettings('ThemeSettingsPanel destroyed.');
  }
}

// Register this panel with the registry
panelRegistry.register({
  id: 'theme-settings-container',
  title: 'Theme & Design',
  component: ThemeSettingsPanel,
  order: 10, // First panel (lowest order)
  defaultCollapsed: false // Keep expanded by default for better UX
}); 