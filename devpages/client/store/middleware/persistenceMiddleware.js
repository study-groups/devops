/**
 * persistenceMiddleware.js
 *
 * This middleware listens for specific actions and saves parts of the Redux state
 * to localStorage, creating a robust persistence layer. It's designed to be
 * selective, only persisting state when necessary to optimize performance.
 */
import { storageService } from '../../services/storageService.js';

const PERSISTED_SLICES = ['panels', 'ui', 'settings'];

export const persistenceMiddleware = store => next => action => {
    const result = next(action);
    const state = store.getState();

    const actionType = action.type;
    const sliceName = actionType.split('/')[0];

    // Only persist if the action belongs to a slice that is on the persisted list
    if (PERSISTED_SLICES.includes(sliceName)) {
        try {
            const stateToPersist = state[sliceName];
            if (stateToPersist) {
                // Deep clone to handle complex nested states
                const plainState = JSON.parse(JSON.stringify(stateToPersist));
                
                // Special handling for panels to preserve important state
                if (sliceName === 'panels') {
                    // Ensure panels are not lost during state updates
                    const currentPersistedState = storageService.getItem('panels') || {};
                    // Merge the entire panels state, not just the panels.panels property
                    const mergedState = {
                        ...currentPersistedState,
                        ...plainState,
                        // Specifically merge the nested panels object
                        panels: {
                            ...currentPersistedState.panels,
                            ...plainState.panels
                        }
                    };
                    Object.assign(plainState, mergedState);
                }

                // Log detailed state before persisting
                console.log(`[PersistenceMiddleware] Persisting ${sliceName} state:`, plainState);

                storageService.setItem(sliceName, plainState);
                console.log(`[PersistenceMiddleware] Persisted state for slice: ${sliceName}`);
            }
        } catch (error) {
            console.warn(`[PersistenceMiddleware] Failed to persist state for slice ${sliceName}:`, error);
        }
    }

    return result;
};
