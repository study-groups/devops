/**
 * @file client/panels/integrate-auto-panels.js
 * @description Integration script to automatically load clean panels during app startup
 */

// Import and initialize the auto-loader
import { cleanPanelAutoLoader } from './auto-load-clean-panels.js';

// Initialize immediately
cleanPanelAutoLoader.initialize().then(() => {
    console.log('✅ Clean panels auto-loaded and integrated');
}).catch(error => {
    console.error('❌ Failed to auto-load clean panels:', error);
});

// Also expose for manual initialization if needed
if (typeof window !== 'undefined') {
    window.initializeCleanPanels = () => cleanPanelAutoLoader.initialize();
}
