/**
 * Utility functions for creating and working with reducers
 */

/**
 * Creates a reducer function from an initial state and a map of action type handlers
 * This promotes cleaner reducer code by eliminating repetitive switch statements
 * 
 * @param {Object} initialState - The initial state for this slice
 * @param {Object} handlers - Map of action types to handler functions
 * @returns {Function} A reducer function
 * 
 * @example
 * 
 * const uiReducer = createReducer({ logVisible: false }, {
 *   [ActionTypes.UI_SET_LOG_VISIBILITY]: (state, action) => ({
 *     ...state,
 *     logVisible: action.payload
 *   })
 * });
 */
export const createReducer = (initialState, handlers) => {
  return (state = initialState, action) => {
    if (handlers.hasOwnProperty(action.type)) {
      return handlers[action.type](state, action);
    }
    return state;
  };
};

/**
 * Helper to create a state persistence function
 * 
 * @param {String} key - localStorage key
 * @param {Function} selector - Function to select data from state
 * @returns {Function} Persistence function that can be called with state
 */
export const createPersister = (key, selector) => {
  return (state) => {
    try {
      const dataToStore = selector(state);
      localStorage.setItem(key, JSON.stringify(dataToStore));
      return true;
    } catch (e) {
      console.error(`Failed to persist ${key} to localStorage:`, e);
      return false;
    }
  };
};

/**
 * Helper to load state from localStorage
 * 
 * @param {String} key - localStorage key
 * @param {*} defaultValue - Default value if key doesn't exist or is invalid
 * @param {Function} validator - Optional function to validate loaded data
 * @returns {*} Retrieved value or default
 */
export const loadFromStorage = (key, defaultValue, validator = null) => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return defaultValue;
    
    const parsedValue = JSON.parse(storedValue);
    
    if (validator && !validator(parsedValue)) {
      console.warn(`Loaded value for ${key} failed validation, using default.`);
      return defaultValue;
    }
    
    return parsedValue;
  } catch (e) {
    console.error(`Error loading ${key} from localStorage:`, e);
    return defaultValue;
  }
}; 