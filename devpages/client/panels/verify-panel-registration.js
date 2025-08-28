/**
 * Verify Panel Registration
 * Comprehensive script to check panel registration status
 */
export function verifyPanelRegistration() {
    // Panels mentioned in the summary
    const expectedPanels = [
        'file-browser',
        'context',
        'pdata-panel',
        'settings-panel',
        'dom-inspector',
        'console-log-panel',
        'plugins',
        'design-tokens',
        'api-tokens',
        'nlp-panel',
        'log-display',
        'mount-info-panel'
    ];

    // Retrieve the current state
    const state = window.APP.store.getState();
    
    // Check sidebar panels
    const sidebarPanels = state.panels?.sidebarPanels || {};
    const mainPanels = state.panels?.panels || {};

    // Verification results
    const results = {
        totalExpectedPanels: expectedPanels.length,
        registeredSidebarPanels: Object.keys(sidebarPanels),
        registeredMainPanels: Object.keys(mainPanels),
        missingPanels: [],
        duplicatePanels: []
    };

    // Check for missing panels
    expectedPanels.forEach(panelId => {
        if (!sidebarPanels[panelId] && !mainPanels[panelId]) {
            results.missingPanels.push(panelId);
        }
    });

    // Check for duplicate registrations
    const allPanels = [...Object.keys(sidebarPanels), ...Object.keys(mainPanels)];
    const panelCounts = allPanels.reduce((acc, panel) => {
        acc[panel] = (acc[panel] || 0) + 1;
        return acc;
    }, {});

    Object.entries(panelCounts).forEach(([panel, count]) => {
        if (count > 1) {
            results.duplicatePanels.push(panel);
        }
    });

    // Detailed logging
    console.group('%c[Panel Registration Verification]', 'color: blue; font-weight: bold;');
    console.log('Total Expected Panels:', results.totalExpectedPanels);
    console.log('Registered Sidebar Panels:', results.registeredSidebarPanels);
    console.log('Registered Main Panels:', results.registeredMainPanels);
    
    if (results.missingPanels.length > 0) {
        console.warn('%cMissing Panels:', 'color: orange;', results.missingPanels);
    } else {
        console.log('%cAll Panels Registered ✅', 'color: green;');
    }

    if (results.duplicatePanels.length > 0) {
        console.warn('%cDuplicate Panels:', 'color: red;', results.duplicatePanels);
    }
    console.groupEnd();

    return results;
}

// Expose to global scope for easy console testing
if (window.APP) {
    window.APP.verifyPanelRegistration = verifyPanelRegistration;
}

// Auto-run verification
verifyPanelRegistration();
