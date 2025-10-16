# TES Storage Extension
## DigitalOcean Spaces and S3-Compatible Endpoints

**Version:** 1.1.0
**TCS Version:** 3.0
**Date:** 2025-10-13

---

## Related Documentation
- [Tetra Core Specification](Tetra_Core_Specification.md) - Foundational concepts (TCS 3.0)
- [TES SSH Extension](TES_SSH_Extension.md) - SSH deployment specifics
- [Module Convention](Tetra_Module_Convention.md) - Module integration patterns

---

## Overview

This document extends the [Tetra Core Specification (TCS 3.0)](Tetra_Core_Specification.md) to support cloud storage endpoints like DigitalOcean Spaces, AWS S3, and S3-compatible services. It builds on TCS 3.0's operator hierarchy and progressive resolution patterns.

## Storage Symbol Syntax

### Basic Format

```
@storage:<bucket-name>[:<path>]
```

### Examples

```bash
@spaces                      # Default storage (if only one defined)
@spaces:pja-games           # Specific bucket
@spaces:pja-games:games/    # Bucket with path
@s3:backups                 # AWS S3 bucket
```

## Progressive Resolution

Storage symbols follow TES progressive resolution:

```
Level 0: Symbol        @spaces:pja-games
  ↓
Level 1: Endpoint      https://sfo3.digitaloceanspaces.com
  ↓
Level 2: Bucket        pja-games
  ↓
Level 3: Connector     {endpoint, region, credentials}
  ↓
Level 4: Handle        ✓ (credentials validated)
  ↓
Level 5: Locator       s3://pja-games/games/manifest.json
  ↓
Level 6: Binding       list(s3://pja-games/games/)
  ↓
Level 7: Plan          s3cmd ls s3://pja-games/games/
```

## TOML Configuration

### In tetra.toml

```toml
# ═══════════════════════════════════════════════════════════
# STORAGE (TES Extension: Cloud Storage Endpoints)
# S3-compatible storage with progressive resolution
# ═══════════════════════════════════════════════════════════

[storage.spaces]
symbol = "@spaces"
backend = "digitalocean-spaces"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
default_bucket = "pja-games"

# Credentials from secrets.env
access_key = "${DO_SPACES_KEY}"
secret_key = "${DO_SPACES_SECRET}"

[storage.s3_backups]
symbol = "@s3"
backend = "aws-s3"
endpoint = "https://s3.us-east-1.amazonaws.com"
region = "us-east-1"
default_bucket = "tetra-backups"

# Credentials from secrets.env
access_key = "${AWS_ACCESS_KEY_ID}"
secret_key = "${AWS_SECRET_ACCESS_KEY}"
```

### In secrets.env

```bash
# DigitalOcean Spaces
DO_SPACES_KEY=DO00GXQ243FCVDLQT9CF
DO_SPACES_SECRET=+kH1E4zhaaisTmKwQRoJS9nfDRK2j9ZOigXmm0PJygY

# AWS S3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Type Contracts (TCS 3.0)

All storage operations MUST declare type contracts using the `::` operator:

```bash
# Storage module contracts
storage.list :: (@storage:bucket:path) → [@file:path]
  where Effect[network, read]

storage.get :: (@storage:bucket:path, target:path) → @local:path
  where Effect[network, write]

storage.put :: (@local:path → @storage:bucket:path)
  where Effect[network, write, log]

storage.sync :: (@local:path → @storage:bucket:path)
  where Effect[network, write, delete, log]

# VOX sync example
vox.sync :: (@vox:*.mp3 → @spaces:vox-audio/*.mp3)
  where Effect[network, write, log]
```

## Storage Operations

### List Files

```bash
# List bucket contents
tetra storage list @spaces:pja-games

# List specific path
tetra storage list @spaces:pja-games:games/

# Output:
# s3://pja-games/games/
# s3://pja-games/games/manifest.json
# s3://pja-games/games/dino-run/
# s3://pja-games/games/dino-run/game.js
```

### Get File

```bash
# Download file
tetra storage get @spaces:pja-games:games/manifest.json

# Download to specific location
tetra storage get @spaces:pja-games:games/manifest.json ./local-manifest.json
```

### Put File

```bash
# Upload file
tetra storage put local-file.json @spaces:pja-games:games/manifest.json

# Upload directory
tetra storage put ./games/ @spaces:pja-games:games/ --recursive
```

### Sync

```bash
# Sync local to remote
tetra storage sync ./local-games/ @spaces:pja-games:games/

# Sync remote to local
tetra storage sync @spaces:pja-games:games/ ./backup-games/
```

## Resolution Examples

### Example 1: List Games

**Command:**
```bash
tetra storage list @spaces:pja-games:games/
```

**Resolution:**
1. **Symbol:** `@spaces:pja-games:games/`
2. **Lookup:** Find `[storage.spaces]` in tetra.toml
3. **Connector:**
   ```
   endpoint = https://sfo3.digitaloceanspaces.com
   region = sfo3
   bucket = pja-games
   access_key = DO00GXQ243FCVDLQT9CF (from secrets.env)
   secret_key = +kH1E4z... (from secrets.env)
   ```
4. **Locator:** `s3://pja-games/games/`
5. **Binding:** `list(s3://pja-games/games/)`
6. **Plan:**
   ```bash
   s3cmd ls \
     --access_key=DO00GXQ243FCVDLQT9CF \
     --secret_key=+kH1E4z... \
     --host=sfo3.digitaloceanspaces.com \
     --host-bucket='%(bucket)s.sfo3.digitaloceanspaces.com' \
     s3://pja-games/games/
   ```

### Example 2: Upload with Cache Headers

**Command:**
```bash
tetra storage put games.json @spaces:pja-games:games.json \
  --cache-control "public, max-age=3600"
```

**Resolution:**
1. **Symbol:** `@spaces:pja-games:games.json`
2. **Connector:** (same as above)
3. **Locator:** `s3://pja-games/games.json`
4. **Binding:** `put(local:games.json → s3://pja-games/games.json)`
5. **Plan:**
   ```bash
   s3cmd put games.json s3://pja-games/games.json \
     --access_key=... \
     --secret_key=... \
     --host=sfo3.digitaloceanspaces.com \
     --add-header="Cache-Control: public, max-age=3600"
   ```

## Integration with Resources

Storage symbols work in resources.toml:

```toml
[resources.game_assets]
type = "s3"
description = "Game files synced to Spaces"
operation = "s3_sync"

[resources.game_assets.source]
symbol = "@local"
locator = "~/dev/games/"

[resources.game_assets.targets]
"@spaces:pja-games" = "games/"

[resources.game_assets.options]
cache_control = "public, max-age=31536000"
acl = "public-read"
```

## Backend Support

### DigitalOcean Spaces

```toml
[storage.spaces]
backend = "digitalocean-spaces"
endpoint = "https://sfo3.digitaloceanspaces.com"
region = "sfo3"
```

### AWS S3

```toml
[storage.s3]
backend = "aws-s3"
endpoint = "https://s3.us-east-1.amazonaws.com"
region = "us-east-1"
```

### MinIO / Custom S3

```toml
[storage.minio]
backend = "s3-compatible"
endpoint = "https://minio.example.com:9000"
region = "us-east-1"
```

## CLI Tool Requirements

Storage operations require `s3cmd` or `aws` CLI:

```bash
# Install s3cmd
brew install s3cmd

# Or AWS CLI
brew install awscli

# Configure will be automatic via TES resolution
```

## Security Model

### Credentials Storage

- Access keys stored in `secrets.env` (gitignored)
- Referenced in tetra.toml via `${DO_SPACES_KEY}` variables
- Interpolated during compilation

### Public vs Private Access

```toml
[storage.public_assets]
default_acl = "public-read"  # Files publicly accessible

[storage.private_data]
default_acl = "private"       # Requires authentication
```

## Examples

### List All Buckets

```bash
tetra storage list @spaces
```

### Download Game Manifest

```bash
tetra storage get @spaces:pja-games:games.json ./games.json
```

### Upload New Game

```bash
tetra storage put ./dino-run/ @spaces:pja-games:games/dino-run/ \
  --recursive \
  --cache-control "public, max-age=31536000"
```

### Sync Local to Remote

```bash
tetra storage sync ./local-games/ @spaces:pja-games:games/ \
  --delete-removed
```

### Get Public URL

```bash
tetra storage url @spaces:pja-games:games/dino-run/game.js
# Output: https://pja-games.sfo3.digitaloceanspaces.com/games/dino-run/game.js
```

---

## TES Specification Updates

This extension adds to TES 2.1:

### New Symbol Type

**Storage Symbol:** `@storage:<bucket>[:<path>]`

Examples:
- `@spaces:pja-games`
- `@s3:backups:db/`

### New TOML Section

```toml
[storage.<name>]
symbol = "@<symbol>"
backend = "digitalocean-spaces | aws-s3 | s3-compatible"
endpoint = "URL"
region = "region-code"
default_bucket = "bucket-name"
access_key = "${ENV_VAR}"
secret_key = "${ENV_VAR}"
default_acl = "private | public-read"
```

### Resolution Chain

```
Symbol (@spaces:bucket:path)
  ↓
Connector (endpoint + credentials)
  ↓
Locator (s3://bucket/path)
  ↓
Binding (operation + validation)
  ↓
Plan (s3cmd/aws command)
```

---

**End of Document**
