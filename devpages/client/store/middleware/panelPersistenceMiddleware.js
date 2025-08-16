/**
 * @module panelPersistenceMiddleware
 * @description This middleware is responsible for persisting the state of the 'panels' slice
 * to localStorage. It listens for any action that modifies the panel state and saves
 * the updated state, ensuring UI state is preserved across sessions.
 */
import { storageService } from '/client/services/storageService.js';

const PANEL_STATE_KEY = 'panel_state';

const panelPersistenceMiddleware = store => next => action => {
    // Let the action proceed to the reducer first to update the state
    const result = next(action);

    // After the state is updated, check if the action was related to panels
    if (action.type.startsWith('panels/')) {
        try {
            const state = store.getState();
            // We only need to persist the 'panels' slice of the state
            const panelState = state.panels;
            storageService.setItem(PANEL_STATE_KEY, panelState);
        } catch (e) {
            console.error('[Middleware] Failed to save panels state:', e);
        }
    }

    return result;
};

export default panelPersistenceMiddleware;
