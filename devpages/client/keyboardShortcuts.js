/**
 * @file client/keyboardShortcuts.js
 * @description Initializes the keyboard shortcut manager for the application.
 * This file centralizes the setup of keyboard shortcuts.
 */

import keyboardShortcutManager from './utils/KeyboardShortcutManager.js';

/**
 * Initializes the application's keyboard shortcuts.
 * This function should be called once during the application's startup process.
 */
export function initializeKeyboardShortcuts() {
    // Use the singleton instance that's already created and initialized
    // The keyboardShortcutManager is already initialized in its module
    
    // For debugging purposes, you can log the initialized shortcuts
    console.log('Keyboard shortcuts initialized.');
    
    // The manager is already globally available as window.keyboardShortcutManager
    // and also available via window.APP.debug.shortcuts() for debugging
}
