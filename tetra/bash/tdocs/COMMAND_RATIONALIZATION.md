# TDOCS Command Rationalization

## Summary of Changes

Simplified and clarified the command set based on user feedback.

## Changes Made

### 1. **Removed `init` command** ❌
**Before**: `tdocs init <file>` (confusing - sounds like creating a file)
**After**: `tdocs add <file>` (clear - adding metadata to database)

### 2. **Removed `discover` command** ❌
**Before**: `tdocs discover` (abstract, unclear)
**After**: `tdocs scan` (concrete, familiar)

### 3. **Made indexing the default** ✓
**Before**:
```bash
tdocs discover              # Just reports, doesn't do anything
tdocs discover --auto-init  # Actually does the work
```

**After**:
```bash
tdocs scan              # Does the work (indexes documents)
tdocs scan --dry-run    # Just previews, doesn't index
```

## Final Command Set

```bash
# VIEWING
tdocs ls [-l]           # List documents (detailed with -l)
tdocs view <n>          # View document #n from last ls
tdocs search <q>        # Search for text
tdocs module <name>     # Show module documentation

# MANAGING
tdocs add <file>        # Add metadata (smart defaults, minimal prompting)
tdocs scan              # Index all documents (default: actually indexes)
tdocs scan --dry-run    # Preview what would be indexed
tdocs tag <file>        # Edit tags interactively

# FILTERING
tdocs filter module <m>     # Scope to module
tdocs filter type <t>       # Filter by type
tdocs filter authority <a>  # Filter by authority
tdocs clear                 # Clear all filters

# SORT KEYS
r t l a                 # relevance | time | level | alpha
```

## Rationale

### Why `add` instead of `init`?
- **`init`** implies creating a new file (like `git init`, `npm init`)
- **`add`** implies adding to database (like `git add`)
- More accurate: you're adding metadata, not initializing a file

### Why `scan` instead of `discover`?
- **`discover`** is abstract and passive
- **`scan`** is concrete and familiar (like `nmap scan`, `virus scan`)
- Shorter, clearer

### Why index by default?
- **Principle of least surprise**: When you scan, you expect results to be usable
- **Common pattern**: Most tools do the action by default (use `--dry-run` to preview)
- **Fewer steps**: One command instead of two

## Migration Guide

### For Users

**Old commands still work** (for now):
```bash
tdocs init <file>             # → use 'tdocs add <file>' instead
tdocs discover                # → use 'tdocs scan --dry-run' instead
tdocs discover --auto-init    # → use 'tdocs scan' instead
```

### For Scripts

Update any automation scripts:
```bash
# Old
tdocs discover --auto-init

# New
tdocs scan
```

## Implementation Details

### Files Changed

1. **core/search.sh**: Renamed `tdoc_discover_docs` → `tdoc_scan_docs`
2. **tdocs_repl.sh**: Updated command routing
3. **tdocs_commands.sh**: Updated command handlers
4. **tdocs.sh**: Updated main dispatcher
5. **core/help.sh**: Updated help text

### Behavior Changes

**tdoc_scan_docs()**:
- **Before**: Required `--auto-init` flag to actually index
- **After**: Indexes by default, use `--dry-run` to preview only

**Status field**:
- **Before**: Documents got `status=discovered`
- **After**: Documents get `status=scanned`

## Examples

### Before (confusing):
```bash
$ tdocs discover
Found 50 documents needing indexing
Run 'tdocs discover --auto-init' to index

$ tdocs discover --auto-init
✓ Indexed 50 documents

$ tdocs init myfile.md
# Interactive prompting...
```

### After (clear):
```bash
$ tdocs scan --dry-run
Found 50 documents needing indexing
Run 'tdocs scan' to index

$ tdocs scan
✓ Indexed 50 documents

$ tdocs add myfile.md
  type:      guide ✓
  tags:      2025-11-07 ✓
[enter to accept]
>
```

## Design Principles Applied

1. **Clarity over cleverness**: Simple, obvious names
2. **Do by default**: Action happens unless told otherwise
3. **Standard patterns**: Use `--dry-run` like other Unix tools
4. **Fewer concepts**: Removed confusing distinctions

## Related Documentation

- **SEMANTIC_MODEL.md**: Type/Kind/Module/Env taxonomy
- **SEMANTIC_MODEL_SUMMARY.md**: Implementation summary
- **core/help.sh**: User-facing help text

## Future Considerations

### Possible aliases (if users request):
```bash
tdocs index         # Alias for 'scan'
tdocs refresh       # Alias for 'scan'
```

### Deprecation timeline:
- **v1.0**: Old commands work with deprecation warnings
- **v2.0**: Old commands removed entirely

For now, keeping old commands working silently for compatibility.
