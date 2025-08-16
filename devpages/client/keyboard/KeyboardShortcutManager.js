/**
 * @file client/keyboard/KeyboardShortcutManager.js
 * @description Manages keyboard shortcuts for the application.
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';
import { appStore } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';

export class KeyboardShortcutManager {
    constructor() {
        this.shortcutMap = new Map();
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    /**
     * Initializes the manager, builds the shortcut map, and attaches the listener.
     */
    initialize() {
        this.buildShortcutMap();
        window.addEventListener('keydown', this._handleKeyDown);
        console.log('KeyboardShortcutManager initialized.');
    }

    /**
     * Builds a map of shortcut strings to panel IDs from the panel registry.
     */
    buildShortcutMap() {
        const panels = panelRegistry.getAllPanels();
        for (const panel of panels) {
            if (panel.shortcut) {
                this.shortcutMap.set(panel.shortcut.toLowerCase(), panel.id);
            }
        }
        console.log('Shortcut map built:', this.shortcutMap);
    }

    /**
     * Handles the keydown event.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    _handleKeyDown(e) {
        // Ignore shortcuts when an input field is focused
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        const shortcut = this.getShortcutFromEvent(e);
        if (this.shortcutMap.has(shortcut)) {
            e.preventDefault();
            const panelId = this.shortcutMap.get(shortcut);
            const panel = panelRegistry.getPanel(panelId);

            if (!panel) {
                console.warn(`Shortcut triggered for non-existent panel: ${panelId}`);
                return;
            }

            // Handle panels that are just actions (like toggling a manager)
            if (panel.group === 'manager' && typeof panel.onActivate === 'function') {
                panel.onActivate();
                return;
            }

            // Otherwise, toggle visibility for regular panels
            this.togglePanelVisibility(panelId);
        }
    }

    /**
     * Generates a normalized shortcut string from a keyboard event.
     * @param {KeyboardEvent} e - The keyboard event.
     * @returns {string} A normalized shortcut string (e.g., "ctrl+shift+f").
     */
    getShortcutFromEvent(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.metaKey) parts.push('meta'); // For Mac Command key
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        
        // Avoid adding modifier keys themselves as the main key
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
            parts.push(e.key.toLowerCase());
        }

        return parts.join('+');
    }

    /**
     * Toggles the visibility of a panel.
     * @param {string} panelId - The ID of the panel to toggle.
     */
    togglePanelVisibility(panelId) {
        // Dispatch the Redux action to toggle visibility.
        // The panelSlice reducer will handle the state update, and React will re-render.
        appStore.dispatch(panelActions.togglePanelVisibility({ panelId }));
    }

    /**
     * Detaches the event listener.
     */
    destroy() {
        window.removeEventListener('keydown', this._handleKeyDown);
        console.log('KeyboardShortcutManager destroyed.');
    }
} 