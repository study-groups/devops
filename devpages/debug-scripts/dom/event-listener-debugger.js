/**
 * Event Listener Debugger
 * Debug event listeners and click handlers
 */

console.log('🔍 EVENT LISTENER DEBUGGER');
console.log('==========================');

// 1. Event Listener Detection
console.log('\n1. EVENT LISTENER DETECTION:');

// Override addEventListener to track listeners
const originalAddEventListener = EventTarget.prototype.addEventListener;
const eventListeners = new Map();

EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (!eventListeners.has(this)) {
        eventListeners.set(this, []);
    }
    eventListeners.get(this).push({ type, listener, options });
    return originalAddEventListener.call(this, type, listener, options);
};

// 2. Button Click Debugger
console.log('\n2. BUTTON CLICK DEBUGGER:');
window.debugButtonClicks = function() {
    const buttons = document.querySelectorAll('button');
    console.log(`Found ${buttons.length} buttons`);
    
    buttons.forEach((btn, i) => {
        if (btn.id || btn.className.includes('toggle')) {
            console.log(`Button ${i}:`, {
                id: btn.id,
                className: btn.className,
                text: btn.textContent.trim().substring(0, 50),
                hasOnClick: !!btn.onclick,
                listeners: eventListeners.get(btn) || []
            });
        }
    });
};

// 3. Click Event Interceptor
console.log('\n3. CLICK EVENT INTERCEPTOR:');
let clickInterceptor = null;

window.startClickInterception = function() {
    if (clickInterceptor) {
        document.removeEventListener('click', clickInterceptor, true);
    }
    
    clickInterceptor = function(event) {
        console.log('🖱️ CLICK INTERCEPTED:', {
            target: event.target,
            targetId: event.target.id,
            targetClass: event.target.className,
            targetText: event.target.textContent?.trim().substring(0, 30),
            currentTarget: event.currentTarget,
            bubbles: event.bubbles,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented
        });
        
        // Check if this is a sidebar toggle button
        if (event.target.id === 'sidebar-toggle-btn' || 
            event.target.id === 'file-browser-toggle-btn' ||
            event.target.closest('#sidebar-toggle-btn') ||
            event.target.closest('#file-browser-toggle-btn')) {
            console.log('🎯 SIDEBAR TOGGLE BUTTON CLICKED!');
            console.log('Event path:', event.composedPath());
        }
    };
    
    document.addEventListener('click', clickInterceptor, true);
    console.log('✅ Click interception started');
};

window.stopClickInterception = function() {
    if (clickInterceptor) {
        document.removeEventListener('click', clickInterceptor, true);
        clickInterceptor = null;
        console.log('✅ Click interception stopped');
    }
};

// 4. Redux Action Interceptor
console.log('\n4. REDUX ACTION INTERCEPTOR:');
if (window.APP?.store) {
    const originalDispatch = window.APP.store.dispatch;
    
    window.APP.store.dispatch = function(action) {
        console.log('🚀 REDUX ACTION DISPATCHED:', action);
        
        if (action.type?.includes('sidebar') || action.type?.includes('Sidebar')) {
            console.log('🎯 SIDEBAR-RELATED ACTION!', action);
        }
        
        const result = originalDispatch.call(this, action);
        console.log('📡 New state after action:', this.getState());
        return result;
    };
    
    console.log('✅ Redux action interception enabled');
}

// 5. PathManager Component Debugger
console.log('\n5. PATHMANAGER COMPONENT DEBUGGER:');
window.debugPathManager = function() {
    const contextManager = document.querySelector('#context-manager-container');
    if (!contextManager) {
        console.error('❌ Context manager container not found');
        return;
    }
    
    console.log('Context Manager Container:', contextManager);
    console.log('Inner HTML preview:', contextManager.innerHTML.substring(0, 500));
    
    const sidebarBtn = contextManager.querySelector('#sidebar-toggle-btn');
    const fileBrowserBtn = contextManager.querySelector('#file-browser-toggle-btn');
    
    console.log('Sidebar toggle button in context manager:', sidebarBtn);
    console.log('File browser toggle button in context manager:', fileBrowserBtn);
    
    if (sidebarBtn) {
        console.log('Sidebar button listeners:', eventListeners.get(sidebarBtn) || 'None tracked');
        
        // Test the button
        console.log('Testing sidebar button click...');
        sidebarBtn.click();
    }
    
    if (fileBrowserBtn) {
        console.log('File browser button listeners:', eventListeners.get(fileBrowserBtn) || 'None tracked');
        
        // Test the button
        console.log('Testing file browser button click...');
        fileBrowserBtn.click();
    }
};

// 6. Manual Event Trigger
console.log('\n6. MANUAL EVENT TRIGGER:');
window.triggerSidebarToggle = function() {
    console.log('🔧 Manually triggering sidebar toggle...');
    
    // Try multiple approaches
    const approaches = [
        () => {
            const btn = document.querySelector('#sidebar-toggle-btn');
            if (btn) {
                btn.click();
                console.log('✅ Clicked #sidebar-toggle-btn');
            } else {
                console.log('❌ #sidebar-toggle-btn not found');
            }
        },
        () => {
            const btn = document.querySelector('#file-browser-toggle-btn');
            if (btn) {
                btn.click();
                console.log('✅ Clicked #file-browser-toggle-btn');
            } else {
                console.log('❌ #file-browser-toggle-btn not found');
            }
        },
        () => {
            if (window.APP?.store) {
                window.APP.store.dispatch({ type: 'ui/toggleLeftSidebar' });
                console.log('✅ Direct Redux dispatch');
            } else {
                console.log('❌ Redux store not available');
            }
        }
    ];
    
    approaches.forEach((approach, i) => {
        console.log(`Approach ${i + 1}:`);
        try {
            approach();
        } catch (error) {
            console.error(`❌ Approach ${i + 1} failed:`, error);
        }
    });
};

console.log('✅ Event listener debugger ready!');
console.log('Available functions:');
console.log('- debugButtonClicks()');
console.log('- startClickInterception()');
console.log('- stopClickInterception()');
console.log('- debugPathManager()');
console.log('- triggerSidebarToggle()');

// Auto-start click interception
startClickInterception();
debugButtonClicks();
