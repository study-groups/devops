/**
 * ThemeInitializer.js - Minimal synchronous theme initialization
 *
 * Runs BEFORE CSS loads to set data-theme attribute.
 * CSS variables are defined in theme CSS files, not generated here.
 * ThemeService takes over later for full theme management.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'devpages:theme:active';
  const DEFAULT_THEME_ID = 'devpages-dark';

  try {
    const savedThemeId = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID;
    const mode = savedThemeId.includes('light') ? 'light' : 'dark';

    // Set theme attributes for CSS selectors
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-theme-initialized', 'true');

    // Store for ThemeService to detect later
    window.__initializedThemeId = savedThemeId;
    window.__initializedThemeMode = mode;

    // Set body class when DOM is ready
    const setBodyClass = () => {
      if (document.body) {
        document.body.classList.add(`theme-${mode}`);
      }
    };

    if (document.body) {
      setBodyClass();
    } else {
      document.addEventListener('DOMContentLoaded', setBodyClass);
    }

  } catch (error) {
    // Fallback to dark theme
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-initialized', 'true');
    window.__initializedThemeId = DEFAULT_THEME_ID;
    window.__initializedThemeMode = 'dark';
  }
})();
