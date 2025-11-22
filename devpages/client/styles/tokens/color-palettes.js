/**
 * Color Palettes - Harmonized Semantic System
 *
 * Architecture: Semantic scales + clusters + contextual groups
 *
 * SEMANTIC SCALES (intent-based naming):
 * - primary: subtle, default, emphasis (3 levels)
 * - neutral: ghost, subtle, default, strong, emphasis (5 levels)
 *
 * STATUS CLUSTERS (4 roles each: fg, bg, border, muted):
 * - success (4) - Green family for positive states
 * - warning (4) - Amber/orange for caution
 * - error (4) - Red family for problems
 * - info (4) - Blue family for information
 * - code (4) - Purple family for syntax/technical content
 *
 * CONTEXTUAL GROUPS (semantic purpose):
 * - surface (8) - Backgrounds, elevation, separators
 * - text (4) - Text hierarchy
 *
 * Philosophy:
 * - Semantic names describe INTENT not arbitrary numbers
 * - Same expressiveness as numeric scales (subtle/default/strong vs 300/500/700)
 * - Maintains all color variations from theme manager
 * - Works consistently across light and dark modes
 */

export const ColorPalettes = {
    /**
     * PRIMARY SCALE - Brand colors with semantic levels
     * subtle: backgrounds, hover states, low emphasis
     * default: main brand color, primary actions
     * emphasis: active states, focus, high emphasis
     */
    primary: {
        subtle: '#93c5fd',    // Light blue - backgrounds, hovers
        default: '#3b82f6',   // Medium blue - main brand
        emphasis: '#1d4ed8'   // Dark blue - active, focus
    },

    /**
     * NEUTRAL SCALE - Grayscale with 5 semantic levels
     * ghost: barely visible, subtle backgrounds
     * subtle: light elements, disabled states
     * default: medium contrast, secondary elements
     * strong: high contrast, important text
     * emphasis: maximum contrast, headings
     */
    neutral: {
        ghost: '#171717',     // Darkest (inverts in light mode)
        subtle: '#404040',    // Dark
        default: '#a3a3a3',   // Medium gray
        strong: '#e5e5e5',    // Light
        emphasis: '#fafafa'   // Lightest (inverts in light mode)
    },

    /**
     * STATUS CLUSTERS - Semantic state indicators
     * Each cluster provides: fg (text/icon), bg (fill), border (outline), muted (subtle variant)
     */
    success: {
        fg: '#10b981',      // Text/icons - readable green
        bg: '#064e3b',      // Fills/backgrounds - deep green
        border: '#059669',  // Borders/outlines - medium green
        muted: '#6ee7b7'    // Subtle variant - light green
    },

    warning: {
        fg: '#fbbf24',      // Text/icons - readable amber
        bg: '#78350f',      // Fills/backgrounds - deep amber
        border: '#f59e0b',  // Borders/outlines - medium amber
        muted: '#fcd34d'    // Subtle variant - light amber
    },

    error: {
        fg: '#f87171',      // Text/icons - readable red
        bg: '#7f1d1d',      // Fills/backgrounds - deep red
        border: '#ef4444',  // Borders/outlines - medium red
        muted: '#fca5a5'    // Subtle variant - light red
    },

    info: {
        fg: '#60a5fa',      // Text/icons - readable blue
        bg: '#1e3a8a',      // Fills/backgrounds - deep blue
        border: '#3b82f6',  // Borders/outlines - medium blue
        muted: '#93c5fd'    // Subtle variant - light blue
    },

    /**
     * CODE CLUSTER - Technical content and syntax
     */
    code: {
        fg: '#c084fc',      // Syntax highlighting - purple
        bg: '#1a1f29',      // Code block background
        border: '#374151',  // Code block borders
        muted: '#a78bfa'    // Subtle code elements
    },

    /**
     * SURFACE GROUP - Backgrounds, elevation, separators
     * Semantic names for layout and structural elements
     */
    surface: {
        bg: '#0f1419',          // Base background (darkest)
        'bg-alt': '#1a1f29',    // Alternate background
        'bg-elevated': '#262c38', // Elevated surfaces (lightest bg)
        surface: '#1e2937',     // Default surface
        border: '#374151',      // Default borders
        divider: '#2d3748',     // Dividers/separators
        selection: '#1e40af',   // Text selection background
        highlight: '#854d0e'    // Highlighted content background
    },

    /**
     * TEXT GROUP - Content hierarchy
     * Semantic names for text contrast levels
     */
    text: {
        text: '#f9fafb',            // Primary text (highest contrast)
        'text-secondary': '#d1d5db', // Secondary text
        'text-muted': '#9ca3af',    // Muted text (lowest contrast)
        'text-inverse': '#111827'   // Inverse text (for light backgrounds)
    },

    /**
     * Resolve a cluster.role reference like "success.fg" or "surface.bg"
     */
    resolve(ref) {
        // Handle direct hex colors
        if (ref.startsWith('#')) {
            return ref;
        }

        // Parse cluster.role format
        const parts = ref.split('.');
        if (parts.length !== 2) {
            console.warn(`Invalid color reference format: ${ref}. Expected "cluster.role"`);
            return '#CCCCCC';
        }

        const [cluster, role] = parts;

        // Check if cluster exists
        if (!this[cluster]) {
            console.warn(`Unknown color cluster: ${cluster}`);
            return '#CCCCCC';
        }

        // Get the color
        const color = this[cluster][role];
        if (!color) {
            console.warn(`Unknown role "${role}" in cluster "${cluster}"`);
            return '#CCCCCC';
        }

        return color;
    },

    /**
     * Get all colors as a flat object
     */
    flatten() {
        const flat = {};

        // Process semantic scales (primary, neutral)
        const scales = ['primary', 'neutral'];
        scales.forEach(scaleName => {
            const scale = this[scaleName];
            Object.entries(scale).forEach(([level, color]) => {
                flat[`${scaleName}.${level}`] = color;
            });
        });

        // Process status clusters (success, warning, error, info, code)
        const clusters = ['success', 'warning', 'error', 'info', 'code'];
        clusters.forEach(clusterName => {
            const cluster = this[clusterName];
            Object.entries(cluster).forEach(([role, color]) => {
                flat[`${clusterName}.${role}`] = color;
            });
        });

        // Process contextual groups (surface, text)
        const groups = ['surface', 'text'];
        groups.forEach(groupName => {
            const group = this[groupName];
            Object.entries(group).forEach(([key, color]) => {
                flat[`${groupName}.${key}`] = color;
            });
        });

        return flat;
    },

    /**
     * Get count of total colors
     */
    count() {
        return Object.keys(this.flatten()).length;
    }
};
