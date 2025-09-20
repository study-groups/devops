#!/usr/bin/env node

/**
 * circular-deps-audit.js - Circular dependency detection (replaces scripts/audit-circular-deps.js)
 */

import { BaseAudit } from '../core/base-audit.js';
import { FileScanner } from '../core/file-scanner.js';
import { DependencyGraph } from '../core/dependency-graph.js';
import { ImportResolver } from '../core/import-resolver.js';

export class CircularDepsAudit extends BaseAudit {
    constructor(options = {}) {
        super({
            name: 'Circular Dependencies',
            description: 'Detects circular import chains that can cause initialization issues',
            ...options
        });

        this.baseDir = options.baseDir || './client';
        this.resolver = new ImportResolver({ baseDir: this.baseDir });
    }

    async audit() {
        const graph = this.buildDependencyGraph();
        const cycles = graph.findCycles();

        return {
            cycles,
            stats: graph.getStats(),
            summary: cycles.length === 0
                ? 'No circular dependencies found'
                : `Found ${cycles.length} circular dependencies`
        };
    }

    buildDependencyGraph() {
        const graph = new DependencyGraph();
        const scanner = new FileScanner({
            baseDir: this.baseDir,
            extensions: ['.js', '.mjs']
        });

        scanner.scan((fileData) => {
            const imports = this.resolver.findImports(fileData.content);
            const dependencies = [];

            for (const [importPath] of imports) {
                if (this.resolver.isRelative(importPath)) {
                    const resolved = this.resolver.resolve(importPath, fileData.relativePath);
                    const normalized = this.resolver.normalizeExtension(resolved);
                    dependencies.push(normalized);
                }
            }

            graph.addNode(fileData.relativePath, dependencies);
            return null;
        });

        return graph;
    }

    evaluateResults(results) {
        return results.cycles.length === 0;
    }

    generateSummary(results) {
        const { cycles, stats } = results;

        if (cycles.length === 0) {
            return `✅ No circular dependencies found in ${stats.totalNodes} files`;
        }

        return `❌ Found ${cycles.length} circular dependencies affecting ${stats.totalNodes} files`;
    }
}