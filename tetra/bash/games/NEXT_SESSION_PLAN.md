# Games + Spaces Integration Plan

## Current State

### Spaces Module (`bash/spaces/`)
- Mature S3/DO Spaces wrapper
- TES symbol resolution: `@spaces:bucket:path`
- REPL mode with context (`spaces_repl.sh`)
- Operations: list, upload, download, sync
- Config via `tetra.toml [storage.spaces]`

### Games Module (`bash/games/`)
- Multi-org game management (games live at `$TETRA_DIR/orgs/<org>/games/`)
- **Core files:**
  - `games.sh` - Main dispatcher
  - `games_sync.sh` - S3 sync wrapper (uses spaces)
  - `games_admin.sh` - Game management
  - `gamepak.sh` - Packaging/archives
  - `help.sh` - Help system
- **Compiled:** `game_bridge.c` - Low-latency input bridge
- **Submodules:** cymatica/, engine/

### Git Status
- Many files deleted (cleanup in progress)
- New files in core/ untracked

## Proposed Work

### 1. Clean Up Git State
```bash
# Review deleted files - confirm intentional
git status bash/games/ | grep deleted

# Stage deletions
git add -u bash/games/

# Stage new files
git add bash/games/core/gamepak.sh bash/games/core/games_admin.sh \
        bash/games/core/games_sync.sh bash/games/core/help.sh

# Commit cleanup
git commit -m "refactor(games): Consolidate to multi-org architecture"
```

### 2. Games-Spaces Integration Points

**Current flow in games_sync.sh:**
```
games sync <game> → _games_s3_config → s3cmd with DO endpoint
```

**Potential improvements:**
- [ ] Use spaces module directly instead of raw s3cmd
- [ ] Add `games publish <game>` for S3 upload
- [ ] Add `games fetch <game>` for S3 download
- [ ] Manifest sync (games/manifest.json in bucket)

### 3. Proposed Commands

```bash
# Sync game to S3
games sync cymatica --to s3

# Fetch game from S3
games fetch cymatica --from s3

# Publish release
games publish cymatica v1.0.0

# List remote games
games remote list

# Show game status (local vs remote)
games status cymatica
```

### 4. TOML Config Structure

```toml
# In org's tetra.toml

[games]
default_bucket = "pja-games"

[games.categories.arcade]
s3_bucket = "pja-games"
s3_prefix = "games/arcade/"

[games.categories.demos]
s3_bucket = "pja-games"
s3_prefix = "games/demos/"
```

### 5. Integration Architecture

```
games publish <game>
    │
    ├─→ gamepak.sh (create archive)
    │       └─→ games/<game>.pak
    │
    └─→ games_sync.sh
            │
            ├─→ _games_s3_config (read tetra.toml)
            │
            └─→ spaces_sync (from spaces module)
                    └─→ s3cmd to DO Spaces
```

## Questions to Clarify

1. **Which org's games?** pixeljam-arcade or tetra?
2. **Manifest format?** JSON structure for games/manifest.json
3. **Versioning?** How to handle game versions in S3
4. **CDN?** Use DO Spaces CDN URL or direct S3?

## Files to Review

- `bash/spaces/spaces.sh` - Core S3 operations
- `bash/games/core/games_sync.sh` - Current S3 integration
- `bash/games/core/gamepak.sh` - Archive creation
- `$TETRA_DIR/orgs/pixeljam-arcade/tetra.toml` - S3 config

## Session Goal

Establish clean games → spaces → S3 pipeline for game distribution.
