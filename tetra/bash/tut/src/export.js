/**
 * TUT Export - Theme export/import functionality
 */

const TUT_Export = {
    /**
     * Build complete theme object from current state
     */
    buildThemeObject: function() {
        const style = getComputedStyle(document.documentElement);
        const metadata = TUT_Panel.getMetadata();

        // Build tokens object
        const tokens = {};
        Object.keys(TUT_DEFAULT_TOKENS).forEach(cssVar => {
            const value = style.getPropertyValue(cssVar).trim();
            const tokenId = cssVar.replace('--', '');
            const meta = TUT_TOKEN_METADATA[cssVar] || {};

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
                surfaces: {
                    page: { background: "bg-primary" },
                    panel: { background: "bg-secondary", border: "border" },
                    header: { background: "bg-tertiary", border: "border" }
                },
                typography: {
                    heading: { foreground: "text-primary", accent: "accent-primary" },
                    body: { foreground: "text-secondary" },
                    code: { background: "bg-tertiary", foreground: "accent-primary", border: "border" }
                },
                interactive: {
                    "button-primary": { background: "accent-secondary", foreground: "text-primary" },
                    link: { foreground: "accent-primary" }
                },
                feedback: {
                    "success-box": { border: "success", background: "bg-tertiary" },
                    "warning-box": { border: "warning", background: "bg-tertiary" },
                    "error-box": { border: "error", background: "bg-tertiary" }
                }
            },
            tdsMapping: {
                "--bg-primary": "structural.bg.primary",
                "--bg-secondary": "structural.bg.secondary",
                "--bg-tertiary": "structural.bg.tertiary",
                "--text-primary": "text.primary",
                "--text-secondary": "text.secondary",
                "--accent-primary": "interactive.link",
                "--accent-secondary": "structural.secondary",
                "--success": "status.success",
                "--warning": "status.warning",
                "--error": "status.error",
                "--border": "structural.separator",
                "--highlight": "interactive.hover"
            }
        };
    },

    /**
     * Export theme as JSON file download
     */
    toJSON: function() {
        const theme = this.buildThemeObject();
        const themeName = theme.metadata.name;
        const jsonOutput = JSON.stringify(theme, null, 2);

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
        if (btn) tutShowFeedback(btn, 'Downloaded', 'success');
    },

    /**
     * Copy CSS to clipboard
     */
    toCSS: function() {
        const tokens = Object.keys(TUT_DEFAULT_TOKENS);
        const style = getComputedStyle(document.documentElement);

        let cssOutput = ':root {\n';
        tokens.forEach(token => {
            const value = style.getPropertyValue(token).trim();
            cssOutput += `    ${token}: ${value};\n`;
        });
        cssOutput += '}\n';

        // Add Google Fonts CDN URLs
        if (TUT_Fonts.loaded.length > 0) {
            cssOutput += '\n/* Google Fonts */\n';
            TUT_Fonts.loaded.forEach(font => {
                cssOutput += `/* GoogleFont: ${font.fontFamily} | ${font.cdnUrl} */\n`;
            });
        }

        navigator.clipboard.writeText(cssOutput).then(() => {
            const btn = document.getElementById('copyCSSBtn');
            if (btn) tutShowFeedback(btn, 'Copied', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            const btn = document.getElementById('copyCSSBtn');
            if (btn) tutShowFeedback(btn, 'Failed', 'error');
        });
    },

    /**
     * Import theme from JSON file
     */
    fromJSON: function() {
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
                    TUT_Themes.apply(theme);
                    TUT_Themes.save(theme);

                    const btn = document.getElementById('importThemeBtn');
                    if (btn) tutShowFeedback(btn, `Loaded: ${theme.metadata?.name || 'theme'}`, 'success');
                } catch (err) {
                    console.error('Failed to parse theme:', err);
                    tutShowInlineError('importExportSection', 'Invalid JSON file format');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }
};
