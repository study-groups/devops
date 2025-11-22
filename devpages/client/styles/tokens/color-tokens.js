/**
 * Semantic Color Tokens - Component and UI mappings
 *
 * Maps high-level semantic names to palette references
 * Format: "group.level" (e.g., "primary.default", "success.fg", "surface.bg")
 *
 * Philosophy:
 * - Direct, obvious mappings
 * - Buttons use primary/neutral scales or status clusters
 * - Status indicators use full cluster kits (fg, bg, border, muted)
 * - Text uses semantic scales with surface backgrounds
 * - Keep it simple - avoid over-abstraction
 */

export const ColorTokens = {
    /**
     * COMPONENT MAPPINGS - Direct use in UI components
     */
    components: {
        // Buttons - use full cluster kit (bg, fg, border)
        button: {
            primary: {
                bg: 'primary.default',
                fg: 'text.text-inverse',
                border: 'primary.emphasis',
                hover: 'primary.emphasis'
            },
            secondary: {
                bg: 'neutral.subtle',
                fg: 'text.text',
                border: 'neutral.default',
                hover: 'neutral.default'
            },
            success: {
                bg: 'success.bg',
                fg: 'success.fg',
                border: 'success.border'
            },
            warning: {
                bg: 'warning.bg',
                fg: 'warning.fg',
                border: 'warning.border'
            },
            danger: {
                bg: 'error.bg',
                fg: 'error.fg',
                border: 'error.border'
            }
        },

        // Badges - use full cluster kit
        badge: {
            success: {
                bg: 'success.bg',
                fg: 'success.fg',
                border: 'success.border'
            },
            warning: {
                bg: 'warning.bg',
                fg: 'warning.fg',
                border: 'warning.border'
            },
            error: {
                bg: 'error.bg',
                fg: 'error.fg',
                border: 'error.border'
            },
            info: {
                bg: 'info.bg',
                fg: 'info.fg',
                border: 'info.border'
            }
        },

        // Panels/Cards - use surface colors
        panel: {
            bg: 'surface.surface',
            border: 'surface.border',
            elevated: 'surface.bg-elevated'
        },

        // Code blocks - use code cluster
        codeBlock: {
            bg: 'code.bg',
            border: 'code.border',
            fg: 'code.fg'
        }
    },

    /**
     * STATUS INDICATORS - Alert/message boxes
     */
    status: {
        success: {
            bg: 'success.bg',
            fg: 'success.fg',
            border: 'success.border',
            muted: 'success.muted'
        },
        warning: {
            bg: 'warning.bg',
            fg: 'warning.fg',
            border: 'warning.border',
            muted: 'warning.muted'
        },
        error: {
            bg: 'error.bg',
            fg: 'error.fg',
            border: 'error.border',
            muted: 'error.muted'
        },
        info: {
            bg: 'info.bg',
            fg: 'info.fg',
            border: 'info.border',
            muted: 'info.muted'
        }
    },

    /**
     * INLINE ELEMENTS - Text-only, use surface as bg
     */
    inline: {
        // Status text (uses cluster fg, no bg)
        successText: 'success.fg',
        warningText: 'warning.fg',
        errorText: 'error.fg',
        infoText: 'info.fg',

        // Code syntax
        codeInline: 'code.fg',
        codeMuted: 'code.muted',

        // Links
        link: 'primary.default',
        linkHover: 'primary.emphasis',
        linkVisited: 'code.fg'
    },

    /**
     * SURFACE HIERARCHY - Layouts and backgrounds
     */
    layout: {
        bg: 'surface.bg',
        bgAlt: 'surface.bg-alt',
        bgElevated: 'surface.bg-elevated',
        surface: 'surface.surface',
        border: 'surface.border',
        divider: 'surface.divider',
        selection: 'surface.selection',
        highlight: 'surface.highlight'
    },

    /**
     * TEXT HIERARCHY - Content typography
     */
    typography: {
        primary: 'text.text',
        secondary: 'text.text-secondary',
        muted: 'text.text-muted',
        inverse: 'text.text-inverse'
    },

    /**
     * Flatten nested tokens to dot notation for easy access
     * Example: components.button.primary.bg -> "info.bg"
     */
    flatten() {
        const flat = {};

        const traverse = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const path = prefix ? `${prefix}.${key}` : key;

                if (typeof value === 'string') {
                    // It's a color reference
                    flat[path] = value;
                } else if (typeof value === 'object' && value !== null) {
                    // It's a nested object, keep traversing
                    traverse(value, path);
                }
            }
        };

        // Traverse all categories
        traverse(this.components, 'components');
        traverse(this.status, 'status');
        traverse(this.inline, 'inline');
        traverse(this.layout, 'layout');
        traverse(this.typography, 'typography');

        return flat;
    },

    /**
     * Get all token categories
     */
    getCategories() {
        return ['components', 'status', 'inline', 'layout', 'typography'];
    }
};
