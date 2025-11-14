# MIDI REPL - Dual Mode Refactor Plan

## Executive Summary

Refactor the MIDI REPL (and improve the base tetra/bash/repl) to support two distinct input modes:

1. **CLI Mode (default)**: Standard command-line interface with readline, history, tab completion
2. **Key-Command Mode**: Single-keystroke mode for instant MIDI control commands

**Mode Switching**:
- Start in CLI mode by default
- Press `<space>` at column 1 → Enter key-command mode
- Press `ESC` → Return to CLI mode

---

## Current Architecture Analysis

### MIDI REPL (bash/midi/core/repl.sh)
**Current State**: Pure TUI mode only
- Uses `tcurses_input_read_key_blocking()` to capture every keystroke
- Single-key bindings: `l`=log, `a-d`=variants, `s`=status, `q`=quit, `h`=help
- No CLI mode - can't enter commands
- Raw terminal mode (`stty raw -echo`)
- Custom prompt rendering with ANSI codes

**Problems**:
1. No way to enter text commands
2. Can't leverage bash history/readline
3. Can't run diagnostic commands or inspections
4. Limited to predefined single-key actions

### Base REPL System (bash/repl/)
**Current State**: Two separate systems
- `repl.sh`: Full readline/history system with mode detection
- `tui_repl.sh`: Separate TUI implementation
- `mode_repl.sh`: Mode-based REPL with symbol support

**Problems**:
1. Fragmented - no unified dual-mode approach
2. No built-in mode switching mechanism
3. TUI mode and CLI mode are separate codebases
4. Each module implements its own mode logic

---

## Design: Unified Dual-Mode Architecture

### Mode States

```
┌─────────────┐
│  CLI Mode   │ ← Default start state
│  (readline) │
└─────┬───────┘
      │ <space> at column 1
      ↓
┌─────────────┐
│ Key-Command │
│    Mode     │
└─────┬───────┘
      │ <ESC>
      ↓
┌─────────────┐
│  CLI Mode   │
└─────────────┘
```

### Visual Indicators

**CLI Mode Prompt**:
```
[no-device] [--] [log:off] 239.1.1.1:1983 > _
                                          ^^^ Normal readline cursor
```

**Key-Command Mode Prompt**:
```
[no-device] [--] [log:off] 239.1.1.1:1983 [KEY] _
                                          ^^^^^^ Indicator
```

Or use color/formatting:
```
[no-device] [--] [log:off] 239.1.1.1:1983 ⌨ _
                                          ^ Key icon
```

---

## Implementation Plan

### Phase 1: Core Mode Manager (bash/repl/core/dual_mode.sh)

Create a new core module that handles mode switching:

```bash
#!/usr/bin/env bash
# bash/repl/core/dual_mode.sh
# Unified dual-mode input handler

# Mode state
REPL_INPUT_MODE="cli"  # "cli" or "key"

# Mode detection from input
repl_dual_mode_check_trigger() {
    local input="$1"
    local cursor_col="$2"

    # Space at column 1 → switch to key mode
    if [[ "$input" == " " && "$cursor_col" == "0" ]]; then
        echo "key"
        return 0
    fi

    echo "cli"
    return 0
}

# Switch mode
repl_dual_mode_switch() {
    local new_mode="$1"
    REPL_INPUT_MODE="$new_mode"

    if [[ "$new_mode" == "key" ]]; then
        # Enter raw terminal mode for key capture
        stty raw -echo 2>/dev/null
        tput civis 2>/dev/null || printf '\033[?25l'
    else
        # Return to cooked mode for readline
        stty sane 2>/dev/null
        stty echo 2>/dev/null
        tput cnorm 2>/dev/null || printf '\033[?25h'
    fi
}

# Read input based on mode
repl_dual_mode_read() {
    if [[ "$REPL_INPUT_MODE" == "key" ]]; then
        # Key mode - single keystroke
        tcurses_input_read_key_blocking
    else
        # CLI mode - readline
        tcurses_readline_read
    fi
}
```

### Phase 2: Refactor MIDI REPL (bash/midi/core/repl.sh)

```bash
#!/usr/bin/env bash
# MIDI REPL - Dual Mode Edition

# Import dual-mode system
source "$TETRA_SRC/bash/repl/core/dual_mode.sh"

# MIDI state (same as before)
REPL_CONTROLLER=""
REPL_VARIANT=""
MIDI_REPL_LOG_MODE="off"

# Key handlers (refactor existing)
midi_key_handle() {
    local key="$1"

    case "$key" in
        $'\x1b')  # ESC - return to CLI mode
            repl_dual_mode_switch "cli"
            return 0
            ;;
        l|L) midi_toggle_log_mode ;;
        a|A) midi_set_variant "a" ;;
        b|B) midi_set_variant "b" ;;
        c|C) midi_set_variant "c" ;;
        d|D) midi_set_variant "d" ;;
        s|S) midi_show_status ;;
        h|H) midi_show_help ;;
        q|Q) return 1 ;;  # Signal quit
    esac

    return 0
}

# CLI command handlers (NEW)
midi_cli_handle() {
    local input="$1"

    # Check for mode switch trigger
    if [[ "$input" == " " ]]; then
        repl_dual_mode_switch "key"
        return 0
    fi

    # Process as command
    case "$input" in
        "")
            # Empty - just redraw prompt
            return 0
            ;;
        help|h|\?)
            midi_show_help
            ;;
        status|s)
            midi_show_status
            ;;
        log*)
            # Parse: log [off|raw|semantic|both]
            local mode="${input#log }"
            [[ -n "$mode" ]] && MIDI_REPL_LOG_MODE="$mode"
            ;;
        variant*)
            # Parse: variant <a|b|c|d>
            local v="${input#variant }"
            midi_set_variant "$v"
            ;;
        load-map*)
            # Parse: load-map <name>
            local map="${input#load-map }"
            midi_osc_send "/midi/control/load-map" "$map"
            ;;
        reload)
            midi_osc_send "/midi/control/reload"
            ;;
        devices)
            node "$MIDI_SRC/midi.js" -l
            ;;
        exit|quit|q)
            return 1
            ;;
        *)
            # Unknown command
            echo "Unknown command: $input"
            echo "Type 'help' for available commands"
            ;;
    esac

    return 0
}

# Main loop (UNIFIED)
midi_repl_loop() {
    while true; do
        # Show prompt (updates based on mode)
        midi_repl_prompt

        # Read input (mode-aware)
        local input
        if ! input=$(repl_dual_mode_read); then
            break
        fi

        # Handle Ctrl+C
        [[ "$input" == $'\x03' ]] && break

        # Dispatch to appropriate handler
        if [[ "$REPL_INPUT_MODE" == "key" ]]; then
            midi_key_handle "$input" || break
        else
            midi_cli_handle "$input" || break
        fi
    done
}

# Prompt builder (mode-aware)
midi_repl_prompt() {
    printf '\r\033[K' >&2  # Clear line

    # Build prompt components (same as before)
    local ctrl_part cc_part log_part conn_part mode_indicator

    # ... (existing prompt building code) ...

    # Mode indicator
    if [[ "$REPL_INPUT_MODE" == "key" ]]; then
        mode_indicator="${TETRA_YELLOW}[KEY]${TETRA_NC}"
    else
        mode_indicator=""
    fi

    # Print prompt
    printf '%b %b %b %b %b%b ' \
        "$ctrl_part" "$cc_part" "$log_part" "$conn_part" \
        "$mode_indicator" \
        "${TETRA_MAGENTA}>${TETRA_NC}" >&2
}

# Entry point
midi_repl() {
    # Start in CLI mode
    REPL_INPUT_MODE="cli"

    # Start OSC listener (same as before)
    midi_repl_osc_listener "0.0.0.0" "1983" &
    local listener_pid=$!

    trap "kill $listener_pid 2>/dev/null; stty sane 2>/dev/null" EXIT

    # Show welcome
    clear
    echo "✓ MIDI REPL [Dual Mode]"
    echo "  CLI mode: Type commands, use history"
    echo "  Press <space> at start → Key mode (a-d=variant, l=log, etc)"
    echo "  Press <ESC> → Return to CLI mode"
    echo ""

    # Run loop
    midi_repl_loop

    # Cleanup
    kill $listener_pid 2>/dev/null
}
```

### Phase 3: Base REPL Enhancement (bash/repl/)

Update the core REPL system to support dual-mode:

1. Add `core/dual_mode.sh` (from Phase 1)
2. Update `core/loop.sh` to support mode switching
3. Add mode indicators to `prompt_manager.sh`
4. Update `repl.sh` to include dual-mode option

```bash
# bash/repl/repl.sh (additions)

# Source dual-mode support
source "$REPL_SRC/core/dual_mode.sh"

# Enhanced repl_run with mode parameter
repl_run() {
    local mode="${1:-cli}"  # cli, key, or dual

    # ... existing setup ...

    if [[ "$mode" == "dual" ]]; then
        # Start in CLI mode, allow switching
        REPL_INPUT_MODE="cli"
        repl_dual_mode_loop
    else
        # Traditional single-mode
        repl_main_loop
    fi
}
```

---

## Benefits

### For MIDI REPL
1. **Quick actions**: Press space → `a`/`b`/`c`/`d` for instant variant switching
2. **Rich commands**: Type `load-map vmx8[0]`, `reload`, etc. in CLI mode
3. **History**: Up arrow recalls previous commands in CLI mode
4. **Debugging**: Can run diagnostic commands, check state, inspect values
5. **Flexibility**: Switch modes on the fly based on task

### For Base REPL System
1. **Reusable**: Other modules can use dual-mode (TSM, TDocs, etc.)
2. **Clean separation**: Mode logic centralized, not scattered
3. **Extensible**: Easy to add new modes or mode-specific features
4. **Testable**: Clear interfaces between modes

---

## Migration Strategy

### Step 1: Build Core Dual-Mode System
- Create `bash/repl/core/dual_mode.sh`
- Test mode switching in isolation
- Verify terminal state management

### Step 2: Refactor MIDI REPL
- Keep existing functionality as key-mode handlers
- Add CLI command handlers
- Integrate dual-mode loop
- Test both modes thoroughly

### Step 3: Update Base REPL (Optional)
- Integrate dual-mode as optional feature
- Update documentation
- Create example/demo

### Step 4: Apply to Other REPLs (Future)
- TSM REPL: CLI for service management, keys for quick actions
- TDocs REPL: CLI for search, keys for navigation
- Game REPL: CLI for dev commands, keys for game controls

---

## Key Design Decisions

### 1. Default to CLI Mode
**Rationale**: Most users expect a command prompt. Key mode is a power feature.

### 2. Space-at-column-1 Trigger
**Rationale**:
- Unlikely to accidentally trigger
- Easy to remember (space = "I want quick actions")
- Doesn't conflict with normal commands

### 3. ESC to Exit Key Mode
**Rationale**:
- Standard convention (vim, less, etc.)
- Clear intent to return to "normal" mode

### 4. Visual Mode Indicator
**Rationale**:
- User always knows what mode they're in
- Prevents confusion about why keys aren't typing

---

## Testing Plan

### Unit Tests
- Mode switching logic
- Trigger detection
- Terminal state management

### Integration Tests
- CLI commands work in CLI mode
- Key bindings work in key mode
- Mode switches preserve state
- Ctrl+C/Ctrl+D work in both modes

### User Experience Tests
- Prompt is clear in both modes
- Switching feels natural
- No accidental mode switches
- Help text is clear

---

## Documentation Updates

### User Documentation
- Update MIDI REPL README with dual-mode usage
- Add mode switching to quick start guide
- Include examples of both modes

### Developer Documentation
- Document dual-mode API
- Provide migration guide for other REPLs
- Add architecture diagrams

---

## Timeline

**Phase 1 (Core System)**: 2-3 hours
- Implement dual_mode.sh
- Test mode switching
- Verify terminal handling

**Phase 2 (MIDI REPL)**: 3-4 hours
- Refactor existing code
- Add CLI handlers
- Integrate dual-mode
- Test thoroughly

**Phase 3 (Base REPL)**: 1-2 hours
- Update repl.sh
- Update documentation
- Create demo

**Total**: ~8 hours for complete implementation

---

## Success Criteria

1. ✅ Can start MIDI REPL and see CLI prompt
2. ✅ Can type commands and use readline features
3. ✅ Can press space to enter key mode
4. ✅ Key bindings work immediately in key mode
5. ✅ ESC returns to CLI mode
6. ✅ Mode is always visually indicated
7. ✅ Terminal state is correctly managed
8. ✅ No regressions in existing functionality
9. ✅ Code is clean and maintainable
10. ✅ Documentation is complete

---

## Future Enhancements

### 1. Command History in Key Mode
Remember last N key commands, show in status

### 2. Key Chords
Support multi-key sequences (e.g., `g` then `a` = "go to variant a")

### 3. Configurable Triggers
Allow user to customize mode switch keys

### 4. Mode-Specific Help
Show different help based on current mode

### 5. Macro Recording
Record sequences of keys/commands and replay

---

## References

- Current MIDI REPL: `bash/midi/core/repl.sh`
- Base REPL: `bash/repl/repl.sh`
- TUI System: `bash/tcurses/tcurses_input.sh`
- Readline: `bash/tcurses/tcurses_readline.sh`
