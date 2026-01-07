/**
 * Theme Service
 * Manages theme switching with localStorage persistence
 */

const STORAGE_KEY = 'pja-theme';
const THEMES = ['lava', 'tv', 'lcd', 'cyber'];
const DEFAULT_THEME = 'lava';

let currentTheme = DEFAULT_THEME;
const subscribers = new Set();

/**
 * Initialize theme service
 * Reads from localStorage and applies to document
 */
function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  currentTheme = THEMES.includes(saved) ? saved : DEFAULT_THEME;
  apply(currentTheme);
  console.log('[ThemeService] Initialized with theme:', currentTheme);
}

/**
 * Get current theme
 */
function get() {
  return currentTheme;
}

/**
 * Get list of available themes
 */
function getThemes() {
  return [...THEMES];
}

/**
 * Set and apply theme
 */
function set(theme) {
  if (!THEMES.includes(theme)) {
    console.warn('[ThemeService] Invalid theme:', theme);
    return false;
  }

  const oldTheme = currentTheme;
  if (oldTheme === theme) return true;

  currentTheme = theme;
  apply(theme);
  persist(theme);
  notify(theme, oldTheme);

  return true;
}

/**
 * Cycle to next theme
 */
function next() {
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  set(THEMES[nextIndex]);
  return currentTheme;
}

/**
 * Apply theme to document
 */
function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update CSS custom properties root if needed
  document.documentElement.style.setProperty('--current-theme', theme);
}

/**
 * Persist theme to localStorage
 */
function persist(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    console.warn('[ThemeService] Could not persist theme:', e);
  }
}

/**
 * Subscribe to theme changes
 * Callback receives (newTheme, oldTheme)
 */
function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Notify subscribers of theme change
 */
function notify(newTheme, oldTheme) {
  subscribers.forEach(fn => fn(newTheme, oldTheme));

  // Dispatch DOM event for non-JS integrations
  window.dispatchEvent(new CustomEvent('pja:theme-change', {
    detail: { theme: newTheme, previous: oldTheme }
  }));
}

export const ThemeService = {
  init,
  get,
  set,
  next,
  getThemes,
  subscribe,
  THEMES,
  DEFAULT_THEME
};
