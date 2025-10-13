# Watchdog - MIGRATED

## Migration Notice

**This directory is deprecated.** Watchdog has been migrated to the Tetra framework.

### New Locations

**Tetra Module** (core functionality):
- `tetra/bash/watchdog/watchdog.sh` - System monitoring
- `tetra/bash/watchdog/remote.sh` - Infrastructure tracing
- `tetra/bash/watchdog/actions.sh` - TUI integration
- `tetra/bash/watchdog/README.md` - Module documentation

**Standalone App** (wrappers):
- `devops/watchdog-app/watchdog` - System monitoring wrapper
- `devops/watchdog-app/watchdog-remote` - Infrastructure tracing wrapper
- `devops/watchdog-app/README.md` - Standalone app documentation

### Why the Migration?

Watchdog was chosen as the reference implementation for the **Tetra Module Convention**, establishing the pattern for how Tetra modules integrate with demo 014's TUI framework.

### What Changed?

1. **Core functionality** moved to `tetra/bash/watchdog/`
2. **Action declarations** added in `actions.sh` for TUI discovery
3. **Standalone wrappers** created in `devops/watchdog-app/`
4. **TUI integration** - watchdog actions now appear automatically in demo 014

### How to Use Now

**As a Tetra Module:**
```bash
source ~/tetra/tetra.sh
watchdog_snapshot
watchdog_loop 15
```

**As a Standalone App:**
```bash
cd ../watchdog-app
./watchdog
./watchdog loop 15
```

**In Demo 014 TUI:**
- Navigate to "Local × Inspect" → see `monitor:system`
- Navigate to "Dev × Inspect" → see `trace:url`

### Old Files in This Directory

- `watchdog` - Original system monitoring script
- `watchdog-remote` - Original infrastructure tracing script
- `notes.txt` - SSH ControlMaster notes
- `service/` - Systemd service configuration

These files remain for reference but should not be modified. Use the tetra module or standalone wrappers instead.

### Documentation

See:
- `tetra/bash/watchdog/README.md` - Module usage
- `tetra/docs/Tetra_Module_Convention.md` - Integration pattern
- `devops/watchdog-app/README.md` - Standalone wrapper usage
