# Design Tokens File Structure

This document outlines the file structure for design tokens in DevPages, organized under `MD_DIR/themes/`.

## Directory Structure

```
MD_DIR/themes/
├── design-tokens.js          # Main design tokens export
├── design-tokens.css         # Generated CSS custom properties
├── [theme-name]/             # Named theme directories
│   ├── core.js              # Core design system tokens
│   ├── light.js             # Light theme variant
│   └── dark.js              # Dark theme variant
├── corporate-blue/           # Example: Corporate Blue theme
│   ├── core.js              # Base colors, typography, spacing
│   ├── light.js             # Light mode overrides
│   └── dark.js              # Dark mode overrides
├── nature-green/             # Example: Nature Green theme
│   ├── core.js
│   ├── light.js
│   └── dark.js
├── sunset-orange/            # Example: Sunset Orange theme
│   ├── core.js
│   ├── light.js
│   └── dark.js
└── active-theme.js           # Points to currently active theme
```

## Example Theme Structure

Here's a complete example of the **Corporate Blue** theme:

### corporate-blue/core.js
```javascript
// Corporate Blue - Core Design Tokens
export const coreTokens = {
  colors: {
    // Brand colors
    brand: {
      primary: '#0066cc',
      secondary: '#004499',
      accent: '#00aaff',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    },
    
    // Neutral colors (theme-agnostic)
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a'
    }
  },
  
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Georgia', 'serif'],
      mono: ['JetBrains Mono', 'Consolas', 'monospace']
    },
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem'  // 36px
    },
    
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    }
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem'      // 96px
  },
  
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    base: '0.25rem',  // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    full: '9999px'
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  }
};
```

### corporate-blue/light.js
```javascript
// Corporate Blue - Light Theme Variant
import { coreTokens } from './core.js';

export const lightTheme = {
  ...coreTokens,
  
  // Light theme semantic colors
  semantic: {
    background: {
      primary: coreTokens.colors.neutral[50],      // #f8fafc
      secondary: coreTokens.colors.neutral[100],   // #f1f5f9
      tertiary: coreTokens.colors.neutral[200],    // #e2e8f0
      elevated: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)'
    },
    
    foreground: {
      primary: coreTokens.colors.neutral[900],     // #0f172a
      secondary: coreTokens.colors.neutral[700],   // #334155
      tertiary: coreTokens.colors.neutral[600],    // #475569
      muted: coreTokens.colors.neutral[500],       // #64748b
      inverse: '#ffffff'
    },
    
    border: {
      primary: coreTokens.colors.neutral[200],     // #e2e8f0
      secondary: coreTokens.colors.neutral[300],   // #cbd5e1
      focus: coreTokens.colors.brand.primary      // #0066cc
    },
    
    // Component-specific colors
    navigation: {
      background: '#ffffff',
      text: coreTokens.colors.neutral[800],
      border: coreTokens.colors.neutral[200]
    },
    
    sidebar: {
      background: coreTokens.colors.neutral[50],
      text: coreTokens.colors.neutral[800],
      border: coreTokens.colors.neutral[200]
    },
    
    button: {
      primary: {
        background: coreTokens.colors.brand.primary,
        text: '#ffffff',
        border: coreTokens.colors.brand.primary
      },
      secondary: {
        background: coreTokens.colors.neutral[100],
        text: coreTokens.colors.neutral[800],
        border: coreTokens.colors.neutral[300]
      }
    }
  }
};
```

### corporate-blue/dark.js
```javascript
// Corporate Blue - Dark Theme Variant
import { coreTokens } from './core.js';

export const darkTheme = {
  ...coreTokens,
  
  // Dark theme semantic colors
  semantic: {
    background: {
      primary: coreTokens.colors.neutral[900],     // #0f172a
      secondary: coreTokens.colors.neutral[800],   // #1e293b
      tertiary: coreTokens.colors.neutral[700],    // #334155
      elevated: coreTokens.colors.neutral[800],    // #1e293b
      overlay: 'rgba(0, 0, 0, 0.7)'
    },
    
    foreground: {
      primary: coreTokens.colors.neutral[50],      // #f8fafc
      secondary: coreTokens.colors.neutral[200],   // #e2e8f0
      tertiary: coreTokens.colors.neutral[300],    // #cbd5e1
      muted: coreTokens.colors.neutral[400],       // #94a3b8
      inverse: coreTokens.colors.neutral[900]      // #0f172a
    },
    
    border: {
      primary: coreTokens.colors.neutral[700],     // #334155
      secondary: coreTokens.colors.neutral[600],   // #475569
      focus: coreTokens.colors.brand.accent       // #00aaff (brighter for dark mode)
    },
    
    // Component-specific colors
    navigation: {
      background: coreTokens.colors.neutral[800],
      text: coreTokens.colors.neutral[100],
      border: coreTokens.colors.neutral[700]
    },
    
    sidebar: {
      background: coreTokens.colors.neutral[900],
      text: coreTokens.colors.neutral[100],
      border: coreTokens.colors.neutral[700]
    },
    
    button: {
      primary: {
        background: coreTokens.colors.brand.accent, // Brighter blue for dark mode
        text: coreTokens.colors.neutral[900],
        border: coreTokens.colors.brand.accent
      },
      secondary: {
        background: coreTokens.colors.neutral[700],
        text: coreTokens.colors.neutral[100],
        border: coreTokens.colors.neutral[600]
      }
    }
  }
};
```

## File Formats

### design-tokens.js (Main Export)
```javascript
// Main design tokens aggregator
import { getActiveTheme } from './active-theme.js';

// Get the currently active theme
const activeTheme = getActiveTheme();

// Re-export the active theme's tokens
export { coreTokens } from `./${activeTheme}/core.js`;
export { lightTheme } from `./${activeTheme}/light.js`;
export { darkTheme } from `./${activeTheme}/dark.js`;

// Export theme utilities
export { getActiveTheme, setActiveTheme, getAvailableThemes } from './active-theme.js';

// Default export for convenience
export default {
  core: coreTokens,
  light: lightTheme,
  dark: darkTheme,
  activeTheme
};
```

### active-theme.js (Theme Management)
```javascript
// Active theme management
const ACTIVE_THEME_KEY = 'devpages_active_theme';
const DEFAULT_THEME = 'corporate-blue';

// Available themes
const AVAILABLE_THEMES = [
  'corporate-blue',
  'nature-green', 
  'sunset-orange',
  'royal-purple',
  'minimal-gray'
];

export function getActiveTheme() {
  try {
    const saved = localStorage.getItem(ACTIVE_THEME_KEY);
    return saved && AVAILABLE_THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setActiveTheme(themeName) {
  if (!AVAILABLE_THEMES.includes(themeName)) {
    throw new Error(`Theme "${themeName}" not found. Available: ${AVAILABLE_THEMES.join(', ')}`);
  }
  
  try {
    localStorage.setItem(ACTIVE_THEME_KEY, themeName);
    
    // Trigger theme change event
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: themeName }
    }));
    
    return true;
  } catch {
    return false;
  }
}

export function getAvailableThemes() {
  return [...AVAILABLE_THEMES];
}

export function createNewTheme(themeName, baseTheme = DEFAULT_THEME) {
  if (AVAILABLE_THEMES.includes(themeName)) {
    throw new Error(`Theme "${themeName}" already exists`);
  }
  
  // This would copy files from baseTheme to create new theme
  // Implementation would depend on file system access
  console.log(`Creating new theme "${themeName}" based on "${baseTheme}"`);
}
```

### design-tokens.css (Generated CSS)
```css
/* Generated from design-tokens.js */
/* DO NOT EDIT MANUALLY - This file is auto-generated */

:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  /* ... more tokens ... */
}

[data-theme="dark"] {
  /* Dark theme overrides */
  --color-primary: #3b82f6;
  /* ... more overrides ... */
}
```

### Core Token Files

#### core/colors.js
```javascript
export const colors = {
  // Brand colors
  brand: {
    primary: '#2563eb',
    secondary: '#64748b',
    accent: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    success: '#22c55e'
  },
  
  // Semantic colors
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    elevated: '#ffffff'
  },
  
  // Text colors
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#64748b',
    muted: '#94a3b8'
  },
  
  // UI colors
  border: '#e2e8f0',
  divider: '#f1f5f9',
  overlay: 'rgba(0, 0, 0, 0.5)'
};
```

#### core/typography.js
```javascript
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    serif: ['Georgia', 'serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace']
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem'  // 36px
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75'
  }
};
```

#### core/spacing.js
```javascript
export const spacing = {
  // Base spacing unit (4px)
  unit: '0.25rem',
  
  // Spacing scale
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem'      // 96px
};
```

### Theme Files

#### themes/light.js
```javascript
import { colors } from '../core/colors.js';

export const lightTheme = {
  colors: {
    ...colors,
    // Light theme specific overrides
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      elevated: '#ffffff'
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      tertiary: '#64748b',
      muted: '#94a3b8'
    }
  }
};
```

#### themes/dark.js
```javascript
import { colors } from '../core/colors.js';

export const darkTheme = {
  colors: {
    ...colors,
    // Dark theme specific overrides
    background: {
      primary: '#0f172a',
      secondary: '#1e293b',
      tertiary: '#334155',
      elevated: '#1e293b'
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8',
      muted: '#64748b'
    }
  }
};
```

### Preset Files

#### presets/corporate-blue.js
```javascript
export const corporateBlue = {
  name: 'Corporate Blue',
  description: 'Professional blue theme for corporate environments',
  tokens: {
    colors: {
      brand: {
        primary: '#0066cc',
        secondary: '#004499',
        accent: '#00aaff'
      },
      background: {
        primary: '#ffffff',
        secondary: '#f8f9fa'
      }
    }
  }
};
```

## Integration with DevPages

### Settings Panel Integration
The Theme & Design panel will:
1. Read from `MD_DIR/themes/design-tokens.js`
2. Generate `MD_DIR/themes/design-tokens.css` when tokens change
3. Allow editing of `themes/custom.js` for user customizations
4. Provide preset selection from `presets/` directory

### CSS Generation
When design tokens are modified:
1. Panel reads all token files
2. Generates CSS custom properties
3. Writes to `design-tokens.css`
4. Triggers preview refresh

### File Watching
The system will watch for changes in:
- `core/*.js` files
- `themes/*.js` files  
- `presets/*.js` files

And automatically regenerate `design-tokens.css` when changes are detected.

## Benefits

1. **Modular**: Tokens are organized by category
2. **Extensible**: Easy to add new token categories
3. **Version Controlled**: All tokens are in JS files
4. **Type Safe**: Can add TypeScript definitions
5. **Themeable**: Multiple theme support built-in
6. **Preset System**: Pre-built themes for quick setup
7. **CSS Generation**: Automatic CSS custom property generation
8. **Hot Reload**: Changes reflect immediately in preview 