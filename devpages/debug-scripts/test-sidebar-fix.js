/**
 * Test Sidebar Fix
 * Quick test script to verify the sidebar toggle fix is working
 */

(function() {
    console.log('🧪 TESTING SIDEBAR FIX');
    console.log('======================');

    // 1. Check if SidebarVisibilityController is working
    console.log('\n1. SIDEBAR CONTROLLER CHECK:');
    const sidebarElement = document.querySelector('.workspace-sidebar');
    console.log('Sidebar element:', sidebarElement);
    
    if (sidebarElement) {
        console.log('Current classes:', sidebarElement.className);
        console.log('Current data-visible:', sidebarElement.getAttribute('data-visible'));
        console.log('Current display:', getComputedStyle(sidebarElement).display);
    }

    // 2. Check Redux state
    console.log('\n2. REDUX STATE:');
    if (window.APP?.store) {
        const state = window.APP.store.getState();
        console.log('leftSidebarVisible:', state.ui?.leftSidebarVisible);
    }

    // 3. Test Redux dispatch
    console.log('\n3. TESTING REDUX DISPATCH:');
    if (window.APP?.store) {
        console.log('Dispatching toggle action...');
        window.APP.store.dispatch({ type: 'ui/toggleLeftSidebar' });
        
        setTimeout(() => {
            const newState = window.APP.store.getState();
            console.log('New leftSidebarVisible:', newState.ui?.leftSidebarVisible);
            
            if (sidebarElement) {
                console.log('New classes:', sidebarElement.className);
                console.log('New data-visible:', sidebarElement.getAttribute('data-visible'));
                console.log('New display:', getComputedStyle(sidebarElement).display);
            }
        }, 100);
    }

    // 4. Test button click
    console.log('\n4. TESTING BUTTON CLICK:');
    const toggleBtn = document.querySelector('#file-browser-toggle-btn');
    console.log('Toggle button found:', !!toggleBtn);
    
    if (toggleBtn) {
        console.log('Clicking toggle button...');
        toggleBtn.click();
        
        setTimeout(() => {
            const finalState = window.APP.store.getState();
            console.log('Final leftSidebarVisible:', finalState.ui?.leftSidebarVisible);
            
            if (sidebarElement) {
                console.log('Final classes:', sidebarElement.className);
                console.log('Final data-visible:', sidebarElement.getAttribute('data-visible'));
                console.log('Final display:', getComputedStyle(sidebarElement).display);
            }
        }, 100);
    }

    // 5. Create manual test function
    window.testSidebarToggle = function() {
        console.log('🔧 Manual sidebar toggle test...');
        if (window.APP?.store) {
            const currentState = window.APP.store.getState();
            const isVisible = currentState.ui?.leftSidebarVisible;
            console.log('Before toggle - visible:', isVisible);
            
            window.APP.store.dispatch({
                type: 'ui/setLeftSidebarVisible',
                payload: !isVisible
            });
            
            setTimeout(() => {
                const newState = window.APP.store.getState();
                console.log('After toggle - visible:', newState.ui?.leftSidebarVisible);
                
                if (sidebarElement) {
                    console.log('Sidebar classes:', sidebarElement.className);
                    console.log('Sidebar visible:', getComputedStyle(sidebarElement).display !== 'none');
                }
            }, 100);
        }
    };

    console.log('\n✅ Test complete!');
    console.log('💡 Use testSidebarToggle() for manual testing');
    console.log('💡 Refresh page to see if SidebarVisibilityController loads');
})();
