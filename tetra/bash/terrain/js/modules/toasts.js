/**
 * Terrain Toasts Module
 * Toast system with stacking layout
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;

    const FAB_HEIGHT = 64;
    const FAB_MARGIN = 24;
    const TITLE_ONLY_HEIGHT = 22;

    const TerrainToasts = {
        /**
         * Initialize toasts module
         */
        init: function() {
            this.bindEvents();
            this.applyUIState();

            // Initial stacking after a small delay
            setTimeout(() => this.updateStacking(), 100);
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            window.addEventListener('resize', () => this.updateStacking());

            // Keyboard controls for stacking (Shift + Arrow keys)
            document.addEventListener('keydown', (e) => {
                if (e.shiftKey && !e.ctrlKey) {
                    let delta = 0;
                    if (e.key === 'ArrowUp' || e.key === '[') {
                        delta = 5;
                        e.preventDefault();
                    } else if (e.key === 'ArrowDown' || e.key === ']') {
                        delta = -5;
                        e.preventDefault();
                    }

                    if (delta !== 0) {
                        const newSpacing = Math.max(-50, Math.min(100, State.stacking.spacing + delta));
                        State.stacking.spacing = newSpacing;
                        this.updateStacking();
                        this.updateSlider();
                    }
                }
            });

            // Shift+Scroll controls toast stacking
            const canvas = document.getElementById('canvas');
            if (canvas) {
                canvas.addEventListener('wheel', (e) => {
                    if (e.shiftKey && !e.ctrlKey) {
                        e.preventDefault();

                        // Use deltaY, fallback to deltaX for horizontal scroll
                        let rawDelta = e.deltaY;
                        if (Math.abs(rawDelta) < 0.1 && Math.abs(e.deltaX) > 0.1) {
                            rawDelta = e.deltaX;
                        }

                        // Calculate delta based on scroll magnitude
                        const magnitude = Math.abs(rawDelta);
                        let delta;

                        if (rawDelta > 0) {
                            // Positive = compact (decrease spacing)
                            delta = magnitude < 1 ? -1 : Math.floor(-magnitude / 3);
                        } else if (rawDelta < 0) {
                            // Negative = spread (increase spacing)
                            delta = magnitude < 1 ? 1 : Math.ceil(magnitude / 3);
                        } else {
                            return;
                        }

                        const newSpacing = Math.max(-50, Math.min(100, State.stacking.spacing + delta));
                        State.stacking.spacing = newSpacing;
                        this.updateStacking();
                        this.updateSlider();
                    }
                }, { passive: false });
            }
        },

        /**
         * Update stacking positions
         */
        updateStacking: function() {
            const spacing = State.stacking.spacing;
            const bottomMargin = FAB_HEIGHT + FAB_MARGIN + 8;

            // Right stack toasts
            const rightToasts = [
                { id: 'toast-modifiers', key: 'toastModifiers' },
                { id: 'toast-realworld', key: 'toastRealworld' },
                { id: 'toast-3d-navigator', key: 'toast3dNavigator' },
                { id: 'toast-navigator', key: 'toastNavigator' }
            ];

            this.stackToasts(rightToasts, bottomMargin, spacing);

            // Left stack toasts
            const leftToasts = [
                { id: 'toast-storage', key: 'toastStorage' },
                { id: 'toast-projects', key: 'toastProjects' },
                { id: 'toast-fonts', key: 'toastFonts' },
                { id: 'toast-design-tokens', key: 'toastDesignTokens' }
            ];

            this.stackToasts(leftToasts, bottomMargin, spacing);

            Events.emit(Events.EVENTS.TOAST_STACK_UPDATE, { spacing });
        },

        /**
         * Stack a group of toasts
         */
        stackToasts: function(toasts, startBottom, spacing) {
            let currentBottom = startBottom;

            // Get visible toasts with their elements and heights
            const visibleToasts = [];
            const hiddenToasts = [];

            toasts.forEach(toast => {
                const element = document.getElementById(toast.id);
                if (!element) return;

                const isVisible = State.ui[toast.key] && !element.classList.contains('hidden');

                if (isVisible) {
                    // Temporarily remove stacked class to get true height
                    element.classList.remove('stacked');
                    visibleToasts.push({
                        ...toast,
                        element,
                        height: element.offsetHeight
                    });
                } else {
                    hiddenToasts.push({ ...toast, element });
                }
            });

            // Sort by height descending (largest on bottom) when expanded
            if (spacing >= 0) {
                visibleToasts.sort((a, b) => b.height - a.height);
            }

            // Position visible toasts
            visibleToasts.forEach(toast => {
                toast.element.style.top = 'auto';
                toast.element.style.bottom = currentBottom + 'px';

                if (spacing < 0) {
                    // Deck mode: show only titles
                    toast.element.classList.add('stacked');
                    currentBottom += TITLE_ONLY_HEIGHT + spacing;
                } else {
                    // Normal/spread mode
                    toast.element.classList.remove('stacked');
                    currentBottom += toast.height + spacing;
                }
            });

            // Position hidden toasts at current bottom
            hiddenToasts.forEach(toast => {
                toast.element.style.top = 'auto';
                toast.element.style.bottom = currentBottom + 'px';
            });
        },

        /**
         * Apply UI state to toasts
         */
        applyUIState: function() {
            const toastIds = [
                { id: 'toast-navigator', key: 'toastNavigator' },
                { id: 'toast-3d-navigator', key: 'toast3dNavigator' },
                { id: 'toast-realworld', key: 'toastRealworld' },
                { id: 'toast-modifiers', key: 'toastModifiers' },
                { id: 'toast-design-tokens', key: 'toastDesignTokens' },
                { id: 'toast-fonts', key: 'toastFonts' },
                { id: 'toast-projects', key: 'toastProjects' },
                { id: 'toast-storage', key: 'toastStorage' }
            ];

            toastIds.forEach(({ id, key }) => {
                const element = document.getElementById(id);
                if (element) {
                    element.classList.toggle('hidden', !State.ui[key]);
                }
            });

            // Update projects and storage content
            this.updateProjectsToast();
            this.updateStorageToast();
        },

        /**
         * Toggle a toast visibility
         */
        toggle: function(toastId, stateKey) {
            State.ui[stateKey] = !State.ui[stateKey];
            const element = document.getElementById(toastId);
            if (element) {
                element.classList.toggle('hidden', !State.ui[stateKey]);
            }
            setTimeout(() => this.updateStacking(), 50);
            Events.emit(Events.EVENTS.UI_TOGGLE, { element: toastId, visible: State.ui[stateKey] });
        },

        /**
         * Update projects toast content
         */
        updateProjectsToast: function() {
            const content = document.getElementById('toast-projects-content');
            if (!content) return;

            content.innerHTML = '';
            const projects = State.projects.getAll();

            projects.forEach((project, index) => {
                const isVisible = !project.hidden;
                const item = document.createElement('div');
                item.className = 'project-item';

                item.innerHTML = `
                    <div class="project-item-left">
                        <div class="project-checkbox ${isVisible ? 'checked' : ''}" data-index="${index}"></div>
                        <span class="project-name">${this.escapeHtml(project.title)}</span>
                    </div>
                    <div class="project-item-right">
                        <span class="project-status ${project.status || 'draft'}">${project.status || 'draft'}</span>
                        <span class="project-position">(${Math.round(project.x)}, ${Math.round(project.y)})</span>
                    </div>
                `;

                // Bind checkbox click
                item.querySelector('.project-checkbox').addEventListener('click', () => {
                    if (Terrain.Projects) {
                        Terrain.Projects.toggleVisibility(index);
                        this.updateProjectsToast();
                    }
                });

                content.appendChild(item);
            });
        },

        /**
         * Update storage toast content
         */
        updateStorageToast: function() {
            const content = document.getElementById('toast-storage-content');
            if (!content) return;

            let totalSize = 0;
            const keys = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const size = new Blob([value]).size;
                totalSize += size;
                keys.push({ key, size });
            }

            keys.sort((a, b) => b.size - a.size);

            content.innerHTML = `
                <div class="storage-stat">
                    <span class="storage-stat-label">Total Size</span>
                    <span class="storage-stat-value">${this.formatBytes(totalSize)}</span>
                </div>
                <div class="storage-stat">
                    <span class="storage-stat-label">Keys</span>
                    <span class="storage-stat-value">${localStorage.length}</span>
                </div>
                <div class="storage-section-title">Breakdown</div>
                ${keys.map(({ key, size }) => `
                    <div class="storage-key-item">
                        <span class="storage-key-name">${this.escapeHtml(key)}</span>
                        <span class="storage-key-size">${this.formatBytes(size)}</span>
                    </div>
                `).join('')}
            `;
        },

        /**
         * Update slider display
         */
        updateSlider: function() {
            const slider = document.getElementById('stack-spacing');
            if (slider) {
                slider.value = State.stacking.spacing;
                const valEl = document.getElementById('stack-spacing-val');
                if (valEl) valEl.textContent = Math.abs(State.stacking.spacing);

                const modeEl = document.getElementById('stack-mode');
                if (modeEl) {
                    const mode = State.stacking.spacing < 0 ? 'deck' :
                                State.stacking.spacing === 0 ? 'stack' : 'spread';
                    modeEl.textContent = mode;
                }
            }
        },

        /**
         * Format bytes to human readable
         */
        formatBytes: function(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },

        /**
         * Escape HTML
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Toasts = TerrainToasts;

})();
