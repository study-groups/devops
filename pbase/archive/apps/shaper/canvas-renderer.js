// canvas-renderer.js
class CanvasRenderer {
    constructor(canvasId, boardState) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.boardState = boardState;
    }

    initialize() {
        console.log('[CANVAS] Initializing renderer');
        this.render();
    }

    render() {
        if (!this.canvas) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw links first (behind shapes)
        this.boardState.links.forEach(link => {
            const fromShape = this.boardState.shapes.get(link.from);
            const toShape = this.boardState.shapes.get(link.to);
            
            if (fromShape && toShape) {
                this.ctx.strokeStyle = link.color;
                this.ctx.lineWidth = link.thickness;
                this.ctx.beginPath();
                this.ctx.moveTo(fromShape.position[0], fromShape.position[1]);
                this.ctx.lineTo(toShape.position[0], toShape.position[1]);
                this.ctx.stroke();
            }
        });

        // Draw shapes
        this.boardState.shapes.forEach(shape => {
            const { position, size, color } = shape;
            this.ctx.fillStyle = color;

            if (shape.type === "Circle") {
                this.ctx.beginPath();
                this.ctx.arc(position[0], position[1], size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (shape.type === "Square") {
                this.ctx.fillRect(
                    position[0] - size / 2,
                    position[1] - size / 2,
                    size,
                    size
                );
            }
        });
    }
}
