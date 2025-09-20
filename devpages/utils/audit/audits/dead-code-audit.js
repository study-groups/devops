#!/usr/bin/env node

/**
 * dead-code-audit.js - Dead code detection (replaces scripts/audit-dead-code.js)
 */

import { BaseAudit } from '../core/base-audit.js';
import { FileScanner } from '../core/file-scanner.js';
import { ImportResolver } from '../core/import-resolver.js';

export class DeadCodeAudit extends BaseAudit {
    constructor(options = {}) {
        super({
            name: 'Dead Code Analysis',
            description: 'Finds unused exports and orphaned files',
            ...options
        });

        this.baseDir = options.baseDir || './client';
        this.resolver = new ImportResolver({ baseDir: this.baseDir });
        this.entryPoints = options.entryPoints || ['index.js', 'bootloader.js', 'main.js'];
    }

    async audit() {
        const { exports, imports, allFiles } = this.buildCodeMaps();
        const unusedExports = this.findUnusedExports(exports, imports);
        const orphanedFiles = this.findOrphanedFiles(allFiles, imports);

        return {
            unusedExports,
            orphanedFiles,
            summary: this.createSummary(unusedExports, orphanedFiles),
            stats: {
                totalFiles: allFiles.size,
                filesWithUnusedExports: unusedExports.size,
                orphanedFiles: orphanedFiles.length
            }
        };
    }

    buildCodeMaps() {
        const exports = new Map(); // file -> Set of exports
        const imports = new Map(); // file -> Map of imports
        const allFiles = new Set();

        const scanner = new FileScanner({
            baseDir: this.baseDir,
            extensions: ['.js', '.mjs']
        });

        scanner.scan((fileData) => {
            allFiles.add(fileData.relativePath);
            exports.set(fileData.relativePath, this.resolver.findExports(fileData.content, fileData.relativePath));
            imports.set(fileData.relativePath, this.resolver.findImports(fileData.content));
            return null;
        });

        return { exports, imports, allFiles };
    }

    findUnusedExports(exports, imports) {
        const unused = new Map();

        for (const [filePath, fileExports] of exports) {
            const unusedInFile = new Set(fileExports);

            // Check each import to see if it uses our exports
            for (const [importingFile, fileImports] of imports) {
                for (const [importPath, importedNames] of fileImports) {
                    const resolvedPath = this.resolver.resolve(importPath, importingFile);
                    const normalized = this.resolver.normalizeExtension(resolvedPath);

                    if (normalized === filePath || normalized === filePath.replace(/\.js$/, '')) {
                        // This file is being imported, remove used exports
                        for (const importedName of importedNames) {
                            unusedInFile.delete(importedName);
                        }
                    }
                }
            }

            if (unusedInFile.size > 0) {
                unused.set(filePath, unusedInFile);
            }
        }

        return unused;
    }

    findOrphanedFiles(allFiles, imports) {
        const referenced = new Set();

        // Add entry points that are always "used"
        for (const entry of this.entryPoints) {
            for (const file of allFiles) {
                if (file.endsWith(entry)) {
                    referenced.add(file);
                }
            }
        }

        // Mark files that are imported
        for (const [, fileImports] of imports) {
            for (const [importPath] of fileImports) {
                if (this.resolver.isRelative(importPath)) {
                    referenced.add(importPath);
                }
            }
        }

        const orphaned = [];
        for (const file of allFiles) {
            if (!referenced.has(file) && !referenced.has(file.replace(/\.js$/, ''))) {
                orphaned.push(file);
            }
        }

        return orphaned;
    }

    createSummary(unusedExports, orphanedFiles) {
        const unusedCount = Array.from(unusedExports.values()).reduce((sum, set) => sum + set.size, 0);

        if (unusedCount === 0 && orphanedFiles.length === 0) {
            return 'No dead code found';
        }

        const parts = [];
        if (unusedCount > 0) parts.push(`${unusedCount} unused exports`);
        if (orphanedFiles.length > 0) parts.push(`${orphanedFiles.length} orphaned files`);

        return `Found ${parts.join(' and ')}`;
    }

    evaluateResults(results) {
        return results.unusedExports.size === 0 && results.orphanedFiles.length === 0;
    }
}