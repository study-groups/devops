const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state';

const panelPersistenceMiddleware = store => next => action => {
    const result = next(action);
    const state = store.getState();

    if (action.type.startsWith('panels/')) {
        try {
            localStorage.setItem(SETTINGS_PANEL_STATE_KEY, JSON.stringify(state.panels));
        } catch (e) {
            console.error('[Middleware] Failed to save panels state:', e);
        }
    }

    return result;
};

export default panelPersistenceMiddleware; 