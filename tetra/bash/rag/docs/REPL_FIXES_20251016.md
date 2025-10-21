# RAG REPL Fixes - Array Subscript and History Issues

## Issues Identified

### 1. Three Competing Completion Systems
- **rag_completion.sh**: External bash-completion for `rag` command (COMP_WORDS context)
- **rag_completion_tree.sh**: Tree-based completion (also external, COMP_WORDS context)
- **_rag_tab_handler in rag_repl.sh**: Internal REPL completion using `bind -x` (READLINE_LINE context)
- **_rag_repl_complete()**: Dead code attempting to use COMP_WORDS inside REPL

### 2. Array Subscript Error
**Location**: `bash/rag_repl.sh:155`

**Problem**: 
```bash
local words=($line)  # Not explicitly declared as array
cur="${words[-1]}"   # Bad subscript error
```

**Root Cause**: In bash, when using `bind -x`, only `READLINE_LINE` is available, not `COMP_WORDS`. The array was not properly declared, causing negative index access to fail.

### 3. Shell History Corruption
**Problem**: After exiting REPL, shell history navigation (Up/Down arrows) was broken

**Root Cause**:
- REPL binds custom history handlers to arrow keys with `bind -x`
- On exit, attempted to restore bindings but didn't save original state
- Function-local bind commands don't affect parent shell properly

## Solutions Applied

### Fix 1: Proper Array Declaration in TAB Handler
```bash
# BEFORE
local words=($line)
local cmd="${words[0]}"
cur="${words[-1]}"

# AFTER  
local -a words           # Explicitly declare as array
read -ra words <<< "$line"   # Safe parsing
local cmd="${words[0]:-}"
cur="${words[${#words[@]}-1]:-}"  # Safe negative index alternative
```

### Fix 2: Removed Dead Completion Code
Deleted `_rag_repl_complete()` function which:
- Was never called inside REPL
- Tried to use COMP_WORDS (only available in bash-completion context)
- Added confusion about which completion system was active

### Fix 3: Proper Binding State Management
```bash
# Save original bindings on REPL entry
_saved_up_bind=$(bind -p | grep '"\\\e\[A":' || echo 'bind "\e[A": previous-history')
_saved_down_bind=$(bind -p | grep '"\\\e\[B":' || echo 'bind "\e[B": next-history')
_saved_tab_bind=$(bind -p | grep '"\\\t":' || echo 'bind "\t": complete')

# Restore via RETURN trap
trap '[[ $history_was_on -eq 1 ]] && set -o history; eval "$_saved_up_bind"; eval "$_saved_down_bind"; eval "$_saved_tab_bind"' RETURN
```

## Completion System Architecture (Final State)

### External Commands (outside REPL)
- `rag` command → **rag_completion.sh** (_rag_complete + _mc_complete)
- Uses bash-completion framework with COMP_WORDS

### Inside REPL
- TAB key → **_rag_tab_handler** (using bind -x)
- Up/Down → **_rag_history_up/_down** (custom REPL history)
- Uses READLINE_LINE only

### Tree-based Completion (rag_completion_tree.sh)
- Currently loaded but not actively used
- Available for future integration
- Implements recursive/hierarchical completion

## Key Learnings

1. **bind -x context**: Only `READLINE_LINE`, `READLINE_POINT` available; no COMP_WORDS
2. **Array safety**: Always use `local -a` for arrays and safe indexing
3. **Binding persistence**: Must save and restore via trap, not inline
4. **Separation of concerns**: REPL completion != external bash-completion

## Files Modified
- `bash/rag_repl.sh`: Lines 38-53 (binding management), 152-168 (array handling), 341-345 (exit cleanup), 987-988 (removed dead code)

## Testing Checklist
- [ ] Start REPL, TAB completion works
- [ ] Up/Down arrow navigates REPL history
- [ ] Exit REPL
- [ ] Up/Down arrow still works in shell
- [ ] Shell history intact
- [ ] No "bad array subscript" errors
