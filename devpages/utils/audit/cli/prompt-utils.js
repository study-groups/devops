#!/usr/bin/env node

/**
 * prompt-utils.js - CLI prompting utilities for interactive audit interface
 */

import readline from 'readline';

export class PromptUtils {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async confirm(message, defaultValue = false) {
        const prompt = `${message} ${defaultValue ? '[Y/n]' : '[y/N]'}: `;
        const answer = await this.question(prompt);

        if (answer.trim() === '') {
            return defaultValue;
        }

        return /^y|yes$/i.test(answer.trim());
    }

    async select(message, options, defaultIndex = 0) {
        console.log(`\n${message}`);
        options.forEach((option, index) => {
            const marker = index === defaultIndex ? '>' : ' ';
            console.log(`${marker} ${index + 1}. ${option.label || option}`);
        });

        while (true) {
            const answer = await this.question(`\nSelect option (1-${options.length}) [${defaultIndex + 1}]: `);

            if (answer.trim() === '') {
                return options[defaultIndex];
            }

            const choice = parseInt(answer.trim()) - 1;
            if (choice >= 0 && choice < options.length) {
                return options[choice];
            }

            console.log(`Invalid choice. Please select 1-${options.length}`);
        }
    }

    async multiSelect(message, options) {
        console.log(`\n${message}`);
        console.log('Enter numbers separated by commas (e.g., 1,3,5) or "all" for all options:');

        options.forEach((option, index) => {
            console.log(`  ${index + 1}. ${option.label || option}`);
        });

        while (true) {
            const answer = await this.question('\nSelect options: ');
            const input = answer.trim().toLowerCase();

            if (input === 'all') {
                return options;
            }

            if (input === '') {
                return [];
            }

            try {
                const indices = input.split(',')
                    .map(s => parseInt(s.trim()) - 1)
                    .filter(i => i >= 0 && i < options.length);

                if (indices.length > 0) {
                    return indices.map(i => options[i]);
                }
            } catch (error) {
                // Fall through to error message
            }

            console.log(`Invalid selection. Use numbers 1-${options.length}, separated by commas, or "all"`);
        }
    }

    close() {
        this.rl.close();
    }

    showProgress(current, total, message = '') {
        const percent = Math.round((current / total) * 100);
        const filled = Math.round(percent / 2);
        const bar = '█'.repeat(filled) + '░'.repeat(50 - filled);

        process.stdout.write(`\r[${bar}] ${percent}% ${message}`);

        if (current === total) {
            process.stdout.write('\n');
        }
    }

    showSpinner(message = 'Processing...') {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let frameIndex = 0;

        const interval = setInterval(() => {
            process.stdout.write(`\r${frames[frameIndex]} ${message}`);
            frameIndex = (frameIndex + 1) % frames.length;
        }, 100);

        return {
            stop: () => {
                clearInterval(interval);
                process.stdout.write('\r');
            }
        };
    }
}