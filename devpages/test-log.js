// Test script to debug log display issues
// Run this in the browser console

console.log('=== LOG DISPLAY DEBUG TEST ===');

// 1. Check if log-container exists
const logContainer = document.getElementById('log-container');
console.log('1. Log container exists:', !!logContainer);
if (logContainer) {
    console.log('   Current classes:', logContainer.className);
    console.log('   Current style.height:', logContainer.style.height);
    console.log('   Children count:', logContainer.children.length);
}

// 2. Check Redux store
console.log('2. Redux store exists:', !!window.appStore);
if (window.appStore) {
    const state = window.appStore.getState();
    console.log('   UI state:', state.ui);
    console.log('   Log visible:', state.ui?.logVisible);
    console.log('   Log height:', state.ui?.logHeight);
}

// 3. Check CSS
if (logContainer) {
    const computed = getComputedStyle(logContainer);
    console.log('3. Computed styles:');
    console.log('   height:', computed.height);
    console.log('   visibility:', computed.visibility);
    console.log('   opacity:', computed.opacity);
    console.log('   display:', computed.display);
    console.log('   position:', computed.position);
    console.log('   z-index:', computed.zIndex);
}

// 4. Check CSS variable
const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--log-height');
console.log('4. CSS variable --log-height:', cssVar);

// 5. Force show function
window.forceShowLog = function() {
    console.log('=== FORCING LOG TO SHOW ===');
    
    if (logContainer) {
        // Remove hidden class, add visible class
        logContainer.classList.remove('log-hidden');
        logContainer.classList.add('log-visible');
        
        // Set CSS variable
        document.documentElement.style.setProperty('--log-height', '200px');
        
        // Force inline styles as backup
        logContainer.style.height = '200px';
        logContainer.style.visibility = 'visible';
        logContainer.style.opacity = '1';
        logContainer.style.display = 'flex';
        
        console.log('Log forced to show. New classes:', logContainer.className);
        
        // Check if it worked
        setTimeout(() => {
            const rect = logContainer.getBoundingClientRect();
            console.log('Log container position:', {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                visible: rect.height > 0
            });
        }, 100);
    } else {
        console.error('No log container found!');
    }
};

// 6. Toggle via Redux function
window.toggleLogViaRedux = function() {
    console.log('=== TOGGLING VIA REDUX ===');
    
    if (window.appStore && window.dispatch) {
        const oldState = window.appStore.getState().ui?.logVisible;
        console.log('Old state:', oldState);
        
        // Import and dispatch the action
        import('/client/store/uiSlice.js').then(({ uiActions }) => {
            window.dispatch(uiActions.toggleLogVisibility());
            
            setTimeout(() => {
                const newState = window.appStore.getState().ui?.logVisible;
                console.log('New state:', newState);
                
                // Check container
                if (logContainer) {
                    console.log('Container classes after Redux toggle:', logContainer.className);
                    const rect = logContainer.getBoundingClientRect();
                    console.log('Container dimensions:', rect.width, 'x', rect.height);
                }
            }, 100);
        });
    } else {
        console.error('Redux not available');
    }
};

console.log('=== TEST FUNCTIONS AVAILABLE ===');
console.log('Run forceShowLog() to force the log to show');
console.log('Run toggleLogViaRedux() to toggle via Redux');
