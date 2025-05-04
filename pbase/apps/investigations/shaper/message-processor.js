class MessageProcessor {
    constructor(editor) {
        this.editor = editor;
        this.state = editor.state;
        this.lastTextUpdate = 0;
        this.textUpdateThrottle = 100; // ms between text updates
    }

    processMessage(message) {
        switch (message.type) {
            case MessageTypes.SYNC_TOGGLE:
                this.handleSyncToggle();
                break;
            case MessageTypes.RENDER_REQUEST:
                this.handleRender(message.source);
                break;
            case MessageTypes.START_ANIMATION:
                this.handleStartAnimation(message);
                break;
            case MessageTypes.ANIMATION_FRAME:
                this.handleAnimationFrame(message);
                break;
        }
    }

    handleSyncToggle() {
        // 1. Toggle the state
        this.state.isSynced = !this.state.isSynced;

        // 2. If turning sync ON, force canvas to match SVG
        if (this.state.isSynced) {
            // Get SVG content
            const svgCode = document.getElementById(this.editor.svgCodeId).value;
            
            // Update canvas text
            document.getElementById(this.editor.canvasCodeId).value = svgCode;
            
            // Parse SVG code
            const data = this.editor.parseCode(svgCode);
            
            // Update both board states to match
            this.state.svgState.shapes = new Map(data.shapes.map(s => [s.id, s]));
            this.state.svgState.links = new Map(data.links.map(l => [l.id, l]));
            this.state.canvasState.shapes = new Map(data.shapes.map(s => [s.id, {...s}]));
            this.state.canvasState.links = new Map(data.links.map(l => [l.id, {...l}]));

            // Force render both views
            this.editor.updateRenderers('both');
        }

        // 3. Update UI to reflect new sync state
        this.editor.updateSyncUI();
    }

    handleRender(source) {
        this.editor.updateRenderers(source);
    }

    handleStartAnimation({ shapeId, endPosition, source }) {
        console.log('Starting animation:', { shapeId, endPosition, source });
        const state = source === 'svg' ? this.state.svgState : this.state.canvasState;
        const shape = state.shapes.get(shapeId);
        
        if (shape) {
            state.startAnimation(shape, endPosition);
            if (this.state.isSynced) {
                const otherState = source === 'svg' ? this.state.canvasState : this.state.svgState;
                const otherShape = otherState.shapes.get(shapeId);
                otherState.startAnimation(otherShape, endPosition);
            }
        }
    }

    handleAnimationFrame({ currentTime }) {
        let needsUpdate = false;
        let needsTextUpdate = false;

        // Update SVG animations
        this.state.svgState.animations.forEach((anim, shape) => {
            const [isActive, newPos] = this.state.svgState.updateAnimation(shape, currentTime);
            if (isActive) {
                shape.position = newPos;
                needsUpdate = true;
                needsTextUpdate = true;
            } else {
                this.state.svgState.animations.delete(shape);
            }
        });

        // Always update canvas animations when synced, or only when not synced and has animations
        if (this.state.isSynced) {
            this.state.canvasState.animations.forEach((anim, shape) => {
                const [isActive, newPos] = this.state.canvasState.updateAnimation(shape, currentTime);
                if (isActive) {
                    shape.position = newPos;
                    needsUpdate = true;
                } else {
                    this.state.canvasState.animations.delete(shape);
                }
            });
        } else if (this.state.canvasState.animations.size > 0) {
            this.state.canvasState.animations.forEach((anim, shape) => {
                const [isActive, newPos] = this.state.canvasState.updateAnimation(shape, currentTime);
                if (isActive) {
                    shape.position = newPos;
                    needsUpdate = true;
                    needsTextUpdate = true;
                } else {
                    this.state.canvasState.animations.delete(shape);
                }
            });
        }

        // Always update both renderers when synced
        if (needsUpdate) {
            if (this.state.isSynced) {
                this.editor.updateRenderers('both');
            } else {
                // Only update the relevant renderer when not synced
                const source = this.state.svgState.animations.size > 0 ? 'svg' : 'canvas';
                this.editor.updateRenderers(source);
            }
        }

        if (needsTextUpdate) {
            this.updateText();
        }
    }

    updateText() {
        // Update SVG text
        const svgCode = document.getElementById(this.editor.svgCodeId).value;
        let updatedCode = svgCode;

        this.state.svgState.shapes.forEach(shape => {
            const regex = new RegExp(
                `(${shape.type.toLowerCase()}\\s+${shape.id}\\s+at\\s*)\\([^)]+\\)`,
                'i'
            );
            const newPositionText = 
                `(${shape.position[0].toFixed(1)}, ${shape.position[1].toFixed(1)}, 0)`;
            updatedCode = updatedCode.replace(regex, `$1${newPositionText}`);
        });

        if (updatedCode !== svgCode) {
            document.getElementById(this.editor.svgCodeId).value = updatedCode;
            if (this.state.isSynced) {
                document.getElementById(this.editor.canvasCodeId).value = updatedCode;
            }
        }
    }
}