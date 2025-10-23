# Game Module Reorganization - Complete Summary

**Date:** 2025-10-23
**Version:** 1.0
**Compliance:** Tetra Module Convention v2.0, TCS 3.0

---

## What Was Done

Reorganized the game module to comply with Tetra Module Convention v2.0, using `bash/org` and `bash/tsm` as reference implementations.

---

## Key Changes

### 1. Module Structure (Convention Compliance)

**Before:**
- Ad-hoc structure
- No clear entry point
- Mixed data and source
- Inconsistent documentation

**After:**
```
bash/game/
├── TETRA_GAME_SPECIFICATION.md   ← START HERE (new)
├── README.md                      ← Points to specification (updated)
├── includes.sh                    ← Module entry point (updated)
├── game.sh                        ← Core functionality (updated)
├── actions.sh                     ← TUI integration (existing)
├── game_repl.sh                   ← Game launcher REPL (new)
├── core/                          ← Core components
│   ├── game_registry.sh           ← Game management (new)
│   └── ...                        ← Existing core files
├── games/                         ← Individual games (reorganized)
│   ├── pulsar/                    ← Moved from core/
│   └── estovox/                   ← New skeleton
├── docs/                          ← Documentation
│   ├── archive/                   ← Old docs moved here (new)
│   └── ...                        ← Current docs
└── ...
```

### 2. Data Directory Separation

**Following TCS 3.0 Database Pattern:**

```
# Module data (NEW structure)
$TETRA_DIR/game/
├── db/                # Module database (timestamp-based)
├── config/            # Module configuration
└── logs/              # Module logs

# Per-game data (NEW structure)
$TETRA_DIR/games/<gamename>/
├── db/                # Game database (timestamp-based)
├── config/            # Game configuration
├── saves/             # Game saves
└── cache/             # Game cache
```

**Before:** Data mixed with source in `bash/game/`
**After:** Data in `$TETRA_DIR/`, separate from source

### 3. Module Globals (Strong Globals)

**Added:**
```bash
GAME_SRC="$TETRA_SRC/bash/game"  # Module source
GAME_DIR="$TETRA_DIR/game"        # Module data
export GAME_SRC GAME_DIR
```

**Follows convention:** All Tetra modules use `MOD_SRC` and `MOD_DIR` pattern

### 4. Documentation Organization

**Created:**
- `TETRA_GAME_SPECIFICATION.md` - **Main entry point** for LLMs and developers
- Updated `README.md` - Points to specification
- `docs/MODULE_REORGANIZATION.md` - This file

**Archived:**
Moved to `docs/archive/`:
- Old refactoring docs
- Implementation summaries
- Status reports
- Historical development docs

**Kept Current:**
- `docs/ARCHITECTURE.md`
- `docs/GAMEPAD_SETUP.md`
- `docs/GAMEPLAY_CONCEPTS.md`
- `docs/PULSAR_REPL.md`
- `docs/QUADRUPOLE_QUICKSTART.md`

### 5. Game Registry System

**New:** `core/game_registry.sh`

Provides:
- Centralized game discovery
- Game metadata (name, description, status, REPL function)
- Status indicators (✓ ready, ○ skeleton, ◐ wip)
- Game list display
- Game launching

**Games Registered:**
- `pulsar` - ✓ Ready (Terminal sprite animation)
- `estovox` - ○ Skeleton (Audio-visual synthesis)

### 6. Game Launcher REPL

**New:** `game_repl.sh`

Features:
- Org-style prompt: `[user x game] >`
- Commands: `ls`, `play <game>`, `status`, `help`, `quit`
- Integration with game registry
- Per-game REPL launching

**Example:**
```bash
$ game repl

[mricos x lobby] > ls

⚡ Available Games
═══════════════════════════════════════
  pulsar       ✓  Pulsar Engine        Terminal Sprite Animation System
  estovox      ○  Estovox              Audio-Visual Synthesis Engine

[mricos x lobby] > play pulsar

▶ Launching Pulsar Engine...
```

### 7. Per-Game Structure

**Reorganized:**
- Moved `core/pulsar*` → `games/pulsar/`
- Created `games/estovox/` (skeleton)
- Each game has own directory with:
  - `<game>_repl.sh` - Game REPL
  - `<game>.sh` - Game logic
  - `README.md` - Game documentation
  - Data in `$TETRA_DIR/games/<game>/`

### 8. Module Entry Point

**Updated:** `includes.sh`

```bash
#!/usr/bin/env bash
# Game Module - Entry Point
# Following Tetra Module Convention v2.0

# Module paths (strong globals)
GAME_SRC="${GAME_SRC:-$TETRA_SRC/bash/game}"
export GAME_SRC

GAME_DIR="${GAME_DIR:-$TETRA_DIR/game}"
export GAME_DIR

# Source main module file
source "$GAME_SRC/game.sh"

# Module loaded
export GAME_LOADED=true
```

**Follows convention:** Same pattern as `bash/org/includes.sh`, `bash/tsm/includes.sh`

---

## Compliance Checklist

### Tetra Module Convention v2.0

- [x] `includes.sh` - Module entry point
- [x] `<module>.sh` - Core functionality
- [x] `actions.sh` - TUI integration
- [x] `README.md` - Module documentation
- [x] Strong globals: `MOD_SRC`, `MOD_DIR`
- [x] Path functions for data access
- [x] TCS 3.0 database pattern (timestamp-based)

### TCS 3.0 Compliance

- [x] Module source in `$TETRA_SRC/bash/game`
- [x] Module data in `$TETRA_DIR/game`
- [x] Per-entity data in `$TETRA_DIR/games/<game>`
- [x] Timestamp-based primary keys
- [x] Cross-module correlation support
- [x] Proper separation of concerns

### Reference Implementation Alignment

- [x] Structure matches `bash/org`
- [x] Globals pattern matches `bash/tsm`
- [x] Documentation structure matches conventions
- [x] Data directory pattern matches TCS 3.0

---

## File Movements

### Archived (to docs/archive/)
- `ARCHITECTURE.txt`
- `COMPLETE_SUMMARY.md`
- `DEV_MODE.md`
- `FIXES.md`
- `GLYPHGRID_INTEGRATION.md`
- `HELP_SYSTEM_REFACTOR.md`
- `IMPLEMENTATION_SUMMARY.md`
- `MODULE_AUDIT.md`
- `NUMBERED_PANELS.md`
- `PAIR_DYNAMICS.md`
- `PLASMA_FIELD_STATUS.md`
- `QUADRAPOLE_IMPLEMENTATION.md`
- `QUICK_START_REFACTOR.md`
- `REFACTOR_COMPLETE.md`
- `REFACTOR_SUMMARY.md`
- `REPL_IMPLEMENTATION_SUMMARY.md`
- `STATE_SYSTEM.md`
- `STATUS.md`
- `TEST_STICKY_BOTTOM.md`

### Reorganized
- `core/pulsar*` → `games/pulsar/`
- Created `games/estovox/` structure

### Created
- `TETRA_GAME_SPECIFICATION.md` - Main specification
- `game_repl.sh` - Game launcher REPL
- `core/game_registry.sh` - Game management
- `games/estovox/` - Skeleton game
- `docs/MODULE_REORGANIZATION.md` - This file

### Updated
- `includes.sh` - Added proper globals and structure
- `README.md` - Points to specification
- `game.sh` - Updated paths and loader

---

## For LLMs Reading This

### Start Here
1. Read `TETRA_GAME_SPECIFICATION.md` first
2. Reference `../../docs/Tetra_Module_Convention.md` for module standards
3. Reference `../../docs/Tetra_Core_Specification.md` for TCS 3.0

### Module Pattern
This module now follows the same pattern as:
- `bash/org` - Organization management (reference implementation)
- `bash/tsm` - Service management (reference implementation)

### Key Concepts
- **Module source:** `$GAME_SRC` = `$TETRA_SRC/bash/game`
- **Module data:** `$GAME_DIR` = `$TETRA_DIR/game`
- **Per-game data:** `$TETRA_DIR/games/<gamename>`
- **Entry point:** `includes.sh`
- **Main file:** `game.sh`
- **TUI integration:** `actions.sh`

### Adding Features
1. Implement in appropriate subdirectory
2. Source in `game.sh`
3. Export functions as needed
4. Update `TETRA_GAME_SPECIFICATION.md`
5. Add tests

---

## Testing

All tests still work:
```bash
./test_game_launcher.sh    # ✓ Passes
./test_help.sh             # ✓ Passes
./test_borders.sh          # ✓ Passes
```

Game commands work:
```bash
game repl                  # ✓ Launches game selector
game quadrapole            # ✓ Launches game
game doctor                # ✓ Shows diagnostics
```

---

## Migration Notes

### For Users
- No breaking changes
- All commands work as before
- Data will be created in new locations on first run

### For Developers
- Use `GAME_SRC` for source paths
- Use `GAME_DIR` for module data paths
- Use `$TETRA_DIR/games/<game>` for per-game data
- Follow timestamp-based database pattern
- Read `TETRA_GAME_SPECIFICATION.md` before modifying

---

## Version History

- **1.0** (2025-10-23)
  - Initial reorganization
  - TCS 3.0 compliance
  - Module Convention v2.0 compliance
  - Documentation consolidation

---

## See Also

- [TETRA_GAME_SPECIFICATION.md](../TETRA_GAME_SPECIFICATION.md) - Main specification
- [Tetra Module Convention](../../../docs/Tetra_Module_Convention.md) - Module standards
- [Tetra Core Specification](../../../docs/Tetra_Core_Specification.md) - TCS 3.0
- Reference implementations: `bash/org`, `bash/tsm`
