/**
 * Log Alignment Debugger
 * Debug log display alignment issues and CSS problems
 */

console.log('📝 LOG ALIGNMENT DEBUGGER');
console.log('=========================');

// Ensure APP.debug exists
if (!window.APP) window.APP = {};
if (!window.APP.debug) window.APP.debug = {};

window.APP.debug.logAlignment = {
    report: {},

    // 1. Analyze Log Container Structure
    analyzeLogContainer() {
        console.log('\n1. LOG CONTAINER ANALYSIS:');
        
        const containers = {
            logContainer: document.getElementById('log-container'),
            logHeader: document.getElementById('log-column-header'),
            logList: document.getElementById('log'),
            logEntries: document.querySelectorAll('.log-entry')
        };

        const analysis = {
            containers: {},
            visibility: {},
            structure: {}
        };

        Object.entries(containers).forEach(([name, element]) => {
            if (element && (element.length === undefined || element.length > 0)) {
                const computed = element.length ? null : getComputedStyle(element);
                analysis.containers[name] = {
                    found: true,
                    element: element,
                    count: element.length || 1,
                    visible: element.length ? element.length > 0 : element.offsetParent !== null,
                    display: computed?.display,
                    visibility: computed?.visibility,
                    classes: element.length ? 'multiple' : element.className
                };
                console.log(`✅ ${name}:`, {
                    count: element.length || 1,
                    visible: analysis.containers[name].visible,
                    display: computed?.display,
                    classes: element.length ? `${element.length} entries` : element.className
                });
            } else {
                analysis.containers[name] = { found: false };
                console.error(`❌ ${name}: Not found`);
            }
        });

        return analysis;
    },

    // 2. Analyze Column Alignment
    analyzeColumnAlignment() {
        console.log('\n2. COLUMN ALIGNMENT ANALYSIS:');
        
        const header = document.getElementById('log-column-header');
        const entries = document.querySelectorAll('.log-entry');
        
        const analysis = {
            headerColumns: [],
            entryColumns: [],
            alignmentIssues: []
        };

        if (header) {
            const headerCols = header.querySelectorAll('[class*="log-header-"]');
            headerCols.forEach(col => {
                const computed = getComputedStyle(col);
                const columnData = {
                    className: col.className,
                    textAlign: computed.textAlign,
                    justifyContent: computed.justifyContent,
                    width: computed.width,
                    content: col.textContent.trim()
                };
                analysis.headerColumns.push(columnData);
                console.log(`Header ${col.className}:`, {
                    textAlign: columnData.textAlign,
                    justifyContent: columnData.justifyContent,
                    width: columnData.width,
                    content: columnData.content
                });
            });
        }

        // Analyze first few log entries
        Array.from(entries).slice(0, 3).forEach((entry, i) => {
            const entryCols = entry.querySelectorAll('[class*="log-entry-"]');
            const entryData = {
                index: i,
                columns: []
            };

            entryCols.forEach(col => {
                const computed = getComputedStyle(col);
                const columnData = {
                    className: col.className,
                    textAlign: computed.textAlign,
                    justifyContent: computed.justifyContent,
                    width: computed.width,
                    content: col.textContent.trim().substring(0, 20) + '...'
                };
                entryData.columns.push(columnData);
                console.log(`Entry ${i} ${col.className}:`, {
                    textAlign: columnData.textAlign,
                    width: columnData.width,
                    content: columnData.content
                });
            });

            analysis.entryColumns.push(entryData);
        });

        // Check for alignment mismatches
        analysis.headerColumns.forEach((headerCol, i) => {
            const headerAlign = headerCol.textAlign || headerCol.justifyContent;
            
            analysis.entryColumns.forEach(entry => {
                const entryCol = entry.columns[i];
                if (entryCol) {
                    const entryAlign = entryCol.textAlign || entryCol.justifyContent;
                    if (headerAlign !== entryAlign && 
                        !(headerAlign === 'flex-start' && entryAlign === 'left') &&
                        !(headerAlign === 'left' && entryAlign === 'flex-start')) {
                        analysis.alignmentIssues.push({
                            column: headerCol.className,
                            headerAlign,
                            entryAlign,
                            entry: entry.index
                        });
                    }
                }
            });
        });

        if (analysis.alignmentIssues.length > 0) {
            console.warn('⚠️ Alignment mismatches found:', analysis.alignmentIssues);
        } else {
            console.log('✅ No alignment mismatches detected');
        }

        return analysis;
    },

    // 3. Analyze CSS Rules
    analyzeCSSRules() {
        console.log('\n3. CSS RULES ANALYSIS:');
        
        const analysis = {
            logLayoutRules: [],
            logEntriesRules: [],
            alignmentRules: [],
            issues: []
        };

        const stylesheets = Array.from(document.styleSheets);
        
        stylesheets.forEach((sheet, sheetIndex) => {
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (rules) {
                    Array.from(rules).forEach(rule => {
                        if (rule.selectorText && rule.cssText) {
                            const selector = rule.selectorText;
                            const cssText = rule.cssText;
                            
                            // Check for log-related rules
                            if (selector.includes('log-entry') || selector.includes('log-header')) {
                                const ruleData = {
                                    sheet: sheet.href ? sheet.href.split('/').pop() : `inline-${sheetIndex}`,
                                    selector,
                                    textAlign: this.extractCSSProperty(cssText, 'text-align'),
                                    justifyContent: this.extractCSSProperty(cssText, 'justify-content'),
                                    cssText: cssText.length > 200 ? cssText.substring(0, 200) + '...' : cssText
                                };

                                if (selector.includes('log-entry')) {
                                    analysis.logEntriesRules.push(ruleData);
                                } else if (selector.includes('log-header')) {
                                    analysis.logLayoutRules.push(ruleData);
                                }

                                // Check for alignment properties
                                if (ruleData.textAlign || ruleData.justifyContent) {
                                    analysis.alignmentRules.push(ruleData);
                                }

                                console.log(`Found rule: ${selector}`, {
                                    textAlign: ruleData.textAlign,
                                    justifyContent: ruleData.justifyContent,
                                    sheet: ruleData.sheet
                                });
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn(`Cannot access stylesheet ${sheetIndex}:`, e.message);
            }
        });

        console.log(`Found ${analysis.logLayoutRules.length} log layout rules`);
        console.log(`Found ${analysis.logEntriesRules.length} log entry rules`);
        console.log(`Found ${analysis.alignmentRules.length} alignment rules`);

        return analysis;
    },

    // Helper to extract CSS property from cssText
    extractCSSProperty(cssText, property) {
        const regex = new RegExp(`${property}:\\s*([^;]+)`, 'i');
        const match = cssText.match(regex);
        return match ? match[1].trim() : null;
    },

    // 4. Test Current Alignment
    testCurrentAlignment() {
        console.log('\n4. CURRENT ALIGNMENT TEST:');
        
        const testResults = {
            headerAlignment: {},
            entryAlignment: {},
            consistency: true
        };

        // Test header alignment
        const header = document.getElementById('log-column-header');
        if (header) {
            const headerCols = header.querySelectorAll('[class*="log-header-"]');
            headerCols.forEach(col => {
                const computed = getComputedStyle(col);
                const colName = col.className.replace('log-header-', '');
                testResults.headerAlignment[colName] = {
                    textAlign: computed.textAlign,
                    justifyContent: computed.justifyContent,
                    element: col
                };
            });
        }

        // Test entry alignment
        const firstEntry = document.querySelector('.log-entry');
        if (firstEntry) {
            const entryCols = firstEntry.querySelectorAll('[class*="log-entry-"]');
            entryCols.forEach(col => {
                const computed = getComputedStyle(col);
                const colName = col.className.replace('log-entry-', '');
                testResults.entryAlignment[colName] = {
                    textAlign: computed.textAlign,
                    justifyContent: computed.justifyContent,
                    element: col
                };
            });
        }

        // Check consistency
        Object.keys(testResults.headerAlignment).forEach(colName => {
            const headerAlign = testResults.headerAlignment[colName];
            const entryAlign = testResults.entryAlignment[colName];
            
            if (entryAlign) {
                const headerValue = headerAlign.textAlign || headerAlign.justifyContent;
                const entryValue = entryAlign.textAlign || entryAlign.justifyContent;
                
                if (headerValue !== entryValue && 
                    !(headerValue === 'flex-start' && entryValue === 'left') &&
                    !(headerValue === 'left' && entryValue === 'flex-start')) {
                    testResults.consistency = false;
                    console.warn(`❌ ${colName}: Header(${headerValue}) != Entry(${entryValue})`);
                } else {
                    console.log(`✅ ${colName}: Aligned (${entryValue})`);
                }
            }
        });

        return testResults;
    },

    // 5. Analyze Column Widths (NEW - Root Cause Analysis)
    analyzeColumnWidths() {
        console.log('\n5. COLUMN WIDTH ANALYSIS:');
        
        const analysis = {
            cssVariables: {},
            actualWidths: {},
            issues: []
        };

        // Check CSS variables for column widths
        const root = getComputedStyle(document.documentElement);
        const columnVars = [
            '--log-column-width-timestamp',
            '--log-column-width-level', 
            '--log-column-width-type',
            '--log-column-width-module',
            '--log-column-width-action',
            '--log-column-width-from'
        ];

        columnVars.forEach(varName => {
            const value = root.getPropertyValue(varName);
            if (value) {
                analysis.cssVariables[varName] = value.trim();
                console.log(`${varName}: ${value.trim()}`);
            } else {
                console.log(`${varName}: NOT SET`);
            }
        });

        // Check actual rendered widths
        const header = document.getElementById('log-column-header');
        if (header) {
            const headerCols = header.querySelectorAll('[class*="log-header-"]');
            headerCols.forEach(col => {
                const rect = col.getBoundingClientRect();
                const computed = getComputedStyle(col);
                const colName = col.className.replace('log-header-', '');
                
                analysis.actualWidths[colName] = {
                    rendered: `${rect.width}px`,
                    computed: computed.width,
                    flexBasis: computed.flexBasis,
                    flexGrow: computed.flexGrow,
                    flexShrink: computed.flexShrink,
                    content: col.textContent.trim()
                };

                console.log(`${colName} column:`, {
                    rendered: `${rect.width}px`,
                    computed: computed.width,
                    flexBasis: computed.flexBasis,
                    content: col.textContent.trim()
                });

                // Check if timestamp column is too wide
                if (colName === 'timestamp' && rect.width > 80) {
                    analysis.issues.push({
                        type: 'timestamp-too-wide',
                        current: `${rect.width}px`,
                        recommended: '70px',
                        impact: 'Pushes other columns to the right'
                    });
                }
            });
        }

        // Check first log entry widths
        const firstEntry = document.querySelector('.log-entry');
        if (firstEntry) {
            console.log('\nFirst entry column widths:');
            const entryCols = firstEntry.querySelectorAll('[class*="log-entry-"]');
            entryCols.forEach(col => {
                const rect = col.getBoundingClientRect();
                const colName = col.className.replace('log-entry-', '');
                console.log(`${colName}: ${rect.width}px (content: "${col.textContent.trim().substring(0, 15)}...")`);
            });
        }

        return analysis;
    },

    // 6. Apply Column Width Fix (UPDATED)
    applyColumnWidthFix() {
        console.log('\n6. APPLYING COLUMN WIDTH FIX:');
        
        const fixes = [];
        
        // Remove existing fix
        const existingFix = document.getElementById('log-alignment-fix');
        if (existingFix) {
            existingFix.remove();
            fixes.push('Removed existing alignment fix');
        }

        // Create comprehensive width and alignment fix
        const style = document.createElement('style');
        style.id = 'log-alignment-fix';
        style.textContent = `
/* Log Column Width & Alignment Fix */

/* Fix column widths - prevent timestamp from being too wide */
.log-header-timestamp, .log-entry-timestamp {
    width: 70px !important;
    max-width: 70px !important;
    flex-basis: 70px !important;
    flex-shrink: 0 !important;
    text-align: left !important;
}

.log-header-level, .log-entry-level {
    width: 50px !important;
    max-width: 50px !important;
    flex-basis: 50px !important;
    flex-shrink: 0 !important;
    text-align: left !important;
}

.log-header-type, .log-entry-type {
    width: 100px !important;
    max-width: 100px !important;
    flex-basis: 100px !important;
    flex-shrink: 0 !important;
    text-align: left !important;
}

.log-header-module, .log-entry-module {
    width: 80px !important;
    max-width: 80px !important;
    flex-basis: 80px !important;
    flex-shrink: 0 !important;
    text-align: left !important;
}

.log-header-action, .log-entry-action {
    width: 120px !important;
    max-width: 120px !important;
    flex-basis: 120px !important;
    flex-shrink: 0 !important;
    text-align: left !important;
}

.log-header-from, .log-entry-from {
    width: 80px !important;
    max-width: 80px !important;
    flex-basis: 80px !important;
    flex-shrink: 0 !important;
    text-align: left !important;
}

/* Message column grows to fill remaining space */
.log-header-message, .log-entry-message {
    flex-grow: 1 !important;
    flex-shrink: 1 !important;
    text-align: left !important;
    min-width: 0 !important;
}

/* Force all columns to left align */
.log-header-timestamp,
.log-header-level,
.log-header-type,
.log-header-module,
.log-header-action,
.log-header-from,
.log-header-message {
    justify-content: flex-start !important;
    text-align: left !important;
}

.log-entry-timestamp,
.log-entry-level,
.log-entry-type,
.log-entry-module,
.log-entry-action,
.log-entry-from,
.log-entry-message {
    text-align: left !important;
    justify-content: flex-start !important;
}

/* Override CSS variables */
:root {
    --log-column-width-timestamp: 70px !important;
    --log-column-width-level: 50px !important;
    --log-column-width-type: 100px !important;
    --log-column-width-module: 80px !important;
    --log-column-width-action: 120px !important;
    --log-column-width-from: 80px !important;
}
        `;
        
        document.head.appendChild(style);
        fixes.push('Applied column width and alignment fix');

        console.log(`✅ Applied ${fixes.length} fixes:`);
        fixes.forEach(fix => console.log(`  - ${fix}`));

        // Test the fix
        setTimeout(() => {
            console.log('\n🧪 Testing width fix...');
            this.analyzeColumnWidths();
        }, 100);

        return fixes;
    },

    // 6. Add Debug Borders (NEW)
    addDebugBorders() {
        console.log('\n6. ADDING DEBUG BORDERS:');
        
        // Remove existing borders
        const existingBorders = document.getElementById('log-debug-borders');
        if (existingBorders) {
            existingBorders.remove();
        }

        // Create border styles
        const style = document.createElement('style');
        style.id = 'log-debug-borders';
        style.textContent = `
/* DEBUG BORDERS - See exact column boundaries */

/* Header columns - different colored borders */
.log-header-timestamp { border: 2px solid red !important; background: rgba(255,0,0,0.1) !important; }
.log-header-level { border: 2px solid blue !important; background: rgba(0,0,255,0.1) !important; }
.log-header-type { border: 2px solid green !important; background: rgba(0,255,0,0.1) !important; }
.log-header-module { border: 2px solid orange !important; background: rgba(255,165,0,0.1) !important; }
.log-header-action { border: 2px solid purple !important; background: rgba(128,0,128,0.1) !important; }
.log-header-from { border: 2px solid cyan !important; background: rgba(0,255,255,0.1) !important; }
.log-header-message { border: 2px solid magenta !important; background: rgba(255,0,255,0.1) !important; }

/* Entry columns - matching colors but dashed borders */
.log-entry-timestamp { border: 2px dashed red !important; }
.log-entry-level { border: 2px dashed blue !important; }
.log-entry-type { border: 2px dashed green !important; }
.log-entry-module { border: 2px dashed orange !important; }
.log-entry-action { border: 2px dashed purple !important; }
.log-entry-from { border: 2px dashed cyan !important; }
.log-entry-message { border: 2px dashed magenta !important; }

/* Make sure borders don't affect layout */
.log-entry > *, #log-column-header > * {
    box-sizing: border-box !important;
}

/* Resizer elements - make them visible */
.resizer {
    background: yellow !important;
    border: 2px solid black !important;
    opacity: 0.8 !important;
    z-index: 1000 !important;
}

/* Show column boundaries clearly */
#log-column-header {
    border: 3px solid black !important;
    background: rgba(0,0,0,0.1) !important;
}

.log-entry {
    border-bottom: 1px solid #ccc !important;
}
        `;
        
        document.head.appendChild(style);
        console.log('✅ Debug borders added - each column has different colored borders');
        console.log('Colors: Timestamp=RED, Level=BLUE, Type=GREEN, Module=ORANGE, Action=PURPLE, From=CYAN, Message=MAGENTA');
        console.log('Headers=solid borders, Entries=dashed borders, Resizers=YELLOW with black borders');

        // Auto-remove after 30 seconds
        setTimeout(() => {
            style.remove();
            console.log('Debug borders auto-removed');
        }, 30000);

        return style;
    },

    // 7. Visual Test (UPDATED)
    visualTest() {
        console.log('\n7. VISUAL ALIGNMENT TEST:');
        
        // Add debug borders first
        this.addDebugBorders();
        
        // Add visual indicators to show alignment
        const testOverlay = document.createElement('div');
        testOverlay.id = 'log-alignment-test-overlay';
        testOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999998;
        `;

        // Add grid lines to show alignment
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            const rect = logContainer.getBoundingClientRect();
            
            // Add vertical line at left edge
            const leftLine = document.createElement('div');
            leftLine.style.cssText = `
                position: absolute;
                left: ${rect.left + 10}px;
                top: ${rect.top}px;
                width: 2px;
                height: ${rect.height}px;
                background: red;
                opacity: 0.7;
            `;
            testOverlay.appendChild(leftLine);

            // Add column boundary lines
            const header = document.getElementById('log-column-header');
            if (header) {
                const headerCols = header.querySelectorAll('[class*="log-header-"]');
                let currentLeft = rect.left;
                
                headerCols.forEach((col, i) => {
                    const colRect = col.getBoundingClientRect();
                    
                    // Add vertical line at right edge of each column
                    const colLine = document.createElement('div');
                    colLine.style.cssText = `
                        position: absolute;
                        left: ${colRect.right}px;
                        top: ${rect.top}px;
                        width: 1px;
                        height: ${rect.height}px;
                        background: black;
                        opacity: 0.5;
                    `;
                    testOverlay.appendChild(colLine);
                    
                    // Add column width label
                    const label = document.createElement('div');
                    label.style.cssText = `
                        position: absolute;
                        left: ${colRect.left + 5}px;
                        top: ${rect.top + 5}px;
                        background: white;
                        border: 1px solid black;
                        padding: 2px;
                        font-size: 10px;
                        font-weight: bold;
                        z-index: 999999;
                    `;
                    label.textContent = `${Math.round(colRect.width)}px`;
                    testOverlay.appendChild(label);
                });
            }
        }

        document.body.appendChild(testOverlay);
        console.log('✅ Visual test overlay added with column boundaries and width labels');

        // Auto-remove after 30 seconds
        setTimeout(() => {
            testOverlay.remove();
            console.log('Visual test overlay removed');
        }, 30000);

        return testOverlay;
    },

    // 7. Generate Report
    analyze() {
        console.log('\nRUNNING FULL LOG ALIGNMENT ANALYSIS...');
        console.log('=====================================');
        
        this.report = {
            container: this.analyzeLogContainer(),
            alignment: this.analyzeColumnAlignment(),
            css: this.analyzeCSSRules(),
            currentTest: this.testCurrentAlignment(),
            columnWidths: this.analyzeColumnWidths(),
            timestamp: new Date().toISOString()
        };

        const summary = {
            containerFound: this.report.container.containers.logContainer?.found || false,
            entriesFound: this.report.container.containers.logEntries?.count || 0,
            alignmentIssues: this.report.alignment.alignmentIssues?.length || 0,
            cssRulesFound: this.report.css.alignmentRules?.length || 0,
            alignmentConsistent: this.report.currentTest.consistency
        };

        console.log('\n📊 ALIGNMENT ANALYSIS SUMMARY:');
        console.log('==============================');
        console.log(`Container found: ${summary.containerFound ? '✅' : '❌'}`);
        console.log(`Log entries: ${summary.entriesFound}`);
        console.log(`Alignment issues: ${summary.alignmentIssues}`);
        console.log(`CSS alignment rules: ${summary.cssRulesFound}`);
        console.log(`Alignment consistent: ${summary.alignmentConsistent ? '✅' : '❌'}`);

        if (summary.alignmentIssues > 0) {
            console.log('\n⚠️ ISSUES DETECTED:');
            this.report.alignment.alignmentIssues.forEach((issue, i) => {
                console.log(`${i + 1}. ${issue.column}: Header(${issue.headerAlign}) != Entry(${issue.entryAlign})`);
            });
            console.log('\n💡 Run APP.debug.logAlignment.applyLeftAlignmentFix() to fix');
        }

        if (!summary.alignmentConsistent) {
            console.log('\n💡 RECOMMENDATIONS:');
            console.log('- Run applyLeftAlignmentFix() to force left alignment');
            console.log('- Check CSS files for conflicting alignment rules');
            console.log('- Use visualTest() to see alignment visually');
        }

        console.log('\n✅ Analysis complete. Full report in APP.debug.logAlignment.report');
        return this.report;
    },

    // Test functions
    test: {
        addTestEntry() {
            console.log('🧪 Adding test log entry...');
            const logDisplay = window.APP?.services?.logDisplay;
            if (logDisplay && typeof logDisplay.addEntry === 'function') {
                logDisplay.addEntry({
                    message: 'Test alignment entry with long text to see how it aligns in the column',
                    level: 'DEBUG',
                    type: 'ALIGNMENT_TEST',
                    module: 'DEBUGGER',
                    source: 'Console',
                    action: 'testAlignment',
                    timestamp: Date.now()
                });
                console.log('✅ Test entry added');
            } else {
                console.error('❌ LogDisplay not available');
            }
        },

        toggleAlignment() {
            console.log('🧪 Toggling between left and center alignment...');
            const existingFix = document.getElementById('log-alignment-fix');
            
            if (existingFix) {
                existingFix.remove();
                console.log('✅ Removed left alignment fix');
            } else {
                window.APP.debug.logAlignment.applyLeftAlignmentFix();
                console.log('✅ Applied left alignment fix');
            }
        }
    }
};

console.log('✅ Log Alignment Debugger Loaded');
console.log('Available commands:');
console.log('  APP.debug.logAlignment.analyze() - Run full analysis');
console.log('  APP.debug.logAlignment.analyzeColumnWidths() - Check column widths');
console.log('  APP.debug.logAlignment.applyColumnWidthFix() - Fix column widths & alignment');
console.log('  APP.debug.logAlignment.addDebugBorders() - Add colored borders to see columns');
console.log('  APP.debug.logAlignment.visualTest() - Visual test with borders and measurements');
console.log('  APP.debug.logAlignment.test.addTestEntry() - Add test entry');
console.log('  APP.debug.logAlignment.test.toggleAlignment() - Toggle alignment');

// Auto-run analysis
setTimeout(() => APP.debug.logAlignment.analyze(), 500);
