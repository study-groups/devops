# TCurses Robustness Guide

## The Problem

Bash terminal I/O is fragile because:

1. **Terminal state is global** - one wrong `stty` setting breaks everything
2. **Timing-dependent** - escape sequences require careful timing
3. **Mixed blocking/non-blocking** - easy to get wrong
4. **Silent failures** - errors are often hidden

## The Solution: State Machine Architecture

### Core Principles

1. **Explicit State** - Every input state is named and tracked
2. **Validated Setup** - Terminal settings are checked after applying
3. **One Responsibility** - Each function does ONE thing
4. **Comprehensive Logging** - Debug mode shows every state transition

### Architecture

```
┌─────────────────────────────────────┐
│     Application (your code)         │
│                                     │
│  render_callback()  input_callback()│
└──────────┬─────────────┬────────────┘
           │             │
           │             │
┌──────────▼─────────────▼────────────┐
│     tcurses_v2.sh (event loop)      │
│                                     │
│  - tcurses_loop()                   │
│  - tcurses_repl()                   │
└──────────┬──────────────────────────┘
           │
           │
┌──────────▼──────────────────────────┐
│  tcurses_input_sm.sh (state machine)│
│                                     │
│  States: IDLE → ESCAPE → READY      │
│          ↓                           │
│        ERROR                         │
└──────────┬──────────────────────────┘
           │
           │
┌──────────▼──────────────────────────┐
│  tcurses_screen.sh (terminal setup) │
│                                     │
│  - Validated stty settings          │
│  - min=1 for proper blocking        │
└─────────────────────────────────────┘
```

### State Machine Flow

```
IDLE: Waiting for input
  ├─ read byte != ESC → READY (single char)
  ├─ read byte == ESC → ESCAPE (start sequence)
  ├─ timeout → stay IDLE
  └─ error → ERROR

ESCAPE: Building escape sequence
  ├─ got '[A/B/C/D' → READY (arrow key)
  ├─ got other char → READY (ESC + char)
  ├─ timeout (20ms) → READY (just ESC)
  └─ error → ERROR

READY: Have complete input
  └─ after callback → IDLE

ERROR: Handle error
  └─ log and clear → IDLE
```

## Key Fixes

### 1. Terminal Setup (tcurses_screen.sh:51)

**Before (WRONG):**
```bash
stty -echo -icanon -isig min 0 time 0  # min 0 = non-blocking!
```

**After (CORRECT):**
```bash
stty -echo -icanon -isig min 1 time 0  # min 1 = block until char available
```

### 2. Input Reading (tcurses_input_sm.sh)

**Before (WRONG):**
```bash
# Old tcurses_input.sh - mixed timeouts, no state
tcurses_input_read_key() {
    read -rsn1 -t 0.05 key  # Random timeout
    echo "$key"              # Might be empty!
}
```

**After (CORRECT):**
```bash
# State machine - explicit states and transitions
input_sm_state_idle() {
    byte=$(input_sm_read_byte 1.0) || return

    if [[ "$byte" == $'\x1b' ]]; then
        INPUT_SM_STATE="ESCAPE"
    else
        INPUT_SM_STATE="READY"
        INPUT_SM_BUFFER="$byte"
    fi
}
```

### 3. Event Loop (tcurses_v2.sh)

**Before (WRONG):**
```bash
# Old - no validation
while true; do
    key=$(tcurses_input_read_key)
    handle_input "$key"  # key might be empty!
done
```

**After (CORRECT):**
```bash
# New - validated input
while true; do
    key=$(input_sm_read_input)  # Blocks until complete input

    if [[ -z "$key" ]]; then
        echo "WARNING: empty input" >&2
        continue
    fi

    handle_input "$key"
done
```

## Testing Strategy

### Unit Tests
Test state machine in isolation:
```bash
./test_state_machine.sh
```

This will show:
- State transitions for each keypress
- No duplicate reads
- Proper escape sequence handling

### Integration Tests
Test full TUI application:
```bash
./example_clean.sh
```

Monitor log in another terminal:
```bash
tail -f /tmp/tcurses_clean_test.log
```

### What to Check
1. **No duplicates** - each keypress logged exactly once
2. **No empty inputs** - no `key=''` entries
3. **Proper escape sequences** - arrow keys work correctly
4. **Clean logs** - state transitions are logical

## REPL Mode

For line-based input (REPL, command mode):

```bash
tcurses_repl render_callback line_callback [history_file]
```

Features:
- Independent history management
- Uses bash `read -e` for line editing
- Temporarily switches to canonical mode
- History persists between sessions if file provided

Example:
```bash
handle_line() {
    local line="$1"
    echo "Got line: $line"
    [[ "$line" == "quit" ]] && return 1
    return 0
}

tcurses_repl render_frame handle_line "/tmp/my_history"
```

## Debugging

Enable state machine debug output:
```bash
export INPUT_SM_DEBUG=true
./example_clean.sh
```

This shows:
```
[INPUT_SM] STATE=IDLE, reading...
[INPUT_SM] Got char 'a', transition to READY
[INPUT_SM] STATE=IDLE, reading...
[INPUT_SM] Got ESC, transition to ESCAPE
[INPUT_SM] STATE=ESCAPE, buffer='^[', reading next...
[INPUT_SM] Complete arrow sequence, transition to READY
```

## Summary

**Before:** Fragile, timing-dependent, silent failures
**After:** Robust, explicit state, validated, debuggable

The state machine approach makes input handling:
1. **Predictable** - every transition is explicit
2. **Testable** - can inject inputs and verify states
3. **Debuggable** - can see exactly what's happening
4. **Maintainable** - easy to add new input types

## Migration Guide

To migrate from old tcurses to v2:

```bash
# Old
source tcurses.sh
tcurses_simple_loop render_cb input_cb

# New
source tcurses_v2.sh
tcurses_loop render_cb input_cb
```

The callbacks remain the same, but input handling is now robust.
