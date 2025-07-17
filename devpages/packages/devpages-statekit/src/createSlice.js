/**
 * @file createSlice.js
 * @description A utility for creating state slices, including action creators and a reducer.
 * This simplifies the process of managing state in a Redux-like pattern.
 */

export function createSlice({ name, initialState, reducers }) {
    // Create action creators from the reducers object
    const actionCreators = Object.keys(reducers).reduce((acc, key) => {
        const type = `${name}/${key}`;
        acc[key] = (payload) => ({ type, payload });
        return acc;
    }, {});

    // Create the reducer function
    const reducer = (state = initialState, action) => {
        // Find the reducer for the given action type
        const caseReducer = Object.entries(reducers).find(([key]) => `${name}/${key}` === action.type);

        if (caseReducer) {
            const [, reducerFn] = caseReducer;
            return reducerFn(state, action);
        }

        return state;
    };

    return {
        name,
        reducer,
        actions: actionCreators,
    };
} 