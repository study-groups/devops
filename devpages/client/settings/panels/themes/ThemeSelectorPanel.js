/**
 * ThemeSelectorPanel.js - Theme, Scheme, and Variant Selection Panel
 * Handles theme selection, color scheme preference, and variant/density settings
 * Distinguishes between system CSS and theme CSS (from MD_DIR/themes)
 */

import { settingsRegistry } from '../../core/settingsRegistry.js';
import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

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
      currentTheme: null,        // selected theme id
      // These are now conventions, not settings.
      // They are kept here for display purposes.
      themeFileCore: 'core.css',
      themeFileLight: 'light.css',
      themeFileDark: 'dark.css'
    };
    
    // Load the CSS file dynamically
    this.loadComponentStyles();
    
    this.init();
  }
  
  /**
   * Load component-specific styles
   */
  loadComponentStyles() {
    // Check if the stylesheet is already loaded
    const existingStylesheet = document.querySelector('link[href*="ThemeSelectorPanel.css"]');
    if (existingStylesheet) return;
    
    // Create a link element for the CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = '/client/settings/panels/themes/ThemeSelectorPanel.css';
    
    // Add to document head
    document.head.appendChild(link);
  }

  async init() {
    // Load current settings from store
    this.loadCurrentSettings();
    
    // Load available themes from themes directory
    await this.loadAvailableThemes();
    
    // Apply current settings to document
    this.applyCurrentSettings();
    
    // Render the panel
    this.render();
    
    // Setup event listeners ONCE
    this.setupEventListeners();
    
    // Subscribe to store changes
    this.storeUnsubscribe = appStore.subscribe(() => {
      this.handleStoreUpdate();
    });
  }

  /**
   * Load current settings from the store
   */
  loadCurrentSettings() {
    const state = appStore.getState();
    const designTokens = state.settings?.designTokens || {};
    
    // Keep convention-based file names from the initial state
    this.themeSettings.colorScheme = state.ui?.colorScheme || 'system';
    this.themeSettings.themeVariant = designTokens.themeVariant || 'light';
    this.themeSettings.spacingDensity = designTokens.spacingVariant || 'normal';
    this.themeSettings.currentTheme = designTokens.activeTheme || 'system'; // Default to system theme

    console.log(`[ThemeSelector] Loaded settings:`, this.themeSettings);
  }

  /**
   * Get default/system themes when no user themes directory exists or as base themes
   */
  getDefaultThemes() {
    return [
      {
        id: 'system',
        name: 'System',
        path: 'client/styles/preview',
        type: 'system',
        files: ['core.css', 'light.css', 'dark.css']
      }
    ];
  }

  /**
   * Load available themes from both system and user directories
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

      // Start with system themes
      this.availableThemes = [...this.getDefaultThemes()];

      // Check if user themes directory exists in MD_DIR
      const response = await fetch(`/api/files/list?pathname=themes`);
      this.themeDirs = [];
      
      if (response.ok) {
        const data = await response.json();
        
        // Store all directories found in themes/ (dirs is the array of directory names)
        this.themeDirs = data.dirs || [];
        
        // Define the desired theme order: system, basic, classic, arcade
        const themeOrder = ['basic', 'classic', 'arcade'];
        const userThemes = [];
        
        // Add user themes in the specified order
        if (data.dirs) {
          // First, add themes in the preferred order
          for (const themeName of themeOrder) {
            if (data.dirs.includes(themeName)) {
              const themeInfo = await this.validateThemeDirectory(themeName);
              if (themeInfo) {
                // Mark as user theme
                themeInfo.type = 'user';
                userThemes.push(themeInfo);
              }
            }
          }
          
          // Then add any remaining themes not in the order list
          for (const dirName of data.dirs) {
            if (!themeOrder.includes(dirName)) {
              const themeInfo = await this.validateThemeDirectory(dirName);
              if (themeInfo) {
                // Mark as user theme
                themeInfo.type = 'user';
                userThemes.push(themeInfo);
              }
            }
          }
          
          // Add all user themes to the available themes list
          this.availableThemes.push(...userThemes);
        }
        
        console.log(`[ThemeSelector] Found ${this.availableThemes.length} total themes (system + user)`);
      } else {
        console.log('[ThemeSelector] No user themes directory found, using system themes only');
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
      
      // A valid theme must contain at least a core.css file.
      if (fileNames.includes('core.css')) {
        return {
          id: themeName,
          name: this.formatThemeName(themeName),
          path: `themes/${themeName}`,
          type: 'theme',
          files: fileNames.filter(f => f.endsWith('.css'))
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
   * Handle store updates
   */
  handleStoreUpdate() {
    const state = appStore.getState();
    const designTokens = state.settings?.designTokens || {};
    
    // Only check theme-related settings, not everything
    const newSettings = {
      colorScheme: state.ui?.colorScheme || 'system',
      themeVariant: designTokens.themeVariant || 'light',
      spacingDensity: designTokens.spacingVariant || 'normal',
      currentTheme: designTokens.activeTheme || 'system'
    };
    
    // Only update if theme settings actually changed
    const themeSettingsChanged = (
      this.themeSettings.colorScheme !== newSettings.colorScheme ||
      this.themeSettings.themeVariant !== newSettings.themeVariant ||
      this.themeSettings.spacingDensity !== newSettings.spacingDensity ||
      this.themeSettings.currentTheme !== newSettings.currentTheme
    );
    
    if (themeSettingsChanged) {
      this.themeSettings = newSettings;
      console.log(`[ThemeSelector] Settings changed, updating:`, this.themeSettings);
      this.applyCurrentSettings();
      this.render();
    }
    // Don't log or update if no theme changes occurred
  }

  /**
   * Render the panel
   */
  render() {
    this.containerElement.innerHTML = `
      <div class="theme-selector-panel">
        ${this.renderConsolidatedInterface()}
      </div>
    `;
  }

  /**
   * Render consolidated theme and appearance interface
   */
  renderConsolidatedInterface() {
    // Theme selection buttons - System theme plus user themes
    const themeItems = this.availableThemes.map(theme => ({
      id: theme.id,
      name: theme.name,
      isActive: this.themeSettings.currentTheme === theme.id || (!this.themeSettings.currentTheme && theme.id === 'system')
    }));

    const themesList = themeItems.map(theme => {
      const activeClass = theme.isActive ? ' active' : '';
      const activeIndicator = theme.isActive ? ' ✓' : '';
      return `<button class="theme-dir-item${activeClass}" data-theme-id="${theme.id}" title="Select ${theme.name} theme">${theme.name}${activeIndicator}</button>`;
    }).join('');

    // Color scheme buttons
    const colorSchemes = [
      { id: 'system', name: 'System', isActive: this.themeSettings.colorScheme === 'system' },
      { id: 'light', name: 'Light', isActive: this.themeSettings.colorScheme === 'light' },
      { id: 'dark', name: 'Dark', isActive: this.themeSettings.colorScheme === 'dark' }
    ];

    const colorSchemesList = colorSchemes.map(scheme => {
      const activeClass = scheme.isActive ? ' active' : '';
      const activeIndicator = scheme.isActive ? ' ✓' : '';
      return `<button class="theme-dir-item${activeClass}" data-color-scheme="${scheme.id}" title="Set ${scheme.name} color scheme">${scheme.name}${activeIndicator}</button>`;
    }).join('');

    // Spacing density buttons
    const spacingOptions = [
      { id: 'tight', name: 'Tight', isActive: this.themeSettings.spacingDensity === 'tight' },
      { id: 'normal', name: 'Normal', isActive: this.themeSettings.spacingDensity === 'normal' },
      { id: 'comfortable', name: 'Comfortable', isActive: this.themeSettings.spacingDensity === 'comfortable' }
    ];

    const spacingList = spacingOptions.map(spacing => {
      const activeClass = spacing.isActive ? ' active' : '';
      const activeIndicator = spacing.isActive ? ' ✓' : '';
      return `<button class="theme-dir-item${activeClass}" 
              data-spacing="${spacing.id}" 
              title="Set ${spacing.name} spacing density">${spacing.name}${activeIndicator}</button>`;
    }).join('');

    return `
      <div class="theme-consolidated-interface">
        <div class="theme-config-row" style="margin-bottom: var(--space-5);">
          <div class="config-label" style="display: in-line; margin-bottom: var(--space-2);">Theme:</div>
          <div style="margin: var(--space-6); margin-top: var(--space-2); 
          font-family: monospace; font-size: 0.85em; color: var(--text-muted, #666);">${this.mdDir}/themes</div>
          <div class="theme-options" style="margin-left: var(--space-6); gap: var(--space-3);">${themesList}</div>

        </div>
        
        <div class="theme-config-row" style="margin-bottom: var(--space-5);">
          <div class="config-label" style="display: block; margin-bottom: var(--space-2);">Color Scheme:</div>
          <div class="theme-options" style="margin-left: var(--space-6); gap: var(--space-3);">${colorSchemesList}</div>
        </div>
        
        <div class="theme-config-row" style="margin-bottom: var(--space-4);">
          <div class="config-label" style="display: block; margin-bottom: var(--space-2);">Spacing:</div>
          <div class="theme-options" style="margin-left: var(--space-6); gap: var(--space-3);">${spacingList}</div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.containerElement.removeEventListener('click', this.handleClick);
    this.containerElement.addEventListener('click', this.handleClick = (e) => {
      // Handle theme selection via clickable theme directory items
      const themeItem = e.target.closest('.theme-dir-item[data-theme-id]');
      if (themeItem) {
        const themeId = themeItem.getAttribute('data-theme-id');
        this.selectTheme(themeId);
        return;
      }

      // Handle color scheme selection
      const colorSchemeItem = e.target.closest('.theme-dir-item[data-color-scheme]');
      if (colorSchemeItem) {
        const colorScheme = colorSchemeItem.getAttribute('data-color-scheme');
        this.updateColorScheme(colorScheme);
        return;
      }

      // Handle spacing density selection
      const spacingItem = e.target.closest('.theme-dir-item[data-spacing]');
      if (spacingItem) {
        const spacing = spacingItem.getAttribute('data-spacing');
        this.updateSpacingDensity(spacing);
        return;
      }
    });
  }

  /**
   * Handle theme selection
   */
  selectTheme(themeId) {
    console.log(`[ThemeSelector] Selecting theme: ${themeId || 'System (default)'}`);
    
    // Default to system theme if no theme specified
    const effectiveThemeId = themeId || 'system';
    
    // Find the theme object
    const theme = this.availableThemes.find(t => t.id === effectiveThemeId);
    
    if (!theme) {
      console.warn(`[ThemeSelector] Theme ${effectiveThemeId} not found in available themes`);
      return;
    }
    
    // Apply the theme
    this.applyTheme(theme);
    
    // Re-render to update the UI
    this.render();
  }

  /**
   * Apply the selected theme
   */
  async applyTheme(theme) {
    // Store the theme ID
    const themeId = theme.id;
    
    // Update the theme settings
    this.themeSettings.currentTheme = themeId;
    
    // Dispatch to store
    dispatch({
      type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
      payload: themeId
    });
    
    console.log(`[ThemeSelector] Applied theme: ${themeId}`);
    
    if (theme.type === 'system') {
      // System theme - CSS is already loaded in main HTML
      // Just remove any user theme stylesheets
      const userThemeLinks = document.querySelectorAll('style[data-theme]');
      userThemeLinks.forEach(link => link.remove());
      
      console.log(`[ThemeSelector] Using system theme (CSS already loaded in main HTML)`);
    } else {
      // User theme - load additional CSS files on top of system CSS
      const coreFile = 'core.css';
      const variantFile = this.themeSettings.themeVariant === 'dark'
        ? 'dark.css'
        : 'light.css';
      
      // Load user theme files via API (they override system CSS)
      await this.loadThemeStylesheet(`${theme.path}/${coreFile}`, 'user-core', theme.type);
      await this.loadThemeStylesheet(`${theme.path}/${variantFile}`, 'user-variant', theme.type);
      
      console.log(`[ThemeSelector] Loaded user theme files: ${coreFile}, ${variantFile}`);
    }
  }

  /**
   * Load a theme stylesheet dynamically based on its type (system or user).
   * - System themes are loaded via a <link> tag from client/styles.
   * - User themes are fetched via the file API and embedded in a <style> tag.
   * @param {string} relativePath - Path to the CSS file.
   * @param {string} dataTheme - Theme type identifier (core, light, dark).
   * @param {string} themeType - The type of theme ('system' or 'user').
   */
  async loadThemeStylesheet(relativePath, dataTheme, themeType) {
    try {
      // Remove any existing stylesheet (link or style) with the same data-theme attribute
      const existingElements = document.querySelectorAll(`link[data-theme="${dataTheme}"], style[data-theme="${dataTheme}"]`);
      existingElements.forEach(el => el.remove());

      if (themeType === 'user') {
        // USER THEME: Fetch via API and embed in a <style> tag.
        const apiUrl = `/api/files/content?pathname=${encodeURIComponent(relativePath)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`API fetch failed for ${relativePath} (status: ${response.status})`);
        }
        
        const cssText = await response.text();
        const styleElement = document.createElement('style');
        styleElement.setAttribute('data-theme', dataTheme);
        styleElement.textContent = cssText;
        document.head.appendChild(styleElement);
        
        console.log(`[ThemeSelector] Loaded USER theme via API: ${relativePath}`);
      } else {
        // SYSTEM THEME: Load via a direct <link> tag from client/styles.
        const linkElement = document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.type = 'text/css';
        linkElement.href = `/${relativePath}`; // e.g., /client/styles/preview/core.css
        linkElement.setAttribute('data-theme', dataTheme);
        
        linkElement.onerror = () => {
          console.error(`[ThemeSelector] Error loading SYSTEM theme stylesheet: ${linkElement.href}`);
          linkElement.remove();
        };

        document.head.appendChild(linkElement);
        console.log(`[ThemeSelector] Loaded SYSTEM theme via <link>: ${relativePath}`);
      }

      return true;
    } catch (error) {
      console.error(`[ThemeSelector] Failed to load theme stylesheet ${relativePath}:`, error);
      return false;
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
      this.updateThemeVariant(prefersDark ? 'dark' : 'light', false);
    } else {
      this.updateThemeVariant(colorScheme, false);
    }
    
    // Re-render the interface
    this.render();
  }

  /**
   * Update theme variant
   */
  updateThemeVariant(variant, shouldRender = true) {
    console.log(`[ThemeSelector] Theme variant changed to: ${variant}`);
    
    // Set the data-theme attribute on the root element for global CSS to use.
    document.documentElement.setAttribute('data-theme', variant);

    // Update local state immediately to prevent race conditions with the store.
    this.themeSettings.themeVariant = variant;
    
    // Update HTML head with theme files
    const lightThemeLink = document.querySelector('link[data-theme="light"]');
    const darkThemeLink = document.querySelector('link[data-theme="dark"]');
    
    if (lightThemeLink && darkThemeLink) {
      if (variant === 'dark') {
        lightThemeLink.disabled = true;
        darkThemeLink.disabled = false;
      } else if (variant === 'light') {
        lightThemeLink.disabled = false;
        darkThemeLink.disabled = true;
      } else { // 'system' or any other non-specific theme
        lightThemeLink.disabled = true;
        darkThemeLink.disabled = true;
      }
    }
    
    dispatch({
      type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
      payload: variant
    });
    
    // Re-apply current theme to load the correct variant stylesheet (for user themes)
    const currentTheme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
    if (currentTheme && currentTheme.type === 'user') {
      this.applyTheme(currentTheme);
    }
    
    if (shouldRender) {
      this.render();
    }
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
    
    // Re-render the interface
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
settingsRegistry.register({
  id: 'themes',
  title: 'Themes',
  icon: '▣',
  order: 2,
  component: ThemeSelectorPanel
});

export default ThemeSelectorPanel; 