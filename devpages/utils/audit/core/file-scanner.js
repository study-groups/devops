#!/usr/bin/env node

/**
 * file-scanner.js - Unified file scanning utility for all audit scripts
 *
 * Provides consistent file traversal and content reading across audits
 */

import fs from 'fs';
import path from 'path';

export class FileScanner {
    constructor(options = {}) {
        this.ignoredDirs = options.ignoredDirs || ['node_modules', '.git', 'dist', 'build', 'vendor'];
        this.ignoredFiles = options.ignoredFiles || [];
        this.extensions = options.extensions || ['.js', '.mjs'];
        this.baseDir = options.baseDir || './client';
        this.includeContent = options.includeContent !== false;
    }

    scan(processor) {
        const results = [];
        this._scanDirectory(this.baseDir, results, processor);
        return results;
    }

    _scanDirectory(directory, results, processor) {
        try {
            const items = fs.readdirSync(directory);

            for (const item of items) {
                const fullPath = path.join(directory, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    if (!this.ignoredDirs.includes(item)) {
                        this._scanDirectory(fullPath, results, processor);
                    }
                } else if (this._shouldProcessFile(item, fullPath)) {
                    const fileData = this._createFileData(fullPath);
                    const result = processor(fileData);
                    if (result) {
                        results.push(result);
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${directory}:`, error.message);
        }
    }

    _shouldProcessFile(filename, fullPath) {
        return this.extensions.some(ext => filename.endsWith(ext)) &&
               !this.ignoredFiles.includes(filename) &&
               !filename.includes('.min.') &&
               !fullPath.includes('/vendor/');
    }

    _createFileData(fullPath) {
        const relativePath = path.relative('.', fullPath);
        const data = {
            fullPath,
            relativePath,
            filename: path.basename(fullPath),
            extension: path.extname(fullPath)
        };

        if (this.includeContent) {
            try {
                data.content = fs.readFileSync(fullPath, 'utf8');
            } catch (error) {
                console.error(`Error reading file ${fullPath}:`, error.message);
                data.content = '';
            }
        }

        return data;
    }

    static scanFiles(directories, options = {}) {
        const scanner = new FileScanner(options);
        const allResults = [];

        for (const dir of (Array.isArray(directories) ? directories : [directories])) {
            scanner.baseDir = dir;
            const results = scanner.scan(fileData => fileData);
            allResults.push(...results);
        }

        return allResults;
    }
}