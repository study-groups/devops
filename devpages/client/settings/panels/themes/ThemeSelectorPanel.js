/**
 * ThemeSelectorPanel.js - Theme, Scheme, and Variant Selection Panel
 * ✅ MODERNIZED: Enhanced Redux patterns with optimized selectors
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
// REMOVED: messageQueue import (file deleted)
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { getUIState, getSettingsState } from '/client/store/enhancedSelectors.js';

export class ThemeSelectorPanel extends BasePanel {
  constructor(options) {
    super(options);
    
    this.availableThemes = [];
    this.currentTheme = null;
    this.mdDir = null;
    
    this.themeSettings = {
      colorScheme: 'system',
      themeVariant: 'light',
      spacingDensity: 'normal',
      currentTheme: null,
    };
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'theme-selector-panel';
    this.element.innerHTML = this.renderConsolidatedInterface();
    return this.element;
  }

  async onMount(container) {
    super.onMount(container);
    this.loadCurrentSettings();
    await this.loadAvailableThemes();
    this.applyCurrentSettings();
    this.setupEventListeners();
  }
  
  onStateChange(state) {
      // ✅ MODERNIZED: Use enhanced selectors instead of direct state access
      const uiState = getUIState(state);
      const settingsState = getSettingsState(state);
      const designTokens = settingsState.designTokens || {};
      const newSettings = {
          colorScheme: uiState.colorScheme || 'system',
          themeVariant: designTokens.themeVariant || 'light',
          spacingDensity: designTokens.spacingVariant || 'normal',
          currentTheme: designTokens.activeTheme || 'system'
      };
      
      const themeSettingsChanged = (
          this.themeSettings.colorScheme !== newSettings.colorScheme ||
          this.themeSettings.themeVariant !== newSettings.themeVariant ||
          this.themeSettings.spacingDensity !== newSettings.spacingDensity ||
          this.themeSettings.currentTheme !== newSettings.currentTheme
      );
      
      if (themeSettingsChanged) {
          this.themeSettings = newSettings;
          this.applyCurrentSettings();
          this.element.innerHTML = this.renderConsolidatedInterface();
      }
  }

  loadCurrentSettings() {
    // ✅ MODERNIZED: Use enhanced selectors instead of direct state access
    const uiState = getUIState(appStore.getState());
    const settingsState = getSettingsState(appStore.getState());
    const designTokens = settingsState.designTokens || {};
    
    this.themeSettings.colorScheme = uiState.colorScheme || 'system';
    this.themeSettings.themeVariant = designTokens.themeVariant || 'light';
    this.themeSettings.spacingDensity = designTokens.spacingVariant || 'normal';
    this.themeSettings.currentTheme = designTokens.activeTheme || 'system';
  }

  async loadAvailableThemes() {
    try {
      const configResponse = await window.APP.services.globalFetch('/api/config');
      this.mdDir = 'unknown';
      if (configResponse.ok) {
        const config = await configResponse.json();
        this.mdDir = config.MD_DIR || 'unknown';
      }

      this.availableThemes = [...this.getDefaultThemes()];

      const response = await fetch(`/api/files/list?pathname=themes`, { credentials: 'include' });
      
      if (response.ok) {
        const data = await response.json();
        const themeOrder = ['basic', 'classic', 'arcade'];
        const userThemes = [];
        
        if (data.dirs) {
          for (const themeName of themeOrder) {
            if (data.dirs.includes(themeName)) {
              const themeInfo = await this.validateThemeDirectory(themeName);
              if (themeInfo) {
                themeInfo.type = 'user';
                userThemes.push(themeInfo);
              }
            }
          }
          
          for (const dirName of data.dirs) {
            if (!themeOrder.includes(dirName)) {
              const themeInfo = await this.validateThemeDirectory(dirName);
              if (themeInfo) {
                themeInfo.type = 'user';
                userThemes.push(themeInfo);
              }
            }
          }
          this.availableThemes.push(...userThemes);
        }
      }
    } catch (error) {
      console.warn('[ThemeSelector] Error loading themes:', error);
      this.availableThemes = this.getDefaultThemes();
    }
  }

  getDefaultThemes() {
    return [
      {
        id: 'system',
        name: 'System Default',
        description: 'Follow system theme preference',
        type: 'system'
      },
      {
        id: 'light',
        name: 'Light Theme',
        description: 'Clean light appearance',
        type: 'built-in'
      },
      {
        id: 'dark',
        name: 'Dark Theme',
        description: 'Dark appearance for low-light environments',
        type: 'built-in'
      }
    ];
  }

  async validateThemeDirectory(themeName) {
    try {
      const response = await fetch(`/api/files/list?pathname=themes/${themeName}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.files && data.files.some(f => f.endsWith('.css'))) {
          return {
            id: themeName,
            name: themeName.charAt(0).toUpperCase() + themeName.slice(1),
            description: `Custom ${themeName} theme`,
            type: 'user'
          };
        }
      }
    } catch (error) {
      console.warn(`Failed to validate theme directory ${themeName}:`, error);
    }
    return null;
  }

  renderConsolidatedInterface() {
    return `
      <div class="theme-config-section">
        <h3>Current Configuration</h3>
        <div class="current-config-grid">
          <label class="config-label">Color Scheme:</label>
          <div class="config-text">${this.themeSettings.colorScheme}</div>
          
          <label class="config-label">Theme Variant:</label>
          <div class="config-text">${this.themeSettings.themeVariant}</div>
          
          <label class="config-label">Spacing:</label>
          <div class="config-text">${this.themeSettings.spacingDensity}</div>
          
          <label class="config-label">Active Theme:</label>
          <div class="config-value">${this.themeSettings.currentTheme || 'system'}</div>
          
          <label class="config-label">MD Directory:</label>
          <div class="config-value">${this.mdDir || 'unknown'}</div>
        </div>
      </div>

      <div class="theme-selection-section">
        <h3>Available Themes</h3>
        <div class="theme-buttons-grid">
          ${this.renderThemeButtons()}
        </div>
      </div>

      <div class="theme-controls-section">
        <h3>Theme Controls</h3>
        <div class="theme-config-grid">
          <label for="color-scheme-select">Color Scheme:</label>
          <select id="color-scheme-select" class="form-control">
            <option value="system" ${this.themeSettings.colorScheme === 'system' ? 'selected' : ''}>System</option>
            <option value="light" ${this.themeSettings.colorScheme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.themeSettings.colorScheme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>

          <label for="theme-variant-select">Theme Variant:</label>
          <select id="theme-variant-select" class="form-control">
            <option value="light" ${this.themeSettings.themeVariant === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.themeSettings.themeVariant === 'dark' ? 'selected' : ''}>Dark</option>
          </select>

          <label for="spacing-density-select">Spacing Density:</label>
          <select id="spacing-density-select" class="form-control">
            <option value="compact" ${this.themeSettings.spacingDensity === 'compact' ? 'selected' : ''}>Compact</option>
            <option value="normal" ${this.themeSettings.spacingDensity === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="comfortable" ${this.themeSettings.spacingDensity === 'comfortable' ? 'selected' : ''}>Comfortable</option>
          </select>
        </div>
      </div>
    `;
  }

  renderThemeButtons() {
    if (!this.availableThemes.length) {
      return '<div class="no-dirs">No themes available</div>';
    }

    return this.availableThemes.map(theme => {
      const isActive = theme.id === this.themeSettings.currentTheme;
      return `
        <button class="btn btn-ghost btn-sm theme-dir-item ${isActive ? 'active' : ''}" 
                data-theme-id="${theme.id}"
                title="${theme.description}">
          <div class="theme-button-name">${theme.name}</div>
          <div class="theme-button-preview"></div>
          ${isActive ? '<div class="theme-active-indicator">✓</div>' : ''}
        </button>
      `;
    }).join('');
  }

  setupEventListeners() {
    if (!this.element) return;

    // Theme button clicks
    this.element.addEventListener('click', (e) => {
      const themeButton = e.target.closest('[data-theme-id]');
      if (themeButton) {
        const themeId = themeButton.dataset.themeId;
        this.selectTheme(themeId);
        return;
      }
    });

    // Control selects
    const colorSchemeSelect = this.element.querySelector('#color-scheme-select');
    const themeVariantSelect = this.element.querySelector('#theme-variant-select');
    const spacingDensitySelect = this.element.querySelector('#spacing-density-select');

    if (colorSchemeSelect) {
      colorSchemeSelect.addEventListener('change', (e) => {
        this.updateColorScheme(e.target.value);
      });
    }

    if (themeVariantSelect) {
      themeVariantSelect.addEventListener('change', (e) => {
        this.updateThemeVariant(e.target.value);
      });
    }

    if (spacingDensitySelect) {
      spacingDensitySelect.addEventListener('change', (e) => {
        this.updateSpacingDensity(e.target.value);
      });
    }
  }

  selectTheme(themeId) {
    appStore.dispatch({
      type: 'settings/updateDesignTokens',
      payload: { activeTheme: themeId }
    });
  }

  updateColorScheme(scheme) {
    appStore.dispatch({
      type: 'ui/setColorScheme',
      payload: scheme
    });
  }

  updateThemeVariant(variant) {
    appStore.dispatch({
      type: 'settings/updateDesignTokens',
      payload: { themeVariant: variant }
    });
  }

  updateSpacingDensity(density) {
    appStore.dispatch({
      type: 'settings/updateDesignTokens',
      payload: { spacingVariant: density }
    });
  }

  applyCurrentSettings() {
    // Apply theme settings to document
    const root = document.documentElement;
    
    // Apply color scheme
    root.setAttribute('data-color-scheme', this.themeSettings.colorScheme);
    
    // Apply theme variant
    root.setAttribute('data-theme-variant', this.themeSettings.themeVariant);
    
    // Apply spacing density
    root.setAttribute('data-spacing-density', this.themeSettings.spacingDensity);
    
    // Apply active theme
    if (this.themeSettings.currentTheme && this.themeSettings.currentTheme !== 'system') {
      root.setAttribute('data-active-theme', this.themeSettings.currentTheme);
    } else {
      root.removeAttribute('data-active-theme');
    }
  }
}
