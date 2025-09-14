#!/usr/bin/env node

/**
 * audit-all.js - Runs all audits and provides a comprehensive report
 * 
 * Single command to check codebase health
 */

import { spawn } from 'child_process';
import path from 'path';

const AUDITS = [
    {
        name: 'Import Validation',
        script: 'validate-imports.js',
        description: 'Ensures all bare imports are properly mapped'
    },
    {
        name: 'Circular Dependencies',
        script: 'audit-circular-deps.js',
        description: 'Detects circular import chains'
    },
    {
        name: 'Dead Code',
        script: 'audit-dead-code.js',
        description: 'Finds unused exports and orphaned files'
    },
    {
        name: 'Coding Conventions',
        script: 'audit-conventions.js',
        description: 'Enforces project-specific standards'
    }
];

// Run a single audit
function runAudit(audit) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const child = spawn('node', [path.join('scripts', audit.script)], {
            stdio: 'pipe'
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            resolve({
                name: audit.name,
                description: audit.description,
                passed: code === 0,
                duration,
                output: stdout,
                error: stderr
            });
        });
    });
}

// Main audit runner
async function runAllAudits() {
    console.log('🔍 Running comprehensive codebase audit...\n');
    console.log('=' .repeat(60));
    
    const results = [];
    let totalDuration = 0;
    
    for (const audit of AUDITS) {
        console.log(`\n🔄 Running ${audit.name}...`);
        console.log(`   ${audit.description}`);
        
        const result = await runAudit(audit);
        results.push(result);
        totalDuration += result.duration;
        
        if (result.passed) {
            console.log(`✅ ${audit.name} passed (${result.duration}ms)`);
        } else {
            console.log(`❌ ${audit.name} failed (${result.duration}ms)`);
        }
    }
    
    // Summary report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('=' .repeat(60));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => r.failed).length;
    
    console.log(`\n🎯 Results: ${passed}/${results.length} audits passed`);
    console.log(`⏱️  Total time: ${totalDuration}ms`);
    
    if (failed > 0) {
        console.log('\n❌ Failed audits:');
        results.filter(r => !r.passed).forEach(result => {
            console.log(`\n   ${result.name}:`);
            // Show first few lines of output for context
            const lines = result.output.split('\n').slice(0, 5);
            lines.forEach(line => {
                if (line.trim()) console.log(`     ${line}`);
            });
            if (result.output.split('\n').length > 5) {
                console.log(`     ... (run individual audit for full output)`);
            }
        });
        
        console.log('\n💡 To see full details, run individual audits:');
        results.filter(r => !r.passed).forEach(result => {
            const scriptName = AUDITS.find(a => a.name === result.name)?.script;
            console.log(`   npm run ${scriptName?.replace('.js', '') || 'audit'}`);
        });
    }
    
    // Health score
    const healthScore = Math.round((passed / results.length) * 100);
    const healthEmoji = healthScore === 100 ? '🟢' : healthScore >= 75 ? '🟡' : '🔴';
    
    console.log(`\n${healthEmoji} Codebase Health Score: ${healthScore}%`);
    
    if (healthScore === 100) {
        console.log('🎉 Excellent! Your codebase is in great shape.');
    } else if (healthScore >= 75) {
        console.log('👍 Good! A few issues to address.');
    } else {
        console.log('⚠️  Needs attention. Consider addressing the failed audits.');
    }
    
    return passed === results.length;
}

const allPassed = await runAllAudits();
process.exit(allPassed ? 0 : 1);
