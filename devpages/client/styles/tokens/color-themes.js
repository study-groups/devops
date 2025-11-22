/**
 * Color Themes - Theme definitions and management
 *
 * Each theme defines custom palettes for ENV, MODE, VERBS, NOUNS
 * Themes can have different "temperatures" and moods
 */

export const ColorThemes = {
    /**
     * DEFAULT - Original Tetra colors
     */
    default: {
        name: 'Default',
        description: 'Original Tetra design system colors',
        temperature: 'balanced',
        mode: 'light',

        palettes: {
            ENV_PRIMARY: [
                '#00AA00', '#22DD22', '#44AA44', '#66FF66',
                '#00DD88', '#006644', '#88FF00', '#00AAAA'
            ],
            MODE_PRIMARY: [
                '#0088FF', '#0044AA', '#4400AA', '#000088',
                '#0066FF', '#4488AA', '#88AAFF', '#6688AA'
            ],
            VERBS_PRIMARY: [
                '#FF0044', '#FF6644', '#AA4400', '#FFAA00',
                '#AA6600', '#CC6633', '#FFCC00', '#FF4400'
            ],
            NOUNS_PRIMARY: [
                '#AA00AA', '#FF00FF', '#8800AA', '#CC44CC',
                '#AA0088', '#880088', '#FF88FF', '#CC00CC'
            ]
        }
    },

    /**
     * WARM - Amber/orange temperature
     */
    warm: {
        name: 'Warm',
        description: 'Warm amber and orange tones',
        temperature: 'warm',
        mode: 'light',

        palettes: {
            ENV_PRIMARY: [
                '#D97706', '#F59E0B', '#FBBF24', '#FCD34D',
                '#FDE68A', '#FEF3C7', '#FFFBEB', '#FEFCE8'
            ],
            MODE_PRIMARY: [
                '#EA580C', '#F97316', '#FB923C', '#FDBA74',
                '#FED7AA', '#FFEDD5', '#FFF7ED', '#FFF7ED'
            ],
            VERBS_PRIMARY: [
                '#DC2626', '#EF4444', '#F87171', '#FCA5A5',
                '#FECACA', '#FEE2E2', '#FEF2F2', '#FEF2F2'
            ],
            NOUNS_PRIMARY: [
                '#C2410C', '#EA580C', '#F97316', '#FB923C',
                '#FDBA74', '#FED7AA', '#FFEDD5', '#FFF7ED'
            ]
        }
    },

    /**
     * COOL - Blue temperature
     */
    cool: {
        name: 'Cool',
        description: 'Cool blue and teal tones',
        temperature: 'cool',
        mode: 'light',

        palettes: {
            ENV_PRIMARY: [
                '#0891B2', '#06B6D4', '#22D3EE', '#67E8F9',
                '#A5F3FC', '#CFFAFE', '#ECFEFF', '#F0FDFA'
            ],
            MODE_PRIMARY: [
                '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA',
                '#93C5FD', '#DBEAFE', '#EFF6FF', '#EFF6FF'
            ],
            VERBS_PRIMARY: [
                '#9333EA', '#A855F7', '#C084FC', '#D8B4FE',
                '#E9D5FF', '#F3E8FF', '#FAF5FF', '#FAF5FF'
            ],
            NOUNS_PRIMARY: [
                '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC',
                '#BAE6FD', '#E0F2FE', '#F0F9FF', '#F0F9FF'
            ]
        }
    },

    /**
     * NEUTRAL - Green temperature
     */
    neutral: {
        name: 'Neutral',
        description: 'Neutral green and gray tones',
        temperature: 'neutral',
        mode: 'light',

        palettes: {
            ENV_PRIMARY: [
                '#059669', '#10B981', '#34D399', '#6EE7B7',
                '#A7F3D0', '#D1FAE5', '#ECFDF5', '#F0FDF4'
            ],
            MODE_PRIMARY: [
                '#374151', '#4B5563', '#6B7280', '#9CA3AF',
                '#D1D5DB', '#E5E7EB', '#F3F4F6', '#F9FAFB'
            ],
            VERBS_PRIMARY: [
                '#CA8A04', '#EAB308', '#FACC15', '#FDE047',
                '#FEF08A', '#FEF9C3', '#FEFCE8', '#FEFCE8'
            ],
            NOUNS_PRIMARY: [
                '#16A34A', '#22C55E', '#4ADE80', '#86EFAC',
                '#BBF7D0', '#DCFCE7', '#F0FDF4', '#F0FDF4'
            ]
        }
    },

    /**
     * DARK - Dark mode theme
     */
    dark: {
        name: 'Dark',
        description: 'Dark mode with vibrant accents',
        temperature: 'balanced',
        mode: 'dark',

        palettes: {
            ENV_PRIMARY: [
                '#10B981', '#34D399', '#6EE7B7', '#A7F3D0',
                '#D1FAE5', '#047857', '#065F46', '#064E3B'
            ],
            MODE_PRIMARY: [
                '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE',
                '#EFF6FF', '#1E40AF', '#1E3A8A', '#172554'
            ],
            VERBS_PRIMARY: [
                '#EF4444', '#F87171', '#FCA5A5', '#FECACA',
                '#FEE2E2', '#B91C1C', '#991B1B', '#7F1D1D'
            ],
            NOUNS_PRIMARY: [
                '#A855F7', '#C084FC', '#D8B4FE', '#E9D5FF',
                '#F3E8FF', '#7C3AED', '#6D28D9', '#5B21B6'
            ]
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
