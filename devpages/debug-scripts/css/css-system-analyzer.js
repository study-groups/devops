/**
 * CSS System Analyzer
 * Comprehensive CSS debugging for DevPages - buttons, z-index, conflicts, performance
 */

console.log('🎨 CSS SYSTEM ANALYZER');
console.log('======================');

// Global CSS analysis results
window.cssAnalysis = {
    buttons: {},
    zIndex: {},
    conflicts: [],
    performance: {},
    bundles: {},
    variables: {}
};

// 1. CSS Bundle Analysis
console.log('\n1. CSS BUNDLE ANALYSIS:');
function analyzeCSSBundles() {
    const stylesheets = Array.from(document.styleSheets);
    const bundles = {
        loaded: [],
        failed: [],
        sizes: {},
        loadTimes: {}
    };
    
    stylesheets.forEach((sheet, i) => {
        const href = sheet.href || 'inline';
        const shortName = href.split('/').pop() || `inline-${i}`;
        
        try {
            const rules = sheet.cssRules || sheet.rules;
            bundles.loaded.push({
                index: i,
                href: shortName,
                ruleCount: rules ? rules.length : 0,
                disabled: sheet.disabled
            });
            
            // Check for ui-system.css specifically
            if (href.includes('ui-system.css')) {
                console.log('✅ ui-system.css found directly');
            } else if (href.includes('core.bundle.css')) {
                console.log('🔍 Checking core.bundle.css for ui-system content...');
                if (rules) {
                    let hasUISystem = false;
                    let btnGhostCount = 0;
                    for (let rule of rules) {
                        if (rule.cssText) {
                            if (rule.cssText.includes('btn-ghost')) {
                                hasUISystem = true;
                                btnGhostCount++;
                            }
                            if (rule.cssText.includes('ui-system.css')) {
                                hasUISystem = true;
                            }
                        }
                    }
                    console.log(hasUISystem ? `✅ ui-system styles found in bundle (${btnGhostCount} btn-ghost rules)` : '❌ ui-system styles missing from bundle');
                }
            }
        } catch (e) {
            bundles.failed.push({
                index: i,
                href: shortName,
                error: e.message
            });
        }
    });
    
    console.log('Loaded stylesheets:', bundles.loaded);
    console.log('Failed stylesheets:', bundles.failed);
    window.cssAnalysis.bundles = bundles;
    return bundles;
}

// 2. Button System Analysis
console.log('\n2. BUTTON SYSTEM ANALYSIS:');
function analyzeButtonSystem() {
    const buttons = document.querySelectorAll('button, .btn');
    const analysis = {
        total: buttons.length,
        byClass: {},
        conflicts: [],
        hoverIssues: [],
        zIndexIssues: []
    };
    
    buttons.forEach((btn, i) => {
        const classes = Array.from(btn.classList);
        const computed = getComputedStyle(btn);
        const id = btn.id || `button-${i}`;
        
        // Analyze classes
        classes.forEach(cls => {
            if (!analysis.byClass[cls]) analysis.byClass[cls] = 0;
            analysis.byClass[cls]++;
        });
        
        // Check for hover issues
        const hasGhostClass = classes.includes('btn-ghost');
        const borderColor = computed.borderColor;
        const backgroundColor = computed.backgroundColor;
        
        if (hasGhostClass) {
            // btn-ghost should have transparent border by default
            if (borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent') {
                analysis.hoverIssues.push({
                    id,
                    issue: 'btn-ghost has visible border when it should be transparent',
                    borderColor,
                    classes: classes.join(' ')
                });
            }
        }
        
        // Check z-index
        const zIndex = computed.zIndex;
        if (zIndex !== 'auto' && parseInt(zIndex) > 0) {
            analysis.zIndexIssues.push({
                id,
                zIndex: parseInt(zIndex),
                position: computed.position
            });
        }
    });
    
    console.log('Button analysis:', analysis);
    window.cssAnalysis.buttons = analysis;
    return analysis;
}

// 3. Z-Index System Analysis
console.log('\n3. Z-INDEX SYSTEM ANALYSIS:');
function analyzeZIndexSystem() {
    const allElements = document.querySelectorAll('*');
    const zIndexElements = [];
    const layers = {
        BASE: { min: 0, max: 99, elements: [] },
        UI: { min: 100, max: 999, elements: [] },
        POPUP: { min: 1000, max: 9999, elements: [] },
        SYSTEM: { min: 10000, max: 99999, elements: [] },
        EXTREME: { min: 100000, max: Infinity, elements: [] }
    };
    
    const cssVariables = {
        defined: {},
        used: {},
        hardcoded: []
    };
    
    // Check CSS variables
    const rootStyles = getComputedStyle(document.documentElement);
    const zIndexVars = [
        '--z-dropdown', '--z-sticky', '--z-fixed', '--z-modal-backdrop',
        '--z-modal', '--z-popover', '--z-tooltip', '--z-toast'
    ];
    
    zIndexVars.forEach(varName => {
        const value = rootStyles.getPropertyValue(varName);
        if (value) {
            cssVariables.defined[varName] = parseInt(value.trim());
        }
    });
    
    // Analyze all elements
    allElements.forEach((el, i) => {
        const computed = getComputedStyle(el);
        const zIndex = computed.zIndex;
        
        if (zIndex !== 'auto') {
            const zValue = parseInt(zIndex);
            const element = {
                element: el,
                tagName: el.tagName,
                id: el.id,
                classes: Array.from(el.classList).join(' '),
                zIndex: zValue,
                position: computed.position,
                isStacking: computed.position !== 'static'
            };
            
            zIndexElements.push(element);
            
            // Categorize by layer
            if (zValue <= 99) layers.BASE.elements.push(element);
            else if (zValue <= 999) layers.UI.elements.push(element);
            else if (zValue <= 9999) layers.POPUP.elements.push(element);
            else if (zValue <= 99999) layers.SYSTEM.elements.push(element);
            else layers.EXTREME.elements.push(element);
            
            // Check if using hardcoded values
            if (zValue === 1000 || zValue === 10000 || zValue === 999999) {
                cssVariables.hardcoded.push({
                    element: el,
                    zIndex: zValue,
                    shouldUse: zValue === 1000 ? '--z-dropdown' : 
                              zValue === 10000 ? '--z-system' : 
                              '--z-debug'
                });
            }
        }
    });
    
    // Sort by z-index
    zIndexElements.sort((a, b) => b.zIndex - a.zIndex);
    
    const analysis = {
        totalElements: zIndexElements.length,
        highestZIndex: zIndexElements[0]?.zIndex || 0,
        layers,
        cssVariables,
        conflicts: findZIndexConflicts(zIndexElements),
        recommendations: generateZIndexRecommendations(layers, cssVariables)
    };
    
    console.log('Z-Index analysis:', analysis);
    window.cssAnalysis.zIndex = analysis;
    return analysis;
}

function findZIndexConflicts(elements) {
    const conflicts = [];
    const groups = {};
    
    // Group by z-index value
    elements.forEach(el => {
        if (!groups[el.zIndex]) groups[el.zIndex] = [];
        groups[el.zIndex].push(el);
    });
    
    // Find conflicts (same z-index, different purposes)
    Object.entries(groups).forEach(([zIndex, els]) => {
        if (els.length > 1) {
            const purposes = new Set();
            els.forEach(el => {
                if (el.classes.includes('modal')) purposes.add('modal');
                else if (el.classes.includes('tooltip')) purposes.add('tooltip');
                else if (el.classes.includes('dropdown')) purposes.add('dropdown');
                else if (el.classes.includes('panel')) purposes.add('panel');
                else purposes.add('unknown');
            });
            
            if (purposes.size > 1) {
                conflicts.push({
                    zIndex: parseInt(zIndex),
                    elements: els,
                    purposes: Array.from(purposes)
                });
            }
        }
    });
    
    return conflicts;
}

function generateZIndexRecommendations(layers, cssVariables) {
    const recommendations = [];
    
    // Check for extreme values
    if (layers.EXTREME.elements.length > 0) {
        recommendations.push({
            type: 'extreme-values',
            message: `${layers.EXTREME.elements.length} elements have z-index > 100000`,
            elements: layers.EXTREME.elements.slice(0, 5)
        });
    }
    
    // Check for hardcoded values
    if (cssVariables.hardcoded.length > 0) {
        recommendations.push({
            type: 'hardcoded-values',
            message: `${cssVariables.hardcoded.length} elements use hardcoded z-index values`,
            elements: cssVariables.hardcoded.slice(0, 5)
        });
    }
    
    // Check for missing variables
    const commonValues = [100, 1000, 10000];
    commonValues.forEach(value => {
        const hasVariable = Object.values(cssVariables.defined).includes(value);
        if (!hasVariable) {
            recommendations.push({
                type: 'missing-variable',
                message: `Consider adding CSS variable for z-index ${value}`,
                suggestedVariable: value === 100 ? '--z-ui' : 
                                 value === 1000 ? '--z-popup' : 
                                 '--z-system'
            });
        }
    });
    
    return recommendations;
}

// 4. CSS Conflict Detection
console.log('\n4. CSS CONFLICT DETECTION:');
function detectCSSConflicts() {
    const conflicts = [];
    const testElement = document.createElement('div');
    testElement.style.position = 'absolute';
    testElement.style.left = '-9999px';
    document.body.appendChild(testElement);
    
    // Test button conflicts
    const buttonTests = [
        { classes: 'btn', expectedBorder: '1px solid' },
        { classes: 'btn btn-ghost', expectedBorderColor: 'transparent' },
        { classes: 'btn btn-primary', expectedBackground: 'var(--color-primary)' }
    ];
    
    buttonTests.forEach(test => {
        testElement.className = test.classes;
        const computed = getComputedStyle(testElement);
        
        if (test.expectedBorder && !computed.border.includes('1px solid')) {
            conflicts.push({
                type: 'button-border',
                classes: test.classes,
                expected: test.expectedBorder,
                actual: computed.border
            });
        }
        
        if (test.expectedBorderColor && computed.borderColor !== 'rgba(0, 0, 0, 0)' && computed.borderColor !== 'transparent') {
            conflicts.push({
                type: 'button-border-color',
                classes: test.classes,
                expected: test.expectedBorderColor,
                actual: computed.borderColor
            });
        }
    });
    
    document.body.removeChild(testElement);
    
    console.log('CSS conflicts:', conflicts);
    window.cssAnalysis.conflicts = conflicts;
    return conflicts;
}

// 5. CSS Variable Analysis
console.log('\n5. CSS VARIABLE ANALYSIS:');
function analyzeCSSVariables() {
    const rootStyles = getComputedStyle(document.documentElement);
    const variables = {
        colors: {},
        zIndex: {},
        spacing: {},
        typography: {},
        undefined: []
    };
    
    // Common variable patterns
    const patterns = {
        colors: /^--color-/,
        zIndex: /^--z-/,
        spacing: /^--space-/,
        typography: /^--font-/
    };
    
    // Get all CSS custom properties
    const allStyles = Array.from(document.styleSheets).flatMap(sheet => {
        try {
            return Array.from(sheet.cssRules || []);
        } catch (e) {
            return [];
        }
    });
    
    // Extract variables from :root rules
    allStyles.forEach(rule => {
        if (rule.selectorText === ':root' && rule.style) {
            for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) {
                    const value = rule.style.getPropertyValue(prop);
                    
                    if (patterns.colors.test(prop)) {
                        variables.colors[prop] = value;
                    } else if (patterns.zIndex.test(prop)) {
                        variables.zIndex[prop] = value;
                    } else if (patterns.spacing.test(prop)) {
                        variables.spacing[prop] = value;
                    } else if (patterns.typography.test(prop)) {
                        variables.typography[prop] = value;
                    }
                }
            }
        }
    });
    
    // Test if variables resolve correctly
    const testVars = [
        '--color-border', '--color-border-hover', '--color-bg-alt',
        '--z-dropdown', '--z-modal', '--space-2', '--font-size-sm'
    ];
    
    testVars.forEach(varName => {
        const value = rootStyles.getPropertyValue(varName);
        if (!value || value.trim() === '') {
            variables.undefined.push(varName);
        }
    });
    
    console.log('CSS variables:', variables);
    window.cssAnalysis.variables = variables;
    return variables;
}

// 6. Performance Analysis
console.log('\n6. CSS PERFORMANCE ANALYSIS:');
function analyzeCSSPerformance() {
    const performance = {
        stylesheetCount: document.styleSheets.length,
        totalRules: 0,
        complexSelectors: [],
        inefficientSelectors: [],
        unusedRules: 0
    };
    
    Array.from(document.styleSheets).forEach(sheet => {
        try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
                performance.totalRules += rules.length;
                
                Array.from(rules).forEach(rule => {
                    if (rule.selectorText) {
                        const selector = rule.selectorText;
                        
                        // Check for complex selectors
                        if (selector.split(' ').length > 4) {
                            performance.complexSelectors.push(selector);
                        }
                        
                        // Check for inefficient selectors
                        if (selector.includes('*') || selector.includes('[class*=')) {
                            performance.inefficientSelectors.push(selector);
                        }
                    }
                });
            }
        } catch (e) {
            // CORS or other access issues
        }
    });
    
    console.log('CSS performance:', performance);
    window.cssAnalysis.performance = performance;
    return performance;
}

// 7. Button Hover Test
console.log('\n7. BUTTON HOVER TEST:');
function testButtonHover() {
    const previewButton = document.getElementById('preview-toggle');
    if (!previewButton) {
        console.log('❌ Preview button not found');
        return;
    }
    
    console.log('✅ Testing preview button hover...');
    const computed = getComputedStyle(previewButton);
    
    console.log('Current styles:', {
        border: computed.border,
        borderColor: computed.borderColor,
        backgroundColor: computed.backgroundColor,
        classes: previewButton.className
    });
    
    // Simulate hover
    previewButton.classList.add('hover-test');
    const hoverStyle = document.createElement('style');
    hoverStyle.textContent = `
        #preview-toggle.hover-test:hover,
        #preview-toggle.hover-test {
            border-color: red !important;
            background-color: yellow !important;
        }
    `;
    document.head.appendChild(hoverStyle);
    
    setTimeout(() => {
        const hoverComputed = getComputedStyle(previewButton);
        console.log('Hover test styles:', {
            border: hoverComputed.border,
            borderColor: hoverComputed.borderColor,
            backgroundColor: hoverComputed.backgroundColor
        });
        
        previewButton.classList.remove('hover-test');
        hoverStyle.remove();
    }, 1000);
}

// 8. Generate Comprehensive Report
console.log('\n8. GENERATING COMPREHENSIVE REPORT:');
function generateCSSReport() {
    const bundles = analyzeCSSBundles();
    const buttons = analyzeButtonSystem();
    const zIndex = analyzeZIndexSystem();
    const conflicts = detectCSSConflicts();
    const variables = analyzeCSSVariables();
    const performance = analyzeCSSPerformance();
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalStylesheets: bundles.loaded.length,
            totalButtons: buttons.total,
            zIndexElements: zIndex.totalElements,
            conflicts: conflicts.length,
            undefinedVariables: variables.undefined.length,
            recommendations: zIndex.recommendations.length
        },
        details: {
            bundles,
            buttons,
            zIndex,
            conflicts,
            variables,
            performance
        }
    };
    
    console.log('\n🎨 CSS SYSTEM REPORT:');
    console.log('====================');
    console.log('Summary:', report.summary);
    console.log('\n📊 Key Issues:');
    
    if (conflicts.length > 0) {
        console.log(`❌ ${conflicts.length} CSS conflicts detected`);
    }
    
    if (variables.undefined.length > 0) {
        console.log(`❌ ${variables.undefined.length} undefined CSS variables:`, variables.undefined);
    }
    
    if (zIndex.recommendations.length > 0) {
        console.log(`⚠️ ${zIndex.recommendations.length} z-index recommendations:`, zIndex.recommendations);
    }
    
    if (buttons.hoverIssues.length > 0) {
        console.log(`❌ ${buttons.hoverIssues.length} button hover issues:`, buttons.hoverIssues);
    }
    
    console.log('\n✅ Full report available in window.cssAnalysis');
    
    window.cssAnalysis.report = report;
    return report;
}

// 9. Quick Fix Functions
console.log('\n9. QUICK FIX FUNCTIONS:');
window.fixButtonHover = function() {
    const style = document.createElement('style');
    style.id = 'button-hover-fix';
    style.textContent = `
        .btn-ghost {
            background-color: transparent !important;
            border-color: transparent !important;
        }
        .btn-ghost:hover {
            background-color: var(--color-bg-alt) !important;
            border-color: var(--color-border-hover) !important;
        }
    `;
    document.head.appendChild(style);
    console.log('✅ Button hover fix applied');
};

window.fixUISystemCSS = function() {
    // Check if ui-system.css is already loaded
    const existingLink = document.querySelector('link[href*="ui-system.css"]');
    if (existingLink) {
        console.log('✅ ui-system.css already loaded');
    } else {
        // Load ui-system.css directly
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/client/styles/ui-system.css';
        link.id = 'ui-system-css-fix';
        document.head.appendChild(link);
        console.log('✅ ui-system.css loaded directly');
    }
    
    // Create a more robust fix with higher specificity
    const style = document.createElement('style');
    style.id = 'ui-system-css-override';
    style.textContent = `
        /* Force ui-system styles with high specificity */
        button.btn.btn-ghost,
        .btn.btn-ghost {
            background-color: transparent !important;
            border-color: transparent !important;
            color: var(--color-fg-alt) !important;
            transition: all 0.15s ease !important;
        }
        
        button.btn.btn-ghost:hover,
        .btn.btn-ghost:hover {
            background-color: var(--color-bg-alt) !important;
            border-color: var(--color-border-hover) !important;
            color: var(--color-fg) !important;
            transform: translateY(-1px) !important;
        }
        
        button.btn.btn-ghost:active,
        .btn.btn-ghost:active {
            background-color: var(--color-bg-active) !important;
            border-color: transparent !important;
            transform: translateY(0) !important;
        }
        
        /* Specific fix for preview button */
        #preview-toggle.btn.btn-ghost {
            background-color: transparent !important;
            border-color: transparent !important;
        }
        
        #preview-toggle.btn.btn-ghost:hover {
            border: 1px solid var(--color-border-hover) !important;
            background-color: var(--color-bg-alt) !important;
        }
        
        /* Ensure CSS variables are defined */
        :root {
            --color-bg-alt: rgba(0, 0, 0, 0.05) !important;
            --color-border-hover: rgba(0, 0, 0, 0.2) !important;
            --color-bg-active: rgba(0, 0, 0, 0.1) !important;
            --color-fg-alt: rgba(0, 0, 0, 0.7) !important;
            --color-fg: rgba(0, 0, 0, 0.9) !important;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            :root {
                --color-bg-alt: rgba(255, 255, 255, 0.05) !important;
                --color-border-hover: rgba(255, 255, 255, 0.2) !important;
                --color-bg-active: rgba(255, 255, 255, 0.1) !important;
                --color-fg-alt: rgba(255, 255, 255, 0.7) !important;
                --color-fg: rgba(255, 255, 255, 0.9) !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    console.log('✅ ui-system CSS override applied with high specificity and hover support');
    
    // Verify it loaded
    setTimeout(() => {
        const testElement = document.createElement('div');
        testElement.className = 'btn btn-ghost';
        testElement.style.position = 'absolute';
        testElement.style.left = '-9999px';
        document.body.appendChild(testElement);
        
        const computed = getComputedStyle(testElement);
        const hasGhostStyles = computed.backgroundColor === 'rgba(0, 0, 0, 0)' || 
                              computed.backgroundColor === 'transparent';
        
        console.log('🔍 ui-system.css verification:', {
            loaded: hasGhostStyles,
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
            color: computed.color,
            transition: computed.transition
        });
        
        // Test the actual preview button
        const previewButton = document.getElementById('preview-toggle');
        if (previewButton) {
            const previewComputed = getComputedStyle(previewButton);
            console.log('🔍 Preview button verification:', {
                backgroundColor: previewComputed.backgroundColor,
                borderColor: previewComputed.borderColor,
                classes: previewButton.className,
                transition: previewComputed.transition
            });
        }
        
        document.body.removeChild(testElement);
    }, 200);
};

window.testButtonHover = function() {
    console.log('🧪 Testing button hover behavior...');
    
    const previewButton = document.getElementById('preview-toggle');
    if (!previewButton) {
        console.log('❌ Preview button not found');
        return;
    }
    
    // Create a test overlay to simulate hover
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.1);
        z-index: 9999;
        pointer-events: none;
    `;
    document.body.appendChild(overlay);
    
    // Get initial styles
    const initialStyles = getComputedStyle(previewButton);
    console.log('📊 Initial button styles:', {
        backgroundColor: initialStyles.backgroundColor,
        borderColor: initialStyles.borderColor,
        border: initialStyles.border,
        color: initialStyles.color
    });
    
    // Simulate hover by adding hover class
    previewButton.classList.add('hover-test');
    const hoverStyle = document.createElement('style');
    hoverStyle.textContent = `
        .hover-test:hover,
        .hover-test {
            background-color: var(--color-bg-alt) !important;
            border-color: var(--color-border-hover) !important;
        }
    `;
    document.head.appendChild(hoverStyle);
    
    setTimeout(() => {
        const hoverStyles = getComputedStyle(previewButton);
        console.log('📊 Hover button styles:', {
            backgroundColor: hoverStyles.backgroundColor,
            borderColor: hoverStyles.borderColor,
            border: hoverStyles.border,
            color: hoverStyles.color
        });
        
        // Cleanup
        previewButton.classList.remove('hover-test');
        hoverStyle.remove();
        overlay.remove();
        
        console.log('✅ Hover test completed');
    }, 500);
};

window.fixZIndexConflicts = function() {
    const analysis = window.cssAnalysis.zIndex;
    if (!analysis) {
        console.log('❌ Run CSS analysis first');
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'zindex-fix';
    let css = '';
    
    analysis.conflicts.forEach(conflict => {
        conflict.elements.forEach(el => {
            if (el.id) {
                css += `#${el.id} { z-index: var(--z-${el.classes.includes('modal') ? 'modal' : 'dropdown'}); }\n`;
            }
        });
    });
    
    style.textContent = css;
    document.head.appendChild(style);
    console.log('✅ Z-index conflicts fix applied');
};

window.diagnoseCSSConflicts = function() {
    console.log('🔍 Diagnosing CSS conflicts for btn-ghost...');
    
    // Create test element
    const testElement = document.createElement('button');
    testElement.className = 'btn btn-ghost';
    testElement.style.position = 'absolute';
    testElement.style.left = '-9999px';
    document.body.appendChild(testElement);
    
    // Get all stylesheets
    const stylesheets = Array.from(document.styleSheets);
    const conflictingRules = [];
    
    stylesheets.forEach((sheet, i) => {
        try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
                Array.from(rules).forEach(rule => {
                    if (rule.selectorText && rule.selectorText.includes('btn-ghost')) {
                        conflictingRules.push({
                            stylesheet: sheet.href || `inline-${i}`,
                            selector: rule.selectorText,
                            cssText: rule.cssText,
                            specificity: calculateSpecificity(rule.selectorText)
                        });
                    }
                });
            }
        } catch (e) {
            // CORS issues
        }
    });
    
    // Sort by specificity
    conflictingRules.sort((a, b) => b.specificity - a.specificity);
    
    console.log('📊 Conflicting btn-ghost rules (sorted by specificity):', conflictingRules);
    
    // Test computed styles
    const computed = getComputedStyle(testElement);
    console.log('🎯 Current computed styles:', {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        color: computed.color,
        border: computed.border
    });
    
    document.body.removeChild(testElement);
    return conflictingRules;
};

function calculateSpecificity(selector) {
    // Simple specificity calculation
    const idCount = (selector.match(/#/g) || []).length;
    const classCount = (selector.match(/\./g) || []).length;
    const elementCount = (selector.match(/[a-zA-Z]/g) || []).length;
    
    return idCount * 100 + classCount * 10 + elementCount;
}

// Auto-run analysis
console.log('\n🚀 AUTO-RUNNING ANALYSIS...');
testButtonHover();
setTimeout(() => {
    generateCSSReport();
    
    console.log('\n💡 Available functions:');
    console.log('- window.cssAnalysis (full analysis results)');
    console.log('- fixButtonHover() (fix button hover issues)');
    console.log('- fixUISystemCSS() (load ui-system.css directly)');
    console.log('- testButtonHover() (test hover behavior)');
    console.log('- diagnoseCSSConflicts() (find conflicting CSS rules)');
    console.log('- fixZIndexConflicts() (fix z-index conflicts)');
    console.log('- generateCSSReport() (re-run analysis)');
}, 2000);
