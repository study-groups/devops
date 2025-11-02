# Temporary Fallback to Old Readline

If the new native readline is causing issues, you can temporarily fall back to the old system.

## Option 1: Quick Patch (keeps native readline for most, fallback for tdocs)

Edit `bash/tdocs/tdocs_repl.sh` and add this near the top, after sourcing repl.sh:

```bash
# Temporary: Use old readline for tdocs
# Override the input function to use old method
repl_read_input() {
    local prompt="$1"
    local input
    input=$(tcurses_input_read_line "$prompt" "$REPL_HISTORY_FILE")
    echo "$input"
}
export -f repl_read_input
```

This will make tdocs use the old readline while other REPLs keep the new one.

## Option 2: Global Fallback (all REPLs use old readline)

Edit `bash/repl/core/input.sh` and change line 19 back to:

```bash
# Change FROM:
input=$(tcurses_readline "$prompt" "$REPL_HISTORY_FILE")

# Change TO:
input=$(tcurses_input_read_line "$prompt" "$REPL_HISTORY_FILE")
```

And same for line 33 (the "enhanced" case).

This will make all REPLs use the old readline (no TAB completion).

## Option 3: Disable Raw Mode (test if terminal mode is the issue)

Edit `bash/tcurses/tcurses_readline.sh` line 245 and change:

```bash
# Change FROM:
stty -echo -icanon min 1 time 0 2>/dev/null

# Change TO:
stty echo icanon 2>/dev/null
```

This will make the terminal echo characters normally. You'll see double characters but it will prove if terminal mode is the issue.
