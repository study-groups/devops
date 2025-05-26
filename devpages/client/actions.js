// actions.js - Centralized action handlers (Legacy version)
// This file now re-exports from the new modular system
// It's kept for backward compatibility
console.log('[DEBUG] actions.js: Module start');

import { 
    triggerActions, 
    initializeActions as initializeModularActions 
} from './actions/index.js';

// Re-export all the exports from the new actions system
export { triggerActions };

// Initialize all action handlers
export function initializeActions() {
    console.log('[DEBUG] Legacy actions.js: Delegating initialization to new modular system');
    // Call the new initialization function
    initializeModularActions();
}

// Backwards compatibility - Map old functions if needed
export async function executeAction(action, params = {}) {
    console.log(`[LEGACY] Executing: ${action}`);
    if (triggerActions[action]) {
        try {
            await triggerActions[action](params);
        } catch (error) {
            console.error(`[LEGACY ACTION ERROR] Failed to execute ${action}:`, error);
        }
    } else {
        console.warn(`[LEGACY] Action "${action}" not found in triggerActions`);
    }
}

// Log success message
console.log('[DEBUG] Legacy actions.js: Successfully loaded new action system');
