/**
 * Terrain Canvas Module
 * Handles canvas panning (no zoom - fixed scale)
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;

    let canvas = null;
    let canvasContent = null;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const TerrainCanvas = {
        /**
         * Initialize canvas module
         */
        init: function() {
            canvas = document.getElementById('canvas');
            canvasContent = document.getElementById('canvas-content');

            if (!canvas || !canvasContent) {
                console.error('[Canvas] Required elements not found');
                return;
            }

            this.bindEvents();
            this.updateTransform();
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            // Pan start
            canvas.addEventListener('mousedown', (e) => {
                if (e.target.closest('.project-card')) return;
                isPanning = true;
                startX = e.clientX - State.canvas.translateX;
                startY = e.clientY - State.canvas.translateY;
            });

            // Pan move
            document.addEventListener('mousemove', (e) => {
                if (!isPanning) return;
                State.canvas.translateX = e.clientX - startX;
                State.canvas.translateY = e.clientY - startY;
                this.updateTransform();
            });

            // Pan end
            document.addEventListener('mouseup', () => {
                isPanning = false;
            });

            // Touch support
            canvas.addEventListener('touchstart', (e) => {
                if (e.target.closest('.project-card')) return;
                if (e.touches.length === 1) {
                    isPanning = true;
                    startX = e.touches[0].clientX - State.canvas.translateX;
                    startY = e.touches[0].clientY - State.canvas.translateY;
                }
            });

            document.addEventListener('touchmove', (e) => {
                if (!isPanning || e.touches.length !== 1) return;
                State.canvas.translateX = e.touches[0].clientX - startX;
                State.canvas.translateY = e.touches[0].clientY - startY;
                this.updateTransform();
            });

            document.addEventListener('touchend', () => {
                isPanning = false;
            });
        },

        /**
         * Update canvas transform (translate only, fixed scale)
         */
        updateTransform: function() {
            const { translateX, translateY, scale } = State.get('canvas');
            canvasContent.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

            Events.emit(Events.EVENTS.CANVAS_TRANSFORM, {
                translateX,
                translateY,
                scale
            });
        },

        /**
         * Go to home position (origin)
         */
        goHome: function() {
            State.set('canvas.translateX', 0);
            State.set('canvas.translateY', 0);
            this.updateTransform();
        },

        /**
         * Get canvas element
         */
        getCanvas: function() {
            return canvas;
        },

        /**
         * Get content container
         */
        getContent: function() {
            return canvasContent;
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Canvas = TerrainCanvas;

})();
