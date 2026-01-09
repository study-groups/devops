/**
 * scripts/audit.js
 * 
 * This script scans the codebase for common issues, legacy patterns, and
 * architectural violations to help identify technical debt.
 */

import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---

const DIRECTORIES_TO_SCAN = ['client', 'redux'];
const IGNORED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build', 'scripts'];
const IGNORED_FILES = ['audit.js'];

const CHECKS = [
    {
        name: 'Forbidden React Imports',
        description: 'Finds imports from React, which is not used in this vanilla JS project.',
        pattern: /import .* from ['"](react|react-dom|react-redux)['"];/g,
        suggestion: "Remove React imports and replace with vanilla JS equivalents.",
        severity: 'critical'
    },
    {
        name: 'Legacy Redux Panel System Usage',
        description: 'Detects usage of the deprecated Redux dock/panel system.',
        pattern: /createDock\(|redux\/components\/|redux\/panels\.js/g,
        suggestion: "Migrate functionality to the new package-based debug system (@devpages/debug).",
        severity: 'high'
    },
    {
        name: 'Legacy Messaging System',
        description: 'Finds imports from the deprecated `messaging` directory.',
        pattern: /from '.*\/messaging\//g,
        suggestion: "Replace with Redux actions and the central app dispatcher.",
        severity: 'high'
    },
    {
        name: 'Direct DOM Visibility Manipulation',
        description: 'Detects manual DOM manipulation for showing/hiding elements.',
        pattern: /\.classList\.(add|remove)\(['"](.*hidden.*)['"]\)|style\.display\s*=\s*['"](none|block|flex)['"]/g,
        suggestion: "Use the state-driven `dataset.visible` attribute pattern instead of manual class/style manipulation.",
        severity: 'medium'
    },
    {
        name: 'Outdated "var" Usage',
        description: 'Finds instances of the outdated `var` keyword.',
        pattern: /\bvar\s/g,
        suggestion: "Replace `var` with modern `let` or `const`.",
        severity: 'low'
    },
    {
        name: 'Direct appStore.getState() Access in Components',
        description: 'Finds direct, non-subscribed access to the Redux store state.',
        pattern: /appStore\.getState\(\)/g,
        suggestion: 'In components, prefer `appStore.subscribe()` to react to state changes rather than polling `getState()` in event handlers.',
        severity: 'medium'
    }
];

// --- SCRIPT LOGIC ---

let totalIssues = 0;
const issuesBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
};

function scanFile(filePath) {
    if (IGNORED_FILES.includes(path.basename(filePath))) {
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let fileHasIssues = false;
        let fileIssuesContent = '';

        CHECKS.forEach(check => {
            const matches = [...content.matchAll(check.pattern)];
            if (matches.length > 0) {
                if (!fileHasIssues) {
                    fileIssuesContent += `\n--- FILE: ${filePath} ---\n`;
                    fileHasIssues = true;
                }
                
                fileIssuesContent += `\n[${check.severity.toUpperCase()}] Found ${matches.length} instance(s) of "${check.name}":\n`;
                fileIssuesContent += `  -> Suggestion: ${check.suggestion}\n`;
                
                matches.forEach(match => {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    fileIssuesContent += `     - Line ${lineNumber}: ${match[0].trim()}\n`;
                });

                totalIssues += matches.length;
                issuesBySeverity[check.severity] += matches.length;
            }
        });

        if (fileHasIssues) {
            console.log(fileIssuesContent);
        }

    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
    }
}

function scanDirectory(directory) {
    try {
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            const fullPath = path.join(directory, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (!IGNORED_DIRECTORIES.includes(file)) {
                    scanDirectory(fullPath);
                }
            } else {
                scanFile(fullPath);
            }
        });
    } catch (error) {
        console.error(`Error scanning directory ${directory}:`, error);
    }
}

function main() {
    console.log('====================================');
    console.log('Starting Codebase Audit...');
    console.log('====================================');

    DIRECTORIES_TO_SCAN.forEach(dir => {
        scanDirectory(dir);
    });

    console.log('\n====================================');
    console.log('Audit Complete');
    console.log('====================================');
    console.log(`Total Issues Found: ${totalIssues}`);
    console.log('------------------------------------');
    console.log(`Critical: ${issuesBySeverity.critical}`);
    console.log(`High:     ${issuesBySeverity.high}`);
    console.log(`Medium:   ${issuesBySeverity.medium}`);
    console.log(`Low:      ${issuesBySeverity.low}`);
    console.log('====================================');
}

main();
