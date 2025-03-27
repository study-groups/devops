# DevPages Refactored Codebase

## Overview

This codebase has been refactored to eliminate redundancy and establish a single source of truth for key functionality. The major improvements include:

1. Creation of a central `core/` directory with specialized modules
2. Elimination of duplicate code across files
3. Clear separation of concerns with well-defined module responsibilities
4. Simplified entry points and initialization flow

## Core Modules

The refactored architecture centers around these core modules:

### `core/auth.js`

Single source of truth for authentication:
- User login/logout
- Session management
- Authentication UI updates
- Form and button handling for auth operations

### `core/views.js`

Single source of truth for view management:
- Handles Code/Split/Preview modes
- Manages UI state and localStorage persistence
- Uses event delegation for better performance
- Provides repair functionality for view issues

### `core/buttons.js`

Single source of truth for button handling:
- Centralized button registration system
- Event delegation for button groups
- Consistent approach to adding/removing handlers
- Tracking of registered button handlers

### `core/editor.js`

Single source of truth for editor functionality:
- Editor initialization and configuration
- Content management (get/set)
- Cursor and selection handling
- Integration with other systems

### `core/main.js`

Application entry point and initialization:
- Orchestrates the initialization of all subsystems
- Manages application state
- Establishes initialization order
- Handles common UI operations

### `core/index.js`

Module index that exports all core functionality:
- Provides consistent import paths
- Prevents circular dependencies
- Re-exports important functions directly

## Compatibility Layers

The following files provide backward compatibility for existing code:

- `auth.js` → Re-exports from `core/auth.js`
- `views.js` → Re-exports from `core/views.js`
- `buttons.js` → Re-exports from `core/buttons.js`
- `viewManager.js` → Re-exports from `core/views.js`
- `editor.js` → Re-exports from `core/editor.js`
- `main.js` → Re-exports from `core/main.js`

## Disabled Files

The following files have been disabled (and may be safely removed):
- `viewFix.js.disable`
- `fixViews.js.disable`
- `auth.js.disabled`
- `authService.js.disabled`
- `authManager.js.disabled`
- `authCompat.js.disabled`
- `authDebug.js.disabled`
- `login.js.disabled`

These contained redundant code that competed with other implementations, causing issues.

## Main Entry Points

- `index.html` - Main HTML template, now simplified
- `main.js` - Delegates to core/main.js

## Flow of Execution

1. `index.html` is loaded with early auth/log visibility checks
2. `main.js` imports and calls `initializeApplication()` from `core/main.js`
3. `core/main.js` initializes subsystems in the correct order
4. Event listeners and observers handle ongoing functionality

## Migration Tools

To help with ongoing migration, the following tools are available:

- `migration-script.js` - Node.js script to update imports in the codebase
- `codebase-audit.md` - Documentation of issues and remediation steps
- `refactoring-plan.md` - Comprehensive plan for continuing the refactoring

## Best Practices for Working with This Codebase

1. Always import from `core/index.js` rather than individual core files
2. Don't create circular dependencies between core modules
3. Add new functionality to the appropriate core module
4. Maintain backward compatibility through re-export files
5. Document any changes in the appropriate files 