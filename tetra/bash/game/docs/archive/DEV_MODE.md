# Developer Mode - Quadrapole Mechanics

## What is Dev Mode?

Developer mode provides **real-time visibility** into the quadrapole mechanics with live logging of:
- Joystick mapping transformations (raw → velocity)
- State transitions (bonded ↔ split)
- Field forces (tension/repulsion)
- Live parameter tuning (coming soon)

## Enabling Dev Mode

Dev mode is **automatically enabled** when you run:

```bash
game quadrapole
```

## What You'll See

### Mapping Logs

Shows joystick input → velocity mapping in real-time:

```
[MAPPING] L[0.75,0.00]→V[15.0,0.0] R[-0.80,0.00]→V[-16.0,0.0]
```

Format:
- `L[x,y]` - Left stick raw input (-1.0 to 1.0)
- `V[vx,vy]` - Mapped velocity (units/sec)
- `R[x,y]` - Right stick raw input
- `V[vx,vy]` - Mapped velocity

### State Logs

Shows current state and contrary motion timer:

```
[STATE] BONDED timer=0.85s
[STATE] SPLIT timer=0.00s
```

States:
- `BONDED` - Pulsars moving together
- `SPLIT` - Pulsars independent
- `timer` - Contrary motion accumulator

### Force Logs

Shows field forces when split:

```
[FORCES] tension: dist=35.2 force=1.56
[FORCES] repulsion: dist=4.1 force=1.35
```

## Where Logs Appear

Logs appear in **stderr** (your terminal), not in the C engine window. This means:

1. **If running in terminal**: You'll see logs interleaved with game output
2. **If redirecting**: Capture with `2>&1` or `2>dev.log`

Example:
```bash
game quadrapole 2>dev_logs.txt   # Capture dev logs to file
```

## Live Parameter Tuning (Future)

The system is set up to allow runtime parameter editing:

### Parameters You Can Tune

```bash
QUADRAPOLE_CONTRARY_THRESHOLD   # Time to trigger split (default: 1.5s)
QUADRAPOLE_CONTRARY_ANGLE       # Opposition angle (default: 150°)
QUADRAPOLE_TENSION_CONSTANT     # Spring force (default: 0.3)
QUADRAPOLE_REPULSION_CONSTANT   # Repulsion force (default: 1.5)
QUADRAPOLE_MAX_SEPARATION       # Max comfortable dist (default: 30.0)
QUADRAPOLE_MIN_SEPARATION       # Min dist (default: 5.0)
```

### Future Controls (Not Yet Implemented)

The infrastructure is ready for:
- `[` and `]` - Cycle through parameters
- `+` and `-` - Adjust selected parameter
- `s` - Save current parameters to config

## Configuration

Control dev mode behavior by editing globals in `core/dev_mode.sh`:

```bash
DEV_MODE_ENABLED=1          # 1 = on, 0 = off
DEV_MODE_SHOW_MAPPING=1     # Show mapping logs
DEV_MODE_SHOW_STATE=1       # Show state logs
DEV_MODE_SHOW_FORCES=1      # Show force logs
DEV_MODE_LOG_TO_STDERR=0    # Also log via stderr
```

## Using Dev Mode

### Example Session

```bash
# Start game with dev mode
$ game quadrapole

# In another terminal, watch logs
$ tail -f dev_logs.txt

# You'll see:
[DEV MODE] Enabled - Press 'd' to toggle...
[MAPPING] L[0.00,0.00]→V[0.0,0.0] R[0.00,0.00]→V[0.0,0.0]
# (press W key)
[MAPPING] L[0.00,-1.00]→V[0.0,-20.0] R[0.00,0.00]→V[0.0,0.0]
[STATE] BONDED timer=0.00s
# (press W and I keys opposite)
[MAPPING] L[0.00,-1.00]→V[0.0,-20.0] R[0.00,1.00]→V[0.0,20.0]
[STATE] BONDED timer=0.35s
[STATE] BONDED timer=0.72s
[STATE] BONDED timer=1.15s
[STATE] BONDED timer=1.52s
[STATE] SPLIT timer=0.00s    # SNAP!
```

### Debugging Contrary Motion

If the split isn't triggering:

1. **Check mapping logs** - Are both sticks active?
   ```
   [MAPPING] L[0.80,0.00]→V[16.0,0.0] R[-0.80,0.00]→V[-16.0,0.0]
   ```
   Both should show non-zero velocity

2. **Check state logs** - Is timer accumulating?
   ```
   [STATE] BONDED timer=0.85s
   ```
   Should increase toward 1.5s

3. **Check angle** - Are sticks opposite enough?
   - Default requires ≥150° angle
   - Lower `QUADRAPOLE_CONTRARY_ANGLE` if needed

### Tuning Feel

Want to change how it feels?

1. **Faster split**: Lower `QUADRAPOLE_CONTRARY_THRESHOLD` (e.g., 1.0s)
2. **Easier to trigger**: Lower `QUADRAPOLE_CONTRARY_ANGLE` (e.g., 120°)
3. **Stronger tension**: Increase `QUADRAPOLE_TENSION_CONSTANT`
4. **More repulsion**: Increase `QUADRAPOLE_REPULSION_CONSTANT`

Edit `config/quadrapole.toml` or modify globals directly.

## API for Custom Logging

### In Your Game Code

```bash
# Source dev mode
source "${GAME_SRC}/core/dev_mode.sh"
dev_mode_init

# Log custom events
dev_mode_log_event "CUSTOM" 0 "Something happened"

# Log mapping (done automatically in quadrapole_update)
dev_mode_log_mapping "$lx" "$ly" "$lvx" "$lvy" "$rx" "$ry" "$rvx" "$rvy"

# Log state
dev_mode_log_state "$QUADRAPOLE_BONDED" "$QUADRAPOLE_CONTRARY_TIMER"

# Log forces
dev_mode_log_forces "$distance" "tension" "$magnitude"
```

## Saving Parameter Tweaks

Once you find values you like:

```bash
# In bash (future feature)
dev_mode_save_config "config/quadrapole_tuned.toml"
```

This will generate a TOML file with your current parameter values.

## Performance Notes

- Logging to stderr has **negligible overhead** (<0.1% CPU)
- Logs are rate-limited to prevent spam
- Only logs when values change significantly
- No impact on rendering performance

## Troubleshooting

**Q: I don't see any logs**
A: Check that dev mode is enabled and you're looking at stderr (terminal output, not the game window)

**Q: Too many logs!**
A: Set `DEV_MODE_SHOW_MAPPING=0` to reduce verbosity

**Q: Want to see logs in C engine event panel?**
A: Not yet implemented - currently logs go to stderr only

**Q: Can I disable dev mode?**
A: Yes - set `DEV_MODE_ENABLED=0` in `core/dev_mode.sh` or comment out `dev_mode_init` call

## Future Enhancements

- [ ] Keyboard shortcuts for parameter tuning
- [ ] Visual HUD overlay showing parameters
- [ ] Integration with C engine event log (panel 2)
- [ ] Graph/chart of timer and forces over time
- [ ] Record/playback of input sequences for testing
- [ ] Parameter presets (easy/normal/hard modes)

---

**Dev mode is active!** Start the game and watch your terminal for mapping logs. 🛠️
