/**
 * StateKit - Lightweight, reactive state management library
 */

export interface Action {
  type: string;
  payload?: any;
}

export interface Store<T = any> {
  getState: () => T;
  dispatch: (action: Action) => void;
  subscribe: (listener: (newState: T, prevState: T, action?: Action) => void) => () => void;
}

export interface Middleware<T = any> {
  (api: { getState: () => T; dispatch: (action: Action) => void }): (
    next: (action: Action) => void
  ) => (action: Action) => void;
}

export interface LoggerOptions {
  collapsed?: boolean;
  duration?: boolean;
  timestamp?: boolean;
  colors?: boolean;
}

/**
 * Creates a simple reactive state container.
 */
export function createStore<T>(
  reducer: (state: T, action: Action) => T,
  initialState: T,
  middleware?: Middleware<T>[]
): Store<T>;

/**
 * Creates a logger middleware.
 */
export function createLogger(options?: LoggerOptions): Middleware;

/**
 * Creates a thunk middleware for handling async actions.
 */
export function createThunk(): Middleware; 