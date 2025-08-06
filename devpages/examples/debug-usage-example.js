/**
 * Example: How to use @devpages/debug package
 */

// Import everything from the internal package
import { 
    initializeDebugPanels, 
    DevToolsPanel, 
    CssFilesPanel,
    DomInspectorDebugPanel,
    debugPackageInfo 
} from '../packages/devpages-debug/index.js';

// Example 1: Initialize all debug panels (typically in bootloader)
export async function setupDebugging() {
    console.log('Setting up debug tools:', debugPackageInfo);
    await initializeDebugPanels();
}

// Example 2: Use individual panels programmatically
export function createCustomDebugDashboard() {
    const container = document.createElement('div');
    
    // Create individual debug panels
    const devTools = new DevToolsPanel();
    const cssPanel = new CssFilesPanel(); 
    const domInspector = new DomInspectorDebugPanel();
    
    // Mount them
    devTools.mount(container);
    cssPanel.mount(container);
    domInspector.mount(container);
    
    return container;
}

// Example 3: Selective import for specific use cases
export async function debugSpecificIssue() {
    // Only import what you need
    const { CssFilesPanel } = await import('../packages/devpages-debug/index.js');
    
    const cssDebugger = new CssFilesPanel();
    cssDebugger.mount(document.body);
}