/**
 * TUT Core - Constants, defaults, and utilities
 */

// Storage keys
const TUT_STORAGE_KEY = 'tut-themes';
const TUT_ACTIVE_THEME_KEY = 'tut-active-theme';

// Token defaults - canonical values for all design tokens (TERRAIN-compatible)
const TUT_DEFAULT_TOKENS = {
    // Backgrounds
    '--bg-primary': '#0a0a0a',
    '--bg-secondary': '#1a1a1a',
    '--bg-tertiary': '#2a2a2a',
    '--bg-hover': '#3a3a3a',
    // Borders
    '--border': '#222222',
    '--border-visible': '#444444',
    '--border-active': '#4a9eff',
    // Text
    '--text-primary': '#ffffff',
    '--text-secondary': '#aaaaaa',
    '--text-muted': '#666666',
    '--text-code': '#00ffaa',
    // Accents
    '--accent-primary': '#4a9eff',
    '--accent-secondary': '#ff6b35',
    // Status
    '--success': '#00ff00',
    '--error': '#ff4444',
    '--warning': '#ffd700'
};

// Token groups for panel UI (derived from TUT_DEFAULT_TOKENS)
const TUT_TOKEN_GROUPS = {
    backgrounds: ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover'],
    borders: ['--border', '--border-visible', '--border-active'],
    text: ['--text-primary', '--text-secondary', '--text-muted', '--text-code'],
    accents: ['--accent-primary', '--accent-secondary', '--success', '--error', '--warning']
};

// Font defaults
const TUT_DEFAULT_FONTS = {
    heading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    code: "'Courier New', Monaco, monospace"
};

// Token metadata for export/inspection
const TUT_TOKEN_METADATA = {
    '--bg-primary': { type: 'color', description: 'Page background - darkest surface' },
    '--bg-secondary': { type: 'color', description: 'Panel/card background - elevated surface' },
    '--bg-tertiary': { type: 'color', description: 'Section/header background - highest elevation' },
    '--bg-hover': { type: 'color', description: 'Hover state background' },
    '--border': { type: 'color', description: 'Default border color' },
    '--border-visible': { type: 'color', description: 'Visible/emphasized border' },
    '--border-active': { type: 'color', description: 'Active/focused element border' },
    '--text-primary': { type: 'color', description: 'Main body text - high contrast' },
    '--text-secondary': { type: 'color', description: 'Supporting text - medium contrast' },
    '--text-muted': { type: 'color', description: 'Disabled/subtle text - low contrast' },
    '--text-code': { type: 'color', description: 'Code/monospace text color' },
    '--accent-primary': { type: 'color', description: 'Primary action color - links, buttons' },
    '--accent-secondary': { type: 'color', description: 'Secondary accent - highlights' },
    '--success': { type: 'color', description: 'Success/positive feedback' },
    '--error': { type: 'color', description: 'Error/danger feedback' },
    '--warning': { type: 'color', description: 'Warning/caution feedback' }
};

// Utility: RGB to Hex conversion
function tutRgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#000000';
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

// Utility: Show inline feedback (replaces alerts)
function tutShowFeedback(element, message, type = 'success') {
    const originalText = element.textContent;
    const feedbackClass = `feedback-${type}`;

    element.textContent = message;
    element.classList.add(feedbackClass);

    setTimeout(() => {
        element.textContent = originalText;
        element.classList.remove(feedbackClass);
    }, 2000);
}

// Utility: Show inline error in container
function tutShowInlineError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let errorEl = container.querySelector('.inline-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'inline-error theme-feedback error';
        container.appendChild(errorEl);
    }

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 5000);
}
