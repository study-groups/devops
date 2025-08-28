/**
 * @file log-panel-debugger.js
 * @description Debug script to diagnose issues with the log panel's visibility.
 *
 * Usage: Copy and paste the contents of this file into the browser's developer console.
 */

(function() {
    console.log('🩺 RUNNING LOG PANEL DEBUGGER...');

    const APP = window.APP;
    const manager = APP?.workspace?.manager;
    const store = APP?.store;

    const results = {
        redux: {
            logVisible: null,
            error: null
        },
        dom: {
            element: null,
            exists: false,
            displayStyle: null,
            parentDisplayStyle: null,
            error: null
        },
        workspaceManager: {
            hasLogContainerRef: false,
            error: null
        }
    };

    // 1. Check Redux State
    try {
        if (store) {
            const state = store.getState();
            results.redux.logVisible = state?.ui?.logVisible;
        } else {
            throw new Error('window.APP.store not found.');
        }
    } catch (e) {
        results.redux.error = e.message;
    }

    // 2. Inspect DOM Element
    try {
        const logElement = document.getElementById('log-container');
        results.dom.element = logElement;
        results.dom.exists = !!logElement;

        if (logElement) {
            results.dom.displayStyle = window.getComputedStyle(logElement).display;
            if (logElement.parentElement) {
                 results.dom.parentDisplayStyle = window.getComputedStyle(logElement.parentElement).display;
            }
        }
    } catch (e) {
        results.dom.error = e.message;
    }

    // 3. Check SingleWorkspaceManager's State
    try {
        if (manager) {
            results.workspaceManager.hasLogContainerRef = !!manager.coreAreas?.log?.container;
        } else {
            throw new Error('window.APP.workspace.manager not found.');
        }
    } catch(e) {
        results.workspaceManager.error = e.message;
    }

    // --- Display Results ---
    console.log('%c--- Log Panel Debug Report ---', 'color: #007acc; font-size: 1.2em; font-weight: bold;');

    // Redux Report
    console.log('%c1. Redux State (`state.ui.logVisible`):', 'color: #33a1ff; font-weight: bold;');
    if (results.redux.error) {
        console.error(`   ❌ Error: ${results.redux.error}`);
    } else {
        console.log(`   - Should be visible: %c${results.redux.logVisible}`, `font-weight: bold; color: ${results.redux.logVisible ? 'green' : 'red'};`);
    }

    // DOM Report
    console.log('%c2. DOM Element (`#log-container`):', 'color: #33a1ff; font-weight: bold;');
    if (results.dom.error) {
        console.error(`   ❌ Error: ${results.dom.error}`);
    } else {
        console.log(`   - Element exists: %c${results.dom.exists}`, `font-weight: bold; color: ${results.dom.exists ? 'green' : 'red'};`);
        if (results.dom.exists) {
            console.log(`   - Computed display style: %c'${results.dom.displayStyle}'`, 'font-weight: bold;');
            console.log(`   - Parent computed display style: %c'${results.dom.parentDisplayStyle}'`, 'font-weight: bold;');
        }
    }

    // Workspace Manager Report
    console.log('%c3. Workspace Manager State:', 'color: #33a1ff; font-weight: bold;');
     if (results.workspaceManager.error) {
        console.error(`   ❌ Error: ${results.workspaceManager.error}`);
    } else {
        console.log(`   - Manager has reference to log container: %c${results.workspaceManager.hasLogContainerRef}`, `font-weight: bold; color: ${results.workspaceManager.hasLogContainerRef ? 'green' : 'red'};`);
    }
    
    console.log('%c--- End of Report ---', 'color: #007acc; font-size: 1.2em; font-weight: bold;');

})();
