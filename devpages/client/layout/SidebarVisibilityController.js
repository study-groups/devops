/**
 * SidebarVisibilityController.js
 * Bridges Redux UI state to DOM sidebar visibility
 */

import { appStore } from '/client/appState.js';

export class SidebarVisibilityController {
    constructor() {
        this.sidebarElement = null;
        this.resizerElement = null;
        this.storeUnsubscribe = null;
        this.currentVisibility = null;
    }

    initialize() {
        // Find the sidebar elements
        this.sidebarElement = document.querySelector('.workspace-sidebar');
        this.resizerElement = document.querySelector('#resizer-left');

        if (!this.sidebarElement) {
            console.warn('[SidebarVisibilityController] .workspace-sidebar element not found');
            return;
        }

        // Subscribe to Redux store changes
        this.storeUnsubscribe = appStore.subscribe(() => {
            this.updateSidebarVisibility();
        });

        // Apply initial state
        this.updateSidebarVisibility();
        
        console.log('[SidebarVisibilityController] Initialized and subscribed to Redux store');
    }

    updateSidebarVisibility() {
        if (!this.sidebarElement) return;

        const state = appStore.getState();
        const isVisible = state.ui?.leftSidebarVisible !== false; // Default to true if undefined

        // Only update if visibility changed
        if (this.currentVisibility === isVisible) return;

        this.currentVisibility = isVisible;

        if (isVisible) {
            // Show sidebar
            this.sidebarElement.classList.remove('hidden');
            this.sidebarElement.setAttribute('data-visible', 'true');
            
            // Show resizer
            if (this.resizerElement) {
                this.resizerElement.style.display = '';
            }
            
            console.log('[SidebarVisibilityController] Sidebar shown');
        } else {
            // Hide sidebar
            this.sidebarElement.classList.add('hidden');
            this.sidebarElement.setAttribute('data-visible', 'false');
            
            // Hide resizer
            if (this.resizerElement) {
                this.resizerElement.style.display = 'none';
            }
            
            console.log('[SidebarVisibilityController] Sidebar hidden');
        }
    }

    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
    }
}

// Create singleton instance
export const sidebarVisibilityController = new SidebarVisibilityController();
