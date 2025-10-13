# Watchdog Standalone App

Standalone wrappers for the Tetra watchdog module.

## Migration Notice

The watchdog functionality has been moved to the Tetra framework as a proper module at:
- `tetra/bash/watchdog/`

This directory contains thin wrappers that use the tetra module, maintaining backward compatibility with the original standalone scripts.

## Files

- `watchdog` - System monitoring wrapper (→ `tetra/bash/watchdog/watchdog.sh`)
- `watchdog-remote` - Infrastructure tracing wrapper (→ `tetra/bash/watchdog/remote.sh`)

## Usage

### System Monitoring

```bash
# Single snapshot
./watchdog

# Continuous monitoring (15s interval)
./watchdog loop 15
```

### Infrastructure Tracing

```bash
# Trace a URL through DigitalOcean infrastructure
NH_DIR=/etc/nethelper NH_CONTEXT=default ./watchdog-remote https://example.com /api/
```

## Requirements

- Tetra framework installed at `~/tetra/` or `$TETRA_SRC`
- For remote tracing: dig, doctl, ssh, jq

## Integration

These wrappers are designed to be drop-in replacements for the original standalone scripts.

For TUI integration, see `tetra/demo/basic/014/` which automatically discovers and integrates watchdog actions.

## Original Location

Original standalone scripts were at:
- `devops/watchdog/watchdog`
- `devops/watchdog/watchdog-remote`

See `tetra/bash/watchdog/README.md` for module documentation.
