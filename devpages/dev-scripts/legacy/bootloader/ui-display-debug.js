#!/usr/bin/env node

/**
 * UI Display Debug Script
 * Diagnoses why loaded file content is not displaying in the UI
 */

console.log('🖥️ UI Display Debug Script Starting...\n');

if (typeof window === 'undefined') {
    console.log('❌ This script must be run in the browser console');
    process.exit(1);
}

function debugUIDisplay() {
    console.log('='.repeat(60));
    console.log('🖥️ UI DISPLAY DEBUG ANALYSIS');
    console.log('='.repeat(60));
    
    const store = window.APP?.services?.store;
    if (!store) {
        console.log('❌ Redux store not available');
        return;
    }
    
    const state = store.getState();
    
    // 1. Check Redux state
    console.log('\n1️⃣ Redux State Analysis:');
    console.log('   File State:');
    console.log('     - currentFile.pathname:', state.file?.currentFile?.pathname);
    console.log('     - currentFile.content length:', state.file?.currentFile?.content?.length || 0);
    console.log('     - status:', state.file?.status);
    console.log('     - error:', state.file?.error);
    
    console.log('   Editor State:');
    console.log('     - content length:', state.editor?.content?.length || 0);
    console.log('     - isModified:', state.editor?.isModified);
    
    console.log('   UI State:');
    console.log('     - viewMode:', state.ui?.viewMode);
    console.log('     - showEditor:', state.ui?.showEditor);
    console.log('     - showPreview:', state.ui?.showPreview);
    
    console.log('   Path State:');
    console.log('     - currentPath:', state.path?.currentPath);
    console.log('     - isDirectory:', state.path?.isDirectory);
    
    // 2. Check DOM elements
    console.log('\n2️⃣ DOM Elements Analysis:');
    const elements = {
        'Editor textarea': document.getElementById('md-editor'),
        'Preview container': document.querySelector('.preview-container'),
        'Main content area': document.getElementById('main-content'),
        'Workspace container': document.getElementById('workspace-container'),
        'File summary overlay': document.getElementById('file-summary-overlay')
    };
    
    Object.entries(elements).forEach(([name, element]) => {
        if (element) {
            console.log(`   ✅ ${name}: Found`);
            if (element.tagName === 'TEXTAREA') {
                console.log(`      - Value length: ${element.value?.length || 0}`);
            } else {
                console.log(`      - innerHTML length: ${element.innerHTML?.length || 0}`);
            }
            console.log(`      - Visible: ${element.offsetWidth > 0 && element.offsetHeight > 0}`);
            console.log(`      - Display: ${getComputedStyle(element).display}`);
        } else {
            console.log(`   ❌ ${name}: Not found`);
        }
    });
    
    // 3. Check view controls
    console.log('\n3️⃣ View Controls Analysis:');
    const viewButtons = {
        'Editor button': document.querySelector('[data-view="editor"]'),
        'Preview button': document.querySelector('[data-view="preview"]'),
        'Split button': document.querySelector('[data-view="split"]')
    };
    
    Object.entries(viewButtons).forEach(([name, button]) => {
        if (button) {
            console.log(`   ✅ ${name}: Found`);
            console.log(`      - Active: ${button.classList.contains('active')}`);
        } else {
            console.log(`   ❌ ${name}: Not found`);
        }
    });
    
    // 4. Check if content is actually in the DOM but hidden
    console.log('\n4️⃣ Content Visibility Analysis:');
    const textarea = document.getElementById('md-editor');
    if (textarea) {
        console.log('   Editor textarea:');
        console.log(`     - Value: "${textarea.value.substring(0, 100)}..."`);
        console.log(`     - Parent visible: ${textarea.parentElement?.offsetWidth > 0}`);
        console.log(`     - CSS display: ${getComputedStyle(textarea).display}`);
        console.log(`     - CSS visibility: ${getComputedStyle(textarea).visibility}`);
    }
    
    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer) {
        console.log('   Preview container:');
        console.log(`     - Content: "${previewContainer.innerHTML.substring(0, 100)}..."`);
        console.log(`     - CSS display: ${getComputedStyle(previewContainer).display}`);
        console.log(`     - CSS visibility: ${getComputedStyle(previewContainer).visibility}`);
    }
    
    // 5. Test manual content injection
    console.log('\n5️⃣ Manual Content Test:');
    if (state.file?.currentFile?.content && textarea) {
        console.log('   Testing manual content injection...');
        const originalValue = textarea.value;
        textarea.value = state.file.currentFile.content;
        console.log(`   ✅ Injected ${state.file.currentFile.content.length} characters`);
        console.log(`   - Textarea now shows: "${textarea.value.substring(0, 100)}..."`);
        
        // Trigger input event to notify any listeners
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('   ✅ Triggered input event');
    }
    
    // 6. Check for panel system remnants
    console.log('\n6️⃣ Panel System Check:');
    const panelElements = document.querySelectorAll('[class*="panel"]');
    console.log(`   - Found ${panelElements.length} elements with 'panel' in class name`);
    panelElements.forEach((el, i) => {
        console.log(`     ${i + 1}. ${el.tagName}.${el.className} - visible: ${el.offsetWidth > 0}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 UI Display debug complete');
    console.log('='.repeat(60));
}

// Function to force display file content
function forceDisplayFile() {
    const store = window.APP?.services?.store;
    if (!store) {
        console.log('❌ Store not available');
        return;
    }
    
    const state = store.getState();
    const content = state.file?.currentFile?.content;
    
    if (!content) {
        console.log('❌ No file content in Redux state');
        return;
    }
    
    console.log(`🔧 Forcing display of ${content.length} characters...`);
    
    // Try to find and populate editor
    const textarea = document.getElementById('md-editor');
    if (textarea) {
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('✅ Content injected into editor');
    }
    
    // Try to find and populate preview
    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer) {
        // For markdown, we'd need to render it, but for now just show raw
        previewContainer.innerHTML = `<pre>${content}</pre>`;
        console.log('✅ Content injected into preview (raw)');
    }
    
    // Make sure editor is visible
    if (textarea && textarea.parentElement) {
        textarea.parentElement.style.display = 'block';
        textarea.style.display = 'block';
        console.log('✅ Made editor visible');
    }
}

// Run the debug
debugUIDisplay();

// Export functions
window.debugUIDisplay = debugUIDisplay;
window.forceDisplayFile = forceDisplayFile;

console.log('\n💡 Functions exported:');
console.log('   - window.debugUIDisplay() - Re-run analysis');
console.log('   - window.forceDisplayFile() - Force display loaded content');
