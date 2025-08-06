/**
 * KeyboardShortcutHandler.js - Global keyboard shortcut manager
 * 
 * Handles keyboard shortcuts for panels and docks.
 * Integrates with Redux to store and manage shortcuts.
 */

import * as panelActions from '/client/store/slices/panelSlice.js';
import { uiActions } from '/client/store/uiSlice.js';

export class KeyboardShortcutHandler {
    constructor(dispatch, getState) {
        this.dispatch = dispatch;
        this.getState = getState;
        this.activeModifiers = new Set();
        
        this.log = (message, level = 'info') => 
            console.log(`[KeyboardShortcuts] ${message}`);
    }
    
    init() {
        this.setupEventListeners();
        this.log('Keyboard shortcut handler initialized');
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    handleKeyDown(e) {
        try {
            // Track modifier keys
            if (e.ctrlKey || e.metaKey) this.activeModifiers.add('ctrl');
            if (e.shiftKey) this.activeModifiers.add('shift');
            if (e.altKey) this.activeModifiers.add('alt');
            
            // Check for shortcuts
            const state = this.getState();
            if (!state || !state.panels) {
                return;
            }
            
            const shortcuts = state.panels.shortcuts || {};
            
            // Safety check for shortcuts object
            if (!shortcuts || typeof shortcuts !== 'object') {
                return;
            }
            
            // Ensure shortcuts is not empty and iterate safely
            const shortcutEntries = Object.entries(shortcuts);
            if (shortcutEntries.length === 0) {
                return;
            }
            
            for (const [id, shortcut] of shortcutEntries) {
                // Skip if id or shortcut is invalid
                if (!id || !shortcut) {
                    continue;
                }
                
                if (this.matchesShortcut(e, shortcut)) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    this.log(`Triggered shortcut for: ${id}`);
                    this.handleShortcutAction(id);
                    
                    // Show visual feedback
                    this.showShortcutFeedback(shortcut, id);
                    return;
                }
            }
        } catch (error) {
            this.log(`Error in handleKeyDown: ${error.message}`, 'error');
        }
    }
    
    handleKeyUp(e) {
        // Clear modifiers
        if (!e.ctrlKey && !e.metaKey) this.activeModifiers.delete('ctrl');
        if (!e.shiftKey) this.activeModifiers.delete('shift');
        if (!e.altKey) this.activeModifiers.delete('alt');
    }
    
    matchesShortcut(event, shortcut) {
        // Safety check for event
        if (!event || !event.key || typeof event.key !== 'string') {
            // Only log if it's not a common system key that we can ignore
            const ignorableKeys = ['Dead', 'Unidentified', 'Process', undefined, null];
            if (!event || !ignorableKeys.includes(event.key)) {
                // Only log occasionally to avoid spam (1% chance)
                if (Math.random() < 0.01) {
                    this.log(`Invalid event key (${event ? event.key : 'null event'}) - ignoring`, 'debug');
                }
            }
            return false;
        }
        
        // Safety check for undefined shortcut
        if (!shortcut || typeof shortcut !== 'object') {
            this.log(`Invalid shortcut object: ${shortcut}`, 'warn');
            return false;
        }
        
        // Safety check for required properties and valid key value
        if (!shortcut.hasOwnProperty('key') || !shortcut.key || typeof shortcut.key !== 'string') {
            this.log(`Shortcut missing or invalid key property: ${JSON.stringify(shortcut)}`, 'warn');
            return false;
        }
        
        // Check key
        if (event.key.toUpperCase() !== shortcut.key.toUpperCase()) {
            return false;
        }
        
        // Check modifiers
        const requiredCtrl = shortcut.ctrl || false;
        const requiredShift = shortcut.shift || false;
        const requiredAlt = shortcut.alt || false;
        
        const hasCtrl = event.ctrlKey || event.metaKey;
        const hasShift = event.shiftKey;
        const hasAlt = event.altKey;
        
        return hasCtrl === requiredCtrl && 
               hasShift === requiredShift && 
               hasAlt === requiredAlt;
    }
    
    showShortcutFeedback(shortcut, id) {
        // Create visual feedback element
        const feedback = document.createElement('div');
        feedback.className = 'keyboard-shortcut-feedback';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: var(--color-primary);
            color: var(--color-primary-foreground);
            padding: var(--space-2) var(--space-3);
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            z-index: var(--z-toast);
            box-shadow: var(--shadow-lg);
            animation: shortcutFeedback 2s ease-out forwards;
            pointer-events: none;
        `;
        
        const keyCombo = this.formatShortcut(shortcut);
        feedback.innerHTML = `
            <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span style="font-family: var(--font-family-mono, monospace);">${keyCombo}</span>
                <span>→</span>
                <span>${shortcut.description || id}</span>
            </div>
        `;
        
        // Add CSS animation if not already present
        if (!document.querySelector('style[data-shortcut-feedback]')) {
            const style = document.createElement('style');
            style.setAttribute('data-shortcut-feedback', 'true');
            style.textContent = `
                @keyframes shortcutFeedback {
                    0% {
                        opacity: 0;
                        transform: translateX(100px) scale(0.8);
                    }
                    20% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                    80% {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateX(50px) scale(0.9);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(feedback);
        
        // Remove after animation
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }
    
    formatShortcut(shortcut) {
        const parts = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.shift) parts.push('Shift');
        if (shortcut.alt) parts.push('Alt');
        parts.push(shortcut.key.toUpperCase());
        return parts.join('+');
    }
    
    registerShortcut(id, shortcut) {
        this.dispatch(panelActions.registerShortcut({ id, shortcut }));
        this.log(`Registered shortcut: ${this.formatShortcut(shortcut)} for ${id}`);
    }
    
    unregisterShortcut(id) {
        this.dispatch(panelActions.unregisterShortcut({ id }));
        this.log(`Unregistered shortcut for: ${id}`);
    }
    
    getRegisteredShortcuts() {
        const state = this.getState();
        return state.panels?.shortcuts || {};
    }
    
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        this.log('Keyboard shortcut handler destroyed');
    }
    
    handleShortcutAction(id) {
        console.log(`[KeyboardShortcuts] HANDLING SHORTCUT: ${id}`);
        const state = this.getState();
        
        // Mapping from dock ID to uiSlice action
        const dockActionMap = {
            'sidebar-dock': () => this.dispatch(uiActions.toggleLeftSidebar()),
            'editor-dock': () => this.dispatch(uiActions.toggleEditor()),
            'preview-dock': () => this.dispatch(uiActions.togglePreview()),
        };

        // Handle special reset action - DISABLED (moved to package debug system)
        if (id === 'reset-defaults') {
            console.log('☢️ Reset shortcut DISABLED - Redux panel system deprecated');
            console.log('🎯 Use Ctrl+Shift+D to access the new debug system instead');
            return;
        }
        
        // Handle dock shortcuts
        if (dockActionMap[id]) {
            console.log(`[KeyboardShortcuts] DOCK SHORTCUT: ${id}`);
            dockActionMap[id]();
            return;
        }
        
        // Handle panel shortcuts  
        if (state.panels.panels[id]) {
            const panel = state.panels.panels[id];
            console.log(`[KeyboardShortcuts] PANEL SHORTCUT: ${id}, current visible: ${panel.isVisible}`);
            
            this.dispatch(panelActions.togglePanelVisibility({ panelId: id }));

            // Ensure the dock is visible when showing a panel
            if (!panel.isVisible && panel.dockId && dockActionMap[panel.dockId]) {
                const dockState = state.ui;
                let dockIsVisible = true;
                if (panel.dockId === 'sidebar-dock') dockIsVisible = dockState.leftSidebarVisible;
                if (panel.dockId === 'editor-dock') dockIsVisible = dockState.editorVisible;
                if (panel.dockId === 'preview-dock') dockIsVisible = dockState.previewVisible;

                if (!dockIsVisible) {
                    dockActionMap[panel.dockId]();
                }
            }
            
            // Activate the panel in its dock
            this.dispatch(panelActions.activatePanel({ panelId: id }));
            this.log(`Activated panel in dock: ${id} in ${panel.dockId}`);
            
            return;
        }
        
        console.warn(`[KeyboardShortcuts] No handler found for shortcut: ${id}`);
    }
} 