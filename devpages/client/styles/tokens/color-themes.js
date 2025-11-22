/**
 * Color Themes - Theme variant definitions
 *
 * Each theme defines complete color palettes for all clusters + flat lists
 * Structure matches ColorPalettes: success, warning, error, info, code, surface, text
 */

export const ColorThemes = {
    /**
     * DEFAULT (Dark) - DevPages default dark theme
     * Colors preserved from constants/themes.js DEVPAGES_DARK
     */
    default: {
        name: 'Default Dark',
        description: 'DevPages default dark theme',
        temperature: 'balanced',
        mode: 'dark',

        palettes: {
            primary: {
                subtle: '#93c5fd',    // Light blue - backgrounds, hovers
                default: '#3b82f6',   // Medium blue - main brand
                emphasis: '#1d4ed8'   // Dark blue - active, focus
            },

            neutral: {
                ghost: '#171717',     // Darkest
                subtle: '#404040',    // Dark
                default: '#a3a3a3',   // Medium gray
                strong: '#e5e5e5',    // Light
                emphasis: '#fafafa'   // Lightest
            },

            success: {
                fg: '#10b981',      // Preserved: success
                bg: '#064e3b',      // Preserved: bg-success
                border: '#059669',  // Darker green
                muted: '#6ee7b7'    // Lighter green
            },

            warning: {
                fg: '#fbbf24',      // Preserved: warning
                bg: '#78350f',      // Preserved: bg-warning
                border: '#f59e0b',  // Medium amber
                muted: '#fcd34d'    // Lighter amber
            },

            error: {
                fg: '#f87171',      // Preserved: error
                bg: '#7f1d1d',      // Preserved: bg-error
                border: '#ef4444',  // Medium red
                muted: '#fca5a5'    // Lighter red
            },

            info: {
                fg: '#60a5fa',      // Preserved: info
                bg: '#1e3a8a',      // Preserved: bg-info
                border: '#3b82f6',  // Medium blue
                muted: '#93c5fd'    // Lighter blue
            },

            code: {
                fg: '#c084fc',      // Purple for syntax
                bg: '#1a1f29',      // Preserved: code-bg
                border: '#374151',  // Preserved: code-border
                muted: '#a78bfa'    // Lighter purple
            },

            surface: {
                bg: '#0f1419',          // Preserved: bg
                'bg-alt': '#1a1f29',    // Preserved: bg-alt
                'bg-elevated': '#262c38', // Preserved: bg-elevated
                surface: '#1e2937',     // Preserved: surface
                border: '#374151',      // Preserved: border
                divider: '#2d3748',     // Preserved: divider
                selection: '#1e40af',   // Preserved: selection
                highlight: '#854d0e'    // Preserved: highlight
            },

            text: {
                text: '#f9fafb',            // Preserved: text
                'text-secondary': '#d1d5db', // Preserved: text-secondary
                'text-muted': '#9ca3af',    // Preserved: text-muted
                'text-inverse': '#111827'   // Preserved: text-inverse
            }
        }
    },

    /**
     * WARM - Warmer temperature variant
     */
    warm: {
        name: 'Warm',
        description: 'Warm amber and orange tones',
        temperature: 'warm',
        mode: 'dark',

        palettes: {
            primary: {
                subtle: '#fcd34d',    // Light amber - backgrounds, hovers
                default: '#f59e0b',   // Medium amber - main brand
                emphasis: '#d97706'   // Dark amber - active, focus
            },

            neutral: {
                ghost: '#1c0f08',     // Warm darkest
                subtle: '#44403c',    // Warm dark
                default: '#a8a29e',   // Warm medium
                strong: '#e7e5e4',    // Warm light
                emphasis: '#fef3c7'   // Warm lightest
            },

            success: {
                fg: '#84cc16',      // Lime green
                bg: '#3f6212',      // Deep lime
                border: '#65a30d',  // Medium lime
                muted: '#a3e635'    // Light lime
            },

            warning: {
                fg: '#fb923c',      // Warm orange
                bg: '#7c2d12',      // Deep orange
                border: '#ea580c',  // Medium orange
                muted: '#fdba74'    // Light orange
            },

            error: {
                fg: '#fca5a5',      // Warm red
                bg: '#7f1d1d',      // Deep red
                border: '#ef4444',  // Medium red
                muted: '#fecaca'    // Light red
            },

            info: {
                fg: '#fbbf24',      // Amber (instead of blue)
                bg: '#78350f',      // Deep amber
                border: '#f59e0b',  // Medium amber
                muted: '#fcd34d'    // Light amber
            },

            code: {
                fg: '#f472b6',      // Pink
                bg: '#1a1f29',      // Same dark bg
                border: '#374151',  // Same border
                muted: '#f9a8d4'    // Light pink
            },

            surface: {
                bg: '#0f0a08',          // Warmer black
                'bg-alt': '#1c1512',    // Warm dark
                'bg-elevated': '#2d2317', // Warm elevated
                surface: '#231b14',     // Warm surface
                border: '#44403c',      // Warm border
                divider: '#3f3428',     // Warm divider
                selection: '#78350f',   // Amber selection
                highlight: '#92400e'    // Amber highlight
            },

            text: {
                text: '#fef3c7',            // Warm white
                'text-secondary': '#fde68a', // Warm secondary
                'text-muted': '#d97706',    // Warm muted
                'text-inverse': '#171717'   // Dark
            }
        }
    },

    /**
     * COOL - Cooler temperature variant
     */
    cool: {
        name: 'Cool',
        description: 'Cool blue and cyan tones',
        temperature: 'cool',
        mode: 'dark',

        palettes: {
            primary: {
                subtle: '#bae6fd',    // Light cyan - backgrounds, hovers
                default: '#0284c7',   // Medium cyan - main brand
                emphasis: '#0c4a6e'   // Dark cyan - active, focus
            },

            neutral: {
                ghost: '#0a0f14',     // Cool darkest (blue tint)
                subtle: '#334155',    // Cool dark
                default: '#94a3b8',   // Cool medium
                strong: '#e2e8f0',    // Cool light
                emphasis: '#f0f9ff'   // Cool lightest
            },

            success: {
                fg: '#34d399',      // Cool green (teal bias)
                bg: '#064e3b',      // Deep teal
                border: '#059669',  // Medium teal
                muted: '#6ee7b7'    // Light teal
            },

            warning: {
                fg: '#fde047',      // Yellow (less orange)
                bg: '#713f12',      // Deep yellow
                border: '#ca8a04',  // Medium yellow
                muted: '#fef08a'    // Light yellow
            },

            error: {
                fg: '#f472b6',      // Pink (less red)
                bg: '#831843',      // Deep pink
                border: '#db2777',  // Medium pink
                muted: '#f9a8d4'    // Light pink
            },

            info: {
                fg: '#7dd3fc',      // Cool blue
                bg: '#0c4a6e',      // Deep blue
                border: '#0284c7',  // Medium blue
                muted: '#bae6fd'    // Light blue
            },

            code: {
                fg: '#a78bfa',      // Cool purple
                bg: '#1a1f29',      // Same dark bg
                border: '#374151',  // Same border
                muted: '#c4b5fd'    // Light purple
            },

            surface: {
                bg: '#0a0f14',          // Cool black (blue tint)
                'bg-alt': '#111827',    // Cool dark
                'bg-elevated': '#1f2937', // Cool elevated
                surface: '#1e293b',     // Cool surface
                border: '#334155',      // Cool border
                divider: '#293548',     // Cool divider
                selection: '#1e40af',   // Blue selection
                highlight: '#075985'    // Cyan highlight
            },

            text: {
                text: '#f0f9ff',            // Cool white
                'text-secondary': '#dbeafe', // Cool secondary
                'text-muted': '#93c5fd',    // Cool muted
                'text-inverse': '#0f172a'   // Dark
            }
        }
    },

    /**
     * LIGHT - Light mode variant
     */
    light: {
        name: 'Light',
        description: 'Light mode theme',
        temperature: 'balanced',
        mode: 'light',

        palettes: {
            primary: {
                subtle: '#dbeafe',    // Light blue bg - backgrounds, hovers
                default: '#3b82f6',   // Medium blue - main brand
                emphasis: '#1d4ed8'   // Dark blue - active, focus
            },

            neutral: {
                ghost: '#fafafa',     // Lightest
                subtle: '#e5e5e5',    // Light
                default: '#737373',   // Medium gray
                strong: '#404040',    // Dark
                emphasis: '#171717'   // Darkest
            },

            success: {
                fg: '#059669',      // Darker green (readable on light)
                bg: '#d1fae5',      // Light green bg
                border: '#10b981',  // Medium green
                muted: '#a7f3d0'    // Subtle green
            },

            warning: {
                fg: '#d97706',      // Darker amber (readable on light)
                bg: '#fef3c7',      // Light amber bg
                border: '#f59e0b',  // Medium amber
                muted: '#fde68a'    // Subtle amber
            },

            error: {
                fg: '#dc2626',      // Darker red (readable on light)
                bg: '#fee2e2',      // Light red bg
                border: '#ef4444',  // Medium red
                muted: '#fecaca'    // Subtle red
            },

            info: {
                fg: '#1d4ed8',      // Darker blue (readable on light)
                bg: '#dbeafe',      // Light blue bg
                border: '#3b82f6',  // Medium blue
                muted: '#93c5fd'    // Subtle blue
            },

            code: {
                fg: '#7c3aed',      // Darker purple (readable on light)
                bg: '#f9fafb',      // Light gray bg
                border: '#e5e7eb',  // Light border
                muted: '#c4b5fd'    // Subtle purple
            },

            surface: {
                bg: '#ffffff',          // White
                'bg-alt': '#f9fafb',    // Off-white
                'bg-elevated': '#ffffff', // White (elevated)
                surface: '#ffffff',     // White surface
                border: '#e5e7eb',      // Light border
                divider: '#f3f4f6',     // Light divider
                selection: '#dbeafe',   // Blue selection
                highlight: '#fef3c7'    // Amber highlight
            },

            text: {
                text: '#111827',            // Dark text
                'text-secondary': '#6b7280', // Gray text
                'text-muted': '#9ca3af',    // Light gray text
                'text-inverse': '#ffffff'   // White (for dark backgrounds)
            }
        }
    },

    /**
     * Get a theme by name
     */
    getTheme(name) {
        return this[name] || this.default;
    },

    /**
     * List all available theme names
     */
    listThemes() {
        return Object.keys(this).filter(key =>
            typeof this[key] === 'object' && this[key].name
        );
    },

    /**
     * Get all theme metadata
     */
    getAllThemes() {
        return this.listThemes().map(key => ({
            id: key,
            ...this[key]
        }));
    }
};
