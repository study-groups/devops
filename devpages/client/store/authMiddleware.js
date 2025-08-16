/**
 * client/store/authMiddleware.js
 *
 * Auth Middleware for Redux
 * This middleware is responsible for triggering the initial authentication check
 * when the Redux store is initialized. This ensures that the application always
 * has the most up-to-date user session information.
 */

import { authThunks } from './slices/authSlice.js';

/**
 * Creates a middleware that triggers the `initializeAuth` thunk on initialization.
 *
 * @param {object} store - The Redux store instance.
 * @returns {function} The middleware function.
 */
export const authMiddleware = store => next => action => {
  // We only want to run this once on initialization
  if (action.type === '@@redux/INIT') {
    // Dispatch the initializeAuth thunk to verify the user's session
store.dispatch(authThunks.initializeAuth());
  }
  return next(action);
};