#!/usr/bin/env node

/**
 * dependency-graph.js - Simplified dependency graph for circular dependency detection
 */

export class DependencyGraph {
    constructor() {
        this.nodes = new Map(); // file -> Set of dependencies
        this.visited = new Set();
        this.recursionStack = new Set();
    }

    addNode(file, dependencies = []) {
        this.nodes.set(file, new Set(dependencies));
    }

    addDependency(file, dependency) {
        if (!this.nodes.has(file)) {
            this.nodes.set(file, new Set());
        }
        this.nodes.get(file).add(dependency);
    }

    findCycles() {
        this.visited.clear();
        this.recursionStack.clear();

        const cycles = [];

        for (const node of this.nodes.keys()) {
            if (!this.visited.has(node)) {
                this.detectCyclesFrom(node, [], cycles);
            }
        }

        return cycles;
    }

    detectCyclesFrom(node, path, cycles) {
        if (this.recursionStack.has(node)) {
            // Found a cycle
            const cycleStart = path.indexOf(node);
            const cycle = path.slice(cycleStart).concat([node]);
            cycles.push(cycle);
            return;
        }

        if (this.visited.has(node)) return;

        this.visited.add(node);
        this.recursionStack.add(node);
        const newPath = [...path, node];

        const dependencies = this.nodes.get(node) || new Set();
        for (const dep of dependencies) {
            if (this.nodes.has(dep)) {
                this.detectCyclesFrom(dep, newPath, cycles);
            }
        }

        this.recursionStack.delete(node);
    }

    getStats() {
        return {
            totalNodes: this.nodes.size,
            totalEdges: Array.from(this.nodes.values()).reduce((sum, deps) => sum + deps.size, 0),
            isolatedNodes: Array.from(this.nodes.entries()).filter(([, deps]) => deps.size === 0).length
        };
    }
}