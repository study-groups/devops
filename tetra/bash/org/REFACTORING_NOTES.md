---
category: core
type: refactor
tags: [org, tree, completion, repl, thelp, integration]
module: org
created: 2025-10-31
updated: 2025-10-31
status: complete
evidence_weight: primary
---

# Org Module Refactoring - Tree/REPL/Thelp Integration

## Overview

The bash/org module has been refactored to use the unified tree-based tab-completion and help system provided by bash/repl, bash/tree, and bash/thelp.

## Changes Made

### 1. New Files

#### bash/org/org_tree.sh
- **Purpose**: Defines the complete command tree for org module
- **Namespace**: `help.org`
- **Structure**: Hierarchical tree with commands, categories, and parameters
- **Features**:
  - Command metadata (title, description, usage, handler)
  - Dynamic completion functions
  - Aliases support
  - Comprehensive coverage of all org commands

### 2. Modified Files

#### bash/org/org_completion.sh
- **Before**: Custom tree implementation with associative arrays
- **After**: Uses bash/tree core system
- **Changes**:
  - Replaced `ORG_COMPLETION_TREE` with `tree_insert()` calls
  - Updated `_org_complete()` to use `tree_children()` and `tree_get()`
  - Kept existing completion helper functions (org_completion_orgs, etc.)
  - Maintained backward compatibility with `_org_repl_complete()` alias
  - Now sources bash/tree modules

#### bash/org/org_repl.sh
- **Before**: Standalone REPL with hardcoded help
- **After**: Integrated with REPL module system
- **Changes**:
  - Added bash/tree and bash/repl/command_processor imports
  - Initialized org tree with `org_tree_init()`
  - Registered module with `repl_register_module()`
  - Updated help command to use `tree_help_show()`
  - Added `thelp` command support in REPL
  - Sources org_tree.sh and org_completion.sh

#### bash/org/includes.sh
- **Changes**:
  - Added org_tree.sh and org_completion.sh to load sequence
  - Tree and completion loaded before core functionality

### 3. Test File

#### bash/org/test_tree_integration.sh
- **Purpose**: Comprehensive integration test
- **Tests**:
  1. Tree structure validation
  2. Top-level command completion
  3. Subcommand completion (import, secrets, env)
  4. Help display
  5. Command metadata
  6. Dynamic completion functions
  7. Bash completion simulation
  8. Tree hierarchy navigation

## Architecture

```
bash/org (Organization Module)
├── org_tree.sh          # Tree structure definition (NEW)
│   └── Defines: help.org.* tree
│
├── org_completion.sh    # Tab completion (REFACTORED)
│   ├── Uses: bash/tree/core.sh
│   ├── Uses: bash/tree/complete.sh
│   └── Provides: _org_complete()
│
├── org_repl.sh          # REPL integration (REFACTORED)
│   ├── Uses: bash/repl/repl.sh
│   ├── Uses: bash/repl/command_processor.sh
│   ├── Uses: bash/tree/help.sh
│   └── Registers: "org" module
│
└── includes.sh          # Main loader (UPDATED)
    └── Loads tree before core
```

## Integration Points

### 1. bash/tree Integration
- **What**: Generic tree data structure
- **How**: org_tree.sh defines help.org.* hierarchy
- **Benefits**:
  - Single source of truth for commands
  - Automatic hierarchy management
  - Metadata storage

### 2. bash/tree/complete Integration
- **What**: Tree-based tab completion
- **How**: org_completion.sh uses tree_complete()
- **Benefits**:
  - Dynamic completion from tree
  - No duplicate definitions
  - Supports nested commands

### 3. bash/tree/help Integration
- **What**: Paginated help display
- **How**: org_repl.sh uses tree_help_show()
- **Benefits**:
  - Formatted help output
  - Breadcrumb navigation
  - Consistent style

### 4. bash/thelp Integration
- **What**: Quick help lookup from shell
- **How**: Module registers with "help.org" namespace
- **Usage**: `thelp org.list`, `thelp org.import.nh`
- **Benefits**:
  - Help without entering REPL
  - Shell completion for help topics
  - Works across all modules

### 5. bash/repl Integration
- **What**: Universal REPL system
- **How**: repl_register_module("org", ...)
- **Benefits**:
  - Consistent REPL behavior
  - Module discovery
  - Shared history/navigation

## Command Tree Structure

```
help.org (Organization Management System)
├── list              # List organizations
├── active            # Show active org
├── switch            # Switch active org
├── create            # Create new org
├── import/           # Import operations
│   ├── nh            # From NodeHolder
│   ├── json          # From JSON
│   └── env           # From .env
├── discover          # Auto-discover structure
├── validate          # Validate org
├── compile           # Compile to TOML
├── secrets/          # Secrets management
│   ├── init
│   ├── validate
│   ├── load
│   ├── list
│   └── copy
├── push              # Deploy to env
├── pull              # Pull from env
├── rollback          # Rollback deployment
├── history           # Deployment history
├── init              # Init multi-env config
├── promote           # Promote between envs
├── env/              # Environment management
│   ├── list
│   ├── edit
│   ├── show
│   └── validate
├── diff              # Compare configs
├── apply             # Apply changes
├── help              # Show help
└── repl/             # REPL-specific commands
    ├── env           # Cycle environment
    ├── mode          # Cycle mode
    ├── action        # Cycle action
    ├── next          # Cycle all
    ├── actions       # List actions
    └── status        # Show status
```

## Usage Examples

### 1. Shell Tab Completion
```bash
$ org <TAB>
list  active  switch  create  import  discover  validate  compile  ...

$ org import <TAB>
nh  json  env

$ org secrets <TAB>
init  validate  load  list  copy
```

### 2. Quick Help (thelp)
```bash
$ thelp org.list
■ List all organizations
Display all available organizations in the registry
Usage: org list [--verbose|--json]

$ thelp org.import.nh
■ Import from NodeHolder
Convert NodeHolder digocean.json to organization format
Usage: org import nh <nh-dir> [org-name]
```

### 3. REPL Help
```bash
$ org
🏢 ORG REPL v2.0
...

[myorg] Local × Inspect ▶ help list
■ List all organizations
...

[myorg] Local × Inspect ▶ thelp import.nh
■ Import from NodeHolder
...
```

### 4. Module Registration
```bash
$ bash -c "source ~/tetra/tetra.sh; tmod load org; thelp org.switch"
■ Switch active organization
...
```

## Testing

Run the integration test:
```bash
bash bash/org/test_tree_integration.sh
```

Expected output:
- ✓ Tree structure validated
- ✓ Tab completion working
- ✓ Help display functional
- ✓ Dynamic completion active
- ✓ All commands registered

## Benefits of Refactoring

### 1. Single Source of Truth
- Commands defined once in org_tree.sh
- Used for completion, help, and documentation
- No duplication or drift

### 2. Consistency
- Same completion behavior as other modules
- Same help format across all commands
- Unified REPL experience

### 3. Discoverability
- `thelp --modules` shows org module
- `thelp --list org` lists all commands
- Tab completion guides users

### 4. Maintainability
- Add command: single tree_insert() call
- Change help: update metadata in one place
- No scattered completion rules

### 5. Integration
- Works with existing bash/repl infrastructure
- Compatible with bash/thelp from any module
- Follows TETRA conventions

## Migration Notes

### Backward Compatibility
- Old `_org_repl_complete()` still works (alias)
- `org_completion_init_tree()` deprecated but functional
- All existing org commands unchanged

### Breaking Changes
- None - refactoring is internal only

### Future Enhancements
- Add more metadata (examples, related commands)
- Implement command handlers registration
- Add interactive help navigation
- Support for command aliases in tree

## Related Files
- bash/tree/core.sh - Tree data structure
- bash/tree/complete.sh - Completion generator
- bash/tree/help.sh - Help display
- bash/thelp/thelp.sh - Quick help command
- bash/repl/command_processor.sh - Module registry

## Troubleshooting

### Tab Completion Not Working

If tab completion doesn't work, check:

1. **Is completion registered?**
   ```bash
   complete -p org
   # Should show: complete -F _org_complete org
   ```

2. **Does _org_complete function exist?**
   ```bash
   type -t _org_complete
   # Should show: function
   ```

3. **Is tree initialized?**
   ```bash
   tree_type 'help.org'
   # Should show: category
   ```

4. **Manual test:**
   ```bash
   COMP_WORDS=(org '')
   COMP_CWORD=1
   _org_complete
   echo "${COMPREPLY[@]}"
   # Should show: list active switch create import...
   ```

### Common Issues

1. **"org: command not found"** - org module not loaded
   - Solution: `source ~/tetra/tetra.sh && tmod load org`

2. **Completion shows files** - completion not registered
   - Check loading order in includes.sh
   - Completion must register AFTER org() function exists

3. **"tree_type: command not found"** - tree module not loaded
   - Solution: Ensure bash/tree/core.sh is sourced before use
