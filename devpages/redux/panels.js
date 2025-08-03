/**
 * panels.js - Main entry point for the Redux Panel System
 *
 * This file initializes and manages the panel system based on Redux state.
 */
import { PanelManager } from './components/PanelManager.js';
import { KeyboardShortcutHandler } from './components/KeyboardShortcutHandler.js';

let panelManager = null;
let keyboardHandler = null;

export async function initializePanelSystem(store) {
    console.log('[panels.js] Initializing panel system...');

    if (!store || typeof store.dispatch !== 'function' || typeof store.getState !== 'function') {
        console.error('[panels.js] Invalid Redux store object. Aborting panel system initialization.');
        return;
    }
    
    // AuthDisplay is now handled by the main bootstrap system - no duplicate initialization needed

    // Check authentication before initializing debug-specific panels
    const authState = store.getState().auth;
    const isAuthenticated = authState.isAuthenticated;
    
    if (!isAuthenticated) {
        console.log('🔒 [panels.js] User not authenticated - some panels may have limited functionality');
        console.log('🔑 [panels.js] Login to access all debug panels and development tools');
    } else {
        console.log('✅ [panels.js] User authenticated - initializing all panels');
    }

    // Initialize PanelManager immediately for access to Debug Dock, etc.
    if (!panelManager) {
        console.log('[panels.js] Condition met: Initializing PanelManager...');
        try {
            panelManager = new PanelManager(store);
            console.log('%c[panels.js] PanelManager INSTANCE CREATED', 'color: green; font-weight: bold;', panelManager);
            
            // CRITICAL: Actually initialize the panel manager to create panels
            await panelManager.initialize();
            console.log('%c[panels.js] PanelManager INITIALIZED - panels should now be visible', 'color: blue; font-weight: bold;');
            
            // Initialize keyboard shortcuts at the system level (proper architecture)
            if (!keyboardHandler) {
                try {
                    keyboardHandler = new KeyboardShortcutHandler(store.dispatch, store.getState);
                    keyboardHandler.init();
                    console.log('[panels.js] Keyboard shortcuts initialized at system level');
                } catch (error) {
                    console.warn('[panels.js] Keyboard shortcuts failed:', error.message);
                }
            }
            
            // Expose the PanelManager instance for debugging and shortcuts
            window.APP = window.APP || {};
            window.APP.panels = panelManager;

        } catch (error) {
            console.error('%c[panels.js] FAILED to create/initialize PanelManager instance', 'color: red; font-weight: bold;', error);
        }
    }
}

// Function to get the panel manager instance for debugging
export function getPanelManager() {
    return panelManager;
}

// Expose for console debugging
window.getPanelManager = getPanelManager;

// Test function for debugging keyboard shortcuts
window.testPanelShortcuts = () => {
    console.log('🧪 Testing panel shortcuts...');
    console.log('📋 Available shortcuts (authenticated users only):');
    console.log('  Ctrl+Shift+D - Toggle Debug Dock');
    console.log('  Ctrl+Shift+1 - Reset to defaults');
    console.log('');
    console.log('🆕 Try the enhanced panel features:');
    console.log('  • testPanels() - Test all panel interactions');
    console.log('  • testFlyout() - Test flyout positioning');
    console.log('  • testPanelFixes() - Test latest bug fixes');
    console.log('  • testPositionPersistence() - Check localStorage');
    
    if (window.APP?.panels) {
        console.log('✅ Panel manager is available:', window.APP.panels);
        console.log('🔧 Debug info:', window.APP.panels.getDebugInfo());
        console.log('🎯 Try pressing Ctrl+Shift+D now!');
    } else {
        console.error('❌ Panel manager not available');
        console.log('🔑 Debug panels require authentication - please login first');
    }
};

// Test flyout functionality
window.testFlyout = () => {
    console.log('🚀 Testing PData panel flyout functionality...');
    if (window.APP?.panels) {
        console.log('💫 Toggling PData panel to flyout mode...');
        window.APP.panels.togglePanelFlyout('pdata-panel');
        console.log('✨ PData panel should now appear as a flyout window!');
        console.log('📏 Drag the header to reposition');
        console.log('💾 Position is automatically saved across reloads');
        console.log('🔄 Run testFlyout() again to toggle back to dock');
    } else {
        console.error('❌ Panel manager not available - login required for debug panels');
    }
};

// Test panel functionality
window.testPanels = () => {
    console.log('🧪 Testing enhanced panel functionality...');
    console.log('📋 New panel features for ALL panels:');
    console.log('  • Single-click panel header to collapse/expand');
    console.log('  • Smooth animations with chevron indicators (▶/▼)');
    console.log('  • Clean hover effects and professional styling');
    console.log('  • No more aggressive red X buttons');
    console.log('  • Friendly anchor ⚓ button to return flyouts to dock');
    console.log('');
    console.log('🔍 PData Panel specific features:');
    console.log('  • Click sub-panel headers to collapse/expand sections');
    console.log('  • Authentication & API Explorer expanded by default');
    console.log('  • Timing & Introspection collapsed by default');
    console.log('🎯 Try clicking any panel or sub-panel header now!');
    
    if (window.APP?.panels) {
        console.log('✅ Panel system is ready for testing');
    } else {
        console.error('❌ Panel manager not available - login required');
    }
};

// Test the specific fixes
window.testPanelFixes = () => {
    console.log('🔧 Testing recent panel fixes...');
    console.log('');
    console.log('✅ Fixed issues:');
    console.log('  • Sub-panels now full width from start');
    console.log('  • Blue round flyout button → simple square ⊞');
    console.log('  • Collapsed flyouts no longer show blank spaces');
    console.log('  • Proper !important CSS prevents layout issues');
    console.log('  • Position persistence now working with localStorage');
    console.log('');
    console.log('🧪 Test scenarios:');
    console.log('  1. Open Debug Dock (Ctrl+Shift+D)');
    console.log('  2. Collapse main PData panel (click header)');
    console.log('  3. Toggle to flyout mode (⊞ button)');
    console.log('  4. Should flyout collapsed with no blank space');
    console.log('  5. Expand in flyout mode - content appears');
    console.log('  6. Move flyout to new position');
    console.log('  7. Reload page - position should persist!');
    console.log('  8. Return to dock - maintains state');
    
    if (window.APP?.panels) {
        console.log('✅ Ready to test - all systems operational');
    } else {
        console.error('❌ Panel manager not available - login required');
    }
};

// Test localStorage persistence specifically
window.testPositionPersistence = () => {
    console.log('💾 Testing position persistence...');
    console.log('');
    
    // Check what's currently in localStorage
    const keys = Object.keys(localStorage).filter(key => key.includes('flyout'));
    console.log(`📍 Found ${keys.length} flyout-related localStorage keys:`);
    keys.forEach(key => {
        try {
            const value = localStorage.getItem(key);
            console.log(`  ${key}: ${value}`);
        } catch (e) {
            console.log(`  ${key}: [error reading]`);
        }
    });
    
    if (keys.length === 0) {
        console.log('⚠️ No saved positions found. Try:');
        console.log('  1. Open a panel in flyout mode');
        console.log('  2. Move it around');
        console.log('  3. Run this test again');
    } else {
        console.log('✅ Positions are being saved to localStorage');
        console.log('🔄 Try refreshing the page to test loading');
    }
};

// Cleanup panels on logout
function destroyPanelSystem() {
    console.log('🧹 [panels.js] Cleaning up panel system for logout...');
    
    if (panelManager) {
        panelManager.destroy();
        panelManager = null;
    }
    
    if (keyboardHandler) {
        keyboardHandler = null;
    }
    
    if (window.APP?.panels) {
        delete window.APP.panels;
    }
    
    console.log('✅ [panels.js] Panel system cleaned up');
}

// Listen for auth state changes
export function setupAuthListener(store) {
    let wasAuthenticated = store.getState().auth.isAuthenticated;
    
    store.subscribe(() => {
        const currentAuth = store.getState().auth.isAuthenticated;
        
        // User logged out - destroy panels
        if (wasAuthenticated && !currentAuth) {
            console.log('🔓 [panels.js] User logged out - destroying debug panels');
            destroyPanelSystem();
        }
        // User logged in - initialize panels
        else if (!wasAuthenticated && currentAuth) {
            console.log('🔑 [panels.js] User logged in - initializing debug panels');
            initializePanelSystem(store);
        }
        
        wasAuthenticated = currentAuth;
    });
}   