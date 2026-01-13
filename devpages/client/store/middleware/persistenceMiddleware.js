/**
 * persistenceMiddleware.js
 *
 * This middleware listens for specific actions and saves parts of the Redux state
 * to localStorage, creating a robust persistence layer. It's designed to be
 * selective, only persisting state when necessary to optimize performance.
 */
import { storageService } from '/client/services/storageService.js';
import { debounce } from '/client/utils/debounce.js';

const PERSISTED_SLICES = ['panels', 'ui', 'settings', 'publishConfig', 'log', 'dataMount'];

const debouncedSave = debounce((state) => {
    try {
        for (const sliceName of PERSISTED_SLICES) {
            const stateToPersist = state[sliceName];
            if (stateToPersist) {
                storageService.setItem(sliceName, stateToPersist);
            }
        }
        console.log(`[PersistenceMiddleware] Persisted state for slices: ${PERSISTED_SLICES.join(', ')}`);
    } catch (error) {
        console.error(`[PersistenceMiddleware] Failed to persist state:`, {
            error: error.message,
            stack: error.stack,
        });
    }
}, 1000); 

export const persistenceMiddleware = store => next => action => {
    const result = next(action);
    const state = store.getState();

    const actionType = action.type;
    const sliceName = actionType.split('/')[0];

    if (PERSISTED_SLICES.includes(sliceName)) {
        if (sliceName === 'ui') {
            console.log('[PersistenceMiddleware] 🔍 UI ACTION TRIGGERED:', {
                action: actionType,
                payload: action.payload,
                'state.ui.logVisible BEFORE save': state.ui?.logVisible,
                willSaveIn: '1000ms (debounced)'
            });
        }
        debouncedSave(state);
    }

    return result;
};
