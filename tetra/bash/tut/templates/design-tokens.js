// Design Token Editor - JavaScript

// Default tokens for reset
const defaultTokens = {
    '--bg-primary': '#0d1117',
    '--bg-secondary': '#161b22',
    '--bg-tertiary': '#21262d',
    '--text-primary': '#c9d1d9',
    '--text-secondary': '#8b949e',
    '--accent-primary': '#58a6ff',
    '--accent-secondary': '#1f6feb',
    '--success': '#3fb950',
    '--warning': '#d29922',
    '--error': '#f85149',
    '--border': '#30363d',
    '--highlight': '#388bfd26'
};

const defaultFonts = {
    heading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    code: "'Courier New', Monaco, monospace"
};

// Track loaded Google Fonts
const loadedGoogleFonts = [];

// Toggle design panel visibility
function toggleDesignPanel() {
    const panel = document.getElementById('designPanel');
    panel.classList.toggle('visible');
}

// Update a CSS custom property
function updateToken(tokenName, value) {
    document.documentElement.style.setProperty(tokenName, value);
    const displayId = 'token-' + tokenName.replace('--', '').replace(/-/g, '-');
    const displayEl = document.getElementById(displayId);
    if (displayEl) {
        displayEl.textContent = value;
    }

    // Update corresponding color picker
    const picker = document.querySelector(`input[onchange*="${tokenName}"]`);
    if (picker) {
        picker.value = value;
    }
}

// Update font for a specific element type
function updateFont(type, font) {
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
}

// Toggle font example visibility
function toggleFontExample() {
    const content = document.getElementById('fontExampleContent');
    const toggle = document.querySelector('.font-example-toggle');

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.innerHTML = '&#9656; Show example';
    } else {
        content.classList.add('expanded');
        toggle.innerHTML = '&#9662; Hide example';
    }
}

// Add a custom Google Font
function addCustomFont() {
    const cdnUrl = document.getElementById('fontCdnUrl').value.trim();
    const fontFamily = document.getElementById('fontFamily').value.trim();

    if (!cdnUrl || !fontFamily) {
        alert('Please enter both CDN URL and font-family value');
        return;
    }

    // Validate Google Fonts URL
    if (!cdnUrl.includes('fonts.googleapis.com')) {
        alert('Please use a valid Google Fonts URL (fonts.googleapis.com)');
        return;
    }

    // Add font link to document head
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cdnUrl;
    link.id = 'custom-font-' + Date.now();
    document.head.appendChild(link);

    // Wait for font to load before applying
    link.onload = () => {
        console.log('Font loaded successfully:', fontFamily);

        // Store in loaded fonts tracker
        const existing = loadedGoogleFonts.find(f => f.fontFamily === fontFamily);
        if (!existing) {
            loadedGoogleFonts.push({ cdnUrl, fontFamily });
        }

        // Add to all dropdowns
        const dropdowns = ['headingFont', 'bodyFont', 'codeFont'];
        dropdowns.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;

            const existingOption = Array.from(select.options).find(opt => opt.value === fontFamily);
            if (!existingOption) {
                const option = document.createElement('option');
                option.value = fontFamily;
                option.textContent = fontFamily.replace(/['"]/g, '') + ' (Custom)';
                select.insertBefore(option, select.firstChild);
            }
        });

        // Auto-select and apply the font to headings
        const headingSelect = document.getElementById('headingFont');
        if (headingSelect) {
            headingSelect.value = fontFamily;
            updateFont('heading', fontFamily);
        }

        // Visual feedback
        const btn = document.querySelector('.add-font-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Font Added & Applied!';
        btn.style.background = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        btn.style.color = 'white';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 1000);

        // Clear inputs
        document.getElementById('fontCdnUrl').value = '';
        document.getElementById('fontFamily').value = '';
    };

    link.onerror = () => {
        console.error('Failed to load font:', cdnUrl);
        alert('Failed to load font. Please check the URL and try again.');
        link.remove();
    };
}

// Reset all tokens to defaults
function resetTokens() {
    // Reset colors
    Object.entries(defaultTokens).forEach(([token, value]) => {
        updateToken(token, value);
    });

    // Reset fonts
    const headingFont = document.getElementById('headingFont');
    const bodyFont = document.getElementById('bodyFont');
    const codeFont = document.getElementById('codeFont');

    if (headingFont) headingFont.value = defaultFonts.heading;
    if (bodyFont) bodyFont.value = defaultFonts.body;
    if (codeFont) codeFont.value = defaultFonts.code;

    updateFont('heading', defaultFonts.heading);
    updateFont('body', defaultFonts.body);
    updateFont('code', defaultFonts.code);

    // Clear custom font inputs
    const fontCdnUrl = document.getElementById('fontCdnUrl');
    const fontFamily = document.getElementById('fontFamily');
    if (fontCdnUrl) fontCdnUrl.value = '';
    if (fontFamily) fontFamily.value = '';

    // Visual feedback
    const btn = document.getElementById('resetTokensBtn');
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Reset!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1000);
    }
}

// Copy current tokens as CSS
function copyTokens() {
    const tokens = [
        '--bg-primary', '--bg-secondary', '--bg-tertiary',
        '--text-primary', '--text-secondary',
        '--accent-primary', '--accent-secondary',
        '--success', '--warning', '--error',
        '--border', '--highlight'
    ];

    const style = getComputedStyle(document.documentElement);

    // Generate CSS custom properties
    let cssOutput = ':root {\n';
    tokens.forEach(token => {
        const value = style.getPropertyValue(token).trim();
        cssOutput += `    ${token}: ${value};\n`;
    });
    cssOutput += '}\n\n';

    // Add Google Fonts CDN URLs
    if (loadedGoogleFonts.length > 0) {
        cssOutput += '/* Google Fonts CDN */\n';
        loadedGoogleFonts.forEach(font => {
            cssOutput += `/* @import url('${font.cdnUrl}'); */\n`;
            cssOutput += `/* GoogleFont: ${font.fontFamily} | ${font.cdnUrl} */\n`;
        });
        cssOutput += '\n';
    }

    // Add font info
    cssOutput += '/* Fonts */\n';
    const headingFont = document.getElementById('headingFont');
    const bodyFont = document.getElementById('bodyFont');
    const codeFont = document.getElementById('codeFont');

    if (headingFont) cssOutput += `/* Heading: ${headingFont.value} */\n`;
    if (bodyFont) cssOutput += `/* Body: ${bodyFont.value} */\n`;
    if (codeFont) cssOutput += `/* Code: ${codeFont.value} */\n`;

    // Copy to clipboard
    navigator.clipboard.writeText(cssOutput).then(() => {
        const btn = document.getElementById('copyTokensBtn');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.classList.add('copied');

            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy tokens to clipboard');
    });
}

// Load tokens from pasted CSS
function loadTokens() {
    const cssText = prompt('Paste the CSS (including :root { } and font comments):');

    if (!cssText) return;

    try {
        // Extract color tokens
        const tokenRegex = /--([a-z-]+):\s*([^;]+);/g;
        let match;

        while ((match = tokenRegex.exec(cssText)) !== null) {
            const tokenName = '--' + match[1];
            const value = match[2].trim();

            if (defaultTokens.hasOwnProperty(tokenName)) {
                updateToken(tokenName, value);
            }
        }

        // Extract and load Google Fonts
        const googleFontRegex = /\/\*\s*GoogleFont:\s*([^|]+)\|\s*([^*]+)\*\//g;
        let fontMatch;
        const fontsToLoad = [];

        while ((fontMatch = googleFontRegex.exec(cssText)) !== null) {
            const fontFamily = fontMatch[1].trim();
            const cdnUrl = fontMatch[2].trim();
            fontsToLoad.push({ fontFamily, cdnUrl });
        }

        // Load extracted Google Fonts
        fontsToLoad.forEach(font => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = font.cdnUrl;
            link.id = 'custom-font-' + Date.now();
            document.head.appendChild(link);

            const existing = loadedGoogleFonts.find(f => f.fontFamily === font.fontFamily);
            if (!existing) {
                loadedGoogleFonts.push(font);
            }

            // Add to dropdowns
            link.onload = () => {
                const dropdowns = ['headingFont', 'bodyFont', 'codeFont'];
                dropdowns.forEach(id => {
                    const select = document.getElementById(id);
                    if (!select) return;

                    const existingOption = Array.from(select.options).find(opt => opt.value === font.fontFamily);
                    if (!existingOption) {
                        const option = document.createElement('option');
                        option.value = font.fontFamily;
                        option.textContent = font.fontFamily.replace(/['"]/g, '') + ' (Custom)';
                        select.insertBefore(option, select.firstChild);
                    }
                });
            };
        });

        // Extract font preferences from comments
        const headingMatch = cssText.match(/\/\*\s*Heading:\s*(.+?)\s*\*\//);
        const bodyMatch = cssText.match(/\/\*\s*Body:\s*(.+?)\s*\*\//);
        const codeMatch = cssText.match(/\/\*\s*Code:\s*(.+?)\s*\*\//);

        if (headingMatch) {
            const font = headingMatch[1].trim();
            const headingFont = document.getElementById('headingFont');
            if (headingFont) {
                headingFont.value = font;
                updateFont('heading', font);
            }
        }

        if (bodyMatch) {
            const font = bodyMatch[1].trim();
            const bodyFont = document.getElementById('bodyFont');
            if (bodyFont) {
                bodyFont.value = font;
                updateFont('body', font);
            }
        }

        if (codeMatch) {
            const font = codeMatch[1].trim();
            const codeFont = document.getElementById('codeFont');
            if (codeFont) {
                codeFont.value = font;
                updateFont('code', font);
            }
        }

        // Visual feedback
        const btn = document.getElementById('loadTokensBtn');
        if (btn) {
            const originalText = btn.textContent;
            const fontCount = fontsToLoad.length;
            btn.textContent = fontCount > 0 ? `✓ Loaded! (${fontCount} font${fontCount > 1 ? 's' : ''})` : '✓ Loaded!';
            btn.style.background = 'var(--success)';
            btn.style.borderColor = 'var(--success)';
            btn.style.color = 'white';

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 3000);
        }

    } catch (err) {
        console.error('Failed to parse CSS:', err);
        alert('Failed to parse CSS. Make sure it includes :root { } block and font comments.');
    }
}

// Close design panel when clicking outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('designPanel');
    const fab = document.getElementById('designFab');
    if (panel && panel.classList.contains('visible') &&
        !panel.contains(e.target) &&
        !fab.contains(e.target)) {
        panel.classList.remove('visible');
    }
});

// ============================================
// Element Design Token Inspector (Shift-Hold)
// ============================================
(function() {
    let longPressTimer = null;
    let progressTimer = null;
    let currentElement = null;
    let progressOverlay = null;
    let startTime = 0;
    const LONG_PRESS_DURATION = 1000; // 1 second

    // Create progress overlay element
    function createProgressOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 3px solid var(--accent-primary);
            border-radius: 4px;
            background: radial-gradient(circle, transparent 0%, rgba(88, 166, 255, 0.1) 100%);
            z-index: 10000;
            transition: opacity 0.2s;
        `;
        overlay.innerHTML = `
            <div style="
                position: absolute;
                top: -30px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--bg-secondary);
                border: 2px solid var(--accent-primary);
                border-radius: 20px;
                padding: 4px 12px;
                font-size: 11px;
                font-family: 'Courier New', monospace;
                color: var(--accent-primary);
                white-space: nowrap;
            ">
                <span class="progress-text">0.0s / 1.0s</span>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // Update progress overlay position and progress
    function updateProgressOverlay(element, progress) {
        if (!progressOverlay) return;

        const rect = element.getBoundingClientRect();
        progressOverlay.style.left = rect.left + 'px';
        progressOverlay.style.top = rect.top + 'px';
        progressOverlay.style.width = rect.width + 'px';
        progressOverlay.style.height = rect.height + 'px';

        const elapsed = (progress * LONG_PRESS_DURATION / 100) / 1000;
        const progressText = progressOverlay.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${elapsed.toFixed(1)}s / 1.0s`;
        }

        const alpha = Math.min(0.3, progress / 100 * 0.3);
        progressOverlay.style.background = `radial-gradient(circle, rgba(88, 166, 255, ${alpha}) 0%, rgba(88, 166, 255, ${alpha * 0.3}) 100%)`;
    }

    // Generate XPath for element
    function getXPath(element) {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        if (element === document.body) {
            return '/html/body';
        }

        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                const parentPath = element.parentNode ? getXPath(element.parentNode) : '';
                return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                ix++;
            }
        }
        return '';
    }

    // Extract design tokens from element
    function extractDesignTokens(element) {
        const computed = window.getComputedStyle(element);
        return {
            element: {
                tag: element.tagName.toLowerCase(),
                classes: Array.from(element.classList).join(', ') || 'none',
                id: element.id || 'none',
                xpath: getXPath(element)
            },
            colors: {
                background: computed.backgroundColor,
                color: computed.color,
                borderColor: computed.borderTopColor
            },
            typography: {
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                lineHeight: computed.lineHeight,
                letterSpacing: computed.letterSpacing
            },
            spacing: {
                padding: computed.padding,
                margin: computed.margin
            },
            border: {
                width: computed.borderWidth,
                style: computed.borderStyle,
                radius: computed.borderRadius
            },
            layout: {
                display: computed.display,
                width: computed.width,
                height: computed.height
            }
        };
    }

    // Display extracted tokens
    function displayElementTokens(element, tokens) {
        console.log('Selected Element Tokens:', tokens);

        let inspectorPanel = document.getElementById('elementInspectorPanel');
        if (!inspectorPanel) {
            inspectorPanel = createElementInspectorPanel();
        }

        populateInspectorPanel(inspectorPanel, element, tokens);
        inspectorPanel.classList.add('visible');
        inspectorPanel.style.display = 'flex';
    }

    // Create element inspector panel
    function createElementInspectorPanel() {
        const panel = document.createElement('div');
        panel.id = 'elementInspectorPanel';

        panel.innerHTML = `
            <div class="inspector-header">
                <span>Element Design Tokens <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal;">(drag to move)</span></span>
                <span class="close-inspector" style="cursor: pointer; color: var(--text-secondary); font-size: 1.5rem; padding: 0 0.5rem;">&times;</span>
            </div>
            <div class="inspector-content"></div>
        `;

        makeDraggable(panel);

        panel.querySelector('.close-inspector').addEventListener('click', () => {
            closeInspectorPanel();
        });

        document.body.appendChild(panel);
        return panel;
    }

    // Make panel draggable
    function makeDraggable(panel) {
        const header = panel.querySelector('.inspector-header');
        let isDragging = false;
        let initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-inspector')) return;

            isDragging = true;
            initialX = e.clientX - (parseInt(panel.style.left) || 0);
            initialY = e.clientY - (parseInt(panel.style.top) || 0);
            panel.style.transform = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                panel.style.left = (e.clientX - initialX) + 'px';
                panel.style.top = (e.clientY - initialY) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Close inspector panel
    function closeInspectorPanel() {
        const panel = document.getElementById('elementInspectorPanel');
        if (panel) {
            panel.classList.remove('visible');
            panel.style.display = 'none';
        }
    }

    // Populate inspector panel with token data
    function populateInspectorPanel(panel, element, tokens) {
        const content = panel.querySelector('.inspector-content');

        let html = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border);">
                <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 0.5rem;">Element Info</div>
                <div style="font-family: 'Courier New', monospace; color: var(--text-secondary); font-size: 0.8rem;">
                    <div style="margin-bottom: 0.5rem;"><strong>Tag:</strong> &lt;${tokens.element.tag}&gt;</div>
                    <div style="margin-bottom: 0.5rem;"><strong>ID:</strong> ${tokens.element.id}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Classes:</strong> ${tokens.element.classes}</div>
                    <div style="margin-bottom: 0.5rem;">
                        <strong>XPath:</strong>
                        <div style="
                            background: var(--bg-secondary);
                            padding: 0.5rem;
                            border-radius: 3px;
                            margin-top: 0.25rem;
                            word-break: break-all;
                            color: var(--accent-primary);
                            font-size: 0.75rem;
                            border: 1px solid var(--border);
                            cursor: pointer;
                        " onclick="navigator.clipboard.writeText('${tokens.element.xpath}').then(() => {
                            this.style.background = 'var(--success)';
                            this.style.color = 'white';
                            setTimeout(() => {
                                this.style.background = 'var(--bg-secondary)';
                                this.style.color = 'var(--accent-primary)';
                            }, 1000);
                        })" title="Click to copy">${tokens.element.xpath}</div>
                    </div>
                </div>
            </div>
        `;

        html += createTokenSection('Colors', tokens.colors);
        html += createTokenSection('Typography', tokens.typography);
        html += createTokenSection('Spacing', tokens.spacing);
        html += createTokenSection('Border', tokens.border);
        html += createTokenSection('Layout', tokens.layout);

        content.innerHTML = html;
    }

    // Create a token section
    function createTokenSection(title, tokens) {
        let html = `
            <div style="margin-bottom: 1.5rem;">
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
        `;

        for (const [key, value] of Object.entries(tokens)) {
            const isColor = title === 'Colors';
            const colorSwatch = isColor && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent'
                ? `<div style="width: 24px; height: 24px; background: ${value}; border: 1px solid var(--border); border-radius: 3px; flex-shrink: 0;"></div>`
                : '';

            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">
                    ${colorSwatch}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${key}</div>
                        <div style="font-family: 'Courier New', monospace; font-size: 0.7rem; color: var(--accent-primary); overflow: hidden; text-overflow: ellipsis;">${value}</div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    // Handle shift-mousedown to show inspector
    function handleShiftMouseDown(e) {
        if (!e.shiftKey) return;

        if (e.target.closest('#designPanel') ||
            e.target.closest('#elementInspectorPanel') ||
            e.target.closest('.design-fab')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        currentElement = e.target;
        startTime = Date.now();

        progressOverlay = createProgressOverlay();
        updateProgressOverlay(currentElement, 0);

        let progress = 0;
        progressTimer = setInterval(() => {
            progress = ((Date.now() - startTime) / LONG_PRESS_DURATION) * 100;
            updateProgressOverlay(currentElement, progress);

            if (progress >= 100) {
                clearInterval(progressTimer);
            }
        }, 50);

        longPressTimer = setTimeout(() => {
            longPressTimer = null;

            const tokens = extractDesignTokens(currentElement);
            displayElementTokens(currentElement, tokens);

            if (progressTimer) {
                clearInterval(progressTimer);
                progressTimer = null;
            }
            if (progressOverlay) {
                progressOverlay.remove();
                progressOverlay = null;
            }
        }, LONG_PRESS_DURATION);
    }

    // Handle mouseup to cleanup
    function handleMouseUp(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        if (progressOverlay) {
            progressOverlay.remove();
            progressOverlay = null;
        }
        currentElement = null;
    }

    // Handle Escape key to close inspector
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInspectorPanel();
        }
    });

    // Inspector is sticky - only closes via X button or Escape key
    // (click outside no longer closes it)

    // Attach event listeners
    document.addEventListener('mousedown', handleShiftMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);

    console.log('Design token inspector initialized: Shift-Hold (1 sec) to show, Escape/Click-outside/× to close');
})();
