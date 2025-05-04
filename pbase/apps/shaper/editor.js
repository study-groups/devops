class ShaperEditor {
    constructor(config) {
        this.svgContainerId = config.svgContainerId;
        this.canvasId = config.canvasId;
        this.svgCodeId = config.svgCodeId;
        this.canvasCodeId = config.canvasCodeId;
        this.renderBtnId = config.renderBtnId;
        this.svgToCanvasBtnId = config.svgToCanvasBtnId;
        this.canvasToSvgBtnId = config.canvasToSvgBtnId;

        // Initialize state
        this.state = new AppState();
        this.messageProcessor = new MessageProcessor(this);
        
        // Setup UI
        this.setupControls();
        
        // Add text change handlers
        this.setupTextHandlers();
        
        // Initial render
        this.render('both');
        this.startAnimationLoop();
    }

    setupControls() {
        // Sync button
        const syncBtn = document.createElement('button');
        syncBtn.id = 'syncBtn';
        syncBtn.type = 'button';
        syncBtn.onclick = () => this.queueMessage({ type: MessageTypes.SYNC_TOGGLE });
        document.getElementById('controls').appendChild(syncBtn);

        // Render button
        const renderBtn = document.getElementById(this.renderBtnId);
        if (renderBtn) {
            renderBtn.onclick = () => {
                const svgCode = document.getElementById(this.svgCodeId).value;
                const data = this.parseCode(svgCode);
                this.state.svgState.shapes = new Map(data.shapes.map(s => [s.id, s]));
                this.state.svgState.links = new Map(data.links.map(l => [l.id, l]));
                
                if (this.state.isSynced) {
                    this.state.canvasState = this.state.svgState.clone();
                    document.getElementById(this.canvasCodeId).value = svgCode;
                }
                
                this.updateRenderers('both');
            };
        }

        // Add status display
        const statusDiv = document.createElement('div');
        statusDiv.id = 'stateStatus';
        statusDiv.style.marginTop = '10px';
        statusDiv.style.fontFamily = 'monospace';
        document.getElementById('controls').appendChild(statusDiv);
        
        // Set initial UI state
        this.updateSyncUI();
    }

    updateSyncUI() {
        const syncBtn = document.getElementById('syncBtn');
        const svgToCanvasBtn = document.getElementById(this.svgToCanvasBtnId);
        const canvasToSvgBtn = document.getElementById(this.canvasToSvgBtnId);
        const statusDiv = document.getElementById('stateStatus');

        if (syncBtn) syncBtn.textContent = `Sync: ${this.state.isSynced ? 'ON' : 'OFF'}`;
        if (svgToCanvasBtn) svgToCanvasBtn.disabled = this.state.isSynced;
        if (canvasToSvgBtn) canvasToSvgBtn.disabled = this.state.isSynced;

        // Update status display
        if (statusDiv) {
            const svgShapes = this.state.svgState.shapes.size;
            const canvasShapes = this.state.canvasState.shapes.size;
            const svgAnims = this.state.svgState.animations.size;
            const canvasAnims = this.state.canvasState.animations.size;
            
            statusDiv.innerHTML = `
                SVG: ${svgShapes} shapes, ${svgAnims} animations<br>
                Canvas: ${canvasShapes} shapes, ${canvasAnims} animations<br>
                Sync: ${this.state.isSynced ? 'ON' : 'OFF'}
            `;
        }
    }

    queueMessage(message) {
        if (!message.type) return;
        this.messageProcessor.processMessage(message);
    }

    render(source = 'both') {
        this.queueMessage({
            type: MessageTypes.RENDER_REQUEST,
            source
        });
    }

    updateRenderers(source = 'both') {
        // Don't recreate renderers, just update their state
        if (source === 'both' || source === 'svg') {
            if (!this.svgRenderer) {
                this.svgRenderer = new SVGRenderer(this.svgContainerId, this.state.svgState);
                this.svgRenderer.initialize();
            } else {
                // Just update existing renderer's state
                this.svgRenderer.boardState = this.state.svgState;
                this.svgRenderer.render();  // Add a render method to update display
            }
        }

        if (source === 'both' || source === 'canvas') {
            if (!this.canvasRenderer) {
                this.canvasRenderer = new CanvasRenderer(this.canvasId, this.state.canvasState);
                this.canvasRenderer.initialize();
            } else {
                // Just update existing renderer's state
                this.canvasRenderer.boardState = this.state.canvasState;
                this.canvasRenderer.render();  // Add a render method to update display
            }
        }
    }

    parseCode(code) {
        try {
            const data = {
                name: "Shaper Board",
                shapes: [],
                links: []
            };

            if (!code.trim()) {
                return data;
            }

            const shapeRegex = /(circle|square)\s+([a-z0-9]+)\s+at\s*\(([^)]+)\)\s+with\s+size\s+(\d+)\s+and\s+color\s+([a-zA-Z]+)/;
            const linkRegex = /link\s+([a-z0-9]+)\s+between\s+([a-z0-9]+)\s+and\s+([a-z0-9]+)\s+with\s+color\s+([a-zA-Z]+)\s+and\s+thickness\s+(\d+)/;

            const lines = code.trim().split('\n');
            lines.forEach(line => {
                const shapeMatch = line.match(shapeRegex);
                if (shapeMatch) {
                    const [_, type, id, pos, size, color] = shapeMatch;
                    const position = pos.split(',').map(n => parseFloat(n.trim()));
                    data.shapes.push({
                        id,
                        type: type.charAt(0).toUpperCase() + type.slice(1),
                        position: position.slice(0, 2),
                        size: parseInt(size),
                        color
                    });
                }

                const linkMatch = line.match(linkRegex);
                if (linkMatch) {
                    const [_, id, from, to, color, thickness] = linkMatch;
                    data.links.push({
                        id,
                        from,
                        to,
                        color,
                        thickness: parseInt(thickness)
                    });
                }
            });

            return data;
        } catch (err) {
            console.error('Parse error:', err);
            return {
                name: "Error Board",
                shapes: [],
                links: []
            };
        }
    }

    startAnimationLoop() {
        const animate = (currentTime) => {
            // Only send animation frame if we have active animations
            if (this.state.svgState.animations.size > 0 || 
                (!this.state.isSynced && this.state.canvasState.animations.size > 0)) {
                this.queueMessage({
                    type: MessageTypes.ANIMATION_FRAME,
                    currentTime
                });
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    setupTextHandlers() {
        let svgUpdateTimeout = null;
        let canvasUpdateTimeout = null;
        const svgTextArea = document.getElementById(this.svgCodeId);
        const canvasTextArea = document.getElementById(this.canvasCodeId);
        
        svgTextArea.addEventListener('input', () => {
            if (svgUpdateTimeout) clearTimeout(svgUpdateTimeout);

            svgUpdateTimeout = setTimeout(() => {
                const svgCode = svgTextArea.value;
                const data = this.parseCode(svgCode);
                
                // Update SVG state
                this.state.svgState.code = svgCode;
                this.state.svgState.shapes = new Map(data.shapes.map(s => [s.id, s]));
                this.state.svgState.links = new Map(data.links.map(l => [l.id, l]));

                // If synced, update canvas too
                if (this.state.isSynced) {
                    canvasTextArea.value = svgCode;
                    this.state.canvasState = this.state.svgState.clone();
                    this.updateRenderers('both');
                } else {
                    this.updateRenderers('svg');
                }
            }, 300);
        });

        canvasTextArea.addEventListener('input', () => {
            if (canvasUpdateTimeout) clearTimeout(canvasUpdateTimeout);

            canvasUpdateTimeout = setTimeout(() => {
                const canvasCode = canvasTextArea.value;
                const data = this.parseCode(canvasCode);

                if (this.state.isSynced) {
                    // If synced, update both SVG and canvas
                    svgTextArea.value = canvasCode;
                    this.state.svgState.code = canvasCode;
                    this.state.svgState.shapes = new Map(data.shapes.map(s => [s.id, s]));
                    this.state.svgState.links = new Map(data.links.map(l => [l.id, l]));
                    this.state.canvasState = this.state.svgState.clone();
                    this.updateRenderers('both');
                } else {
                    // If not synced, only update canvas
                    this.state.canvasState.code = canvasCode;
                    this.state.canvasState.shapes = new Map(data.shapes.map(s => [s.id, s]));
                    this.state.canvasState.links = new Map(data.links.map(l => [l.id, l]));
                    this.updateRenderers('canvas');
                }
            }, 300);
        });
    }
} 