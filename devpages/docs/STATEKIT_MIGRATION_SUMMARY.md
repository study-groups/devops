# StateKit → Redux Toolkit Migration Summary

## 🎯 OBJECTIVE
Replace custom StateKit package with industry-standard Redux Toolkit across 5 files.

---

## 📋 MIGRATION PHASES

### **Phase 1: Setup Redux Toolkit** ⏱️ 30 minutes
**Goal**: Install RTK alongside StateKit (no breaking changes)

**Actions**:
1. `npm install @reduxjs/toolkit`
2. Add import map to `client/index.html`:
   ```html
   <script type="importmap">
   {
     "imports": {
       "@reduxjs/toolkit": "/node_modules/@reduxjs/toolkit/dist/redux-toolkit.esm.js"
     }
   }
   </script>
   ```
3. Test that RTK imports work alongside StateKit

---

### **Phase 2: Migrate Files** ⏱️ 2 hours
**Goal**: Convert each file from StateKit to Redux Toolkit

**Priority Order** (risk-based):

#### **Priority 1: systemSlice.js** ⏱️ 20 minutes
- **File**: `client/store/slices/systemSlice.js`
- **Risk**: LOW (newest file, just added)
- **Changes**: 
  - Import: `/packages/devpages-statekit/src/index.js` → `@reduxjs/toolkit`
  - Reducers: `return { ...state, phase: 'ready' }` → `state.phase = 'ready'`

#### **Priority 2: publishSlice.js** ⏱️ 15 minutes  
- **File**: `client/store/slices/publishSlice.js`
- **Risk**: LOW (simple slice, self-contained)
- **Changes**: Import change + simplify reducers with Immer

#### **Priority 3: uiSlice.js** ⏱️ 15 minutes
- **File**: `client/store/uiSlice.js` 
- **Risk**: LOW (simple slice)
- **Changes**: Import change + simplify reducers with Immer

#### **Priority 4: previewSlice.js** ⏱️ 30 minutes
- **File**: `client/store/slices/previewSlice.js`
- **Risk**: MEDIUM (uses both createSlice + createAsyncThunk)
- **Changes**: Import change + async thunk patterns

#### **Priority 5: preview/index.js** ⏱️ 10 minutes
- **File**: `client/preview/index.js`
- **Risk**: LOW (only uses createAsyncThunk)
- **Changes**: Import change only (createAsyncThunk API identical)

---

### **Phase 3: Cleanup** ⏱️ 15 minutes
**Goal**: Remove StateKit entirely

**Actions**:
1. Delete `packages/devpages-statekit/` directory
2. Remove StateKit from `package.json` dependencies
3. Remove import map entries for StateKit
4. Verify no remaining StateKit references

---

## 📁 FILE INVENTORY

### **Files to Migrate** (5 total):
```
✓ client/store/slices/systemSlice.js     - createSlice
✓ client/store/slices/publishSlice.js    - createSlice  
✓ client/store/uiSlice.js                - createSlice
✓ client/store/slices/previewSlice.js    - createSlice + createAsyncThunk
✓ client/preview/index.js                - createAsyncThunk
```

### **Files to Delete**:
```
✗ packages/devpages-statekit/            - entire directory
```

---

## 🚦 EXECUTION CHECKLIST

### **Pre-Migration**:
- [ ] Backup current working state
- [ ] Ensure all current functionality works
- [ ] Install Redux Toolkit

### **Per File Migration**:
- [ ] Update import statement
- [ ] Convert reducers to use Immer syntax
- [ ] Test file loads without errors
- [ ] Verify functionality unchanged

### **Post-Migration**:
- [ ] All 5 files use `@reduxjs/toolkit`
- [ ] No imports from `/packages/devpages-statekit/`
- [ ] StateKit directory deleted
- [ ] Redux DevTools Extension works
- [ ] All functionality preserved

---

## ⚡ QUICK START COMMAND

**Start with Priority 1 file**:
```bash
# Test RTK installation
node -e "console.log('Testing RTK...'); import('@reduxjs/toolkit').then(() => console.log('✅ RTK ready')).catch(err => console.log('❌ RTK not ready:', err.message))"

# Edit systemSlice.js
# Change line 5: import { createSlice } from '/packages/devpages-statekit/src/index.js';
# To:        import { createSlice } from '@reduxjs/toolkit';
```

---

## 📊 SUCCESS METRICS

**Migration Complete When**:
- ✅ Zero files import from `/packages/devpages-statekit/`
- ✅ `packages/devpages-statekit/` directory deleted
- ✅ Redux DevTools Extension shows state
- ✅ All keyboard shortcuts work (Ctrl+Shift+D, Ctrl+Shift+S)
- ✅ No console errors related to state management

**Total Estimated Time**: **~3 hours**