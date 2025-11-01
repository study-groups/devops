# TCurses Debugging Guide

## Issue: "Only quit worked in simple example"

If you're experiencing keys not being handled (only 'q' works), here's how to debug:

### Step 1: Run the Debug Example

```bash
cd bash/tcurses
./example_simple_debug.sh
```

In another terminal:
```bash
tail -f /tmp/tcurses_simple_debug.log
```

This will show:
- When `render_frame` is called
- When `handle_input` is called
- What key was received (character, hex, name)
- Which case was matched

### Step 2: Check What You're Seeing

#### Expected Output in Log

```
=== TCurses Simple Debug ...
main() started
tcurses_init OK
Entering simple_loop
render_frame called: first=true
handle_input called: key=' ' hex=20 name=' '
  -> INCREMENT
render_frame called: first=false
handle_input called: key='r' hex=72 name='r'
  -> RESET
render_frame called: first=false
handle_input called: key='q' hex=71 name='q'
  -> QUIT
Exited simple_loop
```

#### If You See This

```
render_frame called: first=true
(nothing else)
```

**Problem**: Input isn't being read at all
**Solution**: Terminal not properly initialized

Check:
```bash
# Should show -echo -icanon -isig
stty -a | grep -E "(echo|icanon|isig)"
```

#### If You See This

```
render_frame called: first=true
handle_input called: key=' ' hex=20 name=' '
  -> UNHANDLED
render_frame called: first=false
```

**Problem**: Key is being received but not matching the case statement
**Likely Cause**: The key isn't what you think it is

- SPACE should be hex `20`
- 'r' should be hex `72`
- 'q' should be hex `71`

If you see different hex values, your terminal is sending different codes.

### Step 3: Test Keys Directly

Run the key debugger:

```bash
cd bash/tcurses

# Create a test script
cat > test_keys.sh << 'EOF'
#!/usr/bin/env bash
source tcurses.sh

tcurses_init
tcurses_setup_cleanup_trap

echo "Press keys to see their codes (q to quit)"
sleep 1

while true; do
    key=$(tcurses_input_read_key_blocking)
    name=$(tcurses_input_key_name "$key")
    hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')

    # Move to bottom of screen
    tcurses_screen_move_cursor 24 1
    printf "Key: %-15s  Hex: %-10s  Raw: '%s'    " "$name" "$hex" "$key"

    [[ "$key" == "q" ]] && break
done

tcurses_cleanup
clear
echo "Done."
EOF

chmod +x test_keys.sh
./test_keys.sh
```

This will show you exactly what your terminal is sending for each key.

### Step 4: Common Issues

#### Issue: Keys work but screen doesn't update

**Symptoms**:
- Log shows `handle_input` being called
- Log shows correct case being matched
- Screen doesn't change

**Problem**: Render isn't being called or buffer isn't being displayed

**Check**:
1. Is `render_frame` being called after `handle_input`?
2. Is `tcurses_buffer_render_diff` actually rendering?

**Debug**:
```bash
# Add this to render_frame:
echo "RENDER: counter=$COUNTER" >> "$DEBUG_LOG"
```

#### Issue: Input is received but wrong case matches

**Symptoms**:
- Press SPACE, but log shows `-> UNHANDLED`
- Key hex doesn't match expected

**Problem**: Terminal sending different character codes

**Solutions**:
1. Check if terminal is in UTF-8 mode
2. Try different key combinations
3. Check for terminal-specific mappings

**Test**:
```bash
# What does your terminal send for SPACE?
bash -c 'read -rsn1 key </dev/tty; echo -n "$key" | od -An -tx1'
# Press SPACE, should show: 20
```

#### Issue: Everything times out

**Symptoms**:
- No keys are ever received
- Log only shows initial render

**Problem**: Terminal not in raw mode OR /dev/tty not accessible

**Check**:
```bash
# Is /dev/tty available?
ls -la /dev/tty

# What's the current terminal state?
stty -a </dev/tty
```

### Step 5: Verify Terminal State

After running `tcurses_init`, your terminal should be configured as:

```bash
# These should be OFF (shown with -)
-echo     # Input not echoed
-icanon   # Not line-buffered
-isig     # Signals disabled

# These should be set
min = 0   # Read returns immediately
time = 0  # No timeout
```

To check:
```bash
cd bash/tcurses
cat > check_state.sh << 'EOF'
#!/usr/bin/env bash
source tcurses.sh

echo "Before init:"
stty -a </dev/tty | head -5
echo ""

tcurses_init
echo "After init:"
stty -a </dev/tty | head -5
echo ""

read -p "Press Enter to cleanup..."
tcurses_cleanup

echo "After cleanup:"
stty -a </dev/tty | head -5
EOF

chmod +x check_state.sh
./check_state.sh
```

### Step 6: Platform-Specific Issues

#### macOS

TCurses is designed for macOS. If you're on macOS and it's not working:

1. **Bash version**: Must be 5.2+
   ```bash
   bash --version
   ```

2. **Terminal app**: Some terminals (iTerm2, Terminal.app, etc.) handle raw mode differently
   - Try a different terminal app

3. **/dev/tty access**: Should always work on macOS
   ```bash
   # Should succeed
   echo "test" > /dev/tty
   ```

#### Linux

Should work, but untested. Potential issues:
- Different `stty` implementation
- Different escape sequences
- Different `/dev/tty` behavior

### Step 7: Manual Test

Test the simplest possible case:

```bash
cd bash/tcurses
bash << 'EOF'
source tcurses_screen.sh
source tcurses_input.sh

# Initialize
tcurses_screen_init || { echo "Init failed"; exit 1; }

# Read one key
echo "Press any key..."
key=$(tcurses_input_read_key_blocking)
hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')

# Show result
tcurses_screen_cleanup
echo "You pressed: '$key' (hex: $hex)"

# Test specific keys
[[ "$key" == " " ]] && echo "That was SPACE"
[[ "$key" == "r" ]] && echo "That was 'r'"
[[ "$key" == "q" ]] && echo "That was 'q'"
EOF
```

This strips away all the complexity and tests just the input system.

### What to Report

If you're still having issues, provide:

1. **Output of debug example** (`/tmp/tcurses_simple_debug.log`)
2. **What keys you pressed** and what you expected
3. **Terminal state** (`stty -a </dev/tty` after init)
4. **Bash version** (`bash --version`)
5. **OS and Terminal app** (macOS + Terminal.app, etc.)
6. **Output of manual test** (from Step 7)

This will help identify if it's:
- A terminal configuration issue
- A key mapping issue
- A rendering issue
- A TCurses bug

## Quick Fixes

### Fix 1: Force Terminal Reset

```bash
stty sane
reset
```

Then try the example again.

### Fix 2: Use Different Terminal

Try running in:
- Terminal.app (native macOS)
- iTerm2
- VS Code terminal
- tmux/screen session

### Fix 3: Check for Conflicts

Do you have other software that might intercept keystrokes?
- Keyboard remapping software
- Accessibility tools
- Terminal multiplexers with custom keybindings

## Known Limitations

1. **No mouse support** (yet)
2. **Function keys not mapped** (F1-F12)
3. **Modified keys not handled** (Shift+Arrow, etc.)
4. **Unicode input limited** (single-byte chars only)

These are planned features, not bugs.
