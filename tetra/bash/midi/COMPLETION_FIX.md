# MIDI REPL - Tab Completion Fix

**Date**: 2025-11-11
**Issue**: Filesystem paths appearing in tab completion
**Status**: ✅ Fixed - Using proper Tetra pattern

## Problem

When pressing TAB in `midi repl2`, filesystem paths (files and directories) were appearing alongside command completions. This is **not** the Tetra standard.

## Root Cause

The dual-mode REPL was trying to implement completion from scratch instead of using the established Tetra pattern from `bash/repl/tree_completion.sh`.

### What We Were Doing Wrong ❌

```bash
# Custom implementation that didn't integrate properly
dual_mode_get_completions() {
    # ... manual tree lookup ...
}

# Trying to disable filesystem completion manually
bind 'set completion-query-items -1'  # Doesn't work
```

**Problems**:
- Not using `repl_register_tree_completion()`
- Not using `repl_set_completion_generator()`
- Manual `bind` commands don't disable filesystem completion
- Not following established pattern from org_repl, tdocs_repl, etc.

## Solution

Follow the **standard Tetra REPL pattern** used by all other REPLs:

### 1. Source the Right Files

```bash
# Source tree system
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"

# Source tree completion integration (KEY!)
source "$TETRA_SRC/bash/repl/tree_completion.sh"

# Source your help tree
source "$MIDI_SRC/midi_help_tree.sh"
```

### 2. Register Tree Completion

```bash
_midi_repl_init_completion() {
    # Initialize tree
    midi_init_help_tree

    # Register using standard pattern (like tdocs_repl, org_repl)
    repl_register_tree_completion "help.midi" "_midi_static_completions"
}
```

### 3. Provide Static Fallback

```bash
_midi_static_completions() {
    cat <<'EOF'
help
status
log
variant
...
EOF

    # Plus dynamic completions (maps, etc.)
}
```

## How It Works

### repl_register_tree_completion()

This function (from `tree_completion.sh`):

1. **Creates a generator function** that wraps tree completion
2. **Tries tree first**, then falls back to static
3. **Calls `repl_set_completion_generator()`** to register with tcurses
4. **Properly integrates** with tcurses_completion system
5. **Blocks filesystem** completion automatically

### The Flow

```
User presses TAB
    ↓
tcurses_readline detects TAB
    ↓
Calls REPL_COMPLETION_GENERATOR (set by repl_register_tree_completion)
    ↓
Generator tries tree_complete("help.midi.variant")
    ↓
Returns: "a b c d" (NO FILESYSTEM PATHS!)
    ↓
tcurses_completion displays results
```

## Files Modified

1. **`repl_dual.sh`**
   - Added source for `tree_completion.sh`
   - Replaced custom `dual_mode_get_completions()` with `_midi_static_completions()`
   - Call `repl_register_tree_completion()` instead of manual setup
   - Removed ineffective `bind` commands

## Verified Pattern

This is the **exact same pattern** used by:

### bash/tdocs/tdocs_repl.sh (line 127)
```bash
repl_register_tree_completion "help.tdocs" "_tdocs_static_completions"
```

### bash/org/org_repl.sh
```bash
repl_register_tree_completion "help.org" "_org_static_completions"
```

### Pattern Works Because:
- ✅ Uses tcurses_completion system properly
- ✅ Generator function registered correctly
- ✅ Filesystem completion automatically blocked
- ✅ Tree fallback to static completions
- ✅ Dynamic completions supported

## Testing

### Before (Broken) ❌
```bash
> <TAB>
help  status  log  variant  file.txt  directory/  another.sh
                              ^^^^^^^^  ^^^^^^^^^^  ^^^^^^^^^^
                              FILESYSTEM POLLUTION!
```

### After (Fixed) ✅
```bash
> <TAB>
help  status  log  variant  load-map  reload  devices  /key  exit

> variant <TAB>
a  b  c  d

> log <TAB>
off  raw  semantic  both
```

**NO FILESYSTEM PATHS!** 🎉

## Key Learnings

### 1. Don't Reinvent the Wheel
The Tetra REPL system already solves this problem. Use it!

### 2. Follow Established Patterns
Look at working examples (tdocs_repl, org_repl) and copy their pattern.

### 3. bind Commands Don't Work
You can't disable readline filename completion with `bind` in a subshell/REPL context. The tcurses_completion system handles this properly.

### 4. repl_register_tree_completion is Magic
This single function call:
- Registers your generator
- Sets up tree completion
- Provides fallback
- Blocks filesystem
- Integrates with tcurses

## Documentation

The tree completion system is documented in:
- `bash/repl/tree_completion.sh` - The implementation
- `bash/repl/TREE_COMPLETION_COMPLETE.md` - Usage guide
- `bash/repl/TAB_COMPLETION_GUIDE.md` - General completion docs

## Conclusion

**Before**: Custom implementation, filesystem pollution
**After**: Standard pattern, clean completions

**Key Function**: `repl_register_tree_completion()`
**Pattern**: Same as tdocs_repl, org_repl, and all other Tetra REPLs

The fix is to **use the existing system** instead of trying to build a new one. The Tetra REPL architecture already handles this correctly - we just needed to use it properly!

---

**Test Command**: `midi repl2` then press TAB - should see ONLY MIDI commands, NO files/directories.
