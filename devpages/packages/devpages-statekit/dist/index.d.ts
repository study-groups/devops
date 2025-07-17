/**
 * StateKit - Lightweight, reactive state management library
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
 * Creates a simple reactive state container.
 */
declare function createStore<T>(
  reducer: (state: T, action: Action) => T,
  initialState: T,
  middleware?: Middleware<T>[]
): Store<T>;

/**
 * Creates a logger middleware.
 */
declare function createLogger(options?: LoggerOptions): Middleware;

/**
 * Creates a thunk middleware for handling async actions.
 */
declare function createThunk(): Middleware;

/**
 * Creates an async thunk action creator (Redux Toolkit-style).
 */
declare function createAsyncThunk<Returned, ThunkArg = void>(
    type: string,
    payloadCreator: (arg: ThunkArg, thunkAPI: { dispatch: any; getState: any; requestId: string }) => Promise<Returned>
): (arg: ThunkArg) => (dispatch: any, getState: any) => Promise<{ payload: Returned; meta: any }>;

export { Action, LoggerOptions, Middleware, Store, createAsyncThunk, createLogger, createStore, createThunk };
