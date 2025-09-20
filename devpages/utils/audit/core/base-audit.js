#!/usr/bin/env node

/**
 * base-audit.js - Base class for all audit scripts
 *
 * Provides standardized structure, error handling, and exit codes
 */

import { AuditReporter } from './audit-reporter.js';

export class BaseAudit {
    constructor(options = {}) {
        this.name = options.name || 'Audit';
        this.description = options.description || '';
        this.reporter = new AuditReporter(options.reporting || {});
        this.exitOnFailure = options.exitOnFailure !== false;
    }

    async run() {
        try {
            console.log(`🔍 Running ${this.name}...`);
            if (this.description) {
                console.log(`   ${this.description}\n`);
            }

            const results = await this.audit();
            const passed = this.evaluateResults(results);

            this.reporter.report({
                auditName: this.name,
                results,
                passed,
                summary: this.generateSummary(results)
            });

            if (this.exitOnFailure) {
                process.exit(passed ? 0 : 1);
            }

            return passed;
        } catch (error) {
            console.error(`❌ Error during ${this.name}:`, error.message);
            if (this.exitOnFailure) {
                process.exit(1);
            }
            return false;
        }
    }

    // Override in subclasses
    async audit() {
        throw new Error('audit() method must be implemented by subclass');
    }

    // Override to customize pass/fail logic
    evaluateResults(results) {
        if (Array.isArray(results)) {
            return results.length === 0;
        }
        if (typeof results === 'object' && results.issues) {
            return results.issues.length === 0;
        }
        return Boolean(results);
    }

    // Override to customize summary
    generateSummary(results) {
        if (Array.isArray(results)) {
            return `Found ${results.length} issues`;
        }
        if (typeof results === 'object' && results.summary) {
            return results.summary;
        }
        return 'Audit completed';
    }

    // Helper method for pattern-based checks
    findPatternMatches(content, pattern, filePath) {
        const matches = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineMatches = [...line.matchAll(pattern)];

            for (const match of lineMatches) {
                matches.push({
                    file: filePath,
                    line: i + 1,
                    match: match[0],
                    fullMatch: match,
                    context: line.trim()
                });
            }
        }

        return matches;
    }

    // Helper method for counting issues by severity
    countBySeverity(issues) {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };

        for (const issue of issues) {
            if (issue.severity && counts.hasOwnProperty(issue.severity)) {
                counts[issue.severity]++;
            }
        }

        return counts;
    }
}