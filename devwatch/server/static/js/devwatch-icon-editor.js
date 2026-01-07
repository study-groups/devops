/**
 * PJA Icon Editor - JavaScript for PIF (PJA Icon Format) Editor
 * Supports 8-frame animated SVG icon editing with keyframe animation
 */

class PIFIconEditor {
    constructor(container) {
        this.container = container;
        this.currentIcon = null;
        this.currentFrame = 0;
        this.frames = new Array(8).fill(null).map(() => this.createDefaultSVG());
        this.isPlaying = false;
        this.animationInterval = null;
        this.animationSpeed = 8; // FPS
        
        this.init();
    }
    
    init() {
        this.render();
        this.setupEventListeners();
        this.loadSampleIcons();
        
        // Store reference globally for access from other components
        window.currentPIFEditor = this;
    }
    
    createDefaultSVG() {
        return `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
            <rect x="64" y="64" width="128" height="128" 
                  fill="var(--devwatch-icon-primary, currentColor)" 
                  stroke="var(--devwatch-icon-stroke, none)" 
                  stroke-width="2" 
                  rx="8"/>
        </svg>`;
    }
    
    render() {
        this.container.innerHTML = `
            <div class="pif-editor">
                <div class="pif-editor-header">
                    <h3 class="pif-editor-title">PIF Icon Editor</h3>
                    <div class="pif-editor-actions">
                        <button id="new-icon-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">New Icon</button>
                        <button id="save-icon-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">Save PIF</button>
                        <button id="export-icon-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">Export</button>
                    </div>
                </div>
                
                <div class="pif-editor-content">
                    <!-- Left Toolbar -->
                    <div class="pif-toolbar">
                        <div class="pif-tool-group">
                            <h5 class="pif-tool-group-title">Tools</h5>
                            <button class="pif-tool-btn is-active" data-tool="select" title="Select Tool">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2 2v6h2V4h4V2H2zm16 0v2h4v4h2V2h-6zM4 18H2v6h6v-2H4v-4zm16 0v4h-4v2h6v-6h-2z"/>
                                </svg>
                            </button>
                            <button class="pif-tool-btn" data-tool="pen" title="Pen Tool">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                            </button>
                            <button class="pif-tool-btn" data-tool="brush" title="Brush Tool">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z"/>
                                </svg>
                            </button>
                            <button class="pif-tool-btn" data-tool="rectangle" title="Rectangle Tool">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/>
                                </svg>
                            </button>
                            <button class="pif-tool-btn" data-tool="circle" title="Circle Tool">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                                </svg>
                            </button>
                            <button class="pif-tool-btn" data-tool="text" title="Text Tool">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M5 4v3h5.5v12h3V7H19V4z"/>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="pif-tool-group">
                            <h5 class="pif-tool-group-title">Colors</h5>
                            <div class="pif-color-picker-container">
                                <div class="pif-color-swatch-large" id="primary-color" style="background: var(--devwatch-text-primary);" title="Primary Color"></div>
                                <div class="pif-color-swatch-large" id="secondary-color" style="background: var(--devwatch-bg-primary);" title="Secondary Color"></div>
                            </div>
                            <input type="color" id="color-picker" class="pif-color-input" value="#00ff00">
                        </div>
                        
                        <div class="pif-tool-group">
                            <h5 class="pif-tool-group-title">Layers</h5>
                            <div class="pif-layers-list" id="layers-list">
                                <div class="pif-layer is-active" data-layer="0">
                                    <span class="pif-layer-name">Background</span>
                                    <div class="pif-layer-controls">
                                        <button class="pif-layer-visible" title="Toggle Visibility">👁</button>
                                    </div>
                                </div>
                            </div>
                            <button id="add-layer-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small" style="width: 100%; margin-top: 4px;">+ Add Layer</button>
                        </div>
                    </div>
                    
                    <!-- Main Canvas Area -->
                    <div class="pif-canvas-container">
                        <div class="pif-canvas-toolbar">
                            <div class="pif-canvas-tools">
                                <button id="grid-toggle" class="devwatch-button devwatch-button--ghost devwatch-button--small is-active">Grid</button>
                                <button id="zoom-in" class="devwatch-button devwatch-button--ghost devwatch-button--small">+</button>
                                <button id="zoom-out" class="devwatch-button devwatch-button--ghost devwatch-button--small">-</button>
                                <button id="reset-zoom" class="devwatch-button devwatch-button--ghost devwatch-button--small">100%</button>
                                <div class="pif-zoom-display">100%</div>
                            </div>
                            <div class="pif-canvas-info">
                                Frame <span id="current-frame-display">1</span> of 8 | 256×256px | <span id="selected-tool">Select Tool</span>
                            </div>
                        </div>
                        
                        <div class="pif-canvas">
                            <div class="pif-canvas-grid" id="canvas-grid"></div>
                            <div class="pif-svg-editor" id="svg-editor">
                                <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" id="main-svg">
                                    ${this.frames[0]}
                                </svg>
                            </div>
                            <div class="pif-canvas-overlay" id="canvas-overlay"></div>
                        </div>
                        
                        <div class="pif-timeline-container">
                            <div class="pif-timeline-header">
                                <h4 class="pif-timeline-title">Frame Timeline</h4>
                                <div class="pif-timeline-controls">
                                    <button id="copy-frame-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">Copy</button>
                                    <button id="paste-frame-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">Paste</button>
                                    <button id="clear-frame-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">Clear</button>
                                    <button id="duplicate-frame-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small">Duplicate</button>
                                </div>
                            </div>
                            
                            <div class="pif-timeline" id="timeline">
                                ${this.renderTimeline()}
                            </div>
                            
                            <div class="pif-animation-controls">
                                <button id="play-animation" class="pif-play-button">▶</button>
                                <input type="range" id="animation-speed" class="pif-animation-slider" 
                                       min="1" max="24" value="8" step="1">
                                <div class="pif-animation-info">
                                    <span id="fps-display">8</span> FPS
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Right Properties Panel -->
                    <div class="pif-properties">
                        ${this.renderProperties()}
                    </div>
                </div>
            </div>
        `;
        
        // Initialize the editor state
        this.currentTool = 'select';
        this.zoomLevel = 1;
        this.showGrid = true;
        this.layers = [{ name: 'Background', visible: true, elements: [] }];
        this.currentLayer = 0;
    }
    
    renderTimeline() {
        return this.frames.map((frame, index) => `
            <div class="pif-frame ${index === this.currentFrame ? 'is-active' : ''}" 
                 data-frame="${index}">
                <div class="pif-frame-number">${index + 1}</div>
                <div class="pif-frame-preview">
                    ${frame}
                </div>
            </div>
        `).join('');
    }
    
    renderProperties() {
        return `
            <div class="pif-property-group">
                <div class="pif-property-header">
                    <h4 class="pif-property-title">Icon Properties</h4>
                    <span class="pif-property-toggle">▼</span>
                </div>
                <div class="pif-property-content">
                    <div class="pif-property-row">
                        <label class="pif-property-label">Name:</label>
                        <input type="text" id="icon-name" class="pif-property-input devwatch-input" 
                               value="untitled-icon" placeholder="Icon name">
                    </div>
                    <div class="pif-property-row">
                        <label class="pif-property-label">Size:</label>
                        <select id="icon-size" class="pif-property-input pja-select">
                            <option value="16">16px</option>
                            <option value="20">20px</option>
                            <option value="24" selected>24px</option>
                            <option value="32">32px</option>
                            <option value="48">48px</option>
                            <option value="64">64px</option>
                        </select>
                    </div>
                    <div class="pif-property-row">
                        <label class="pif-property-label">Animation:</label>
                        <select id="animation-type" class="pif-property-input pja-select">
                            <option value="none">Static</option>
                            <option value="loop">Loop</option>
                            <option value="bounce">Bounce</option>
                            <option value="once">Play Once</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="pif-property-group">
                <div class="pif-property-header">
                    <h4 class="pif-property-title">Colors</h4>
                    <span class="pif-property-toggle">▼</span>
                </div>
                <div class="pif-property-content">
                    <div class="pif-property-row">
                        <label class="pif-property-label">Primary:</label>
                        <input type="color" id="color-primary" class="pif-color-input" value="#00ff00">
                    </div>
                    <div class="pif-property-row">
                        <label class="pif-property-label">Secondary:</label>
                        <input type="color" id="color-secondary" class="pif-color-input" value="#88ff88">
                    </div>
                    <div class="pif-property-row">
                        <label class="pif-property-label">Accent:</label>
                        <input type="color" id="color-accent" class="pif-color-input" value="#00aaff">
                    </div>
                    <div class="pif-property-row">
                        <label class="pif-property-label">Stroke:</label>
                        <input type="color" id="color-stroke" class="pif-color-input" value="#000000">
                    </div>
                </div>
            </div>
            
            <div class="pif-property-group">
                <div class="pif-property-header">
                    <h4 class="pif-property-title">SVG Code</h4>
                    <span class="pif-property-toggle">▼</span>
                </div>
                <div class="pif-property-content">
                    <textarea id="svg-code" class="pja-textarea" rows="8" 
                              placeholder="SVG code for current frame...">${this.frames[this.currentFrame]}</textarea>
                    <button id="apply-svg-btn" class="devwatch-button devwatch-button--ghost devwatch-button--small" 
                            style="width: 100%; margin-top: var(--devwatch-space-sm);">Apply Changes</button>
                </div>
            </div>
            
            <div class="pif-color-system">
                <h4>PJA Color System</h4>
                <div class="pif-color-tokens">
                    <div class="pif-color-token">
                        <div class="pif-color-swatch" style="background: var(--devwatch-text-primary);"></div>
                        <div class="pif-color-token-info">
                            <div class="pif-color-token-name">--devwatch-text-primary</div>
                            <div class="pif-color-token-desc">Main text color</div>
                        </div>
                    </div>
                    <div class="pif-color-token">
                        <div class="pif-color-swatch" style="background: var(--devwatch-accent-primary);"></div>
                        <div class="pif-color-token-info">
                            <div class="pif-color-token-name">--devwatch-accent-primary</div>
                            <div class="pif-color-token-desc">Primary accent</div>
                        </div>
                    </div>
                    <div class="pif-color-token">
                        <div class="pif-color-swatch" style="background: var(--devwatch-accent-secondary);"></div>
                        <div class="pif-color-token-info">
                            <div class="pif-color-token-name">--devwatch-accent-secondary</div>
                            <div class="pif-color-token-desc">Secondary accent</div>
                        </div>
                    </div>
                    <div class="pif-color-token">
                        <div class="pif-color-swatch" style="background: var(--devwatch-text-muted);"></div>
                        <div class="pif-color-token-info">
                            <div class="pif-color-token-name">--devwatch-text-muted</div>
                            <div class="pif-color-token-desc">Muted text</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Tool selection
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.pif-tool-btn')) {
                const toolBtn = e.target.closest('.pif-tool-btn');
                const tool = toolBtn.dataset.tool;
                this.selectTool(tool);
            }
        });
        
        // Timeline frame selection
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.pif-frame')) {
                const frameIndex = parseInt(e.target.closest('.pif-frame').dataset.frame);
                this.selectFrame(frameIndex);
            }
        });
        
        // Animation controls
        const playBtn = this.container.querySelector('#play-animation');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.toggleAnimation());
        }
        
        const speedSlider = this.container.querySelector('#animation-speed');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.animationSpeed = parseInt(e.target.value);
                this.container.querySelector('#fps-display').textContent = this.animationSpeed;
                if (this.isPlaying) {
                    this.stopAnimation();
                    this.startAnimation();
                }
            });
        }
        
        // SVG code editor
        const svgCodeTextarea = this.container.querySelector('#svg-code');
        const applySvgBtn = this.container.querySelector('#apply-svg-btn');
        if (applySvgBtn && svgCodeTextarea) {
            applySvgBtn.addEventListener('click', () => {
                this.updateCurrentFrame(svgCodeTextarea.value);
            });
        }
        
        // Property collapsing
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.pif-property-header')) {
                const group = e.target.closest('.pif-property-group');
                group.classList.toggle('is-collapsed');
            }
        });
        
        // Color inputs
        ['primary', 'secondary', 'accent', 'stroke'].forEach(colorType => {
            const colorInput = this.container.querySelector(`#color-${colorType}`);
            if (colorInput) {
                colorInput.addEventListener('change', (e) => {
                    this.updateIconColors(colorType, e.target.value);
                });
            }
        });
        
        // Frame operations
        const copyBtn = this.container.querySelector('#copy-frame-btn');
        const pasteBtn = this.container.querySelector('#paste-frame-btn');
        const clearBtn = this.container.querySelector('#clear-frame-btn');
        
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyFrame());
        if (pasteBtn) pasteBtn.addEventListener('click', () => this.pasteFrame());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearFrame());
        
        // Toolbar actions
        const gridToggle = this.container.querySelector('#grid-toggle');
        const zoomIn = this.container.querySelector('#zoom-in');
        const zoomOut = this.container.querySelector('#zoom-out');
        const resetZoom = this.container.querySelector('#reset-zoom');
        
        if (gridToggle) {
            gridToggle.addEventListener('click', () => this.toggleGrid());
        }
        if (zoomIn) {
            zoomIn.addEventListener('click', () => this.zoomIn());
        }
        if (zoomOut) {
            zoomOut.addEventListener('click', () => this.zoomOut());
        }
        if (resetZoom) {
            resetZoom.addEventListener('click', () => this.resetZoom());
        }
        
        // Canvas interaction
        const canvas = this.container.querySelector('#svg-editor');
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
            canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
            canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        }
        
        // Color picker
        const colorPicker = this.container.querySelector('#color-picker');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => this.updateCurrentColor(e.target.value));
        }
        
        // Layer management
        const addLayerBtn = this.container.querySelector('#add-layer-btn');
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => this.addLayer());
        }
        
        // Editor actions
        const newBtn = this.container.querySelector('#new-icon-btn');
        const saveBtn = this.container.querySelector('#save-icon-btn');
        const exportBtn = this.container.querySelector('#export-icon-btn');
        
        if (newBtn) newBtn.addEventListener('click', () => this.newIcon());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveIcon());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportIcon());
    }
    
    selectFrame(frameIndex) {
        if (frameIndex < 0 || frameIndex >= 8) return;
        
        this.currentFrame = frameIndex;
        
        // Update UI
        this.container.querySelectorAll('.pif-frame').forEach((frame, index) => {
            frame.classList.toggle('is-active', index === frameIndex);
        });
        
        // Update canvas
        const svgEditor = this.container.querySelector('#svg-editor');
        if (svgEditor) {
            svgEditor.innerHTML = this.frames[frameIndex];
        }
        
        // Update frame display
        const frameDisplay = this.container.querySelector('#current-frame-display');
        if (frameDisplay) {
            frameDisplay.textContent = frameIndex + 1;
        }
        
        // Update SVG code textarea
        const svgCodeTextarea = this.container.querySelector('#svg-code');
        if (svgCodeTextarea) {
            svgCodeTextarea.value = this.frames[frameIndex];
        }
    }
    
    updateCurrentFrame(svgCode) {
        try {
            // Basic SVG validation
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgCode, 'image/svg+xml');
            const parserError = doc.querySelector('parsererror');
            
            if (parserError) {
                throw new Error('Invalid SVG syntax');
            }
            
            this.frames[this.currentFrame] = svgCode;
            
            // Update canvas
            const svgEditor = this.container.querySelector('#svg-editor');
            if (svgEditor) {
                svgEditor.innerHTML = svgCode;
            }
            
            // Update timeline preview
            this.updateTimelinePreview();
            
            console.log(`Frame ${this.currentFrame + 1} updated`);
            
        } catch (error) {
            console.error('Error updating frame:', error);
            alert('Invalid SVG code. Please check your syntax.');
        }
    }
    
    updateTimelinePreview() {
        const timeline = this.container.querySelector('#timeline');
        if (timeline) {
            timeline.innerHTML = this.renderTimeline();
        }
    }
    
    toggleAnimation() {
        if (this.isPlaying) {
            this.stopAnimation();
        } else {
            this.startAnimation();
        }
    }
    
    startAnimation() {
        this.isPlaying = true;
        const playBtn = this.container.querySelector('#play-animation');
        if (playBtn) {
            playBtn.textContent = '⏸';
        }
        
        let frameIndex = 0;
        this.animationInterval = setInterval(() => {
            this.selectFrame(frameIndex);
            frameIndex = (frameIndex + 1) % 8;
        }, 1000 / this.animationSpeed);
    }
    
    stopAnimation() {
        this.isPlaying = false;
        const playBtn = this.container.querySelector('#play-animation');
        if (playBtn) {
            playBtn.textContent = '▶';
        }
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }
    
    copyFrame() {
        this.copiedFrame = this.frames[this.currentFrame];
        console.log(`Frame ${this.currentFrame + 1} copied to clipboard`);
    }
    
    pasteFrame() {
        if (this.copiedFrame) {
            this.updateCurrentFrame(this.copiedFrame);
            console.log(`Frame pasted to frame ${this.currentFrame + 1}`);
        }
    }
    
    clearFrame() {
        this.updateCurrentFrame(this.createDefaultSVG());
        console.log(`Frame ${this.currentFrame + 1} cleared`);
    }
    
    toggleGrid() {
        const grid = this.container.querySelector('.pif-canvas-grid');
        if (grid) {
            grid.style.display = grid.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    updateIconColors(colorType, color) {
        // Update CSS custom properties for the current icon
        const svgEditor = this.container.querySelector('#svg-editor');
        if (svgEditor) {
            svgEditor.style.setProperty(`--devwatch-icon-${colorType}`, color);
        }
        
        console.log(`Updated ${colorType} color to ${color}`);
    }
    
    newIcon() {
        if (confirm('Create a new icon? This will clear all current frames.')) {
            this.frames = new Array(8).fill(null).map(() => this.createDefaultSVG());
            this.currentFrame = 0;
            this.selectFrame(0);
            this.updateTimelinePreview();
            
            // Reset icon name
            const nameInput = this.container.querySelector('#icon-name');
            if (nameInput) {
                nameInput.value = 'untitled-icon';
            }
            
            console.log('New icon created');
        }
    }
    
    // New methods for enhanced functionality
    selectTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        this.container.querySelectorAll('.pif-tool-btn').forEach(btn => {
            btn.classList.remove('is-active');
        });
        this.container.querySelector(`[data-tool="${tool}"]`).classList.add('is-active');
        
        // Update tool display
        const toolDisplay = this.container.querySelector('#selected-tool');
        if (toolDisplay) {
            const toolNames = {
                'select': 'Select Tool',
                'pen': 'Pen Tool',
                'brush': 'Brush Tool',
                'rectangle': 'Rectangle Tool',
                'circle': 'Circle Tool',
                'text': 'Text Tool'
            };
            toolDisplay.textContent = toolNames[tool] || 'Unknown Tool';
        }
        
        console.log(`Selected tool: ${tool}`);
    }
    
    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, 5);
        this.updateZoom();
    }
    
    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.1);
        this.updateZoom();
    }
    
    resetZoom() {
        this.zoomLevel = 1;
        this.updateZoom();
    }
    
    updateZoom() {
        const svgEditor = this.container.querySelector('#svg-editor');
        const zoomDisplay = this.container.querySelector('.pif-zoom-display');
        
        if (svgEditor) {
            svgEditor.style.transform = `scale(${this.zoomLevel})`;
        }
        
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }
    
    handleCanvasMouseDown(e) {
        if (this.currentTool === 'select') {
            // Handle selection
            console.log('Canvas click for selection');
        } else if (this.currentTool === 'rectangle') {
            // Start drawing rectangle
            this.startDrawingShape(e, 'rect');
        } else if (this.currentTool === 'circle') {
            // Start drawing circle
            this.startDrawingShape(e, 'circle');
        }
    }
    
    handleCanvasMouseMove(e) {
        // Handle drawing/dragging based on current tool
    }
    
    handleCanvasMouseUp(e) {
        // Finish drawing/dragging
    }
    
    startDrawingShape(e, shapeType) {
        const rect = e.target.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;
        
        console.log(`Starting to draw ${shapeType} at ${x}, ${y}`);
        
        // Add shape to current frame
        const svg = this.container.querySelector('#main-svg');
        if (svg && shapeType === 'rect') {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', 50);
            rect.setAttribute('height', 50);
            rect.setAttribute('fill', 'var(--devwatch-icon-primary, currentColor)');
            rect.setAttribute('stroke', 'var(--devwatch-icon-stroke, none)');
            rect.setAttribute('stroke-width', '2');
            svg.appendChild(rect);
            
            // Update frame data
            this.frames[this.currentFrame] = svg.outerHTML;
            this.updateTimelinePreview();
        } else if (svg && shapeType === 'circle') {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', 25);
            circle.setAttribute('fill', 'var(--devwatch-icon-primary, currentColor)');
            circle.setAttribute('stroke', 'var(--devwatch-icon-stroke, none)');
            circle.setAttribute('stroke-width', '2');
            svg.appendChild(circle);
            
            // Update frame data
            this.frames[this.currentFrame] = svg.outerHTML;
            this.updateTimelinePreview();
        }
    }
    
    updateCurrentColor(color) {
        const primaryColorSwatch = this.container.querySelector('#primary-color');
        if (primaryColorSwatch) {
            primaryColorSwatch.style.background = color;
        }
        
        // Update CSS custom property for current editing session
        this.container.style.setProperty('--devwatch-icon-primary', color);
        
        console.log(`Updated primary color to ${color}`);
    }
    
    addLayer() {
        const layerName = `Layer ${this.layers.length + 1}`;
        this.layers.push({
            name: layerName,
            visible: true,
            elements: []
        });
        
        this.updateLayersList();
        console.log(`Added layer: ${layerName}`);
    }
    
    updateLayersList() {
        const layersList = this.container.querySelector('#layers-list');
        if (!layersList) return;
        
        layersList.innerHTML = this.layers.map((layer, index) => `
            <div class="pif-layer ${index === this.currentLayer ? 'is-active' : ''}" data-layer="${index}">
                <span class="pif-layer-name">${layer.name}</span>
                <div class="pif-layer-controls">
                    <button class="pif-layer-visible" title="Toggle Visibility">${layer.visible ? '👁' : '🚫'}</button>
                </div>
            </div>
        `).join('');
    }
    
    // Load selected icon from system
    loadSelectedIcon() {
        if (window.selectedIcon) {
            const iconName = window.selectedIcon.name;
            const iconPath = window.selectedIcon.path;
            
            console.log(`Loading icon: ${iconName} from ${iconPath}`);
            
            // Update icon name in properties
            const nameInput = this.container.querySelector('#icon-name');
            if (nameInput) {
                nameInput.value = iconName;
            }
            
            // If it's an SVG, load it into the first frame
            if (iconPath && iconPath.endsWith('.svg')) {
                fetch(iconPath)
                    .then(response => response.text())
                    .then(svgContent => {
                        this.frames[0] = svgContent;
                        this.selectFrame(0);
                        this.updateTimelinePreview();
                        console.log('Loaded SVG into editor');
                    })
                    .catch(error => {
                        console.error('Error loading SVG:', error);
                    });
            }
        }
    }
    
    saveIcon() {
        const iconName = this.container.querySelector('#icon-name')?.value || 'untitled-icon';
        
        // Create PIF data structure
        const pifData = {
            name: iconName,
            frames: this.frames,
            manifest: {
                name: iconName,
                version: '1.0.0',
                description: 'PIF icon created with PJA Icon Editor',
                animation: {
                    type: this.container.querySelector('#animation-type')?.value || 'none',
                    duration: `${1000 / this.animationSpeed}ms`,
                    easing: 'linear'
                }
            }
        };
        
        // For now, just log the data (in a real implementation, this would save to server)
        console.log('Saving PIF icon:', pifData);
        
        // Create downloadable files
        this.downloadPIF(pifData);
    }
    
    exportIcon() {
        const iconName = this.container.querySelector('#icon-name')?.value || 'untitled-icon';
        const size = this.container.querySelector('#icon-size')?.value || '24';
        
        // Export current frame as SVG
        const svgBlob = new Blob([this.frames[this.currentFrame]], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${iconName}-${size}px.svg`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log(`Exported ${iconName} as SVG`);
    }
    
    downloadPIF(pifData) {
        // Create a zip-like structure (simplified for demo)
        const files = {};
        
        pifData.frames.forEach((frame, index) => {
            files[`${index + 1}.svg`] = frame;
        });
        
        files['manifest.json'] = JSON.stringify(pifData.manifest, null, 2);
        
        // For demo purposes, download as JSON
        const dataBlob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pifData.name}.pif.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    loadSampleIcons() {
        // Load some sample icons for demonstration
        this.sampleIcons = [
            {
                name: 'loading-spinner',
                frames: this.generateSpinnerFrames()
            },
            {
                name: 'pulse-heart',
                frames: this.generateHeartFrames()
            }
        ];
    }
    
    generateSpinnerFrames() {
        const frames = [];
        for (let i = 0; i < 8; i++) {
            const rotation = i * 45;
            frames.push(`
                <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(128,128) rotate(${rotation})">
                        <circle cx="0" cy="-60" r="12" fill="var(--devwatch-icon-primary, currentColor)" opacity="1"/>
                        <circle cx="42" cy="-42" r="10" fill="var(--devwatch-icon-primary, currentColor)" opacity="0.8"/>
                        <circle cx="60" cy="0" r="8" fill="var(--devwatch-icon-primary, currentColor)" opacity="0.6"/>
                        <circle cx="42" cy="42" r="6" fill="var(--devwatch-icon-primary, currentColor)" opacity="0.4"/>
                        <circle cx="0" cy="60" r="4" fill="var(--devwatch-icon-primary, currentColor)" opacity="0.2"/>
                    </g>
                </svg>
            `);
        }
        return frames;
    }
    
    generateHeartFrames() {
        const frames = [];
        const scales = [1, 1.1, 1.2, 1.3, 1.2, 1.1, 1, 1];
        
        scales.forEach(scale => {
            frames.push(`
                <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(128,128) scale(${scale})">
                        <path d="M0,20 C-20,0 -50,0 -50,30 C-50,60 0,80 0,80 C0,80 50,60 50,30 C50,0 20,0 0,20 Z" 
                              fill="var(--devwatch-icon-primary, currentColor)" 
                              stroke="var(--devwatch-icon-stroke, none)" 
                              stroke-width="2"/>
                    </g>
                </svg>
            `);
        });
        
        return frames;
    }
}

// Make PIFIconEditor available globally immediately
window.DevWatchIconEditor = {
    init(container) {
        // If container is a string, convert to element
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) {
            console.error('No container provided for PIF Icon Editor');
            return null;
        }
        
        // Create and initialize the editor
        const editor = new PIFIconEditor(container);
        return editor;
    }
};

// Initialize icon editor when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    console.log('PJA Icon Editor loaded and available globally');
    console.log('PIFIconEditor class:', window.PIFIconEditor);
});
