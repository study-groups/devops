# DEPRECATED: gamepak

**Deprecated as of:** 2025-01-19

## Summary

The `gamepak` module is deprecated. Its functionality has been absorbed into the unified `game.toml` schema and the pbase `ManifestTools` service.

## Migration Path

### Metadata

All game metadata previously managed by gamepak is now stored in `game.toml` files:

```toml
[game]
id = "cheap-golf"
name = "Cheap Golf"
summary = "A minimalist golf game"
author = "Pixeljam"

[version]
current = "1.2.3"
auto_increment = "patch"
released = "2025-01-15"

[files]
entry = "index.html"
thumbnail = "thumb.png"

[metadata]
tags = ["arcade", "puzzle"]
created = "2024-06-01"
updated = "2025-01-15"

[permissions]
requires_auth = false
min_role = "guest"
```

### Manifest Management

Use pbase API endpoints instead of gamepak scripts:

| Old (gamepak) | New (pbase API) |
|---------------|-----------------|
| Manual games.json editing | `POST /api/s3/manifest/build` |
| N/A | `POST /api/s3/manifest/dissect` |
| N/A | `GET /api/s3/manifest/diff` |
| Manual version bump | `POST /api/games/:slug/sync` with `increment` param |

### Still Used

- `OrgConfig.js` is still used by bash scripts for org-level configuration
- This file will be migrated in a future update

## Removal Timeline

This module will remain in place until bash scripts are updated to use pbase APIs directly. Full removal is planned for a future release.

## Questions?

Contact the tetra development team.
