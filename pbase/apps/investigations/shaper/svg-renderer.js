// svg-renderer.js
class SVGRenderer {
    constructor(containerId, boardState) {
        this.container = document.getElementById(containerId);
        this.boardState = boardState;
        this.ghostShape = null;
        this.selectedShape = null;
        this.dragStart = null;
    }

    initialize() {
        console.log('[SVG] Initializing renderer with state:', this.boardState);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("id", "astSVG");
        svg.setAttribute("width", "500");
        svg.setAttribute("height", "500");
        svg.style.border = "1px solid black";
        this.container.appendChild(svg);

        this.svg = svg;

        // Render links first
        this.boardState.links.forEach((link, id) => {
            const line = this.createLinkElement(link);
            svg.appendChild(line);
        });

        // Render shapes on top
        this.boardState.shapes.forEach((shape, id) => {
            const element = this.createShapeElement(shape);
            svg.appendChild(element);
        });
    }

    createShapeElement(shape, isGhost = false) {
        let element;
        if (shape.type === "Circle") {
            element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            element.setAttribute("cx", shape.position[0]);
            element.setAttribute("cy", shape.position[1]);
            element.setAttribute("r", shape.size);
        } else if (shape.type === "Square") {
            element = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            element.setAttribute("x", shape.position[0] - shape.size / 2);
            element.setAttribute("y", shape.position[1] - shape.size / 2);
            element.setAttribute("width", shape.size);
            element.setAttribute("height", shape.size);
        }

        // Style based on whether it's a ghost
        if (isGhost) {
            element.setAttribute("fill", shape.color + "80"); // 50% opacity
            element.setAttribute("class", "ghost");
            element.style.pointerEvents = "none"; // Ghost shouldn't capture events
        } else {
            element.setAttribute("fill", shape.color);
            element.setAttribute("id", shape.id);
            
            // Add hover effects
            element.addEventListener("mouseenter", () => this.handleShapeHover(shape, element));
            element.addEventListener("mouseleave", () => this.handleShapeUnhover(shape, element));
            element.addEventListener("mousedown", (e) => this.handleShapeMouseDown(e, shape, element));
        }

        return element;
    }

    handleShapeHover(shape, element) {
        // Highlight shape
        element.setAttribute("filter", "url(#hover-glow)");
        
        // Create ghost shapes for linked elements
        this.createGhostShapes(shape);
    }

    handleShapeUnhover(shape, element) {
        // Remove highlight if not selected
        if (shape !== this.selectedShape) {
            element.setAttribute("filter", "");
            this.removeGhostShapes();
        }
    }

    handleShapeMouseDown(e, shape, element) {
        this.selectedShape = shape;
        this.dragStart = {
            x: e.clientX,
            y: e.clientY,
            originalPos: [...shape.position]
        };

        // Add drag guide
        this.createDragGuide(shape);
        
        // Add ghost for linked shapes
        this.createGhostShapes(shape);

        // Add global mouse handlers
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
    }

    createDragGuide(shape) {
        const guide = document.createElementNS("http://www.w3.org/2000/svg", "g");
        guide.setAttribute("class", "drag-guide");

        // Create direction indicators
        const directions = [
            { angle: 0, label: 'E' },
            { angle: 45, label: 'NE' },
            { angle: 90, label: 'N' },
            { angle: 135, label: 'NW' },
            { angle: 180, label: 'W' },
            { angle: 225, label: 'SW' },
            { angle: 270, label: 'S' },
            { angle: 315, label: 'SE' }
        ];

        directions.forEach(({ angle, label }) => {
            const radius = 50;
            const x = shape.position[0] + radius * Math.cos(angle * Math.PI / 180);
            const y = shape.position[1] - radius * Math.sin(angle * Math.PI / 180);

            // Direction line
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", shape.position[0]);
            line.setAttribute("y1", shape.position[1]);
            line.setAttribute("x2", x);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", "#aaa");
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "2,2");
            guide.appendChild(line);

            // Direction label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x);
            text.setAttribute("y", y);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("alignment-baseline", "middle");
            text.setAttribute("fill", "#666");
            text.setAttribute("font-size", "10");
            text.textContent = label;
            guide.appendChild(text);
        });

        this.svg.appendChild(guide);
        this.dragGuide = guide;
    }

    handleMouseMove = (e) => {
        if (!this.selectedShape || !this.dragStart) return;

        // Calculate drag delta
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        
        // Calculate angle and distance
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Update ghost positions with easing
        if (this.ghostShape) {
            const easing = Math.min(distance / 100, 1); // Max easing at 100px
            const newX = this.dragStart.originalPos[0] + dx * easing;
            const newY = this.dragStart.originalPos[1] + dy * easing;
            this.updateGhostPosition(newX, newY);
        }

        // Highlight closest direction
        if (this.dragGuide) {
            const directions = this.dragGuide.querySelectorAll('line');
            directions.forEach((line, i) => {
                const dirAngle = i * 45;
                const angleDiff = Math.abs(((angle + 360) % 360) - dirAngle);
                const isClosest = angleDiff < 22.5 || angleDiff > 337.5;
                line.setAttribute("stroke", isClosest ? "#f00" : "#aaa");
                line.setAttribute("stroke-width", isClosest ? "2" : "1");
            });
        }
    }

    handleMouseUp = (e) => {
        if (!this.selectedShape || !this.dragStart) return;

        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 20) { // Minimum distance for flick
            const angle = Math.atan2(dy, dx);
            const direction = this.getFlickDirection(angle);
            
            // Animate shape in flick direction
            window.editor.queueMessage({
                type: MessageTypes.START_ANIMATION,
                shapeId: this.selectedShape.id,
                endPosition: this.calculateFlickEndPosition(this.selectedShape, direction),
                source: 'svg'
            });
        }

        // Cleanup
        this.selectedShape = null;
        this.dragStart = null;
        this.removeGhostShapes();
        if (this.dragGuide) {
            this.dragGuide.remove();
            this.dragGuide = null;
        }
        
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
    }

    createGhostShapes(shape) {
        // Find all links connected to this shape
        const links = Array.from(this.boardState.links.values())
            .filter(link => link.from === shape.id || link.to === shape.id);

        links.forEach(link => {
            const otherShapeId = link.from === shape.id ? link.to : link.from;
            const otherShape = this.boardState.shapes.get(otherShapeId);
            if (otherShape) {
                const ghost = this.createShapeElement({...otherShape}, true);
                this.svg.appendChild(ghost);
                this.ghostShape = ghost;
            }
        });
    }

    removeGhostShapes() {
        const ghosts = this.svg.querySelectorAll('.ghost');
        ghosts.forEach(ghost => ghost.remove());
        this.ghostShape = null;
    }

    updateGhostPosition(x, y) {
        if (!this.ghostShape) return;
        
        if (this.ghostShape.tagName === 'circle') {
            this.ghostShape.setAttribute('cx', x);
            this.ghostShape.setAttribute('cy', y);
        } else {
            this.ghostShape.setAttribute('x', x - this.selectedShape.size / 2);
            this.ghostShape.setAttribute('y', y - this.selectedShape.size / 2);
        }
    }

    getFlickDirection(angle) {
        // Convert angle to 8 directions
        const directions = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
        const index = Math.round(((angle + Math.PI) * 4) / Math.PI) % 8;
        return directions[index];
    }

    calculateFlickEndPosition(shape, direction) {
        const FLICK_DISTANCE = 150; // Increased distance
        const directionMap = {
            'N':  [0, -1],
            'NE': [0.707, -0.707],
            'E':  [1, 0],
            'SE': [0.707, 0.707],
            'S':  [0, 1],
            'SW': [-0.707, 0.707],
            'W':  [-1, 0],
            'NW': [-0.707, -0.707]
        };
        
        const [dx, dy] = directionMap[direction];
        return [
            shape.position[0] + dx * FLICK_DISTANCE,
            shape.position[1] + dy * FLICK_DISTANCE
        ];
    }

    createLinkElement(link) {
        const fromShape = this.boardState.shapes.get(link.from);
        const toShape = this.boardState.shapes.get(link.to);
        
        if (!fromShape || !toShape) return null;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("id", link.id);
        line.setAttribute("x1", fromShape.position[0]);
        line.setAttribute("y1", fromShape.position[1]);
        line.setAttribute("x2", toShape.position[0]);
        line.setAttribute("y2", toShape.position[1]);
        line.setAttribute("stroke", link.color);
        line.setAttribute("stroke-width", link.thickness);
        return line;
    }

    render() {
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create new SVG element
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("id", "astSVG");
        svg.setAttribute("width", "500");
        svg.setAttribute("height", "500");
        svg.style.border = "1px solid black";
        this.container.appendChild(svg);
        this.svg = svg;

        // Render links first
        this.boardState.links.forEach((link, id) => {
            const line = this.createLinkElement(link);
            if (line) svg.appendChild(line);
        });

        // Render shapes on top
        this.boardState.shapes.forEach((shape, id) => {
            const element = this.createShapeElement(shape);
            svg.appendChild(element);
        });

        // Add filters for hover effects
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        filter.setAttribute("id", "hover-glow");
        filter.innerHTML = `
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        `;
        defs.appendChild(filter);
        this.svg.appendChild(defs);
    }
}
