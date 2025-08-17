import { uiReducer, uiActions } from './uiSlice.js';

describe('uiSlice', () => {
    it('should handle initial state', () => {
        expect(uiReducer(undefined, { type: 'unknown' })).toEqual({
            theme: 'light',
            viewMode: 'preview',
            logVisible: false,
            logHeight: 120,
            logMenuVisible: false,
            leftSidebarVisible: false,
            editorVisible: true,
            previewVisible: true,
            contextManagerVisible: true,
            colorScheme: 'system',
            designDensity: 'normal',
        });
    });

    it('should handle toggleLogVisibility', () => {
        const initialState = {
            theme: 'light',
            viewMode: 'preview',
            logVisible: false,
            logHeight: 120,
            logMenuVisible: false,
            leftSidebarVisible: false,
            editorVisible: true,
            previewVisible: true,
            contextManagerVisible: true,
            colorScheme: 'system',
            designDensity: 'normal',
        };
        const action = uiActions.toggleLogVisibility();
        const nextState = uiReducer(initialState, action);
        expect(nextState.logVisible).toEqual(true);
    });
});
