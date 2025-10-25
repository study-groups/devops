# REPL Documentation Harmonization

**Date**: 2025-10-24
**Task**: Review and harmonize all REPL documentation with actual code

## Summary

Reviewed all REPL-related documentation and identified/fixed major inconsistencies between docs and implementation.

## Key Findings

### 1. Two Implementation Patterns (Not Clearly Documented)

The bash/repl system supports two distinct usage patterns, but docs conflated them:

**Pattern 1: Custom Routing** (Simple, Full Control)
- Module overrides `repl_process_input()` completely
- Implements own command dispatch
- Used by: game modules, org module
- ~40 lines of code per module

**Pattern 2: Built-in Routing** (Feature-Rich)
- Module uses `repl_register_slash_command()`
- Leverages built-in augment/takeover modes
- Gets `/help`, `/theme`, `/mode` for free
- Used by: rag module
- ~15 lines of code per module

### 2. Two Independent Mode Systems (Confused in Docs)

**Input Modes** (how input is read):
- basic / enhanced / tui
- Auto-detected based on terminal capabilities

**Execution Modes** (how commands are routed):
- augment (shell-first) vs takeover (module-first)
- Only applies to Pattern 2 (built-in routing)

### 3. bind -x Doesn't Work (Incorrect Examples)

Multiple docs showed `bind -x` for keybindings, but:
- `bind -x` doesn't work inside `read -e` or `tcurses_input_read_line`
- bash/repl uses `read -e` in enhanced mode
- Keybindings can't refresh prompts mid-input

**Solution**: Use commands instead of keybindings (e.g., `env` to cycle, not Ctrl+E)

### 4. Slash Command Confusion

Docs showed `/cmd` as universal, but reality:
- `/cmd` meta commands only work with Pattern 2 (built-in routing)
- Pattern 1 modules must implement own slash command handling
- In takeover mode (Pattern 2), commands don't need `/` prefix

## Documentation Changes

### Created

1. **bash/repl/ARCHITECTURE_CLARIFICATION.md** ✨ NEW
   - Explains two patterns clearly
   - Shows when to use each
   - Documents common misconceptions
   - Provides migration path

### Updated

2. **bash/repl/README.md**
   - Updated Overview to mention two patterns
   - Replaced "Quick Start" with Pattern 1 and Pattern 2 examples
   - Removed bind -x keybinding examples
   - Updated Org REPL example to show Pattern 1 correctly
   - Added note about bind -x not working

3. **bash/game/REPL_ARCHITECTURE.md**
   - Updated intro to specify Pattern 1
   - Fixed "Built-in Commands" section (now "Built-in Features")
   - Removed `/mode`, `/theme` from game REPL features
   - Fixed Pulsar example (removed `/mode repl` command)
   - Updated migration notes to reflect Pattern 1 benefits

### Existing (No Changes Needed)

4. **bash/org/REFACTOR_SUMMARY.md**
   - Already correctly documents Pattern 1 usage ✅
   - Already documents takeover-style (no `/` prefix) ✅
   - Already documents TDS theme integration ✅

## Code Validation

All code implementations match the updated docs:

✅ **bash/repl/command_processor.sh** (lines 40-89)
- Implements augment/takeover routing correctly
- Only used if module doesn't override `repl_process_input()`

✅ **bash/game/games/pulsar/pulsar_repl.sh** (lines 315-420)
- Pattern 1 implementation (overrides `repl_process_input()`)
- Takeover-style (commands without prefix, `!` for shell)

✅ **bash/org/org_repl.sh** (lines 117-193)
- Pattern 1 implementation
- Takeover-style commands (`env`, `mode`, `action`)
- TDS theme palette integration

✅ **bash/repl/core/mode.sh**
- Execution modes properly defined (augment/takeover)
- Only used by built-in routing (Pattern 2)

## Impact

### For Developers

**Before**: Confusion about when to use `/cmd` vs `cmd`, why bind -x doesn't work, whether all REPLs support `/mode`

**After**: Clear understanding of two patterns, when each applies, and how to implement correctly

### For Users

**Before**: Inconsistent command syntax across modules, unclear whether `/help` works

**After**: Game REPLs = commands without prefix, Tool REPLs = slash commands (or override specific)

### For Maintainers

**Before**: Examples that don't work (bind -x), unclear architecture

**After**: Working examples, clear architecture, easy to choose pattern

## Recommendations

### For New Modules

1. **Game modules** → Use Pattern 1 (custom routing)
   - Full control over UX
   - Takeover-style feels natural for games
   - Example: bash/game/games/pulsar/pulsar_repl.sh

2. **Tool modules** → Consider Pattern 2 (built-in routing)
   - Less code
   - Built-in `/help`, `/theme`, `/mode`
   - Example: bash/repl/test_repl.sh

3. **Complex tools** → Pattern 1 if needed
   - Example: bash/org (complex state: env × mode × action)

### Documentation Maintenance

When adding REPL docs:
1. Specify which pattern (1 or 2)
2. Don't assume `/cmd` works (only Pattern 2)
3. Don't use bind -x examples
4. Show takeover-style for Pattern 1 (commands without prefix)

## Files Modified

- ✨ `bash/repl/ARCHITECTURE_CLARIFICATION.md` - NEW comprehensive architecture doc
- ✏️ `bash/repl/README.md` - Fixed Quick Start, removed bind -x, clarified patterns
- ✏️ `bash/game/REPL_ARCHITECTURE.md` - Fixed game-specific examples and features
- 📄 `bash/repl/DOCUMENTATION_HARMONIZATION.md` - THIS FILE

## See Also

- `bash/repl/ARCHITECTURE_CLARIFICATION.md` - Comprehensive architecture guide
- `bash/org/REFACTOR_SUMMARY.md` - Pattern 1 example (org module)
- `bash/repl/command_processor.sh` - Pattern 2 implementation
- `bash/game/games/pulsar/pulsar_repl.sh` - Pattern 1 example (game module)

---

**Status**: ✅ Documentation harmonized with code
**Next**: Update any remaining module-specific docs if needed
