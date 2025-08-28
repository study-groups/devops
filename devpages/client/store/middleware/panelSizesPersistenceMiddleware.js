/**
 * @module panelSizesPersistenceMiddleware
 * @description This middleware is responsible for persisting the state of the 'panelSizes' slice
 * to localStorage. It listens for the SET_PANEL_SIZE action and saves the updated state.
 */
import { storageService } from '/client/services/storageService.js';

const PANEL_SIZES_KEY = 'panel_sizes';

const panelSizesPersistenceMiddleware = store => next => action => {
    const result = next(action);

    if (action.type.startsWith('panelSizes/')) {
        try {
            const state = store.getState();
            const panelSizesState = state.panelSizes;
            storageService.setItem(PANEL_SIZES_KEY, panelSizesState);
        } catch (e) {
            console.error('[Middleware] Failed to save panel sizes state:', e);
        }
    }

    return result;
};

export default panelSizesPersistenceMiddleware;
