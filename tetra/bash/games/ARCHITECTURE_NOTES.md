# Games Module Architecture Notes

Summary from GAMMA review session (2025-01-04).

## Key Architectural Decisions

### 1. Separation of Concerns

| Service | Responsibility |
|---------|----------------|
| **GAMMA** | Matchmaking only - allocates ports, creates matches, proxies to game servers |
| **games** (this module) | Asset management - manifest, publish, S3 sync, serve game files |

GAMMA should NOT handle S3 manifests or asset management.

### 2. Artifact Model (not file copying)

**Problem**: Dev/staging/prod shouldn't need 3 copies of large game files.

**Solution**: Store artifacts once in S3, use per-environment manifests.

```
S3 (artifacts - immutable)           ENVIRONMENTS (manifests - config only)
──────────────────────────           ─────────────────────────────────────
s3://tetra-games/                    dev.games.json      → all games, latest
├── pong/v1.0.0/                     staging.games.json  → release candidates
├── pong/v1.2.0/                     prod.games.json     → stable, access-controlled
└── asteroids/v2.0.0/
```

### 3. Local Dev vs Production

| Context | Files | Server | Manifest |
|---------|-------|--------|----------|
| **Local dev** | Source on disk | Serves local files | Optional |
| **Production** | Artifacts on S3 | Serves from S3/CDN | Required |

**Local workflow:**
```bash
# Edit source
cd $TETRA_DIR/orgs/tetra/games/pong

# Test locally (serves source directly)
games play pong

# Publish artifact to S3
games publish pong 1.2.0

# Update manifest
games manifest rebuild
```

### 4. Manifest Structure (S3)

The manifest is a **publication registry** for S3, not local config.

```json
{
  "_config": {
    "bucket": "tetra-games",
    "endpoint": "https://sfo3.digitaloceanspaces.com"
  },
  "games": {
    "pong": {
      "slug": "pong",
      "name": "Pong",
      "src": "/api/game-files/pong/v1.2.0/index.html",
      "url_path": "pong/v1.2.0/index.html",
      "version": "1.2.0",
      "access_control": {
        "requires_auth": false,
        "min_role": "guest"
      },
      "tags": ["multiplayer"],
      "show": true
    }
  }
}
```

## What Exists

| Component | File | Status |
|-----------|------|--------|
| Manifest rebuild | `core/games_manifest.sh` | Done |
| Manifest list/validate | `core/games_manifest.sh` | Done |
| S3 sync | `core/games_sync.sh` | Done |
| Publish | `core/games_upload.sh` | Done |
| Local play | `games.sh` | Done |

## What's Needed

| Component | Purpose |
|-----------|---------|
| **Games HTTP server** | API for remote manifest CRUD, game file serving |
| **Per-env manifests** | `dev.games.json`, `staging.games.json`, `prod.games.json` |
| **Environment resolution** | Server picks manifest based on `NODE_ENV` or similar |

## Games Server API (proposed)

```
GET  /api/games              # List games from manifest
GET  /api/games/:slug        # Get single game info
PUT  /api/games/:slug        # Update game config
POST /api/manifest/rebuild   # Trigger rebuild from game.toml
GET  /api/game-files/*       # Proxy/serve game files from S3
```

## Reference: PJA Arcade Pattern

See `~/src/pixeljam/pja/arcade/src/routes/admin/games/` for:
- Svelte admin UI for manifest editing
- S3 integration with DO Spaces
- Access control (roles, subscriptions)
- Game variants (latest, demo, dev)

## Next Steps

1. Create `games-server.js` in this directory
2. Implement per-environment manifest loading
3. Add HTTP endpoints for manifest CRUD
4. Integrate with existing bash commands via subprocess or shared manifest file
