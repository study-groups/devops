# StateKit → Redux Toolkit Migration Plan

## 🎯 WHY MIGRATE?

### Current Problems with StateKit:
- **Custom maintenance burden**: 278 lines of custom Redux reimplementation
- **Limited ecosystem**: No community plugins, middleware, or tooling
- **Developer onboarding**: New developers must learn custom patterns
- **Debugging tools**: Custom devtools instead of industry-standard Redux DevTools
- **Feature lag**: Missing latest Redux Toolkit innovations (RTK Query, etc.)

### Benefits of Redux Toolkit:
- ✅ **Industry standard** with massive ecosystem
- ✅ **Zero maintenance** - maintained by Redux team
- ✅ **Better devtools** - Redux DevTools Extension
- ✅ **Modern features** - RTK Query, EntityAdapter, etc.
- ✅ **Easy onboarding** - developers already know it
- ✅ **Performance optimizations** - Immer, selector memoization

## 📊 MIGRATION SCOPE

### Files Using StateKit (Only 5!):
```
client/store/slices/previewSlice.js    - createSlice, createAsyncThunk
client/store/slices/systemSlice.js     - createSlice (just added)
client/store/slices/publishSlice.js    - createSlice
client/store/uiSlice.js                - createSlice
client/preview/index.js                - createAsyncThunk
```

### Package Structure:
```
packages/devpages-statekit/
├── src/index.js           (278 lines - main implementation)
├── src/createSlice.js     (33 lines - slice creator)
├── src/devpagestools.js   (devtools integration)
├── src/lite.js           (100 lines - minimal version)
└── dist/                 (built versions)
```

## 🚀 MIGRATION STRATEGY

### Phase 1: Add Redux Toolkit (No Breaking Changes)
1. **Install Redux Toolkit**: `npm install @reduxjs/toolkit`
2. **Add import map** to support both during transition
3. **Create coexistence setup** - both libraries work side by side

### Phase 2: Migrate Files One by One
**Order of migration (risk-based):**

1. **systemSlice.js** (newest, least risky)
2. **publishSlice.js** (small, self-contained)
3. **uiSlice.js** (simple slice)
4. **previewSlice.js** (has async thunk)
5. **preview/index.js** (only uses createAsyncThunk)

### Phase 3: Remove StateKit
1. **Delete `packages/devpages-statekit/`**
2. **Update package.json**
3. **Remove import mappings**

## 🔧 IMPLEMENTATION

### Step 1: Setup Redux Toolkit
```javascript
// Add to package.json
"dependencies": {
  "@reduxjs/toolkit": "^2.0.0"
}

// Add import map to index.html
<script type="importmap">
{
  "imports": {
    "@reduxjs/toolkit": "/node_modules/@reduxjs/toolkit/dist/redux-toolkit.esm.js"
  }
}
</script>
```

### Step 2: Migration Pattern
```javascript
// Before (StateKit)
import { createSlice } from '/packages/devpages-statekit/src/index.js';

const slice = createSlice({
  name: 'example',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => ({ ...state, value: state.value + 1 })
  }
});

// After (Redux Toolkit)
import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({
  name: 'example',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => {
      state.value += 1; // Immer allows mutation syntax!
    }
  }
});
```

### Step 3: Async Thunk Migration
```javascript
// Before (StateKit)
import { createAsyncThunk } from '/packages/devpages-statekit/src/index.js';

// After (Redux Toolkit) - same API!
import { createAsyncThunk } from '@reduxjs/toolkit';
```

## ⚡ QUICK START

Want to start immediately? Migrate systemSlice.js first:

```bash
# 1. Install RTK
npm install @reduxjs/toolkit

# 2. Update systemSlice.js import
# Change: '/packages/devpages-statekit/src/index.js'
# To:     '@reduxjs/toolkit'

# 3. Simplify reducers (Immer allows mutations)
# Change: return { ...state, phase: 'ready' }
# To:     state.phase = 'ready'
```

## 📈 ESTIMATED EFFORT

- **Phase 1**: 30 minutes (install + setup)
- **Phase 2**: 2 hours (migrate 5 files)
- **Phase 3**: 15 minutes (cleanup)

**Total: ~3 hours for complete migration**

## 🎯 SUCCESS METRICS

After migration:
- ✅ No more `packages/devpages-statekit/` directory
- ✅ All imports use `@reduxjs/toolkit`
- ✅ Redux DevTools Extension works
- ✅ Simpler, more maintainable code
- ✅ Industry standard patterns