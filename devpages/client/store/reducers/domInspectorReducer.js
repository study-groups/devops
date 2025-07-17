/**
 * client/store/reducers/domInspectorReducer.js
 * Reducer for the DOM Inspector panel state.
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';
import { createReducer } from './reducerUtils.js';

const MAX_HISTORY_LENGTH = 10;

// Default initial state for DOM Inspector
const initialState = {
    visible: false,
    position: { x: 100, y: 100 },
    size: { width: 800, height: 600 },
    splitPosition: 33,
    selectorHistory: [],
    collapsedSections: {},
    highlight: {
        enabled: true,
        color: '#ff6b6b',
        opacity: 0.3,
        borderColor: '#ff4757',
        borderWidth: 2
    },
    computedStyleFilter: {
        selectedGroup: 'all',
        showOnlyGroup: false
    },
    treeState: {
        expandedNodes: [],
        selectedElementId: null,
        scrollPosition: 0
    },
    selectedElement: null
};

export function domInspectorReducer(state = initialState, action) {
    switch (action.type) {
        case ActionTypes.DOM_INSPECTOR_SET_STATE:
            return { ...state, ...action.payload };

        case ActionTypes.DOM_INSPECTOR_SET_VISIBLE:
            return { ...state, visible: action.payload };

        case ActionTypes.DOM_INSPECTOR_SET_POSITION:
            return { ...state, position: action.payload };

        case ActionTypes.DOM_INSPECTOR_SET_SIZE:
            return { ...state, size: action.payload };

        case ActionTypes.DOM_INSPECTOR_SET_SPLIT_POSITION:
            return { ...state, splitPosition: action.payload };

        case ActionTypes.DOM_INSPECTOR_ADD_SELECTOR_HISTORY: {
            const newHistory = [action.payload, ...state.selectorHistory.filter(item => item !== action.payload)];
            if (newHistory.length > MAX_HISTORY_LENGTH) {
                newHistory.pop();
            }
            return { ...state, selectorHistory: newHistory };
        }

        case ActionTypes.DOM_INSPECTOR_REMOVE_SELECTOR_HISTORY: {
            return {
                ...state,
                selectorHistory: state.selectorHistory.filter(item => item !== action.payload)
            };
        }

        case ActionTypes.DOM_INSPECTOR_SET_SECTION_COLLAPSED: {
            const { id, collapsed } = action.payload;
            return {
                ...state,
                collapsedSections: {
                    ...state.collapsedSections,
                    [id]: collapsed
                }
            };
        }

        case ActionTypes.DOM_INSPECTOR_SET_STYLE_FILTER_GROUP:
            return {
                ...state,
                computedStyleFilter: {
                    ...state.computedStyleFilter,
                    selectedGroup: action.payload
                }
            };

        case ActionTypes.DOM_INSPECTOR_SET_STYLE_FILTER_ENABLED:
            return {
                ...state,
                computedStyleFilter: {
                    ...state.computedStyleFilter,
                    showOnlyGroup: action.payload
                }
            };

        case ActionTypes.DOM_INSPECTOR_SET_HIGHLIGHT:
            return {
                ...state,
                highlight: action.payload
            };

        case ActionTypes.DOM_INSPECTOR_SET_TREE_STATE:
            return {
                ...state,
                treeState: action.payload
            };

        case ActionTypes.DOM_INSPECTOR_SET_SELECTED_ELEMENT:
            return {
                ...state,
                selectedElement: action.payload
            };
            
        default:
            return state;
    }
} 