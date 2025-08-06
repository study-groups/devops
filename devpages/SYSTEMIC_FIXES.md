# SYSTEMIC CODEBASE FIXES REQUIRED

## Immediate Actions Required

### 1. Disable Redux Keyboard Shortcut Handler
The Ctrl+Shift+1 shortcut in `redux/components/KeyboardShortcutHandler.js` must be completely disabled.

### 2. Replace window.APP.panels Assignment
Currently `window.APP.panels` gets the Redux PanelManager instance somewhere in the auth flow.
We need to replace this with a safe stub.

### 3. Consolidate Panel Management Systems
Currently we have:
- Redux PanelManager (redux/components/PanelManager.js)
- DebugPanelManager (packages/devpages-debug/DebugPanelManager.js)
- WorkspaceManager (client/layout/WorkspaceManager.js)
- PanelStateManager (client/panels/PanelStateManager.js)

### 4. Remove Competing Redux Systems
Multiple Redux stores and slices are conflicting:
- client/store/slices/panelSlice.js
- client/store/reducers/panelsReducer.js
- Multiple persistence middleware files

## Files to be Modified/Removed

### Priority 1 (Critical)
1. redux/components/KeyboardShortcutHandler.js - DISABLE completely
2. Find window.APP.panels assignment - REPLACE with stub
3. client/store/slices/panelSlice.js - REMOVE reset-defaults shortcut

### Priority 2 (Cleanup)
1. redux/components/PanelManager.js - Mark as DEPRECATED
2. redux/components/DebugDock.js - REMOVE completely
3. Multiple persistence middleware files - CONSOLIDATE

### Priority 3 (Long-term)
1. Consolidate all panel systems into single source of truth
2. Remove window object pollution
3. Standardize state management patterns