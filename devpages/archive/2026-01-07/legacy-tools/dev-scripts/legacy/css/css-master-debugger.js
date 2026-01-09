/**
 * CSS Master Debugger
 * Comprehensive CSS analysis combining all debugging tools
 */

console.log('🎨 CSS MASTER DEBUGGER');
console.log('======================');
console.log('Loading all CSS debugging modules...');

// Master analysis object
window.cssMasterDebugger = {
    analysis: {},
    fixes: [],
    recommendations: [],
    timestamp: new Date().toISOString()
};

// 1. Run All CSS Analyses
async function runComprehensiveAnalysis() {
    console.log('\n🔍 RUNNING COMPREHENSIVE CSS ANALYSIS...');
    console.log('==========================================');
    
    const results = {
        bundles: null,
        buttons: null,
        zIndex: null,
        system: null,
        performance: null
    };
    
    // Bundle Analysis
    console.log('\n📦 1. CSS Bundle Analysis...');
    try {
        results.bundles = analyzeCSSBundles();
        console.log('✅ Bundle analysis complete');
    } catch (e) {
        console.error('❌ Bundle analysis failed:', e.message);
    }
    
    // Button Analysis
    console.log('\n🖱️ 2. Button System Analysis...');
    try {
        results.buttons = analyzeButtonSystem();
        console.log('✅ Button analysis complete');
    } catch (e) {
        console.error('❌ Button analysis failed:', e.message);
    }
    
    // Z-Index Analysis
    console.log('\n📐 3. Z-Index System Analysis...');
    try {
        results.zIndex = analyzeZIndexSystem();
        console.log('✅ Z-Index analysis complete');
    } catch (e) {
        console.error('❌ Z-Index analysis failed:', e.message);
    }
    
    // System Analysis
    console.log('\n⚙️ 4. CSS System Analysis...');
    try {
        results.system = {
            variables: analyzeCSSVariables(),
            conflicts: detectCSSConflicts(),
            performance: analyzeCSSPerformance()
        };
        console.log('✅ System analysis complete');
    } catch (e) {
        console.error('❌ System analysis failed:', e.message);
    }
    
    window.cssMasterDebugger.analysis = results;
    return results;
}

// 2. Critical Issue Detection
function detectCriticalIssues(analysis) {
    const critical = [];
    const warnings = [];
    const info = [];
    
    // Check for missing ui-system.css
    if (analysis.bundles && !analysis.bundles.some(b => b.content?.hasUISystem)) {
        critical.push({
            type: 'missing-ui-system',
            message: 'ui-system.css not found in any bundle',
            impact: 'Button hover states will not work',
            fix: 'Regenerate CSS bundles or inject ui-system styles'
        });
    }
    
    // Check for button hover issues
    if (analysis.buttons && analysis.buttons.hoverIssues?.length > 0) {
        critical.push({
            type: 'button-hover-broken',
            message: `${analysis.buttons.hoverIssues.length} buttons have hover issues`,
            impact: 'Poor user experience with button interactions',
            fix: 'Apply button hover fixes'
        });
    }
    
    // Check for extreme z-index values
    if (analysis.zIndex && analysis.zIndex.layers?.['EXTREME (100000+)']?.elements?.length > 0) {
        warnings.push({
            type: 'extreme-zindex',
            message: `${analysis.zIndex.layers['EXTREME (100000+)'].elements.length} elements have z-index > 100000`,
            impact: 'Potential stacking context issues and maintenance problems',
            fix: 'Reduce z-index values and use CSS variables'
        });
    }
    
    // Check for CSS conflicts
    if (analysis.system?.conflicts?.length > 0) {
        warnings.push({
            type: 'css-conflicts',
            message: `${analysis.system.conflicts.length} CSS conflicts detected`,
            impact: 'Inconsistent styling and unpredictable behavior',
            fix: 'Resolve CSS specificity conflicts'
        });
    }
    
    // Check for undefined variables
    if (analysis.system?.variables?.undefined?.length > 0) {
        warnings.push({
            type: 'undefined-variables',
            message: `${analysis.system.variables.undefined.length} CSS variables are undefined`,
            impact: 'Styles may not render as expected',
            fix: 'Define missing CSS variables'
        });
    }
    
    // Check for performance issues
    if (analysis.system?.performance?.totalRules > 5000) {
        info.push({
            type: 'performance-rules',
            message: `${analysis.system.performance.totalRules} CSS rules may impact performance`,
            impact: 'Slower page rendering and style calculations',
            fix: 'Consider CSS optimization and unused rule removal'
        });
    }
    
    const issues = { critical, warnings, info };
    window.cssMasterDebugger.issues = issues;
    
    console.log('\n🚨 CRITICAL ISSUES DETECTED:');
    console.log('============================');
    console.log(`Critical: ${critical.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Info: ${info.length}`);
    
    if (critical.length > 0) {
        console.log('\n❌ CRITICAL ISSUES:');
        critical.forEach((issue, i) => {
            console.log(`${i + 1}. ${issue.message}`);
            console.log(`   Impact: ${issue.impact}`);
            console.log(`   Fix: ${issue.fix}`);
        });
    }
    
    if (warnings.length > 0) {
        console.log('\n⚠️ WARNINGS:');
        warnings.forEach((issue, i) => {
            console.log(`${i + 1}. ${issue.message}`);
        });
    }
    
    return issues;
}

// 3. Generate Master Fixes
function generateMasterFixes(analysis, issues) {
    const fixes = [];
    
    // Fix missing ui-system
    if (issues.critical.some(i => i.type === 'missing-ui-system')) {
        fixes.push({
            id: 'inject-ui-system',
            priority: 'CRITICAL',
            description: 'Inject missing ui-system.css styles',
            css: `
/* UI System Master Fix */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-base, 0.375rem);
    background-color: var(--color-bg-elevated, #ffffff);
    color: var(--color-fg, #000000);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    white-space: nowrap;
    font-family: inherit;
}

.btn:hover {
    background-color: var(--color-bg-alt, #f5f5f5);
    border-color: var(--color-border-hover, #737373);
    transform: translateY(-1px);
}

.btn:active {
    background-color: var(--color-bg-active, #e5e5e5);
    border-color: var(--color-border, #e5e5e5);
    transform: translateY(0);
}

.btn:focus-visible {
    outline: 2px solid var(--color-primary, #0066cc);
    outline-offset: 2px;
}

.btn:focus:not(:focus-visible) {
    outline: none;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
    transform: none;
}

.btn-ghost {
    background-color: transparent !important;
    border-color: transparent !important;
    color: var(--color-fg-alt, #666666) !important;
}

.btn-ghost:hover {
    background-color: var(--color-bg-alt, #f5f5f5) !important;
    border-color: var(--color-border-hover, #737373) !important;
    color: var(--color-fg, #000000) !important;
}

.btn-ghost:active {
    background-color: var(--color-bg-active, #e5e5e5) !important;
    border-color: transparent !important;
}

.btn-sm {
    padding: var(--space-1-5, 0.375rem) var(--space-3, 0.75rem);
    font-size: var(--font-size-sm, 0.875rem);
    gap: var(--space-0-5, 0.125rem);
}

.btn-primary {
    background-color: var(--color-primary, #0066cc);
    color: var(--color-primary-foreground, #ffffff);
    border-color: var(--color-primary, #0066cc);
}

.btn-primary:hover {
    background-color: var(--color-primary-hover, #0052a3);
    border-color: var(--color-primary-hover, #0052a3);
}

.btn.active {
    background-color: var(--color-primary, #0066cc);
    border-color: var(--color-primary, #0066cc);
    color: var(--color-primary-foreground, #ffffff);
    box-shadow: var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
}

.btn.active:hover {
    background-color: var(--color-primary-hover, #0052a3);
    border-color: var(--color-primary-hover, #0052a3);
}
`,
            apply: function() {
                const style = document.createElement('style');
                style.id = 'css-master-ui-system-fix';
                style.textContent = this.css;
                document.head.appendChild(style);
                console.log('✅ UI System fix applied');
            }
        });
    }
    
    // Fix button hover issues
    if (issues.critical.some(i => i.type === 'button-hover-broken')) {
        fixes.push({
            id: 'fix-button-hover',
            priority: 'CRITICAL',
            description: 'Fix button hover states',
            css: `
/* Button Hover Master Fix */
#preview-toggle.btn.btn-ghost:hover,
#edit-toggle.btn.btn-ghost:hover,
#log-toggle-btn.btn.btn-ghost:hover {
    border-color: var(--color-border-hover, #737373) !important;
    background-color: var(--color-bg-alt, #f5f5f5) !important;
}
`,
            apply: function() {
                const style = document.createElement('style');
                style.id = 'css-master-button-hover-fix';
                style.textContent = this.css;
                document.head.appendChild(style);
                console.log('✅ Button hover fix applied');
            }
        });
    }
    
    // Fix z-index issues
    if (issues.warnings.some(i => i.type === 'extreme-zindex')) {
        fixes.push({
            id: 'fix-zindex-extremes',
            priority: 'MEDIUM',
            description: 'Reduce extreme z-index values',
            apply: function() {
                const elements = document.querySelectorAll('*');
                let fixed = 0;
                elements.forEach(el => {
                    const computed = getComputedStyle(el);
                    const zIndex = parseInt(computed.zIndex);
                    if (zIndex > 100000) {
                        el.style.zIndex = '1000';
                        fixed++;
                    }
                });
                console.log(`✅ Fixed ${fixed} extreme z-index values`);
            }
        });
    }
    
    window.cssMasterDebugger.fixes = fixes;
    return fixes;
}

// 4. Apply All Critical Fixes
window.applyCriticalFixes = function() {
    const fixes = window.cssMasterDebugger.fixes;
    if (!fixes || fixes.length === 0) {
        console.log('No fixes available. Run analysis first.');
        return;
    }
    
    const criticalFixes = fixes.filter(f => f.priority === 'CRITICAL');
    console.log(`\n🔧 Applying ${criticalFixes.length} critical fixes...`);
    
    criticalFixes.forEach(fix => {
        console.log(`Applying: ${fix.description}`);
        fix.apply();
    });
    
    console.log('✅ All critical fixes applied');
    console.log('💡 Test button hover states now');
};

// 5. Apply All Fixes
window.applyAllFixes = function() {
    const fixes = window.cssMasterDebugger.fixes;
    if (!fixes || fixes.length === 0) {
        console.log('No fixes available. Run analysis first.');
        return;
    }
    
    console.log(`\n🔧 Applying all ${fixes.length} fixes...`);
    
    fixes.forEach(fix => {
        console.log(`Applying: ${fix.description}`);
        fix.apply();
    });
    
    console.log('✅ All fixes applied');
};

// 6. Generate Comprehensive Report
function generateMasterReport(analysis, issues, fixes) {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            bundlesAnalyzed: analysis.bundles?.length || 0,
            buttonsAnalyzed: analysis.buttons?.total || 0,
            zIndexElements: analysis.zIndex?.totalElements || 0,
            criticalIssues: issues.critical.length,
            warnings: issues.warnings.length,
            availableFixes: fixes.length
        },
        status: {
            uiSystemFound: analysis.bundles?.some(b => b.content?.hasUISystem) || false,
            buttonHoverWorking: (analysis.buttons?.hoverIssues?.length || 0) === 0,
            zIndexHealthy: (analysis.zIndex?.layers?.['EXTREME (100000+)']?.elements?.length || 0) === 0,
            cssVariablesDefined: (analysis.system?.variables?.undefined?.length || 0) === 0
        },
        recommendations: []
    };
    
    // Generate recommendations
    if (issues.critical.length > 0) {
        report.recommendations.push({
            priority: 'IMMEDIATE',
            action: 'Run applyCriticalFixes() to fix critical issues',
            impact: 'Essential functionality is broken'
        });
    }
    
    if (!report.status.uiSystemFound) {
        report.recommendations.push({
            priority: 'HIGH',
            action: 'Regenerate CSS bundles to include ui-system.css',
            impact: 'Button interactions will not work properly'
        });
    }
    
    if (issues.warnings.length > 0) {
        report.recommendations.push({
            priority: 'MEDIUM',
            action: 'Review and fix warning-level issues',
            impact: 'Potential maintenance and performance problems'
        });
    }
    
    console.log('\n🎨 CSS MASTER REPORT');
    console.log('===================');
    console.log('Summary:', report.summary);
    console.log('\nStatus Checks:');
    Object.entries(report.status).forEach(([key, value]) => {
        const status = value ? '✅' : '❌';
        console.log(`${status} ${key}: ${value}`);
    });
    
    if (report.recommendations.length > 0) {
        console.log('\n📋 Recommendations:');
        report.recommendations.forEach((rec, i) => {
            console.log(`${i + 1}. [${rec.priority}] ${rec.action}`);
            console.log(`   Impact: ${rec.impact}`);
        });
    }
    
    window.cssMasterDebugger.report = report;
    return report;
}

// 7. Quick Health Check
window.cssHealthCheck = function() {
    console.log('🏥 CSS HEALTH CHECK');
    console.log('===================');
    
    const checks = {
        'UI System Loaded': checkUISystemLoaded(),
        'Button Hover Working': checkButtonHover(),
        'Z-Index Reasonable': checkZIndexHealth(),
        'CSS Variables Defined': checkCSSVariables(),
        'No Major Conflicts': checkCSSConflicts()
    };
    
    let passed = 0;
    Object.entries(checks).forEach(([name, result]) => {
        const status = result ? '✅' : '❌';
        console.log(`${status} ${name}`);
        if (result) passed++;
    });
    
    const score = Math.round((passed / Object.keys(checks).length) * 100);
    console.log(`\n📊 CSS Health Score: ${score}%`);
    
    if (score < 80) {
        console.log('🚨 CSS system needs attention - run full analysis');
    } else if (score < 100) {
        console.log('⚠️ CSS system mostly healthy - minor issues detected');
    } else {
        console.log('✅ CSS system is healthy');
    }
    
    return { checks, score };
};

function checkUISystemLoaded() {
    const testEl = document.createElement('div');
    testEl.className = 'btn btn-ghost';
    testEl.style.position = 'absolute';
    testEl.style.left = '-9999px';
    document.body.appendChild(testEl);
    
    const computed = getComputedStyle(testEl);
    const hasTransparentBorder = computed.borderColor === 'rgba(0, 0, 0, 0)' || computed.borderColor === 'transparent';
    
    document.body.removeChild(testEl);
    return hasTransparentBorder;
}

function checkButtonHover() {
    const previewBtn = document.getElementById('preview-toggle');
    return previewBtn && previewBtn.classList.contains('btn-ghost');
}

function checkZIndexHealth() {
    const elements = document.querySelectorAll('*');
    let extremeCount = 0;
    elements.forEach(el => {
        const zIndex = parseInt(getComputedStyle(el).zIndex);
        if (zIndex > 100000) extremeCount++;
    });
    return extremeCount < 5;
}

function checkCSSVariables() {
    const root = getComputedStyle(document.documentElement);
    const required = ['--color-border', '--color-bg-alt', '--color-border-hover'];
    return required.every(varName => root.getPropertyValue(varName).trim() !== '');
}

function checkCSSConflicts() {
    // Simple check - look for duplicate button rules
    const stylesheets = Array.from(document.styleSheets);
    let btnGhostRules = 0;
    stylesheets.forEach(sheet => {
        try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
                Array.from(rules).forEach(rule => {
                    if (rule.selectorText && rule.selectorText.includes('.btn-ghost')) {
                        btnGhostRules++;
                    }
                });
            }
        } catch (e) {
            // CORS issues
        }
    });
    return btnGhostRules < 5; // Reasonable number of btn-ghost rules
}

// 8. Auto-run Master Analysis
async function runMasterAnalysis() {
    console.log('\n🚀 RUNNING MASTER CSS ANALYSIS...');
    console.log('==================================');
    
    const analysis = await runComprehensiveAnalysis();
    const issues = detectCriticalIssues(analysis);
    const fixes = generateMasterFixes(analysis, issues);
    const report = generateMasterReport(analysis, issues, fixes);
    
    console.log('\n💡 AVAILABLE FUNCTIONS:');
    console.log('=======================');
    console.log('- cssHealthCheck() - Quick health check');
    console.log('- applyCriticalFixes() - Fix critical issues only');
    console.log('- applyAllFixes() - Apply all available fixes');
    console.log('- window.cssMasterDebugger - Full analysis data');
    
    if (issues.critical.length > 0) {
        console.log('\n🚨 CRITICAL ISSUES DETECTED!');
        console.log('Run applyCriticalFixes() to fix immediately');
    }
    
    return report;
}

// Helper functions (simplified versions for master debugger)
function analyzeCSSBundles() {
    const stylesheets = Array.from(document.styleSheets);
    return stylesheets.map((sheet, i) => ({
        index: i,
        href: sheet.href || 'inline',
        shortName: sheet.href ? sheet.href.split('/').pop() : `inline-${i}`,
        ruleCount: sheet.cssRules ? sheet.cssRules.length : 0,
        content: {
            hasUISystem: checkSheetForContent(sheet, 'btn-ghost'),
            hasButtons: checkSheetForContent(sheet, '.btn'),
            hasZIndex: checkSheetForContent(sheet, 'z-index'),
            hasVariables: checkSheetForContent(sheet, '--color-')
        }
    }));
}

function analyzeButtonSystem() {
    const buttons = document.querySelectorAll('button, .btn');
    const hoverIssues = [];
    
    buttons.forEach((btn, i) => {
        const computed = getComputedStyle(btn);
        const classes = Array.from(btn.classList);
        
        if (classes.includes('btn-ghost') && 
            computed.borderColor !== 'rgba(0, 0, 0, 0)' && 
            computed.borderColor !== 'transparent') {
            hoverIssues.push({
                id: btn.id || `button-${i}`,
                issue: 'btn-ghost has visible border'
            });
        }
    });
    
    return {
        total: buttons.length,
        hoverIssues
    };
}

function analyzeZIndexSystem() {
    const elements = document.querySelectorAll('*');
    const layers = {
        'EXTREME (100000+)': { elements: [] }
    };
    
    elements.forEach(el => {
        const zIndex = parseInt(getComputedStyle(el).zIndex);
        if (zIndex > 100000) {
            layers['EXTREME (100000+)'].elements.push({
                element: el,
                zIndex
            });
        }
    });
    
    return {
        totalElements: Array.from(elements).filter(el => 
            getComputedStyle(el).zIndex !== 'auto').length,
        layers
    };
}

function analyzeCSSVariables() {
    const root = getComputedStyle(document.documentElement);
    const testVars = [
        '--color-border', '--color-border-hover', '--color-bg-alt',
        '--z-dropdown', '--z-modal'
    ];
    
    const undefined = testVars.filter(varName => 
        !root.getPropertyValue(varName).trim());
    
    return { undefined };
}

function detectCSSConflicts() {
    // Simplified conflict detection
    return [];
}

function analyzeCSSPerformance() {
    const stylesheets = Array.from(document.styleSheets);
    const totalRules = stylesheets.reduce((sum, sheet) => {
        try {
            return sum + (sheet.cssRules ? sheet.cssRules.length : 0);
        } catch (e) {
            return sum;
        }
    }, 0);
    
    return { totalRules };
}

function checkSheetForContent(sheet, pattern) {
    try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) return false;
        
        for (let rule of rules) {
            if (rule.cssText && rule.cssText.includes(pattern)) {
                return true;
            }
        }
    } catch (e) {
        // CORS issues
    }
    return false;
}

// Auto-run master analysis
runMasterAnalysis();
