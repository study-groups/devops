# Tab Completion Fix - Array Subscript Error

**Date:** 2025-11-04
**Issue:** `-bash: REPL_COMPLETION_CATEGORIES: bad array subscript`
**Status:** Fixed ✅

## Problem

When pressing TAB in the REPL completion menu, the system would crash with:
```
-bash: REPL_COMPLETION_CATEGORIES: bad array subscript
```

This occurred when accessing the `REPL_COMPLETION_CATEGORIES` associative array with keys that didn't have category values set.

## Root Cause

In `tcurses/tcurses_completion.sh`, two locations accessed associative arrays without safe defaults:

**Line 502** (in `_repl_draw_completion_menu_and_return_lines`):
```bash
local category="${REPL_COMPLETION_CATEGORIES[$match]}"
```

**Line 522** (same function, for hints):
```bash
local hint="${REPL_COMPLETION_HINTS[$selected_match]}"
local category="${REPL_COMPLETION_CATEGORIES[$selected_match]}"
```

When a completion word didn't have a category assigned, accessing the array would fail with "bad array subscript" error.

## Solution

Added safe default values using bash's `:-` parameter expansion:

**Line 502:**
```bash
local category="${REPL_COMPLETION_CATEGORIES[$match]:-}"
```

**Line 521-522:**
```bash
local hint="${REPL_COMPLETION_HINTS[$selected_match]:-}"
local category="${REPL_COMPLETION_CATEGORIES[$selected_match]:-}"
```

The `:-` syntax returns an empty string if the key doesn't exist, preventing the error.

## Changes Made

**File:** `tcurses/tcurses_completion.sh`

1. Line 502: Added `:-` to category lookup in menu drawing loop
2. Line 521: Added `:-` to hint lookup for selected item
3. Line 522: Added `:-` to category lookup for selected item

## Testing

Created comprehensive test: `tcurses/test_completion_fix.sh`

**Test Results:**
```
✓ Test 1: Completions without categories set
✓ Test 2: Completions with categories set
✓ Test 3: Access non-existent category key (main fix)
✓ Test 4: Hints with missing keys
✓ Test 5: Draw menu with mixed categories
```

All tests pass - no more "bad array subscript" errors.

## Impact

- **Before:** TAB completion would crash if any completion word lacked a category
- **After:** TAB completion works smoothly, treating missing categories as empty strings
- **Backward Compatible:** Existing code that sets categories continues to work

## How to Verify

1. Run the test script:
   ```bash
   bash/tcurses/test_completion_fix.sh
   ```

2. Or test in a live REPL:
   ```bash
   # Start any REPL (e.g., tdocs)
   trepl tdocs

   # Press TAB - should show completion menu without errors
   ```

## Related Issues

This fix resolves the issue reported in the user's session where pressing TAB in the browse mode caused the array subscript error.

## Prevention

**Best Practice:** Always use safe defaults when accessing associative arrays:

```bash
# DON'T:
value="${ARRAY[$key]}"

# DO:
value="${ARRAY[$key]:-}"           # Empty default
value="${ARRAY[$key]:-default}"    # Specific default
```

## Verification in Production

The fix has been tested with:
- Empty categories (no categories set)
- Partial categories (some words have categories, others don't)
- Mixed hints and categories
- All menu rendering functions

No regressions found.
