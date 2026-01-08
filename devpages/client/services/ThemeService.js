/**
 * ThemeService - Centralized theme management service
 *
 * Single source of truth for:
 * - Theme loading and application
 * - Theme persistence and synchronization
 * - iframe/embed style messaging
 * - Reactive theme updates
 *
 * Usage:
 *   import { themeService } from '/client/services/ThemeService.js';
 *   themeService.loadTheme('devpages-dark');
 *   themeService.subscribe(theme => console.log('Theme changed:', theme));
 */

import { STORAGE_KEYS, migrateLegacyKeys } from '../constants/storageKeys.js';
import { BUILT_IN_THEMES, DEFAULT_THEME_ID, getThemeById, validateTheme } from '../constants/themes.js';
import { colorTokenService } from './ColorTokenService.js';

class ThemeService {
  constructor() {
    this.currentTheme = null;
    this.currentMode = 'dark';  // 'light' | 'dark' | 'auto'
    this.subscribers = new Set();
    this.embeds = new Map();      // Track registered iframes/embeds
    this.initialized = false;

    // Bind methods
    this.handleOSThemeChange = this.handleOSThemeChange.bind(this);
    this.handleEmbedMessage = this.handleEmbedMessage.bind(this);
  }

  /**
   * Initialize the theme service
   */
  async initialize() {
    if (this.initialized) {
      console.log('[ThemeService] Already initialized');
      return;
    }

    // Migrate legacy storage keys
    migrateLegacyKeys();

    // Check if ThemeInitializer already set up the theme
    const isPreInitialized = document.documentElement.getAttribute('data-theme-initialized') === 'true';

    if (isPreInitialized) {
      console.log('[ThemeService] Theme already initialized by ThemeInitializer');

      // Load the theme object that was pre-initialized
      const preInitThemeId = window.__initializedThemeId || DEFAULT_THEME_ID;
      const theme = await this.getTheme(preInitThemeId);

      if (theme) {
        this.currentTheme = theme;
        this.currentMode = window.__initializedThemeMode || theme.mode;
        console.log('[ThemeService] Using pre-initialized theme:', theme.id);
        // Apply full theme tokens (semantic mappings, typography, spacing, etc.)
        // skipSave prevents overwriting storage since ThemeInitializer already loaded from storage
        this.applyTheme(theme, { skipSave: true });
      } else {
        console.warn('[ThemeService] Pre-initialized theme not found, loading default');
        await this.loadSavedTheme();
      }
    } else {
      // No pre-initialization, do full theme load
      console.log('[ThemeService] No pre-initialization detected, loading theme');
      await this.loadSavedTheme();
    }

    // Setup OS theme change listener
    this.setupOSThemeListener();

    // Setup embed message listener
    this.setupEmbedMessaging();

    // Coordinate with ColorTokenService
    if (colorTokenService) {
      colorTokenService.subscribeToThemeService(this);
    }

    this.initialized = true;
    console.log('[ThemeService] Initialized with theme:', this.currentTheme?.id);
  }

  /**
   * Load saved theme from storage or use default
   */
  async loadSavedTheme() {
    try {
      // Get saved theme ID
      const savedThemeId = localStorage.getItem(STORAGE_KEYS.THEME.ACTIVE_THEME);
      const savedMode = localStorage.getItem(STORAGE_KEYS.THEME.CURRENT_MODE) || 'dark';

      // Load theme
      let theme = null;

      if (savedThemeId) {
        // Try to load saved theme
        theme = await this.getTheme(savedThemeId);
      }

      // Fallback to default theme
      if (!theme) {
        theme = getThemeById(DEFAULT_THEME_ID);
      }

      // Apply theme
      this.currentMode = savedMode;
      this.applyTheme(theme);

    } catch (error) {
      console.error('[ThemeService] Error loading saved theme:', error);
      // Fallback to default
      this.applyTheme(getThemeById(DEFAULT_THEME_ID));
    }
  }

  /**
   * Get theme by ID (built-in or custom)
   */
  async getTheme(themeId) {
    // Check built-in themes first
    const builtIn = getThemeById(themeId);
    if (builtIn) {
      return builtIn;
    }

    // Check custom themes in storage
    const customThemes = this.getCustomThemes();
    if (customThemes[themeId]) {
      return customThemes[themeId];
    }

    // Try to load from file system
    try {
      const response = await fetch(`/pdata/themes/${themeId}.json`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn(`[ThemeService] Could not load theme from file: ${themeId}`, error);
    }

    return null;
  }

  /**
   * Get all custom themes from localStorage
   */
  getCustomThemes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME.CUSTOM_THEMES);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[ThemeService] Error loading custom themes:', error);
      return {};
    }
  }

  /**
   * Get all available themes (built-in + custom)
   */
  getAllThemes() {
    const customThemes = this.getCustomThemes();
    return {
      ...BUILT_IN_THEMES,
      ...customThemes,
    };
  }

  /**
   * Apply theme to document
   */
  applyTheme(theme, options = {}) {
    if (!theme) {
      console.error('[ThemeService] Cannot apply null theme');
      return;
    }

    // Validate theme structure
    const validation = validateTheme(theme);
    if (!validation.valid) {
      console.error('[ThemeService] Invalid theme structure:', validation.errors);
      return;
    }

    // Apply colors as CSS variables
    this.applyColorTokens(theme.colors);

    // Apply typography tokens
    this.applyTypographyTokens(theme.typography);

    // Apply spacing tokens
    this.applySpacingTokens(theme.spacing);

    // Apply effects (shadows, borders, etc.)
    this.applyEffectTokens(theme.effects);

    // Apply component-specific styles
    this.applyComponentTokens(theme.components);

    // Set theme mode attribute
    document.documentElement.setAttribute('data-theme', theme.mode);
    document.documentElement.setAttribute('data-theme-id', theme.id);
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme.mode}`);

    // Update current theme
    this.currentTheme = theme;
    this.currentMode = theme.mode;

    // Save to storage (unless explicitly disabled)
    if (!options.skipSave) {
      this.saveThemePreference(theme.id, theme.mode);
    }

    // Notify subscribers
    this.notifySubscribers(theme);

    // Broadcast to embeds if enabled
    if (theme.embed && theme.embed.enabled) {
      this.broadcastThemeToEmbeds(theme);
    }

    // Force browser to recalculate styles by toggling a class
    // This ensures CSS variables are fully applied to all elements
    document.body.classList.add('theme-recalc');
    requestAnimationFrame(() => {
      document.body.classList.remove('theme-recalc');
    });

    console.log(`[ThemeService] Applied theme: ${theme.name} (${theme.id})`);
  }

  /**
   * Apply color tokens to document
   */
  applyColorTokens(colors) {
    // Apply all color tokens directly
    Object.entries(colors).forEach(([name, value]) => {
      document.documentElement.style.setProperty(`--color-${name}`, value);
    });

    // Map theme tokens to semantic CSS variables that components use
    // This ensures compatibility with existing CSS that expects specific variable names
    const semanticMappings = {
      // Primary colors
      'primary': colors['primary-default'] || colors.primary,
      'primary-hover': colors['primary-emphasis'] || colors['primary-hover'],
      'primary-active': colors['primary-emphasis'] || colors['primary-active'],
      'primary-foreground': colors['text-inverse'] || '#ffffff',
      'primary-background': colors['primary-subtle'] || colors['primary-background'],

      // Text/Foreground colors (text -> fg mapping)
      'fg': colors.text || colors.fg,
      'fg-alt': colors['text-secondary'] || colors['fg-alt'],
      'fg-muted': colors['text-muted'] || colors['fg-muted'],

      // Background colors
      'bg-hover': colors['bg-alt'] || colors['bg-hover'],
      'bg-muted': colors['bg-alt'] || colors['bg-muted'],
      'bg-active': colors['bg-alt'] || colors['bg-active'],

      // Border colors
      'border-secondary': colors.border || colors['border-secondary'],
      'border-hover': colors['neutral-default'] || colors['border-hover'],

      // Success colors
      'success-hover': colors.success,
      'success-foreground': colors['text-inverse'] || colors['success-foreground'] || '#ffffff',
      'success-background': colors['success-bg'] || colors['success-background'],

      // Warning colors
      'warning-hover': colors.warning,
      'warning-foreground': colors['text-inverse'] || colors['warning-foreground'] || '#111827',
      'warning-background': colors['warning-bg'] || colors['warning-background'],

      // Error colors
      'error-hover': colors.error,
      'error-foreground': colors['text-inverse'] || colors['error-foreground'] || '#ffffff',
      'error-background': colors['error-bg'] || colors['error-background'],

      // Info colors
      'info-hover': colors.info,
      'info-foreground': colors['text-inverse'] || colors['info-foreground'] || '#ffffff',
      'info-background': colors['info-bg'] || colors['info-background'],

      // Secondary (neutral) colors
      'secondary': colors['neutral-subtle'] || colors.secondary,
      'secondary-hover': colors['neutral-default'] || colors['secondary-hover'],
      'secondary-active': colors['neutral-default'] || colors['secondary-active'],
      'secondary-foreground': colors.text || colors['secondary-foreground'],
    };

    // Apply semantic mappings
    Object.entries(semanticMappings).forEach(([name, value]) => {
      if (value) {
        document.documentElement.style.setProperty(`--color-${name}`, value);
      }
    });
  }

  /**
   * Apply typography tokens
   */
  applyTypographyTokens(typography) {
    Object.entries(typography).forEach(([name, value]) => {
      document.documentElement.style.setProperty(`--font-${name}`, value);
    });
  }

  /**
   * Apply spacing tokens
   */
  applySpacingTokens(spacing) {
    Object.entries(spacing).forEach(([name, value]) => {
      document.documentElement.style.setProperty(`--spacing-${name}`, value);
    });
  }

  /**
   * Apply effect tokens (shadows, borders, transitions)
   */
  applyEffectTokens(effects) {
    Object.entries(effects).forEach(([name, value]) => {
      const prefix = name.startsWith('shadow') ? 'shadow' :
                     name.startsWith('radius') ? 'radius' :
                     name.startsWith('transition') ? 'transition' :
                     name.startsWith('animation') ? 'animation' : 'effect';
      document.documentElement.style.setProperty(`--${prefix}-${name.replace(prefix + '-', '')}`, value);
    });
  }

  /**
   * Apply component-specific tokens
   */
  applyComponentTokens(components) {
    if (!components) return;

    Object.entries(components).forEach(([componentName, tokens]) => {
      Object.entries(tokens).forEach(([tokenName, value]) => {
        document.documentElement.style.setProperty(`--${componentName}-${tokenName}`, value);
      });
    });
  }

  /**
   * Save theme preference to localStorage
   */
  saveThemePreference(themeId, mode) {
    localStorage.setItem(STORAGE_KEYS.THEME.ACTIVE_THEME, themeId);
    localStorage.setItem(STORAGE_KEYS.THEME.CURRENT_MODE, mode);
  }

  /**
   * Load theme by ID
   */
  async loadTheme(themeId) {
    const theme = await this.getTheme(themeId);
    if (theme) {
      this.applyTheme(theme);
    } else {
      console.error(`[ThemeService] Theme not found: ${themeId}`);
    }
  }

  /**
   * Toggle between light and dark modes
   */
  async toggleMode() {
    const newMode = this.currentMode === 'light' ? 'dark' : 'light';
    const themeId = newMode === 'light' ? 'devpages-light' : 'devpages-dark';
    await this.loadTheme(themeId);
  }

  /**
   * Save custom theme
   */
  saveCustomTheme(theme) {
    // Validate theme
    const validation = validateTheme(theme);
    if (!validation.valid) {
      throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
    }

    // Get existing custom themes
    const customThemes = this.getCustomThemes();

    // Add/update theme
    customThemes[theme.id] = {
      ...theme,
      metadata: {
        ...theme.metadata,
        updated: new Date().toISOString(),
      },
    };

    // Save to storage
    localStorage.setItem(STORAGE_KEYS.THEME.CUSTOM_THEMES, JSON.stringify(customThemes));

    console.log(`[ThemeService] Saved custom theme: ${theme.id}`);
  }

  /**
   * Delete custom theme
   */
  deleteCustomTheme(themeId) {
    const customThemes = this.getCustomThemes();

    if (!customThemes[themeId]) {
      console.warn(`[ThemeService] Theme not found: ${themeId}`);
      return false;
    }

    delete customThemes[themeId];
    localStorage.setItem(STORAGE_KEYS.THEME.CUSTOM_THEMES, JSON.stringify(customThemes));

    console.log(`[ThemeService] Deleted custom theme: ${themeId}`);
    return true;
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of theme change
   */
  notifySubscribers(theme) {
    console.log(`[ThemeService] Notifying ${this.subscribers.size} subscribers of theme change:`, theme.id);
    this.subscribers.forEach(callback => {
      try {
        callback(theme);
      } catch (error) {
        console.error('[ThemeService] Error in subscriber callback:', error);
      }
    });
  }

  /**
   * Setup OS dark mode listener
   */
  setupOSThemeListener() {
    if (!window.matchMedia) return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', this.handleOSThemeChange);

    // Check if auto-sync is enabled
    const syncOS = localStorage.getItem(STORAGE_KEYS.THEME.SYNC_OS) === 'true';
    if (syncOS) {
      this.handleOSThemeChange(darkModeQuery);
    }
  }

  /**
   * Handle OS theme change event
   */
  handleOSThemeChange(e) {
    const isDark = e.matches;
    const themeId = isDark ? 'devpages-dark' : 'devpages-light';

    console.log(`[ThemeService] OS theme changed to ${isDark ? 'dark' : 'light'}`);
    this.loadTheme(themeId);
  }

  /**
   * Enable/disable OS theme sync
   */
  setOSThemeSync(enabled) {
    localStorage.setItem(STORAGE_KEYS.THEME.SYNC_OS, String(enabled));

    if (enabled) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.handleOSThemeChange(darkModeQuery);
    }
  }

  // ====== EMBED / IFRAME MESSAGING ======

  /**
   * Register an iframe/embed for theme updates
   */
  registerEmbed(embedId, iframeElement, options = {}) {
    this.embeds.set(embedId, {
      iframe: iframeElement,
      origin: options.origin || '*',
      messageTypes: options.messageTypes || ['APPLY_THEME', 'UPDATE_TOKEN'],
    });

    // Send current theme to embed
    if (this.currentTheme && this.currentTheme.embed?.enabled) {
      this.sendThemeToEmbed(embedId);
    }

    console.log(`[ThemeService] Registered embed: ${embedId}`);
  }

  /**
   * Unregister an iframe/embed
   */
  unregisterEmbed(embedId) {
    this.embeds.delete(embedId);
    console.log(`[ThemeService] Unregistered embed: ${embedId}`);
  }

  /**
   * Setup embed message listening
   */
  setupEmbedMessaging() {
    window.addEventListener('message', this.handleEmbedMessage);
  }

  /**
   * Handle messages from embeds
   */
  handleEmbedMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;

    const { type, embedId, payload } = event.data;

    switch (type) {
      case 'REQUEST_THEME':
        this.sendThemeToEmbed(embedId, event.source);
        break;

      case 'THEME_UPDATED':
        console.log(`[ThemeService] Embed ${embedId} acknowledged theme update`);
        break;

      default:
        // Unknown message type
        break;
    }
  }

  /**
   * Send current theme to specific embed
   */
  sendThemeToEmbed(embedId, targetWindow = null) {
    const embed = this.embeds.get(embedId);
    if (!embed && !targetWindow) {
      console.warn(`[ThemeService] Embed not found: ${embedId}`);
      return;
    }

    const target = targetWindow || embed.iframe.contentWindow;
    const origin = embed?.origin || '*';

    target.postMessage({
      type: 'APPLY_THEME',
      theme: this.currentTheme,
      embedId: embedId,
    }, origin);

    console.log(`[ThemeService] Sent theme to embed: ${embedId}`);
  }

  /**
   * Broadcast current theme to all registered embeds
   */
  broadcastThemeToEmbeds(theme = this.currentTheme) {
    if (!theme) return;

    this.embeds.forEach((embed, embedId) => {
      try {
        this.sendThemeToEmbed(embedId);
      } catch (error) {
        console.error(`[ThemeService] Error sending theme to embed ${embedId}:`, error);
      }
    });

    console.log(`[ThemeService] Broadcasted theme to ${this.embeds.size} embeds`);
  }

  /**
   * Update a single token and broadcast to embeds
   */
  updateToken(category, tokenName, value) {
    if (!this.currentTheme) return;

    // Update in current theme
    if (!this.currentTheme[category]) {
      this.currentTheme[category] = {};
    }
    this.currentTheme[category][tokenName] = value;

    // Apply to document
    const prefix = category === 'colors' ? 'color' :
                   category === 'typography' ? 'font' :
                   category === 'spacing' ? 'spacing' : category;

    document.documentElement.style.setProperty(`--${prefix}-${tokenName}`, value);

    // Broadcast to embeds
    this.embeds.forEach((embed, embedId) => {
      embed.iframe.contentWindow.postMessage({
        type: 'UPDATE_TOKEN',
        category,
        tokenName,
        value,
        embedId,
      }, embed.origin);
    });

    console.log(`[ThemeService] Updated token: ${category}.${tokenName} = ${value}`);
  }
}

// Create singleton instance
export const themeService = new ThemeService();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => themeService.initialize());
} else {
  themeService.initialize();
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.__themeService = themeService;
}
