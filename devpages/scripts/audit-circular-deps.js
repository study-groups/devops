#!/usr/bin/env node

/**
 * audit-circular-deps.js - Detects circular dependencies that can cause initialization issues
 * 
 * Circular deps are especially problematic in no-bundler setups and Redux initialization
 */

import fs from 'fs';
import path from 'path';

// Build dependency graph
function buildDependencyGraph(dir, graph = new Map()) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(item)) {
            buildDependencyGraph(fullPath, graph);
        } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relativePath = path.relative('./client', fullPath);
            
            const imports = [];
            const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
            
            for (const match of importMatches) {
                const importPath = match[1];
                // Only track relative imports within our codebase
                if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    const resolvedPath = path.resolve(path.dirname(fullPath), importPath);
                    const relativeImport = path.relative('./client', resolvedPath);
                    imports.push(relativeImport.replace(/\.js$/, ''));
                }
            }
            
            graph.set(relativePath.replace(/\.js$/, ''), imports);
        }
    }
    
    return graph;
}

// Detect cycles using DFS
function findCycles(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    
    function dfs(node, path = []) {
        if (recursionStack.has(node)) {
            // Found a cycle
            const cycleStart = path.indexOf(node);
            const cycle = path.slice(cycleStart).concat([node]);
            cycles.push(cycle);
            return;
        }
        
        if (visited.has(node)) return;
        
        visited.add(node);
        recursionStack.add(node);
        path.push(node);
        
        const dependencies = graph.get(node) || [];
        for (const dep of dependencies) {
            if (graph.has(dep)) {
                dfs(dep, [...path]);
            }
        }
        
        recursionStack.delete(node);
    }
    
    for (const node of graph.keys()) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }
    
    return cycles;
}

// Main audit
function auditCircularDependencies() {
    console.log('🔄 Auditing circular dependencies...\n');
    
    const graph = buildDependencyGraph('./client');
    const cycles = findCycles(graph);
    
    if (cycles.length === 0) {
        console.log('✅ No circular dependencies found!');
        return true;
    }
    
    console.log(`❌ Found ${cycles.length} circular dependencies:\n`);
    
    cycles.forEach((cycle, index) => {
        console.log(`${index + 1}. ${cycle.join(' → ')}`);
    });
    
    console.log('\n💡 Circular dependencies can cause:');
    console.log('   - Initialization race conditions');
    console.log('   - Module loading failures');
    console.log('   - Unpredictable behavior in Redux setup');
    
    return false;
}

const isClean = auditCircularDependencies();
process.exit(isClean ? 0 : 1);
