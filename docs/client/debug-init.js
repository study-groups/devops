// debug-init.js - Ensures all debug functions are properly registered with window
import { debugUI, testApiEndpoints, debugFileOperations, debugApiResponses, testFileLoading } from './debug.js';
import { appName, appVer } from './config.js';

// Register all debug functions with window
window.debugUI = debugUI;
window.testApiEndpoints = testApiEndpoints;
window.debugFileOperations = debugFileOperations;
window.debugApiResponses = debugApiResponses;
window.testFileLoading = testFileLoading;

// Make app config available globally
window.APP_CONFIG = {
    name: appName,
    version: appVer,
    buildDate: new Date().toISOString().split('T')[0]
};

console.log('[DEBUG] Debug functions initialized and registered with window');

// Set app info text
document.addEventListener('DOMContentLoaded', () => {
    const appInfo = document.getElementById('app-info');
    if (appInfo) {
        appInfo.textContent = `${appName} ${appVer}`;
    }
}); 