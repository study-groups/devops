/**
 * Color Palettes - TDS-style Four Palette System
 *
 * Each palette contains 8 color stops (0-7) representing a progression
 * from dark to light or from intense to muted.
 *
 * Philosophy:
 * - ENV: Environment, success states, organic elements (greens/teals)
 * - MODE: Structure, modes, primary UI (blues/purples)
 * - VERBS: Actions, warnings, errors (reds/oranges)
 * - NOUNS: Data, entities, emphasis (purples/magentas)
 */

export const ColorPalettes = {
    /**
     * ENV_PRIMARY - Environment & Success States
     * Use for: success indicators, environment badges, organic elements
     */
    ENV_PRIMARY: [
        '#00AA00', // 0 - Primary green
        '#22DD22', // 1 - Bright green
        '#44AA44', // 2 - Medium green
        '#66FF66', // 3 - Light bright green
        '#00DD88', // 4 - Teal variant
        '#006644', // 5 - Darker teal
        '#88FF00', // 6 - Yellow-green
        '#00AAAA'  // 7 - Cyan
    ],

    /**
     * MODE_PRIMARY - Structure & Modes
     * Use for: primary UI structure, mode indicators, text hierarchy
     */
    MODE_PRIMARY: [
        '#0088FF', // 0 - Primary blue
        '#0044AA', // 1 - Dark blue
        '#4400AA', // 2 - Blue-purple
        '#000088', // 3 - Deep blue
        '#0066FF', // 4 - Medium blue
        '#4488AA', // 5 - Muted blue
        '#88AAFF', // 6 - Light blue
        '#6688AA'  // 7 - Very light blue
    ],

    /**
     * VERBS_PRIMARY - Actions & Warnings
     * Use for: errors, warnings, interactive actions, critical states
     */
    VERBS_PRIMARY: [
        '#FF0044', // 0 - Error red
        '#FF6644', // 1 - Warning orange-red
        '#AA4400', // 2 - Dark orange
        '#FFAA00', // 3 - Bright orange/amber
        '#AA6600', // 4 - Burnt orange
        '#CC6633', // 5 - Rust
        '#FFCC00', // 6 - Yellow-orange
        '#FF4400'  // 7 - Bright red-orange
    ],

    /**
     * NOUNS_PRIMARY - Data & Entities
     * Use for: data elements, entities, special emphasis, highlights
     */
    NOUNS_PRIMARY: [
        '#AA00AA', // 0 - Primary purple
        '#FF00FF', // 1 - Bright magenta
        '#8800AA', // 2 - Dark purple
        '#CC44CC', // 3 - Medium purple
        '#AA0088', // 4 - Purple-magenta
        '#880088', // 5 - Dark magenta
        '#FF88FF', // 6 - Light magenta
        '#CC00CC'  // 7 - Pure magenta
    ],

    /**
     * Generate complementary colors (inverse RGB)
     */
    getComplement(hexColor) {
        const hex = hexColor.replace('#', '');
        const r = 255 - parseInt(hex.substr(0, 2), 16);
        const g = 255 - parseInt(hex.substr(2, 2), 16);
        const b = 255 - parseInt(hex.substr(4, 2), 16);
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Get complement palettes
     */
    get ENV_COMPLEMENT() {
        return this.ENV_PRIMARY.map(c => this.getComplement(c));
    },

    get MODE_COMPLEMENT() {
        return this.MODE_PRIMARY.map(c => this.getComplement(c));
    },

    get VERBS_COMPLEMENT() {
        return this.VERBS_PRIMARY.map(c => this.getComplement(c));
    },

    get NOUNS_COMPLEMENT() {
        return this.NOUNS_PRIMARY.map(c => this.getComplement(c));
    },

    /**
     * Resolve a palette reference like "env:0" or "mode:7"
     */
    resolve(paletteRef) {
        const [palette, index] = paletteRef.split(':');
        const idx = parseInt(index);

        const paletteMap = {
            'env': this.ENV_PRIMARY,
            'mode': this.MODE_PRIMARY,
            'verbs': this.VERBS_PRIMARY,
            'nouns': this.NOUNS_PRIMARY
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
};
