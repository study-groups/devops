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

    // Store handler references for cleanup
    const _handlers = {
        resize: null,
        canvasTransform: null,
        uiToggle: null
    };

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
         * Bind event handlers (stores references for cleanup)
         */
        bindEvents: function() {
            const self = this;

            _handlers.resize = function() { self.resize(); };
            window.addEventListener('resize', _handlers.resize);

            // Redraw on canvas transform
            _handlers.canvasTransform = function() { self.draw(); };
            Events.on(Events.CANVAS_TRANSFORM, _handlers.canvasTransform);

            // Redraw on UI toggle
            _handlers.uiToggle = function(data) {
                if (data.element === 'grid') {
                    self.draw();
                }
            };
            Events.on(Events.UI_TOGGLE, _handlers.uiToggle);
        },

        /**
         * Remove all event listeners
         */
        unbindEvents: function() {
            if (_handlers.resize) window.removeEventListener('resize', _handlers.resize);
            if (_handlers.canvasTransform) Events.off(Events.CANVAS_TRANSFORM, _handlers.canvasTransform);
            if (_handlers.uiToggle) Events.off(Events.UI_TOGGLE, _handlers.uiToggle);

            Object.keys(_handlers).forEach(k => _handlers[k] = null);
        },

        /**
         * Destroy module and clean up resources
         */
        destroy: function() {
            this.unbindEvents();
            if (ctx) ctx.clearRect(0, 0, gridCanvas?.width || 0, gridCanvas?.height || 0);
            gridCanvas = null;
            ctx = null;
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

            // Keep grid cells visible (use centralized constants)
            const minCell = Config.constants?.GRID_MIN_CELL_SIZE || 5;
            const maxCell = Config.constants?.GRID_MAX_CELL_SIZE || 200;
            if (effectiveGridSize < minCell) {
                gridMultiplier = Math.ceil(minCell / effectiveGridSize);
                effectiveGridSize *= gridMultiplier;
            } else if (effectiveGridSize > maxCell) {
                gridMultiplier = 0.1;
                effectiveGridSize *= gridMultiplier;
            }

            const actualGridSize = effectiveGridSize;
            const offsetX = (translateX * scale) % actualGridSize;
            const offsetY = (translateY * scale) % actualGridSize;

            // Grid appearance (use centralized constants)
            const opacity = Config.constants?.GRID_LINE_OPACITY || 0.1;
            const lineWidth = Config.constants?.GRID_LINE_WIDTH || 1;

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
            const axisOpacity = Config.constants?.GRID_AXIS_OPACITY || 0.3;
            const axisWidth = Config.constants?.GRID_AXIS_WIDTH || 2;

            // X axis (vertical line at origin) - Red
            if (originX >= 0 && originX <= gridCanvas.width) {
                ctx.strokeStyle = `rgba(255, 68, 68, ${axisOpacity})`;
                ctx.lineWidth = axisWidth;
                ctx.beginPath();
                ctx.moveTo(originX, 0);
                ctx.lineTo(originX, gridCanvas.height);
                ctx.stroke();
            }

            // Y axis (horizontal line at origin) - Green
            if (originY >= 0 && originY <= gridCanvas.height) {
                ctx.strokeStyle = `rgba(0, 255, 0, ${axisOpacity})`;
                ctx.lineWidth = axisWidth;
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
            Events.emit(Events.UI_TOGGLE, { element: 'grid', visible: State.ui.grid });
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Grid = TerrainGrid;

})();
