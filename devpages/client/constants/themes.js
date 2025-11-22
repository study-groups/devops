/**
 * Default Themes - DevPages built-in theme definitions
 *
 * Expanded theme schema includes:
 * - Standard colors, typography, spacing
 * - Embed/iframe configuration for "pages inside pages"
 * - Component-specific overrides
 * - Animation and transition preferences
 */

/**
 * Theme Schema Definition
 *
 * @typedef {Object} Theme
 * @property {string} id - Unique theme identifier
 * @property {string} name - Human-readable theme name
 * @property {string} description - Theme description
 * @property {string} version - Semantic version
 * @property {string} author - Theme creator
 * @property {string} mode - 'light' | 'dark' | 'auto'
 * @property {Object} colors - Color palette
 * @property {Object} typography - Typography settings
 * @property {Object} spacing - Spacing scale
 * @property {Object} effects - Shadows, borders, animations
 * @property {Object} embed - Embed/iframe configuration
 * @property {Object} components - Component-specific overrides
 * @property {Object} metadata - Additional metadata
 */

/**
 * DevPages Light Theme
 */
export const DEVPAGES_LIGHT = {
  id: 'devpages-light',
  name: 'DevPages Light',
  description: 'Light theme',
  version: '1.0.0',
  author: 'DevPages',
  mode: 'light',

  colors: {
    // === HARMONIZED SEMANTIC SYSTEM v3.0 ===
    // Intent-based naming (subtle/default/emphasis) replaces numeric scales (300/500/700)
    // Maintains all color variations while improving readability

    // === Primary Palette (semantic levels) ===
    'primary-subtle': '#dbeafe',    // Backgrounds, hover states
    'primary-default': '#3b82f6',   // Main brand color
    'primary-emphasis': '#1d4ed8',  // Active states, focus

    // === Neutral Palette (5 semantic levels) ===
    'neutral-ghost': '#fafafa',     // Lightest - barely visible
    'neutral-subtle': '#e5e5e5',    // Light - disabled states
    'neutral-default': '#737373',   // Medium - secondary elements
    'neutral-strong': '#404040',    // Dark - important text
    'neutral-emphasis': '#171717',  // Darkest - headings

    // === Status Colors (semantic names) ===
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
    'text-inverse': '#ffffff',
  },

  typography: {
    // Font families
    'font-sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-mono': '"JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace',
    'font-serif': 'Georgia, Cambria, "Times New Roman", Times, serif',

    // Font sizes (rem)
    'size-xs': '0.75rem',   // 12px
    'size-sm': '0.875rem',  // 14px
    'size-base': '1rem',    // 16px
    'size-lg': '1.125rem',  // 18px
    'size-xl': '1.25rem',   // 20px
    'size-2xl': '1.5rem',   // 24px
    'size-3xl': '1.875rem', // 30px
    'size-4xl': '2.25rem',  // 36px

    // Font weights
    'weight-light': '300',
    'weight-normal': '400',
    'weight-medium': '500',
    'weight-semibold': '600',
    'weight-bold': '700',

    // Line heights
    'leading-tight': '1.25',
    'leading-normal': '1.5',
    'leading-relaxed': '1.625',
    'leading-loose': '2',
  },

  spacing: {
    '0': '0',
    '1': '0.25rem',   // 4px
    '2': '0.5rem',    // 8px
    '3': '0.75rem',   // 12px
    '4': '1rem',      // 16px
    '5': '1.25rem',   // 20px
    '6': '1.5rem',    // 24px
    '8': '2rem',      // 32px
    '10': '2.5rem',   // 40px
    '12': '3rem',     // 48px
    '16': '4rem',     // 64px
    '20': '5rem',     // 80px
    '24': '6rem',     // 96px
  },

  effects: {
    // Shadows
    'shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    'shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    'shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',

    // Border radius
    'radius-sm': '0.125rem',  // 2px
    'radius-md': '0.375rem',  // 6px
    'radius-lg': '0.5rem',    // 8px
    'radius-xl': '0.75rem',   // 12px
    'radius-full': '9999px',

    // Transitions
    'transition-fast': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    'transition-base': '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    'transition-slow': '300ms cubic-bezier(0.4, 0, 0.2, 1)',

    // Animations
    'animation-duration': '200ms',
    'animation-easing': 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Embed/iframe configuration
  embed: {
    // Whether to apply theme to embedded iframes
    enabled: true,

    // Message passing configuration
    messaging: {
      allowPostMessage: true,
      trustedOrigins: ['*'], // In production, specify exact origins
      messageTypes: ['APPLY_THEME', 'UPDATE_TOKEN', 'REQUEST_THEME'],
    },

    // Style isolation strategy
    isolation: 'shadow-dom', // 'shadow-dom' | 'iframe' | 'scoped-css'

    // CSS injection method
    injection: {
      method: 'constructable-stylesheet', // 'constructable-stylesheet' | 'style-tag' | 'link'
      scope: 'embed',                     // Scope identifier
      priority: 100,                      // CSS priority/order
    },

    // Component embedding preferences
    components: {
      allowAll: false,
      whitelist: ['ThemeEditor', 'DesignTokens', 'DOMInspector'],
    },
  },

  // Component-specific overrides
  components: {
    panel: {
      'bg': 'var(--color-surface)',
      'border': 'var(--color-border)',
      'shadow': 'var(--shadow-md)',
    },
    button: {
      'bg-primary': 'var(--color-primary-500)',
      'text-primary': 'var(--color-text-inverse)',
      'hover-primary': 'var(--color-primary-600)',
    },
    input: {
      'bg': 'var(--color-bg)',
      'border': 'var(--color-border)',
      'focus-border': 'var(--color-primary-500)',
    },
    editor: {
      'bg': 'var(--color-bg)',
      'line-bg': 'var(--color-bg-alt)',
      'selection': 'var(--color-selection)',
      'cursor': 'var(--color-primary-500)',
    },
    preview: {
      'bg': 'var(--color-bg)',
      'border': 'var(--color-divider)',
    },
  },

  // Metadata
  metadata: {
    created: '2025-11-21',
    updated: '2025-11-21',
    tags: ['light', 'default', 'professional'],
    category: 'built-in',
    editable: false,
  },
};

/**
 * DevPages Dark Theme
 */
export const DEVPAGES_DARK = {
  id: 'devpages-dark',
  name: 'DevPages Dark',
  description: 'Dark theme',
  version: '1.0.0',
  author: 'DevPages',
  mode: 'dark',

  colors: {
    // === HARMONIZED SEMANTIC SYSTEM v3.0 (Dark Mode) ===
    // Intent-based naming with inverted values for dark mode
    // Same semantic names as light mode, different colors

    // === Primary Palette (semantic levels) ===
    'primary-subtle': '#93c5fd',    // Lighter for dark bg - backgrounds, hover
    'primary-default': '#3b82f6',   // Main brand color
    'primary-emphasis': '#1d4ed8',  // Darker for dark bg - active, focus

    // === Neutral Palette (5 semantic levels - INVERTED) ===
    'neutral-ghost': '#171717',     // Darkest - barely visible
    'neutral-subtle': '#404040',    // Dark - disabled states
    'neutral-default': '#a3a3a3',   // Medium - secondary elements
    'neutral-strong': '#e5e5e5',    // Light - important text
    'neutral-emphasis': '#fafafa',  // Lightest - headings

    // === Status Colors (semantic names) ===
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

    // === Surface/Layout Tokens (dark values) ===
    'bg': '#0f1419',
    'bg-alt': '#1a1f29',
    'bg-elevated': '#262c38',
    'surface': '#1e2937',
    'border': '#374151',
    'divider': '#2d3748',
    'selection': '#1e40af',
    'highlight': '#854d0e',

    // === Text Tokens (light values for dark bg) ===
    'text': '#f9fafb',
    'text-secondary': '#d1d5db',
    'text-muted': '#9ca3af',
    'text-inverse': '#111827',
  },

  typography: {
    'font-sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-mono': '"JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace',
    'font-serif': 'Georgia, Cambria, "Times New Roman", Times, serif',
    'size-xs': '0.75rem',
    'size-sm': '0.875rem',
    'size-base': '1rem',
    'size-lg': '1.125rem',
    'size-xl': '1.25rem',
    'size-2xl': '1.5rem',
    'size-3xl': '1.875rem',
    'size-4xl': '2.25rem',
    'weight-light': '300',
    'weight-normal': '400',
    'weight-medium': '500',
    'weight-semibold': '600',
    'weight-bold': '700',
    'leading-tight': '1.25',
    'leading-normal': '1.5',
    'leading-relaxed': '1.625',
    'leading-loose': '2',
  },

  spacing: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
  },

  effects: {
    'shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
    'shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
    'shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    'shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    'radius-sm': '0.125rem',
    'radius-md': '0.375rem',
    'radius-lg': '0.5rem',
    'radius-xl': '0.75rem',
    'radius-full': '9999px',
    'transition-fast': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    'transition-base': '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    'transition-slow': '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    'animation-duration': '200ms',
    'animation-easing': 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  embed: {
    enabled: true,
    messaging: {
      allowPostMessage: true,
      trustedOrigins: ['*'],
      messageTypes: ['APPLY_THEME', 'UPDATE_TOKEN', 'REQUEST_THEME'],
    },
    isolation: 'shadow-dom',
    injection: {
      method: 'constructable-stylesheet',
      scope: 'embed',
      priority: 100,
    },
    components: {
      allowAll: false,
      whitelist: ['ThemeEditor', 'DesignTokens', 'DOMInspector'],
    },
  },

  components: {
    panel: {
      'bg': 'var(--color-surface)',
      'border': 'var(--color-border)',
      'shadow': 'var(--shadow-lg)',
    },
    button: {
      'bg-primary': 'var(--color-primary-700)',
      'text-primary': 'var(--color-text)',
      'hover-primary': 'var(--color-primary-500)',
    },
    input: {
      'bg': 'var(--color-bg-alt)',
      'border': 'var(--color-border)',
      'focus-border': 'var(--color-primary-500)',
    },
    editor: {
      'bg': 'var(--color-bg)',
      'line-bg': 'var(--color-bg-alt)',
      'selection': 'var(--color-selection)',
      'cursor': 'var(--color-primary-300)',
    },
    preview: {
      'bg': 'var(--color-bg)',
      'border': 'var(--color-divider)',
    },
  },

  metadata: {
    created: '2025-11-21',
    updated: '2025-11-21',
    tags: ['dark', 'default', 'modern'],
    category: 'built-in',
    editable: false,
  },
};

/**
 * User Theme Template
 * Starting point for user-created themes
 */
export const USER_THEME_TEMPLATE = {
  id: 'user-custom',
  name: 'My Custom Theme',
  description: 'User-created custom theme',
  version: '1.0.0',
  author: 'User',
  mode: 'light',

  colors: {
    // Copy from DEVPAGES_LIGHT as starting point
    ...DEVPAGES_LIGHT.colors,
  },

  typography: {
    ...DEVPAGES_LIGHT.typography,
  },

  spacing: {
    ...DEVPAGES_LIGHT.spacing,
  },

  effects: {
    ...DEVPAGES_LIGHT.effects,
  },

  embed: {
    ...DEVPAGES_LIGHT.embed,
  },

  components: {
    ...DEVPAGES_LIGHT.components,
  },

  metadata: {
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    tags: ['custom', 'user'],
    category: 'user',
    editable: true,
  },
};

/**
 * All built-in themes
 */
export const BUILT_IN_THEMES = {
  'devpages-light': DEVPAGES_LIGHT,
  'devpages-dark': DEVPAGES_DARK,
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
      ...overrides.metadata,
    },
  };
}

/**
 * Validate theme structure
 */
export function validateTheme(theme) {
  const required = ['id', 'name', 'mode', 'colors', 'typography', 'spacing'];
  const missing = required.filter(key => !(key in theme));

  if (missing.length > 0) {
    return {
      valid: false,
      errors: [`Missing required fields: ${missing.join(', ')}`],
    };
  }

  return { valid: true, errors: [] };
}
