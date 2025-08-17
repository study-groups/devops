/**
 * Resizer Debugger
 * Comprehensive analysis of resizer elements, functionality, and related DOM/CSS/JS
 */

console.log('📏 RESIZER DEBUGGER');
console.log('===================');

// Robust APP.debug initialization with error handling
function initializeResizerDebugger() {
    try {
        // Initialize APP.debug if it doesn't exist
        if (!window.APP) {
            window.APP = {};
            console.log('✅ Created window.APP');
        }
        
        if (!window.APP.debug) {
            window.APP.debug = {};
            console.log('✅ Created window.APP.debug');
        }

        // Initialize resizer debug namespace
        if (!window.APP.debug.resizer) {
            window.APP.debug.resizer = {
                elements: [],
                css: {},
                javascript: {},
                events: [],
                issues: [],
                recommendations: []
            };
            console.log('✅ Created window.APP.debug.resizer');
        } else {
            console.log('✅ window.APP.debug.resizer already exists');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize APP.debug.resizer:', error);
        console.log('💡 Try running: window.APP = {}; window.APP.debug = {}; manually first');
        return false;
    }
}

// Initialize with error handling
const initSuccess = initializeResizerDebugger();
if (!initSuccess) {
    console.error('❌ Resizer debugger initialization failed. Cannot continue.');
    throw new Error('APP.debug.resizer initialization failed');
}

// 1. DOM Element Analysis
function analyzeResizerElements() {
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
            const elementInfo = {
                selector,
                index: i,
                element: el,
                id: el.id || 'no-id',
                classes: Array.from(el.classList),
                dataAttributes: Array.from(el.attributes)
                    .filter(attr => attr.name.startsWith('data-'))
                    .map(attr => ({ name: attr.name, value: attr.value })),
                computed: getComputedStyle(el),
                rect: el.getBoundingClientRect(),
                parent: el.parentElement,
                siblings: Array.from(el.parentElement?.children || [])
            };
            
            // Check if element is functional
            const isVisible = elementInfo.computed.display !== 'none' && 
                             elementInfo.computed.visibility !== 'hidden' &&
                             elementInfo.rect.width > 0 && 
                             elementInfo.rect.height > 0;
            
            const hasCursor = elementInfo.computed.cursor === 'col-resize' || 
                             elementInfo.computed.cursor === 'row-resize' ||
                             elementInfo.computed.cursor === 'ew-resize' ||
                             elementInfo.computed.cursor === 'ns-resize';
            
            elementInfo.status = {
                visible: isVisible,
                hasCursor,
                positioned: elementInfo.computed.position !== 'static',
                hasWidth: elementInfo.rect.width > 0,
                hasHeight: elementInfo.rect.height > 0
            };
            
            analysis.found.push(elementInfo);
            
            console.log(`    Element ${i}:`, {
                id: elementInfo.id,
                classes: elementInfo.classes.join(' '),
                visible: isVisible,
                cursor: elementInfo.computed.cursor,
                width: elementInfo.rect.width,
                height: elementInfo.rect.height,
                position: elementInfo.computed.position
            });
        });
    });
    
    // Check for expected resizer locations
    const expectedResizers = [
        { selector: '.resizer[data-resizer-for="sidebar"]', purpose: 'Sidebar resizer' },
        { selector: '.resizer[data-resizer-for="preview"]', purpose: 'Preview resizer' },
        { selector: '#resizer-left', purpose: 'Left workspace resizer' },
        { selector: '#resizer-right', purpose: 'Right workspace resizer' }
    ];
    
    expectedResizers.forEach(expected => {
        const found = document.querySelector(expected.selector);
        if (!found) {
            analysis.missing.push({
                selector: expected.selector,
                purpose: expected.purpose,
                recommendation: `Add ${expected.purpose} element`
            });
            console.log(`❌ Missing: ${expected.purpose} (${expected.selector})`);
        } else {
            console.log(`✅ Found: ${expected.purpose}`);
        }
    });
    
    // Store analysis data without overwriting functions
    Object.assign(window.APP.debug.resizer, { elements: analysis });
    return analysis;
}

// 2. CSS Analysis
function analyzeResizerCSS() {
    console.log('\n2. RESIZER CSS ANALYSIS:');
    
    const cssAnalysis = {
        rules: [],
        variables: {},
        conflicts: [],
        missing: []
    };
    
    // Find CSS rules related to resizers
    const stylesheets = Array.from(document.styleSheets);
    stylesheets.forEach((sheet, sheetIndex) => {
        try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
                Array.from(rules).forEach((rule, ruleIndex) => {
                    if (rule.selectorText && rule.cssText) {
                        const isResizerRule = rule.selectorText.includes('resizer') ||
                                            rule.selectorText.includes('resize') ||
                                            rule.cssText.includes('cursor: col-resize') ||
                                            rule.cssText.includes('cursor: row-resize') ||
                                            rule.cssText.includes('cursor: ew-resize') ||
                                            rule.cssText.includes('cursor: ns-resize');
                        
                        if (isResizerRule) {
                            cssAnalysis.rules.push({
                                sheet: sheet.href || `inline-${sheetIndex}`,
                                selector: rule.selectorText,
                                cssText: rule.cssText,
                                properties: extractCSSProperties(rule.style)
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.warn(`Cannot access stylesheet ${sheetIndex}:`, e.message);
        }
    });
    
    console.log(`Found ${cssAnalysis.rules.length} resizer-related CSS rules:`);
    cssAnalysis.rules.forEach((rule, i) => {
        console.log(`  ${i + 1}. ${rule.selector} (${rule.sheet})`);
        console.log(`     Properties:`, rule.properties);
    });
    
    // Check for CSS variables
    const rootStyles = getComputedStyle(document.documentElement);
    const resizerVars = [
        '--resizer-width', '--resizer-height', '--resizer-color',
        '--resizer-hover-color', '--resizer-background'
    ];
    
    resizerVars.forEach(varName => {
        const value = rootStyles.getPropertyValue(varName);
        if (value) {
            cssAnalysis.variables[varName] = value.trim();
        }
    });
    
    console.log('CSS variables found:', cssAnalysis.variables);
    
    // Check for missing essential styles
    const essentialStyles = [
        { property: 'cursor', values: ['col-resize', 'row-resize', 'ew-resize', 'ns-resize'] },
        { property: 'width', values: ['3px', '4px', '5px'] },
        { property: 'height', values: ['100%', '100vh'] },
        { property: 'background-color', values: ['var(--border-color)', '#ccc', '#ddd'] }
    ];
    
    const hasEssentialStyles = essentialStyles.every(style => {
        return cssAnalysis.rules.some(rule => 
            rule.properties[style.property] && 
            style.values.some(value => rule.properties[style.property].includes(value))
        );
    });
    
    if (!hasEssentialStyles) {
        cssAnalysis.missing.push('Essential resizer styles missing');
    }
    
    // Store analysis data without overwriting functions
    Object.assign(window.APP.debug.resizer, { css: cssAnalysis });
    return cssAnalysis;
}

function extractCSSProperties(style) {
    const properties = {};
    for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        properties[prop] = style.getPropertyValue(prop);
    }
    return properties;
}

// 3. JavaScript Analysis
function analyzeResizerJavaScript() {
    console.log('\n3. RESIZER JAVASCRIPT ANALYSIS:');
    
    const jsAnalysis = {
        managers: [],
        eventListeners: [],
        reduxIntegration: false,
        bootloaderIntegration: false,
        issues: []
    };
    
    // Check for ResizableManager
    const resizerManagers = [
        'window.resizableManager',
        'window.ResizableManager',
        'window.APP.services.resizableManager'
    ];
    
    resizerManagers.forEach(path => {
        const manager = getNestedProperty(window, path);
        if (manager) {
            jsAnalysis.managers.push({
                path,
                manager,
                initialized: manager.initialized || false,
                methods: Object.getOwnPropertyNames(manager).filter(prop => 
                    typeof manager[prop] === 'function'
                )
            });
            console.log(`✅ Found resizer manager at ${path}`);
        } else {
            console.log(`❌ No resizer manager at ${path}`);
        }
    });
    
    // Check for event listeners on resizer elements
    const resizerElements = document.querySelectorAll('.resizer, [data-resizer-for], [class*="resiz"]');
    resizerElements.forEach((el, i) => {
        const listeners = getEventListeners(el);
        if (listeners && Object.keys(listeners).length > 0) {
            jsAnalysis.eventListeners.push({
                element: el,
                listeners: listeners
            });
            console.log(`Element ${i} has listeners:`, Object.keys(listeners));
        } else {
            console.log(`Element ${i} has no listeners`);
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
    
    // Check bootloader integration
    if (window.APP?.bootloader) {
        console.log('✅ Bootloader available');
        jsAnalysis.bootloaderIntegration = true;
    } else {
        console.log('❌ Bootloader not available');
        jsAnalysis.issues.push('Bootloader not available');
    }
    
    // Store analysis data without overwriting functions
    Object.assign(window.APP.debug.resizer, { javascript: jsAnalysis });
    return jsAnalysis;
}

function getNestedProperty(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

function getEventListeners(element) {
    // This is a simplified version - real implementation would need browser-specific code
    return element._eventListeners || {};
}

// 4. Workspace Layout Analysis
function analyzeWorkspaceLayout() {
    console.log('\n4. WORKSPACE LAYOUT ANALYSIS:');
    
    const layoutAnalysis = {
        containers: {},
        structure: {},
        issues: []
    };
    
    // Check main workspace containers
    const containers = {
        'workspace-container': document.querySelector('.workspace-container'),
        'workspace-sidebar': document.querySelector('.workspace-sidebar, #workspace-sidebar'),
        'workspace-editor': document.querySelector('.workspace-editor, #workspace-editor'),
        'workspace-preview': document.querySelector('.workspace-preview, #workspace-preview')
    };
    
    Object.entries(containers).forEach(([name, element]) => {
        if (element && element.nodeType === Node.ELEMENT_NODE) {
            const computed = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            layoutAnalysis.containers[name] = {
                element,
                computed: {
                    display: computed.display,
                    position: computed.position,
                    width: computed.width,
                    height: computed.height,
                    flexGrow: computed.flexGrow,
                    flexShrink: computed.flexShrink,
                    flexBasis: computed.flexBasis
                },
                rect: {
                    width: rect.width,
                    height: rect.height,
                    left: rect.left,
                    top: rect.top
                },
                children: element.children.length
            };
            
            console.log(`✅ ${name}:`, {
                display: computed.display,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                children: element.children.length
            });
        } else {
            console.log(`❌ ${name}: Not found`);
            layoutAnalysis.issues.push(`${name} container not found`);
        }
    });
    
    // Check if layout supports resizing
    const workspaceContainer = layoutAnalysis.containers['workspace-container'];
    if (workspaceContainer && workspaceContainer.element) {
        const computed = workspaceContainer.computed;
        const isFlexLayout = computed.display === 'flex';
        const isGridLayout = computed.display === 'grid';
        
        layoutAnalysis.structure = {
            isFlexLayout,
            isGridLayout,
            flexDirection: computed.flexDirection,
            gridTemplateColumns: computed.gridTemplateColumns,
            supportsResizing: isFlexLayout || isGridLayout
        };
        
        console.log('Layout structure:', layoutAnalysis.structure);
        
        if (!layoutAnalysis.structure.supportsResizing) {
            layoutAnalysis.issues.push('Workspace container does not use flex or grid layout');
        }
    } else {
        layoutAnalysis.issues.push('Workspace container not found');
        layoutAnalysis.structure = {
            isFlexLayout: false,
            isGridLayout: false,
            supportsResizing: false
        };
    }
    
    return layoutAnalysis;
}

// 5. Event System Analysis
function analyzeResizerEvents() {
    console.log('\n5. RESIZER EVENT SYSTEM:');
    
    const eventAnalysis = {
        mouseEvents: [],
        touchEvents: [],
        customEvents: [],
        issues: []
    };
    
    // Test mouse events on resizer elements
    const resizerElements = document.querySelectorAll('.resizer, [data-resizer-for]');
    
    resizerElements.forEach((element, i) => {
        const events = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'];
        
        events.forEach(eventType => {
            const hasListener = hasEventListener(element, eventType);
            if (hasListener) {
                eventAnalysis.mouseEvents.push({
                    element,
                    eventType,
                    index: i
                });
            }
        });
        
        // Test if element responds to mouse events
        const testEvent = new MouseEvent('mousedown', { bubbles: true });
        let responded = false;
        
        const testHandler = () => { responded = true; };
        element.addEventListener('mousedown', testHandler, { once: true });
        element.dispatchEvent(testEvent);
        element.removeEventListener('mousedown', testHandler);
        
        if (!responded) {
            eventAnalysis.issues.push(`Resizer element ${i} does not respond to mouse events`);
        }
    });
    
    console.log(`Found ${eventAnalysis.mouseEvents.length} mouse event listeners`);
    console.log(`Found ${eventAnalysis.issues.length} event issues`);
    
    return eventAnalysis;
}

function hasEventListener(element, eventType) {
    // Simplified check - in real implementation would need more sophisticated detection
    return element[`on${eventType}`] !== null || 
           element._eventListeners?.[eventType]?.length > 0;
}

// 6. Generate Comprehensive Report
function generateResizerReport() {
    console.log('\n📋 GENERATING COMPREHENSIVE RESIZER REPORT...');
    
    const elements = analyzeResizerElements();
    const css = analyzeResizerCSS();
    const javascript = analyzeResizerJavaScript();
    const layout = analyzeWorkspaceLayout();
    const events = analyzeResizerEvents();
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            resizerElementsFound: elements.found.length,
            missingElements: elements.missing.length,
            cssRulesFound: css.rules.length,
            jsManagersFound: javascript.managers.length,
            eventListenersFound: javascript.eventListeners.length,
            layoutIssues: layout.issues?.length || 0,
            totalIssues: elements.missing.length + 
                        javascript.issues.length + 
                        (layout.issues?.length || 0) + 
                        events.issues.length
        },
        status: {
            domElementsPresent: elements.found.length > 0,
            cssStylesPresent: css.rules.length > 0,
            javascriptManagerPresent: javascript.managers.length > 0,
            reduxIntegrated: javascript.reduxIntegration,
            bootloaderIntegrated: javascript.bootloaderIntegration,
            eventSystemWorking: events.issues.length === 0
        },
        recommendations: []
    };
    
    // Generate recommendations
    if (elements.missing.length > 0) {
        report.recommendations.push({
            priority: 'HIGH',
            category: 'DOM',
            message: `${elements.missing.length} expected resizer elements are missing`,
            action: 'Add missing resizer elements to HTML',
            details: elements.missing
        });
    }
    
    if (css.rules.length === 0) {
        report.recommendations.push({
            priority: 'HIGH',
            category: 'CSS',
            message: 'No resizer CSS rules found',
            action: 'Add resizer styles with cursor, width, and background properties'
        });
    }
    
    if (javascript.managers.length === 0) {
        report.recommendations.push({
            priority: 'CRITICAL',
            category: 'JavaScript',
            message: 'No resizer manager found',
            action: 'Initialize ResizableManager and integrate with bootloader'
        });
    }
    
    if (!javascript.reduxIntegration) {
        report.recommendations.push({
            priority: 'MEDIUM',
            category: 'Redux',
            message: 'No Redux integration for panel sizes',
            action: 'Add panelSizes reducer and connect to resizer manager'
        });
    }
    
    if (events.issues.length > 0) {
        report.recommendations.push({
            priority: 'HIGH',
            category: 'Events',
            message: `${events.issues.length} event system issues detected`,
            action: 'Fix event listeners on resizer elements',
            details: events.issues
        });
    }
    
    console.log('\n📋 RESIZER SYSTEM REPORT:');
    console.log('=========================');
    console.log('Summary:', report.summary);
    console.log('\nStatus Checks:');
    Object.entries(report.status).forEach(([key, value]) => {
        const status = value ? '✅' : '❌';
        console.log(`${status} ${key}: ${value}`);
    });
    
    if (report.recommendations.length > 0) {
        console.log('\n📋 Recommendations:');
        report.recommendations.forEach((rec, i) => {
            console.log(`${i + 1}. [${rec.priority}] ${rec.category}: ${rec.message}`);
            console.log(`   Action: ${rec.action}`);
            if (rec.details) {
                console.log(`   Details:`, rec.details);
            }
        });
    }
    
    // Store analysis data without overwriting functions
    Object.assign(window.APP.debug.resizer, { report: report });
    return report;
}

// 7. Quick Fixes
window.APP.debug.resizer.fixIssues = function() {
    console.log('🔧 APPLYING RESIZER FIXES...');
    
    const fixes = [];
    
    // Fix 1: Add missing CSS if not present
    const existingStyles = document.querySelector('#resizer-debug-styles');
    if (!existingStyles && window.APP.debug.resizer.css?.rules.length === 0) {
        const style = document.createElement('style');
        style.id = 'resizer-debug-styles';
        style.textContent = `
/* Resizer Debug Styles */
.resizer {
    background-color: var(--border-color, #e5e5e5);
    cursor: col-resize;
    height: 100%;
    width: 3px;
    z-index: 100;
    transition: background-color 0.15s ease;
}

.resizer:hover {
    background-color: var(--accent-color, #0066cc);
}

.resizer[data-resizer-for="sidebar"] {
    cursor: ew-resize;
}

.resizer[data-resizer-for="preview"] {
    cursor: ew-resize;
}
        `;
        document.head.appendChild(style);
        fixes.push('Added missing resizer CSS styles');
    }
    
    // Fix 2: Initialize resizer manager if missing
    if (window.APP.debug.resizer.javascript?.managers.length === 0) {
        // Try to initialize if the module exists
        if (window.initializeResizableManager) {
            try {
                window.initializeResizableManager();
                fixes.push('Initialized ResizableManager');
            } catch (e) {
                fixes.push(`Failed to initialize ResizableManager: ${e.message}`);
            }
        } else {
            fixes.push('ResizableManager module not found - needs to be loaded');
        }
    }
    
    // Fix 3: Add missing DOM elements
    const missingElements = window.APP.debug.resizer.elements?.missing || [];
    missingElements.forEach(missing => {
        if (missing.selector === '.resizer[data-resizer-for="sidebar"]') {
            const sidebar = document.querySelector('#workspace-sidebar, .workspace-sidebar');
            if (sidebar && !document.querySelector('.resizer[data-resizer-for="sidebar"]')) {
                const resizer = document.createElement('div');
                resizer.className = 'resizer';
                resizer.setAttribute('data-resizer-for', 'sidebar');
                sidebar.insertAdjacentElement('afterend', resizer);
                fixes.push('Added sidebar resizer element');
            }
        }
        
        if (missing.selector === '.resizer[data-resizer-for="preview"]') {
            const preview = document.querySelector('#workspace-preview, .workspace-preview');
            if (preview && !document.querySelector('.resizer[data-resizer-for="preview"]')) {
                const resizer = document.createElement('div');
                resizer.className = 'resizer';
                resizer.setAttribute('data-resizer-for', 'preview');
                preview.insertAdjacentElement('beforebegin', resizer);
                fixes.push('Added preview resizer element');
            }
        }
    });
    
    console.log(`✅ Applied ${fixes.length} fixes:`);
    fixes.forEach(fix => console.log(`  - ${fix}`));
    
    // Re-run analysis to check improvements
    setTimeout(() => {
        console.log('\n🔄 Re-analyzing after fixes...');
        window.APP.debug.resizer.analyze();
    }, 1000);
};

// 8. Visual Resizer Test
window.APP.debug.resizer.testVisually = function() {
    console.log('👁️ VISUAL RESIZER TEST');
    
    // Add visual indicators to all resizer elements
    const resizerElements = document.querySelectorAll('.resizer, [data-resizer-for]');
    
    resizerElements.forEach((element, i) => {
        element.style.backgroundColor = '#ff0000';
        element.style.opacity = '0.7';
        element.style.zIndex = '9999';
        
        // Add hover effect
        element.addEventListener('mouseenter', () => {
            element.style.backgroundColor = '#00ff00';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.backgroundColor = '#ff0000';
        });
        
        console.log(`Resizer ${i} highlighted in red`);
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        resizerElements.forEach(element => {
            element.style.backgroundColor = '';
            element.style.opacity = '';
            element.style.zIndex = '';
        });
        console.log('Visual test ended');
    }, 10000);
};

// Expose main analysis function
window.APP.debug.resizer.analyze = generateResizerReport;

// Auto-run analysis
console.log('\n🚀 Running comprehensive resizer analysis...');
try {
    window.APP.debug.resizer.analyze();
    console.log('✅ Analysis completed successfully');
} catch (error) {
    console.error('❌ Analysis failed:', error);
}

// Verify all functions are available
console.log('\n🔍 Verifying APP.debug.resizer setup...');
const expectedFunctions = ['analyze', 'fixIssues', 'testVisually'];
const expectedProperties = ['report', 'elements', 'css', 'javascript'];

let allGood = true;
expectedFunctions.forEach(funcName => {
    if (typeof window.APP.debug.resizer[funcName] === 'function') {
        console.log(`✅ ${funcName}() function available`);
    } else {
        console.log(`❌ ${funcName}() function missing`);
        allGood = false;
    }
});

expectedProperties.forEach(propName => {
    if (window.APP.debug.resizer[propName] !== undefined) {
        console.log(`✅ ${propName} property available`);
    } else {
        console.log(`❌ ${propName} property missing`);
        allGood = false;
    }
});

if (allGood) {
    console.log('\n✅ APP.debug.resizer is fully initialized and ready!');
    console.log('\n💡 Available functions on APP.debug.resizer:');
    console.log('- APP.debug.resizer.fixIssues() - Apply automatic fixes');
    console.log('- APP.debug.resizer.testVisually() - Highlight resizer elements');
    console.log('- APP.debug.resizer.analyze() - Re-run analysis');
    console.log('- APP.debug.resizer.report - Full analysis data');
    console.log('- APP.debug.resizer.elements - DOM analysis');
    console.log('- APP.debug.resizer.css - CSS analysis');
    console.log('- APP.debug.resizer.javascript - JS analysis');
} else {
    console.error('❌ APP.debug.resizer setup incomplete. Some functions may not work.');
}
