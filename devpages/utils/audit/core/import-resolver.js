#!/usr/bin/env node

/**
 * import-resolver.js - Resolves import paths for dependency analysis
 */

import path from 'path';

export class ImportResolver {
    constructor(options = {}) {
        this.baseDir = options.baseDir || './client';
        this.extensions = options.extensions || ['.js', '.mjs'];
    }

    resolve(importPath, fromFile) {
        if (this.isRelative(importPath)) {
            return this.resolveRelative(importPath, fromFile);
        }
        return this.resolveAbsolute(importPath);
    }

    isRelative(importPath) {
        return importPath.startsWith('./') || importPath.startsWith('../');
    }

    resolveRelative(importPath, fromFile) {
        const fromDir = path.dirname(fromFile);
        const resolved = path.resolve(path.join(this.baseDir, fromDir), importPath);
        return path.relative(this.baseDir, resolved);
    }

    resolveAbsolute(importPath) {
        // Handle bare imports (npm packages, etc.)
        return importPath;
    }

    normalizeExtension(filePath) {
        if (this.extensions.some(ext => filePath.endsWith(ext))) {
            return filePath;
        }

        // Try adding .js if no extension
        if (!path.extname(filePath)) {
            return filePath + '.js';
        }

        return filePath;
    }

    findExports(content, filePath) {
        const exports = new Set();

        // Named exports: export { foo, bar }
        const namedExports = content.matchAll(/export\s*{\s*([^}]+)\s*}/g);
        for (const match of namedExports) {
            const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
            names.forEach(name => exports.add(name));
        }

        // Direct exports: export const foo = ...
        const directExports = content.matchAll(/export\s+(const|let|var|function|class)\s+(\w+)/g);
        for (const match of directExports) {
            exports.add(match[2]);
        }

        // Default export
        if (content.includes('export default')) {
            exports.add('default');
        }

        return exports;
    }

    findImports(content) {
        const imports = new Map(); // path -> Set of imported names

        const importMatches = content.matchAll(/import\s+(?:(\w+)|{\s*([^}]+)\s*}|(\w+)\s*,\s*{\s*([^}]+)\s*})\s+from\s+['"]([^'"]+)['"]/g);

        for (const match of importMatches) {
            const [, defaultImport, namedImports, defaultWithNamed, namedWithDefault, importPath] = match;

            if (!imports.has(importPath)) {
                imports.set(importPath, new Set());
            }

            if (defaultImport) {
                imports.get(importPath).add('default');
            }

            if (defaultWithNamed) {
                imports.get(importPath).add('default');
            }

            const namedList = namedImports || namedWithDefault || '';
            if (namedList) {
                const names = namedList.split(',').map(n => n.trim().split(' as ')[0]);
                names.forEach(name => imports.get(importPath).add(name));
            }
        }

        return imports;
    }
}