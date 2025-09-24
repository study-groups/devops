# TView Modal Exit Pattern

## The Problem
When exiting modals in terminal applications, users expect immediate return to the main interface. However, bash `read` loops don't automatically refresh the screen after modal exit, leaving users in a "limbo" state where they need to press another key to see the main interface.

## The Solution
**Always call `clear` and `redraw_screen()` immediately after modal exit.**

```bash
# In modal function, after while loop ends:
clear
if command -v redraw_screen >/dev/null 2>&1; then
    redraw_screen
fi
```

## Key Insight
The issue isn't with key reading - it's with screen refresh. The modal exit works correctly, but the main interface doesn't update until the next keystroke.

## Implementation Locations
- `tview_action_modal.sh`: Applied in `start_toml_editor_takeover()`
- `tview_modal.sh`: Applied in `close_modal()`

## Single-Key Input Standard
Use this pattern for reliable single-key input in all modals:

```bash
# Standard single-key read
read -n1 -s key

case "$key" in
    'q'|'Q'|$'\e'|$'\033')
        # Exit immediately - no buffer clearing needed
        break
        ;;
    # ... other keys
esac
```

## What NOT to Do
❌ Don't use complex buffering tricks:
- `stty raw`
- `dd bs=1 count=1`
- `exec 0</dev/tty`
- Buffer draining loops

❌ Don't create duplicate case statements for the same key

✅ Keep it simple: `read -n1 -s` + immediate `clear + redraw_screen()`

## Result
- Single keypress exit (q, ESC, j)
- Immediate return to main interface
- No phantom keystrokes
- Consistent behavior across all modals