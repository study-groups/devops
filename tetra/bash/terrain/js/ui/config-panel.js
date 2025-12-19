/**
 * Terrain Config Panel Module
 * Configuration UI panel
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;

    let panel = null;
    let isDragging = false;

    const TerrainConfigPanel = {
        /**
         * Initialize config panel module
         */
        init: function() {
            panel = document.getElementById('config-panel');
            if (!panel) return;

            this.bindEvents();
            this.restorePosition();
            this.applySectionState();
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            // FAB click opens panel (config FAB)
            const fab = document.querySelector('.fab-config') || document.querySelector('.fab');
            if (fab) {
                fab.addEventListener('click', () => this.toggle());
            }

            // Draggable header
            const header = panel.querySelector('h3');
            if (header) {
                header.style.cursor = 'move';
                header.style.userSelect = 'none';
                this.makeDraggable(header);
            }

            // Section toggle handlers
            panel.querySelectorAll('.config-section-header').forEach(header => {
                header.addEventListener('click', () => this.toggleSection(header));
            });

            // Slider handlers
            this.bindSliders();

            // Button handlers
            this.bindButtons();
        },

        /**
         * Bind slider inputs
         */
        bindSliders: function() {
            // Stack spacing
            const stackSpacing = document.getElementById('stack-spacing');
            if (stackSpacing) {
                stackSpacing.value = State.stacking.spacing;
                stackSpacing.addEventListener('input', (e) => {
                    State.stacking.spacing = parseInt(e.target.value);
                    document.getElementById('stack-spacing-val').textContent = Math.abs(State.stacking.spacing);
                    const mode = State.stacking.spacing < 0 ? 'deck' :
                                State.stacking.spacing === 0 ? 'stack' : 'spread';
                    document.getElementById('stack-mode').textContent = mode;
                    if (Terrain.Toasts) Terrain.Toasts.updateStacking();
                });
            }

            // Grid size
            const gridSize = document.getElementById('grid-size');
            if (gridSize) {
                gridSize.value = State.canvas.baseGridSize;
                gridSize.addEventListener('input', (e) => {
                    State.set('canvas.baseGridSize', parseInt(e.target.value));
                    document.getElementById('grid-size-val').textContent = State.canvas.baseGridSize;
                    if (Terrain.Grid) Terrain.Grid.draw();
                });
            }
        },

        /**
         * Bind button handlers
         */
        bindButtons: function() {
            // UI toggles
            this.bindToggle('toggle-projects', () => {
                if (Terrain.Nodes) Terrain.Nodes.toggleAll();
            });

            this.bindToggle('toggle-grid', () => {
                if (Terrain.Grid) Terrain.Grid.toggle();
            });

            this.bindToggle('toggle-home-btn', () => {
                this.toggleElement('home-btn', 'homeButton');
            });

            this.bindToggle('toggle-add-btn', () => {
                this.toggleElement('add-project-btn', 'addButton');
            });

            // Toast toggles
            const toastToggles = [
                { btn: 'toggle-toast-navigator', id: 'toast-navigator', key: 'toastNavigator' },
                { btn: 'toggle-toast-3d-navigator', id: 'toast-3d-navigator', key: 'toast3dNavigator' },
                { btn: 'toggle-toast-realworld', id: 'toast-realworld', key: 'toastRealworld' },
                { btn: 'toggle-toast-modifiers', id: 'toast-modifiers', key: 'toastModifiers' },
                { btn: 'toggle-toast-design-tokens', id: 'toast-design-tokens', key: 'toastDesignTokens' },
                { btn: 'toggle-toast-fonts', id: 'toast-fonts', key: 'toastFonts' },
                { btn: 'toggle-toast-projects', id: 'toast-projects', key: 'toastProjects' },
                { btn: 'toggle-toast-storage', id: 'toast-storage', key: 'toastStorage' }
            ];

            toastToggles.forEach(({ btn, id, key }) => {
                this.bindToggle(btn, () => {
                    if (Terrain.Toasts) Terrain.Toasts.toggle(id, key);
                    this.updateToggleButton(btn, State.ui[key]);
                });
            });

            // Subscribe to data-action events
            this.bindActions();
        },

        /**
         * Bind data-action event handlers
         */
        bindActions: function() {
            const self = this;

            Events.on('config:collapse-all', () => self.collapseAll());
            Events.on('config:expand-all', () => self.expandAll());
            Events.on('config:close', () => self.toggle());

            Events.on('config:save', () => {
                if (Terrain.Persistence) {
                    Terrain.Persistence.save();
                    if (Terrain.Popups) Terrain.Popups.alert('Settings saved!');
                }
            });

            Events.on('config:export', () => {
                if (Terrain.Popups) Terrain.Popups.alert('Settings exported!');
            });

            Events.on('canvas:reset', () => {
                if (Terrain.Canvas) Terrain.Canvas.goHome();
            });
        },

        /**
         * Helper to bind toggle button
         */
        bindToggle: function(buttonId, handler) {
            const btn = document.getElementById(buttonId);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        },

        /**
         * Toggle an element visibility
         */
        toggleElement: function(elementId, stateKey) {
            State.ui[stateKey] = !State.ui[stateKey];
            const element = document.getElementById(elementId);
            if (element) {
                element.classList.toggle('hidden', !State.ui[stateKey]);
            }
            this.updateToggleButton('toggle-' + elementId, State.ui[stateKey]);
        },

        /**
         * Update toggle button state
         */
        updateToggleButton: function(buttonId, isActive) {
            const btn = document.getElementById(buttonId);
            if (btn) {
                btn.classList.toggle('active', isActive);
            }
        },

        /**
         * Toggle panel visibility
         */
        toggle: function() {
            const isOpening = !panel.classList.contains('active');
            panel.classList.toggle('active');

            if (isOpening) {
                this.applySectionState();
                Events.emit(Events.EVENTS.CONFIG_OPEN);
            } else {
                Events.emit(Events.EVENTS.CONFIG_CLOSE);
            }
        },

        /**
         * Toggle section collapse
         */
        toggleSection: function(header) {
            const icon = header.querySelector('.collapse-icon');
            const content = header.nextElementSibling;

            if (icon && content) {
                icon.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            }
        },

        /**
         * Collapse all sections
         */
        collapseAll: function() {
            panel.querySelectorAll('.config-section').forEach(section => {
                const content = section.querySelector('.config-section-content');
                const icon = section.querySelector('.collapse-icon');
                if (content && icon) {
                    content.classList.add('collapsed');
                    icon.classList.add('collapsed');
                }
            });
            State.set('configSections.allCollapsed', true);
        },

        /**
         * Expand all sections
         */
        expandAll: function() {
            panel.querySelectorAll('.config-section').forEach(section => {
                const content = section.querySelector('.config-section-content');
                const icon = section.querySelector('.collapse-icon');
                if (content && icon) {
                    content.classList.remove('collapsed');
                    icon.classList.remove('collapsed');
                }
            });
            State.set('configSections.allCollapsed', false);
        },

        /**
         * Apply saved section state
         */
        applySectionState: function() {
            const sections = State.get('configSections');
            if (sections && sections.allCollapsed) {
                this.collapseAll();
            } else {
                this.expandAll();
            }
        },

        /**
         * Make header draggable
         */
        makeDraggable: function(header) {
            const self = this;
            let startX, startY;

            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                const rect = panel.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                header.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const newX = e.clientX - startX;
                const newY = e.clientY - startY;

                State.set('panelPosition.x', newX);
                State.set('panelPosition.y', newY);

                panel.style.position = 'fixed';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                panel.style.left = newX + 'px';
                panel.style.top = newY + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = 'move';
                }
            });
        },

        /**
         * Restore saved panel position
         */
        restorePosition: function() {
            const pos = State.get('panelPosition');
            if (pos && pos.x !== null) {
                panel.style.position = 'fixed';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                panel.style.left = pos.x + 'px';
                panel.style.top = pos.y + 'px';
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.ConfigPanel = TerrainConfigPanel;

})();
