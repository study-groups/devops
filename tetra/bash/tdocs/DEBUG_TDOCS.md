# Debugging tdocs browse "hang"

## What's Happening

When you run `tdocs browse`, it's not actually hanging - it's waiting for you to type a command!

The native readline works differently from bash's `read -e`:
- **Old behavior**: Characters appear as you type (bash echoes them)
- **New behavior**: We control the display (custom echo)

## Quick Test

Try this:

```bash
tdocs browse
# You should see the prompt
# Now type: help
# Press Enter
```

If "help" appears as you type and the command executes, it's working!

## If Nothing Appears When You Type

This means the redraw function isn't working. Possible causes:

1. **Terminal not in right mode** - The stty settings might be wrong
2. **Output going to wrong place** - We write to stderr, maybe it's not visible
3. **ANSI stripping failing** - The sed command might not work on your system

## Debug Steps

### Step 1: Test the interactive test script

```bash
bash bash/tcurses/INTERACTIVE_TEST.sh
```

If this works, the readline is fine. If not, we have a readline bug.

### Step 2: Check terminal state

Before running tdocs, check:
```bash
stty -a
```

After it "hangs", press Ctrl-Z to suspend, then:
```bash
stty -a
```

Compare the two outputs.

### Step 3: Enable debug mode

Edit `bash/tcurses/tcurses_readline.sh` and add at the top of `tcurses_readline()`:

```bash
tcurses_readline() {
    local prompt="${1:-$TCURSES_READLINE_PROMPT}"
    local history_file="${2:-}"

    # DEBUG
    echo "[DEBUG] Starting tcurses_readline" >&2
    echo "[DEBUG] Prompt: $prompt" >&2
    echo "[DEBUG] Terminal: $(tty)" >&2
```

Then run `tdocs browse` and see if the debug messages appear.

## Likely Issue

My guess: The REPL is actually working fine, but:
1. The prompt might have so much ANSI color that it's wrapping or confusing the terminal
2. The cursor might be positioned incorrectly due to ANSI code length calculation
3. The terminal might not support the ANSI sequences we're using

## Quick Fix

Try running with a simple prompt:

```bash
# Edit bash/tdocs/tdocs_repl.sh
# Find the line that sets REPL_PROMPT or calls repl_build_prompt
# Replace with:
REPL_PROMPT="tdocs> "
```

If that works, the issue is with prompt length calculation for colored prompts.

## Alternative: Fallback to Old Readline

If you need tdocs to work NOW, temporarily switch back:

```bash
# Edit bash/repl/core/input.sh
# In the readline case, change:
input=$(tcurses_readline "$prompt" "$REPL_HISTORY_FILE")

# Back to:
input=$(tcurses_input_read_line "$prompt" "$REPL_HISTORY_FILE")
```

This will lose TAB completion but should work.
