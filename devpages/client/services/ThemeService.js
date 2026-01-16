/**
 * ThemeService - Simplified theme management
 *
 * Responsibilities:
 * - Theme switching (sets data-theme attribute)
 * - Theme persistence (localStorage)
 * - Subscriber notifications
 * - iframe/embed messaging
 * - OS dark mode sync
 *
 * CSS variables are now defined in pure CSS files:
 * - /client/styles/themes/dark.css
 * - /client/styles/themes/light.css
 * - /client/styles/themes/base.css
 */

import { STORAGE_KEYS, migrateLegacyKeys } from '../constants/storageKeys.js';
import { BUILT_IN_THEMES, DEFAULT_THEME_ID, getThemeById, validateTheme } from '../constants/themes.js';

class ThemeService {
  constructor() {
    this.currentTheme = null;
    this.currentMode = 'dark';
    this.subscribers = new Set();
    this.embeds = new Map();
    this.initialized = false;

    this.handleOSThemeChange = this.handleOSThemeChange.bind(this);
    this.handleEmbedMessage = this.handleEmbedMessage.bind(this);
  }

  async initialize() {
    if (this.initialized) return;

    migrateLegacyKeys();

    // Check if ThemeInitializer already set the theme
    const isPreInitialized = document.documentElement.getAttribute('data-theme-initialized') === 'true';
    const themeId = window.__initializedThemeId || localStorage.getItem(STORAGE_KEYS.THEME.ACTIVE_THEME) || DEFAULT_THEME_ID;

    const theme = await this.getTheme(themeId);
    if (theme) {
      this.currentTheme = theme;
      this.currentMode = theme.mode;
      if (!isPreInitialized) {
        this.applyTheme(theme, { skipSave: true });
      }
    } else {
      this.applyTheme(getThemeById(DEFAULT_THEME_ID));
    }

    this.setupOSThemeListener();
    this.setupEmbedMessaging();
    this.initialized = true;
  }

  async getTheme(themeId) {
    // Check built-in themes
    const builtIn = getThemeById(themeId);
    if (builtIn) return builtIn;

    // Check custom themes in storage
    const customThemes = this.getCustomThemes();
    if (customThemes[themeId]) return customThemes[themeId];

    // Try file system
    try {
      const response = await fetch(`/pdata/themes/${themeId}.json`);
      if (response.ok) return await response.json();
    } catch (error) {
      // Theme not found
    }

    return null;
  }

  getCustomThemes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME.CUSTOM_THEMES);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  getAllThemes() {
    return { ...BUILT_IN_THEMES, ...this.getCustomThemes() };
  }

  /**
   * Apply theme - sets data-theme attribute and notifies subscribers
   * CSS variables come from theme CSS files, not generated here
   */
  applyTheme(theme, options = {}) {
    if (!theme) return;

    const validation = validateTheme(theme);
    if (!validation.valid) {
      console.error('[ThemeService] Invalid theme:', validation.errors);
      return;
    }

    const mode = theme.mode || 'dark';

    // Set theme attributes for CSS selectors
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-theme-id', theme.id);
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${mode}`);

    this.currentTheme = theme;
    this.currentMode = mode;

    if (!options.skipSave) {
      this.saveThemePreference(theme.id, mode);
    }

    this.notifySubscribers(theme);

    if (theme.embed?.enabled) {
      this.broadcastThemeToEmbeds(theme);
    }
  }

  saveThemePreference(themeId, mode) {
    localStorage.setItem(STORAGE_KEYS.THEME.ACTIVE_THEME, themeId);
    localStorage.setItem(STORAGE_KEYS.THEME.CURRENT_MODE, mode);
  }

  async loadTheme(themeId) {
    const theme = await this.getTheme(themeId);
    if (theme) {
      this.applyTheme(theme);
    } else {
      console.error(`[ThemeService] Theme not found: ${themeId}`);
    }
  }

  async toggleMode() {
    const newMode = this.currentMode === 'light' ? 'dark' : 'light';
    const themeId = newMode === 'light' ? 'devpages-light' : 'devpages-dark';
    await this.loadTheme(themeId);
  }

  saveCustomTheme(theme) {
    const validation = validateTheme(theme);
    if (!validation.valid) {
      throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
    }

    const customThemes = this.getCustomThemes();
    customThemes[theme.id] = {
      ...theme,
      metadata: { ...theme.metadata, updated: new Date().toISOString() }
    };
    localStorage.setItem(STORAGE_KEYS.THEME.CUSTOM_THEMES, JSON.stringify(customThemes));
  }

  deleteCustomTheme(themeId) {
    const customThemes = this.getCustomThemes();
    if (!customThemes[themeId]) return false;

    delete customThemes[themeId];
    localStorage.setItem(STORAGE_KEYS.THEME.CUSTOM_THEMES, JSON.stringify(customThemes));
    return true;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(theme) {
    this.subscribers.forEach(callback => {
      try {
        callback(theme);
      } catch (error) {
        console.error('[ThemeService] Subscriber error:', error);
      }
    });
  }

  // === OS THEME SYNC ===

  setupOSThemeListener() {
    if (!window.matchMedia) return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', this.handleOSThemeChange);

    const syncOS = localStorage.getItem(STORAGE_KEYS.THEME.SYNC_OS) === 'true';
    if (syncOS) {
      this.handleOSThemeChange(darkModeQuery);
    }
  }

  handleOSThemeChange(e) {
    const themeId = e.matches ? 'devpages-dark' : 'devpages-light';
    this.loadTheme(themeId);
  }

  setOSThemeSync(enabled) {
    localStorage.setItem(STORAGE_KEYS.THEME.SYNC_OS, String(enabled));
    if (enabled) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.handleOSThemeChange(darkModeQuery);
    }
  }

  // === EMBED/IFRAME MESSAGING ===

  registerEmbed(embedId, iframeElement, options = {}) {
    this.embeds.set(embedId, {
      iframe: iframeElement,
      origin: options.origin || '*',
      messageTypes: options.messageTypes || ['APPLY_THEME']
    });

    if (this.currentTheme?.embed?.enabled) {
      this.sendThemeToEmbed(embedId);
    }
  }

  unregisterEmbed(embedId) {
    this.embeds.delete(embedId);
  }

  setupEmbedMessaging() {
    window.addEventListener('message', this.handleEmbedMessage);
  }

  handleEmbedMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;

    const { type, embedId } = event.data;
    if (type === 'REQUEST_THEME') {
      this.sendThemeToEmbed(embedId, event.source);
    }
  }

  sendThemeToEmbed(embedId, targetWindow = null) {
    const embed = this.embeds.get(embedId);
    if (!embed && !targetWindow) return;

    const target = targetWindow || embed?.iframe?.contentWindow;
    const origin = embed?.origin || '*';

    target?.postMessage({
      type: 'APPLY_THEME',
      theme: this.currentTheme,
      embedId
    }, origin);
  }

  broadcastThemeToEmbeds(theme = this.currentTheme) {
    if (!theme) return;
    this.embeds.forEach((_, embedId) => this.sendThemeToEmbed(embedId));
  }
}

// Singleton
export const themeService = new ThemeService();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => themeService.initialize());
} else {
  themeService.initialize();
}

// Debug access
if (typeof window !== 'undefined') {
  window.__themeService = themeService;
}
