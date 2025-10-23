# pbase - PData Service Wrapper

A lightweight bash wrapper for managing [pdata](https://github.com/study-groups/devops/tree/main/devpages/pdata) services with TETRA integration and an interactive REPL.

## Purpose

`pbase` provides:
- **Service management** - Start, stop, and monitor pdata services
- **Interactive REPL** - Manage users, files, capabilities, and audit logs
- **Admin functions** - CLI and REPL interfaces for pdata administration
- **TETRA integration** - Strong globals and consistent directory structure

## Requirements

- **TETRA environment** - Must source `~/tetra/tetra.sh` first
- **Node.js** >= 18.0.0 (for pdata)
- **pdata source** - Canonical location: `~/src/devops/devpages/pdata`

## Installation

1. Ensure TETRA is initialized:
```bash
source ~/tetra/tetra.sh
```

2. Initialize pbase:
```bash
export PBASE_SRC=~/src/devops/pbase  # or wherever you cloned this
source $PBASE_SRC/init.sh
```

## Directory Structure

```
pbase/
├── bash/
│   ├── pdata.sh          # Service management functions
│   ├── admin.sh          # Administration functions (users, files, audit)
│   ├── pbase_repl.sh     # Interactive REPL
│   ├── pbase.sh          # Main pbase dispatcher
│   └── bootstrap.sh      # Module loader
├── pdata -> ~/src/devops/devpages/pdata/  # Symlink to canonical pdata
├── init.sh               # Initialization script
├── start.sh              # Quick start script
├── legacy/               # Preserved examples
│   ├── nginx/           # Nginx config automation
│   ├── node/            # Node server examples
│   ├── go/              # PocketBase Go extension
│   ├── env/             # Environment templates
│   └── tests/           # Bash test examples
└── archive/              # Old experiments (apps, playwright, etc.)
```

## Environment Variables

### Required (TETRA)
- `TETRA_DIR` - TETRA data directory (e.g., `~/tetra`)
- `TETRA_SRC` - TETRA source directory (e.g., `~/src/tetra`)

### Set by init.sh
- `PBASE_SRC` - pbase source directory (`$TETRA_SRC/pbase`)
- `PBASE_DIR` - pbase data directory (`$TETRA_DIR/pbase`)
- `PD_DIR` - pdata instance directory (`$PBASE_DIR/pdata`)
- `PDATA_SRC` - pdata source location (default: `~/src/devops/devpages/pdata`)
- `PDATA_PORT` - pdata service port (default: `3000`)

## Usage

### Interactive REPL (Recommended)

```bash
# Start the interactive REPL
pbase repl
```

The REPL provides:
- **Tab** - Cycle contexts (service → users → files → audit)
- **Ctrl+Space** - Cycle actions within context
- **Enter** - Execute highlighted action
- **Status indicator** - Shows if pdata service is running (●/○)

### Quick Start

```bash
# Start pdata on default port (3000)
./start.sh

# Start on custom port
./start.sh 8080
```

### pdata Command

After sourcing `init.sh`, use the `pdata` command:

```bash
# Start pdata service
pdata start [port]

# Stop pdata service
pdata stop

# Restart pdata service
pdata restart [port]

# Check status
pdata status

# Show environment info
pdata info

# Check environment setup
pdata check

# Run tests
pdata test
```

### admin Command

Administer pdata users, files, and audit logs:

```bash
# User management
admin user list
admin user add alice secret123
admin user delete alice

# File operations
admin file list
admin file tree /uploads

# Capabilities
admin capability list

# Audit logs
admin audit tail 50
admin audit watch  # live tail

# Status
admin status
```

### Examples

```bash
# Initialize environment
source ~/tetra/tetra.sh
source ~/src/devops/pbase/init.sh

# Option 1: Use the REPL (recommended)
pbase repl
# Tab to cycle contexts, Ctrl+Space to cycle actions

# Option 2: Use CLI commands
pdata check
pdata start
admin user list
admin audit tail

# Option 3: Quick start script
./start.sh 3000
```

## Configuration

### Default Paths

| Variable | Default | Purpose |
|----------|---------|---------|
| PDATA_SRC | ~/src/devops/devpages/pdata | Canonical pdata source |
| PD_DIR | $PBASE_DIR/pdata | pdata instance data |
| PDATA_PORT | 3000 | Default service port |

### Customization

Set environment variables before sourcing `init.sh`:

```bash
export PDATA_PORT=8080
export PD_DIR=$HOME/my-pdata-instance
source $PBASE_SRC/init.sh
```

## Integration with TETRA

`pbase` follows TETRA conventions:

1. **Strong globals** - Requires `TETRA_DIR` and `TETRA_SRC` to be set
2. **Consistent structure** - Uses `$TETRA_SRC/pbase` for source, `$TETRA_DIR/pbase` for data
3. **Module system** - Loads bash modules via `bootstrap.sh`
4. **pbvm integration** - Uses TETRA's pbvm module for PocketBase version management

## pdata Overview

**pdata** (`@nodeholder/pdata`) is a Plan 9-inspired multi-tenant file management system featuring:

- Capability-based security model
- Virtual filesystem namespaces
- CSV-based user/role storage
- Comprehensive audit logging
- RESTful API via Express

For details, see [pdata technical docs](https://github.com/study-groups/devops/tree/main/devpages/pdata).

## Legacy Components

The `legacy/` directory contains preserved examples:

- **nginx/** - Nginx configuration automation functions
- **node/** - Node.js server utilities and user management
- **go/** - PocketBase Go extension with custom hooks
- **env/** - Environment configuration templates
- **tests/** - Bash test examples for nginx integration

These are preserved for reference but not actively maintained.

## Archived Components

The `archive/` directory contains old experiments that have been superseded:

- Frontend apps (analyze, basewatch, cabinet, etc.)
- Playwright testing setup
- Old initialization scripts

## Development

### Adding new pdata wrapper functions

Edit `bash/pdata.sh` and add functions following the naming convention `pdata_*`.

### Testing

```bash
# Run pdata tests
pdata test

# Check environment setup
pdata check
```

## Troubleshooting

### "TETRA_DIR not set"

Make sure to source TETRA first:
```bash
source ~/tetra/tetra.sh
```

### "PDATA_SRC directory does not exist"

The canonical pdata location is expected at `~/src/devops/devpages/pdata`. Either:
- Clone pdata to that location
- Set `PDATA_SRC` to your actual pdata location before running `init.sh`

### Service won't start

1. Check environment: `pdata check`
2. Verify pdata dependencies: `cd $PDATA_SRC && npm install`
3. Check if port is already in use: `lsof -i :3000`

## Related Projects

- [tetra](https://github.com/study-groups/tetra) - Terminal environment with bash 5.2+ modules
- [pdata](https://github.com/study-groups/devops/tree/main/devpages/pdata) - Plan 9-inspired file management
- [pbvm](../tetra/bash/pbvm) - PocketBase version manager

## License

ISC
