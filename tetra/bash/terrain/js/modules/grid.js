/**
 * Terrain Grid Module
 * Infinite grid rendering at fixed scale
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;
    const Config = window.Terrain.Config;

    let gridCanvas = null;
    let ctx = null;

    const TerrainGrid = {
        /**
         * Initialize grid module
         */
        init: function() {
            gridCanvas = document.getElementById('grid-canvas');

            if (!gridCanvas) {
                console.error('[Grid] Canvas element not found');
                return;
            }

            ctx = gridCanvas.getContext('2d');
            this.resize();
            this.bindEvents();
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            window.addEventListener('resize', () => this.resize());

            // Redraw on canvas transform
            Events.on(Events.EVENTS.CANVAS_TRANSFORM, () => this.draw());

            // Redraw on UI toggle
            Events.on(Events.EVENTS.UI_TOGGLE, (data) => {
                if (data.element === 'grid') {
                    this.draw();
                }
            });
        },

        /**
         * Resize canvas to window size
         */
        resize: function() {
            gridCanvas.width = window.innerWidth;
            gridCanvas.height = window.innerHeight;
            this.draw();
        },

        /**
         * Draw the grid
         */
        draw: function() {
            if (!State.ui.grid) {
                ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
                return;
            }

            ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

            const { translateX, translateY, scale, baseGridSize } = State.get('canvas');

            // Calculate effective grid size (fixed scale)
            let effectiveGridSize = baseGridSize * scale;
            let gridMultiplier = 1;

            // Keep grid cells visible
            if (effectiveGridSize < 5) {
                gridMultiplier = Math.ceil(5 / effectiveGridSize);
                effectiveGridSize *= gridMultiplier;
            } else if (effectiveGridSize > 200) {
                gridMultiplier = 0.1;
                effectiveGridSize *= gridMultiplier;
            }

            const actualGridSize = effectiveGridSize;
            const offsetX = (translateX * scale) % actualGridSize;
            const offsetY = (translateY * scale) % actualGridSize;

            // Grid appearance
            const opacity = 0.1;
            const lineWidth = 1;

            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = lineWidth;

            // Draw vertical lines
            for (let x = offsetX; x < gridCanvas.width; x += actualGridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, gridCanvas.height);
                ctx.stroke();
            }

            // Draw horizontal lines
            for (let y = offsetY; y < gridCanvas.height; y += actualGridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(gridCanvas.width, y);
                ctx.stroke();
            }

            // Draw origin axes if enabled
            if (Config.features.originAxes || State.ui.showOriginAxes) {
                this.drawOriginAxes(translateX, translateY, scale);
            }
        },

        /**
         * Draw origin axes (X = red, Y = green)
         */
        drawOriginAxes: function(translateX, translateY, scale) {
            const originX = translateX * scale;
            const originY = translateY * scale;

            // X axis (vertical line at origin) - Red
            if (originX >= 0 && originX <= gridCanvas.width) {
                ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(originX, 0);
                ctx.lineTo(originX, gridCanvas.height);
                ctx.stroke();
            }

            // Y axis (horizontal line at origin) - Green
            if (originY >= 0 && originY <= gridCanvas.height) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, originY);
                ctx.lineTo(gridCanvas.width, originY);
                ctx.stroke();
            }
        },

        /**
         * Toggle grid visibility
         */
        toggle: function() {
            State.ui.grid = !State.ui.grid;
            this.draw();
            Events.emit(Events.EVENTS.UI_TOGGLE, { element: 'grid', visible: State.ui.grid });
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Grid = TerrainGrid;

})();
