# Spaces Module DNS Error Fix

## Problem

`spaces_list` was failing with DNS resolution error:
```
ERROR: [Errno 8] nodename nor servname provided, or not known
ERROR: Connection Error: Error resolving a server hostname.
```

## Root Causes

### 1. Environment Variables Not Expanded
The `tetra.toml` file contained placeholder strings like `${DO_SPACES_KEY}` instead of actual values. The `_spaces_resolve()` function was extracting these literal strings and passing them to `s3cmd`.

**Fix**: Added `eval echo` to expand environment variables:
```bash
# Expand environment variables in credentials (e.g., ${DO_SPACES_KEY})
access_key=$(eval echo "$access_key")
secret_key=$(eval echo "$secret_key")
```

### 2. Greedy TOML Parsing
The original code used `grep -A20` which would match fields from multiple TOML sections:
```bash
# OLD - matches ALL sections with 'endpoint'
endpoint=$(grep -A20 '^\[storage\.spaces\]' "$toml_file" | grep '^endpoint' ...)
```

This resulted in duplicate values when the file had multiple sections with the same field names (`[storage.spaces]`, `[publishing.tau]`, `[publishing.games]` all have `endpoint`).

**Fix**: Used awk to extract only the target section:
```bash
# NEW - extracts only [storage.spaces] section
storage_section=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")
endpoint=$(echo "$storage_section" | grep '^endpoint' | head -1 | cut -d'=' -f2 | tr -d ' "')
```

## Terraform-Style Configuration Pattern

Tetra now follows a Terraform-like approach for managing secrets:

### File Structure
```
Source Data                  Generated Config               Runtime
~/nh/org/                 →  $TETRA_DIR/orgs/org/      →   (in-memory)
├── digocean.json            ├── tetra.toml                 eval expansion
├── mapping.json             │   (has ${VAR} placeholders)
└── init.sh                  └── secrets.env
                                (actual credentials)
```

### What Gets Committed
✅ `tetra.toml` with `${VAR}` placeholders
✅ Source infrastructure files
❌ `secrets.env` (NEVER commit - contains actual credentials)

### Usage
```bash
# 1. Ensure secrets are loaded
source $TETRA_DIR/orgs/pixeljam-arcade/secrets.env

# 2. Use spaces module (auto-resolves secrets)
spaces_list pja-games
spaces_get pja-games:games.json
spaces_put ./local.json pja-games:config/new.json
```

## Testing

```bash
# Test secret resolution
source $TETRA_DIR/orgs/$TETRA_ORG/secrets.env
source $TETRA_SRC/bash/spaces/spaces.sh
_spaces_resolve "pja-games"
echo "ACCESS_KEY: ${SPACES_ACCESS_KEY:0:10}..."

# Should show: DO00GXQ243...
# NOT: ${DO_SPACES_KEY}...
```

## Files Changed

1. `$TETRA_SRC/bash/spaces/spaces.sh` - Fixed `_spaces_resolve()` function
2. Created `$TETRA_SRC/bash/org/README_SECRETS_RESOLUTION.md` - Documentation

## Related Commands

- `spaces_list [bucket[:path]]` - List bucket contents
- `spaces_get bucket:path [dest]` - Download file
- `spaces_put source bucket:path` - Upload file
- `spaces_sync src dest` - Sync directories
- `spaces_url bucket:path` - Get public URL
