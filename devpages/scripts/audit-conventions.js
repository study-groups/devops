#!/usr/bin/env node

/**
 * audit-conventions.js - Enforces project-specific coding conventions
 * 
 * Based on your project rules and memories, ensures consistency
 */

import fs from 'fs';
import path from 'path';

const CONVENTIONS = [
    {
        name: 'Redux-only state management',
        description: 'Ensures no legacy state systems are used',
        pattern: /messageQueue|MessageQueue|\.messageQueue/g,
        severity: 'critical',
        suggestion: 'Use Redux for all state management'
    },
    {
        name: 'Root-relative imports',
        description: 'Enforces root-relative import paths',
        pattern: /import.*from\s+['"]\.\.\/\.\.\//g,
        severity: 'medium',
        suggestion: 'Use root-relative paths starting with "/" instead of "../.."'
    },
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
        name: 'No SQL database references',
        description: 'Project should not use SQL databases',
        pattern: /\b(mysql|postgres|sqlite|sql|database|db\.)/gi,
        severity: 'high',
        suggestion: 'This project uses file-based data, not SQL databases'
    },
    {
        name: 'Credentials include for API calls',
        description: 'Ensures session cookies are included in fetch calls',
        pattern: /fetch\s*\([^)]*\)(?!\s*\.then\s*\(\s*[^)]*credentials\s*:\s*['"]include['"])/g,
        severity: 'critical',
        suggestion: 'Add credentials: "include" to all authenticated API calls'
    },
    {
        name: 'No emojis in code',
        description: 'Keeps code professional',
        pattern: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
        severity: 'low',
        suggestion: 'Remove emojis from code (comments/logs are OK)'
    }
];

// Scan files for convention violations
function scanFile(filePath, content) {
    const violations = [];
    const fileExt = path.extname(filePath);
    
    for (const convention of CONVENTIONS) {
        // Skip if file type doesn't match
        if (convention.fileTypes && !convention.fileTypes.includes(fileExt)) {
            continue;
        }
        
        const matches = content.matchAll(convention.pattern);
        for (const match of matches) {
            violations.push({
                file: filePath,
                line: content.substring(0, match.index).split('\n').length,
                convention: convention.name,
                severity: convention.severity,
                suggestion: convention.suggestion,
                match: match[0]
            });
        }
    }
    
    return violations;
}

// Scan directory recursively
function scanDirectory(dir, violations = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'vendor'].includes(item)) {
            scanDirectory(fullPath, violations);
        } else if ((item.endsWith('.js') || item.endsWith('.mjs') || item.endsWith('.css')) && 
                   !fullPath.includes('/vendor/') && !item.includes('.min.')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relativePath = path.relative('.', fullPath);
            const fileViolations = scanFile(relativePath, content);
            violations.push(...fileViolations);
        }
    }
    
    return violations;
}

// Main audit
function auditConventions() {
    console.log('📏 Auditing coding conventions...\n');
    
    const violations = scanDirectory('./client');
    
    if (violations.length === 0) {
        console.log('✅ All conventions followed!');
        return true;
    }
    
    // Group by severity
    const bySeverity = {
        critical: violations.filter(v => v.severity === 'critical'),
        high: violations.filter(v => v.severity === 'high'),
        medium: violations.filter(v => v.severity === 'medium'),
        low: violations.filter(v => v.severity === 'low')
    };
    
    const severityEmojis = {
        critical: '🚨',
        high: '⚠️',
        medium: '📝',
        low: '💡'
    };
    
    for (const [severity, items] of Object.entries(bySeverity)) {
        if (items.length === 0) continue;
        
        console.log(`${severityEmojis[severity]} ${severity.toUpperCase()} (${items.length} issues):`);
        
        // Group by convention
        const byConvention = {};
        items.forEach(item => {
            if (!byConvention[item.convention]) {
                byConvention[item.convention] = [];
            }
            byConvention[item.convention].push(item);
        });
        
        for (const [convention, conventionItems] of Object.entries(byConvention)) {
            console.log(`\n  ${convention}:`);
            conventionItems.forEach(item => {
                console.log(`    ${item.file}:${item.line} - "${item.match}"`);
            });
            console.log(`    💡 ${conventionItems[0].suggestion}`);
        }
        console.log();
    }
    
    const criticalCount = bySeverity.critical.length;
    const highCount = bySeverity.high.length;
    
    console.log(`📊 Summary: ${violations.length} total violations`);
    console.log(`   Critical: ${criticalCount}, High: ${highCount}, Medium: ${bySeverity.medium.length}, Low: ${bySeverity.low.length}`);
    
    // Fail on critical or high severity issues
    return criticalCount === 0 && highCount === 0;
}

const isClean = auditConventions();
process.exit(isClean ? 0 : 1);
