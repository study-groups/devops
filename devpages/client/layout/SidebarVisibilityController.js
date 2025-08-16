/**
 * SidebarVisibilityController.js
 * ✅ MODERNIZED: Bridges Redux UI state to DOM sidebar visibility with enhanced selectors
 */

import { appStore } from '/client/appState.js';
import { getUIState } from '/client/store/enhancedSelectors.js';

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

        // ✅ MODERNIZED: Subscribe with memoized state comparison
        let lastUIState = null;
        this.storeUnsubscribe = appStore.subscribe(() => {
            const uiState = getUIState(appStore.getState());
            if (uiState === lastUIState) return; // Skip if UI state unchanged
            lastUIState = uiState;
            this.updateSidebarVisibility();
        });

        // Apply initial state
        this.updateSidebarVisibility();
        
        console.log('[SidebarVisibilityController] Initialized and subscribed to Redux store');
    }

    updateSidebarVisibility() {
        if (!this.sidebarElement) return;

        // ✅ MODERNIZED: Use enhanced selector instead of direct state access
        const uiState = getUIState(appStore.getState());
        const isVisible = uiState.sidebarVisible; // Enhanced selector handles defaults

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
