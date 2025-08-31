/**
 * Resizer Debugger - FIXED VERSION
 * Bulletproof version that ensures functions are always available
 */

console.log('📏 RESIZER DEBUGGER - FIXED VERSION');
console.log('=====================================');

// Force initialize APP.debug structure
(function() {
    if (typeof window === 'undefined') return;
    
    window.APP = window.APP || {};
    import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('debug', window.APP.debug || {});
    
    // Clear any existing broken resizer object
    if (window.APP.debug.resizer) {
        console.log('🔄 Clearing existing APP.debug.resizer');
        delete window.APP.debug.resizer;
    }
    
    // Create fresh resizer object
    window.APP.debug.resizer = {};
    console.log('✅ Fresh APP.debug.resizer created');
})();

// Store all analysis functions separately
const ResizerAnalysis = {
    
    // 1. DOM Element Analysis
    analyzeDOMElements() {
        console.log('\n1. RESIZER DOM ELEMENTS:');
        
        const resizerElements = {
            byClass: document.querySelectorAll('.resizer'),
            byDataAttribute: document.querySelectorAll('[data-resizer-for]'),
            byId: document.querySelectorAll('#resizer-left, #resizer-right, #workspace-resizer'),
            workspaceResizers: document.querySelectorAll('.workspace-resizer'),
            allPossible: document.querySelectorAll('[class*="resiz"], [id*="resiz"], [data-resizer]')
        };
        
        const analysis = {
            found: [],
            missing: [],
            broken: [],
            working: []
        };
        
        console.log('Resizer elements found:');
        Object.entries(resizerElements).forEach(([selector, elements]) => {
            console.log(`  ${selector}: ${elements.length} elements`);
            Array.from(elements).forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                const computed = getComputedStyle(el);
                
                const elementInfo = {
                    selector,
                    index: i,
                    element: el,
                    id: el.id || 'no-id',
                    classes: Array.from(el.classList),
                    visible: rect.width > 0 && rect.height > 0 && computed.display !== 'none',
                    cursor: computed.cursor,
                    width: rect.width,
                    height: rect.height,
                    position: computed.position
                };
                
                analysis.found.push(elementInfo);
                
                console.log(`    Element ${i}:`, {
                    id: elementInfo.id,
                    classes: elementInfo.classes.join(' '),
                    visible: elementInfo.visible,
                    cursor: elementInfo.cursor,
                    width: elementInfo.width,
                    height: elementInfo.height
                });
            });
        });
        
        // Check for expected resizers
        const expectedResizers = [
            { selector: '.resizer[data-resizer-for="sidebar"]', purpose: 'Sidebar resizer' },
            { selector: '.resizer[data-resizer-for="preview"]', purpose: 'Preview resizer' }
        ];
        
        expectedResizers.forEach(expected => {
            const found = document.querySelector(expected.selector);
            if (!found) {
                analysis.missing.push({
                    selector: expected.selector,
                    purpose: expected.purpose
                });
                console.log(`❌ Missing: ${expected.purpose}`);
            } else {
                console.log(`✅ Found: ${expected.purpose}`);
            }
        });
        
        return analysis;
    },
    
    // 2. CSS Analysis
    analyzeCSS() {
        console.log('\n2. RESIZER CSS ANALYSIS:');
        
        const cssAnalysis = {
            rules: [],
            variables: {},
            missing: []
        };
        
        // Find CSS rules related to resizers
        const stylesheets = Array.from(document.styleSheets);
        stylesheets.forEach((sheet, sheetIndex) => {
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (rules) {
                    Array.from(rules).forEach((rule) => {
                        if (rule.selectorText && rule.cssText) {
                            const isResizerRule = rule.selectorText.includes('resizer') ||
                                                rule.selectorText.includes('resize') ||
                                                rule.cssText.includes('cursor: col-resize') ||
                                                rule.cssText.includes('cursor: row-resize');
                            
                            if (isResizerRule) {
                                cssAnalysis.rules.push({
                                    sheet: sheet.href || `inline-${sheetIndex}`,
                                    selector: rule.selectorText,
                                    cssText: rule.cssText
                                });
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn(`Cannot access stylesheet ${sheetIndex}:`, e.message);
            }
        });
        
        console.log(`Found ${cssAnalysis.rules.length} resizer-related CSS rules`);
        
        return cssAnalysis;
    },
    
    // 3. JavaScript Analysis
    analyzeJavaScript() {
        console.log('\n3. RESIZER JAVASCRIPT ANALYSIS:');
        
        const jsAnalysis = {
            managers: [],
            reduxIntegration: false,
            issues: []
        };
        
        // Check for ResizableManager
        const managerPaths = [
            'window.APP.services.resizableManager',
            'window.resizableManager',
            'window.ResizableManager'
        ];
        
        managerPaths.forEach(path => {
            const manager = this.getNestedProperty(window, path);
            if (manager) {
                jsAnalysis.managers.push({
                    path,
                    manager,
                    initialized: manager.initialized || false
                });
                console.log(`✅ Found resizer manager at ${path}`);
            } else {
                console.log(`❌ No resizer manager at ${path}`);
            }
        });
        
        // Check Redux integration
        if (window.APP?.store) {
            const state = window.APP.store.getState();
            if (state.panelSizes) {
                jsAnalysis.reduxIntegration = true;
                console.log('✅ Redux panelSizes state found:', state.panelSizes);
            } else {
                console.log('❌ No panelSizes in Redux state');
                jsAnalysis.issues.push('panelSizes reducer not found in Redux store');
            }
        } else {
            console.log('❌ No Redux store available');
            jsAnalysis.issues.push('Redux store not available');
        }
        
        return jsAnalysis;
    },
    
    // Helper function
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    },
    
    // 4. Generate Report
    generateReport() {
        console.log('\n📋 GENERATING RESIZER REPORT...');
        
        const elements = this.analyzeDOMElements();
        const css = this.analyzeCSS();
        const javascript = this.analyzeJavaScript();
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                resizerElementsFound: elements.found.length,
                missingElements: elements.missing.length,
                cssRulesFound: css.rules.length,
                jsManagersFound: javascript.managers.length,
                reduxIntegrated: javascript.reduxIntegration
            },
            details: {
                elements,
                css,
                javascript
            },
            recommendations: []
        };
        
        // Generate recommendations
        if (elements.missing.length > 0) {
            report.recommendations.push({
                priority: 'HIGH',
                message: `${elements.missing.length} expected resizer elements are missing`,
                action: 'Add missing resizer elements to HTML'
            });
        }
        
        if (css.rules.length === 0) {
            report.recommendations.push({
                priority: 'HIGH',
                message: 'No resizer CSS rules found',
                action: 'Add resizer styles with cursor and background properties'
            });
        }
        
        if (javascript.managers.length === 0) {
            report.recommendations.push({
                priority: 'CRITICAL',
                message: 'No resizer manager found',
                action: 'Initialize ResizableManager and integrate with bootloader'
            });
        }
        
        console.log('\n📋 RESIZER SYSTEM REPORT:');
        console.log('=========================');
        console.log('Summary:', report.summary);
        
        if (report.recommendations.length > 0) {
            console.log('\n📋 Recommendations:');
            report.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. [${rec.priority}] ${rec.message}`);
                console.log(`   Action: ${rec.action}`);
            });
        }
        
        return report;
    },
    
    // 5. Apply Fixes
    applyFixes() {
        console.log('🔧 APPLYING RESIZER FIXES...');
        
        const fixes = [];
        
        // Fix 1: Add missing CSS
        const existingStyles = document.querySelector('#resizer-debug-styles');
        if (!existingStyles) {
            const style = document.createElement('style');
            style.id = 'resizer-debug-styles';
            style.textContent = `
/* Emergency Resizer Styles */
.resizer {
    background-color: #e5e5e5;
    cursor: col-resize;
    height: 100%;
    width: 3px;
    z-index: 100;
    transition: background-color 0.15s ease;
}

.resizer:hover {
    background-color: #0066cc;
}

.resizer[data-resizer-for="sidebar"] {
    cursor: ew-resize;
}

.resizer[data-resizer-for="preview"] {
    cursor: ew-resize;
}
            `;
            document.head.appendChild(style);
            fixes.push('Added emergency resizer CSS styles');
        }
        
        // Fix 2: Add missing DOM elements
        const sidebar = document.querySelector('#workspace-sidebar, .workspace-sidebar');
        const preview = document.querySelector('#workspace-preview, .workspace-preview');
        
        if (sidebar && !document.querySelector('.resizer[data-resizer-for="sidebar"]')) {
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            resizer.setAttribute('data-resizer-for', 'sidebar');
            sidebar.insertAdjacentElement('afterend', resizer);
            fixes.push('Added sidebar resizer element');
        }
        
        if (preview && !document.querySelector('.resizer[data-resizer-for="preview"]')) {
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            resizer.setAttribute('data-resizer-for', 'preview');
            preview.insertAdjacentElement('beforebegin', resizer);
            fixes.push('Added preview resizer element');
        }
        
        console.log(`✅ Applied ${fixes.length} fixes:`);
        fixes.forEach(fix => console.log(`  - ${fix}`));
        
        return fixes;
    },
    
    // 6. Visual Test
    testVisually() {
        console.log('👁️ VISUAL RESIZER TEST');
        
        const resizerElements = document.querySelectorAll('.resizer, [data-resizer-for]');
        
        resizerElements.forEach((element, i) => {
            element.style.backgroundColor = '#ff0000';
            element.style.opacity = '0.8';
            element.style.zIndex = '9999';
            element.style.minWidth = '3px';
            element.style.minHeight = '20px';
            
            console.log(`Resizer ${i} highlighted in red`);
        });
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            resizerElements.forEach(element => {
                element.style.backgroundColor = '';
                element.style.opacity = '';
                element.style.zIndex = '';
                element.style.minWidth = '';
                element.style.minHeight = '';
            });
            console.log('Visual test ended');
        }, 10000);
        
        return resizerElements.length;
    }
};

// NOW ASSIGN THE FUNCTIONS TO APP.debug.resizer - This happens LAST
console.log('\n🔧 Assigning functions to APP.debug.resizer...');

window.APP.debug.resizer.analyze = function() {
    const report = ResizerAnalysis.generateReport();
    window.APP.debug.resizer.report = report;
    window.APP.debug.resizer.elements = report.details.elements;
    window.APP.debug.resizer.css = report.details.css;
    window.APP.debug.resizer.javascript = report.details.javascript;
    return report;
};

window.APP.debug.resizer.fixIssues = function() {
    return ResizerAnalysis.applyFixes();
};

window.APP.debug.resizer.testVisually = function() {
    return ResizerAnalysis.testVisually();
};

// Verify functions are assigned
console.log('🔍 Verifying function assignments...');
const functionNames = ['analyze', 'fixIssues', 'testVisually'];
let allAssigned = true;

functionNames.forEach(name => {
    if (typeof window.APP.debug.resizer[name] === 'function') {
        console.log(`✅ ${name}() assigned successfully`);
    } else {
        console.log(`❌ ${name}() assignment failed`);
        allAssigned = false;
    }
});

if (allAssigned) {
    console.log('\n✅ ALL FUNCTIONS SUCCESSFULLY ASSIGNED!');
    console.log('\n🚀 Auto-running initial analysis...');
    
    // Auto-run analysis
    try {
        window.APP.debug.resizer.analyze();
        console.log('✅ Initial analysis completed');
    } catch (error) {
        console.error('❌ Initial analysis failed:', error);
    }
    
    console.log('\n💡 Available functions:');
    console.log('- APP.debug.resizer.analyze() - Run full analysis');
    console.log('- APP.debug.resizer.fixIssues() - Apply automatic fixes');
    console.log('- APP.debug.resizer.testVisually() - Highlight resizer elements');
    console.log('- APP.debug.resizer.report - Full analysis data');
    
} else {
    console.error('❌ FUNCTION ASSIGNMENT FAILED!');
    console.log('💡 Try refreshing the page and running the script again');
}
