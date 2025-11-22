/**
 * Color Token Service - Resolves semantic tokens to hex colors
 *
 * Dual CSS Variable Generation:
 * - NEW FORMAT: --color-success-fg, --color-surface-bg, etc. (cluster-role)
 * - OLD FORMAT: --color-success, --color-bg, --color-bg-success, etc. (backward compatible)
 *
 * Resolution chain:
 * Component Token → Cluster.Role → Hex Value
 * Example: "button.primary.bg" → "info.bg" → "#1e3a8a"
 */

import { ColorPalettes } from '../styles/tokens/color-palettes.js';
import { ColorTokens } from '../styles/tokens/color-tokens.js';
import { ColorThemes } from '../styles/tokens/color-themes.js';

export class ColorTokenService {
    constructor() {
        this.currentTheme = 'light'; // Default to light, not dark
        this.currentPalettes = null;
        this.init();
    }

    /**
     * Initialize with default theme
     */
    init() {
        this.setTheme('light'); // Use light theme by default
    }

    /**
     * Set active theme
     */
    setTheme(themeName) {
        const theme = ColorThemes.getTheme(themeName);
        if (!theme) {
            console.error(`Theme not found: ${themeName}, using default`);
            this.setTheme('default');
            return;
        }

        this.currentTheme = themeName;
        this.currentPalettes = theme.palettes;

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
     * Resolve a cluster.role reference to hex color
     * Example: "success.fg" → "#10b981"
     */
    resolveClusterRef(clusterRef) {
        // Handle direct hex colors
        if (clusterRef.startsWith('#')) {
            return clusterRef;
        }

        // Parse cluster.role format
        const parts = clusterRef.split('.');
        if (parts.length !== 2) {
            console.warn(`Invalid cluster reference format: ${clusterRef}`);
            return '#CCCCCC';
        }

        const [cluster, role] = parts;

        // Get from current theme's palettes
        if (!this.currentPalettes[cluster]) {
            console.warn(`Unknown cluster: ${cluster}`);
            return '#CCCCCC';
        }

        const color = this.currentPalettes[cluster][role];
        if (!color) {
            console.warn(`Unknown role "${role}" in cluster "${cluster}"`);
            return '#CCCCCC';
        }

        return color;
    }

    /**
     * Resolve a semantic token to hex color
     * Example: "components.button.primary.bg" → "info.bg" → "#1e3a8a"
     */
    resolveToken(tokenName) {
        const flatTokens = ColorTokens.flatten();
        const clusterRef = flatTokens[tokenName];

        if (!clusterRef) {
            console.warn(`Token not found: ${tokenName}`);
            return '#CCCCCC';
        }

        return this.resolveClusterRef(clusterRef);
    }

    /**
     * Get all colors in current theme as flat object
     */
    getAllColors() {
        const colors = {};

        // Process all clusters and flat lists
        Object.entries(this.currentPalettes).forEach(([clusterName, cluster]) => {
            Object.entries(cluster).forEach(([role, color]) => {
                const key = `${clusterName}.${role}`;
                colors[key] = color;
            });
        });

        return colors;
    }

    /**
     * Get all semantic tokens with resolved colors
     * Returns object with token paths as keys and {clusterRef, hexValue} as values
     */
    getAllTokens() {
        const flatTokens = ColorTokens.flatten();
        const resolved = {};

        for (const [tokenName, clusterRef] of Object.entries(flatTokens)) {
            resolved[tokenName] = {
                clusterRef,
                hexValue: this.resolveClusterRef(clusterRef)
            };
        }

        return resolved;
    }

    /**
     * Generate backward-compatible CSS variable names
     * Maps new cluster.role format to old variable names
     */
    getLegacyVariableMapping() {
        return {
            // Status fg colors (simple names)
            'success.fg': 'success',
            'warning.fg': 'warning',
            'error.fg': 'error',
            'info.fg': 'info',

            // Status bg colors (bg- prefix)
            'success.bg': 'bg-success',
            'warning.bg': 'bg-warning',
            'error.bg': 'bg-error',
            'info.bg': 'bg-info',

            // Surface colors (direct names)
            'surface.bg': 'bg',
            'surface.bg-alt': 'bg-alt',
            'surface.bg-elevated': 'bg-elevated',
            'surface.surface': 'surface',
            'surface.border': 'border',
            'surface.divider': 'divider',
            'surface.selection': 'selection',
            'surface.highlight': 'highlight',

            // Text colors (direct names)
            'text.text': 'text',
            'text.text-secondary': 'text-secondary',
            'text.text-muted': 'text-muted',
            'text.text-inverse': 'text-inverse',

            // Code colors
            'code.bg': 'code-bg',
            'code.border': 'code-border',
            'code.fg': 'code-fg',
            'code.muted': 'code-muted',

            // Primary scale
            'primary.subtle': 'primary-subtle',
            'primary.default': 'primary-default',
            'primary.emphasis': 'primary-emphasis',

            // Neutral scale
            'neutral.ghost': 'neutral-ghost',
            'neutral.subtle': 'neutral-subtle',
            'neutral.default': 'neutral-default',
            'neutral.strong': 'neutral-strong',
            'neutral.emphasis': 'neutral-emphasis',

            // Status borders
            'success.border': 'success-border',
            'warning.border': 'warning-border',
            'error.border': 'error-border',
            'info.border': 'info-border',

            // Status muted
            'success.muted': 'success-muted',
            'warning.muted': 'warning-muted',
            'error.muted': 'error-muted',
            'info.muted': 'info-muted'
        };
    }

    /**
     * Update CSS custom properties with BOTH old and new formats
     */
    updateCSSVariables() {
        // Skip if not in browser environment
        if (typeof document === 'undefined') return;

        const root = document.documentElement;
        const allColors = this.getAllColors();
        const legacyMapping = this.getLegacyVariableMapping();

        // Generate NEW format variables (--color-cluster-role)
        Object.entries(allColors).forEach(([key, color]) => {
            const varName = `--color-${key.replace(/\./g, '-')}`;
            root.style.setProperty(varName, color);
        });

        // Generate OLD format variables (backward compatibility)
        Object.entries(legacyMapping).forEach(([clusterRef, oldName]) => {
            const color = this.resolveClusterRef(clusterRef);
            const varName = `--color-${oldName}`;
            root.style.setProperty(varName, color);
        });
    }

    /**
     * Generate CSS for current theme (both formats)
     */
    generateCSS() {
        let css = `:root {\n`;
        css += `  /* Theme: ${this.currentTheme} */\n\n`;

        const allColors = this.getAllColors();
        const legacyMapping = this.getLegacyVariableMapping();

        // NEW FORMAT - Cluster-based variables
        css += `  /* ===== NEW FORMAT: Cluster.Role Variables ===== */\n`;

        // Group by palette/cluster
        const clusters = ['primary', 'neutral', 'success', 'warning', 'error', 'info', 'code', 'surface', 'text'];
        clusters.forEach(clusterName => {
            css += `\n  /* ${clusterName.toUpperCase()} */\n`;
            Object.entries(allColors)
                .filter(([key]) => key.startsWith(`${clusterName}.`))
                .forEach(([key, color]) => {
                    const varName = `--color-${key.replace(/\./g, '-')}`;
                    css += `  ${varName}: ${color};\n`;
                });
        });

        // OLD FORMAT - Backward compatible variables
        css += `\n  /* ===== OLD FORMAT: Backward Compatible Variables ===== */\n`;
        Object.entries(legacyMapping).forEach(([clusterRef, oldName]) => {
            const color = this.resolveClusterRef(clusterRef);
            const varName = `--color-${oldName}`;
            css += `  ${varName}: ${color}; /* → ${clusterRef} */\n`;
        });

        css += `}\n`;
        return css;
    }

    /**
     * Get all available themes
     */
    getAvailableThemes() {
        return ColorThemes.getAllThemes();
    }

    /**
     * Get palette/cluster structure for UI display
     */
    getClusterStructure() {
        const structure = {};

        Object.entries(this.currentPalettes).forEach(([paletteName, palette]) => {
            let type = 'flat';
            if (['primary', 'neutral'].includes(paletteName)) {
                type = 'scale';
            } else if (['success', 'warning', 'error', 'info', 'code'].includes(paletteName)) {
                type = 'cluster';
            }

            structure[paletteName] = {
                name: paletteName,
                colors: palette,
                type: type
            };
        });

        return structure;
    }

    /**
     * Export current theme colors as JSON
     */
    exportTheme() {
        return {
            name: this.currentTheme,
            metadata: this.getThemeMetadata(),
            colors: this.getAllColors()
        };
    }
}

// Create singleton instance
export const colorTokenService = new ColorTokenService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.colorTokenService = colorTokenService;
}
