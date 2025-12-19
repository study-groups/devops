/**
 * TUT Fonts - Google Fonts integration
 */

const TUT_Fonts = {
    loaded: [],

    /**
     * Update font for a type (heading, body, code)
     */
    update: function(type, font) {
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
    },

    /**
     * Reset fonts to defaults
     */
    reset: function() {
        const headingFont = document.getElementById('headingFont');
        const bodyFont = document.getElementById('bodyFont');
        const codeFont = document.getElementById('codeFont');

        if (headingFont) headingFont.value = TUT_DEFAULT_FONTS.heading;
        if (bodyFont) bodyFont.value = TUT_DEFAULT_FONTS.body;
        if (codeFont) codeFont.value = TUT_DEFAULT_FONTS.code;

        this.update('heading', TUT_DEFAULT_FONTS.heading);
        this.update('body', TUT_DEFAULT_FONTS.body);
        this.update('code', TUT_DEFAULT_FONTS.code);
    },

    /**
     * Toggle font example visibility
     */
    toggleExample: function() {
        const content = document.getElementById('fontExampleContent');
        const toggle = document.querySelector('.font-example-toggle');

        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            toggle.innerHTML = '> Show example';
        } else {
            content.classList.add('expanded');
            toggle.innerHTML = 'v Hide example';
        }
    },

    /**
     * Parse Google Fonts embed code
     */
    parseEmbed: function(embedCode) {
        const hrefMatch = embedCode.match(/href=["']([^"']+fonts\.googleapis\.com\/css2[^"']+)["']/);
        if (!hrefMatch) return null;

        const cdnUrl = hrefMatch[1];
        const urlParams = new URL(cdnUrl).searchParams;
        const families = urlParams.getAll('family');

        if (families.length === 0) return null;

        const fonts = families.map(familyStr => {
            const [nameWithPlus] = familyStr.split(':');
            const fontName = decodeURIComponent(nameWithPlus.replace(/\+/g, ' '));

            const nameLower = fontName.toLowerCase();
            let fallback = 'sans-serif';
            let category = 'body';

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
    },

    /**
     * Add Google Font from embed code
     */
    add: function() {
        const embedCode = document.getElementById('fontEmbedCode').value.trim();
        const btn = document.querySelector('.add-font-btn');

        if (!embedCode) {
            if (btn) tutShowFeedback(btn, 'Paste embed code first', 'error');
            return;
        }

        // Add preconnect links
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

        const parsed = this.parseEmbed(embedCode);
        if (!parsed) {
            if (btn) tutShowFeedback(btn, 'Invalid embed code', 'error');
            return;
        }

        const { cdnUrl, fonts } = parsed;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cdnUrl;
        link.id = 'custom-font-' + Date.now();
        document.head.appendChild(link);

        link.onload = () => {
            fonts.forEach(font => {
                const { fontName, fontFamily, category } = font;

                // Track loaded font
                const existing = this.loaded.find(f => f.fontFamily === fontFamily);
                if (!existing) {
                    this.loaded.push({ cdnUrl, fontFamily, fontName });
                }

                // Add to all dropdowns
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
                    this.update('code', monoFont.fontFamily);
                }
            }

            if (sansFont) {
                const headingSelect = document.getElementById('headingFont');
                const bodySelect = document.getElementById('bodyFont');
                if (headingSelect) {
                    headingSelect.value = sansFont.fontFamily;
                    this.update('heading', sansFont.fontFamily);
                }
                if (bodySelect) {
                    bodySelect.value = sansFont.fontFamily;
                    this.update('body', sansFont.fontFamily);
                }
            }

            if (btn) tutShowFeedback(btn, `${fonts.length} font${fonts.length > 1 ? 's' : ''} added`, 'success');
            document.getElementById('fontEmbedCode').value = '';
        };

        link.onerror = () => {
            link.remove();
            if (btn) tutShowFeedback(btn, 'Failed to load', 'error');
        };
    }
};
