#!/usr/bin/env node

/**
 * pattern-audit.js - Pattern-based audit (replaces scripts/audit.js)
 */

import { BaseAudit } from '../core/base-audit.js';
import { FileScanner } from '../core/file-scanner.js';

export class PatternAudit extends BaseAudit {
    constructor(options = {}) {
        super({
            name: 'Pattern Analysis',
            description: 'Scans for problematic patterns and legacy code',
            ...options
        });

        this.checks = options.checks || [];
        this.directories = options.directories || ['client', 'redux'];
    }

    async audit() {
        const issues = [];
        const scanner = new FileScanner({
            ignoredFiles: ['audit.js']
        });

        for (const directory of this.directories) {
            scanner.baseDir = directory;
            scanner.scan((fileData) => {
                const fileIssues = this.checkFile(fileData);
                issues.push(...fileIssues);
                return null; // Don't collect file data
            });
        }

        return {
            issues,
            summary: `Found ${issues.length} pattern violations`,
            counts: this.countBySeverity(issues)
        };
    }

    checkFile(fileData) {
        const issues = [];

        for (const check of this.checks) {
            const matches = this.findPatternMatches(fileData.content, check.pattern, fileData.relativePath);

            for (const match of matches) {
                issues.push({
                    ...match,
                    name: check.name,
                    type: check.name,
                    severity: check.severity,
                    suggestion: check.suggestion,
                    description: check.description
                });
            }
        }

        return issues;
    }

    evaluateResults(results) {
        const criticalCount = results.counts?.critical || 0;
        return criticalCount === 0;
    }
}