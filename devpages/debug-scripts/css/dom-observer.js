/**
 * @file dom-observer.js
 * @description Watches the DOM for the addition and removal of the #host-log element to debug timing issues.
 *
 * Usage: Copy and paste into the developer console as early as possible during page load.
 */
(function() {
    console.log('👀 DOM OBSERVER ACTIVATED. Watching for #host-log...');

    const log = (message, ...args) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        console.log(`[${timestamp}] %cDOM Observer:`, 'color: #9945FF; font-weight: bold;', message, ...args);
    };

    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    let elementAdded = false;
    let elementRemoved = false;
    let removalStackTrace = null;

    const callback = function(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // Check for added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.id === 'log-container') {
                        elementAdded = true;
                        log('✅ #log-container element was ADDED to the DOM.', node);
                    }
                });

                // Check for removed nodes
                mutation.removedNodes.forEach(node => {
                    if (node.id === 'log-container') {
                        elementRemoved = true;
                        // Attempt to capture a stack trace to see what caused the removal
                        removalStackTrace = new Error().stack;
                        log('❌ #log-container element was REMOVED from the DOM.', node);
                        // Stop observing once we've found the removal, as it's the key event.
                        observer.disconnect();
                        log('🛑 Observer stopped after detecting removal.');
                    }
                });
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);

    log('Observer is now watching the document body.');

    // Function to print a final report after a few seconds
    const printReport = () => {
        log('--- FINAL REPORT ---');
        console.log(`- Was #log-container ever added? %c${elementAdded}`, `font-weight: bold; color: ${elementAdded ? 'green' : 'red'};`);
        console.log(`- Was #log-container ever removed? %c${elementRemoved}`, `font-weight: bold; color: ${elementRemoved ? 'green' : 'red'};`);
        if (elementRemoved && removalStackTrace) {
            console.log('%cStack trace at time of removal:', 'font-weight: bold; color: orange;');
            console.log(removalStackTrace);
        } else if (elementRemoved) {
            console.log('Could not capture a stack trace for the removal.');
        }
        log('--------------------');
    };

    // Wait for the app to be "ready" plus a small buffer, then print the report.
    if (window.APP && window.APP.eventBus) {
        window.APP.eventBus.on('app:ready', () => {
            setTimeout(printReport, 1000);
        });
    } else {
        // Fallback if the script is run too late
        setTimeout(printReport, 5000);
    }
    
    // Expose a manual report function
    import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('debug', window.APP.debug || {});
    window.APP.debug.printDomObserverReport = printReport;
    log('Run `APP.debug.printDomObserverReport()` to see the report manually.');

})();
