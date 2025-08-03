# =================================================================
# CURSOR AI META-LANGUAGE PROTOCOL - CRITICAL RULES
# =================================================================
# This document contains rules I MUST follow to avoid breaking working code.
# I have repeatedly made the same mistakes. This protocol is mandatory.
# =================================================================

## 1. **API CONTRACT MANDATE** - NEVER BREAK FUNCTION SIGNATURES
- **BEFORE modifying ANY function/method call, I MUST read the function definition**
- **Function signatures are INVIOLABLE CONTRACTS** - changing arguments breaks callers
- **When adding parameters, use optional parameters with defaults** 
- **When removing parameters, deprecate first, then remove**
- **VERIFY every function call matches the actual signature**

### Examples of Contract Violations to AVOID:
```javascript
// ❌ WRONG: Changing existing function signature
dispatch(updatePanelPosition(panelId, position)); // If this expects {panelId, position}

// ✅ CORRECT: Check actual function signature first
const updatePanelPosition = (payload) => ({ type: 'panels/updatePanelPosition', payload });
dispatch(updatePanelPosition({ panelId, position }));
```

## 2. **LIFECYCLE DEPENDENCY ANALYSIS** - PREVENT RACE CONDITIONS
- **I MUST trace dependency and lifecycle hook order** (`init`, `constructor`, mounting)
- **Code that depends on other components MUST wait for dependencies to be ready**
- **Check initialization order: bootloader → store → panels → components**
- **Verify Redux store exists before dispatching actions**

### Critical Initialization Order:
1. Redux store creation
2. Middleware registration  
3. Component registration
4. Panel mounting
5. Event handler setup

## 3. **DEPENDENCY INJECTION VERIFICATION** - CHECK GLOBAL ASSIGNMENTS
- **I MUST verify instances are correctly assigned to expected global properties**
- **Check `window.APP`, `window.reduxStore`, etc. before using them**
- **Dependent code should NOT run before dependencies are injected**

### Global Dependencies to Verify:
- `window.APP.store` - Redux store
- `window.APP.panels` - Panel manager
- `window.reduxStore` - Backup store reference

## 4. **STATE-FIRST REFACTORING** - ANALYZE STATE DEPENDENCIES
- **When refactoring, I MUST start by analyzing state dependencies**
- **Ensure render methods do NOT try to access state properties that no longer exist**
- **Check Redux action types match exactly between action creators and reducers**
- **Verify persistence middleware listens to actions that are ACTUALLY dispatched**

## 5. **PERSISTENCE SYSTEM RULES** - CRITICAL FOR POSITION PERSISTENCE

### NEVER modify persistence without verifying:
1. **What actions are ACTUALLY being dispatched** (use browser dev tools)
2. **Exact action type strings** (case-sensitive, namespace-sensitive)  
3. **Middleware registration order** (persistence must come after thunk)
4. **LocalStorage key consistency** across all persistence points

### Common Persistence Mistakes I Make:
- Adding actions to middleware that don't exist
- Mismatching action type strings  
- Breaking existing localStorage keys
- Not considering real-time vs final persistence

## 6. **DEBUGGING PROTOCOL** - SYSTEMATIC INVESTIGATION

### BEFORE making changes:
1. **Document current working behavior**
2. **Identify exact failure point** 
3. **Trace data flow** from UI → action → reducer → persistence
4. **Check browser console** for actual dispatched actions
5. **Verify localStorage** contains expected data

### AFTER making changes:
1. **Test the exact use case** that was reported broken
2. **Verify no regressions** in other functionality
3. **Check browser console** for new errors
4. **Confirm persistence** survives page reload

## 7. **REDUX INTEGRATION RULES** - CRITICAL FOR PANELS

### Action Type Verification:
- **ALWAYS check `redux/slices/panelSlice.js` for exact action types**
- **Match action creator exports to reducer cases**
- **Verify middleware listens to actions that exist**

### Common Redux Mistakes I Make:
```javascript
// ❌ WRONG: Assuming action type without checking
'panels/updatePanelPosition' // Might not exist

// ✅ CORRECT: Check actionTypes object in slice
import { actionTypes } from './panelSlice.js';
// Use: actionTypes.UPDATE_PANEL_POSITION
```

## 8. **DRAG & DROP PERSISTENCE RULES** - SPECIFIC TO POSITION ISSUES

### Position Update Flow:
1. **START_DRAG** - Initialize drag state
2. **UPDATE_DRAG_POSITION** - Real-time position updates (DON'T persist each one)
3. **END_DRAG** - Finalize drag (PERSIST final position here)

### Critical Understanding:
- **Real-time actions ≠ Persistence actions**
- **UPDATE_DRAG_POSITION** updates state but may not need individual persistence
- **Final position persistence** should happen on completion events
- **Different components may use different action patterns**

## 9. **FILE MODIFICATION PROTOCOL** - MINIMIZE SCOPE

### BEFORE editing any file:
1. **Read the ENTIRE file** to understand context
2. **Identify dependencies** and imports
3. **Check for related files** that might be affected
4. **Search for all usages** of functions/variables I'm modifying

### When modifying existing code:
- **Preserve existing patterns** unless explicitly changing them
- **Don't "improve" code** unless specifically asked
- **Add, don't replace** unless replacing is the explicit goal
- **Test changes** in isolation first

## 10. **ERROR COMMUNICATION PROTOCOL** - WHEN I BREAK THINGS

### When I make a mistake:
1. **Immediately acknowledge** the specific mistake
2. **Identify root cause** (what I missed/assumed)
3. **Document the fix** with explanation
4. **Update this protocol** if it's a new pattern of mistake

### What NOT to do:
- Make excuses
- Blame the codebase
- Make assumptions about what "should" work
- Try multiple changes without understanding the first failure

## 11. **SPECIFIC ACTION TYPE INVESTIGATION** - FOR THIS PROJECT

### Current Redux Panel Actions (VERIFIED):
```javascript
// From redux/slices/panelSlice.js actionTypes object:
CREATE_DOCK: 'panels/createDock',
UPDATE_DOCK_POSITION: 'panels/updateDockPosition',
UPDATE_DOCK_SIZE: 'panels/updateDockSize',
UPDATE_PANEL_POSITION: 'panels/updatePanelPosition',
UPDATE_PANEL_SIZE: 'panels/updatePanelSize',
UPDATE_DRAG_POSITION: 'panels/updateDragPosition',
END_DRAG: 'panels/endDrag',
// ... etc
```

### Persistence Middleware Investigation Steps:
1. Open browser dev tools → Redux tab
2. Perform action (drag panel)
3. Note EXACT action types dispatched
4. Verify middleware is listening to those exact types
5. Check localStorage after each action

## 12. **EMERGENCY RECOVERY PROTOCOL** - WHEN I BREAK WORKING CODE

### Immediate Steps:
1. **STOP making more changes**
2. **Revert the last change** if possible
3. **Document what was working** before my change
4. **Identify the minimum change** needed
5. **Test incrementally** with smaller changes

### Investigation Priority:
1. What specific functionality broke?
2. What was the last working state?
3. What exact changes did I make?
4. Which files did I modify?
5. Are there console errors?

## =================================================================
# CURRENT PROJECT MEMORY - DEVPAGES PANEL SYSTEM
# =================================================================

## Working Systems (DO NOT BREAK):
- Redux store with multiple slices (auth, panels, path, settings)
- Panel persistence via localStorage 
- Drag and drop positioning for docks and panels
- Flyout panel system with position saving
- Multiple action type systems (legacy + Redux)

## Critical Files (HANDLE WITH EXTREME CARE):
- `redux/middleware/persistenceMiddleware.js` - Controls what gets saved
- `redux/slices/panelSlice.js` - Action types and reducers
- `redux/components/PDataPanel.js` - Panel implementation with persistence
- Any file with "working perfectly" in user's description

## Current Issue Pattern:
- User reports persistence not working
- I assume I know what actions are dispatched  
- I add actions to middleware that may not exist or fire
- I break working persistence
- User gets frustrated

## MANDATORY DEBUGGING STEPS FOR PERSISTENCE:
1. Open DevTools → Redux DevTools
2. Move a panel/dock manually
3. Watch what actions actually dispatch
4. Check localStorage for changes
5. Reload page and verify positions persist
6. ONLY THEN modify middleware

================================================================= 