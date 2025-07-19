# @nodeholder/devpages.statekit

A lightweight, reactive state management library designed for simplicity and learning.

## Features

- **Lightweight**: Minimal footprint with no external dependencies
- **Reactive**: Subscribe to state changes with automatic notifications
- **Redux-compatible**: Follows Redux patterns and conventions
- **TypeScript**: Full TypeScript support with type definitions
- **Middleware**: Extensible middleware system

## Installation

```bash
npm install @nodeholder/devpages.statekit
```

## Quick Start

```javascript
import { createStore, createLogger } from '@nodeholder/devpages.statekit';

// Define your initial state
const initialState = {
  count: 0,
  todos: []
};

// Create a reducer function
function reducer(state, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'ADD_TODO':
      return { 
        ...state, 
        todos: [...state.todos, action.payload] 
      };
    default:
      return state;
  }
}

// Create the store with optional middleware
const store = createStore(reducer, initialState, [
  createLogger({ collapsed: false })
]);

// Subscribe to state changes
const unsubscribe = store.subscribe((newState, prevState, action) => {
  console.log('State changed:', { newState, prevState, action });
});

// Dispatch actions
store.dispatch({ type: 'INCREMENT' });
store.dispatch({ 
  type: 'ADD_TODO', 
  payload: { text: 'Learn StateKit', completed: false } 
});

// Get current state
console.log(store.getState());
```

## API Reference

### `createStore(reducer, initialState, middleware?)`

Creates a new state store.

- `reducer`: Function that takes `(state, action)` and returns new state
- `initialState`: Initial state object
- `middleware`: Optional array of middleware functions

Returns a store object with:
- `getState()`: Returns current state
- `dispatch(action)`: Dispatches an action
- `subscribe(listener)`: Subscribes to state changes

### `createLogger(options?)`

Creates a logger middleware for debugging.

Options:
- `collapsed`: Whether to collapse log groups (default: `true`)
- `duration`: Whether to log action duration (default: `false`)
- `timestamp`: Whether to log timestamps (default: `true`)
- `colors`: Whether to use colors (default: `true`)

### `createThunk()`

Creates a thunk middleware for handling async actions.

## StateKit Lite

For a minimal version without thunk support:

```javascript
import { createStore, createLogger } from '@nodeholder/devpages.statekit/lite';
```

## Middleware

StateKit supports Redux-style middleware:

```javascript
const customMiddleware = ({ getState, dispatch }) => next => action => {
  console.log('Before:', getState());
  const result = next(action);
  console.log('After:', getState());
  return result;
};

const store = createStore(reducer, initialState, [customMiddleware]);
```

## TypeScript Support

StateKit is fully typed:

```typescript
interface AppState {
  count: number;
  todos: Todo[];
}

interface Action {
  type: string;
  payload?: any;
}

const store: Store<AppState> = createStore(reducer, initialState);
```

## License

**RESTRICTIVE LICENSE** - This software is licensed under a restrictive license that:

- ✅ Allows personal, educational, and non-commercial use
- ✅ Permits studying and modifying for learning purposes
- ❌ Prohibits commercial use without explicit permission
- ❌ Prohibits redistribution in any form
- ❌ Prohibits use in production environments serving external users

For commercial licensing, contact nodeholder.

See the [LICENSE](LICENSE) file for full terms.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 
