// client/store/slices/commSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    reduxActions: [],
    eventBusEvents: [],
    maxLogSize: 100, // To prevent the log from growing indefinitely
};

const commSlice = createSlice({
    name: 'communications',
    initialState,
    reducers: {
        logReduxAction: (state, action) => {
            state.reduxActions.unshift(action.payload);
            if (state.reduxActions.length > state.maxLogSize) {
                state.reduxActions.pop();
            }
        },
        logEventBusEvent: (state, action) => {
            state.eventBusEvents.unshift(action.payload);
            if (state.eventBusEvents.length > state.maxLogSize) {
                state.eventBusEvents.pop();
            }
        },
        clearLogs: (state) => {
            state.reduxActions = [];
            state.eventBusEvents = [];
        }
    }
});

export const { logReduxAction, logEventBusEvent, clearLogs } = commSlice.actions;
export const commReducer = commSlice.reducer;
