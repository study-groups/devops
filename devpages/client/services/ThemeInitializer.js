/**
 * ThemeInitializer.js - Minimal synchronous theme initialization
 *
 * This script runs BEFORE CSS loads to set critical CSS variables.
 * Must be synchronous and have no dependencies.
 *
 * ThemeService will take over later for full theme management.
 */

// CRITICAL: No imports allowed - this must be standalone and synchronous
(function() {
  'use strict';

  // Storage keys (must match ThemeService)
  const STORAGE_KEYS = {
    THEME_MODE: 'devpages:theme:mode',
    THEME_ACTIVE: 'devpages:theme:active'
  };

  // Default theme configuration
  const DEFAULT_THEME_ID = 'devpages-dark';
  const DEFAULT_MODE = 'dark';

  // Complete theme color definitions (matches themes.js exactly)
  const THEMES = {
    'devpages-light': {
      mode: 'light',
      colors: {
        // === Primary Palette ===
        'primary-subtle': '#dbeafe',
        'primary-default': '#3b82f6',
        'primary-emphasis': '#1d4ed8',

        // === Neutral Palette ===
        'neutral-ghost': '#fafafa',
        'neutral-subtle': '#e5e5e5',
        'neutral-default': '#737373',
        'neutral-strong': '#404040',
        'neutral-emphasis': '#171717',

        // === Status Colors ===
        'success': '#10b981',
        'success-bg': '#ecfdf5',
        'success-border': '#059669',
        'success-muted': '#a7f3d0',

        'warning': '#f59e0b',
        'warning-bg': '#fffbeb',
        'warning-border': '#d97706',
        'warning-muted': '#fde68a',

        'error': '#ef4444',
        'error-bg': '#fef2f2',
        'error-border': '#dc2626',
        'error-muted': '#fecaca',

        'info': '#3b82f6',
        'info-bg': '#eff6ff',
        'info-border': '#1d4ed8',
        'info-muted': '#93c5fd',

        // === Code/Editor ===
        'code-bg': '#f9fafb',
        'code-border': '#e5e7eb',
        'code-fg': '#7c3aed',
        'code-muted': '#c4b5fd',

        // === Surface/Layout Tokens ===
        'bg': '#ffffff',
        'bg-alt': '#f9fafb',
        'bg-elevated': '#ffffff',
        'surface': '#ffffff',
        'border': '#e5e7eb',
        'divider': '#f3f4f6',
        'selection': '#dbeafe',
        'highlight': '#fef3c7',

        // === Text Tokens ===
        'text': '#111827',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',
        'text-inverse': '#ffffff'
      }
    },
    'devpages-dark': {
      mode: 'dark',
      colors: {
        // === Primary Palette ===
        'primary-subtle': '#93c5fd',
        'primary-default': '#3b82f6',
        'primary-emphasis': '#1d4ed8',

        // === Neutral Palette ===
        'neutral-ghost': '#171717',
        'neutral-subtle': '#404040',
        'neutral-default': '#a3a3a3',
        'neutral-strong': '#e5e5e5',
        'neutral-emphasis': '#fafafa',

        // === Status Colors ===
        'success': '#10b981',
        'success-bg': '#064e3b',
        'success-border': '#059669',
        'success-muted': '#6ee7b7',

        'warning': '#fbbf24',
        'warning-bg': '#78350f',
        'warning-border': '#f59e0b',
        'warning-muted': '#fcd34d',

        'error': '#f87171',
        'error-bg': '#7f1d1d',
        'error-border': '#ef4444',
        'error-muted': '#fca5a5',

        'info': '#60a5fa',
        'info-bg': '#1e3a8a',
        'info-border': '#3b82f6',
        'info-muted': '#93c5fd',

        // === Code/Editor ===
        'code-bg': '#1a1f29',
        'code-border': '#374151',
        'code-fg': '#c084fc',
        'code-muted': '#a78bfa',

        // === Surface/Layout Tokens ===
        'bg': '#0f1419',
        'bg-alt': '#1a1f29',
        'bg-elevated': '#262c38',
        'surface': '#1e2937',
        'border': '#374151',
        'divider': '#2d3748',
        'selection': '#1e40af',
        'highlight': '#854d0e',

        // === Text Tokens ===
        'text': '#f9fafb',
        'text-secondary': '#d1d5db',
        'text-muted': '#9ca3af',
        'text-inverse': '#111827'
      }
    }
  };

  /**
   * Apply theme CSS variables to document
   */
  function applyTheme(theme) {
    const root = document.documentElement;

    // Set theme attributes
    root.setAttribute('data-theme', theme.mode);
    root.setAttribute('data-theme-initialized', 'true');

    // Apply color CSS variables
    Object.entries(theme.colors).forEach(([name, value]) => {
      root.style.setProperty('--color-' + name, value);
    });

    // Set body class when DOMContentLoaded (body doesn't exist yet in head)
    function setBodyThemeClass() {
      if (document.body) {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add('theme-' + theme.mode);
      }
    }

    // If body already exists (shouldn't happen since we're in head), set it now
    if (document.body) {
      setBodyThemeClass();
    } else {
      // Wait for body to be parsed
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setBodyThemeClass);
      } else {
        setBodyThemeClass();
      }
    }

    console.log('[ThemeInitializer] Applied theme:', theme.mode);
  }

  /**
   * Initialize theme synchronously
   */
  function initializeTheme() {
    console.log('[ThemeInitializer] Starting synchronous initialization...');
    console.log('[ThemeInitializer] document.readyState:', document.readyState);

    try {
      // Read saved theme from localStorage
      const savedMode = localStorage.getItem(STORAGE_KEYS.THEME_MODE) || DEFAULT_MODE;
      const savedThemeId = localStorage.getItem(STORAGE_KEYS.THEME_ACTIVE) || DEFAULT_THEME_ID;

      console.log('[ThemeInitializer] Saved theme ID:', savedThemeId);
      console.log('[ThemeInitializer] Saved mode:', savedMode);

      // Get theme configuration
      const theme = THEMES[savedThemeId] || THEMES[DEFAULT_THEME_ID];

      console.log('[ThemeInitializer] Theme object loaded:', theme.mode, 'with', Object.keys(theme.colors).length, 'colors');

      // Apply theme immediately
      applyTheme(theme);

      // Store initialized theme ID for ThemeService to detect later
      window.__initializedThemeId = savedThemeId;
      window.__initializedThemeMode = theme.mode;

      console.log('[ThemeInitializer] ✅ Initialization complete');

    } catch (error) {
      console.error('[ThemeInitializer] Failed to initialize theme:', error);
      // Fallback to default dark theme
      applyTheme(THEMES[DEFAULT_THEME_ID]);
    }
  }

  // Run immediately - this is a blocking synchronous script
  initializeTheme();

})();
