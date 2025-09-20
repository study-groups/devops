#!/usr/bin/env node

/**
 * index.js - Main audit CLI interface with interactive menu
 */

import { PromptUtils } from './cli/prompt-utils.js';
import { StatusReporter } from './cli/status-reporter.js';
import { PatternAudit } from './audits/pattern-audit.js';
import { CircularDepsAudit } from './audits/circular-deps-audit.js';
import { DeadCodeAudit } from './audits/dead-code-audit.js';
import { ConventionsAudit } from './audits/conventions-audit.js';

class AuditCLI {
    constructor() {
        this.prompt = new PromptUtils();
        this.reporter = new StatusReporter({ verbose: false });
        this.audits = this.getAvailableAudits();
    }

    getAvailableAudits() {
        return [
            {
                name: 'Pattern Analysis',
                description: 'Scan for problematic patterns and legacy code',
                class: PatternAudit,
                options: {}
            },
            {
                name: 'Circular Dependencies',
                description: 'Detect circular import chains',
                class: CircularDepsAudit,
                options: {}
            },
            {
                name: 'Dead Code',
                description: 'Find unused exports and orphaned files',
                class: DeadCodeAudit,
                options: {}
            },
            {
                name: 'Coding Conventions',
                description: 'Enforce project-specific standards',
                class: ConventionsAudit,
                options: {}
            }
        ];
    }

    async run() {
        try {
            this.reporter.header('🔍 DevPages Code Audit System');

            const mode = await this.selectMode();

            switch (mode.value) {
                case 'interactive':
                    await this.runInteractive();
                    break;
                case 'all':
                    await this.runAll();
                    break;
                case 'single':
                    await this.runSingle();
                    break;
                case 'help':
                    this.showHelp();
                    break;
                default:
                    console.log('👋 Goodbye!');
            }
        } catch (error) {
            this.reporter.error(`Audit failed: ${error.message}`);
            process.exit(1);
        } finally {
            this.prompt.close();
        }
    }

    async selectMode() {
        return await this.prompt.select('What would you like to do?', [
            { label: '🎯 Run specific audits (recommended)', value: 'interactive' },
            { label: '🔄 Run all audits', value: 'all' },
            { label: '🎲 Run single audit', value: 'single' },
            { label: '❓ Show help', value: 'help' },
            { label: '🚪 Exit', value: 'exit' }
        ]);
    }

    async runInteractive() {
        this.reporter.section('Interactive Audit Selection');

        const selectedAudits = await this.prompt.multiSelect(
            'Select audits to run:',
            this.audits.map(audit => ({
                label: `${audit.name} - ${audit.description}`,
                ...audit
            }))
        );

        if (selectedAudits.length === 0) {
            this.reporter.info('No audits selected. Exiting.');
            return;
        }

        const verbose = await this.prompt.confirm('Show detailed output?', false);
        this.reporter.verbose = verbose;

        await this.runSelectedAudits(selectedAudits);
    }

    async runAll() {
        this.reporter.section('Running All Audits');

        const verbose = await this.prompt.confirm('Show detailed output?', false);
        this.reporter.verbose = verbose;

        await this.runSelectedAudits(this.audits);
    }

    async runSingle() {
        this.reporter.section('Single Audit Selection');

        const selectedAudit = await this.prompt.select(
            'Select audit to run:',
            this.audits.map(audit => ({
                label: `${audit.name} - ${audit.description}`,
                ...audit
            }))
        );

        const verbose = await this.prompt.confirm('Show detailed output?', true);
        this.reporter.verbose = verbose;

        await this.runSelectedAudits([selectedAudit]);
    }

    async runSelectedAudits(selectedAudits) {
        const results = [];
        let totalPassed = 0;

        this.reporter.section('Audit Execution');

        for (let i = 0; i < selectedAudits.length; i++) {
            const auditConfig = selectedAudits[i];

            this.reporter.step(i + 1, selectedAudits.length, `Running ${auditConfig.name}`);

            const startTime = Date.now();
            const spinner = this.prompt.showSpinner(`Analyzing ${auditConfig.name.toLowerCase()}...`);

            try {
                const AuditClass = auditConfig.class;
                const audit = new AuditClass({
                    ...auditConfig.options,
                    exitOnFailure: false
                });

                const passed = await audit.run();
                const duration = Date.now() - startTime;

                spinner.stop();
                this.reporter.auditComplete(auditConfig.name, passed, duration);

                results.push({
                    name: auditConfig.name,
                    passed,
                    duration
                });

                if (passed) totalPassed++;

            } catch (error) {
                spinner.stop();
                this.reporter.error(`${auditConfig.name} failed: ${error.message}`);

                results.push({
                    name: auditConfig.name,
                    passed: false,
                    error: error.message
                });
            }
        }

        this.reporter.summary(results);

        // Ask for next action
        if (results.some(r => !r.passed)) {
            const action = await this.prompt.select('Some audits failed. What would you like to do?', [
                { label: '🔧 View detailed results', value: 'details' },
                { label: '🔄 Run failed audits again', value: 'retry' },
                { label: '🏠 Return to main menu', value: 'menu' },
                { label: '🚪 Exit', value: 'exit' }
            ]);

            switch (action.value) {
                case 'retry':
                    const failedAudits = selectedAudits.filter((_, i) => !results[i].passed);
                    await this.runSelectedAudits(failedAudits);
                    break;
                case 'menu':
                    await this.run();
                    break;
                case 'details':
                    this.showDetailedResults(results);
                    break;
            }
        } else {
            this.reporter.success('All audits passed! 🎉');
        }
    }

    showDetailedResults(results) {
        this.reporter.section('Detailed Results');

        const tableData = results.map(result => [
            result.name,
            result.passed ? '✅ PASS' : '❌ FAIL',
            result.duration ? `${result.duration}ms` : 'N/A',
            result.error || ''
        ]);

        this.reporter.table(
            ['Audit', 'Status', 'Duration', 'Error'],
            tableData
        );
    }

    showHelp() {
        this.reporter.section('Audit System Help');

        console.log('📖 Available Audits:');
        this.audits.forEach(audit => {
            console.log(`   • ${audit.name}: ${audit.description}`);
        });

        console.log('\n🎯 Usage Tips:');
        console.log('   • Use Interactive mode for selective auditing');
        console.log('   • Run All audits for comprehensive health check');
        console.log('   • Enable verbose mode for detailed output');
        console.log('   • Failed audits can be re-run individually');

        console.log('\n🔧 Command Line Usage:');
        console.log('   node utils/audit/index.js          # Interactive mode');
        console.log('   node utils/audit/index.js --all    # Run all audits');
        console.log('   node utils/audit/index.js --help   # Show this help');
    }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    const cli = new AuditCLI();
    cli.showHelp();
    process.exit(0);
}

if (args.includes('--all')) {
    const cli = new AuditCLI();
    cli.reporter.section('Running All Audits (Non-Interactive)');
    cli.runSelectedAudits(cli.audits).then(() => process.exit(0));
} else {
    // Interactive mode
    const cli = new AuditCLI();
    cli.run();
}