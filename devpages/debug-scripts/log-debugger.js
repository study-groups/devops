/**
 * Log Panel Debugger
 * Comprehensive debugging for the log panel, including state, DOM, and functionality.
 */

console.log('🪵 LOG PANEL DEBUGGER');
console.log('======================');

// Ensure APP.debug exists
if (!window.APP) import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP assignment
// window.APP = {};
if (!window.APP.debug) import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('debug', {});

window.APP.debug.log = {
    report: {},

    // 1. Analyze Redux State for Logs
    analyzeReduxState() {
        console.log('\n1. REDUX LOG STATE:');
        const state = window.APP?.store?.getState();
        if (!state) {
            console.error('❌ Redux store not found.');
            return null;
        }

        const logState = state.log;
        if (!logState) {
            console.error('❌ `log` slice not found in Redux state.');
            return null;
        }

        const analysis = {
            totalEntries: logState.entries.length,
            activeFilters: logState.activeFilters,
            levels: [...new Set(logState.entries.map(e => e.level))],
            types: [...new Set(logState.entries.map(e => e.type))],
            modules: [...new Set(logState.entries.map(e => e.module))],
        };

        console.log('Log State Analysis:', analysis);
        console.log('Full Log State:', logState);
        return analysis;
    },

    // 2. Analyze DOM Elements
    analyzeDOMElements() {
        console.log('\n2. LOG PANEL DOM ELEMENTS:');
        const elements = {
            container: document.getElementById('log-container'),
            header: document.getElementById('log-column-header'),
            logList: document.getElementById('log-list'),
            entries: document.querySelectorAll('.log-entry'),
            resizers: document.querySelectorAll('#log-column-header .resizer'),
        };

        const analysis = {};

        for (const [name, el] of Object.entries(elements)) {
            if (el && (el.length === undefined || el.length > 0)) {
                console.log(`✅ Found ${name}:`, el);
                analysis[name] = {
                    found: true,
                    element: el,
                    count: el.length,
                    visible: el.offsetParent !== null,
                };
            } else {
                console.error(`❌ Missing ${name}`);
                analysis[name] = { found: false };
            }
        }
        
        return analysis;
    },

    // 3. Analyze Column Resizing
    analyzeColumnResizing() {
        console.log('\n3. COLUMN RESIZER ANALYSIS:');
        const state = window.APP?.store?.getState();
        if (!state) {
            console.error('❌ Redux store not found.');
            return null;
        }

        const reduxWidths = state.ui?.logColumnWidths || {};
        console.log('Redux Column Widths:', reduxWidths);

        const cssWidths = {};
        const header = document.getElementById('log-column-header');
        if (header) {
            const columns = header.querySelectorAll('[class^="log-header-"]');
            columns.forEach(col => {
                const className = col.classList[0];
                const columnKey = className.replace('log-header-', '');
                const cssVar = `--log-column-width-${columnKey}`;
                const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
                if (value) {
                    cssWidths[columnKey] = value.trim();
                }
            });
        }
        console.log('CSS Variable Widths:', cssWidths);

        const issues = [];
        for (const key in reduxWidths) {
            if (reduxWidths[key] !== cssWidths[key]) {
                issues.push(`Mismatch for column '${key}': Redux is ${reduxWidths[key]}, CSS is ${cssWidths[key]}`);
            }
        }

        if(issues.length > 0) {
            console.warn('⚠️ Found width mismatches:', issues);
        } else {
            console.log('✅ Redux and CSS widths are in sync.');
        }
        
        return { reduxWidths, cssWidths, issues };
    },

    // 4. Test Functionality
    test: {
        addTestEntry() {
            console.log('🧪 Adding a test log entry...');
            const logDisplay = window.APP?.services?.logDisplay;
            if (logDisplay && typeof logDisplay.addEntry === 'function') {
                logDisplay.addEntry({
                    message: 'This is a test log entry from the debugger.',
                    level: 'DEBUG',
                    type: 'TEST',
                    module: 'DEBUGGER',
                    source: 'Console',
                    action: 'addTestEntry'
                });
                console.log('✅ Test entry dispatched.');
            } else {
                console.error('❌ `logDisplay.addEntry` not available.');
            }
        },

        toggleFilter(type = 'SYSTEM') {
            console.log(`🧪 Toggling filter for type: ${type}`);
            const store = window.APP?.store;
            if (store) {
                 import('/client/store/slices/logSlice.js').then(({ logActions }) => {
                    store.dispatch(logActions.toggleFilter(type));
                    console.log(`✅ Dispatched toggleFilter for '${type}'.`);
                 });
            } else {
                console.error('❌ Redux store not available.');
            }
        },
        
        resetColumns() {
            console.log('🧪 Resetting column widths in Redux...');
            const store = window.APP?.store;
            if (store) {
                import('/client/store/uiSlice.js').then(({ uiActions }) => {
                    const columns = ['timestamp', 'level', 'type', 'module', 'from', 'action', 'message'];
                    columns.forEach(column => {
                         store.dispatch(uiActions.setLogColumnWidth({ column, width: null }));
                    });
                    console.log('✅ Dispatched actions to reset column widths.');
                });
            } else {
                console.error('❌ Redux store not available.');
            }
        }
    },

    // Run all analysis
    analyze() {
        console.log('RUNNING FULL LOG PANEL ANALYSIS...');
        console.log('=================================');
        this.report = {
            redux: this.analyzeReduxState(),
            dom: this.analyzeDOMElements(),
            resizing: this.analyzeColumnResizing(),
        };
        console.log('\n✅ Analysis Complete. Full report in `APP.debug.log.report`');
        return this.report;
    }
};

console.log('✅ Log Debugger Loaded.');
console.log('Available commands:');
console.log('  APP.debug.log.analyze() - Run all checks.');
console.log('  APP.debug.log.test.addTestEntry() - Add a sample log.');
console.log('  APP.debug.log.test.toggleFilter("TYPE") - Toggle a log type filter.');
console.log('  APP.debug.log.test.resetColumns() - Reset column widths.');

// Auto-run analysis
setTimeout(() => APP.debug.log.analyze(), 500);
