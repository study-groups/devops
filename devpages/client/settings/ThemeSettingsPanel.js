/**
 * client/settings/ThemeSettingsPanel.js
 * Theme and design system settings panel
 * Integrates with the appState and reducer system
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

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

  initializePanel() {
    // Create the content section within the container
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('settings-section-content');
    
    // Theme Selection
    const themeGroup = this.createFormGroup('Theme', 'theme-select');
    const themeSelect = this.createSelect('theme-select', [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'auto', label: 'Auto (System)' }
    ]);
    themeSelect.addEventListener('change', (e) => {
      this.handleThemeChange(e.target.value);
    });
    themeGroup.appendChild(themeSelect);
    
    // Design Density
    const densityGroup = this.createFormGroup('Design Density', 'density-select');
    const densitySelect = this.createSelect('density-select', [
      { value: 'compact', label: 'Compact' },
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'spacious', label: 'Spacious' }
    ]);
    densitySelect.addEventListener('change', (e) => {
      this.handleDensityChange(e.target.value);
    });
    densityGroup.appendChild(densitySelect);
    
    // Theme Toggle Button
    const toggleGroup = this.createFormGroup('Quick Toggle', 'theme-toggle');
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.classList.add('settings-button', 'settings-button--secondary');
    toggleButton.innerHTML = `
      <span class="theme-toggle-icon">🌓</span>
      <span class="theme-toggle-text">Toggle Theme</span>
    `;
    toggleButton.addEventListener('click', () => {
      this.handleThemeToggle();
    });
    toggleGroup.appendChild(toggleButton);
    
    // Color Scheme (for advanced users)
    const colorSchemeGroup = this.createFormGroup('Color Scheme (Advanced)', 'color-scheme-select');
    const colorSchemeSelect = this.createSelect('color-scheme-select', [
      { value: 'system', label: 'Follow System' },
      { value: 'light', label: 'Force Light' },
      { value: 'dark', label: 'Force Dark' }
    ]);
    colorSchemeSelect.addEventListener('change', (e) => {
      this.handleColorSchemeChange(e.target.value);
    });
    colorSchemeGroup.appendChild(colorSchemeSelect);
    
    // Theme Preview
    const previewGroup = this.createFormGroup('Theme Preview', 'theme-preview');
    const previewCard = document.createElement('div');
    previewCard.classList.add('theme-preview-card');
    previewCard.innerHTML = `
      <div class="theme-preview-header">
        <h4>Preview</h4>
        <button class="btn btn--primary">Primary Button</button>
      </div>
      <div class="theme-preview-body">
        <p class="text-base">This is how your theme will look.</p>
        <p class="text-muted">Muted text for secondary information.</p>
        <div class="theme-preview-controls">
          <input type="text" class="input" placeholder="Input field example" />
          <button class="btn btn--secondary">Secondary</button>
        </div>
      </div>
    `;
    previewGroup.appendChild(previewCard);
    
    // System Theme Status
    const statusGroup = this.createFormGroup('System Theme', 'system-theme-status');
    const statusDiv = document.createElement('div');
    statusDiv.id = 'system-theme-status';
    statusDiv.classList.add('theme-status-display');
    statusGroup.appendChild(statusDiv);
    
    // Assemble content
    contentDiv.appendChild(themeGroup);
    contentDiv.appendChild(this.createDivider());
    contentDiv.appendChild(densityGroup);
    contentDiv.appendChild(this.createDivider());
    contentDiv.appendChild(toggleGroup);
    contentDiv.appendChild(this.createDivider());
    contentDiv.appendChild(colorSchemeGroup);
    contentDiv.appendChild(this.createDivider());
    contentDiv.appendChild(statusGroup);
    contentDiv.appendChild(this.createDivider());
    contentDiv.appendChild(previewGroup);
    
    this.containerElement.appendChild(contentDiv);
    this.contentElement = contentDiv;
    
    logThemeSettings('Panel DOM initialized.', 'debug');
  }

  createFormGroup(label, inputId) {
    const group = document.createElement('div');
    group.classList.add('settings-form-group');
    
    const labelElement = document.createElement('label');
    labelElement.classList.add('settings-label');
    labelElement.textContent = label;
    labelElement.setAttribute('for', inputId);
    
    group.appendChild(labelElement);
    return group;
  }

  createSelect(id, options) {
    const select = document.createElement('select');
    select.id = id;
    select.classList.add('settings-input', 'settings-select');
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      select.appendChild(optionElement);
    });
    
    return select;
  }

  createDivider() {
    const divider = document.createElement('hr');
    divider.classList.add('settings-divider');
    return divider;
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

  render(uiState) {
    if (!this.contentElement) {
      logThemeSettings('Render called but contentElement not ready', 'warn');
      return;
    }

    logThemeSettings(`Rendering with state: theme=${uiState.theme}, density=${uiState.designDensity}, colorScheme=${uiState.colorScheme}`, 'debug');

    // Update select values to match current state
    const themeSelect = this.contentElement.querySelector('#theme-select');
    const densitySelect = this.contentElement.querySelector('#density-select');
    const colorSchemeSelect = this.contentElement.querySelector('#color-scheme-select');
    const toggleButton = this.contentElement.querySelector('.settings-button');
    const systemStatus = this.contentElement.querySelector('#system-theme-status');
    
    if (themeSelect) {
      themeSelect.value = uiState.theme || 'light';
      logThemeSettings(`Set theme select to: ${themeSelect.value}`, 'debug');
    } else {
      logThemeSettings('Theme select element not found', 'warn');
    }
    
    if (densitySelect) {
      densitySelect.value = uiState.designDensity || 'comfortable';
      logThemeSettings(`Set density select to: ${densitySelect.value}`, 'debug');
    } else {
      logThemeSettings('Density select element not found', 'warn');
    }
    
    if (colorSchemeSelect) {
      colorSchemeSelect.value = uiState.colorScheme || 'system';
      logThemeSettings(`Set color scheme select to: ${colorSchemeSelect.value}`, 'debug');
    } else {
      logThemeSettings('Color scheme select element not found', 'warn');
    }
    
    if (toggleButton) {
      const icon = toggleButton.querySelector('.theme-toggle-icon');
      const text = toggleButton.querySelector('.theme-toggle-text');
      
      if (uiState.theme === 'dark') {
        icon.textContent = '☀️';
        text.textContent = 'Switch to Light';
      } else if (uiState.theme === 'light') {
        icon.textContent = '🌙';
        text.textContent = 'Switch to Dark';
      } else {
        icon.textContent = '🌓';
        text.textContent = 'Toggle Theme';
      }
      logThemeSettings(`Updated toggle button for theme: ${uiState.theme}`, 'debug');
    } else {
      logThemeSettings('Toggle button element not found', 'warn');
    }

    // Update system theme status display
    if (systemStatus) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'dark' : 'light';
      const currentTheme = uiState.theme || 'light';
      
      systemStatus.innerHTML = `
        <div class="theme-status-item">
          <span class="status-label">System Preference:</span>
          <span class="status-value status-value--${systemTheme}">${systemTheme}</span>
        </div>
        <div class="theme-status-item">
          <span class="status-label">Current Theme:</span>
          <span class="status-value status-value--${currentTheme}">${currentTheme}</span>
        </div>
        <div class="theme-status-item">
          <span class="status-label">Applied Theme:</span>
          <span class="status-value status-value--${currentTheme === 'auto' ? systemTheme : currentTheme}">
            ${currentTheme === 'auto' ? systemTheme : currentTheme}
          </span>
        </div>
      `;
    }

    // Ensure system theme listener is set up for auto theme
    if (uiState.theme === 'auto') {
      this.setupSystemThemeListener();
    }
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

  handleColorSchemeChange(colorScheme) {
    logThemeSettings(`Color scheme changed to: ${colorScheme}`);
    dispatch({
      type: ActionTypes.UI_SET_COLOR_SCHEME,
      payload: colorScheme
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
    
    if (this.contentElement && this.contentElement.parentNode) {
      this.contentElement.parentNode.removeChild(this.contentElement);
    }
    
    this.contentElement = null;
    this.containerElement = null;
    
    logThemeSettings('ThemeSettingsPanel destroyed.');
  }
} 