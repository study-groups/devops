/**
 * Terrain Explorer
 * Visualizes the two-layer token architecture with mode-aware transitions
 */
(function() {
    'use strict';

    // =========================================================================
    // MODE & COMPATIBILITY STATE
    // =========================================================================

    let currentMode = 'freerange';
    let modeCompatibility = null;
    let modeConfigs = {};

    const MODES = ['freerange', 'control', 'deploy', 'dashboard', 'site', 'thesis', 'guide', 'reference'];
    const CORE_MODES = ['freerange', 'control', 'deploy', 'dashboard'];

    // =========================================================================
    // TOKEN DEFINITIONS
    // =========================================================================

    const PALETTES = {
        primary: {
            name: 'Primary (p)',
            description: 'bg1-4, text5, status6-8',
            tokens: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
        },
        secondary: {
            name: 'Accent (s)',
            description: 'Chromatic accents',
            tokens: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']
        },
        tertiary: {
            name: 'Tertiary (t)',
            description: 'Greys for text & borders',
            tokens: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']
        }
    };

    // Semantic mappings: semantic token → palette token (matches tokens.css)
    const SEMANTIC_MAPPINGS = {
        backgrounds: {
            name: 'Backgrounds',
            tokens: {
                'bg-primary': 'p1',
                'bg-secondary': 'p2',
                'bg-tertiary': 'p3',
                'bg-hover': 'p4'
            }
        },
        text: {
            name: 'Text',
            tokens: {
                'text-primary': 'p5',
                'text-secondary': 't6',
                'text-muted': 't4',
                'text-code': 's4'
            }
        },
        borders: {
            name: 'Borders',
            tokens: {
                'border': 't2',
                'border-visible': 't3',
                'border-active': 's2'
            }
        },
        status: {
            name: 'Status',
            tokens: {
                'accent-primary': 's2',
                'accent-secondary': 's1',
                'success': 'p7',
                'error': 'p6',
                'warning': 's3'
            }
        }
    };

    const UTILITY_TOKENS = {
        gaps: {
            name: 'Spacing',
            type: 'spacing',
            tokens: ['gap-xs', 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl']
        },
        curves: {
            name: 'Curves',
            type: 'curve',
            tokens: ['curve-sm', 'curve-md', 'curve-lg', 'curve-full']
        },
        depth: {
            name: 'Depth',
            type: 'shadow',
            tokens: ['depth-sm', 'depth-md', 'depth-lg']
        },
        tempo: {
            name: 'Tempo',
            type: 'text',
            tokens: ['tempo-fast', 'tempo-normal', 'tempo-slow']
        }
    };

    const THEMES = ['dark', 'midnight', 'cyber', 'forest', 'amber', 'lava', 'lcd', 'tv', 'controldeck'];

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function getTokenValue(name) {
        const prop = name.startsWith('--') ? name : `--${name}`;
        return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return '#000000';
        if (rgb.startsWith('#')) return rgb;
        if (rgb.startsWith('var(')) return rgb;
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return rgb;
        return '#' + [match[1], match[2], match[3]]
            .map(x => parseInt(x).toString(16).padStart(2, '0'))
            .join('');
    }

    function copyToClipboard(text, element) {
        navigator.clipboard.writeText(text).then(() => {
            if (element) {
                element.classList.add('copied');
                setTimeout(() => element.classList.remove('copied'), 800);
            }
        });
    }

    // =========================================================================
    // RENDER PALETTES
    // =========================================================================

    function renderPalettes() {
        const container = document.getElementById('palettesContainer');
        if (!container) return;

        container.innerHTML = Object.entries(PALETTES).map(([key, config]) => {
            const tokens = config.tokens.map(token => {
                const value = rgbToHex(getTokenValue(token));
                return `
                    <div class="palette-token" data-token="${token}">
                        <div class="palette-swatch" style="background: var(--${token})"></div>
                        <div class="palette-label">${token}</div>
                        <div class="palette-value">${value}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="palette-group" data-palette="${key}">
                    <div class="palette-header">
                        <span class="palette-name">${config.name}</span>
                        <span class="palette-desc">${config.description}</span>
                    </div>
                    <div class="palette-tokens">${tokens}</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.palette-token').forEach(el => {
            el.addEventListener('click', () => {
                copyToClipboard(`var(--${el.dataset.token})`, el);
            });
        });
    }

    // =========================================================================
    // RENDER SEMANTICS
    // =========================================================================

    function renderSemantics() {
        const container = document.getElementById('semanticsContainer');
        if (!container) return;

        container.innerHTML = Object.entries(SEMANTIC_MAPPINGS).map(([key, config]) => {
            const rows = Object.entries(config.tokens).map(([semantic, palette]) => {
                const value = rgbToHex(getTokenValue(semantic));
                return `
                    <div class="mapping-row" data-semantic="${semantic}" data-palette="${palette}">
                        <div class="mapping-swatches">
                            <div class="mapping-swatch" style="background: var(--${semantic})" title="--${semantic}"></div>
                            <span class="mapping-equals">=</span>
                            <div class="mapping-swatch mapping-swatch-palette" style="background: var(--${palette})" title="--${palette}"></div>
                        </div>
                        <div class="mapping-info">
                            <span class="mapping-name">--${semantic}</span>
                            <span class="mapping-ref">← --${palette}</span>
                        </div>
                        <div class="mapping-value">${value}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="semantic-group">
                    <div class="semantic-header">${config.name}</div>
                    <div class="semantic-mappings">${rows}</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.mapping-row').forEach(row => {
            row.addEventListener('click', () => {
                copyToClipboard(`var(--${row.dataset.semantic})`, row);
            });
            row.addEventListener('mouseenter', () => {
                document.querySelector(`.palette-token[data-token="${row.dataset.palette}"]`)
                    ?.classList.add('highlighted');
            });
            row.addEventListener('mouseleave', () => {
                document.querySelectorAll('.palette-token.highlighted')
                    .forEach(el => el.classList.remove('highlighted'));
            });
        });
    }

    // =========================================================================
    // RENDER UTILITIES
    // =========================================================================

    function renderUtilities() {
        const container = document.getElementById('utilitiesContainer');
        if (!container) return;

        container.innerHTML = Object.entries(UTILITY_TOKENS).map(([key, config]) => {
            const tokens = config.tokens.map(token => {
                const value = getTokenValue(token);
                let swatch = '';

                switch (config.type) {
                    case 'spacing':
                        const w = parseInt(value) || 8;
                        swatch = `<div class="utility-swatch utility-spacing" style="width: ${Math.min(w * 2, 48)}px"></div>`;
                        break;
                    case 'shadow':
                        swatch = `<div class="utility-swatch utility-shadow" style="box-shadow: var(--${token})"></div>`;
                        break;
                    case 'curve':
                        swatch = `<div class="utility-swatch utility-curve" style="border-radius: var(--${token})"></div>`;
                        break;
                    default:
                        swatch = `<div class="utility-swatch utility-text"></div>`;
                }

                return `
                    <div class="utility-token" data-token="${token}">
                        ${swatch}
                        <span class="utility-name">--${token}</span>
                        <span class="utility-value">${value}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="utility-group">
                    <div class="utility-header">${config.name}</div>
                    <div class="utility-tokens">${tokens}</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.utility-token').forEach(el => {
            el.addEventListener('click', () => {
                copyToClipboard(`var(--${el.dataset.token})`, el);
            });
        });
    }

    // =========================================================================
    // THEME SWITCHING
    // =========================================================================

    function switchTheme(name) {
        if (!THEMES.includes(name)) return;
        const link = document.getElementById('terrain-theme');
        if (link) link.href = `../dist/themes/${name}.theme.css`;
        setTimeout(() => {
            renderPalettes();
            renderSemantics();
            renderUtilities();
        }, 100);
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    function generateCSS() {
        let css = ':root {\n';
        Object.values(PALETTES).forEach(config => {
            config.tokens.forEach(t => {
                css += `    --${t}: ${rgbToHex(getTokenValue(t))};\n`;
            });
        });
        css += '\n';
        Object.values(SEMANTIC_MAPPINGS).forEach(config => {
            Object.entries(config.tokens).forEach(([s, p]) => {
                css += `    --${s}: var(--${p});\n`;
            });
        });
        css += '}\n';
        return css;
    }

    function generateJSON() {
        const result = { palettes: {}, semantics: {} };
        Object.entries(PALETTES).forEach(([k, c]) => {
            result.palettes[k] = {};
            c.tokens.forEach(t => result.palettes[k][t] = rgbToHex(getTokenValue(t)));
        });
        Object.entries(SEMANTIC_MAPPINGS).forEach(([k, c]) => {
            result.semantics[k] = {};
            Object.entries(c.tokens).forEach(([s, p]) => {
                result.semantics[k][s] = { alias: `var(--${p})`, value: rgbToHex(getTokenValue(s)) };
            });
        });
        return JSON.stringify(result, null, 2);
    }

    // =========================================================================
    // MODE COMPATIBILITY
    // =========================================================================

    async function loadModeCompatibility() {
        try {
            const response = await fetch('../data/mode-compatibility.json');
            modeCompatibility = await response.json();
            console.log('[Terrain Explorer] Mode compatibility loaded');
        } catch (e) {
            console.warn('[Terrain Explorer] Could not load mode-compatibility.json:', e);
            modeCompatibility = { transitions: {} };
        }
    }

    async function loadModeConfigs() {
        for (const mode of MODES) {
            try {
                const response = await fetch(`../dist/modes/${mode}.mode.json`);
                if (response.ok) {
                    modeConfigs[mode] = await response.json();
                }
            } catch (e) {
                console.warn(`[Terrain Explorer] Could not load ${mode}.mode.json`);
            }
        }
        console.log('[Terrain Explorer] Mode configs loaded:', Object.keys(modeConfigs));
    }

    function getTransitionInfo(fromMode, toMode) {
        if (!modeCompatibility?.transitions?.[fromMode]?.[toMode]) {
            // Check if it's a non-core mode
            if (!CORE_MODES.includes(fromMode) || !CORE_MODES.includes(toMode)) {
                return { compatibility: 'unmapped', message: 'Transition not yet defined' };
            }
            return null;
        }
        return modeCompatibility.transitions[fromMode][toMode];
    }

    function renderTransitions() {
        const container = document.getElementById('transitionsContainer');
        if (!container) return;

        const otherModes = MODES.filter(m => m !== currentMode);

        container.innerHTML = otherModes.map(targetMode => {
            const info = getTransitionInfo(currentMode, targetMode);
            const config = modeConfigs[targetMode];

            let statusClass, statusIcon, statusText;
            if (!info || info.compatibility === 'unmapped') {
                statusClass = 'unmapped';
                statusIcon = '?';
                statusText = 'unmapped';
            } else if (info.compatibility === 'full') {
                statusClass = 'full';
                statusIcon = '✓';
                statusText = 'full';
            } else if (info.compatibility === 'degraded') {
                statusClass = 'degraded';
                statusIcon = '⚠';
                statusText = 'degraded';
            } else {
                statusClass = 'incompatible';
                statusIcon = '✗';
                statusText = 'incompatible';
            }

            const isDisabled = statusClass === 'unmapped' || statusClass === 'incompatible';
            const description = config?.mode?.description || '';

            return `
                <div class="transition-card ${statusClass}" data-target="${targetMode}">
                    <div class="transition-header">
                        <span class="transition-name">${targetMode}</span>
                        <span class="transition-status">${statusIcon} ${statusText}</span>
                    </div>
                    <div class="transition-desc">${description}</div>
                    <div class="transition-info">
                        ${info?.survives ? `<span class="info-keeps">Keeps: ${info.survives.join(', ')}</span>` : ''}
                        ${info?.lost?.length ? `<span class="info-lost">Lost: ${info.lost.join(', ')}</span>` : ''}
                    </div>
                    <button class="transition-btn" ${isDisabled ? 'disabled' : ''}>
                        ${isDisabled ? 'Disabled' : 'Switch'}
                    </button>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.transition-card:not(.unmapped):not(.incompatible)').forEach(card => {
            const btn = card.querySelector('.transition-btn');
            btn?.addEventListener('click', () => {
                const targetMode = card.dataset.target;
                const info = getTransitionInfo(currentMode, targetMode);
                if (info?.compatibility === 'degraded') {
                    showConfirmModal(targetMode, info);
                } else {
                    performModeSwitch(targetMode);
                }
            });
        });
    }

    function showConfirmModal(targetMode, info) {
        const modal = document.getElementById('confirmModal');
        const title = document.getElementById('confirmTitle');
        const keeps = document.getElementById('confirmKeeps');
        const changes = document.getElementById('confirmChanges');
        const lost = document.getElementById('confirmLost');

        title.textContent = `Switch to "${targetMode}" mode?`;

        keeps.innerHTML = info.survives?.length
            ? `<span class="confirm-icon confirm-keeps">✓</span> Keeps: ${info.survives.join(', ')}`
            : '';

        changes.innerHTML = info.message
            ? `<span class="confirm-icon confirm-changes">⚠</span> Changes: ${info.message}`
            : '';

        lost.innerHTML = info.lost?.length
            ? `<span class="confirm-icon confirm-lost">✗</span> Lost: ${info.lost.join(', ')}`
            : '';

        modal.classList.remove('hidden');
        modal.dataset.targetMode = targetMode;
    }

    function hideConfirmModal() {
        document.getElementById('confirmModal')?.classList.add('hidden');
    }

    function performModeSwitch(targetMode) {
        currentMode = targetMode;
        document.getElementById('modeSwitcher').value = targetMode;

        // Update theme to mode's default if defined
        const modeConfig = modeConfigs[targetMode];
        if (modeConfig?.defaultTheme) {
            switchTheme(modeConfig.defaultTheme);
            document.getElementById('themeSwitcher').value = modeConfig.defaultTheme;
        }

        renderTransitions();
        console.log(`[Terrain Explorer] Switched to mode: ${targetMode}`);
    }

    // =========================================================================
    // INIT
    // =========================================================================

    async function init() {
        // Load mode data
        await Promise.all([
            loadModeCompatibility(),
            loadModeConfigs()
        ]);

        // Render all sections
        renderPalettes();
        renderSemantics();
        renderUtilities();
        renderTransitions();

        // Theme switcher
        document.getElementById('themeSwitcher')?.addEventListener('change', e => {
            switchTheme(e.target.value);
        });

        // Mode switcher (direct selection)
        document.getElementById('modeSwitcher')?.addEventListener('change', e => {
            const targetMode = e.target.value;
            const info = getTransitionInfo(currentMode, targetMode);
            if (info?.compatibility === 'degraded') {
                showConfirmModal(targetMode, info);
                // Reset select to current mode until confirmed
                e.target.value = currentMode;
            } else if (!info || info.compatibility === 'unmapped') {
                // Allow switch anyway for unmapped (no confirmation)
                currentMode = targetMode;
                renderTransitions();
            } else {
                performModeSwitch(targetMode);
            }
        });

        // Confirm modal handlers
        document.getElementById('confirmCancel')?.addEventListener('click', () => {
            hideConfirmModal();
        });

        document.getElementById('confirmProceed')?.addEventListener('click', () => {
            const modal = document.getElementById('confirmModal');
            const targetMode = modal?.dataset.targetMode;
            if (targetMode) {
                performModeSwitch(targetMode);
            }
            hideConfirmModal();
        });

        // Export buttons
        document.getElementById('copyCSS')?.addEventListener('click', e => {
            copyToClipboard(generateCSS(), e.target);
        });

        document.getElementById('copyJSON')?.addEventListener('click', e => {
            copyToClipboard(generateJSON(), e.target);
        });

        console.log('[Terrain Explorer] Ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
