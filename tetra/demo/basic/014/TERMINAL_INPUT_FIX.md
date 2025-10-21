# Terminal Input Fix for Demo 014

## The Core Problems (SOLVED)

### Problem 1: Terminal Not Configured for Raw Input
**Root Cause**: Missing critical `stty` flags for raw terminal input

**Before** (demo.sh:411):
```bash
stty -echo -icanon  # Incomplete configuration
```

**After** (demo.sh:418):
```bash
stty -echo -icanon -isig min 0 time 0 </dev/tty
```

**What Changed**:
- Added `-isig` flag to disable signal generation (fixes Ctrl-C killing terminal)
- Added `min 0 time 0` for immediate character-by-character reads
- Applied settings explicitly to `/dev/tty` device

### Problem 2: Ctrl-C Kills Terminal
**Root Cause**: Signal generation was still enabled

**Solution**: The `-isig` flag disables SIGINT/SIGTSTP generation, so Ctrl-C becomes a regular character (`\x03`) that can be handled in the case statement.

**Handler** (demo.sh:537-540):
```bash
$'\x03')
    # Ctrl-C - handled gracefully (signal generation disabled via -isig)
    TUI_BUFFERS["@tui[footer]"]="⚠ Ctrl-C is disabled - use 'q' to quit"
    ;;
```

### Problem 3: Input Device Mismatch
**Root Cause**: `stty` settings weren't being applied to the same device that `read` was using

**Solution**: Explicitly target `/dev/tty` for both configuration and reading:
- Configuration: `stty ... </dev/tty`
- Reading: `read ... </dev/tty` (already correct in gamepad_input.sh:99)

## Understanding the stty Flags

### Essential Flags for TUI Input

1. **`-echo`**: Don't echo typed characters to the terminal
   - Prevents double-display of keypresses
   - TUI controls all output

2. **`-icanon`**: Disable canonical (line-buffered) mode
   - Characters available immediately, not after Enter
   - Required for char-by-char reading

3. **`-isig`**: Disable signal generation  ← **THIS WAS MISSING**
   - Ctrl-C → character `\x03` instead of SIGINT
   - Ctrl-Z → character `\x1a` instead of SIGTSTP
   - Allows application-level handling

4. **`min 0`**: Minimum characters for `read()` to return
   - `0` = return immediately even if no data
   - Works with timeout-based polling

5. **`time 0`**: Inter-character timeout (deciseconds)
   - `0` = no timeout between characters
   - Timeout controlled by `read -t` instead

## Why It Wasn't Working

### The Failure Chain
1. Terminal started in canonical mode (line-buffered)
2. `stty -echo -icanon` was incomplete
3. Still missing: `-isig min 0 time 0`
4. `read -rsn1 -t "$timeout"` would timeout immediately
5. No characters would be available (canonical buffering)
6. Log showed "NO KEY (timeout)" × 1786 times

### The macOS /dev/tty Context
On macOS, when running bash scripts:
- `/dev/tty` is the controlling terminal
- Settings must be applied explicitly: `stty ... </dev/tty`
- Reading must match: `read ... </dev/tty`
- This is already correct in `gamepad_input.sh:99`

## Testing

### Run the Diagnostic Script
```bash
cd /Users/mricos/src/devops/tetra/demo/basic/014
./test_terminal_input.sh
```

This will test:
1. Basic terminal state
2. Read with current settings
3. Read with raw input settings
4. Rapid polling (like main loop)
5. File descriptor status

### Run Demo 014
```bash
cd /Users/mricos/src/devops/tetra/demo/basic/014
./demo.sh
```

**Expected Behavior**:
- ✓ Keys are received immediately
- ✓ Ctrl-C shows warning instead of killing app
- ✓ 'q' quits cleanly
- ✓ Terminal is restored on exit

### Check Debug Log
```bash
tail -f /tmp/demo014_debug.log
```

**Expected Output**:
```
=== Demo 014 Debug Log Started ...
TTY device: /dev/tty
TTY settings after configuration:
...
-echo -icanon -isig min 0 time 0
...
MAIN LOOP STARTED
READING INPUT (timeout=0.033333, anim=on)
KEY RECEIVED: ' 65' raw='e'    ← SUCCESS!
HANDLING KEY: 'e'
ACTION: nav_env_right
```

## Architecture Notes

### Terminal Configuration Flow
```
main() entry
  ↓
Save state: old_tty_state=$(stty -g)
  ↓
Enter alternate buffer: tput smcup
  ↓
Hide cursor: tput civis
  ↓
Configure raw input: stty -echo -icanon -isig min 0 time 0 </dev/tty
  ↓
Main loop: read -rsn1 -t "$timeout" </dev/tty
  ↓
Cleanup trap: stty "$old_tty_state" </dev/tty
  ↓
Restore screen: tput rmcup
```

### Input Multiplexing
The `get_input_multiplexed()` function in `gamepad_input.sh` handles:
1. Check gamepad pipe (non-blocking)
2. Fall back to keyboard (`read </dev/tty`)
3. Handle escape sequences for arrow keys

This is already correctly implemented - it just needed proper terminal configuration!

## References

### Key Files Modified
- `demo.sh:418` - Terminal configuration
- `demo.sh:449` - Cleanup function
- `demo.sh:537-540` - Ctrl-C handler

### Related Files (unchanged, already correct)
- `bash/tui/gamepad_input.sh:99` - Input reading

### Test Files Created
- `test_terminal_input.sh` - Diagnostic script
- `TERMINAL_INPUT_FIX.md` - This documentation

## Summary

**The fix was simple but critical**: Add the missing `stty` flags.

The terminal input system was architecturally sound - it just needed proper configuration. The `-isig min 0 time 0` flags transform the terminal into true raw input mode where:
- Characters arrive immediately
- Signals don't kill the process
- The application controls everything

This is the foundation for all TUI applications in Unix.
