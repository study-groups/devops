# tdocs REPL - Takeover Mode Refactor Summary

## Changes Completed ✅

### 1. Switched from Hybrid to Takeover Mode

**Before**: `repl_run readline` (hybrid mode - shell passthrough)
**After**: `repl_run` (takeover mode - full REPL control)

### 2. Added Modern Prompt Builder

**New Function**: `_tdocs_repl_build_prompt()`
- Uses tmpfile for ANSI color rendering
- Format: `[category x module x count] docs ▶`
- Colored segments:
  - **Brackets**: Gray/blue (`REPL_BRACKET`)
  - **Category**: Green (core), Yellow (other), Gray (all)
  - **Module**: Blue (filtered), Gray (all)
  - **Count**: Cyan
  - **"docs"**: White
  - **Arrow ▶**: Orange

**Example Prompts**:
```
[all x all x 156] docs ▶           # All docs
[core x all x 89] docs ▶           # Core only
[core x org x 12] docs ▶           # Core org docs
```

### 3. Added Input Processor

**New Function**: `_tdocs_repl_process_input()`

Handles all commands in takeover mode (no `/` prefix needed):

**Document Commands**:
- `ls`, `list` - List documents
- `view <file>`, `v <file>` - View document
- `search <query>`, `s <query>` - Search

**Filter Commands**:
- `filter core` - Show core docs only
- `filter other` - Show other docs only
- `filter module <name>` - Show module docs
- `filter clear` - Clear filters
- Returns `2` to trigger prompt refresh

**Context/Evidence Commands**:
- `evidence add <file>` - Add to context
- `evidence list` - List context
- `evidence view <n>` - View item

**Organization Commands**:
- `tag <file> <tags>` - Tag document
- `discover` - Scan for docs
- `init` - Initialize database

**System Commands**:
- `!<cmd>` - Execute shell command (escape)
- `help`, `h`, `?` - Show help
- `exit`, `quit`, `q` - Exit REPL

### 4. Updated Welcome Message

**Old**:
```
Hybrid Mode: Shell commands work directly, /cmd for tdocs
  /discover --auto-init  ...
  /ls                    ...
```

**New**:
```
Takeover Mode: Direct commands (no shell pass-through)
  discover --auto-init  ...
  ls                    ...

Use !shell for one-off shell commands
```

### 5. Set Execution Mode

```bash
REPL_EXECUTION_MODE="takeover"
```

This signals to the REPL system that tdocs has full control.

### 6. Registered Callbacks

```bash
repl_build_prompt() { _tdocs_repl_build_prompt "$@"; }
repl_process_input() { _tdocs_repl_process_input "$@"; }
export -f repl_build_prompt repl_process_input
```

### 7. Added Cleanup

```bash
unset -f repl_build_prompt repl_process_input
echo "Goodbye!"
```

---

## Behavior Changes

### Command Syntax

| Before (Hybrid) | After (Takeover) |
|----------------|------------------|
| `/ls` | `ls` or `list` |
| `/view file` | `view file` or `v file` |
| `/search query` | `search query` or `s query` |
| `/filter core` | `filter core` |
| `ls` (shell) | `!ls` (shell escape) |

### Key Differences

**Hybrid Mode** (before):
- Shell commands work by default
- `/cmd` for tdocs commands
- Can accidentally run shell commands
- More flexible but confusing

**Takeover Mode** (after):
- tdocs commands by default
- `!cmd` for shell commands
- Clear separation of concerns
- Consistent with org REPL

---

## Usage Examples

### Basic Commands

```bash
$ tdocs
[all x all x 156] docs ▶ ls
<shows all documents>

[all x all x 156] docs ▶ filter core
Filter: core documents only
[core x all x 89] docs ▶

[core x all x 89] docs ▶ filter module org
Filter: module = org
[core x org x 12] docs ▶

[core x org x 12] docs ▶ view README.md
<shows README with syntax highlighting>

[core x org x 12] docs ▶ search authentication
<searches for "authentication">
```

### Shell Escape

```bash
[all x all x 156] docs ▶ !pwd
/Users/mricos/src/devops/tetra

[all x all x 156] docs ▶ !git status
On branch main...
```

### Filter Management

```bash
[all x all x 156] docs ▶ filter core
[core x all x 89] docs ▶ filter module rag
[core x rag x 8] docs ▶ filter clear
[all x all x 156] docs ▶
```

---

## File Structure

**Modified File**: `bash/tdocs/tdocs_repl.sh`

**New Functions**:
1. `_tdocs_repl_build_prompt()` - Lines 48-126
2. `_tdocs_repl_process_input()` - Lines 132-298

**Modified Sections**:
- Dependencies: Added `bash/color/repl_colors.sh`
- Main REPL: Set `REPL_EXECUTION_MODE="takeover"`
- Callbacks: Register both prompt builder and input processor
- Welcome message: Updated for takeover mode
- Cleanup: Unset callbacks on exit

**Total Lines**: ~370 (was ~130)

---

## Benefits

### For Users

1. **Consistency**: Same mode as org REPL
2. **Clarity**: No confusion about shell vs tdocs commands
3. **Safety**: Can't accidentally run destructive shell commands
4. **Visual**: Colored prompt shows state at a glance

### For Developers

1. **Control**: Full control over input processing
2. **Extensibility**: Easy to add new commands
3. **State Management**: Prompt updates automatically
4. **Modern Pattern**: Matches rag/org REPL architecture

---

## Next Steps (from NAVIGATION_PLAN.md)

### Phase 1: TAB Navigation

Create `bash/tdocs/navigation.sh`:
```bash
tdocs_nav_push()         # Push level onto stack
tdocs_nav_pop()          # Pop level from stack
_tdocs_tab_complete()    # TAB handler
_tdocs_shift_tab_up()    # Shift-TAB handler
```

Implement hierarchy:
```
All → Category → Module → Document → Section
```

### Phase 2: Context Building

Create `bash/tdocs/context.sh`:
```bash
tdocs_context_new()      # Create context
tdocs_context_add()      # Add document
tdocs_context_assemble() # Build .mdctx file
```

Add context indicator to prompt:
```
[core x org x 12 ⊕3] docs ▶
                 ↑
            3 items in context
```

---

## Testing

### Verify Syntax
```bash
bash -n bash/tdocs/tdocs_repl.sh
```

### Test Prompt Builder
```bash
export TETRA_SRC=/path/to/tetra
export TETRA_DIR=~/tetra
source bash/color/color.sh
source bash/color/repl_colors.sh
source bash/tdocs/tdocs_repl.sh
```

### Launch REPL
```bash
source ~/tetra/tetra.sh
tmod load tdocs
tdocs
```

---

## Status

- ✅ Takeover mode enabled
- ✅ Prompt builder with colors
- ✅ Input processor with command routing
- ✅ Filter management with state updates
- ✅ Shell escape with `!cmd`
- ✅ Help system integrated
- ⏳ TAB navigation (planned)
- ⏳ Context building (planned)

**Ready for use!** 🚀
