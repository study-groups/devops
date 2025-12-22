/**
 * Terrain Canvas Module
 * Handles canvas panning and zoom
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;
    const Config = window.Terrain.Config;

    let canvas = null;
    let canvasContent = null;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    // Store handler references for cleanup
    const _handlers = {
        mousedown: null,
        mousemove: null,
        mouseup: null,
        touchstart: null,
        touchmove: null,
        touchend: null,
        wheel: null
    };

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
         * Bind event handlers (stores references for cleanup)
         */
        bindEvents: function() {
            const self = this;

            // Pan start
            _handlers.mousedown = function(e) {
                if (e.target.closest('.project-card')) return;
                isPanning = true;
                startX = e.clientX - State.canvas.translateX;
                startY = e.clientY - State.canvas.translateY;
            };
            canvas.addEventListener('mousedown', _handlers.mousedown);

            // Pan move
            _handlers.mousemove = function(e) {
                if (!isPanning) return;
                State.canvas.translateX = e.clientX - startX;
                State.canvas.translateY = e.clientY - startY;
                self.updateTransform();
            };
            document.addEventListener('mousemove', _handlers.mousemove);

            // Pan end
            _handlers.mouseup = function() {
                isPanning = false;
            };
            document.addEventListener('mouseup', _handlers.mouseup);

            // Touch support
            _handlers.touchstart = function(e) {
                if (e.target.closest('.project-card')) return;
                if (e.touches.length === 1) {
                    isPanning = true;
                    startX = e.touches[0].clientX - State.canvas.translateX;
                    startY = e.touches[0].clientY - State.canvas.translateY;
                }
            };
            canvas.addEventListener('touchstart', _handlers.touchstart);

            _handlers.touchmove = function(e) {
                if (!isPanning || e.touches.length !== 1) return;
                State.canvas.translateX = e.touches[0].clientX - startX;
                State.canvas.translateY = e.touches[0].clientY - startY;
                self.updateTransform();
            };
            document.addEventListener('touchmove', _handlers.touchmove);

            _handlers.touchend = function() {
                isPanning = false;
            };
            document.addEventListener('touchend', _handlers.touchend);

            // Zoom with scroll wheel
            _handlers.wheel = function(e) {
                e.preventDefault();

                const mouseX = e.clientX;
                const mouseY = e.clientY;

                const { translateX, translateY, scale, minScale, maxScale } = State.get('canvas');

                // Convert mouse position to world coordinates
                const worldX = (mouseX - translateX) / scale;
                const worldY = (mouseY - translateY) / scale;

                // Calculate new scale (scroll down = zoom out, scroll up = zoom in)
                const zoomOut = Config.constants?.ZOOM_OUT_FACTOR || 0.9;
                const zoomIn = Config.constants?.ZOOM_IN_FACTOR || 1.1;
                const delta = e.deltaY > 0 ? zoomOut : zoomIn;
                const newScale = Math.max(minScale, Math.min(maxScale, scale * delta));

                // Adjust translation to keep mouse position fixed on same world point
                const newTranslateX = mouseX - worldX * newScale;
                const newTranslateY = mouseY - worldY * newScale;

                State.set('canvas.scale', newScale);
                State.set('canvas.translateX', newTranslateX);
                State.set('canvas.translateY', newTranslateY);

                self.updateTransform();
            };
            canvas.addEventListener('wheel', _handlers.wheel, { passive: false });
        },

        /**
         * Remove all event listeners (call on destroy)
         */
        unbindEvents: function() {
            if (canvas) {
                if (_handlers.mousedown) canvas.removeEventListener('mousedown', _handlers.mousedown);
                if (_handlers.touchstart) canvas.removeEventListener('touchstart', _handlers.touchstart);
                if (_handlers.wheel) canvas.removeEventListener('wheel', _handlers.wheel);
            }
            if (_handlers.mousemove) document.removeEventListener('mousemove', _handlers.mousemove);
            if (_handlers.mouseup) document.removeEventListener('mouseup', _handlers.mouseup);
            if (_handlers.touchmove) document.removeEventListener('touchmove', _handlers.touchmove);
            if (_handlers.touchend) document.removeEventListener('touchend', _handlers.touchend);

            // Clear handler references
            Object.keys(_handlers).forEach(k => _handlers[k] = null);
        },

        /**
         * Destroy module and clean up resources
         */
        destroy: function() {
            this.unbindEvents();
            canvas = null;
            canvasContent = null;
            isPanning = false;
        },

        /**
         * Update canvas transform
         */
        updateTransform: function() {
            const { translateX, translateY, scale } = State.get('canvas');
            canvasContent.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

            Events.emit(Events.CANVAS_TRANSFORM, {
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
