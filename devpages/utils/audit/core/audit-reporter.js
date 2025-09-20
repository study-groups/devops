#!/usr/bin/env node

/**
 * audit-reporter.js - Unified output formatting for all audit scripts
 *
 * Provides consistent, readable output across all audits
 */

export class AuditReporter {
    constructor(options = {}) {
        this.showContext = options.showContext !== false;
        this.groupBySeverity = options.groupBySeverity !== false;
        this.showSummary = options.showSummary !== false;
        this.maxContextLines = options.maxContextLines || 3;
    }

    report(auditData) {
        const { auditName, results, passed, summary } = auditData;

        if (passed) {
            this._reportSuccess(auditName);
        } else {
            this._reportFailure(auditName, results, summary);
        }
    }

    _reportSuccess(auditName) {
        console.log(`✅ ${auditName} passed - no issues found!`);
    }

    _reportFailure(auditName, results, summary) {
        console.log(`❌ ${auditName} found issues:\n`);

        if (Array.isArray(results)) {
            this._reportIssuesList(results);
        } else if (results.issues) {
            this._reportIssuesList(results.issues);
        } else {
            console.log(results);
        }

        if (summary) {
            console.log(`\n📊 ${summary}`);
        }
    }

    _reportIssuesList(issues) {
        if (this.groupBySeverity) {
            this._reportGroupedBySeverity(issues);
        } else {
            this._reportByFile(issues);
        }
    }

    _reportGroupedBySeverity(issues) {
        const bySeverity = this._groupBySeverity(issues);
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        const severityEmojis = {
            critical: '🚨',
            high: '⚠️',
            medium: '📝',
            low: '💡'
        };

        for (const severity of severityOrder) {
            const severityIssues = bySeverity[severity];
            if (!severityIssues || severityIssues.length === 0) continue;

            console.log(`${severityEmojis[severity]} ${severity.toUpperCase()} (${severityIssues.length} issues):`);

            const byType = this._groupByType(severityIssues);
            for (const [type, typeIssues] of Object.entries(byType)) {
                console.log(`\n  ${type}:`);
                typeIssues.forEach(issue => {
                    this._printIssue(issue, '    ');
                });

                if (typeIssues[0]?.suggestion) {
                    console.log(`    💡 ${typeIssues[0].suggestion}`);
                }
            }
            console.log();
        }
    }

    _reportByFile(issues) {
        const byFile = this._groupByFile(issues);

        for (const [file, fileIssues] of Object.entries(byFile)) {
            console.log(`📁 ${file}:`);
            fileIssues.forEach(issue => {
                this._printIssue(issue, '  ');
            });
            console.log();
        }
    }

    _printIssue(issue, indent = '') {
        const location = issue.line ? `:${issue.line}` : '';
        const context = this.showContext && issue.context ? ` - "${issue.context}"` : '';
        const match = issue.match ? ` - "${issue.match}"` : '';

        console.log(`${indent}${issue.file || ''}${location}${context}${match}`);

        if (issue.suggestion && !this.groupBySeverity) {
            console.log(`${indent}💡 ${issue.suggestion}`);
        }
    }

    _groupBySeverity(issues) {
        const groups = { critical: [], high: [], medium: [], low: [] };

        for (const issue of issues) {
            const severity = issue.severity || 'medium';
            if (groups[severity]) {
                groups[severity].push(issue);
            }
        }

        return groups;
    }

    _groupByType(issues) {
        const groups = {};

        for (const issue of issues) {
            const type = issue.type || issue.name || issue.convention || 'Issue';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(issue);
        }

        return groups;
    }

    _groupByFile(issues) {
        const groups = {};

        for (const issue of issues) {
            const file = issue.file || 'Unknown';
            if (!groups[file]) {
                groups[file] = [];
            }
            groups[file].push(issue);
        }

        return groups;
    }

    static createSimpleReporter() {
        return new AuditReporter({
            showContext: false,
            groupBySeverity: false,
            showSummary: true
        });
    }

    static createDetailedReporter() {
        return new AuditReporter({
            showContext: true,
            groupBySeverity: true,
            showSummary: true
        });
    }
}