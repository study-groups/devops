/**
 * client/store/slices/contextSettingsSlice.js
 *
 * This slice manages the state of the ContextSettingsPopupComponent, including its
 * visibility, position, size, and heartbeat functionality.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    isVisible: false,
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    position: { x: 50, y: 50 },
    size: { width: 400, height: 300 },
    collapsed: false,
    heartbeatIntervalMs: 5000,
    heartbeatTimer: null,
    heartbeatRunning: false,
    heartbeatRefreshFileList: false,
    heartbeatCheckServer: false,
};

const contextSettingsSlice = createSlice({
    name: 'contextSettings',
    initialState,
    reducers: {
        show(state) {
            state.isVisible = true;
        },
        hide(state) {
            state.isVisible = false;
        },
        toggleCollapsed(state) {
            state.collapsed = !state.collapsed;
        },
        updatePosition(state, action) {
            state.position = action.payload;
        },
        updateSize(state, action) {
            state.size = action.payload;
        },
        startDrag(state, action) {
            state.isDragging = true;
            state.dragOffset = action.payload;
        },
        stopDrag(state) {
            state.isDragging = false;
        },
        startResize(state) {
            state.isResizing = true;
        },
        stopResize(state) {
            state.isResizing = false;
        },
        updateHeartbeatInterval(state, action) {
            state.heartbeatIntervalMs = action.payload;
        },
        toggleHeartbeatRefresh(state) {
            state.heartbeatRefreshFileList = !state.heartbeatRefreshFileList;
        },
        toggleHeartbeatCheckServer(state) {
            state.heartbeatCheckServer = !state.heartbeatCheckServer;
        },
        startHeartbeat(state, action) {
            state.heartbeatRunning = true;
            state.heartbeatTimer = action.payload;
        },
        stopHeartbeat(state) {
            state.heartbeatRunning = false;
            state.heartbeatTimer = null;
        },
    },
});

export const {
    show,
    hide,
    toggleCollapsed,
    updatePosition,
    updateSize,
    startDrag,
    stopDrag,
    startResize,
    stopResize,
    updateHeartbeatInterval,
    toggleHeartbeatRefresh,
    toggleHeartbeatCheckServer,
    startHeartbeat,
    stopHeartbeat,
} = contextSettingsSlice.actions;

export const contextSettingsReducer = contextSettingsSlice.reducer;
