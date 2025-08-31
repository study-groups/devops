/**
 * CSS Bundle Inspector
 * Analyze CSS loading, bundle contents, and performance issues
 */

console.log('📦 CSS BUNDLE INSPECTOR');
console.log('=======================');

window.cssBundleInspector = {
    bundles: [],
    performance: {},
    conflicts: [],
    missing: []
};

// 1. Bundle Loading Analysis
function analyzeBundleLoading() {
    const stylesheets = Array.from(document.styleSheets);
    const bundles = [];
    const loadOrder = [];
    
    stylesheets.forEach((sheet, index) => {
        const href = sheet.href;
        const shortName = href ? href.split('/').pop() : `inline-${index}`;
        
        const bundleInfo = {
            index,
            href: href || 'inline',
            shortName,
            disabled: sheet.disabled,
            media: sheet.media.mediaText || 'all',
            ruleCount: 0,
            size: 0,
            loadTime: null,
            hasErrors: false,
            content: {
                hasUISystem: false,
                hasButtons: false,
                hasZIndex: false,
                hasVariables: false
            }
        };
        
        try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
                bundleInfo.ruleCount = rules.length;
                
                // Analyze content
                Array.from(rules).forEach(rule => {
                    const cssText = rule.cssText || '';
                    
                    if (cssText.includes('btn-ghost') || cssText.includes('.btn')) {
                        bundleInfo.content.hasButtons = true;
                    }
                    
                    if (cssText.includes('ui-system') || cssText.includes('/* ui-system.css')) {
                        bundleInfo.content.hasUISystem = true;
                    }
                    
                    if (cssText.includes('z-index') || cssText.includes('--z-')) {
                        bundleInfo.content.hasZIndex = true;
                    }
                    
                    if (cssText.includes('--color-') || cssText.includes(':root')) {
                        bundleInfo.content.hasVariables = true;
                    }
                });
            }
        } catch (error) {
            bundleInfo.hasErrors = true;
            bundleInfo.error = error.message;
        }
        
        bundles.push(bundleInfo);
        loadOrder.push(shortName);
    });
    
    window.cssBundleInspector.bundles = bundles;
    
    console.log(`\n📊 Found ${bundles.length} stylesheets:`);
    bundles.forEach((bundle, i) => {
        const status = bundle.hasErrors ? '❌' : '✅';
        const content = Object.entries(bundle.content)
            .filter(([key, value]) => value)
            .map(([key]) => key.replace('has', '').toLowerCase())
            .join(', ') || 'none';
            
        console.log(`${i + 1}. ${status} ${bundle.shortName} (${bundle.ruleCount} rules) - ${content}`);
    });
    
    return { bundles, loadOrder };
}

// 2. Bundle Content Analysis
function analyzeBundleContent() {
    const bundles = window.cssBundleInspector.bundles;
    const analysis = {
        uiSystemFound: false,
        buttonStylesFound: false,
        zIndexSystemFound: false,
        variablesFound: false,
        duplicates: [],
        missing: []
    };
    
    // Check for ui-system.css content
    const hasUISystem = bundles.some(b => b.content.hasUISystem);
    const hasButtons = bundles.some(b => b.content.hasButtons);
    
    analysis.uiSystemFound = hasUISystem;
    analysis.buttonStylesFound = hasButtons;
    analysis.zIndexSystemFound = bundles.some(b => b.content.hasZIndex);
    analysis.variablesFound = bundles.some(b => b.content.hasVariables);
    
    // Check for specific missing content
    if (!hasUISystem) {
        analysis.missing.push({
            type: 'ui-system',
            message: 'ui-system.css content not found in any bundle',
            impact: 'Button hover states will not work correctly'
        });
    }
    
    if (!hasButtons) {
        analysis.missing.push({
            type: 'button-styles',
            message: 'Button styles not found in any bundle',
            impact: 'Buttons will not have proper styling'
        });
    }
    
    // Check for duplicates
    const rulesBySelector = {};
    bundles.forEach(bundle => {
        if (!bundle.hasErrors) {
            try {
                const sheet = document.styleSheets[bundle.index];
                const rules = sheet.cssRules || sheet.rules;
                if (rules) {
                    Array.from(rules).forEach(rule => {
                        if (rule.selectorText) {
                            if (!rulesBySelector[rule.selectorText]) {
                                rulesBySelector[rule.selectorText] = [];
                            }
                            rulesBySelector[rule.selectorText].push({
                                bundle: bundle.shortName,
                                cssText: rule.cssText
                            });
                        }
                    });
                }
            } catch (e) {
                // Skip CORS-blocked stylesheets
            }
        }
    });
    
    // Find duplicates
    Object.entries(rulesBySelector).forEach(([selector, rules]) => {
        if (rules.length > 1) {
            // Check if they're actually different
            const uniqueRules = [...new Set(rules.map(r => r.cssText))];
            if (uniqueRules.length > 1) {
                analysis.duplicates.push({
                    selector,
                    rules,
                    conflict: true
                });
            } else if (rules.length > 1) {
                analysis.duplicates.push({
                    selector,
                    rules,
                    conflict: false
                });
            }
        }
    });
    
    console.log('\n🔍 Bundle Content Analysis:');
    console.log(`UI System found: ${analysis.uiSystemFound ? '✅' : '❌'}`);
    console.log(`Button styles found: ${analysis.buttonStylesFound ? '✅' : '❌'}`);
    console.log(`Z-index system found: ${analysis.zIndexSystemFound ? '✅' : '❌'}`);
    console.log(`CSS variables found: ${analysis.variablesFound ? '✅' : '❌'}`);
    console.log(`Duplicate selectors: ${analysis.duplicates.length}`);
    console.log(`Missing content: ${analysis.missing.length}`);
    
    if (analysis.missing.length > 0) {
        console.log('\n❌ Missing content:');
        analysis.missing.forEach(missing => {
            console.log(`- ${missing.type}: ${missing.message}`);
            console.log(`  Impact: ${missing.impact}`);
        });
    }
    
    return analysis;
}

// 3. Performance Analysis
function analyzePerformance() {
    const bundles = window.cssBundleInspector.bundles;
    const performance = {
        totalStylesheets: bundles.length,
        totalRules: bundles.reduce((sum, b) => sum + b.ruleCount, 0),
        largestBundle: null,
        slowestBundle: null,
        renderBlocking: 0,
        asyncLoaded: 0,
        issues: []
    };
    
    // Find largest bundle
    const largest = bundles.reduce((max, bundle) => 
        bundle.ruleCount > (max?.ruleCount || 0) ? bundle : max, null);
    performance.largestBundle = largest;
    
    // Count render-blocking vs async
    bundles.forEach(bundle => {
        if (bundle.media === 'all' || bundle.media === '') {
            performance.renderBlocking++;
        } else {
            performance.asyncLoaded++;
        }
    });
    
    // Performance issues
    if (performance.totalStylesheets > 10) {
        performance.issues.push({
            type: 'too-many-stylesheets',
            message: `${performance.totalStylesheets} stylesheets may impact performance`,
            recommendation: 'Consider bundling more stylesheets together'
        });
    }
    
    if (performance.totalRules > 5000) {
        performance.issues.push({
            type: 'too-many-rules',
            message: `${performance.totalRules} CSS rules may impact performance`,
            recommendation: 'Consider removing unused CSS'
        });
    }
    
    if (performance.renderBlocking > 5) {
        performance.issues.push({
            type: 'render-blocking',
            message: `${performance.renderBlocking} render-blocking stylesheets`,
            recommendation: 'Load non-critical CSS asynchronously'
        });
    }
    
    window.cssBundleInspector.performance = performance;
    
    console.log('\n⚡ Performance Analysis:');
    console.log(`Total stylesheets: ${performance.totalStylesheets}`);
    console.log(`Total CSS rules: ${performance.totalRules}`);
    console.log(`Render-blocking: ${performance.renderBlocking}`);
    console.log(`Async loaded: ${performance.asyncLoaded}`);
    console.log(`Performance issues: ${performance.issues.length}`);
    
    if (performance.issues.length > 0) {
        console.log('\n⚠️ Performance Issues:');
        performance.issues.forEach((issue, i) => {
            console.log(`${i + 1}. ${issue.message}`);
            console.log(`   Recommendation: ${issue.recommendation}`);
        });
    }
    
    return performance;
}

// 4. Bundle Integrity Check
function checkBundleIntegrity() {
    const expectedBundles = [
        'core.bundle.css',
        'layout.bundle.css', 
        'features.bundle.css',
        'panels.bundle.css'
    ];
    
    const expectedContent = {
        'core.bundle.css': ['ui-system', 'design-system', 'typography'],
        'layout.bundle.css': ['workspace-layout', 'topBar'],
        'features.bundle.css': ['viewControls', 'log.css'],
        'panels.bundle.css': ['settings', 'panels']
    };
    
    const bundles = window.cssBundleInspector.bundles;
    const integrity = {
        expectedFound: [],
        expectedMissing: [],
        unexpectedFound: [],
        contentIssues: []
    };
    
    // Check expected bundles
    expectedBundles.forEach(expectedName => {
        const found = bundles.find(b => b.shortName === expectedName);
        if (found) {
            integrity.expectedFound.push(found);
            
            // Check content
            const expectedContentList = expectedContent[expectedName] || [];
            expectedContentList.forEach(contentType => {
                const hasContent = checkBundleForContent(found, contentType);
                if (!hasContent) {
                    integrity.contentIssues.push({
                        bundle: expectedName,
                        missingContent: contentType
                    });
                }
            });
        } else {
            integrity.expectedMissing.push(expectedName);
        }
    });
    
    // Check for unexpected bundles
    bundles.forEach(bundle => {
        if (!expectedBundles.includes(bundle.shortName) && 
            !bundle.shortName.startsWith('inline-') &&
            bundle.shortName !== 'reset.css' &&
            bundle.shortName !== 'core.css') {
            integrity.unexpectedFound.push(bundle);
        }
    });
    
    console.log('\n🔒 Bundle Integrity Check:');
    console.log(`Expected bundles found: ${integrity.expectedFound.length}/${expectedBundles.length}`);
    console.log(`Missing expected bundles: ${integrity.expectedMissing.length}`);
    console.log(`Unexpected bundles: ${integrity.unexpectedFound.length}`);
    console.log(`Content issues: ${integrity.contentIssues.length}`);
    
    if (integrity.expectedMissing.length > 0) {
        console.log('\n❌ Missing expected bundles:', integrity.expectedMissing);
    }
    
    if (integrity.contentIssues.length > 0) {
        console.log('\n⚠️ Content issues:');
        integrity.contentIssues.forEach(issue => {
            console.log(`- ${issue.bundle} missing ${issue.missingContent}`);
        });
    }
    
    return integrity;
}

function checkBundleForContent(bundle, contentType) {
    try {
        const sheet = document.styleSheets[bundle.index];
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) return false;
        
        for (let rule of rules) {
            const cssText = rule.cssText || '';
            
            switch (contentType) {
                case 'ui-system':
                    if (cssText.includes('btn-ghost') && cssText.includes('hover')) return true;
                    break;
                case 'design-system':
                    if (cssText.includes('--color-') && cssText.includes(':root')) return true;
                    break;
                case 'viewControls':
                    if (cssText.includes('#view-controls') || cssText.includes('preview-toggle')) return true;
                    break;
                case 'workspace-layout':
                    if (cssText.includes('workspace') && cssText.includes('grid')) return true;
                    break;
                default:
                    if (cssText.includes(contentType)) return true;
            }
        }
    } catch (e) {
        // CORS or access issues
    }
    return false;
}

// 5. Generate Bundle Report
function generateBundleReport() {
    const loading = analyzeBundleLoading();
    const content = analyzeBundleContent();
    const performance = analyzePerformance();
    const integrity = checkBundleIntegrity();
    
    const report = {
        summary: {
            totalBundles: loading.bundles.length,
            uiSystemFound: content.uiSystemFound,
            missingContent: content.missing.length,
            duplicateSelectors: content.duplicates.length,
            performanceIssues: performance.issues.length,
            integrityIssues: integrity.contentIssues.length
        },
        recommendations: []
    };
    
    // Generate recommendations
    if (!content.uiSystemFound) {
        report.recommendations.push({
            priority: 'HIGH',
            message: 'ui-system.css not found in bundles - button hover will not work',
            action: 'Regenerate CSS bundles or add ui-system.css to core bundle'
        });
    }
    
    if (content.missing.length > 0) {
        report.recommendations.push({
            priority: 'MEDIUM',
            message: `${content.missing.length} types of missing content detected`,
            action: 'Check bundle configuration and regenerate'
        });
    }
    
    if (performance.issues.length > 0) {
        report.recommendations.push({
            priority: 'LOW',
            message: `${performance.issues.length} performance issues detected`,
            action: 'Optimize CSS loading strategy'
        });
    }
    
    console.log('\n📦 CSS BUNDLE REPORT:');
    console.log('=====================');
    console.log('Summary:', report.summary);
    
    if (report.recommendations.length > 0) {
        console.log('\n📋 Recommendations:');
        report.recommendations.forEach((rec, i) => {
            console.log(`${i + 1}. [${rec.priority}] ${rec.message}`);
            console.log(`   Action: ${rec.action}`);
        });
    }
    
    return report;
}

// 6. Bundle Debugging Tools
window.debugBundle = function(bundleName) {
    const bundle = window.cssBundleInspector.bundles.find(b => 
        b.shortName === bundleName || b.href.includes(bundleName));
    
    if (!bundle) {
        console.log(`Bundle "${bundleName}" not found`);
        return;
    }
    
    console.log(`\n🔍 Debugging bundle: ${bundle.shortName}`);
    console.log('Bundle info:', bundle);
    
    try {
        const sheet = document.styleSheets[bundle.index];
        const rules = sheet.cssRules || sheet.rules;
        
        if (rules) {
            console.log(`\nFirst 10 rules:`);
            Array.from(rules).slice(0, 10).forEach((rule, i) => {
                console.log(`${i + 1}. ${rule.selectorText || 'N/A'}`);
            });
            
            // Search for specific patterns
            const patterns = ['btn-ghost', 'ui-system', '--color-', 'z-index'];
            patterns.forEach(pattern => {
                const matches = Array.from(rules).filter(rule => 
                    rule.cssText && rule.cssText.includes(pattern));
                if (matches.length > 0) {
                    console.log(`\nFound ${matches.length} rules containing "${pattern}"`);
                }
            });
        }
    } catch (e) {
        console.log('Cannot access bundle content (CORS)');
    }
};

window.fixBundleIssues = function() {
    const content = window.cssBundleInspector.content;
    if (!content || content.uiSystemFound) {
        console.log('No bundle issues to fix or ui-system already found');
        return;
    }
    
    console.log('🔧 Injecting missing ui-system.css content...');
    
    const style = document.createElement('style');
    style.id = 'ui-system-bundle-fix';
    style.textContent = `
/* UI System Bundle Fix */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-base);
    background-color: var(--color-bg-elevated);
    color: var(--color-fg);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.btn-ghost {
    background-color: transparent !important;
    border-color: transparent !important;
    color: var(--color-fg-alt) !important;
}

.btn-ghost:hover {
    background-color: var(--color-bg-alt) !important;
    border-color: var(--color-border-hover) !important;
    color: var(--color-fg) !important;
}

.btn:hover {
    transform: translateY(-1px);
}
`;
    
    document.head.appendChild(style);
    console.log('✅ UI system bundle fix applied');
};

// Auto-run analysis
console.log('\n🚀 Running CSS bundle analysis...');
generateBundleReport();

console.log('\n💡 Available functions:');
console.log('- debugBundle(name) - Debug specific bundle');
console.log('- fixBundleIssues() - Fix missing ui-system content');
console.log('- generateBundleReport() - Re-run analysis');
console.log('- window.cssBundleInspector - Full analysis data');
