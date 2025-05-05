import { ActionTypes } from '/client/messaging/messageQueue.js';

const LOG_VISIBLE_KEY = 'logVisible';

// --- UI Slice Reducer ---
export function uiReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch (type) {
        case ActionTypes.UI_SET_LOADING:
            nextState = { ...state, isLoading: !!payload };
            break;

        case ActionTypes.UI_SET_LOG_VISIBILITY:
            const newVisibility = !!payload;
            nextState = { ...state, logVisible: newVisibility };
            try {
                localStorage.setItem(LOG_VISIBLE_KEY, newVisibility);
            } catch (e) { console.error('[Reducer] Failed to save log visibility state to localStorage:', e); }
            break;

        case ActionTypes.UI_TOGGLE_LOG_VISIBILITY:
            const toggledVisibility = !state.logVisible;
            nextState = { ...state, logVisible: toggledVisibility };
            try {
                localStorage.setItem(LOG_VISIBLE_KEY, toggledVisibility);
            } catch (e) { console.error('[Reducer] Failed to save log visibility state to localStorage:', e); }
            break;

        case ActionTypes.UI_SET_VIEW_MODE:
            if (payload && typeof payload.viewMode === 'string' && ['editor', 'preview', 'split'].includes(payload.viewMode)) {
                nextState = { ...state, viewMode: payload.viewMode };
                // try { localStorage.setItem('viewMode', payload.viewMode); } catch(e) {}
            } else if (payload) {
                console.warn(`[Reducer UI_SET_VIEW_MODE] Invalid view mode received: ${payload.viewMode}`);
            }
            break;
    }
    // Ensure initial state if state is undefined
    return nextState || { isLoading: false, logVisible: false, viewMode: 'split' };
}
