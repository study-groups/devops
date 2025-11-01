# Bug Fixes

## Fixed: Cleanup errors on quit

### Problem
When quitting the quadrapole game, you'd see multiple error messages:
```
[07:34:34] game:Pulsar not running
[07:34:34] game:KILL failed:
```

### Root Cause
The cleanup sequence was:
1. Stop Pulsar engine
2. Clean up entities
3. Entities try to call `pulsar_kill()` on glyphs
4. `pulsar_kill()` checks if Pulsar is running → logs error

### Solution
Updated `pulsar_entity_unregister()` in `core/pulsar.sh` to check if Pulsar is still running before attempting to kill glyphs:

```bash
pulsar_entity_unregister() {
    local entity_id=$1
    local glyph_id="${PULSAR_ENTITY_MAP[$entity_id]:-}"

    if [[ -n "$glyph_id" ]]; then
        # Only try to kill if Pulsar is actually running
        if pulsar_running; then
            pulsar_kill "$glyph_id"
            tetra_log_debug "game" "Unregistered entity $entity_id (glyph $glyph_id)"
        fi
        unset "PULSAR_ENTITY_MAP[$entity_id]"
    fi
}
```

### Impact
- No more error messages on quit
- Cleaner shutdown sequence
- Same behavior when Pulsar is running (glyphs still get killed properly)

### Testing
```bash
game quadrapole
# Press 'q' to quit
# Should see clean exit without "KILL failed" errors
```

---

**Status**: ✅ Fixed in `core/pulsar.sh:249`
