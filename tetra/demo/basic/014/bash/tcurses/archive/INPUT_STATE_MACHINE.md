# TCurses Input State Machine Design

## Problem
Current input handling is fragile due to:
1. Mixed blocking/non-blocking reads
2. No clear state management
3. Race conditions with escape sequences
4. Silent failures in terminal setup

## State Machine Design

### States
```
IDLE → waiting for input
ESCAPE → received ESC byte, waiting for sequence
READY → have complete input, ready to process
ERROR → terminal/read error occurred
```

### State Transitions
```
IDLE:
  - read timeout → stay IDLE
  - got byte != ESC → READY (single char)
  - got byte == ESC → ESCAPE
  - read error → ERROR

ESCAPE:
  - timeout (20ms) → READY (just ESC)
  - got '[' → check for arrow keys
  - got other → READY (ESC + char)
  - complete sequence → READY (full escape seq)

READY:
  - after callback → IDLE

ERROR:
  - after handler → IDLE or EXIT
```

## Implementation Plan

### 1. Input State Module
```bash
# State tracking
INPUT_STATE="IDLE"
INPUT_BUFFER=""
INPUT_LAST_BYTE=""
INPUT_ERROR=""

# Clear state
input_clear() {
  INPUT_STATE="IDLE"
  INPUT_BUFFER=""
  INPUT_ERROR=""
}

# Read one byte (blocking or with timeout)
input_read_byte(timeout) → byte or ""

# State machine step
input_step() {
  case $INPUT_STATE in
    IDLE) input_state_idle ;;
    ESCAPE) input_state_escape ;;
    READY) input_state_ready ;;
    ERROR) input_state_error ;;
  esac
}
```

### 2. Terminal Setup (Validated)
```bash
terminal_init() {
  # Save state
  OLD_STATE=$(stty -g </dev/tty) || return 1

  # Apply settings
  stty -echo -icanon -isig min 1 time 0 </dev/tty || return 1

  # VALIDATE
  stty -a </dev/tty | grep -q "min = 1" || {
    echo "ERROR: failed to set min=1"
    return 1
  }

  # Log actual settings
  log_terminal_state
}
```

### 3. Event Loop (Simple)
```bash
event_loop() {
  render_frame true

  while true; do
    # Step state machine
    input_step

    # If ready, process
    if [[ $INPUT_STATE == "READY" ]]; then
      handle_input "$INPUT_BUFFER"
      exit_code=$?
      input_clear

      [[ $exit_code -ne 0 ]] && break

      render_frame false
    fi

    # If error, handle
    if [[ $INPUT_STATE == "ERROR" ]]; then
      log "INPUT ERROR: $INPUT_ERROR"
      input_clear
    fi
  done
}
```

## Benefits
1. **Predictable**: Every state transition is explicit
2. **Testable**: Can inject bytes and verify state transitions
3. **Debuggable**: Can log state changes
4. **Robust**: Errors are explicit states, not silent failures

## Testing Strategy
```bash
# Unit tests
test_state_transitions() {
  input_clear
  assert_state "IDLE"

  inject_byte 'a'
  input_step
  assert_state "READY"
  assert_buffer "a"
}

# Integration test
test_escape_sequence() {
  inject_byte $'\x1b'
  input_step
  assert_state "ESCAPE"

  inject_byte '['
  inject_byte 'A'
  input_step
  assert_state "READY"
  assert_buffer $'\x1b[A'  # Up arrow
}
```
