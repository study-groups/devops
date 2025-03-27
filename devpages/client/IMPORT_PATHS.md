# Import Path Guidelines for DevPages

## Problem

We encountered a 404 error with paths like:
```
GET https://devpages.qa.pixeljamarcade.com/client/core/core/index.js net::ERR_ABORTED 404 (Not Found)
```

This happens when relative paths are used in a way that resolves incorrectly in the browser. 

## Root Cause

The issue occurs when:
1. A file in `client/fileManager/` imports from `../core/index.js`
2. The browser resolves this as `client/core/core/index.js` instead of `client/core/index.js`

This can happen because:
- The base URL for resolving imports might be set incorrectly
- The browser's module resolution differs from what we expect
- The path structure of our application causes confusion in relative imports

## Solution

### 1. Use Absolute Paths for Cross-Directory Imports

When importing across different directories, especially for core modules, use absolute paths starting with a slash:

```javascript
// GOOD - absolute path is unambiguous
import { fileManager } from '/client/core/index.js';

// AVOID - relative path can resolve incorrectly
import { fileManager } from '../core/index.js';
```

### 2. Relative Paths Only for Same-Directory or Direct Children

Use relative paths only for:
- Importing from the same directory
- Importing from direct child directories

```javascript
// These are safe
import { something } from './util.js';            // Same directory
import { something } from './helpers/format.js';  // Child directory
```

### 3. Use Path Aliases for Common Imports

Consider setting up path aliases for frequently imported modules:

```javascript
// In your bundler config
{
  "paths": {
    "@core/*": ["client/core/*"],
    "@components/*": ["client/components/*"],
    "@utils/*": ["client/utils/*"]
  }
}

// Then in your code
import { fileManager } from '@core/index.js';
```

## Update Plan

For our current codebase:

1. Gradually migrate all cross-directory imports to absolute paths
2. Fix existing imports that might cause similar issues
3. Add import path linting rules to prevent similar issues

## Testing Imports

When refactoring imports, always test:
1. Development environment
2. Production build
3. Different browsers (Chrome, Firefox, Safari)

## Impact

This change will:
- Fix 404 errors for module imports
- Make import paths more predictable
- Reduce confusion in module resolution
- Simplify future refactoring 