#!/usr/bin/env node

/**
 * conventions-audit.js - Coding conventions enforcement (replaces scripts/audit-conventions.js)
 */

import { BaseAudit } from '../core/base-audit.js';
import { FileScanner } from '../core/file-scanner.js';
import { ConventionValidator } from '../core/convention-validator.js';

export class ConventionsAudit extends BaseAudit {
    constructor(options = {}) {
        super({
            name: 'Coding Conventions',
            description: 'Enforces project-specific coding standards',
            reporting: { groupBySeverity: true },
            ...options
        });

        this.conventions = options.conventions || this.getDefaultConventions();
        this.validator = new ConventionValidator(this.conventions);
        this.baseDir = options.baseDir || './client';
    }

    async audit() {
        const violations = [];
        const scanner = new FileScanner({
            baseDir: this.baseDir,
            extensions: ['.js', '.mjs', '.css']
        });

        scanner.scan((fileData) => {
            const fileViolations = this.validator.validate(fileData.content, fileData.relativePath);
            violations.push(...fileViolations);
            return null;
        });

        return {
            issues: violations,
            summary: this.createSummary(violations),
            counts: this.countBySeverity(violations)
        };
    }

    getDefaultConventions() {
        return [
            {
                name: 'No window globals (use APP namespace)',
                description: 'Prevents random window properties',
                pattern: /window\.(?!APP|console|document|location|history|localStorage|sessionStorage|fetch|alert|confirm|prompt)[a-zA-Z]/g,
                severity: 'high',
                suggestion: 'Use window.APP.<scope> pattern instead'
            },
            {
                name: 'No !important in CSS',
                description: 'Avoids CSS specificity hacks',
                pattern: /!important/g,
                fileTypes: ['.css'],
                severity: 'medium',
                suggestion: 'Use proper CSS specificity instead of !important'
            },
            {
                name: 'Modern ES6+ syntax',
                description: 'Ensures modern JavaScript usage',
                pattern: /\bvar\s+/g,
                severity: 'low',
                suggestion: 'Use const/let instead of var'
            },
            {
                name: 'Credentials include for API calls',
                description: 'Ensures session cookies are included in fetch calls',
                pattern: /fetch\s*\([^)]*\)(?!\s*\.then\s*\(\s*[^)]*credentials\s*:\s*['"]include['"])/g,
                severity: 'critical',
                suggestion: 'Add credentials: "include" to all authenticated API calls'
            },
            {
                name: 'Root-relative imports',
                description: 'Enforces root-relative import paths',
                pattern: /import.*from\s+['"]\.\.\/\.\.\//g,
                severity: 'medium',
                suggestion: 'Use root-relative paths starting with "/" instead of "../.."'
            }
        ];
    }

    createSummary(violations) {
        if (violations.length === 0) {
            return 'All conventions followed';
        }

        const counts = this.countBySeverity(violations);
        const criticalCount = counts.critical || 0;
        const highCount = counts.high || 0;

        return `Found ${violations.length} violations (${criticalCount} critical, ${highCount} high priority)`;
    }

    evaluateResults(results) {
        const criticalCount = results.counts?.critical || 0;
        const highCount = results.counts?.high || 0;
        return criticalCount === 0 && highCount === 0;
    }
}