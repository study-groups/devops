#!/usr/bin/env node

/**
 * status-reporter.js - Enhanced status reporting with progress indicators
 */

export class StatusReporter {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.showProgress = options.showProgress !== false;
        this.useColors = options.useColors !== false && process.stdout.isTTY;
    }

    colors = {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        gray: '\x1b[90m'
    };

    colorize(text, color) {
        if (!this.useColors) return text;
        return `${this.colors[color]}${text}${this.colors.reset}`;
    }

    header(text) {
        const border = '='.repeat(60);
        console.log(this.colorize(border, 'cyan'));
        console.log(this.colorize(` ${text}`, 'cyan'));
        console.log(this.colorize(border, 'cyan'));
    }

    section(text) {
        console.log(this.colorize(`\n📋 ${text}`, 'blue'));
        console.log(this.colorize('-'.repeat(40), 'gray'));
    }

    success(text) {
        console.log(this.colorize(`✅ ${text}`, 'green'));
    }

    error(text) {
        console.log(this.colorize(`❌ ${text}`, 'red'));
    }

    warning(text) {
        console.log(this.colorize(`⚠️  ${text}`, 'yellow'));
    }

    info(text) {
        console.log(this.colorize(`ℹ️  ${text}`, 'blue'));
    }

    step(current, total, text) {
        const progress = `[${current}/${total}]`;
        console.log(this.colorize(`${progress} ${text}`, 'cyan'));
    }

    auditStart(auditName, description) {
        console.log(this.colorize(`\n🔍 Starting ${auditName}...`, 'blue'));
        if (description && this.verbose) {
            console.log(this.colorize(`   ${description}`, 'gray'));
        }
    }

    auditComplete(auditName, passed, duration) {
        const status = passed ? '✅ PASSED' : '❌ FAILED';
        const time = duration ? ` (${duration}ms)` : '';
        const color = passed ? 'green' : 'red';

        console.log(this.colorize(`${status} ${auditName}${time}`, color));
    }

    summary(results) {
        this.section('AUDIT SUMMARY');

        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        const healthScore = Math.round((passed / total) * 100);

        console.log(`📊 Results: ${this.colorize(`${passed}/${total}`, 'cyan')} audits passed`);

        if (results.some(r => r.duration)) {
            const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);
            console.log(`⏱️  Total time: ${this.colorize(`${totalTime}ms`, 'cyan')}`);
        }

        // Health score with color coding
        const healthColor = healthScore === 100 ? 'green' : healthScore >= 75 ? 'yellow' : 'red';
        const healthEmoji = healthScore === 100 ? '🟢' : healthScore >= 75 ? '🟡' : '🔴';

        console.log(`${healthEmoji} Health Score: ${this.colorize(`${healthScore}%`, healthColor)}`);

        // Show failed audits
        const failed = results.filter(r => !r.passed);
        if (failed.length > 0) {
            console.log(this.colorize(`\n❌ Failed audits:`, 'red'));
            failed.forEach(result => {
                console.log(this.colorize(`   • ${result.name}`, 'red'));
                if (result.summary && this.verbose) {
                    console.log(this.colorize(`     ${result.summary}`, 'gray'));
                }
            });
        }
    }

    table(headers, rows) {
        // Simple table formatter
        const colWidths = headers.map((header, i) =>
            Math.max(header.length, ...rows.map(row => String(row[i] || '').length))
        );

        const separator = colWidths.map(w => '-'.repeat(w)).join(' | ');
        const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');

        console.log(this.colorize(headerRow, 'cyan'));
        console.log(this.colorize(separator, 'gray'));

        rows.forEach(row => {
            const formattedRow = row.map((cell, i) =>
                String(cell || '').padEnd(colWidths[i])
            ).join(' | ');
            console.log(formattedRow);
        });
    }

    verbose(text) {
        if (this.verbose) {
            console.log(this.colorize(`🔍 ${text}`, 'gray'));
        }
    }
}