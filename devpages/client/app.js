/**
 * @file app.js
 * @description Main application entry point.
 * This file imports all major UI components to ensure they register with the UIManager,
 * and then starts the application by calling UIManager.init().
 */

import { UIManager } from './ui/UIManager.js';

// Import UI components
// By importing them here, we ensure their registration code runs.
import './components/topBar.js';
import './components/Editor.js';
import './components/Preview.js';
// Add any other primary UI components here in the future.

// Initialize the application once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM ready. Initializing UI Manager...');
    UIManager.init();
}); 