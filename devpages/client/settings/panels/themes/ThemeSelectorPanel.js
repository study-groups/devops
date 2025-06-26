/**
 * ThemeSelectorPanel.js - Theme, Scheme, and Variant Selection Panel
 * Handles theme selection, color scheme preference, and variant/density settings
 * Distinguishes between system CSS and theme CSS (from MD_DIR/themes)
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';
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
    this.themeSettings.currentTheme = designTokens.activeTheme || null;

    console.log(`[ThemeSelector] Loaded settings:`, this.themeSettings);
  }

  /**
   * Get default/system themes when no user themes directory exists or as base themes
   */
  getDefaultThemes() {
    return [
      {
        id: 'system',
        name: 'Default',
        path: 'client/themes/system',
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
        
        // Add user themes to the available themes list
        if (data.dirs) {
          for (const dirName of data.dirs) {
            const themeInfo = await this.validateThemeDirectory(dirName);
            if (themeInfo) {
              // Mark as user theme
              themeInfo.type = 'user';
              this.availableThemes.push(themeInfo);
            }
          }
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
    const prevSettings = { ...this.themeSettings };
    this.loadCurrentSettings();
    
    // Re-render if settings changed
    if (JSON.stringify(prevSettings) !== JSON.stringify(this.themeSettings)) {
      this.applyCurrentSettings();
      this.render();
    }
  }

  /**
   * Render the panel
   */
  render() {
    this.containerElement.innerHTML = `
      <div class="theme-selector-panel">
        ${this.renderDirectoryInfoSection()}
        ${this.renderThemeSelectionSection()}
        ${this.renderAppearanceSettingsSection()}
        <div id="theme-current-config-container">
          ${this.renderCurrentConfigurationSection()}
        </div>
      </div>
    `;
  }

  /**
   * Render a generic collapsible section
   */
  renderSection(title, content, startCollapsed = false) {
    // Create a unique ID for this subsection based on the title
    const sectionId = `theme-selector/${title.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Check if we have a stored state for this section
    const state = appStore.getState();
    const collapsedSubsections = state.settingsPanel?.collapsedSubsections || {};
    
    // Use stored state if available, otherwise use the startCollapsed parameter
    const isCollapsed = collapsedSubsections[sectionId] !== undefined 
      ? collapsedSubsections[sectionId] 
      : startCollapsed;
    
    return `
      <div id="${sectionId}" class="settings-section-container${isCollapsed ? ' collapsed' : ''}">
        <h2 class="settings-section-header" tabindex="0" data-section-id="${sectionId}">
          <span class="collapse-indicator">${isCollapsed ? '►' : '▼'}</span>
          ${title}
        </h2>
        <div class="settings-section-content">
          ${content}
        </div>
      </div>
    `;
  }
  
  /**
   * Render directory information
   */
  renderDirectoryInfoSection() {
    const themeDirsList = this.themeDirs && this.themeDirs.length > 0 
      ? this.themeDirs.map(dir => `<span class="theme-dir-item">${dir}</span>`).join('')
      : `<span class="no-dirs">No theme directories found.</span>`;

    const content = `
      <div class="current-config-grid">
          <span class="config-label">MD_DIR:</span> 
          <span class="config-value">${this.mdDir || 'unknown'}</span>
          
          <span class="config-label">Themes Path:</span> 
          <span class="config-value">${this.mdDir}/themes</span>
          
          <span class="config-label" style="align-self: start; padding-top: var(--space-1);">Found Themes:</span>
          <div class="settings-flex" style="flex-wrap: wrap; gap: var(--space-1);">${themeDirsList}</div>
      </div>
    `;
    return this.renderSection('Directory Information', content);
  }

  /**
   * Render theme selection dropdown
   */
  renderThemeSelectionSection() {
    if (this.availableThemes.length === 0) {
      return this.renderSection('Theme Selection', `
        <p class="settings-text--muted">No valid themes found.</p>
        <p class="settings-text--muted" style="font-size: var(--font-size-xs);">
          A valid theme requires at least a <code>core.css</code> file
          in a subdirectory of <code>${this.mdDir}/themes</code>.
        </p>
      `);
    }

    // Create styled theme selection buttons
    const themeButtons = this.availableThemes.map(theme => {
      const isActive = this.themeSettings.currentTheme === theme.id;
      const buttonClass = isActive ? 'theme-button active' : 'theme-button';
      return `
        <button 
          class="${buttonClass}" 
          data-theme-id="${theme.id}" 
          title="${theme.name}${isActive ? ' (Active)' : ''}">
          <span class="theme-button-name">${theme.name}</span>
          ${isActive ? '<span class="theme-active-indicator">✓</span>' : ''}
          <div class="theme-button-preview"></div>
        </button>
      `;
    }).join('');

    // Add system/default option
    const isSystemActive = !this.themeSettings.currentTheme;
    const systemButtonClass = isSystemActive ? 'theme-button active' : 'theme-button';
    const systemButton = `
      <button 
        class="${systemButtonClass}" 
        data-theme-id="" 
        title="No Theme${isSystemActive ? ' (Active)' : ''}">
        <span class="theme-button-name">None</span>
        ${isSystemActive ? '<span class="theme-active-indicator">✓</span>' : ''}
        <div class="theme-button-preview"></div>
      </button>
    `;

    const content = `
      <div class="theme-config-grid">
        <label class="settings-label">Active Theme</label>
        <div class="theme-buttons-container">
          ${systemButton}
          ${themeButtons}
        </div>
      </div>
    `;
    return this.renderSection('Theme Selection', content);
  }

  /**
   * Render appearance settings (color scheme, density)
   */
  renderAppearanceSettingsSection() {
    const content = `
      <div class="settings-flex--column" style="gap: var(--density-space-lg);">
        <div class="theme-config-grid">
            <label for="color-scheme-select" class="settings-label">Color Scheme</label>
            <select id="color-scheme-select" class="settings-select">
              <option value="system" ${this.themeSettings.colorScheme === 'system' ? 'selected' : ''}>System Preference</option>
              <option value="light" ${this.themeSettings.colorScheme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${this.themeSettings.colorScheme === 'dark' ? 'selected' : ''}>Dark</option>
            </select>
            <div class="settings-text--muted" style="grid-column: 2;">Determines the Light/Dark mode preference.</div>
        </div>
        <div class="theme-config-grid">
            <label for="density-select" class="settings-label">Spacing Density</label>
            <select id="density-select" class="settings-select">
              <option value="tight" ${this.themeSettings.spacingDensity === 'tight' ? 'selected' : ''}>Tight</option>
              <option value="normal" ${this.themeSettings.spacingDensity === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="comfortable" ${this.themeSettings.spacingDensity === 'comfortable' ? 'selected' : ''}>Comfortable</option>
            </select>
            <div class="settings-text--muted" style="grid-column: 2;">Controls the padding and margins for UI elements.</div>
        </div>
      </div>
    `;
    return this.renderSection('Appearance', content);
  }

  /**
   * Render current configuration display
   */
  renderCurrentConfigurationSection() {
    let themeName = 'None';
    if (this.themeSettings.currentTheme) {
        const theme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
        themeName = theme ? theme.name : this.themeSettings.currentTheme; // Fallback to id if not found
    }
    
    const content = `
      <div class="current-config-grid">
        <span class="config-label">Theme:</span> 
        <span class="config-value">${themeName}</span>
        
        <span class="config-label">Scheme:</span> 
        <span class="config-value">${this.themeSettings.colorScheme}</span>

        <span class="config-label">Variant:</span> 
        <span class="config-value">${this.themeSettings.themeVariant}</span>
        
        <span class="config-label">Density:</span> 
        <span class="config-value">${this.themeSettings.spacingDensity}</span>

        <span class="config-label">Core File:</span> 
        <span class="config-text">${this.themeSettings.themeFileCore}</span>
        
        <span class="config-label">Light File:</span> 
        <span class="config-text">${this.themeSettings.themeFileLight}</span>
        
        <span class="config-label">Dark File:</span> 
        <span class="config-text">${this.themeSettings.themeFileDark}</span>
      </div>
    `;
    return this.renderSection('Current Configuration', content, true);
  }

  /**
   * A targeted render function to update only the current configuration section.
   */
  updateCurrentConfigurationView() {
    const container = this.containerElement.querySelector('#theme-current-config-container');
    if (container) {
      container.innerHTML = this.renderCurrentConfigurationSection();
      // Re-attach listener for the new section header
      const header = container.querySelector('.settings-section-header');
      if (header) {
        header.addEventListener('click', (e) => this.handleSectionHeaderClick(e));
      }
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.containerElement.removeEventListener('click', this.handleClick);
    this.containerElement.addEventListener('click', this.handleClick = (e) => {
      // Handle section headers (collapsible sections)
      const header = e.target.closest('.settings-section-header');
      if (header) {
        this.handleSectionHeaderClick(e);
        return; // Stop further processing
      }

      // Handle theme selection buttons
      const themeButton = e.target.closest('.theme-button');
      if (themeButton) {
        const themeId = themeButton.getAttribute('data-theme-id');
        this.selectTheme(themeId);
        // UI update is handled within selectTheme
      }
    });
    
    // Appearance selects - using delegation on the container for changes
    this.containerElement.addEventListener('change', (e) => {
      if (e.target.id === 'color-scheme-select') {
        this.updateColorScheme(e.target.value);
      }
      if (e.target.id === 'density-select') {
        this.updateSpacingDensity(e.target.value);
      }
    });
  }

  /**
   * Handles clicks on section headers to toggle them.
   */
  handleSectionHeaderClick(e) {
    const header = e.target.closest('.settings-section-header');
    if (!header) return;

    const sectionId = header.getAttribute('data-section-id');
    if (sectionId) {
      // Dispatch to store to toggle the section
      dispatch({
        type: ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION,
        payload: { sectionId }
      });

      // Also update the UI immediately for better UX
      const container = header.closest('.settings-section-container');
      const isCollapsed = !container.classList.contains('collapsed');
      container.classList.toggle('collapsed', isCollapsed);

      const indicator = header.querySelector('.collapse-indicator');
      if (indicator) {
        indicator.textContent = isCollapsed ? '►' : '▼';
      }
    }
  }

  /**
   * Handle theme selection
   */
  selectTheme(themeId) {
    console.log(`[ThemeSelector] Selecting theme: ${themeId || 'System (default)'}`);
    
    // Find the theme object
    const theme = themeId ? this.availableThemes.find(t => t.id === themeId) : null;
    
    if (themeId && !theme) {
      console.warn(`[ThemeSelector] Theme ${themeId} not found in available themes`);
      return;
    }
    
    // Apply the theme
    this.applyTheme(theme);
    
    // Update UI to reflect the selection
    this.updateThemeButtonsUI(themeId);
  }
  
  /**
   * Update the theme buttons UI to reflect the current selection
   */
  updateThemeButtonsUI(activeThemeId) {
    // This is called when the theme is changed programmatically (not via button click)
    const allThemeButtons = this.containerElement.querySelectorAll('.theme-button');
    
    allThemeButtons.forEach(btn => {
      const btnThemeId = btn.getAttribute('data-theme-id');
      const isActive = btnThemeId === activeThemeId;
      
      // Update button state
      btn.classList.toggle('active', isActive);
      
      // Update indicator
      const existingIndicator = btn.querySelector('.theme-active-indicator');
      
      if (isActive && !existingIndicator) {
        const indicator = document.createElement('span');
        indicator.className = 'theme-active-indicator';
        indicator.textContent = '✓';
        btn.appendChild(indicator);
      } else if (!isActive && existingIndicator) {
        existingIndicator.remove();
      }
    });
  }

  /**
   * Apply the selected theme
   */
  async applyTheme(theme) {
    // Store the theme ID (or null for system default)
    const themeId = theme ? theme.id : null;
    
    // Update the theme settings
    this.themeSettings.currentTheme = themeId;
    
    // Dispatch to store
    dispatch({
      type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
      payload: themeId
    });
    
    console.log(`[ThemeSelector] Applied theme: ${themeId || 'System (default)'}`);
    
    // If we have a theme, load its files
    if (theme) {
      // Convention-based file names
      const coreFile = 'core.css';
      const variantFile = this.themeSettings.themeVariant === 'dark'
        ? 'dark.css'
        : 'light.css';
      
      // Load theme files, passing the theme type to determine loading strategy
      await this.loadThemeStylesheet(`${theme.path}/${coreFile}`, 'core', theme.type);
      await this.loadThemeStylesheet(`${theme.path}/${variantFile}`, this.themeSettings.themeVariant, theme.type);
      
      console.log(`[ThemeSelector] Loaded theme files (by convention): ${coreFile}, ${variantFile}`);
    } else {
      // Remove any theme stylesheets
      const themeLinks = document.querySelectorAll('link[data-theme], style[data-theme]');
      themeLinks.forEach(link => link.remove());
      
      console.log('[ThemeSelector] Removed theme stylesheets');
    }
    
    // Re-render the configuration view
    this.updateCurrentConfigurationView();
  }

  /**
   * Load a theme stylesheet dynamically based on its type (system or user).
   * - System themes are loaded via a <link> tag for static serving.
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
        // SYSTEM THEME: Load via a direct <link> tag.
        const linkElement = document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.type = 'text/css';
        linkElement.href = `/${relativePath}`; // Assumes it's served statically
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
    
    this.updateCurrentConfigurationView();
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
    
    dispatch({
      type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
      payload: variant
    });
    
    // Re-apply current theme to load the correct variant stylesheet
    const currentTheme = this.availableThemes.find(t => t.id === this.themeSettings.currentTheme);
    if (currentTheme) {
      this.applyTheme(currentTheme);
    }
    
    if (shouldRender) {
      this.updateCurrentConfigurationView();
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
    
    // No need to update theme variant here, just update the display
    this.updateCurrentConfigurationView();
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