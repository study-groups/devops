/**
 * @file client/keyboardShortcuts.js
 * @description Initializes the keyboard shortcut manager for the application.
 * This file centralizes the setup of keyboard shortcuts.
 */

import { KeyboardShortcutManager } from './keyboard/KeyboardShortcutManager.js';

/**
 * Initializes the application's keyboard shortcuts.
 * This function should be called once during the application's startup process.
 */
export function initializeKeyboardShortcuts() {
    // Create a new instance of the manager
    const shortcutManager = new KeyboardShortcutManager();

    // Initialize it, which builds the shortcut map and attaches the listener
    shortcutManager.initialize();

    // For debugging purposes, you can log the initialized shortcuts
    console.log('Keyboard shortcuts initialized.');

    // Optionally, you could attach the manager to a global namespace if needed elsewhere,
    // but it's generally better to keep it self-contained.
    // window.APP = window.APP || {};
    // window.APP.shortcutManager = shortcutManager;
}
