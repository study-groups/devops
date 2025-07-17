/**
 * StateKit Lite - Minimal, pre-toolkit snapshot of StateKit
 */

interface Action {
  type: string;
  payload?: any;
}

interface Store<T = any> {
  getState: () => T;
  dispatch: (action: Action) => void;
  subscribe: (listener: (newState: T, prevState: T, action?: Action) => void) => () => void;
}

interface Middleware<T = any> {
  (api: { getState: () => T; dispatch: (action: Action) => void }): (
    next: (action: Action) => void
  ) => (action: Action) => void;
}

interface LoggerOptions {
  collapsed?: boolean;
  duration?: boolean;
  timestamp?: boolean;
  colors?: boolean;
}

/**
 * Creates a simple reactive state container (lite version).
 */
declare function createStore<T>(
  reducer: (state: T, action: Action) => T,
  initialState: T,
  middleware?: Middleware<T>[]
): Store<T>;

/**
 * Creates a logger middleware (lite version).
 */
declare function createLogger(options?: LoggerOptions): Middleware;

export { Action, LoggerOptions, Middleware, Store, createLogger, createStore };
