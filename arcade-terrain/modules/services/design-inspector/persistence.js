/**
 * DesignInspector Persistence Layer
 * Storage, export, and import functionality
 */

import { STORAGE_KEY, createEmptyOverrides } from './config.js';
import { getCurrentTheme } from './selectors.js';

/**
 * Load overrides from localStorage
 */
export function loadOverrides() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.global || parsed.themes) {
        return {
          global: parsed.global || {},
          themes: parsed.themes || {},
          selectorMap: parsed.selectorMap || {}
        };
      } else {
        // Migrate old format
        return { global: {}, themes: parsed, selectorMap: {} };
      }
    }
  } catch (e) {
    console.error('[DesignInspector] Failed to load overrides:', e);
  }
  return createEmptyOverrides();
}

/**
 * Save overrides to localStorage
 */
export function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    console.log('[DesignInspector] Saved overrides');
  } catch (e) {
    console.error('[DesignInspector] Failed to save overrides:', e);
  }
}

/**
 * Create style element for applying overrides
 */
export function createStyleElement() {
  let style = document.getElementById('design-inspector-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'design-inspector-styles';
    document.head.appendChild(style);
  }
  return style;
}

/**
 * Apply overrides to the style element
 */
export function applyOverrides(overrides, styleElement) {
  const theme = getCurrentTheme();
  const globalOverrides = overrides.global || {};
  const themeOverrides = overrides.themes?.[theme] || {};

  if (!styleElement) return;

  // Merge global and theme overrides
  const mergedBySelector = {};

  for (const [selector, props] of Object.entries(globalOverrides)) {
    if (!mergedBySelector[selector]) mergedBySelector[selector] = {};
    Object.assign(mergedBySelector[selector], props);
  }

  for (const [selector, props] of Object.entries(themeOverrides)) {
    if (!mergedBySelector[selector]) mergedBySelector[selector] = {};
    Object.assign(mergedBySelector[selector], props);
  }

  if (Object.keys(mergedBySelector).length === 0) {
    styleElement.textContent = '';
    return;
  }

  let css = `/* DesignInspector overrides */\n/* Global + Theme: ${theme} */\n`;

  for (const [selector, props] of Object.entries(mergedBySelector)) {
    const propStrings = Object.entries(props)
      .map(([prop, val]) => `  ${prop}: ${val} !important;`)
      .join('\n');
    css += `${selector} {\n${propStrings}\n}\n`;
  }

  styleElement.textContent = css;
  console.log('[DesignInspector] Applied overrides for theme:', theme);
}

/**
 * Export overrides as JSON file
 */
export function exportJSON(overrides) {
  const data = JSON.stringify(overrides, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `design-overrides-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('[DesignInspector] Exported JSON');
}

/**
 * Export overrides as CSS file
 */
export function exportCSS(overrides) {
  const selectorMap = overrides.selectorMap || {};
  let css = '';

  const toCssSelector = (runtimeSel) => selectorMap[runtimeSel] || runtimeSel;

  // Global overrides
  const globalOverrides = overrides.global || {};
  if (Object.keys(globalOverrides).length > 0) {
    css += `/* ===========================================\n`;
    css += `   Global Overrides (all themes)\n`;
    css += `   =========================================== */\n\n`;

    for (const [selector, props] of Object.entries(globalOverrides)) {
      const cssSelector = toCssSelector(selector);
      const propStrings = Object.entries(props)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
      css += `${cssSelector} {\n${propStrings}\n}\n\n`;
    }
  }

  // Theme-specific overrides
  const themeOverrides = overrides.themes || {};
  for (const [themeName, selectors] of Object.entries(themeOverrides)) {
    if (Object.keys(selectors).length === 0) continue;

    css += `/* ===========================================\n`;
    css += `   Theme: ${themeName}\n`;
    css += `   =========================================== */\n\n`;

    for (const [selector, props] of Object.entries(selectors)) {
      const cssSelector = toCssSelector(selector);
      const propStrings = Object.entries(props)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join('\n');
      css += `[data-theme="${themeName}"] ${cssSelector} {\n${propStrings}\n}\n\n`;
    }
  }

  // Copy to clipboard
  navigator.clipboard.writeText(css).then(() => {
    console.log('[DesignInspector] CSS copied to clipboard');
  });

  // Download file
  const blob = new Blob([css], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `design-overrides-${Date.now()}.css`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import overrides from JSON file
 * Returns a promise that resolves with the imported data
 */
export function importJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          console.log('[DesignInspector] Imported JSON');
          resolve(data);
        } catch (err) {
          console.error('[DesignInspector] Import failed:', err);
          reject(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

/**
 * Store override for a property
 */
export function storeOverride(overrides, selector, prop, value, scope, theme) {
  if (scope === 'theme') {
    if (!overrides.themes[theme]) overrides.themes[theme] = {};
    if (!overrides.themes[theme][selector]) overrides.themes[theme][selector] = {};
    if (value) {
      overrides.themes[theme][selector][prop] = value;
    } else {
      delete overrides.themes[theme][selector][prop];
    }
  } else {
    if (!overrides.global[selector]) overrides.global[selector] = {};
    if (value) {
      overrides.global[selector][prop] = value;
    } else {
      delete overrides.global[selector][prop];
    }
  }
  return overrides;
}

/**
 * Clear overrides for a specific element
 */
export function clearElementOverrides(overrides, selector, theme) {
  const globalProps = overrides.global?.[selector] || {};
  const themeProps = overrides.themes?.[theme]?.[selector] || {};

  const allProps = [...Object.keys(globalProps), ...Object.keys(themeProps)];

  if (overrides.global?.[selector]) {
    delete overrides.global[selector];
  }
  if (overrides.themes?.[theme]?.[selector]) {
    delete overrides.themes[theme][selector];
  }

  return { overrides, clearedProps: allProps };
}
