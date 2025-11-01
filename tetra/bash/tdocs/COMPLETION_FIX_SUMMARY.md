# TDOCS Completion Fix Summary

## Problem
Tab completion in `tdocs repl` was:
1. Causing "bad array subscript" error
2. Falling back to shell file completion instead of custom completion

## Root Cause
- The REPL uses `read -r -e -p "$prompt"` which needs `bind -x` to override TAB behavior
- Original implementation used `${words[-1]}` which fails on empty arrays
- Used `complete -E/-D` which doesn't work with `read -e` inside functions

## Solution (v3)

Created `tdocs_repl_complete_v3.sh` that:
- Uses `bind -x '"\t": _tdocs_repl_tab_complete'` to bind TAB key
- Safely parses READLINE_LINE without array subscript errors
- Shows completions based on context (command, flags, modules, documents)
- Handles single match (auto-complete) and multiple matches (show list)

## How It Works

```bash
# When user presses TAB during read -e:
1. readline calls _tdocs_repl_tab_complete (via bind -x)
2. Function parses $READLINE_LINE into words
3. Determines context (command, position, previous word)
4. Generates appropriate completions
5. Updates $READLINE_LINE and $READLINE_POINT
```

## Completion Contexts

- **Empty line**: Shows all commands (ls, view, search, filter, etc.)
- **ls [TAB]**: Shows --core, --other, --module, --preview, documents
- **ls --module [TAB]**: Shows available modules from database
- **filter [TAB]**: Shows core, other, module, clear, reset
- **filter module [TAB]**: Shows available modules
- **view [TAB]**: Shows documents and --pager, --meta-only, --raw
- **init [TAB]**: Shows files and flags (--core, --other, --type, --module)
- **init --type [TAB]**: Shows document types

## Testing

```bash
# In terminal:
source ~/tetra/tetra.sh
tmod load tdocs
tdocs repl

# Try these:
<TAB>              # Shows all commands
ls <TAB>           # Shows options
filter <TAB>       # Shows filter types
filter module <TAB> # Shows modules
view <TAB>         # Shows documents
```

## Files Modified

- `bash/tdocs/tdocs_repl.sh` - Now sources v3 completion
- `bash/tdocs/tdocs_repl_complete_v3.sh` - NEW: Working completion with bind -x

## Key Changes from v1/v2

| Aspect | v1 | v2 | v3 (current) |
|--------|----|----|--------------|
| Method | bind -x | complete -E/-D | bind -x |
| Array access | `${words[-1]}` ❌ | `${COMP_WORDS[$i]}` | Safe indexing ✅ |
| Works with read -e | No | No | **Yes** ✅ |
| Error-free | No (bad subscript) | Yes | Yes ✅ |

## Why v3 Works

`bind -x` **does** work with `read -e` when:
- ✅ The shell is interactive (which the REPL is)
- ✅ The function is exported and available
- ✅ Called in the same shell session (not a subshell)

The REPL runs interactively, so `bind -x` affects the `read -e` calls.

## Integration with bash/repl

The completion integrates properly with:
- ✅ `REPL_SLASH_HANDLERS` - reads registered commands
- ✅ `repl_set_module_context("tdocs")` - uses module context
- ✅ Takeover mode - completes without "/" prefix
- ✅ Dynamic data - pulls modules/docs from database

## Next Steps

If completion still shows files instead of commands:
1. Verify tdocs is loaded: `declare -F tdocs_repl`
2. Check bind status inside REPL: type `/shell bind -P | grep \\t`
3. Check function is available: type `/shell declare -F _tdocs_repl_tab_complete`
4. Try reloading: exit REPL, `tmod reload tdocs`, `tdocs repl`

## Fallback for Files

For `init` command, we intentionally let file completion work since you're selecting a file to initialize. For other contexts, custom completion takes over.
