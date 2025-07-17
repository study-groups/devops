import { ActionTypes } from '/client/messaging/actionTypes.js';

const DEBUG_PANEL_STATE_KEY = 'devpages_debug_panel_state';
const DEBUG_PANEL_SECTIONS_KEY = 'devpages_debug_panel_sections';
const DEBUG_PANEL_ACTIVE_KEY = 'devpages_debug_panel_active';

/**
 * Load debug panel state from localStorage with fallback to defaults
 */
function loadPersistedDebugState() {
    const defaults = {
        visible: false,
        position: { x: 150, y: 150 },
        size: { width: 500, height: 400 },
        panels: [
            { id: 'state', title: 'State Inspector', visible: true, order: 0, enabled: true },
            { id: 'dom-inspector', title: 'DOM Inspector', visible: true, order: 1, enabled: true },
            { id: 'network', title: 'Network', visible: false, order: 2, enabled: false },
            { id: 'console', title: 'Console', visible: false, order: 3, enabled: false },
            { id: 'performance', title: 'Performance', visible: false, order: 4, enabled: false },
            { id: 'storage', title: 'Storage', visible: false, order: 5, enabled: false }
        ],
        activePanel: 'state',
        // Start with all visible panels collapsed by default
        collapsedSections: ['state', 'dom-inspector']
    };

    try {
        // Load main debug panel state
        const savedState = localStorage.getItem(DEBUG_PANEL_STATE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed && typeof parsed === 'object') {
                defaults.visible = parsed.visible || false;
                defaults.position = parsed.position || defaults.position;
                defaults.size = parsed.size || defaults.size;
                defaults.activePanel = parsed.activePanel || defaults.activePanel;
            }
        }

        // Load panel configurations
        const savedPanels = localStorage.getItem(DEBUG_PANEL_SECTIONS_KEY);
        if (savedPanels) {
            const parsed = JSON.parse(savedPanels);
            if (Array.isArray(parsed)) {
                // Merge saved panels with defaults, keeping default structure
                const mergedPanels = defaults.panels.map(defaultPanel => {
                    const savedPanel = parsed.find(p => p.id === defaultPanel.id);
                    return savedPanel ? { ...defaultPanel, ...savedPanel } : defaultPanel;
                });
                
                // Add any new panels from saved state that aren't in defaults
                parsed.forEach(savedPanel => {
                    if (!defaults.panels.find(p => p.id === savedPanel.id)) {
                        mergedPanels.push(savedPanel);
                    }
                });
                
                defaults.panels = mergedPanels;
            }
        }

        // Load collapsed sections
        const savedCollapsed = localStorage.getItem(DEBUG_PANEL_SECTIONS_KEY + '_collapsed');
        if (savedCollapsed) {
            const parsed = JSON.parse(savedCollapsed);
            if (Array.isArray(parsed)) {
                // Start with saved collapsed sections
                const collapsedSections = [...parsed];
                
                // Add any visible panels that aren't already in the collapsed sections
                // This ensures new panels default to collapsed
                defaults.panels.forEach(panel => {
                    if (panel.visible && !collapsedSections.includes(panel.id)) {
                        collapsedSections.push(panel.id);
                    }
                });
                
                defaults.collapsedSections = collapsedSections;
            }
        }

        console.debug('[DebugPanel] Loaded persisted state:', defaults);
        return defaults;
    } catch (error) {
        console.error('[DebugPanel] Error loading persisted state, using defaults:', error);
        return defaults;
    }
}

// Helper function to save state to localStorage
function saveDebugPanelState(state) {
    try {
        const stateToSave = {
            visible: state.visible,
            position: state.position,
            size: state.size,
            activePanel: state.activePanel
        };
        localStorage.setItem(DEBUG_PANEL_STATE_KEY, JSON.stringify(stateToSave));
        
        // Save panels configuration
        localStorage.setItem(DEBUG_PANEL_SECTIONS_KEY, JSON.stringify(state.panels));
        
        // Save collapsed sections
        localStorage.setItem(DEBUG_PANEL_SECTIONS_KEY + '_collapsed', JSON.stringify(state.collapsedSections));
        
        console.debug('[DebugPanel] Saved state to localStorage');
    } catch (error) {
        console.error('[DebugPanel] Failed to save state to localStorage:', error);
    }
}

// Initialize state with persisted values
const persistedState = loadPersistedDebugState();
const initialState = persistedState;

/**
 * Debug Panel Reducer
 */
export function debugPanelReducer(state = initialState, action) {
    const { type, payload } = action;
    let nextState = state;
    let updated = false;

    switch (type) {
        case ActionTypes.DEBUG_PANEL_TOGGLE:
            if (typeof payload === 'boolean') {
                nextState = { ...state, visible: payload };
                updated = true;
                console.debug(`[DebugPanel] Set visibility to: ${payload}`);
            } else {
                // Toggle current state
                nextState = { ...state, visible: !state.visible };
                updated = true;
                console.debug(`[DebugPanel] Toggled visibility to: ${!state.visible}`);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_POSITION:
            if (payload && typeof payload === 'object' && 
                typeof payload.x === 'number' && typeof payload.y === 'number') {
                nextState = { ...state, position: { ...payload } };
                updated = true;
                console.debug(`[DebugPanel] Set position to:`, payload);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_POSITION:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_SIZE:
            if (payload && typeof payload === 'object' && 
                typeof payload.width === 'number' && typeof payload.height === 'number') {
                nextState = { ...state, size: { ...payload } };
                updated = true;
                console.debug(`[DebugPanel] Set size to:`, payload);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_SIZE:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_STATE:
            if (payload && typeof payload === 'object') {
                nextState = { ...state, ...payload };
                updated = true;
                console.debug(`[DebugPanel] Set state to:`, payload);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_STATE:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_ACTIVE_PANEL:
            if (typeof payload === 'string' && payload.trim()) {
                // Validate that the panel exists
                const panelExists = state.panels.some(p => p.id === payload);
                if (panelExists) {
                    nextState = { ...state, activePanel: payload };
                    updated = true;
                    console.debug(`[DebugPanel] Set active panel to: ${payload}`);
                } else {
                    console.warn(`[DebugPanel] Panel "${payload}" does not exist`);
                }
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_ACTIVE_PANEL:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_TOGGLE_SECTION:
            if (payload && typeof payload.sectionId === 'string') {
                const sectionId = payload.sectionId;
                const collapsedSections = [...state.collapsedSections];
                const index = collapsedSections.indexOf(sectionId);
                
                if (index >= 0) {
                    collapsedSections.splice(index, 1);
                } else {
                    collapsedSections.push(sectionId);
                }
                
                nextState = { ...state, collapsedSections };
                updated = true;
                console.debug(`[DebugPanel] Toggled section ${sectionId}, collapsed sections:`, collapsedSections);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_TOGGLE_SECTION:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_PANEL_VISIBILITY:
            if (payload && typeof payload.panelId === 'string' && typeof payload.visible === 'boolean') {
                const panels = state.panels.map(panel => 
                    panel.id === payload.panelId 
                        ? { ...panel, visible: payload.visible }
                        : panel
                );
                nextState = { ...state, panels };
                updated = true;
                console.debug(`[DebugPanel] Set panel ${payload.panelId} visibility to: ${payload.visible}`);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_PANEL_VISIBILITY:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_PANEL_ENABLED:
            if (payload && typeof payload.panelId === 'string' && typeof payload.enabled === 'boolean') {
                const panels = state.panels.map(panel => 
                    panel.id === payload.panelId 
                        ? { ...panel, enabled: payload.enabled }
                        : panel
                );
                nextState = { ...state, panels };
                updated = true;
                console.debug(`[DebugPanel] Set panel ${payload.panelId} enabled to: ${payload.enabled}`);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_PANEL_ENABLED:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_SET_PANEL_ORDER:
            if (payload && typeof payload.panelId === 'string' && typeof payload.order === 'number') {
                const panels = state.panels.map(panel => 
                    panel.id === payload.panelId 
                        ? { ...panel, order: payload.order }
                        : panel
                );
                nextState = { ...state, panels };
                updated = true;
                console.debug(`[DebugPanel] Set panel ${payload.panelId} order to: ${payload.order}`);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_SET_PANEL_ORDER:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_REORDER_PANELS:
            if (Array.isArray(payload) && payload.every(item => 
                typeof item === 'object' && typeof item.id === 'string' && typeof item.order === 'number')) {
                const panels = state.panels.map(panel => {
                    const reorderInfo = payload.find(p => p.id === panel.id);
                    return reorderInfo ? { ...panel, order: reorderInfo.order } : panel;
                });
                nextState = { ...state, panels };
                updated = true;
                console.debug(`[DebugPanel] Reordered panels:`, payload);
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_REORDER_PANELS:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_ADD_PANEL:
            if (payload && typeof payload === 'object' && 
                typeof payload.id === 'string' && typeof payload.title === 'string') {
                const panelExists = state.panels.some(p => p.id === payload.id);
                if (!panelExists) {
                    const newPanel = {
                        id: payload.id,
                        title: payload.title,
                        visible: payload.visible !== undefined ? payload.visible : true,
                        enabled: payload.enabled !== undefined ? payload.enabled : true,
                        order: payload.order !== undefined ? payload.order : state.panels.length
                    };
                    
                    // Add visible panels to collapsed sections by default
                    const collapsedSections = [...state.collapsedSections];
                    if (newPanel.visible && !collapsedSections.includes(newPanel.id)) {
                        collapsedSections.push(newPanel.id);
                    }
                    
                    nextState = { 
                        ...state, 
                        panels: [...state.panels, newPanel],
                        collapsedSections 
                    };
                    updated = true;
                    console.debug(`[DebugPanel] Added panel:`, newPanel);
                } else {
                    console.warn(`[DebugPanel] Panel "${payload.id}" already exists`);
                }
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_ADD_PANEL:`, payload);
            }
            break;

        case ActionTypes.DEBUG_PANEL_REMOVE_PANEL:
            if (typeof payload === 'string' && payload.trim()) {
                const panels = state.panels.filter(panel => panel.id !== payload);
                if (panels.length !== state.panels.length) {
                    nextState = { ...state, panels };
                    // If we removed the active panel, switch to first available
                    if (state.activePanel === payload && panels.length > 0) {
                        nextState.activePanel = panels[0].id;
                    }
                    updated = true;
                    console.debug(`[DebugPanel] Removed panel: ${payload}`);
                } else {
                    console.warn(`[DebugPanel] Panel "${payload}" not found for removal`);
                }
            } else {
                console.warn(`[DebugPanel] Invalid payload for DEBUG_PANEL_REMOVE_PANEL:`, payload);
            }
            break;

        default:
            // No change for unrecognized actions
            break;
    }

    // Save state to localStorage if updated
    if (updated) {
        saveDebugPanelState(nextState);
    }

    return updated ? nextState : state;
} 