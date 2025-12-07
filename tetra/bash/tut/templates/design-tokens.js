// Design Token Editor - JavaScript

// =============================================================================
// CODE COPY BUTTONS (runs on all pages)
// =============================================================================

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        // Add copy buttons to all pre elements
        document.querySelectorAll('pre').forEach(pre => {
            // Skip if already has a copy button
            if (pre.querySelector('.code-copy-btn')) return;

            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.textContent = 'Copy';
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const code = pre.querySelector('code');
                const text = code ? code.textContent : pre.textContent;

                try {
                    await navigator.clipboard.writeText(text);
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                        btn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    btn.textContent = 'Failed';
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                    }, 2000);
                }
            });
            pre.appendChild(btn);
        });

        // Click-to-copy for inline code elements (not inside pre)
        document.querySelectorAll('code').forEach(code => {
            // Skip code inside pre blocks
            if (code.closest('pre')) return;

            code.title = 'Click to copy';
            code.addEventListener('click', async () => {
                const text = code.textContent;

                try {
                    await navigator.clipboard.writeText(text);
                    code.classList.add('copied');
                    const original = code.textContent;
                    code.textContent = 'Copied!';
                    setTimeout(() => {
                        code.textContent = original;
                        code.classList.remove('copied');
                    }, 1000);
                } catch (err) {
                    // Silent fail
                }
            });
        });
    });
})();

// =============================================================================
// INITIALIZATION & DESIGN MODE CHECK
// =============================================================================

(function() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('design')) {
        // Hide FAB and panel if design mode not enabled
        const style = document.createElement('style');
        style.textContent = '.design-fab, .design-panel, #elementInspectorPanel { display: none !important; }';
        document.head.appendChild(style);
    } else {
        // Design mode enabled
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize theme system
            initThemeSystem();

            // Restore sidebar position preference
            restoreSidebarPosition();

            // Collapse all sections by default
            document.querySelectorAll('.token-section').forEach(section => {
                section.classList.add('collapsed');
                const toggle = section.querySelector('.section-toggle');
                if (toggle) toggle.textContent = '▶';
            });
        });
    }
})();

// =============================================================================
// CONSTANTS & DEFAULTS - SINGLE SOURCE OF TRUTH
// These values are authoritative. HTML attributes are fallbacks only.
// =============================================================================

const THEME_STORAGE_KEY = 'tut-themes';
const ACTIVE_THEME_KEY = 'tut-active-theme';

// Token defaults - canonical values for all design tokens
// NOTE: HTML color pickers have matching value="" attributes as fallback,
// but these values are initialized from JS on load.
const defaultTokens = {
    // Backgrounds
    '--bg-primary': '#1a1a2e',
    '--bg-secondary': '#16213e',
    '--bg-tertiary': '#0d1b2a',
    // Text
    '--text-title': '#eaeaea',
    '--text-primary': '#c0c0d0',
    '--text-secondary': '#8a8aa0',
    '--text-code': '#ff6b6b',
    // Accents
    '--accent-primary': '#e94560',
    '--accent-secondary': '#3b82c4',
    // Status
    '--success': '#4ade80',
    '--warning': '#fbbf24',
    '--error': '#f87171',
    // Structure
    '--border': '#2a2a4a',
    '--highlight': 'rgba(233, 69, 96, 0.15)'
};

// Font defaults
const defaultFonts = {
    heading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    code: "'Courier New', Monaco, monospace"
};

// Track loaded Google Fonts
const loadedGoogleFonts = [];

// =============================================================================
// INLINE FEEDBACK (replaces alerts)
// =============================================================================

function showFeedback(element, message, type = 'success') {
    const originalText = element.textContent;
    const feedbackClass = `feedback-${type}`;

    element.textContent = message;
    element.classList.add(feedbackClass);

    setTimeout(() => {
        element.textContent = originalText;
        element.classList.remove(feedbackClass);
    }, 2000);
}

function showInlineError(containerId, message) {
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

// =============================================================================
// PANEL CONTROLS
// =============================================================================

function toggleDesignPanel() {
    const panel = document.getElementById('designPanel');
    panel.classList.toggle('visible');
}

function toggleSection(sectionName) {
    const section = document.querySelector(`[data-section="${sectionName}"]`);
    if (!section) return;

    section.classList.toggle('collapsed');
    const toggle = section.querySelector('.section-toggle');
    if (toggle) {
        toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
    }
}

// =============================================================================
// THEME METADATA
// =============================================================================

function getThemeMetadata() {
    return {
        name: document.getElementById('themeName')?.value || 'my-theme',
        version: document.getElementById('themeVersion')?.value || '1.0.0',
        description: document.getElementById('themeDescription')?.value || 'Custom theme',
        author: document.getElementById('themeAuthor')?.value || 'Designer',
        temperature: document.getElementById('themeTemperature')?.value || 'neutral',
        colorMode: document.getElementById('themeColorMode')?.value || 'dark'
    };
}

function setThemeMetadata(metadata) {
    if (metadata.name) document.getElementById('themeName').value = metadata.name;
    if (metadata.version) document.getElementById('themeVersion').value = metadata.version;
    if (metadata.description) document.getElementById('themeDescription').value = metadata.description;
    if (metadata.author) document.getElementById('themeAuthor').value = metadata.author;
    if (metadata.temperature) document.getElementById('themeTemperature').value = metadata.temperature;
    if (metadata.colorMode) document.getElementById('themeColorMode').value = metadata.colorMode;
}

// =============================================================================
// TOKEN UPDATES
// =============================================================================

function updateToken(tokenName, value) {
    document.documentElement.style.setProperty(tokenName, value);
    const displayId = 'token-' + tokenName.replace('--', '').replace(/-/g, '-');
    const displayEl = document.getElementById(displayId);
    if (displayEl) {
        displayEl.textContent = value;
    }

    // Update corresponding color picker using data-token attribute
    const picker = document.querySelector(`input[data-token="${tokenName}"]`);
    if (picker) {
        picker.value = value;
    }

    // Auto-save to active theme if one is selected
    autoSaveCurrentTheme();
}

function updateSectionBorder(style) {
    const root = document.documentElement;
    switch(style) {
        case 'left':
            root.style.setProperty('--section-border-width', '0 0 0 4px');
            root.style.setProperty('--section-border-color', 'var(--accent-primary)');
            break;
        case 'full-muted':
            root.style.setProperty('--section-border-width', '1px');
            root.style.setProperty('--section-border-color', 'var(--border)');
            break;
        case 'full-accent':
            root.style.setProperty('--section-border-width', '1px');
            root.style.setProperty('--section-border-color', 'var(--accent-primary)');
            break;
        case 'none':
            root.style.setProperty('--section-border-width', '0');
            break;
    }
}

function updateSectionRadius(value) {
    document.documentElement.style.setProperty('--section-border-radius', value + 'px');
    const display = document.getElementById('sectionRadiusValue');
    if (display) display.textContent = value + 'px';
}

function updateSidebarPosition(position) {
    document.body.setAttribute('data-sidebar-position', position);
    localStorage.setItem('tut-sidebar-position', position);
}

function restoreSidebarPosition() {
    const saved = localStorage.getItem('tut-sidebar-position');
    const current = document.body.getAttribute('data-sidebar-position');
    const position = saved || current || 'right';

    document.body.setAttribute('data-sidebar-position', position);
    const select = document.getElementById('sidebarPosition');
    if (select) select.value = position;
}

function updateFont(type, font) {
    switch(type) {
        case 'heading':
            document.querySelectorAll('h1, h2, h3, .step-number').forEach(el => {
                el.style.fontFamily = font;
            });
            break;
        case 'body':
            document.body.style.fontFamily = font;
            break;
        case 'code':
            document.querySelectorAll('code, .command-hint, .terminal-content, .token-name, .token-value').forEach(el => {
                el.style.fontFamily = font;
            });
            break;
    }
}

// =============================================================================
// LOCALSTORAGE THEME SYSTEM
// =============================================================================

function initThemeSystem() {
    // Load saved themes and populate dropdown
    updateThemeDropdown();

    // Load active theme if set
    const activeTheme = localStorage.getItem(ACTIVE_THEME_KEY);
    if (activeTheme) {
        const themes = getSavedThemes();
        if (themes[activeTheme]) {
            applyTheme(themes[activeTheme]);
            const dropdown = document.getElementById('themeSwitcher');
            if (dropdown) dropdown.value = activeTheme;
        }
    }
}

function getSavedThemes() {
    try {
        return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveThemeToStorage(theme) {
    const themes = getSavedThemes();
    const themeName = theme.metadata.name;
    themes[themeName] = theme;
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
    localStorage.setItem(ACTIVE_THEME_KEY, themeName);
    updateThemeDropdown();
    return themeName;
}

function deleteThemeFromStorage(themeName) {
    const themes = getSavedThemes();
    delete themes[themeName];
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));

    if (localStorage.getItem(ACTIVE_THEME_KEY) === themeName) {
        localStorage.removeItem(ACTIVE_THEME_KEY);
    }
    updateThemeDropdown();
}

function updateThemeDropdown() {
    const dropdown = document.getElementById('themeSwitcher');
    if (!dropdown) return;

    const themes = getSavedThemes();
    const activeTheme = localStorage.getItem(ACTIVE_THEME_KEY);

    // Clear existing options except first
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }

    // Add saved themes
    Object.keys(themes).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === activeTheme) option.selected = true;
        dropdown.appendChild(option);
    });
}

function switchTheme(themeName) {
    if (!themeName) {
        // Reset to defaults
        resetTokens();
        localStorage.removeItem(ACTIVE_THEME_KEY);
        return;
    }

    const themes = getSavedThemes();
    if (themes[themeName]) {
        applyTheme(themes[themeName]);
        localStorage.setItem(ACTIVE_THEME_KEY, themeName);
    }
}

function applyTheme(theme) {
    // Apply metadata
    if (theme.metadata) {
        setThemeMetadata(theme.metadata);
    }

    // Apply tokens
    if (theme.tokens) {
        Object.entries(theme.tokens).forEach(([tokenId, tokenData]) => {
            const cssVar = tokenData.cssVar || `--${tokenId}`;
            if (defaultTokens.hasOwnProperty(cssVar)) {
                // Update without triggering auto-save
                document.documentElement.style.setProperty(cssVar, tokenData.value);
                const displayId = 'token-' + cssVar.replace('--', '').replace(/-/g, '-');
                const displayEl = document.getElementById(displayId);
                if (displayEl) displayEl.textContent = tokenData.value;
                const picker = document.querySelector(`input[data-token="${cssVar}"]`);
                if (picker) picker.value = tokenData.value;
            }
        });
    }
}

function autoSaveCurrentTheme() {
    const activeTheme = localStorage.getItem(ACTIVE_THEME_KEY);
    if (!activeTheme) return;

    // Debounce auto-save
    clearTimeout(window._autoSaveTimeout);
    window._autoSaveTimeout = setTimeout(() => {
        const theme = buildThemeObject();
        const themes = getSavedThemes();
        themes[activeTheme] = theme;
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
    }, 500);
}

function saveCurrentTheme() {
    const theme = buildThemeObject();
    const themeName = saveThemeToStorage(theme);

    const btn = document.getElementById('saveThemeBtn');
    if (btn) showFeedback(btn, `✓ Saved: ${themeName}`, 'success');
}

function deleteCurrentTheme() {
    const dropdown = document.getElementById('themeSwitcher');
    const themeName = dropdown?.value;

    if (!themeName) return;

    deleteThemeFromStorage(themeName);
    dropdown.value = '';
    resetTokens();

    const btn = document.getElementById('deleteThemeBtn');
    if (btn) showFeedback(btn, '✓ Deleted', 'success');
}

// =============================================================================
// TOKEN METADATA
// =============================================================================

const tokenMetadata = {
    '--bg-primary': {
        type: 'color',
        tdsToken: 'structural.bg.primary',
        description: 'Page background - darkest surface',
        appliesTo: ['body', '.page'],
        contrastWith: ['text-primary', 'text-secondary']
    },
    '--bg-secondary': {
        type: 'color',
        tdsToken: 'structural.bg.secondary',
        description: 'Panel/card background - elevated surface',
        appliesTo: ['.panel', '.card', '.modal']
    },
    '--bg-tertiary': {
        type: 'color',
        tdsToken: 'structural.bg.tertiary',
        description: 'Section/header background - highest elevation',
        appliesTo: ['.header', '.section', '.toolbar']
    },
    '--text-primary': {
        type: 'color',
        tdsToken: 'text.primary',
        description: 'Main body text - high contrast',
        appliesTo: ['body', 'p', 'li'],
        contrastWith: ['bg-primary', 'bg-secondary']
    },
    '--text-secondary': {
        type: 'color',
        tdsToken: 'text.secondary',
        description: 'Supporting text - medium contrast',
        appliesTo: ['.subtitle', '.caption', '.meta']
    },
    '--accent-primary': {
        type: 'color',
        tdsToken: 'interactive.link',
        description: 'Primary action color - links, buttons',
        appliesTo: ['a', '.btn-primary', 'h1']
    },
    '--accent-secondary': {
        type: 'color',
        tdsToken: 'structural.secondary',
        description: 'Secondary accent - button fills, selection',
        appliesTo: ['.btn', '.selected']
    },
    '--success': {
        type: 'color',
        tdsToken: 'status.success',
        description: 'Success/positive feedback',
        appliesTo: ['.success', '.output-success', '.valid']
    },
    '--warning': {
        type: 'color',
        tdsToken: 'status.warning',
        description: 'Warning/caution feedback',
        appliesTo: ['.warning', '.output-warning', '.you-try']
    },
    '--error': {
        type: 'color',
        tdsToken: 'status.error',
        description: 'Error/danger feedback',
        appliesTo: ['.error', '.output-error', '.invalid']
    },
    '--border': {
        type: 'color',
        tdsToken: 'structural.separator',
        description: 'Borders and dividers',
        appliesTo: ['.panel', '.card', 'hr', 'code']
    },
    '--highlight': {
        type: 'color',
        tdsToken: 'interactive.hover',
        description: 'Selection/hover highlight (semi-transparent)',
        appliesTo: ['.highlight', '::selection']
    }
};

// =============================================================================
// BUILD THEME OBJECT
// =============================================================================

function buildThemeObject() {
    const style = getComputedStyle(document.documentElement);
    const metadata = getThemeMetadata();

    // Build tokens object
    const tokens = {};
    Object.keys(defaultTokens).forEach(cssVar => {
        const value = style.getPropertyValue(cssVar).trim();
        const tokenId = cssVar.replace('--', '');
        const meta = tokenMetadata[cssVar] || {};

        tokens[tokenId] = {
            value: value,
            type: meta.type || 'color',
            cssVar: cssVar,
            tdsToken: meta.tdsToken || '',
            description: meta.description || '',
            appliesTo: meta.appliesTo || [],
            ...(meta.contrastWith ? { contrastWith: meta.contrastWith } : {})
        };
    });

    return {
        "$schema": "./design-tokens.schema.json",
        metadata: metadata,
        tokens: tokens,
        groups: [
            { id: "backgrounds", name: "Background Colors", description: "Surface colors forming the visual depth hierarchy", tokens: ["bg-primary", "bg-secondary", "bg-tertiary"], order: 1 },
            { id: "text", name: "Text Colors", description: "Typography colors for content hierarchy", tokens: ["text-primary", "text-secondary"], order: 2 },
            { id: "accents", name: "Accent Colors", description: "Interactive and emphasis colors", tokens: ["accent-primary", "accent-secondary"], order: 3 },
            { id: "status", name: "Status Colors", description: "Feedback and state indication", tokens: ["success", "warning", "error"], order: 4 },
            { id: "structure", name: "Structural Colors", description: "Borders, dividers, and highlights", tokens: ["border", "highlight"], order: 5 }
        ],
        layout: {
            surfaces: { page: { background: "bg-primary" }, panel: { background: "bg-secondary", border: "border" }, header: { background: "bg-tertiary", border: "border" } },
            typography: { heading: { foreground: "text-primary", accent: "accent-primary" }, body: { foreground: "text-secondary" }, code: { background: "bg-tertiary", foreground: "accent-primary", border: "border" } },
            interactive: { "button-primary": { background: "accent-secondary", foreground: "text-primary" }, link: { foreground: "accent-primary" } },
            feedback: { "success-box": { border: "success", background: "bg-tertiary" }, "warning-box": { border: "warning", background: "bg-tertiary" }, "error-box": { border: "error", background: "bg-tertiary" } }
        },
        tdsMapping: {
            "--bg-primary": "structural.bg.primary", "--bg-secondary": "structural.bg.secondary", "--bg-tertiary": "structural.bg.tertiary",
            "--text-primary": "text.primary", "--text-secondary": "text.secondary",
            "--accent-primary": "interactive.link", "--accent-secondary": "structural.secondary",
            "--success": "status.success", "--warning": "status.warning", "--error": "status.error",
            "--border": "structural.separator", "--highlight": "interactive.hover"
        }
    };
}

// =============================================================================
// EXPORT - FILE DOWNLOAD
// =============================================================================

function exportTheme() {
    const theme = buildThemeObject();
    const themeName = theme.metadata.name;
    const jsonOutput = JSON.stringify(theme, null, 2);

    // Download as file
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${themeName}.tokens.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const btn = document.getElementById('exportThemeBtn');
    if (btn) showFeedback(btn, '✓ Downloaded', 'success');
}

function copyCSS() {
    const tokens = Object.keys(defaultTokens);
    const style = getComputedStyle(document.documentElement);

    let cssOutput = ':root {\n';
    tokens.forEach(token => {
        const value = style.getPropertyValue(token).trim();
        cssOutput += `    ${token}: ${value};\n`;
    });
    cssOutput += '}\n';

    // Add Google Fonts CDN URLs
    if (loadedGoogleFonts.length > 0) {
        cssOutput += '\n/* Google Fonts */\n';
        loadedGoogleFonts.forEach(font => {
            cssOutput += `/* GoogleFont: ${font.fontFamily} | ${font.cdnUrl} */\n`;
        });
    }

    navigator.clipboard.writeText(cssOutput).then(() => {
        const btn = document.getElementById('copyCSSBtn');
        if (btn) showFeedback(btn, '✓ Copied', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        const btn = document.getElementById('copyCSSBtn');
        if (btn) showFeedback(btn, '✗ Failed', 'error');
    });
}

// =============================================================================
// IMPORT - FILE UPLOAD
// =============================================================================

function importTheme() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const theme = JSON.parse(event.target.result);
                applyTheme(theme);
                saveThemeToStorage(theme);

                const btn = document.getElementById('importThemeBtn');
                if (btn) showFeedback(btn, `✓ Loaded: ${theme.metadata?.name || 'theme'}`, 'success');
            } catch (err) {
                console.error('Failed to parse theme:', err);
                showInlineError('importExportSection', 'Invalid JSON file format');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// =============================================================================
// RESET
// =============================================================================

function resetTokens() {
    // Reset colors
    Object.entries(defaultTokens).forEach(([token, value]) => {
        document.documentElement.style.setProperty(token, value);
        const displayId = 'token-' + token.replace('--', '').replace(/-/g, '-');
        const displayEl = document.getElementById(displayId);
        if (displayEl) displayEl.textContent = value;
        const picker = document.querySelector(`input[data-token="${token}"]`);
        if (picker) picker.value = value;
    });

    // Reset fonts
    const headingFont = document.getElementById('headingFont');
    const bodyFont = document.getElementById('bodyFont');
    const codeFont = document.getElementById('codeFont');

    if (headingFont) headingFont.value = defaultFonts.heading;
    if (bodyFont) bodyFont.value = defaultFonts.body;
    if (codeFont) codeFont.value = defaultFonts.code;

    updateFont('heading', defaultFonts.heading);
    updateFont('body', defaultFonts.body);
    updateFont('code', defaultFonts.code);

    // Reset metadata
    document.getElementById('themeName').value = 'my-theme';
    document.getElementById('themeVersion').value = '1.0.0';
    document.getElementById('themeDescription').value = 'Custom theme';
    document.getElementById('themeAuthor').value = 'Designer';

    const btn = document.getElementById('resetTokensBtn');
    if (btn) showFeedback(btn, '✓ Reset', 'success');
}

// =============================================================================
// GOOGLE FONTS
// =============================================================================

function toggleFontExample() {
    const content = document.getElementById('fontExampleContent');
    const toggle = document.querySelector('.font-example-toggle');

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.innerHTML = '&#9656; Show example';
    } else {
        content.classList.add('expanded');
        toggle.innerHTML = '&#9662; Hide example';
    }
}

function parseGoogleFontsEmbed(embedCode) {
    // Extract the CSS URL from the embed code
    const hrefMatch = embedCode.match(/href=["']([^"']+fonts\.googleapis\.com\/css2[^"']+)["']/);
    if (!hrefMatch) return null;

    const cdnUrl = hrefMatch[1];

    // Parse all font families from the URL (handles family=Font1&family=Font2 format)
    const urlParams = new URL(cdnUrl).searchParams;
    const families = urlParams.getAll('family');

    if (families.length === 0) return null;

    // Parse each font family entry
    const fonts = families.map(familyStr => {
        // Format: "FontName:ital,wght@0,200..700;1,200..700" or "FontName:wght@100..900"
        const [nameWithPlus] = familyStr.split(':');
        const fontName = decodeURIComponent(nameWithPlus.replace(/\+/g, ' '));

        // Detect font category based on name
        const nameLower = fontName.toLowerCase();
        let fallback = 'sans-serif';
        let category = 'body'; // Default dropdown target

        if (nameLower.includes('mono') || nameLower.includes('code') || nameLower.includes('cascadia')) {
            fallback = 'monospace';
            category = 'code';
        } else if (nameLower.includes('serif') && !nameLower.includes('sans')) {
            fallback = 'serif';
        }

        return {
            fontName,
            fontFamily: `'${fontName}', ${fallback}`,
            fallback,
            category
        };
    });

    return { cdnUrl, fonts };
}

function addGoogleFont() {
    const embedCode = document.getElementById('fontEmbedCode').value.trim();
    const btn = document.querySelector('.add-font-btn');

    if (!embedCode) {
        if (btn) showFeedback(btn, 'Paste embed code first', 'error');
        return;
    }

    // Add preconnect links if not already present
    const preconnects = [
        { href: 'https://fonts.googleapis.com', crossorigin: false },
        { href: 'https://fonts.gstatic.com', crossorigin: true }
    ];

    preconnects.forEach(({ href, crossorigin }) => {
        if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = href;
            if (crossorigin) link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        }
    });

    const parsed = parseGoogleFontsEmbed(embedCode);
    if (!parsed) {
        if (btn) showFeedback(btn, 'Invalid embed code', 'error');
        return;
    }

    const { cdnUrl, fonts } = parsed;

    // Create the stylesheet link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cdnUrl;
    link.id = 'custom-font-' + Date.now();
    document.head.appendChild(link);

    link.onload = () => {
        // Add all fonts to the dropdowns
        fonts.forEach(font => {
            const { fontName, fontFamily, category } = font;

            // Track loaded font
            const existing = loadedGoogleFonts.find(f => f.fontFamily === fontFamily);
            if (!existing) {
                loadedGoogleFonts.push({ cdnUrl, fontFamily, fontName });
            }

            // Add to all relevant dropdowns
            ['headingFont', 'bodyFont', 'codeFont'].forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;

                const existingOption = Array.from(select.options).find(opt => opt.value === fontFamily);
                if (!existingOption) {
                    const option = document.createElement('option');
                    option.value = fontFamily;
                    option.textContent = fontName + ' (Custom)';
                    select.insertBefore(option, select.firstChild);
                }
            });
        });

        // Auto-assign fonts by category
        const monoFont = fonts.find(f => f.category === 'code');
        const sansFont = fonts.find(f => f.category === 'body' && f.fallback === 'sans-serif');

        if (monoFont) {
            const codeSelect = document.getElementById('codeFont');
            if (codeSelect) {
                codeSelect.value = monoFont.fontFamily;
                updateFont('code', monoFont.fontFamily);
            }
        }

        if (sansFont) {
            const headingSelect = document.getElementById('headingFont');
            const bodySelect = document.getElementById('bodyFont');
            if (headingSelect) {
                headingSelect.value = sansFont.fontFamily;
                updateFont('heading', sansFont.fontFamily);
            }
            if (bodySelect) {
                bodySelect.value = sansFont.fontFamily;
                updateFont('body', sansFont.fontFamily);
            }
        }

        const fontNames = fonts.map(f => f.fontName).join(', ');
        if (btn) showFeedback(btn, `✓ ${fonts.length} font${fonts.length > 1 ? 's' : ''} added`, 'success');
        document.getElementById('fontEmbedCode').value = '';
    };

    link.onerror = () => {
        link.remove();
        if (btn) showFeedback(btn, 'Failed to load', 'error');
    };
}

// =============================================================================
// CLOSE PANEL ON OUTSIDE CLICK
// =============================================================================

document.addEventListener('click', (e) => {
    const panel = document.getElementById('designPanel');
    const fab = document.getElementById('designFab');
    if (panel && panel.classList.contains('visible') &&
        !panel.contains(e.target) &&
        !fab.contains(e.target)) {
        panel.classList.remove('visible');
    }
});

// =============================================================================
// ELEMENT INSPECTOR (Shift-Hold)
// =============================================================================

(function() {
    let longPressTimer = null;
    let progressTimer = null;
    let currentElement = null;
    let progressOverlay = null;
    let startTime = 0;
    const LONG_PRESS_DURATION = 1000;

    function createProgressOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; pointer-events: none; border: 3px solid var(--accent-primary); border-radius: 4px; background: radial-gradient(circle, transparent 0%, rgba(88, 166, 255, 0.1) 100%); z-index: 10000; transition: opacity 0.2s;`;
        overlay.innerHTML = `<div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: var(--bg-secondary); border: 2px solid var(--accent-primary); border-radius: 20px; padding: 4px 12px; font-size: 11px; font-family: 'Courier New', monospace; color: var(--accent-primary); white-space: nowrap;"><span class="progress-text">0.0s / 1.0s</span></div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    function updateProgressOverlay(element, progress) {
        if (!progressOverlay) return;
        const rect = element.getBoundingClientRect();
        progressOverlay.style.left = rect.left + 'px';
        progressOverlay.style.top = rect.top + 'px';
        progressOverlay.style.width = rect.width + 'px';
        progressOverlay.style.height = rect.height + 'px';
        const elapsed = (progress * LONG_PRESS_DURATION / 100) / 1000;
        const progressText = progressOverlay.querySelector('.progress-text');
        if (progressText) progressText.textContent = `${elapsed.toFixed(1)}s / 1.0s`;
        const alpha = Math.min(0.3, progress / 100 * 0.3);
        progressOverlay.style.background = `radial-gradient(circle, rgba(88, 166, 255, ${alpha}) 0%, rgba(88, 166, 255, ${alpha * 0.3}) 100%)`;
    }

    function getXPath(element) {
        if (element.id) return `//*[@id="${element.id}"]`;
        if (element === document.body) return '/html/body';
        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                const parentPath = element.parentNode ? getXPath(element.parentNode) : '';
                return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
        }
        return '';
    }

    function extractDesignTokens(element) {
        const computed = window.getComputedStyle(element);
        return {
            element: { tag: element.tagName.toLowerCase(), classes: Array.from(element.classList).join(', ') || 'none', id: element.id || 'none', xpath: getXPath(element) },
            colors: { background: computed.backgroundColor, color: computed.color, borderColor: computed.borderTopColor },
            typography: { fontFamily: computed.fontFamily, fontSize: computed.fontSize, fontWeight: computed.fontWeight, lineHeight: computed.lineHeight, letterSpacing: computed.letterSpacing },
            spacing: { padding: computed.padding, margin: computed.margin },
            border: { width: computed.borderWidth, style: computed.borderStyle, radius: computed.borderRadius },
            layout: { display: computed.display, width: computed.width, height: computed.height }
        };
    }

    function displayElementTokens(element, tokens) {
        let inspectorPanel = document.getElementById('elementInspectorPanel');
        if (!inspectorPanel) inspectorPanel = createElementInspectorPanel();
        populateInspectorPanel(inspectorPanel, element, tokens);
        inspectorPanel.classList.add('visible');
        inspectorPanel.style.display = 'flex';
    }

    function createElementInspectorPanel() {
        const panel = document.createElement('div');
        panel.id = 'elementInspectorPanel';
        panel.innerHTML = `<div class="inspector-header"><span>Element Design Tokens <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal;">(drag to move)</span></span><span class="close-inspector" style="cursor: pointer; color: var(--text-secondary); font-size: 1.5rem; padding: 0 0.5rem;">&times;</span></div><div class="inspector-content"></div>`;
        makeDraggable(panel);
        panel.querySelector('.close-inspector').addEventListener('click', () => closeInspectorPanel());
        document.body.appendChild(panel);
        return panel;
    }

    function makeDraggable(panel) {
        const header = panel.querySelector('.inspector-header');
        let isDragging = false, initialX, initialY;
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-inspector')) return;
            isDragging = true;
            initialX = e.clientX - (parseInt(panel.style.left) || 0);
            initialY = e.clientY - (parseInt(panel.style.top) || 0);
            panel.style.transform = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                panel.style.left = (e.clientX - initialX) + 'px';
                panel.style.top = (e.clientY - initialY) + 'px';
            }
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    function closeInspectorPanel() {
        const panel = document.getElementById('elementInspectorPanel');
        if (panel) { panel.classList.remove('visible'); panel.style.display = 'none'; }
    }

    function populateInspectorPanel(panel, element, tokens) {
        const content = panel.querySelector('.inspector-content');
        let html = `<div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border);"><div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 0.5rem;">Element Info</div><div style="font-family: 'Courier New', monospace; color: var(--text-secondary); font-size: 0.8rem;"><div style="margin-bottom: 0.5rem;"><strong>Tag:</strong> &lt;${tokens.element.tag}&gt;</div><div style="margin-bottom: 0.5rem;"><strong>ID:</strong> ${tokens.element.id}</div><div style="margin-bottom: 0.5rem;"><strong>Classes:</strong> ${tokens.element.classes}</div><div style="margin-bottom: 0.5rem;"><strong>XPath:</strong><div style="background: var(--bg-secondary); padding: 0.5rem; border-radius: 3px; margin-top: 0.25rem; word-break: break-all; color: var(--accent-primary); font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer;" onclick="navigator.clipboard.writeText('${tokens.element.xpath}')" title="Click to copy">${tokens.element.xpath}</div></div></div></div>`;
        html += createTokenSection('Colors', tokens.colors);
        html += createTokenSection('Typography', tokens.typography);
        html += createTokenSection('Spacing', tokens.spacing);
        html += createTokenSection('Border', tokens.border);
        html += createTokenSection('Layout', tokens.layout);
        content.innerHTML = html;
    }

    function createTokenSection(title, tokens) {
        let html = `<div style="margin-bottom: 1.5rem;"><div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>`;
        for (const [key, value] of Object.entries(tokens)) {
            const isColor = title === 'Colors';
            const colorSwatch = isColor && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent' ? `<div style="width: 24px; height: 24px; background: ${value}; border: 1px solid var(--border); border-radius: 3px; flex-shrink: 0;"></div>` : '';
            html += `<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">${colorSwatch}<div style="flex: 1; min-width: 0;"><div style="font-size: 0.75rem; color: var(--text-secondary);">${key}</div><div style="font-family: 'Courier New', monospace; font-size: 0.7rem; color: var(--accent-primary); overflow: hidden; text-overflow: ellipsis;">${value}</div></div></div>`;
        }
        html += '</div>';
        return html;
    }

    function handleShiftMouseDown(e) {
        if (!e.shiftKey) return;
        if (e.target.closest('#designPanel') || e.target.closest('#elementInspectorPanel') || e.target.closest('.design-fab')) return;
        e.preventDefault();
        e.stopPropagation();
        currentElement = e.target;
        startTime = Date.now();
        progressOverlay = createProgressOverlay();
        updateProgressOverlay(currentElement, 0);
        let progress = 0;
        progressTimer = setInterval(() => {
            progress = ((Date.now() - startTime) / LONG_PRESS_DURATION) * 100;
            updateProgressOverlay(currentElement, progress);
            if (progress >= 100) clearInterval(progressTimer);
        }, 50);
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            const tokens = extractDesignTokens(currentElement);
            displayElementTokens(currentElement, tokens);
            if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
            if (progressOverlay) { progressOverlay.remove(); progressOverlay = null; }
        }, LONG_PRESS_DURATION);
    }

    function handleMouseUp(e) {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
        if (progressOverlay) { progressOverlay.remove(); progressOverlay = null; }
        currentElement = null;
    }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInspectorPanel(); });
    document.addEventListener('mousedown', handleShiftMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);
})();

// =============================================================================
// INITIALIZE COLOR PICKERS
// =============================================================================

(function() {
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
        if (rgb.startsWith('#')) return rgb;
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return '#000000';
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    function initializeTokenPickers() {
        const style = getComputedStyle(document.documentElement);
        const tokens = Object.keys(defaultTokens);
        tokens.forEach(token => {
            const value = style.getPropertyValue(token).trim();
            const hex = rgbToHex(value);
            const picker = document.querySelector(`input[data-token="${token}"]`);
            if (picker) picker.value = hex;
            const displayId = 'token-' + token.replace('--', '');
            const displayEl = document.getElementById(displayId);
            if (displayEl) displayEl.textContent = hex;
        });

        // Bind event listeners to all data-token inputs
        document.querySelectorAll('input[data-token]').forEach(picker => {
            const tokenName = picker.getAttribute('data-token');
            picker.addEventListener('input', () => updateToken(tokenName, picker.value));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTokenPickers);
    } else {
        initializeTokenPickers();
    }
})();
