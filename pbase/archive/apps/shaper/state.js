// State management
class BoardState {
    constructor(code = '') {
        this.code = code;
        this.shapes = new Map();
        this.links = new Map();
        this.animations = new Map();
    }

    clone() {
        const newState = new BoardState(this.code);
        this.shapes.forEach((shape, id) => newState.shapes.set(id, {...shape}));
        this.links.forEach((link, id) => newState.links.set(id, {...link}));
        return newState;
    }

    updateShape(id, position) {
        const shape = this.shapes.get(id);
        if (shape) {
            shape.position = [...position];
            return true;
        }
        return false;
    }

    startAnimation(shape, endPosition) {
        this.animations.set(shape, {
            start: [...shape.position],
            end: endPosition,
            startTime: performance.now(),
            duration: 2000
        });
    }

    updateAnimation(shape, currentTime) {
        const anim = this.animations.get(shape);
        if (!anim) return [false, shape.position];

        const progress = Math.min((currentTime - anim.startTime) / anim.duration, 1);
        const position = [
            anim.start[0] + (anim.end[0] - anim.start[0]) * progress,
            anim.start[1] + (anim.end[1] - anim.start[1]) * progress
        ];

        return [progress < 1, position];
    }
}

class AppState {
    constructor() {
        this._isSynced = true;
        this.svgState = new BoardState();
        this.canvasState = new BoardState();
    }

    get isSynced() {
        return this._isSynced;
    }

    set isSynced(value) {
        this._isSynced = value;
    }
}

// Export for global use
window.AppState = AppState;
window.BoardState = BoardState;