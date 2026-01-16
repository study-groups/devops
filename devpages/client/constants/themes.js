/**
 * Theme Definitions - Metadata only
 *
 * CSS variables are now defined in pure CSS files:
 * - /client/styles/themes/dark.css
 * - /client/styles/themes/light.css
 *
 * This file contains theme metadata for:
 * - Theme registry and identification
 * - embed/iframe configuration
 * - Validation and utilities
 */

/**
 * DevPages Light Theme
 */
export const DEVPAGES_LIGHT = {
  id: 'devpages-light',
  name: 'DevPages Light',
  description: 'Light theme',
  version: '2.0.0',
  author: 'DevPages',
  mode: 'light',

  embed: {
    enabled: true,
    messaging: {
      allowPostMessage: true,
      trustedOrigins: ['*'],
      messageTypes: ['APPLY_THEME', 'REQUEST_THEME']
    },
    isolation: 'shadow-dom',
    injection: {
      method: 'constructable-stylesheet',
      scope: 'embed',
      priority: 100
    }
  },

  metadata: {
    created: '2025-11-21',
    updated: '2025-01-12',
    tags: ['light', 'default', 'professional'],
    category: 'built-in',
    editable: false
  }
};

/**
 * DevPages Dark Theme
 */
export const DEVPAGES_DARK = {
  id: 'devpages-dark',
  name: 'DevPages Dark',
  description: 'Dark theme',
  version: '2.0.0',
  author: 'DevPages',
  mode: 'dark',

  embed: {
    enabled: true,
    messaging: {
      allowPostMessage: true,
      trustedOrigins: ['*'],
      messageTypes: ['APPLY_THEME', 'REQUEST_THEME']
    },
    isolation: 'shadow-dom',
    injection: {
      method: 'constructable-stylesheet',
      scope: 'embed',
      priority: 100
    }
  },

  metadata: {
    created: '2025-11-21',
    updated: '2025-01-12',
    tags: ['dark', 'default', 'modern'],
    category: 'built-in',
    editable: false
  }
};

/**
 * User Theme Template
 */
export const USER_THEME_TEMPLATE = {
  id: 'user-custom',
  name: 'My Custom Theme',
  description: 'User-created custom theme',
  version: '1.0.0',
  author: 'User',
  mode: 'dark',

  embed: {
    enabled: true,
    messaging: {
      allowPostMessage: true,
      trustedOrigins: ['*'],
      messageTypes: ['APPLY_THEME', 'REQUEST_THEME']
    },
    isolation: 'shadow-dom',
    injection: {
      method: 'constructable-stylesheet',
      scope: 'embed',
      priority: 100
    }
  },

  metadata: {
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    tags: ['custom', 'user'],
    category: 'user',
    editable: true
  }
};

/**
 * All built-in themes
 */
export const BUILT_IN_THEMES = {
  'devpages-light': DEVPAGES_LIGHT,
  'devpages-dark': DEVPAGES_DARK
};

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'devpages-dark';

/**
 * Get theme by ID
 */
export function getThemeById(themeId) {
  return BUILT_IN_THEMES[themeId] || null;
}

/**
 * Create a new user theme from template
 */
export function createUserTheme(overrides = {}) {
  return {
    ...USER_THEME_TEMPLATE,
    id: `user-${Date.now()}`,
    ...overrides,
    metadata: {
      ...USER_THEME_TEMPLATE.metadata,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      ...overrides.metadata
    }
  };
}

/**
 * Validate theme structure (simplified - only requires id, name, mode)
 */
export function validateTheme(theme) {
  const required = ['id', 'name', 'mode'];
  const missing = required.filter(key => !(key in theme));

  if (missing.length > 0) {
    return {
      valid: false,
      errors: [`Missing required fields: ${missing.join(', ')}`]
    };
  }

  return { valid: true, errors: [] };
}
