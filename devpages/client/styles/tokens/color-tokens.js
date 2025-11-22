/**
 * Semantic Color Tokens - High-level color mappings
 *
 * Maps semantic names to palette references (e.g., "env:0", "mode:7")
 * This provides a layer of indirection allowing themes to change palettes
 * while keeping semantic meaning consistent.
 *
 * Format: "palette:index" where palette is env|mode|verbs|nouns and index is 0-7
 */

export const ColorTokens = {
    // ========================================
    // STRUCTURAL - UI Framework & Layout
    // ========================================
    structural: {
        primary: 'env:0',       // Primary brand/accent color
        secondary: 'mode:0',    // Secondary UI elements
        accent: 'verbs:0',      // Accent for emphasis
        muted: 'env:5',         // Muted/subtle elements
        separator: 'mode:6',    // Dividers, borders
        background: 'mode:3',   // Deep background
        surface: 'mode:6',      // Surface background
        overlay: 'mode:1',      // Overlay background
    },

    // ========================================
    // TEXT - Content Hierarchy
    // ========================================
    text: {
        primary: 'mode:7',      // Main readable text
        secondary: 'mode:6',    // Secondary text
        tertiary: 'env:6',      // Subtle/tertiary text
        muted: 'mode:5',        // Very subtle/disabled text
        inverse: 'mode:0',      // Text on dark backgrounds
        brand: 'env:1',         // Brand-colored text
        emphasis: 'nouns:3',    // Emphasized text
    },

    // ========================================
    // INTERACTIVE - User Interactions
    // ========================================
    interactive: {
        link: 'mode:0',         // Links default state
        linkHover: 'mode:4',    // Links hover state
        linkVisited: 'nouns:0', // Visited links
        active: 'verbs:3',      // Active/pressed state
        hover: 'verbs:1',       // Hover state
        selected: 'env:3',      // Selected state
        focus: 'mode:0',        // Focus outline
        disabled: 'mode:5',     // Disabled state
    },

    // ========================================
    // STATUS - State Indicators
    // ========================================
    status: {
        success: 'env:1',       // Success messages
        warning: 'verbs:3',     // Warning messages
        error: 'verbs:0',       // Error messages
        info: 'mode:0',         // Info messages
        pending: 'nouns:0',     // Pending/loading state
    },

    // ========================================
    // CONTENT - Document/Markdown Rendering
    // ========================================
    content: {
        heading: {
            h1: 'mode:0',       // Top-level headings
            h2: 'mode:1',       // Second-level headings
            h3: 'nouns:3',      // Third-level headings
            h4: 'nouns:1',      // Fourth-level headings
            h5: 'env:0',        // Fifth-level headings
            h6: 'env:5',        // Sixth-level headings
        },
        code: {
            inline: 'verbs:0',  // Inline code
            block: 'mode:1',    // Code blocks
            comment: 'mode:5',  // Code comments
            keyword: 'verbs:3', // Code keywords
            string: 'env:1',    // Code strings
            number: 'nouns:3',  // Code numbers
            function: 'mode:0', // Code function names
        },
        quote: 'mode:5',        // Blockquotes
        list: 'env:1',          // List markers
        emphasis: {
            bold: 'verbs:3',    // Bold text
            italic: 'env:1',    // Italic text
            underline: 'mode:0', // Underlined text
        },
        link: 'mode:0',         // Content links
        hr: 'mode:5',           // Horizontal rules
    },

    // ========================================
    // COMPONENTS - Specific UI Components
    // ========================================
    components: {
        button: {
            primary: 'mode:0',
            primaryHover: 'mode:4',
            secondary: 'env:0',
            secondaryHover: 'env:2',
            danger: 'verbs:0',
            dangerHover: 'verbs:1',
        },
        panel: {
            bg: 'mode:3',
            border: 'mode:5',
            header: 'mode:1',
            toolbar: 'mode:2',
        },
        badge: {
            default: 'mode:5',
            primary: 'mode:0',
            success: 'env:0',
            warning: 'verbs:3',
            error: 'verbs:0',
            info: 'mode:0',
        },
        environment: {
            local: 'env:1',     // Local environment
            dev: 'env:0',       // Development
            staging: 'verbs:2', // Staging
            prod: 'verbs:0',    // Production (caution!)
        },
    },

    /**
     * Flatten nested tokens to dot notation for easy access
     * Example: text.primary -> "mode:7"
     */
    flatten() {
        const flat = {};

        const flatten = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const path = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, path);
                } else {
                    flat[path] = value;
                }
            }
        };

        flatten(this);
        delete flat.flatten; // Remove the method itself
        return flat;
    }
};
