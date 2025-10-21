# REPL Symbol Processing Fixes - 2025-10-17

## Issues Fixed

### 1. Missing Handler Call for `::` Symbol (CRITICAL BUG)
**Location**: `bash/repl/symbol_parser.sh:100`

**Problem**:
```bash
# Process :: symbols
for token in "${PARSED_RANGE_SYMBOLS[@]}"; do
    local resolved
    local status=$?  # ❌ Handler never called!
```

**Fix**: Added missing handler invocation
```bash
resolved=$("${REPL_SYMBOL_HANDLERS[::]}" "$token" "range")
local status=$?
```

### 2. Multiple Handler Calls for Same Symbol
**Location**: `bash/repl/symbol_parser.sh:72-142`

**Problem**: When the same symbol appeared multiple times (e.g., `@x and @x`), the handler was called once per occurrence.

**Fix**: Added deduplication with associative array
```bash
declare -A processed_symbols
for token in "${PARSED_AT_SYMBOLS[@]}"; do
    # Skip if already processed
    [[ -n "${processed_symbols["@:$token"]}" ]] && continue
    processed_symbols["@:$token"]=1
    # ... call handler once, replace all occurrences
done
```

### 3. Unwanted Command Execution After Symbol Processing
**Location**: `bash/repl/command_processor.sh:70`

**Problem**: When user typed only symbols (e.g., `@x`, `::test`, `#tag`), the resolved value was executed as a shell command, causing "command not found" errors.

**Fix**:
1. Symbol handlers now return empty string for info-only operations
2. Command processor skips execution if processed input is empty

```bash
# Skip if processed input is empty or whitespace-only (symbol-only commands)
if [[ -z "${processed_input// /}" ]]; then
    return 0
fi
```

### 4. Difficult Mode Switching
**Location**: `bash/repl/command_processor.sh:216`

**Problem**: Users had to type `/mode augment` or `/mode takeover` every time.

**Fix**: Added toggle functionality
- `/mode` with no argument toggles between augment ↔ takeover
- `/mode toggle` also works
- Shows clear feedback: `Execution mode: augment → takeover`

## Files Modified

1. **bash/repl/symbol_parser.sh**
   - Line 100: Added missing `::` handler call
   - Lines 82-139: Added deduplication logic for all symbol types

2. **bash/repl/command_processor.sh**
   - Lines 34-37: Added empty input check
   - Lines 216-266: Rewrote `/mode` command with toggle
   - Lines 147-169: Updated help text

3. **bash/repl/test_repl.sh**
   - Lines 115-145: Updated test handlers to return empty strings

## Testing

### Before Fix
```bash
[ready] test> @x
[@symbol detected: x]
/Users/.../command_processor.sh: line 70: x: command not found

[ready] test> ::test
[ready] test> #tag
/Users/.../command_processor.sh: line 70: tag: command not found
```

### After Fix
```bash
[ready] test> @x
[@symbol detected: x]
[ready] test> ::test
[::range detected: test]
[ready] test> #tag
[#tag detected: tag]
[ready] test> /mode
Execution mode: augment → takeover
  Commands are module/action by default
  Use !<cmd> for shell commands
```

## Usage Examples

### Symbol Processing
```bash
# Info-only symbol commands (no execution)
@filename              # Select file reference
::100,200             # Define range
#important            # Add tag

# Combined with commands
cat @x                # Expands to: cat filename
head -20 @x::1,100    # Expands to: head -20 filename (with range info)
```

### Mode Switching
```bash
/mode                 # Toggle augment ↔ takeover
/mode toggle          # Explicit toggle
/mode takeover        # Set to takeover mode
/mode augment         # Set to augment mode
```

## Architecture Notes

### Symbol Handler Contract
Symbol handlers receive:
- `$1` = token (the part after the symbol, e.g., "x" for "@x")
- `$2` = type hint ("at", "range", "tag")

Symbol handlers should return:
- **Empty string** if the symbol is informational only (prevents execution)
- **Replacement text** if the symbol should be expanded to a command
- **Non-zero exit code** on error

### Example Handler
```bash
my_symbol_handler() {
    local token="$1"
    local type="$2"

    # Do something with the symbol (e.g., select file, parse range)
    echo "[Processing: $token]" >&2

    # Return empty to prevent execution
    echo ""

    # OR return replacement text to expand the command
    # echo "path/to/file.txt"
}

repl_register_symbol "@" "my_symbol_handler"
```

## Status
✅ All symbol processing bugs fixed
✅ Mode toggle implemented
✅ Help documentation updated
✅ Test handlers updated

## Next Steps (Optional Enhancements)
- [ ] Add keyboard shortcut for mode toggle (Ctrl+M)
- [ ] Add symbol completion support
- [ ] Add symbol history tracking
- [ ] Make symbol handlers configurable per-module
