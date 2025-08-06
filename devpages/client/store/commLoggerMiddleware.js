// client/store/commLoggerMiddleware.js
import { logReduxAction } from './slices/commSlice.js';

export const commLoggerMiddleware = store => next => action => {
    // We don't want to log our own logging actions, or we'll get an infinite loop.
    if (action.type !== logReduxAction.type) {
        const logEntry = {
            type: action.type,
            payload: action.payload,
            timestamp: new Date().toISOString()
        };
        store.dispatch(logReduxAction(logEntry));
    }

    return next(action);
};
