/**
 * TUT Inspector - Element inspector (Shift-Hold)
 */

const TUT_Inspector = {
    longPressTimer: null,
    progressTimer: null,
    currentElement: null,
    progressOverlay: null,
    startTime: 0,
    LONG_PRESS_DURATION: 1000,

    /**
     * Initialize inspector
     */
    init: function() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePanel();
        });
        document.addEventListener('mousedown', this.handleShiftMouseDown.bind(this), true);
        document.addEventListener('mouseup', this.handleMouseUp.bind(this), true);
    },

    /**
     * Create progress overlay
     */
    createProgressOverlay: function() {
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
            <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
                        background: var(--bg-secondary); border: 2px solid var(--accent-primary);
                        border-radius: 20px; padding: 4px 12px; font-size: 11px;
                        font-family: 'Courier New', monospace; color: var(--accent-primary); white-space: nowrap;">
                <span class="progress-text">0.0s / 1.0s</span>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    },

    /**
     * Update progress overlay position and progress
     */
    updateProgressOverlay: function(element, progress) {
        if (!this.progressOverlay) return;
        const rect = element.getBoundingClientRect();
        this.progressOverlay.style.left = rect.left + 'px';
        this.progressOverlay.style.top = rect.top + 'px';
        this.progressOverlay.style.width = rect.width + 'px';
        this.progressOverlay.style.height = rect.height + 'px';

        const elapsed = (progress * this.LONG_PRESS_DURATION / 100) / 1000;
        const progressText = this.progressOverlay.querySelector('.progress-text');
        if (progressText) progressText.textContent = `${elapsed.toFixed(1)}s / 1.0s`;

        const alpha = Math.min(0.3, progress / 100 * 0.3);
        this.progressOverlay.style.background = `radial-gradient(circle, rgba(88, 166, 255, ${alpha}) 0%, rgba(88, 166, 255, ${alpha * 0.3}) 100%)`;
    },

    /**
     * Get XPath for element
     */
    getXPath: function(element) {
        if (element.id) return `//*[@id="${element.id}"]`;
        if (element === document.body) return '/html/body';

        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                const parentPath = element.parentNode ? this.getXPath(element.parentNode) : '';
                return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
        }
        return '';
    },

    /**
     * Extract design tokens from element
     */
    extractTokens: function(element) {
        const computed = window.getComputedStyle(element);
        return {
            element: {
                tag: element.tagName.toLowerCase(),
                classes: Array.from(element.classList).join(', ') || 'none',
                id: element.id || 'none',
                xpath: this.getXPath(element)
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
    },

    /**
     * Display element tokens in inspector panel
     */
    displayTokens: function(element, tokens) {
        let panel = document.getElementById('elementInspectorPanel');
        if (!panel) panel = this.createPanel();
        this.populatePanel(panel, element, tokens);
        panel.classList.add('visible');
        panel.style.display = 'flex';
    },

    /**
     * Create inspector panel
     */
    createPanel: function() {
        const panel = document.createElement('div');
        panel.id = 'elementInspectorPanel';
        panel.innerHTML = `
            <div class="inspector-header">
                <span>Element Design Tokens
                    <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal;">(drag to move)</span>
                </span>
                <span class="close-inspector" style="cursor: pointer; color: var(--text-secondary); font-size: 1.5rem; padding: 0 0.5rem;">&times;</span>
            </div>
            <div class="inspector-content"></div>
        `;
        this.makeDraggable(panel);
        panel.querySelector('.close-inspector').addEventListener('click', () => this.closePanel());
        document.body.appendChild(panel);
        return panel;
    },

    /**
     * Make panel draggable
     */
    makeDraggable: function(panel) {
        const header = panel.querySelector('.inspector-header');
        let isDragging = false, initialX, initialY;

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

        document.addEventListener('mouseup', () => { isDragging = false; });
    },

    /**
     * Close inspector panel
     */
    closePanel: function() {
        const panel = document.getElementById('elementInspectorPanel');
        if (panel) {
            panel.classList.remove('visible');
            panel.style.display = 'none';
        }
    },

    /**
     * Populate inspector panel with tokens
     */
    populatePanel: function(panel, element, tokens) {
        const content = panel.querySelector('.inspector-content');

        let html = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border);">
                <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 0.5rem;">Element Info</div>
                <div style="font-family: 'Courier New', monospace; color: var(--text-secondary); font-size: 0.8rem;">
                    <div style="margin-bottom: 0.5rem;"><strong>Tag:</strong> &lt;${tokens.element.tag}&gt;</div>
                    <div style="margin-bottom: 0.5rem;"><strong>ID:</strong> ${tokens.element.id}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Classes:</strong> ${tokens.element.classes}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>XPath:</strong>
                        <div style="background: var(--bg-secondary); padding: 0.5rem; border-radius: 3px;
                                    margin-top: 0.25rem; word-break: break-all; color: var(--accent-primary);
                                    font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer;"
                             onclick="navigator.clipboard.writeText('${tokens.element.xpath}')"
                             title="Click to copy">${tokens.element.xpath}</div>
                    </div>
                </div>
            </div>
        `;

        html += this.createTokenSection('Colors', tokens.colors);
        html += this.createTokenSection('Typography', tokens.typography);
        html += this.createTokenSection('Spacing', tokens.spacing);
        html += this.createTokenSection('Border', tokens.border);
        html += this.createTokenSection('Layout', tokens.layout);

        content.innerHTML = html;
    },

    /**
     * Create token section HTML
     */
    createTokenSection: function(title, tokens) {
        let html = `
            <div style="margin-bottom: 1.5rem;">
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;
                            font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
        `;

        for (const [key, value] of Object.entries(tokens)) {
            const isColor = title === 'Colors';
            const colorSwatch = isColor && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent'
                ? `<div style="width: 24px; height: 24px; background: ${value}; border: 1px solid var(--border); border-radius: 3px; flex-shrink: 0;"></div>`
                : '';

            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;
                            padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">
                    ${colorSwatch}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${key}</div>
                        <div style="font-family: 'Courier New', monospace; font-size: 0.7rem;
                                    color: var(--accent-primary); overflow: hidden; text-overflow: ellipsis;">${value}</div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    },

    /**
     * Handle shift+mousedown for long press
     */
    handleShiftMouseDown: function(e) {
        if (!e.shiftKey) return;
        if (e.target.closest('#designPanel') ||
            e.target.closest('#elementInspectorPanel') ||
            e.target.closest('.design-fab')) return;

        e.preventDefault();
        e.stopPropagation();

        this.currentElement = e.target;
        this.startTime = Date.now();
        this.progressOverlay = this.createProgressOverlay();
        this.updateProgressOverlay(this.currentElement, 0);

        let progress = 0;
        this.progressTimer = setInterval(() => {
            progress = ((Date.now() - this.startTime) / this.LONG_PRESS_DURATION) * 100;
            this.updateProgressOverlay(this.currentElement, progress);
            if (progress >= 100) clearInterval(this.progressTimer);
        }, 50);

        this.longPressTimer = setTimeout(() => {
            this.longPressTimer = null;
            const tokens = this.extractTokens(this.currentElement);
            this.displayTokens(this.currentElement, tokens);

            if (this.progressTimer) {
                clearInterval(this.progressTimer);
                this.progressTimer = null;
            }
            if (this.progressOverlay) {
                this.progressOverlay.remove();
                this.progressOverlay = null;
            }
        }, this.LONG_PRESS_DURATION);
    },

    /**
     * Handle mouseup to cancel long press
     */
    handleMouseUp: function(e) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        if (this.progressOverlay) {
            this.progressOverlay.remove();
            this.progressOverlay = null;
        }
        this.currentElement = null;
    }
};
