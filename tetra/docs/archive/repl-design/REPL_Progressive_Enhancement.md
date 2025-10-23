# REPL Progressive Enhancement Design

**Status:** Design Proposal
**Date:** 2025-10-17
**TCS Version:** 3.0.1

## Vision

Create a **progressive enhancement model** for the Tetra REPL that starts simple and allows users to summon increasingly powerful features through deliberate actions.

## Principles

1. **Start Simple**: Default REPL is line-based, robust, minimal
2. **Opt-In Enhancement**: User explicitly enables advanced features
3. **TES-First**: Bring Tetra Endpoint Specification to forefront
4. **Action-Aware**: Prompt reflects current action selection
5. **No Fragility**: Character-aware mode only when explicitly requested

## Three REPL Modes

### Mode 1: Basic (Default)

**Start**: `tetra repl`

**Behavior**:
- Line-based `read -r -p`
- No stty manipulation
- Readline editing (Ctrl-A/E, arrows)
- Works in any terminal context

**Prompt**:
```
[org × env × mode] tetra>
```

**Example**:
```
[pixeljam-arcade × Local × all] tetra> list modules
[pixeljam-arcade × Local × all] tetra> /env Dev
Environment: Dev
[pixeljam-arcade × Dev × all] tetra>
```

### Mode 2: Enhanced (Opt-In via Slash Command)

**Start**: Type `/enhance` in Basic mode

**Behavior**:
- Character-aware input with `tcurses_input_read_key_blocking()`
- **@** trigger: Fuzzy file finder (fzf)
- **::** trigger: TES endpoint selector
- **Ctrl-A / Ctrl-Shift-A**: Cycle through available actions
- Action selection updates prompt

**Prompt Evolution**:
```
[org × env × mode] tetra> /enhance
Enhanced mode activated
[org × env × mode] tetra>

# After Ctrl-A (cycle action)
[org × env × mode] rag.select:files>

# After :: trigger
[org × env × mode] rag.select:files> @local::
[TES Endpoint Selector appears]
```

**Triggers**:

**@ (File/Resource Finder)**:
```bash
[org × env × mode] rag.select:files> @
# Launches fzf with:
# - git ls-files (if in repo)
# - Module symbols (@vox:*, @qa:*)
# - TES symbols (@dev, @staging, @prod)
```

**:: (Endpoint Specification)**:
```bash
[org × env × mode] rag.select:files> @local::
# Shows TES endpoint selector:
# - line,line    (line range)
# - byte,byte    (byte range)
# - function     (function extraction)
# - class.method (class method)
# - *            (entire file)
```

### Mode 3: TUI (Full Visual)

**Start**: Type `/tui` in Enhanced mode OR `tetra tui`

**Behavior**:
- Full-screen TUI with panels
- Navigation mode (arrow keys, vim bindings)
- Action selection via visual menu
- Live preview of TES resolution
- Animated separator (oscillator)

## Action-Aware Prompt System

### Action Selection

**Ctrl-A**: Cycle forward through available actions
**Ctrl-Shift-A**: Cycle backward through available actions

### Prompt Format

When no action selected:
```
[org × env × mode] tetra>
```

When action selected:
```
[org × env × mode] module.verb:noun>
```

With TES endpoint:
```
[org × env × mode] module.verb:noun @target::endpoint>
```

### Examples

**Cycling Actions**:
```
[pja × Dev × rag] tetra> Ctrl-A
[pja × Dev × rag] rag.select:files> Ctrl-A
[pja × Dev × rag] rag.list:agents> Ctrl-A
[pja × Dev × rag] rag.query:qa> Ctrl-A
[pja × Dev × rag] tetra>  (wraps around)
```

**Building TES Command**:
```
[pja × Dev × rag] rag.select:files> @      (trigger file finder)
[pja × Dev × rag] rag.select:files> src/foo.sh
[pja × Dev × rag] rag.select:files> src/foo.sh::    (trigger endpoint)
[pja × Dev × rag] rag.select:files> src/foo.sh::function
[pja × Dev × rag] rag.select:files> src/foo.sh::function <enter>
# Executes: rag select files src/foo.sh::function
```

## Implementation Plan

### Phase 1: Basic Mode (DONE)
- [x] Line-based REPL with readline
- [x] Dynamic [org × env × mode] prompt
- [x] Slash commands (/help, /env, /mode, /org)
- [x] Action dispatch integration

### Phase 2: Action Selection
- [ ] Extract available actions from context
- [ ] Implement Ctrl-A/Ctrl-Shift-A cycling
- [ ] Update prompt to show selected action
- [ ] Parse action on Enter with pre-filled verb:noun

### Phase 3: Enhanced Mode
- [ ] /enhance command to enable character-aware mode
- [ ] @ trigger for fuzzy finder (files + symbols)
- [ ] :: trigger for TES endpoint selector
- [ ] Seamless toggle between Basic ↔ Enhanced

### Phase 4: TES Integration
- [ ] TES endpoint validation in prompt
- [ ] Visual TES resolution preview
- [ ] Endpoint autocomplete suggestions
- [ ] /resolve command to show 8-phase TES pipeline

### Phase 5: TUI Mode
- [ ] /tui command to launch full TUI
- [ ] Port demo/basic/014 patterns
- [ ] Live TES resolution display
- [ ] Visual action selection menu

## Key Design Decisions

### 1. No Character Mode by Default

**Problem**: Character-aware mode with stty is fragile
**Solution**: Start line-based, opt-in to character mode
**Benefit**: Robust default, power when needed

### 2. Action Selection Before Input

**Problem**: User doesn't know what actions are available
**Solution**: Ctrl-A cycles through actions, shows in prompt
**Benefit**: Discoverability, less typing

### 3. TES at the Forefront

**Problem**: TES is powerful but hidden
**Solution**: :: trigger and /resolve command
**Benefit**: Makes TES first-class citizen

### 4. Progressive Enhancement

**Problem**: Users need different power levels
**Solution**: Three distinct modes with clear transitions
**Benefit**: Simple for beginners, powerful for experts

## File Structure

```
bash/tetra/interfaces/
├── repl.sh              # Basic mode (current)
├── repl_enhanced.sh     # Enhanced mode with triggers
├── repl_actions.sh      # Action selection system
├── repl_tes.sh          # TES integration
└── repl_tui.sh          # TUI mode (future)
```

## Slash Commands

**Mode Control**:
- `/enhance` - Enable character-aware mode with triggers
- `/basic` - Return to basic line mode
- `/tui` - Launch full TUI mode

**TES Commands**:
- `/resolve <action>` - Show 8-phase TES resolution
- `/endpoint <file> <type>` - Show endpoint options
- `/symbols` - List all TES symbols

**Action Commands**:
- `/actions` - List available actions in current context
- `/select <action>` - Pre-select action
- `/clear` - Clear action selection

## Success Criteria

✅ **Robust Default**: Basic mode works in all terminal contexts
✅ **Clear Progression**: User knows how to access more power
✅ **TES Visibility**: Endpoints are discoverable and validated
✅ **Action Discovery**: Ctrl-A makes actions explorable
✅ **No Surprises**: Each mode behaves predictably

## Examples

### Basic to Enhanced Flow

```bash
$ tetra repl
[pja × Local × all] tetra> /enhance
Enhanced mode activated. Use @ for finder, :: for endpoints, Ctrl-A for actions.

[pja × Local × all] tetra> ^A
[pja × Local × all] rag.select:files> @
# fzf appears with file list
[pja × Local × all] rag.select:files> src/core.sh::
# TES endpoint selector appears
[pja × Local × all] rag.select:files> src/core.sh::100,200
[pja × Local × all] rag.select:files> src/core.sh::100,200 <enter>

Executing: rag select files src/core.sh::100,200
[Selected lines 100-200 from src/core.sh]
```

### TES Resolution Preview

```bash
[pja × Dev × rag] tetra> /resolve rag.query:qa @dev
TES Resolution Pipeline (8 Phases)
═══════════════════════════════════════════

Phase 0: Symbol
  symbol = "@dev"
  type = remote

Phase 1: Address
  address = "137.184.226.163"
  droplet = "pxjam-arcade-dev01"

[... 8 phases ...]

Phase 7: Plan
  ssh -i ~/.ssh/id_rsa root@137.184.226.163 \
    "su - dev -c 'source ~/tetra/tetra.sh && rag query qa \"question\"'"
```

## Next Steps

1. Design action selection data structure
2. Implement Ctrl-A/Ctrl-Shift-A keybindings
3. Create /enhance command infrastructure
4. Port trigger system from old repl_core.sh
5. Build TES endpoint selector
6. Add /resolve command

---

**Key Insight**: The REPL should match the user's mental model—start simple, grow powerful on demand, with TES as the unifying abstraction.
