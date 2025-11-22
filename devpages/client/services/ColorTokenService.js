/**
 * Color Token Service - Resolves semantic tokens to hex colors
 *
 * Provides the core resolution logic:
 * Semantic Token -> Palette Reference -> Hex Value
 */

import { ColorPalettes } from '../styles/tokens/color-palettes.js';
import { ColorTokens } from '../styles/tokens/color-tokens.js';
import { ColorThemes } from '../styles/tokens/color-themes.js';

export class ColorTokenService {
    constructor() {
        this.currentTheme = 'default';
        this.currentPalettes = null;
        this.flatTokens = null;
        this.init();
    }

    /**
     * Initialize with default theme
     */
    init() {
        this.setTheme('default');
    }

    /**
     * Set active theme
     */
    setTheme(themeName) {
        const theme = ColorThemes.getTheme(themeName);
        if (!theme) {
            console.error(`Theme not found: ${themeName}`);
            return;
        }

        this.currentTheme = themeName;
        this.currentPalettes = theme.palettes;
        this.flatTokens = ColorTokens.flatten();

        // Update CSS variables
        this.updateCSSVariables();
    }

    /**
     * Get current theme name
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Get current theme metadata
     */
    getThemeMetadata() {
        return ColorThemes.getTheme(this.currentTheme);
    }

    /**
     * Resolve a palette reference to hex color
     * Example: "env:0" -> "#00AA00"
     */
    resolvePaletteRef(paletteRef) {
        const [palette, index] = paletteRef.split(':');
        const idx = parseInt(index);

        const paletteMap = {
            'env': this.currentPalettes.ENV_PRIMARY,
            'mode': this.currentPalettes.MODE_PRIMARY,
            'verbs': this.currentPalettes.VERBS_PRIMARY,
            'nouns': this.currentPalettes.NOUNS_PRIMARY
        };

        if (!paletteMap[palette]) {
            console.warn(`Unknown palette: ${palette}`);
            return '#CCCCCC';
        }

        if (idx < 0 || idx > 7) {
            console.warn(`Invalid palette index: ${idx}`);
            return '#CCCCCC';
        }

        return paletteMap[palette][idx];
    }

    /**
     * Resolve a semantic token to hex color
     * Example: "text.primary" -> "mode:7" -> "#6688AA"
     */
    resolveToken(tokenName) {
        const paletteRef = this.flatTokens[tokenName];

        if (!paletteRef) {
            console.warn(`Token not found: ${tokenName}`);
            return '#CCCCCC';
        }

        return this.resolvePaletteRef(paletteRef);
    }

    /**
     * Get all palette colors for current theme
     */
    getAllPaletteColors() {
        return {
            env: this.currentPalettes.ENV_PRIMARY,
            mode: this.currentPalettes.MODE_PRIMARY,
            verbs: this.currentPalettes.VERBS_PRIMARY,
            nouns: this.currentPalettes.NOUNS_PRIMARY
        };
    }

    /**
     * Get all resolved tokens
     */
    getAllTokens() {
        const resolved = {};

        for (const [tokenName, paletteRef] of Object.entries(this.flatTokens)) {
            resolved[tokenName] = {
                paletteRef,
                hexValue: this.resolvePaletteRef(paletteRef),
                isHybrid: paletteRef.includes(':')
            };
        }

        return resolved;
    }

    /**
     * Update CSS custom properties
     */
    updateCSSVariables() {
        // Skip if not in browser environment
        if (typeof document === 'undefined') return;

        const root = document.documentElement;

        // Update palette variables
        const palettes = this.getAllPaletteColors();
        for (const [paletteName, colors] of Object.entries(palettes)) {
            colors.forEach((color, index) => {
                root.style.setProperty(`--color-${paletteName}-${index}`, color);
            });
        }

        // Update semantic token variables
        const tokens = this.getAllTokens();
        for (const [tokenName, data] of Object.entries(tokens)) {
            const varName = `--color-${tokenName.replace(/\./g, '-')}`;
            root.style.setProperty(varName, data.hexValue);
        }
    }

    /**
     * Generate CSS for current theme
     */
    generateCSS() {
        let css = `:root {\n`;
        css += `  /* Theme: ${this.currentTheme} */\n\n`;

        // Palette variables
        css += `  /* Palette Colors */\n`;
        const palettes = this.getAllPaletteColors();
        for (const [paletteName, colors] of Object.entries(palettes)) {
            colors.forEach((color, index) => {
                css += `  --color-${paletteName}-${index}: ${color};\n`;
            });
        }

        // Semantic tokens
        css += `\n  /* Semantic Tokens */\n`;
        const tokens = this.getAllTokens();
        for (const [tokenName, data] of Object.entries(tokens)) {
            const varName = `--color-${tokenName.replace(/\./g, '-')}`;
            css += `  ${varName}: ${data.hexValue}; /* ${data.paletteRef} */\n`;
        }

        css += `}\n`;
        return css;
    }

    /**
     * Get token metadata
     */
    getTokenMetadata(tokenName) {
        const paletteRef = this.flatTokens[tokenName];
        if (!paletteRef) return null;

        const [palette, index] = paletteRef.split(':');

        return {
            tokenName,
            paletteRef,
            palette,
            index: parseInt(index),
            hexValue: this.resolvePaletteRef(paletteRef),
            isHybrid: true
        };
    }
}

// Create singleton instance
export const colorTokenService = new ColorTokenService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.colorTokenService = colorTokenService;
}
