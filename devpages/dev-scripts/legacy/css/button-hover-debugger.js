/**
 * Button Hover Debugger
 * Specialized debugging for button hover states and CSS conflicts
 */

console.log('🖱️ BUTTON HOVER DEBUGGER');
console.log('========================');

window.buttonHoverDebugger = {
    buttons: [],
    conflicts: [],
    fixes: []
};

// 1. Comprehensive Button Analysis
function analyzeAllButtons() {
    const buttons = document.querySelectorAll('button, .btn, [role="button"]');
    const analysis = [];
    
    buttons.forEach((btn, index) => {
        const computed = getComputedStyle(btn);
        const classes = Array.from(btn.classList);
        const id = btn.id || `button-${index}`;
        
        const buttonData = {
            element: btn,
            index,
            id,
            tagName: btn.tagName.toLowerCase(),
            classes,
            text: btn.textContent.trim().substring(0, 30),
            styles: {
                border: computed.border,
                borderColor: computed.borderColor,
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                cursor: computed.cursor,
                display: computed.display,
                position: computed.position,
                zIndex: computed.zIndex
            },
            states: {
                disabled: btn.disabled,
                hidden: computed.display === 'none' || computed.visibility === 'hidden',
                hasHover: false, // Will be tested
                hasActive: false, // Will be tested
                hasFocus: false // Will be tested
            },
            issues: []
        };
        
        // Check for common issues
        if (classes.includes('btn-ghost') && computed.borderColor !== 'rgba(0, 0, 0, 0)' && computed.borderColor !== 'transparent') {
            buttonData.issues.push({
                type: 'ghost-border',
                message: 'btn-ghost should have transparent border',
                current: computed.borderColor,
                expected: 'transparent'
            });
        }
        
        if (computed.cursor !== 'pointer' && !btn.disabled) {
            buttonData.issues.push({
                type: 'cursor',
                message: 'Button should have cursor: pointer',
                current: computed.cursor,
                expected: 'pointer'
            });
        }
        
        if (classes.includes('btn') && !computed.border.includes('1px')) {
            buttonData.issues.push({
                type: 'missing-border',
                message: 'btn class should have 1px border',
                current: computed.border,
                expected: '1px solid'
            });
        }
        
        analysis.push(buttonData);
    });
    
    window.buttonHoverDebugger.buttons = analysis;
    console.log(`Analyzed ${analysis.length} buttons`);
    
    // Show buttons with issues
    const withIssues = analysis.filter(btn => btn.issues.length > 0);
    if (withIssues.length > 0) {
        console.log(`\n⚠️ ${withIssues.length} buttons have issues:`);
        withIssues.forEach(btn => {
            console.log(`- ${btn.id}: ${btn.issues.map(i => i.type).join(', ')}`);
        });
    }
    
    return analysis;
}

// 2. Hover State Testing
function testHoverStates() {
    const buttons = window.buttonHoverDebugger.buttons;
    const testResults = [];
    
    console.log('\n🧪 Testing hover states...');
    
    buttons.forEach(btn => {
        if (btn.states.hidden || btn.states.disabled) return;
        
        const element = btn.element;
        const originalStyles = getComputedStyle(element);
        
        // Create hover test
        element.classList.add('hover-test');
        const hoverStyle = document.createElement('style');
        hoverStyle.id = `hover-test-${btn.index}`;
        hoverStyle.textContent = `
            .hover-test:hover,
            .hover-test.hover-test {
                border-color: var(--color-border-hover, #737373) !important;
                background-color: var(--color-bg-alt, #f5f5f5) !important;
            }
        `;
        document.head.appendChild(hoverStyle);
        
        // Get hover styles
        const hoverStyles = getComputedStyle(element);
        
        const result = {
            id: btn.id,
            classes: btn.classes.join(' '),
            original: {
                borderColor: originalStyles.borderColor,
                backgroundColor: originalStyles.backgroundColor
            },
            hover: {
                borderColor: hoverStyles.borderColor,
                backgroundColor: hoverStyles.backgroundColor
            },
            changed: {
                border: originalStyles.borderColor !== hoverStyles.borderColor,
                background: originalStyles.backgroundColor !== hoverStyles.backgroundColor
            }
        };
        
        // Check if hover actually works
        if (!result.changed.border && !result.changed.background) {
            result.issue = 'No hover effect detected';
        } else if (!result.changed.border && btn.classes.includes('btn-ghost')) {
            result.issue = 'btn-ghost hover border not working';
        }
        
        testResults.push(result);
        
        // Cleanup
        element.classList.remove('hover-test');
        hoverStyle.remove();
    });
    
    // Show results
    const failed = testResults.filter(r => r.issue);
    console.log(`Hover test results: ${testResults.length - failed.length}/${testResults.length} working`);
    
    if (failed.length > 0) {
        console.log('\n❌ Failed hover tests:');
        failed.forEach(result => {
            console.log(`- ${result.id}: ${result.issue}`);
        });
    }
    
    return testResults;
}

// 3. CSS Specificity Analysis
function analyzeCSSSpecificity() {
    const buttons = window.buttonHoverDebugger.buttons;
    const specificityIssues = [];
    
    console.log('\n🎯 Analyzing CSS specificity...');
    
    // Get all stylesheets
    const allRules = [];
    Array.from(document.styleSheets).forEach(sheet => {
        try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
                Array.from(rules).forEach(rule => {
                    if (rule.selectorText && rule.style) {
                        allRules.push({
                            selector: rule.selectorText,
                            styles: rule.style,
                            sheet: sheet.href || 'inline'
                        });
                    }
                });
            }
        } catch (e) {
            // CORS or access issues
        }
    });
    
    // Find button-related rules
    const buttonRules = allRules.filter(rule => 
        rule.selector.includes('.btn') || 
        rule.selector.includes('button') ||
        rule.selector.includes('#preview-toggle') ||
        rule.selector.includes('#edit-toggle') ||
        rule.selector.includes('#log-toggle')
    );
    
    console.log(`Found ${buttonRules.length} button-related CSS rules`);
    
    // Check for conflicting rules
    const conflicts = [];
    buttonRules.forEach(rule => {
        if (rule.selector.includes(':hover')) {
            const baseSelector = rule.selector.replace(':hover', '');
            const conflictingRules = buttonRules.filter(r => 
                r.selector === baseSelector && 
                r.styles.borderColor && 
                r.styles.borderColor !== rule.styles.borderColor
            );
            
            if (conflictingRules.length > 0) {
                conflicts.push({
                    hoverRule: rule,
                    conflictingRules,
                    property: 'borderColor'
                });
            }
        }
    });
    
    if (conflicts.length > 0) {
        console.log(`\n⚠️ Found ${conflicts.length} CSS specificity conflicts`);
        conflicts.forEach((conflict, i) => {
            console.log(`${i + 1}. ${conflict.hoverRule.selector} conflicts with base styles`);
        });
    }
    
    return { buttonRules, conflicts };
}

// 4. Live Hover Testing
function createLiveHoverTest() {
    const testPanel = document.createElement('div');
    testPanel.id = 'hover-test-panel';
    testPanel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 300px;
        background: white;
        border: 2px solid #333;
        border-radius: 5px;
        padding: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: monospace;
        font-size: 12px;
    `;
    
    testPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Live Hover Test</div>
        <div id="hover-status">Hover over buttons to test...</div>
        <div style="margin: 10px 0;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="padding: 5px 10px; cursor: pointer;">Close</button>
        </div>
    `;
    
    document.body.appendChild(testPanel);
    
    // Add hover listeners to all buttons
    const buttons = document.querySelectorAll('button, .btn');
    const statusDiv = testPanel.querySelector('#hover-status');
    
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const computed = getComputedStyle(btn);
            const id = btn.id || btn.className || 'unnamed';
            statusDiv.innerHTML = `
                <div><strong>${id}</strong></div>
                <div>Border: ${computed.borderColor}</div>
                <div>Background: ${computed.backgroundColor}</div>
                <div>Classes: ${btn.className}</div>
            `;
        });
        
        btn.addEventListener('mouseleave', () => {
            statusDiv.textContent = 'Hover over buttons to test...';
        });
    });
    
    console.log('✅ Live hover test panel created');
}

// 5. Button Hover Fixes
function generateButtonFixes() {
    const buttons = window.buttonHoverDebugger.buttons;
    const fixes = [];
    
    buttons.forEach(btn => {
        btn.issues.forEach(issue => {
            switch (issue.type) {
                case 'ghost-border':
                    fixes.push({
                        selector: btn.id ? `#${btn.id}` : `.${btn.classes.join('.')}`,
                        property: 'border-color',
                        value: 'transparent',
                        reason: 'btn-ghost should have transparent border'
                    });
                    break;
                    
                case 'cursor':
                    fixes.push({
                        selector: btn.id ? `#${btn.id}` : `.${btn.classes.join('.')}`,
                        property: 'cursor',
                        value: 'pointer',
                        reason: 'Buttons should have pointer cursor'
                    });
                    break;
                    
                case 'missing-border':
                    fixes.push({
                        selector: btn.id ? `#${btn.id}` : `.${btn.classes.join('.')}`,
                        property: 'border',
                        value: '1px solid var(--color-border)',
                        reason: 'btn class should have border'
                    });
                    break;
            }
        });
    });
    
    window.buttonHoverDebugger.fixes = fixes;
    
    console.log(`\n🔧 Generated ${fixes.length} button fixes:`);
    fixes.forEach((fix, i) => {
        console.log(`${i + 1}. ${fix.selector} { ${fix.property}: ${fix.value}; } // ${fix.reason}`);
    });
    
    return fixes;
}

// 6. Apply Fixes
window.applyButtonFixes = function() {
    const fixes = window.buttonHoverDebugger.fixes;
    if (!fixes || fixes.length === 0) {
        console.log('No fixes available. Run analysis first.');
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'button-hover-fixes';
    
    let css = '/* Button Hover Fixes */\n';
    fixes.forEach(fix => {
        css += `${fix.selector} { ${fix.property}: ${fix.value} !important; }\n`;
    });
    
    // Add comprehensive hover fixes
    css += `
/* Comprehensive Button Hover System */
.btn {
    border: 1px solid var(--color-border) !important;
    cursor: pointer !important;
}

.btn-ghost {
    background-color: transparent !important;
    border-color: transparent !important;
}

.btn-ghost:hover {
    background-color: var(--color-bg-alt) !important;
    border-color: var(--color-border-hover) !important;
}

.btn:hover {
    transform: translateY(-1px);
}

.btn:active {
    transform: translateY(0);
}
`;
    
    style.textContent = css;
    document.head.appendChild(style);
    
    console.log('✅ Button fixes applied');
    console.log('💡 Refresh page to see if fixes persist');
};

// 7. Comprehensive Button Report
function generateButtonReport() {
    const buttons = analyzeAllButtons();
    const hoverTests = testHoverStates();
    const specificity = analyzeCSSSpecificity();
    const fixes = generateButtonFixes();
    
    const report = {
        summary: {
            totalButtons: buttons.length,
            buttonsWithIssues: buttons.filter(b => b.issues.length > 0).length,
            failedHoverTests: hoverTests.filter(t => t.issue).length,
            cssConflicts: specificity.conflicts.length,
            availableFixes: fixes.length
        },
        details: {
            buttons,
            hoverTests,
            specificity,
            fixes
        }
    };
    
    console.log('\n🖱️ BUTTON HOVER REPORT:');
    console.log('=======================');
    console.log('Summary:', report.summary);
    
    if (report.summary.buttonsWithIssues > 0) {
        console.log(`\n❌ ${report.summary.buttonsWithIssues} buttons have issues`);
    }
    
    if (report.summary.failedHoverTests > 0) {
        console.log(`❌ ${report.summary.failedHoverTests} buttons failed hover tests`);
    }
    
    if (report.summary.cssConflicts > 0) {
        console.log(`⚠️ ${report.summary.cssConflicts} CSS specificity conflicts`);
    }
    
    console.log(`\n✅ ${report.summary.availableFixes} fixes available`);
    
    return report;
}

// Auto-run analysis
console.log('\n🚀 Running button hover analysis...');
generateButtonReport();

console.log('\n💡 Available functions:');
console.log('- createLiveHoverTest() - Interactive hover testing');
console.log('- applyButtonFixes() - Apply all button fixes');
console.log('- generateButtonReport() - Re-run analysis');
console.log('- window.buttonHoverDebugger - Full analysis data');
