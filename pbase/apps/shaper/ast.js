class ShapeNode {
    constructor(id, type, position, size, color) {
        this.id = id;
        this.type = type;
        this.position = position; // [x, y]
        this.size = size;
        this.color = color;
        this.links = []; // Direct references to connected nodes
    }
}

class LinkNode {
    constructor(id, fromNode, toNode, color, thickness) {
        this.id = id;
        this.fromNode = fromNode; // ShapeNode
        this.toNode = toNode; // ShapeNode
        this.color = color;
        this.thickness = thickness;
    }
}

class BoardNode {
    constructor(name) {
        this.name = name;
        this.shapes = [];
        this.links = [];
    }

    addShape(shape) {
        this.shapes.push(shape);
    }

    addLink(link) {
        this.links.push(link);
        link.fromNode.links.push(link);
        link.toNode.links.push(link);
    }
}

class ASTBuilder {
    static build(data) {
        const board = new BoardNode(data.name || "Default Board");

        // Create shapes
        const shapeMap = {};
        data.shapes.forEach(shape => {
            const shapeNode = new ShapeNode(
                shape.id,
                shape.type,
                [...shape.position],
                shape.size,
                shape.color
            );
            shapeMap[shape.id] = shapeNode;
            board.addShape(shapeNode);
        });

        // Create links
        data.links.forEach(link => {
            const linkNode = new LinkNode(
                link.id,
                shapeMap[link.from],
                shapeMap[link.to],
                link.color,
                link.thickness
            );
            board.addLink(linkNode);
        });

        return board;
    }
} 