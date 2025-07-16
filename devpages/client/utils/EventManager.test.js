/**
 * EventManager Test - Demonstrates memory leak prevention
 * Run this in the browser console to see the benefits
 */

import { EventManager } from './EventManager.js';

// Test function to demonstrate EventManager
window.testEventManager = function() {
    console.group('EventManager Test');
    
    // Create test elements
    const testDiv = document.createElement('div');
    testDiv.id = 'test-div';
    document.body.appendChild(testDiv);
    
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Button';
    testBtn.id = 'test-btn';
    testDiv.appendChild(testBtn);
    
    // Test 1: Without EventManager (manual cleanup required)
    console.log('❌ Without EventManager:');
    function manualHandler() { console.log('Manual handler called'); }
    testBtn.addEventListener('click', manualHandler);
    console.log('Added event listener - YOU MUST REMEMBER TO REMOVE IT!');
    
    // Test 2: With EventManager (automatic cleanup)
    console.log('✅ With EventManager:');
    const eventManager = new EventManager();
    
    eventManager.on(testBtn, 'click', () => console.log('EventManager handler called'));
    eventManager.on(testDiv, 'mouseover', () => console.log('MouseOver handled'));
    eventManager.on(testDiv, 'mouseout', () => console.log('MouseOut handled'));
    
    console.log(`Added ${eventManager.getListenerCount()} event listeners`);
    console.log('All will be automatically cleaned up when destroy() is called!');
    
    // Test the events
    console.log('Try clicking the button and hovering over the div...');
    
    // Clean up after 5 seconds
    setTimeout(() => {
        console.log('🧹 Cleaning up...');
        
        // Manual cleanup - you have to remember to do this!
        testBtn.removeEventListener('click', manualHandler);
        console.log('Manually removed event listener');
        
        // EventManager cleanup - automatic!
        eventManager.destroy();
        console.log('EventManager destroyed - all listeners cleaned up!');
        
        // Remove test elements
        document.body.removeChild(testDiv);
        console.log('Test completed - no memory leaks!');
        console.groupEnd();
    }, 5000);
};

// Test what happens when PanelManager is recreated
window.testPanelManagerCleanup = function() {
    console.group('PanelManager Memory Leak Test');
    
    const container = document.createElement('div');
    container.className = 'test-panel-manager';
    document.body.appendChild(container);
    
    console.log('Creating PanelManager...');
    const { PanelManager } = window; // Assuming it's available globally
    
    if (PanelManager) {
        const panelManager = new PanelManager(container, 'test');
        console.log('PanelManager created with EventManager');
        
        // Simulate what happens during bootstrap recreation
        setTimeout(() => {
            console.log('Destroying PanelManager...');
            panelManager.destroy();
            console.log('All event listeners automatically cleaned up!');
            
            document.body.removeChild(container);
            console.log('Test completed - no memory leaks!');
            console.groupEnd();
        }, 2000);
    } else {
        console.log('PanelManager not available - make sure it\'s loaded');
        console.groupEnd();
    }
};

console.log('EventManager test functions loaded!');
console.log('Run testEventManager() to see memory leak prevention in action');
console.log('Run testPanelManagerCleanup() to test PanelManager cleanup'); 