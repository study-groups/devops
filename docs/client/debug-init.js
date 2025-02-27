// debug-init.js - Ensures all debug functions are properly registered with window
import { debugUI, testApiEndpoints, debugFileOperations, debugApiResponses, testFileLoading } from './debug.js';

// Register all debug functions with window
window.debugUI = debugUI;
window.testApiEndpoints = testApiEndpoints;
window.debugFileOperations = debugFileOperations;
window.debugApiResponses = debugApiResponses;
window.testFileLoading = testFileLoading;

console.log('[DEBUG] Debug functions initialized and registered with window'); 