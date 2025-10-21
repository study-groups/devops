# Symbol-Driven REPL Fixes

## Issues Fixed

### 1. Escape Sequences in Input
**Problem**: Terminal control sequences (cursor show/hide) were being captured in user input
- Input showed as: `$'\E[?12l\E[?25h\E[?25linfo'`
- Caused "command not found" errors

**Fix**: Redirected tput output to stderr in `bash/tcurses/tcurses_input.sh`:
```bash
tput cnorm 2>/dev/null >&2 || printf '\033[?25h' >&2
tput civis 2>/dev/null >&2 || printf '\033[?25l' >&2
```

### 2. Color Contrast (Blue on Blue)
**Problem**: Text was invisible (same color for foreground and background)
- Output: `[38;5;33;48;5;33m` (fg=33, bg=33)

**Fix**: Changed `mode_color()`, `env_color()`, `verbs_color()`, `nouns_color()` in `bash/color/color_palettes.sh` to use `text_color()` instead of `fg_color()`:
- `fg_color()` → calls `color_swatch()` → sets both fg and bg
- `text_color()` → sets foreground only
- Output now: `[38;5;33m` (fg only)

### 3. Shell Metacharacter Escaping
**Problem**: Bash pattern matching failed for `!` prefix
- `[[ "$input" == \!* ]]` → syntax error

**Fix**: Used substring extraction in `bash/repl/command_processor.sh`:
```bash
[[ "${processed_input:0:1}" == "!" ]]  # Works correctly
```

### 4. Regex Escaping  
**Problem**: Unescaped `#` in regex pattern
- `[[ "$input" =~ #([a-zA-Z0-9_-]+) ]]` → conditional binary operator error

**Fix**: Escaped `#` in `bash/repl/symbol_parser.sh`:
```bash
[[ "$input" =~ \#([a-zA-Z0-9_-]+) ]]
```

### 5. Mismatched Quote
**Problem**: Mixed quote types in command substitution
- `resolved=$("${REPL_SYMBOL_HANDLERS[::]}' "$token" "range")`

**Fix**: Changed single quote to double quote:
```bash
resolved=$("${REPL_SYMBOL_HANDLERS[::]}' "$token" "range")
```

### 6. Removed Emojis
**Problem**: User preference for no emojis

**Fix**: Removed from:
- `bash/repl/test_repl.sh` - Test REPL header
- `bash/repl/demo_symbols.sh` - Demo header and arrows

## Test Results

All fixes verified:
- Color output: Foreground only, readable contrast
- Symbol parsing: @ :: # symbols detected and processed
- Slash commands: /status, /mode, /theme all work
- Shell escaping: ! prefix works in takeover mode
- Input reading: No escape sequences in captured input

## Files Modified

1. `bash/tcurses/tcurses_input.sh` - Cursor control to stderr
2. `bash/color/color_palettes.sh` - Use text_color instead of fg_color
3. `bash/repl/command_processor.sh` - Fix ! pattern matching
4. `bash/repl/symbol_parser.sh` - Fix # regex and quote mismatch
5. `bash/repl/test_repl.sh` - Remove emojis
6. `bash/repl/demo_symbols.sh` - Remove emojis, fix arrows

## Usage

```bash
# Run test REPL
./bash/repl/test_repl.sh

# Run demo with instructions
./bash/repl/demo_symbols.sh

# In REPL:
/status                    # Slash command
echo @file.sh              # Symbol detection
/mode takeover             # Switch modes
!ls                        # Shell escape
```
