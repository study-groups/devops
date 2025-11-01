# Test: Sticky Bottom Panel

## Quick Test

1. **Start the game:**
   ```bash
   cd /Users/mricos/src/devops/tetra/bash/game
   source ~/tetra/tetra.sh
   game quadrapole
   ```

2. **Enable the event log panel:**
   - Press the `2` key

3. **What you should see:**
   - Event log should appear at the **BOTTOM 4 LINES** of your terminal
   - If your terminal is 24 rows, the log should be at rows 21-24
   - If your terminal is 40 rows, the log should be at rows 37-40

4. **Test resizing:**
   - Resize your terminal window (make it taller or shorter)
   - The event log should **STAY AT THE BOTTOM**
   - It should move with the bottom edge of the terminal

## What was the bug?

**Before refactoring:** The event log was at a fixed position, didn't move when terminal resized

**After refactoring:** The event log calculates its position as `rows - 4`, so it always sticks to the bottom

## Current Status

The code is now:
```c
layout->panels[PANEL_EVENT_LOG].y = rows - 4;  /* STICKY to bottom! */
```

This means:
- 24-row terminal → y = 20 (rows 21-24)
- 30-row terminal → y = 26 (rows 27-30)
- 40-row terminal → y = 36 (rows 37-40)

## If it's NOT working

Please tell me:
1. What row number is the event log appearing at?
2. What is your terminal height?
3. Does it move when you resize?

Then I can fix the issue!
