# Import Style Guide for DevPages

## Overview

This document outlines the import patterns to use in the DevPages codebase for consistency and to avoid common errors.

## Default vs. Named Imports

### Core Modules

Core modules export both a default object and named functions:

```javascript
// In core/editor.js
export default editorCore;
export const editor = editorCore;
export const initializeEditor = editorCore.initializeEditor.bind(editorCore);
// ...other named exports
```

### How to Import Core Modules

When importing these modules, use the following patterns:

1. **For the main object, use default import:**

   ```javascript
   // CORRECT
   import editor from '../editor.js';
   
   // INCORRECT - will cause runtime error
   import { editor } from '../editor.js';
   ```

2. **For specific functions, use named imports:**

   ```javascript
   // CORRECT
   import { initializeEditor, setContent } from '../editor.js';
   
   // INCORRECT - more verbose than needed
   import editor from '../editor.js';
   const { initializeEditor, setContent } = editor;
   ```

3. **For both the object and functions, use combined syntax:**

   ```javascript
   // CORRECT
   import editor, { initializeEditor, setContent } from '../editor.js';
   ```

## Import Paths

### Cross-Directory Imports

For imports that cross directory boundaries, use absolute paths:

```javascript
// CORRECT
import { AUTH_STATE } from '/client/core/auth.js';

// POTENTIALLY PROBLEMATIC
import { AUTH_STATE } from '../core/auth.js';
```

### Same-Directory Imports

For imports from the same directory, use relative paths:

```javascript
// CORRECT
import { someFunction } from './util.js';
```

## Core Modules with Default Exports

The following modules should be imported using default import syntax for the main object:

- `editor.js` -> `import editor from '../editor.js'`
- `auth.js` -> `import auth from '../auth.js'`
- `views.js` -> `import views from '../views.js'`
- `fileManager.js` -> `import fileManager from '../fileManager.js'`
- `preview.js` -> `import preview from '../preview.js'`

## Import Order

Organize imports in the following order:

1. External libraries/modules
2. Core modules
3. Utility modules  
4. Component/UI modules
5. Constants and type definitions

```javascript
// External libraries
import { someExternalFunction } from 'external-library';

// Core modules
import auth from '/client/core/auth.js';
import { initializeEditor } from '/client/core/editor.js';

// Utility modules
import { logMessage } from '/client/log/index.js';
import { eventBus } from '/client/eventBus.js';

// Component/UI modules
import { renderButton } from './ui.js';

// Constants
import { BUTTON_TYPES } from './constants.js';
```

## Common Errors to Avoid

### 1. Circular Dependencies

Avoid importing modules that import each other:

```javascript
// In fileA.js
import { something } from './fileB.js';  // fileB imports from fileA - circular!

// Solution: Use dynamic imports
const fileB = await import('./fileB.js');
```

### 2. Wrong Import Syntax

As mentioned above, using named imports for default exports will cause runtime errors:

```javascript
// This will fail at runtime with:
// "The requested module '../editor.js' does not provide an export named 'editor'"
import { editor } from '../editor.js';
```

### 3. Inconsistent Path Style

Mixing relative and absolute paths for the same imports in different files:

```javascript
// In one file
import auth from '../auth.js';

// In another file
import auth from '/client/auth.js';
```

This makes refactoring more difficult and error-prone.

## Troubleshooting

If you encounter import errors, run the import path and style fixers:

```bash
# Fix import paths
./client/fix-import-paths.sh

# Fix import style
./client/fix-import-style.sh
``` 