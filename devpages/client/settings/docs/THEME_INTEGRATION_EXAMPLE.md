# Theme Integration Example

This document shows how our enhanced design tokens system integrates perfectly with the standard theme management approach.

## 🎯 **Generated Output Example**

When you use our ThemeDesignPanel to generate files, here's what you get:

### Generated `design-tokens.css`
```css
/* Generated Design Tokens CSS */
/* Theme: corporate-blue */

/* Light Theme */
:root[data-theme="corporate-blue-light"] {
  /* Brand Colors */
  --color-brand-primary: #0066cc;
  --color-brand-secondary: #004499;
  --color-brand-accent: #00aaff;

  /* Background Colors */
  --color-background-primary: #f8fafc;
  --color-background-secondary: #f1f5f9;
  --color-background-tertiary: #e2e8f0;
  --color-background-elevated: #ffffff;

  /* Foreground Colors */
  --color-foreground-primary: #0f172a;
  --color-foreground-secondary: #334155;
  --color-foreground-tertiary: #475569;
  --color-foreground-muted: #64748b;

  /* Border Colors */
  --color-border-primary: #e2e8f0;
  --color-border-secondary: #cbd5e1;
  --color-border-focus: #0066cc;

  /* Typography - Font Sizes */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;

  /* Typography - Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
}

/* Dark Theme */
:root[data-theme="corporate-blue-dark"] {
  /* Brand Colors */
  --color-brand-primary: #0066cc;
  --color-brand-secondary: #004499;
  --color-brand-accent: #00aaff;

  /* Background Colors */
  --color-background-primary: #0f172a;
  --color-background-secondary: #1e293b;
  --color-background-tertiary: #334155;
  --color-background-elevated: #1e293b;

  /* Foreground Colors */
  --color-foreground-primary: #f8fafc;
  --color-foreground-secondary: #e2e8f0;
  --color-foreground-tertiary: #cbd5e1;
  --color-foreground-muted: #94a3b8;

  /* Border Colors */
  --color-border-primary: #334155;
  --color-border-secondary: #475569;
  --color-border-focus: #00aaff;

  /* Typography - Font Sizes */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;

  /* Typography - Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
}

/* Default theme (fallback) */
:root {
  /* Brand Colors */
  --color-brand-primary: #0066cc;
  --color-brand-secondary: #004499;
  --color-brand-accent: #00aaff;

  /* Background Colors */
  --color-background-primary: #f8fafc;
  --color-background-secondary: #f1f5f9;
  --color-background-tertiary: #e2e8f0;
  --color-background-elevated: #ffffff;

  /* Foreground Colors */
  --color-foreground-primary: #0f172a;
  --color-foreground-secondary: #334155;
  --color-foreground-tertiary: #475569;
  --color-foreground-muted: #64748b;

  /* Border Colors */
  --color-border-primary: #e2e8f0;
  --color-border-secondary: #cbd5e1;
  --color-border-focus: #0066cc;

  /* Typography - Font Sizes */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;

  /* Typography - Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
}

/* System preference support */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* Brand Colors */
    --color-brand-primary: #0066cc;
    --color-brand-secondary: #004499;
    --color-brand-accent: #00aaff;

    /* Background Colors */
    --color-background-primary: #0f172a;
    --color-background-secondary: #1e293b;
    --color-background-tertiary: #334155;
    --color-background-elevated: #1e293b;

    /* Foreground Colors */
    --color-foreground-primary: #f8fafc;
    --color-foreground-secondary: #e2e8f0;
    --color-foreground-tertiary: #cbd5e1;
    --color-foreground-muted: #94a3b8;

    /* Border Colors */
    --color-border-primary: #334155;
    --color-border-secondary: #475569;
    --color-border-focus: #00aaff;

    /* Typography - Font Sizes */
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;

    /* Typography - Font Weights */
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    /* Spacing */
    --spacing-1: 0.25rem;
    --spacing-2: 0.5rem;
    --spacing-3: 0.75rem;
    --spacing-4: 1rem;
    --spacing-5: 1.25rem;
    --spacing-6: 1.5rem;
    --spacing-8: 2rem;
  }
}
```

### Generated `design-tokens.js`
```javascript
// Main design tokens aggregator
import { getActiveTheme } from './active-theme.js';

const activeTheme = getActiveTheme();

export { coreTokens } from `./\${activeTheme}/core.js`;
export { lightTheme } from `./\${activeTheme}/light.js`;
export { darkTheme } from `./\${activeTheme}/dark.js`;

export { getActiveTheme, setActiveTheme, getAvailableThemes } from './active-theme.js';

// Theme application utilities
export function applyTheme(themeName, variant = 'light') {
  const fullThemeName = `\${themeName}-\${variant}`;
  document.documentElement.setAttribute('data-theme', fullThemeName);
  localStorage.setItem('devpages_active_theme', themeName);
  localStorage.setItem('devpages_theme_variant', variant);
}

export function initializeTheme() {
  const savedTheme = localStorage.getItem('devpages_active_theme') || 'corporate-blue';
  const savedVariant = localStorage.getItem('devpages_theme_variant') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  applyTheme(savedTheme, savedVariant);
}

export default {
  activeTheme,
  applyTheme,
  initializeTheme
};
```

## 🚀 **Usage in Your Application**

### 1. **HTML Setup**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevPages App</title>
    
    <!-- Include generated design tokens CSS -->
    <link rel="stylesheet" href="/themes/design-tokens.css">
    
    <!-- Your app styles -->
    <link rel="stylesheet" href="/styles/app.css">
</head>
<body>
    <div class="app">
        <nav class="navbar">
            <h1>DevPages</h1>
            
            <!-- Theme Selector -->
            <div class="theme-controls">
                <select id="theme-selector" onchange="changeTheme(this.value)">
                    <option value="corporate-blue">Corporate Blue</option>
                    <option value="nature-green">Nature Green</option>
                    <option value="sunset-orange">Sunset Orange</option>
                    <option value="royal-purple">Royal Purple</option>
                    <option value="minimal-gray">Minimal Gray</option>
                </select>
                
                <button id="variant-toggle" onclick="toggleVariant()">
                    🌙 Dark Mode
                </button>
            </div>
        </nav>
        
        <main class="content">
            <div class="card">
                <h2>Welcome to DevPages</h2>
                <p>This content automatically adapts to your selected theme.</p>
                <button class="btn btn-primary">Primary Action</button>
                <button class="btn btn-secondary">Secondary Action</button>
            </div>
        </main>
    </div>
    
    <script type="module" src="/js/theme-manager.js"></script>
</body>
</html>
```

### 2. **Application CSS Using Design Tokens**
```css
/* app.css - Uses the generated design tokens */

.app {
    background: var(--color-background-primary);
    color: var(--color-foreground-primary);
    min-height: 100vh;
    font-family: var(--font-family-sans, system-ui);
    transition: background-color 0.3s ease, color 0.3s ease;
}

.navbar {
    background: var(--color-background-elevated);
    border-bottom: 1px solid var(--color-border-primary);
    padding: var(--spacing-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.navbar h1 {
    color: var(--color-brand-primary);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    margin: 0;
}

.theme-controls {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
}

.theme-controls select {
    background: var(--color-background-secondary);
    color: var(--color-foreground-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: 4px;
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-size-sm);
}

.theme-controls button {
    background: var(--color-background-secondary);
    color: var(--color-foreground-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: 4px;
    padding: var(--spacing-2) var(--spacing-3);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all 0.2s ease;
}

.theme-controls button:hover {
    background: var(--color-brand-primary);
    color: white;
    border-color: var(--color-brand-primary);
}

.content {
    padding: var(--spacing-6);
    max-width: 800px;
    margin: 0 auto;
}

.card {
    background: var(--color-background-elevated);
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    padding: var(--spacing-6);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card h2 {
    color: var(--color-foreground-primary);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    margin: 0 0 var(--spacing-4) 0;
}

.card p {
    color: var(--color-foreground-secondary);
    font-size: var(--font-size-base);
    line-height: 1.6;
    margin: 0 0 var(--spacing-5) 0;
}

.btn {
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: 6px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.2s ease;
    margin-right: var(--spacing-3);
}

.btn-primary {
    background: var(--color-brand-primary);
    color: white;
    border: 1px solid var(--color-brand-primary);
}

.btn-primary:hover {
    background: var(--color-brand-secondary);
    border-color: var(--color-brand-secondary);
}

.btn-secondary {
    background: var(--color-background-secondary);
    color: var(--color-foreground-primary);
    border: 1px solid var(--color-border-primary);
}

.btn-secondary:hover {
    background: var(--color-background-tertiary);
    border-color: var(--color-border-secondary);
}
```

### 3. **JavaScript Theme Manager (DevPages Integration)**
```javascript
// theme-manager.js - Integrates with DevPages state management
import { applyTheme, initializeTheme } from '/themes/design-tokens.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { appStore } from '/client/appState.js';

let currentTheme = 'corporate-blue';
let currentVariant = 'light';

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    
    // Get current theme from DevPages store (not localStorage directly)
    const state = appStore.getState();
    const designTokens = state.settings?.designTokens || {};
    currentTheme = designTokens.activeTheme || 'corporate-blue';
    currentVariant = designTokens.themeVariant || 'light';
    
    // Subscribe to store changes
    appStore.subscribe((newState, prevState) => {
        if (newState.settings?.designTokens !== prevState.settings?.designTokens) {
            const designTokens = newState.settings.designTokens;
            currentTheme = designTokens.activeTheme;
            currentVariant = designTokens.themeVariant;
            
            // Update UI to reflect current theme
            updateThemeSelector();
            updateVariantToggle();
        }
    });
    
    // Initial UI update
    updateThemeSelector();
    updateVariantToggle();
});

function changeTheme(themeName) {
    // Use DevPages dispatch system instead of direct state manipulation
    dispatch({
        type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
        payload: themeName
    });
    
    console.log(`Theme change dispatched: ${themeName}`);
}

function toggleVariant() {
    const newVariant = currentVariant === 'light' ? 'dark' : 'light';
    
    // Use DevPages dispatch system
    dispatch({
        type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
        payload: newVariant
    });
    
    console.log(`Variant change dispatched: ${newVariant}`);
}

function updateThemeSelector() {
    const selector = document.getElementById('theme-selector');
    if (selector) {
        selector.value = currentTheme;
    }
}

function updateVariantToggle() {
    const toggle = document.getElementById('variant-toggle');
    if (toggle) {
        toggle.textContent = currentVariant === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }
}

// Make functions globally available
window.changeTheme = changeTheme;
window.toggleVariant = toggleVariant;

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = appStore.getState();
    const hasUserPreference = state.settings?.designTokens?.themeVariant;
    
    if (!hasUserPreference) {
        // Only auto-switch if user hasn't manually set a preference
        const systemVariant = e.matches ? 'dark' : 'light';
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
            payload: systemVariant
        });
    }
});
```

### 3b. **Standalone Theme Manager (Without DevPages)**
```javascript
// theme-manager-standalone.js - For use outside DevPages
import { applyTheme, initializeTheme } from '/themes/design-tokens.js';

let currentTheme = 'corporate-blue';
let currentVariant = 'light';

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    
    // Get current theme from localStorage (fallback approach)
    currentTheme = localStorage.getItem('devpages_active_theme') || 'corporate-blue';
    currentVariant = localStorage.getItem('devpages_theme_variant') || 'light';
    
    // Update UI to reflect current theme
    updateThemeSelector();
    updateVariantToggle();
});

function changeTheme(themeName) {
    currentTheme = themeName;
    applyTheme(currentTheme, currentVariant);
    console.log(`Theme changed to: ${currentTheme}-${currentVariant}`);
}

function toggleVariant() {
    currentVariant = currentVariant === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme, currentVariant);
    updateVariantToggle();
    console.log(`Variant changed to: ${currentVariant}`);
}

function updateThemeSelector() {
    const selector = document.getElementById('theme-selector');
    if (selector) {
        selector.value = currentTheme;
    }
}

function updateVariantToggle() {
    const toggle = document.getElementById('variant-toggle');
    if (toggle) {
        toggle.textContent = currentVariant === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }
}

// Make functions globally available
window.changeTheme = changeTheme;
window.toggleVariant = toggleVariant;

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('devpages_theme_variant')) {
        // Only auto-switch if user hasn't manually set a preference
        currentVariant = e.matches ? 'dark' : 'light';
        applyTheme(currentTheme, currentVariant);
        updateVariantToggle();
    }
});
```

## 🎨 **Key Benefits of This Integration**

### 1. **Follows Web Standards**
- Uses `data-theme` attributes (standard approach)
- CSS custom properties for theming
- System preference detection
- localStorage persistence

### 2. **Generated from Design System**
- All tokens generated from our ThemeDesignPanel
- Consistent naming conventions
- Semantic color system
- Typography and spacing scales

### 3. **Developer Friendly**
- Simple `applyTheme(themeName, variant)` API
- Automatic initialization
- System preference fallback
- Easy theme switching

### 4. **Performance Optimized**
- CSS variables (no stylesheet swapping)
- Smooth transitions
- No FOUC (Flash of Unstyled Content)
- Minimal JavaScript overhead

### 5. **Accessible**
- Respects `prefers-color-scheme`
- Proper contrast ratios in generated themes
- Semantic color naming
- Keyboard accessible controls

This integration shows how our design tokens system generates production-ready theme files that follow industry best practices while providing a superior developer experience. 