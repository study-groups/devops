/**
 * Terrain Element Inspector Module
 * TUT-compatible CSS inspector with Shift+Hold activation
 */
(function() {
    'use strict';

    const LONG_PRESS_DURATION = 1000;

    let inspectorPanel = null;
    let progressOverlay = null;
    let progressTimer = null;
    let longPressTimer = null;
    let currentElement = null;
    let startTime = 0;

    const TerrainInspector = {
        /**
         * Initialize inspector module
         */
        init: function() {
            this.createPanel();
            this.bindEvents();
            console.log('[Inspector] Initialized');
        },

        /**
         * Create inspector panel
         */
        createPanel: function() {
            inspectorPanel = document.createElement('div');
            inspectorPanel.id = 'element-inspector';
            inspectorPanel.className = 'element-inspector';
            inspectorPanel.innerHTML = `
                <div class="inspector-header">
                    <span>Element Design Tokens <span class="inspector-hint">(drag to move)</span></span>
                    <span class="inspector-close" onclick="Terrain.Inspector.close()">&times;</span>
                </div>
                <div class="inspector-content"></div>
            `;
            document.body.appendChild(inspectorPanel);

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.close();
            });
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            document.addEventListener('mousedown', (e) => this.handleMouseDown(e), true);
            document.addEventListener('mouseup', () => this.handleMouseUp(), true);
            document.addEventListener('mouseleave', () => this.handleMouseUp());
        },

        /**
         * Create progress overlay for shift-hold
         */
        createProgressOverlay: function() {
            const overlay = document.createElement('div');
            overlay.className = 'inspector-progress-overlay';
            overlay.innerHTML = `<div class="inspector-progress-badge"><span class="progress-text">0.0s / 1.0s</span></div>`;
            document.body.appendChild(overlay);
            return overlay;
        },

        /**
         * Update progress overlay position and progress
         */
        updateProgressOverlay: function(element, progress) {
            if (!progressOverlay) return;
            const rect = element.getBoundingClientRect();
            progressOverlay.style.left = rect.left + 'px';
            progressOverlay.style.top = rect.top + 'px';
            progressOverlay.style.width = rect.width + 'px';
            progressOverlay.style.height = rect.height + 'px';
            const elapsed = (progress * LONG_PRESS_DURATION / 100) / 1000;
            const progressText = progressOverlay.querySelector('.progress-text');
            if (progressText) progressText.textContent = `${elapsed.toFixed(1)}s / 1.0s`;
            const alpha = Math.min(0.3, progress / 100 * 0.3);
            progressOverlay.style.background = `radial-gradient(circle, rgba(74, 158, 255, ${alpha}) 0%, rgba(74, 158, 255, ${alpha * 0.3}) 100%)`;
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
         * Extract full design tokens from element
         */
        extractDesignTokens: function(element) {
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
         * Create token section HTML
         */
        createTokenSection: function(title, tokens) {
            let html = `<div class="inspector-token-section"><div class="inspector-section-title">${title}</div>`;
            for (const [key, value] of Object.entries(tokens)) {
                const isColor = title === 'Colors';
                const colorSwatch = isColor && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent'
                    ? `<div class="inspector-color-swatch" style="background:${value}"></div>` : '';
                html += `<div class="inspector-token-row">${colorSwatch}<div class="inspector-token-info"><div class="inspector-token-key">${key}</div><div class="inspector-token-value">${value}</div></div></div>`;
            }
            html += '</div>';
            return html;
        },

        /**
         * Make inspector panel draggable
         */
        makeDraggable: function(panel) {
            const header = panel.querySelector('.inspector-header');
            let isDragging = false, initialX, initialY;

            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('inspector-close')) return;
                isDragging = true;
                initialX = e.clientX - (parseInt(panel.style.left) || 0);
                initialY = e.clientY - (parseInt(panel.style.top) || 0);
                panel.style.transform = 'none';
                header.style.cursor = 'grabbing';
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
                header.style.cursor = 'grab';
            });
        },

        /**
         * Close inspector panel
         */
        close: function() {
            if (inspectorPanel) {
                inspectorPanel.classList.remove('visible');
            }
        },

        /**
         * Handle mouse down for long-press inspection
         */
        handleMouseDown: function(e) {
            if (!e.shiftKey) return;
            if (e.target.closest('#design-panel')) return;
            if (e.target.closest('#element-inspector')) return;
            if (e.target.closest('.design-fab')) return;

            e.preventDefault();
            e.stopPropagation();

            currentElement = e.target;
            startTime = Date.now();
            progressOverlay = this.createProgressOverlay();
            this.updateProgressOverlay(currentElement, 0);

            let progress = 0;
            progressTimer = setInterval(() => {
                progress = ((Date.now() - startTime) / LONG_PRESS_DURATION) * 100;
                this.updateProgressOverlay(currentElement, progress);
                if (progress >= 100) clearInterval(progressTimer);
            }, 50);

            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                this.inspect(currentElement);
                if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
                if (progressOverlay) { progressOverlay.remove(); progressOverlay = null; }
            }, LONG_PRESS_DURATION);
        },

        /**
         * Handle mouse up
         */
        handleMouseUp: function() {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
            if (progressOverlay) { progressOverlay.remove(); progressOverlay = null; }
            currentElement = null;
        },

        /**
         * Inspect an element
         */
        inspect: function(element) {
            const tokens = this.extractDesignTokens(element);
            const content = inspectorPanel.querySelector('.inspector-content');

            let html = `
                <div class="inspector-element-info">
                    <div class="inspector-section-title">Element Info</div>
                    <div class="inspector-element-detail"><strong>Tag:</strong> &lt;${tokens.element.tag}&gt;</div>
                    <div class="inspector-element-detail"><strong>ID:</strong> ${tokens.element.id}</div>
                    <div class="inspector-element-detail"><strong>Classes:</strong> ${tokens.element.classes}</div>
                    <div class="inspector-element-detail">
                        <strong>XPath:</strong>
                        <div class="inspector-xpath" onclick="navigator.clipboard.writeText('${tokens.element.xpath}')" title="Click to copy">${tokens.element.xpath}</div>
                    </div>
                </div>
            `;

            html += this.createTokenSection('Colors', tokens.colors);
            html += this.createTokenSection('Typography', tokens.typography);
            html += this.createTokenSection('Spacing', tokens.spacing);
            html += this.createTokenSection('Border', tokens.border);
            html += this.createTokenSection('Layout', tokens.layout);

            content.innerHTML = html;
            inspectorPanel.classList.add('visible');

            // Make draggable on first show
            if (!inspectorPanel._draggable) {
                this.makeDraggable(inspectorPanel);
                inspectorPanel._draggable = true;
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Inspector = TerrainInspector;

})();
