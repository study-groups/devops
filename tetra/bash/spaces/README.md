# Spaces - DigitalOcean Spaces Management

DigitalOcean Spaces object storage with TES symbol resolution (@spaces).

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# Configure credentials (first time only)
spaces_configure "$ACCESS_KEY" "$SECRET_KEY" "nyc3"

# List bucket contents
spaces_list mybucket

# Upload file
spaces_upload ./local.txt mybucket path/to/remote.txt

# Download file
spaces_download mybucket path/to/remote.txt ./local.txt

# Sync directory
spaces_sync ./dist mybucket www/
```

## TES Symbol Resolution

Use TES symbols for progressive resolution:

```bash
# Symbol format: @spaces:bucket[:path]
@spaces:pja-games:games/manifest.json

# Resolution chain:
# 1. Parse @spaces symbol
# 2. Lookup connector in tetra.toml [storage.s3]
# 3. Execute s3cmd with DO Spaces endpoint
```

## Commands

### Object Management
- `spaces_list <bucket> [path]` - List bucket objects
- `spaces_upload <local> <bucket> <remote>` - Upload file
- `spaces_download <bucket> <remote> <local>` - Download file
- `spaces_sync <local_dir> <bucket> <remote_dir>` - Sync directory

### Configuration
- `spaces_configure <key> <secret> [region]` - Configure credentials
- `spaces_info <bucket>` - Show bucket information

## REPL Mode

Interactive shell with context-aware commands and tab completion.

### Start REPL

```bash
# Direct execution
bash $TETRA_SRC/bash/spaces/spaces_repl.sh

# Or source and call
source $TETRA_SRC/bash/spaces/spaces_repl.sh
spaces_repl
```

### REPL Features

- **Context-aware**: Set bucket/path, commands use current context
- **Tab completion**: Tree-based command completion
- **Command history**: Readline support with history
- **Contextual help**: `help <command>` shows available options

### REPL Commands

```bash
spaces:pja-games> help use        # Show available buckets
spaces:pja-games> use pja-games   # Set bucket context
spaces:pja-games> cd games/       # Navigate to path
spaces:pja-games:games> ls        # List files in games/
spaces:pja-games:games> get manifest.json    # Download
spaces:pja-games:games> put local.json config.json  # Upload
spaces:pja-games:games> url manifest.json    # Get public URL
spaces:pja-games:games> status    # Show session info
spaces:pja-games:games> exit
```

### Context-Aware Help

```bash
help              # General help
help use          # Show available buckets from tetra.toml
help cd           # Path navigation help
help ls           # List command examples
```

## Module Structure

- `includes.sh` - Module entry point, sets MOD_SRC/MOD_DIR
- `actions.sh` - TCS-compliant actions for TUI integration
- `spaces.sh` - Main Spaces functionality with TES resolution
- `spaces_repl.sh` - Interactive REPL

## Configuration File

Spaces credentials are stored in `tetra.toml`:

```toml
[storage.s3]
access_key = "your-access-key"
secret_key = "your-secret-key"
region = "nyc3"
endpoint = "nyc3.digitaloceanspaces.com"
```

## See Also

- `QUICKSTART.md` - Getting started guide
- `README_DEPLOY.md` - Deployment integration
- Deploy module documentation for automated deployments
