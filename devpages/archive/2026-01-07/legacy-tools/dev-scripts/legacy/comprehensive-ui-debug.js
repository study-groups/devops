#!/usr/bin/env node

/**
 * Comprehensive UI Debug Script
 * Diagnoses toggle button and resizer persistence issues
 */

console.log('🔍 COMPREHENSIVE UI DEBUG ANALYSIS');
console.log('===================================');

if (typeof window === 'undefined') {
    console.log('❌ This script must be run in the browser console');
    console.log('📋 Copy and paste this entire script into the browser console');
    process.exit(1);
}

window.uiDebugger = {
    report: {},
    
    // 1. Analyze Redux State
    analyzeReduxState() {
        console.log('\n1️⃣ REDUX STATE ANALYSIS:');
        
        const store = window.APP?.services?.store || window.APP?.store;
        if (!store) {
            console.error('❌ Redux store not found');
            return null;
        }
        
        const state = store.getState();
        console.log('Full Redux state:', state);
        
        const uiState = state.ui || {};
        console.log('UI State:', {
            editorVisible: uiState.editorVisible,
            previewVisible: uiState.previewVisible,
            logVisible: uiState.logVisible,
            leftSidebarVisible: uiState.leftSidebarVisible,
            viewMode: uiState.viewMode
        });
        
        // Check if panel sizes are stored
        const panelSizes = state.panelSizes || {};
        console.log('Panel Sizes:', panelSizes);
        
        return { uiState, panelSizes, fullState: state };
    },
    
    // 2. Analyze Toggle Buttons
    analyzeToggleButtons() {
        console.log('\n2️⃣ TOGGLE BUTTON ANALYSIS:');
        
        const buttons = {
            editToggle: document.querySelector('#edit-toggle'),
            previewToggle: document.querySelector('#preview-toggle'),
            logToggle: document.querySelector('#log-toggle-btn')
        };
        
        Object.entries(buttons).forEach(([name, button]) => {
            if (button) {
                console.log(`✅ ${name}:`, {
                    exists: true,
                    classes: button.className,
                    dataAction: button.dataset.action,
                    hasActiveClass: button.classList.contains('active'),
                    disabled: button.disabled,
                    visible: button.offsetParent !== null
                });
                
                // Check event listeners
                const listeners = this.getEventListeners(button);
                console.log(`   Event listeners:`, listeners);
            } else {
                console.error(`❌ ${name}: Not found`);
            }
        });
        
        return buttons;
    },
    
    // 3. Test Toggle Actions
    testToggleActions() {
        console.log('\n3️⃣ TESTING TOGGLE ACTIONS:');
        
        const store = window.APP?.services?.store || window.APP?.store;
        if (!store) {
            console.error('❌ Redux store not available for testing');
            return;
        }
        
        const initialState = store.getState();
        console.log('Initial UI state:', {
            editorVisible: initialState.ui?.editorVisible,
            previewVisible: initialState.ui?.previewVisible,
            logVisible: initialState.ui?.logVisible
        });
        
        // Test editor toggle
        console.log('Testing editor toggle...');
        try {
            store.dispatch({ type: 'ui/toggleEditorVisibility' });
            const newState = store.getState();
            console.log('After editor toggle:', {
                editorVisible: newState.ui?.editorVisible,
                changed: initialState.ui?.editorVisible !== newState.ui?.editorVisible
            });
        } catch (error) {
            console.error('❌ Editor toggle failed:', error);
        }
        
        // Test preview toggle
        console.log('Testing preview toggle...');
        try {
            store.dispatch({ type: 'ui/togglePreviewVisibility' });
            const newState2 = store.getState();
            console.log('After preview toggle:', {
                previewVisible: newState2.ui?.previewVisible,
                changed: initialState.ui?.previewVisible !== newState2.ui?.previewVisible
            });
        } catch (error) {
            console.error('❌ Preview toggle failed:', error);
        }
        
        // Reset to initial state
        if (initialState.ui?.editorVisible !== store.getState().ui?.editorVisible) {
            store.dispatch({ type: 'ui/toggleEditorVisibility' });
        }
        if (initialState.ui?.previewVisible !== store.getState().ui?.previewVisible) {
            store.dispatch({ type: 'ui/togglePreviewVisibility' });
        }
    },
    
    // 4. Analyze TopBarController
    analyzeTopBarController() {
        console.log('\n4️⃣ TOPBAR CONTROLLER ANALYSIS:');
        
        const controller = window.topBarController;
        if (controller) {
            console.log('✅ TopBarController exists:', {
                initialized: controller.initialized,
                actionHandlers: controller.actionHandlers?.size || 0,
                hasToggleEdit: controller.actionHandlers?.has('toggleEdit'),
                hasTogglePreview: controller.actionHandlers?.has('togglePreview')
            });
        } else {
            console.error('❌ TopBarController not found');
        }
        
        // Check if it's imported and initialized
        if (window.APP?.components?.topBarController) {
            console.log('✅ TopBarController in APP.components');
        }
    },
    
    // 5. Analyze Resizer System
    analyzeResizerSystem() {
        console.log('\n5️⃣ RESIZER SYSTEM ANALYSIS:');
        
        const resizers = document.querySelectorAll('.resizer, .workspace-resizer, .panel-resize-handle');
        console.log(`Found ${resizers.length} resizer elements`);
        
        resizers.forEach((resizer, i) => {
            console.log(`Resizer ${i}:`, {
                className: resizer.className,
                dataResizerFor: resizer.dataset.resizerFor,
                visible: resizer.offsetParent !== null,
                cursor: getComputedStyle(resizer).cursor
            });
        });
        
        // Check ResizableManager
        const resizableManager = window.APP?.components?.resizableManager || window.resizableManager;
        if (resizableManager) {
            console.log('✅ ResizableManager found:', {
                initialized: resizableManager.initialized,
                resizers: Object.keys(resizableManager.resizers || {}),
                panels: Object.keys(resizableManager.panels || {})
            });
        } else {
            console.error('❌ ResizableManager not found');
        }
        
        return { resizers: Array.from(resizers), resizableManager };
    },
    
    // 6. Check Workspace Containers
    analyzeWorkspaceContainers() {
        console.log('\n6️⃣ WORKSPACE CONTAINERS ANALYSIS:');
        
        const containers = {
            workspaceEditor: document.getElementById('workspace-editor'),
            workspacePreview: document.getElementById('workspace-preview'),
            workspaceSidebar: document.getElementById('workspace-sidebar'),
            logContainer: document.getElementById('log-container')
        };
        
        Object.entries(containers).forEach(([name, container]) => {
            if (container) {
                const computed = getComputedStyle(container);
                console.log(`✅ ${name}:`, {
                    display: computed.display,
                    visibility: computed.visibility,
                    width: computed.width,
                    flexBasis: computed.flexBasis,
                    dataVisible: container.dataset.visible,
                    dataEditorVisible: container.dataset.editorVisible,
                    dataPreviewVisible: container.dataset.previewVisible
                });
            } else {
                console.error(`❌ ${name}: Not found`);
            }
        });
        
        return containers;
    },
    
    // 7. Test Button Clicks
    testButtonClicks() {
        console.log('\n7️⃣ TESTING BUTTON CLICKS:');
        
        const buttons = ['#edit-toggle', '#preview-toggle', '#log-toggle-btn'];
        
        buttons.forEach(selector => {
            const button = document.querySelector(selector);
            if (button) {
                console.log(`Testing ${selector}...`);
                
                // Get initial state
                const store = window.APP?.services?.store || window.APP?.store;
                const initialState = store?.getState();
                
                // Simulate click
                button.click();
                
                // Check if state changed
                setTimeout(() => {
                    const newState = store?.getState();
                    const stateChanged = JSON.stringify(initialState?.ui) !== JSON.stringify(newState?.ui);
                    console.log(`${selector} click result:`, {
                        stateChanged,
                        initialUI: initialState?.ui,
                        newUI: newState?.ui
                    });
                }, 100);
            }
        });
    },
    
    // 8. Check CSS Variables and Persistence
    checkPersistence() {
        console.log('\n8️⃣ PERSISTENCE ANALYSIS:');
        
        // Check localStorage
        const uiSettings = localStorage.getItem('settings_ui');
        if (uiSettings) {
            try {
                const parsed = JSON.parse(uiSettings);
                console.log('✅ UI settings in localStorage:', parsed);
            } catch (e) {
                console.error('❌ Failed to parse UI settings:', e);
            }
        } else {
            console.log('❌ No UI settings in localStorage');
        }
        
        // Check panel sizes in localStorage
        const panelSizes = localStorage.getItem('panelSizes');
        if (panelSizes) {
            try {
                const parsed = JSON.parse(panelSizes);
                console.log('✅ Panel sizes in localStorage:', parsed);
            } catch (e) {
                console.error('❌ Failed to parse panel sizes:', e);
            }
        } else {
            console.log('❌ No panel sizes in localStorage');
        }
    },
    
    // Helper function to get event listeners (simplified)
    getEventListeners(element) {
        // This is a simplified version - real implementation would need more work
        const listeners = [];
        if (element.onclick) listeners.push('onclick');
        if (element.addEventListener) listeners.push('addEventListener');
        return listeners;
    },
    
    // 9. Generate Fixes
    generateFixes() {
        console.log('\n9️⃣ GENERATING FIXES:');
        
        const fixes = [];
        
        // Check if TopBarController is initialized
        const controller = window.topBarController;
        if (!controller || !controller.initialized) {
            fixes.push({
                issue: 'TopBarController not initialized',
                fix: 'Initialize TopBarController',
                code: `
                    import { topBarController } from '/client/components/TopBarController.js';
                    topBarController.initialize();
                `
            });
        }
        
        // Check if buttons have data-action attributes
        const editToggle = document.querySelector('#edit-toggle');
        if (editToggle && !editToggle.dataset.action) {
            fixes.push({
                issue: 'Edit toggle missing data-action attribute',
                fix: 'Add data-action="toggleEdit" to edit button',
                code: `document.querySelector('#edit-toggle').setAttribute('data-action', 'toggleEdit');`
            });
        }
        
        const previewToggle = document.querySelector('#preview-toggle');
        if (previewToggle && !previewToggle.dataset.action) {
            fixes.push({
                issue: 'Preview toggle missing data-action attribute',
                fix: 'Add data-action="togglePreview" to preview button',
                code: `document.querySelector('#preview-toggle').setAttribute('data-action', 'togglePreview');`
            });
        }
        
        // Check resizer manager
        const resizableManager = window.APP?.components?.resizableManager;
        if (!resizableManager || !resizableManager.initialized) {
            fixes.push({
                issue: 'ResizableManager not initialized',
                fix: 'Initialize ResizableManager',
                code: `
                    import { resizableManager } from '/client/layout/resizable.js';
                    resizableManager.initialize();
                `
            });
        }
        
        console.log(`Generated ${fixes.length} potential fixes:`);
        fixes.forEach((fix, i) => {
            console.log(`${i + 1}. ${fix.issue}`);
            console.log(`   Fix: ${fix.fix}`);
            console.log(`   Code: ${fix.code}`);
        });
        
        return fixes;
    },
    
    // 10. Apply Emergency Fixes
    applyEmergencyFixes() {
        console.log('\n🔧 APPLYING EMERGENCY FIXES:');
        
        const fixes = [];
        
        // Fix 1: Ensure buttons have correct data-action attributes
        const editToggle = document.querySelector('#edit-toggle');
        if (editToggle && !editToggle.dataset.action) {
            editToggle.setAttribute('data-action', 'toggleEdit');
            fixes.push('Added data-action to edit toggle');
        }
        
        const previewToggle = document.querySelector('#preview-toggle');
        if (previewToggle && !previewToggle.dataset.action) {
            previewToggle.setAttribute('data-action', 'togglePreview');
            fixes.push('Added data-action to preview toggle');
        }
        
        const logToggle = document.querySelector('#log-toggle-btn');
        if (logToggle && !logToggle.dataset.action) {
            logToggle.setAttribute('data-action', 'toggleLogVisibility');
            fixes.push('Added data-action to log toggle');
        }
        
        // Fix 2: Initialize TopBarController if not initialized
        if (window.topBarController && !window.topBarController.initialized) {
            try {
                window.topBarController.initialize();
                fixes.push('Initialized TopBarController');
            } catch (error) {
                console.error('Failed to initialize TopBarController:', error);
            }
        }
        
        // Fix 3: Force button state update
        if (window.topBarController && window.topBarController.updateButtonStates) {
            try {
                window.topBarController.updateButtonStates();
                fixes.push('Updated button states');
            } catch (error) {
                console.error('Failed to update button states:', error);
            }
        }
        
        console.log(`✅ Applied ${fixes.length} emergency fixes:`);
        fixes.forEach(fix => console.log(`  - ${fix}`));
        
        return fixes;
    },
    
    // Run full analysis
    runFullAnalysis() {
        console.log('🚀 RUNNING FULL UI ANALYSIS...');
        console.log('==============================');
        
        this.report = {
            redux: this.analyzeReduxState(),
            buttons: this.analyzeToggleButtons(),
            topBarController: this.analyzeTopBarController(),
            resizers: this.analyzeResizerSystem(),
            containers: this.analyzeWorkspaceContainers(),
            persistence: this.checkPersistence(),
            fixes: this.generateFixes(),
            timestamp: new Date().toISOString()
        };
        
        // Test actions
        this.testToggleActions();
        
        console.log('\n✅ Analysis complete. Full report in window.uiDebugger.report');
        console.log('\n💡 Available functions:');
        console.log('- window.uiDebugger.testButtonClicks() - Test button click behavior');
        console.log('- window.uiDebugger.applyEmergencyFixes() - Apply quick fixes');
        console.log('- window.uiDebugger.runFullAnalysis() - Re-run analysis');
        
        return this.report;
    }
};

// Auto-run analysis
window.uiDebugger.runFullAnalysis();
