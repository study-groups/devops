/**
 * ThemeSelectorPanel.js - Theme, Scheme, and Variant Selection Panel
 * Handles theme selection, color scheme preference, and variant/density settings
 * Distinguishes between system CSS and theme CSS (from MD_DIR/themes)
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

class ThemeSelectorPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    
    // Theme state
    this.availableThemes = [];
    this.currentTheme = null;
    this.themeFiles = new Map();
    this.mdDir = null; // Will be fetched from server
    
    // Theme settings
    this.themeSettings = {
      colorScheme: 'system',     // system, light, dark
      themeVariant: 'light',     // light, dark
      spacingDensity: 'normal',  // tight, normal, comfortable
      currentTheme: null         // selected theme
    };
    
    this.init();
  }

  async init() {
    // Load panel-specific styles
    this.loadPanelStyles();
    
    // Load current settings from store
    this.loadCurrentSettings();
    
    // Load available themes from themes directory
    await this.loadAvailableThemes();
    
    // Apply current settings to document
    this.applyCurrentSettings();
    
    // Render the panel
    this.render();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to store changes
    this.storeUnsubscribe = appStore.subscribe(() => {
      this.handleStoreUpdate();
    });
  }

  /**
   * Load panel-specific styles
   */
  loadPanelStyles() {
    if (!document.getElementById('theme-selector-panel-styles')) {
      const link = document.createElement('link');
      link.id = 'theme-selector-panel-styles';
      link.rel = 'stylesheet';
      link.href = '/client/settings/panels/themes/ThemeSelectorPanel.css';
      document.head.appendChild(link);
      console.log('[ThemeSelector] Loaded panel styles');
    }
  }

  /**
   * Load current settings from the store
   */
  loadCurrentSettings() {
    const state = appStore.getState();
    this.themeSettings = {
      colorScheme: state.ui?.colorScheme || 'system',
      themeVariant: state.settings?.designTokens?.themeVariant || 'light',
      spacingDensity: state.settings?.designTokens?.spacingVariant || 'normal',
      currentTheme: state.settings?.designTokens?.activeTheme || null
    };
    console.log(`[ThemeSelector] Loaded settings:`, this.themeSettings);
  }

  /**
   * Load available themes from themes directory
   */
  async loadAvailableThemes() {
    
    try {
      // Get MD_DIR from config
      const configResponse = await fetch('/api/config');
      this.mdDir = 'unknown';
      if (configResponse.ok) {
        const config = await configResponse.json();
        this.mdDir = config.MD_DIR || 'unknown';
      }

      // Check if themes directory exists in MD_DIR
      const response = await fetch(`/api/files/list?pathname=themes`);
      this.themeDirs = [];
      
      if (response.ok) {
        const data = await response.json();
        
        // Store all directories found in themes/ (dirs is the array of directory names)
        this.themeDirs = data.dirs || [];
        
        // Filter for directories that contain theme files
        this.availableThemes = [];
        if (data.dirs) {
          for (const dirName of data.dirs) {
            const themeInfo = await this.validateThemeDirectory(dirName);
            if (themeInfo) {
              this.availableThemes.push(themeInfo);
            }
          }
        }
        
        console.log(`[ThemeSelector] Found ${this.availableThemes.length} themes in themes directory`);
      } else {
        console.log('[ThemeSelector] No themes directory found, using defaults');
        this.availableThemes = this.getDefaultThemes();
      }
    } catch (error) {
      console.warn('[ThemeSelector] Error loading themes:', error);
      this.availableThemes = this.getDefaultThemes();
    }
  }

  /**
   * Validate that a directory contains proper theme files
   */
  async validateThemeDirectory(themeName) {
    try {
      const response = await fetch(`/api/files/list?pathname=themes/${themeName}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const fileNames = data.files || [];
      
      // Check for expected theme structure: {core,light,dark}.css
      const hasCore = fileNames.includes('core.css');
      const hasLight = fileNames.includes('light.css');
      const hasDark = fileNames.includes('dark.css');
      
      // Require all three files for proper theme
      if (hasCore && hasLight && hasDark) {
        return {
          id: themeName,
          name: this.formatThemeName(themeName),
          path: `themes/${themeName}`,
          type: 'theme',
          structure: 'core+light+dark',
          files: ['core.css', 'light.css', 'dark.css'].filter(f => fileNames.includes(f))
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`[ThemeSelector] Error validating theme ${themeName}:`, error);
      return null;
    }
  }

  /**
   * Format theme names for display
   */
  formatThemeName(themeName) {
    return themeName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get default themes when no themes directory exists
   */
  getDefaultThemes() {
    return [];
  }

  /**
   * Handle store updates
   */
  handleStoreUpdate() {
    const prevSettings = { ...this.themeSettings };
    this.loadCurrentSettings();
    
    // Re-render if settings changed
    if (JSON.stringify(prevSettings) !== JSON.stringify(this.themeSettings)) {
      this.render();
    }
  }

  /**
   * Render the panel
   */
  render() {
    this.containerElement.innerHTML = `
      <div class="theme-selector-panel">
        <!-- Directory Information -->
        <div class="theme-section">
          <h3 class="theme-section-title">Directory Information</h3>
          <div class="theme-section-content">
            ${this.renderDirectoryInfo()}
          </div>
        </div>

        <!-- Theme Selection Section -->
        <div class="theme-section">
          <h3 class="theme-section-title">Theme Selection</h3>
          <div class="theme-section-content">
            ${this.renderThemeSelection()}
          </div>
        </div>

        <!-- Appearance Settings Section -->
        <div class="theme-section">
          <h3 class="theme-section-title">Appearance Settings</h3>
          <div class="theme-section-content">
            ${this.renderAppearanceSettings()}
          </div>
        </div>

        <!-- Current Configuration Display -->
        <div class="theme-section">
          <h3 class="theme-section-title">Current Configuration</h3>
          <div class="theme-section-content">
            ${this.renderCurrentConfiguration()}
          </div>
        </div>
      </div>
    `;
    
    // Re-setup event listeners after render
    this.setupEventListeners();
  }

  /**
   * Render directory information
   */
  renderDirectoryInfo() {
    return `
      <div class="directory-info">
        <div class="info-row">
          <strong>MD_DIR:</strong> <code>${this.mdDir || 'unknown'}</code>
        </div>
        <div class="info-row">
          <strong>Themes Path:</strong> <code>${this.mdDir}/themes</code>
        </div>
        <div class="info-row">
          <strong>Theme Directories:</strong>
          ${this.themeDirs && this.themeDirs.length > 0 ? 
            `<div class="theme-dirs-list">
              ${this.themeDirs.map(dir => `<span class="theme-dir-item">${dir}</span>`).join(' ')}
            </div>` :
            '<span class="no-dirs">No directories found in themes/</span>'
          }
        </div>
      </div>
    `;
  }

  /**
   * Render theme selection dropdown
   */
  renderThemeSelection() {
    if (this.availableThemes.length === 0) {
      return `
        <div class="theme-empty-state">
          <p>No themes found</p>
          <small>Themes should be located in <code>themes/</code> directory</small>
          <small>Each theme directory should contain <code>core.css</code>, <code>light.css</code>, and <code>dark.css</code> files</small>
        </div>
      `;
    }

    console.log(`[ThemeSelector] Rendering dropdown. Current theme: ${this.themeSettings.currentTheme}`);
    console.log(`[ThemeSelector] Available themes:`, this.availableThemes.map(t => t.id));

    return `
      <div class="theme-dropdown-container">
        <label for="theme-select" class="theme-label">Select Theme:</label>
        <select id="theme-select" class="theme-dropdown">
          <option value="" ${!this.themeSettings.currentTheme ? 'selected' : ''}>-- Select a theme --</option>
          ${this.availableThemes.map(theme => `
            <option value="${theme.id}" ${theme.id === this.themeSettings.currentTheme ? 'selected' : ''}>
              ${theme.name} (${theme.structure})
            </option>
          `).join('')}
        </select>
        <div class="theme-info-display">
          ${this.renderCurrentThemeInfo()}
        </div>
      </div>
    `;
  }

  /**
   * Render current theme info
   */
  renderCurrentThemeInfo() {
    const currentTheme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
    if (!currentTheme) return '';

    return `
      <div class="current-theme-info">
        <div class="theme-detail">
          <strong>Path:</strong> <code>${currentTheme.path}</code>
        </div>
        <div class="theme-detail">
          <strong>Files:</strong> ${currentTheme.files.join(', ')}
        </div>
      </div>
    `;
  }

  /**
   * Render appearance settings
   */
  renderAppearanceSettings() {
    return `
      <div class="appearance-settings">
        <!-- Color Scheme Selection -->
        <div class="setting-group">
          <label class="setting-label">Color Scheme Preference</label>
          <div class="setting-options">
            <label class="setting-option ${this.themeSettings.colorScheme === 'system' ? 'active' : ''}">
              <input type="radio" name="colorScheme" value="system" ${this.themeSettings.colorScheme === 'system' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">System</span>
                <span class="option-desc">Follow system preference</span>
              </span>
            </label>
            <label class="setting-option ${this.themeSettings.colorScheme === 'light' ? 'active' : ''}">
              <input type="radio" name="colorScheme" value="light" ${this.themeSettings.colorScheme === 'light' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Light</span>
                <span class="option-desc">Always use light mode</span>
              </span>
            </label>
            <label class="setting-option ${this.themeSettings.colorScheme === 'dark' ? 'active' : ''}">
              <input type="radio" name="colorScheme" value="dark" ${this.themeSettings.colorScheme === 'dark' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Dark</span>
                <span class="option-desc">Always use dark mode</span>
              </span>
            </label>
          </div>
        </div>

        <!-- Theme Variant Selection -->
        <div class="setting-group">
          <label class="setting-label">Theme Variant</label>
          <div class="setting-options">
            <label class="setting-option ${this.themeSettings.themeVariant === 'light' ? 'active' : ''}">
              <input type="radio" name="themeVariant" value="light" ${this.themeSettings.themeVariant === 'light' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Light Variant</span>
              </span>
            </label>
            <label class="setting-option ${this.themeSettings.themeVariant === 'dark' ? 'active' : ''}">
              <input type="radio" name="themeVariant" value="dark" ${this.themeSettings.themeVariant === 'dark' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Dark Variant</span>
              </span>
            </label>
          </div>
        </div>

        <!-- Spacing Density Selection -->
        <div class="setting-group">
          <label class="setting-label">Spacing Density</label>
          <div class="setting-options">
            <label class="setting-option ${this.themeSettings.spacingDensity === 'tight' ? 'active' : ''}">
              <input type="radio" name="spacingDensity" value="tight" ${this.themeSettings.spacingDensity === 'tight' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Tight</span>
                <span class="option-desc">Compact spacing</span>
              </span>
            </label>
            <label class="setting-option ${this.themeSettings.spacingDensity === 'normal' ? 'active' : ''}">
              <input type="radio" name="spacingDensity" value="normal" ${this.themeSettings.spacingDensity === 'normal' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Normal</span>
                <span class="option-desc">Standard spacing</span>
              </span>
            </label>
            <label class="setting-option ${this.themeSettings.spacingDensity === 'comfortable' ? 'active' : ''}">
              <input type="radio" name="spacingDensity" value="comfortable" ${this.themeSettings.spacingDensity === 'comfortable' ? 'checked' : ''}>
              <span class="option-content">
                <span class="option-text">Comfortable</span>
                <span class="option-desc">Generous spacing</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render current configuration display
   */
  renderCurrentConfiguration() {
    const currentTheme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
    
    return `
      <div class="current-config">
        <div class="config-row">
          <span class="config-label">Active Theme:</span>
          <span class="config-value config-value-theme">${currentTheme ? currentTheme.name : 'System Default'}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Color Scheme:</span>
          <span class="config-value config-value-scheme">${this.themeSettings.colorScheme}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Variant:</span>
          <span class="config-value config-value-variant">${this.themeSettings.themeVariant}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Density:</span>
          <span class="config-value config-value-density">${this.themeSettings.spacingDensity}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Themes Location:</span>
          <span class="config-value theme-path">${this.mdDir}/themes</span>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Remove existing listeners to prevent duplicates
    if (this.changeHandler) {
      this.containerElement.removeEventListener('change', this.changeHandler);
    }
    
    // Create new change handler
    this.changeHandler = (e) => {
      console.log(`[ThemeSelector] Change event:`, e.target.id, e.target.name, e.target.value);
      
      if (e.target.id === 'theme-select') {
        this.selectTheme(e.target.value);
      } else if (e.target.name === 'colorScheme') {
        this.updateColorScheme(e.target.value);
      } else if (e.target.name === 'themeVariant') {
        this.updateThemeVariant(e.target.value);
      } else if (e.target.name === 'spacingDensity') {
        this.updateSpacingDensity(e.target.value);
      }
    };
    
    // Add the new listener
    this.containerElement.addEventListener('change', this.changeHandler);
  }

  /**
   * Select a theme
   */
  selectTheme(themeId) {
    console.log(`[ThemeSelector] Selecting theme: ${themeId}`);
    console.log(`[ThemeSelector] Previous theme: ${this.themeSettings.currentTheme}`);
    
    // Don't do anything if selecting empty option
    if (!themeId) {
      console.log(`[ThemeSelector] Empty theme selected, ignoring`);
      return;
    }
    
    dispatch({
      type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
      payload: themeId
    });

    // Apply the theme
    const theme = this.availableThemes.find(t => t.id === themeId);
    if (theme) {
      console.log(`[ThemeSelector] Found theme to apply:`, theme);
      this.applyTheme(theme);
    } else {
      console.warn(`[ThemeSelector] Theme not found: ${themeId}`);
    }

    // Update settings and re-render
    this.loadCurrentSettings();
    this.render();
  }

  /**
   * Apply a theme
   */
  async applyTheme(theme) {
    try {
      // Remove existing theme stylesheets
      const existingThemeLinks = document.querySelectorAll('style[data-theme]');
      existingThemeLinks.forEach(link => link.remove());

      if (theme.type === 'system') {
        console.log('[ThemeSelector] Applied system default theme');
        return;
      }

      // Load theme files - always load core, light, and dark for our structure
      if (theme.structure === 'core+light+dark') {
        // Load core.css first
        await this.loadThemeStylesheet(`${theme.path}/core.css`, 'theme-core');
        // Load the appropriate variant (light or dark)
        await this.loadThemeStylesheet(`${theme.path}/${this.themeSettings.themeVariant}.css`, 'theme-variant');
      }

      console.log(`[ThemeSelector] Applied theme: ${theme.name} (${this.themeSettings.themeVariant})`);
    } catch (error) {
      console.error('[ThemeSelector] Failed to apply theme:', error);
    }
  }

  /**
   * Load a theme stylesheet using the API
   */
  async loadThemeStylesheet(relativePath, dataTheme) {
    try {
      console.log(`[ThemeSelector] Loading CSS: ${relativePath}`);
      
      // Use the API to fetch CSS content
      const cssData = await window.api.fetchPublicCss(relativePath);
      
      if (cssData && cssData.content) {
        // Create a style element with the CSS content
        const styleElement = document.createElement('style');
        styleElement.setAttribute('data-theme', dataTheme);
        styleElement.setAttribute('data-theme-path', relativePath);
        styleElement.textContent = cssData.content;
        
        // Add to document head
        document.head.appendChild(styleElement);
        
        console.log(`[ThemeSelector] Successfully loaded CSS: ${relativePath} (${cssData.content.length} chars)`);
      } else {
        throw new Error(`No content received for ${relativePath}`);
      }
    } catch (error) {
      console.error(`[ThemeSelector] Failed to load CSS ${relativePath}:`, error);
      throw error;
    }
  }

  /**
   * Update color scheme
   */
  updateColorScheme(colorScheme) {
    console.log(`[ThemeSelector] Color scheme changed to: ${colorScheme}`);
    
    dispatch({
      type: ActionTypes.UI_SET_COLOR_SCHEME,
      payload: colorScheme
    });
    
    // Apply color scheme to document
    document.documentElement.setAttribute('data-color-scheme', colorScheme);
    
    // If scheme is 'system', detect system preference
    if (colorScheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveTheme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      console.log(`[ThemeSelector] System preference detected: ${effectiveTheme}`);
    } else {
      document.documentElement.setAttribute('data-theme', colorScheme);
    }
    
    this.render();
  }

  /**
   * Update theme variant
   */
  updateThemeVariant(variant) {
    console.log(`[ThemeSelector] Theme variant changed to: ${variant}`);
    
    dispatch({
      type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
      payload: variant
    });
    
    // Re-apply current theme with new variant
    const currentTheme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
    if (currentTheme) {
      this.applyTheme(currentTheme);
    }
    
    this.render();
  }

  /**
   * Update spacing density
   */
  updateSpacingDensity(density) {
    console.log(`[ThemeSelector] Spacing density changed to: ${density}`);
    
    // Map 'tight' to 'compact' for CSS data-density attribute
    const densityMapping = {
      'tight': 'compact',
      'normal': 'normal',
      'comfortable': 'spacious'
    };

    // Apply spacing density to document directly
    document.documentElement.setAttribute('data-density', densityMapping[density] || 'normal');
    
    dispatch({
      type: ActionTypes.SETTINGS_SET_SPACING_VARIANT,
      payload: density
    });
    
    this.render();
  }

  /**
   * Apply current settings to document
   */
  applyCurrentSettings() {
    // Apply color scheme
    document.documentElement.setAttribute('data-color-scheme', this.themeSettings.colorScheme);
    
    // Apply theme variant
    if (this.themeSettings.colorScheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveTheme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    } else {
      document.documentElement.setAttribute('data-theme', this.themeSettings.colorScheme);
    }
    
    // Apply spacing density
    const densityMapping = {
      'tight': 'compact',
      'normal': 'normal',
      'comfortable': 'spacious'
    };
    document.documentElement.setAttribute('data-density', densityMapping[this.themeSettings.spacingDensity] || 'normal');
    
    // Apply current theme if available
    if (this.themeSettings.currentTheme) {
      const theme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
      if (theme) {
        this.applyTheme(theme);
      }
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
    }
    
    if (this.changeHandler) {
      this.containerElement.removeEventListener('change', this.changeHandler);
    }
  }
}

// Register the panel
settingsSectionRegistry.register({
  id: 'themes',
  title: 'Themes',
  icon: '▣',
  order: 2,
  component: ThemeSelectorPanel
});

export default ThemeSelectorPanel; 