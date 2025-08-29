/**
 * DOM Element Inspector
 * Comprehensive DOM debugging for sidebar and panel elements
 */

console.log('🔍 DOM ELEMENT INSPECTOR');
console.log('========================');

// 1. Sidebar Elements
console.log('\n1. SIDEBAR ELEMENTS:');
const leftSidebar = document.querySelector('#left-sidebar');
const rightSidebar = document.querySelector('#right-sidebar');
const workspaceSidebar = document.querySelector('.workspace-sidebar');

console.log('Left Sidebar (#left-sidebar):', leftSidebar);
console.log('Right Sidebar (#right-sidebar):', rightSidebar);
console.log('Workspace Sidebar (.workspace-sidebar):', workspaceSidebar);

if (leftSidebar) {
    console.log('Left Sidebar Details:');
    console.log('  Classes:', leftSidebar.className);
    console.log('  Style display:', leftSidebar.style.display);
    console.log('  Computed display:', getComputedStyle(leftSidebar).display);
    console.log('  Computed visibility:', getComputedStyle(leftSidebar).visibility);
    console.log('  Computed width:', getComputedStyle(leftSidebar).width);
    console.log('  Children count:', leftSidebar.children.length);
}

// 2. Toggle Buttons
console.log('\n2. TOGGLE BUTTONS:');
const sidebarToggleBtn = document.querySelector('#sidebar-toggle-btn');
const fileBrowserToggleBtn = document.querySelector('#file-browser-toggle-btn');
const allToggleButtons = document.querySelectorAll('[id*="toggle"], [class*="toggle"]');

console.log('Sidebar Toggle Button (#sidebar-toggle-btn):', sidebarToggleBtn);
console.log('File Browser Toggle Button (#file-browser-toggle-btn):', fileBrowserToggleBtn);
console.log('All toggle-related elements:', allToggleButtons);

// 3. Workspace Layout
console.log('\n3. WORKSPACE LAYOUT:');
const workspaceMain = document.querySelector('#workspace-main');
const workspaceEditor = document.querySelector('#workspace-editor');
const workspacePreview = document.querySelector('#workspace-preview');

console.log('Workspace Main:', workspaceMain);
console.log('Workspace Editor:', workspaceEditor);
console.log('Workspace Preview:', workspacePreview);

// 4. Context Manager
console.log('\n4. CONTEXT MANAGER:');
const contextManager = document.querySelector('#context-manager-container');
console.log('Context Manager Container:', contextManager);

if (contextManager) {
    const buttons = contextManager.querySelectorAll('button');
    console.log('Buttons in context manager:', buttons.length);
    buttons.forEach((btn, i) => {
        console.log(`  Button ${i}:`, {
            id: btn.id,
            className: btn.className,
            text: btn.textContent.trim(),
            onclick: btn.onclick ? 'has onclick' : 'no onclick',
            listeners: 'unknown'
        });
    });
}

// 5. Panel Containers
console.log('\n5. PANEL CONTAINERS:');
const panelContainers = document.querySelectorAll('[class*="panel"], [id*="panel"]');
console.log('Panel-related elements:', panelContainers.length);
panelContainers.forEach((el, i) => {
    if (i < 10) { // Limit output
        console.log(`  Panel ${i}:`, {
            id: el.id,
            className: el.className,
            tagName: el.tagName
        });
    }
});

// 6. Event Listener Tester
console.log('\n6. EVENT LISTENER TESTER:');
window.testButtonClick = function(selector) {
    const element = document.querySelector(selector);
    if (element) {
        console.log(`🖱️ Clicking element: ${selector}`);
        console.log('Element:', element);
        element.click();
        console.log('✅ Click event fired');
    } else {
        console.error(`❌ Element not found: ${selector}`);
    }
};

// 7. CSS Class Inspector
console.log('\n7. CSS CLASS INSPECTOR:');
window.inspectElement = function(selector) {
    const element = document.querySelector(selector);
    if (element) {
        console.log(`🔍 Inspecting: ${selector}`);
        console.log('Element:', element);
        console.log('Classes:', element.className);
        console.log('Computed styles:', {
            display: getComputedStyle(element).display,
            visibility: getComputedStyle(element).visibility,
            opacity: getComputedStyle(element).opacity,
            width: getComputedStyle(element).width,
            height: getComputedStyle(element).height,
            transform: getComputedStyle(element).transform
        });
        console.log('Inline styles:', element.style.cssText);
    } else {
        console.error(`❌ Element not found: ${selector}`);
    }
};

// 8. Sidebar Visibility Checker
console.log('\n8. SIDEBAR VISIBILITY CHECKER:');
window.checkSidebarVisibility = function() {
    console.log('🔍 Checking sidebar visibility...');
    
    const elements = {
        leftSidebar: document.querySelector('#left-sidebar'),
        rightSidebar: document.querySelector('#right-sidebar'),
        workspaceSidebar: document.querySelector('.workspace-sidebar')
    };
    
    Object.entries(elements).forEach(([name, el]) => {
        if (el) {
            const computed = getComputedStyle(el);
            console.log(`${name}:`, {
                display: computed.display,
                visibility: computed.visibility,
                opacity: computed.opacity,
                width: computed.width,
                classes: el.className
            });
        } else {
            console.log(`${name}: Not found`);
        }
    });
};

console.log('✅ DOM inspector ready!');
console.log('Available functions:');
console.log('- testButtonClick(selector)');
console.log('- inspectElement(selector)');
console.log('- checkSidebarVisibility()');

// Auto-run visibility check
checkSidebarVisibility();
