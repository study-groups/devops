# DevPages Actions System

This directory contains the modular actions system for DevPages. It replaces the previous monolithic `actions.js` file with smaller, focused modules.

## Structure

- `index.js`: Main entry point that re-exports all action handlers and provides the combined `triggerActions` object
- `authActions.js`: Authentication-related actions (login, logout)
- `debugActions.js`: Debug and development utilities
- `editorActions.js`: Text editor operations (selection, copy/paste)
- `fileActions.js`: File system operations (load, save, publish)
- `imageActions.js`: Image handling (delete, upload)
- `uiActions.js`: UI interactions (view modes, log panel)

## How It Works

The system follows a clean architecture approach:

1. **Action Handlers**:
   - Each file exports domain-specific action handlers that perform UI operations
   - Each handler is focused on a single responsibility
   - They use the `dispatch` function to update state

2. **Action Creators**:
   - Located in `/client/messaging/actionCreators.js`
   - Create properly formatted action objects for the reducers
   - Keep action type strings in one place

3. **State Management**:
   - Changes to application state go through reducers via `dispatch`
   - Interface with DOM only when necessary
   - Access state via selectors from `/client/store/selectors.js`

## Usage Examples

```javascript
// Using an action directly
import { fileActionHandlers } from '/client/actions/fileActions.js';
fileActionHandlers.saveFile();

// Using the triggerActions object (legacy style)
import { triggerActions } from '/client/actions/index.js';
triggerActions.saveFile();

// Dispatching an action to update state
import { dispatch } from '/client/messaging/messageQueue.js';
import { uiActions } from '/client/messaging/actionCreators.js';
dispatch(uiActions.setViewMode('split'));
```

## Adding New Actions

1. Add a new action type to `ActionTypes` in `client/messaging/messageQueue.js`
2. Add a corresponding action creator in `client/messaging/actionCreators.js`
3. Add a reducer handler for the action in the appropriate reducer file
4. Add a UI action handler in the appropriate actions file
5. Export the action handler in the `triggerActions` object in `index.js`

## Design Principles

- **Separation of Concerns**: Each module handles a specific type of action
- **Single Responsibility**: Each function does one thing well
- **Clean State Updates**: Use action creators and dispatch for all state changes
- **Backward Compatibility**: Legacy code can still use the `triggerActions` object 