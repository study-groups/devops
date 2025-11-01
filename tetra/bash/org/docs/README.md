---
category: core
type: index
tags: [org, documentation, index]
module: org
created: 2025-10-31
updated: 2025-10-31
status: complete
evidence_weight: primary
---

# Org Module Documentation

Documentation for the bash/org module refactoring and tree integration.

## Quick Access with tdoc

View these documents with tdoc for better formatting and metadata:

```bash
# List all org module documentation
tdoc list --module org

# View specific documents
tdoc view bash/org/REFACTORING_NOTES.md
tdoc view bash/org/TAB_COMPLETION_GUIDE.md
tdoc view bash/org/INTEGRATION_SUMMARY.md

# Search documentation
tdoc search "tab completion"
tdoc search "tree integration"
```

## Document Overview

### Core Documentation

1. **[REFACTORING_NOTES.md](../REFACTORING_NOTES.md)** - Technical details
   - Architecture and design decisions
   - Integration points with bash/tree, bash/repl, bash/thelp
   - File modifications and loading order
   - Circular dependency handling

2. **[TAB_COMPLETION_GUIDE.md](../TAB_COMPLETION_GUIDE.md)** - User guide
   - How to use tab completion
   - Examples for all command types
   - Dynamic completions
   - Tips and tricks

3. **[INTEGRATION_SUMMARY.md](../INTEGRATION_SUMMARY.md)** - Quick reference
   - Status and verification
   - What was fixed
   - How to test
   - Feature checklist

## Using thelp

The org module now integrates with thelp for quick command help:

```bash
# Quick help from shell
thelp org.list
thelp org.import.nh
thelp org.secrets.init

# List all org commands
thelp --list org

# See all registered modules
thelp --modules
```

## Tab Completion

Tab completion works automatically after loading the module:

```bash
source ~/tetra/tetra.sh
tmod load org

# Try it out
org <TAB>           # Shows all top-level commands
org import <TAB>    # Shows: nh, json, env
org secrets <TAB>   # Shows: init, validate, load, list, copy
```

## REPL Mode

Start the interactive REPL:

```bash
org                 # Launches REPL
> help list         # In-REPL help
> thelp import.nh   # Quick help lookup
> env               # Cycle environments
```

## Tree Structure

The command tree is defined in `bash/org/org_tree.sh` under the `help.org` namespace:

```
help.org
├── list, active, switch, create
├── import/
│   ├── nh, json, env
├── discover, validate, compile
├── secrets/
│   ├── init, validate, load, list, copy
├── push, pull, rollback, history
└── env/
    ├── list, edit, show, validate
```

## Files

### New Files
- `bash/org/org_tree.sh` - Command tree definition (12KB)
- `bash/org/test_tree_integration.sh` - Integration tests
- `bash/org/docs/README.md` - This file

### Documentation
- `bash/org/REFACTORING_NOTES.md` - Technical details (9KB)
- `bash/org/TAB_COMPLETION_GUIDE.md` - User guide (5.5KB)
- `bash/org/INTEGRATION_SUMMARY.md` - Summary (5KB)

### Modified Files
- `bash/org/org_completion.sh` - Refactored for bash/tree
- `bash/org/org_repl.sh` - Enhanced with tree/thelp
- `bash/org/includes.sh` - Proper loading order

## Testing

Run the integration test suite:

```bash
bash bash/org/test_tree_integration.sh
```

Expected output:
```
========================================
  ✓ All Tests Complete
========================================

Integration verified:
  ✓ bash/tree - Tree data structure
  ✓ bash/tree/complete - Tab completion
  ✓ bash/tree/help - Help display
  ✓ bash/org/org_tree - Org command tree
  ✓ bash/org/org_completion - Completion functions
```

## Implementation Details

### Completion Registration Order

The completion must be registered **after** the `org()` function is defined:

1. `org_completion.sh` exports `_org_complete()` function
2. `includes.sh` defines `org()` function
3. `includes.sh` registers completion: `complete -F _org_complete org`

### Circular Dependency Guards

To prevent re-sourcing errors, `org_completion.sh` uses guards:

```bash
[[ -z "${ORG_ENVIRONMENTS[@]}" ]] && source "${TETRA_SRC}/bash/org/org_constants.sh"
[[ "$(type -t tree_children)" != "function" ]] && source "${TETRA_SRC}/bash/tree/core.sh"
```

## Troubleshooting

### Tab completion not working?

1. Check if org is loaded: `type org`
2. Check completion: `complete -p org`
3. Reload module: `tmod reload org`

### Want to see the tree structure?

```bash
# Initialize tree
source ~/tetra/tetra.sh
tmod load org

# Check tree
tree_type 'help.org'                    # Should show: category
tree_children 'help.org' | head -5      # Shows top commands
```

### View with tdoc

```bash
# Initialize the docs with tdoc
tdoc init bash/org/REFACTORING_NOTES.md --core --type refactor
tdoc init bash/org/TAB_COMPLETION_GUIDE.md --core --type guide
tdoc init bash/org/INTEGRATION_SUMMARY.md --core --type summary

# View with color
tdoc view bash/org/TAB_COMPLETION_GUIDE.md

# List all
tdoc list --module org
```

## See Also

- [bash/tree](../../tree/) - Generic tree system
- [bash/repl](../../repl/) - Universal REPL
- [bash/thelp](../../thelp/) - Quick help lookup
- [bash/tdoc](../../tdoc/) - Documentation manager

---

**Status**: Complete ✅
**Last Updated**: 2025-10-31
**Integration**: bash/tree + bash/repl + bash/thelp + tdoc
