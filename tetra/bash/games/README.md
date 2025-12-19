# Games Module

Multi-org game management with local play, backup/restore, and S3 sync.

## Quick Start

```bash
# List games in current org
games list

# Play a game
games play estoface

# Play with MIDI/gamepad controls
games play trax --controls

# Show game controls
games controls trax
```

## Commands

### Game Management
```bash
games list                     # List games in current org
games play <game> [--controls] # Play a game
games info <game>              # Show game details
games controls <game>          # Show control mappings
```

### Organization
```bash
games org                      # Show current org
games org pixeljam             # Switch to org
games orgs                     # List orgs with game counts
games search <query>           # Search games across all orgs
```

### Backup & Restore
```bash
games pak <game>               # Create .gamepak.tar.gz
games unpak <file>             # Restore from archive
```

### S3/Remote (requires games_sync.sh)
```bash
games remote                   # List games on S3
games fetch <game>             # Download from S3
games publish <game> [ver]     # Upload with version
games pull                     # Sync all from S3
games push                     # Sync all to S3
```

### Diagnostics
```bash
games doctor                   # Environment diagnostics
games help [topic]             # Help (topics: play, orgs, pak, sync)
```

## Directory Structure

```
$TETRA_DIR/orgs/<org>/games/<game>/
    game.toml           # Game configuration
    controls.json       # Input mappings (optional)
    core/<game>_repl.sh # Entry point (convention)
    manifest.toml       # Package metadata (auto-generated)

$TETRA_DIR/games/<game>/
    (runtime data, FIFOs, logs)
```

## Org Context Priority

```
GAMES_ORG > GAMES_CTX_ORG > TETRA_ORG > "tetra"
```

## game.toml

```toml
[game]
name = "My Game"
version = "1.0.0"
description = "Game description"
repl = "core/mygame_repl.sh"

[author]
name = "developer"
```

## controls.json

```json
{
  "actions": {
    "move_left": {
      "description": "Move left",
      "type": "axis"
    },
    "fire": {
      "description": "Fire weapon",
      "type": "button"
    }
  },
  "defaults": {
    "midi": { "move_left": "cc:1", "fire": "note:60" },
    "gamepad": { "move_left": "axis:0", "fire": "button:0" }
  }
}
```

## Module Architecture

```
games/
├── games.sh              # Main module
├── includes.sh           # Entry point
├── core/
│   ├── help.sh           # TDS-colored help system
│   ├── games_sync.sh     # S3 operations
│   ├── games_admin.sh    # Admin functions
│   ├── games_complete.sh # Tab completion
│   └── gamepak.sh        # Packaging utilities
├── available/            # Available games (nginx-style)
├── enabled/              # Enabled games (symlinks)
├── engines/              # Game engines (flax, tui)
└── docs/                 # Documentation
```

## Entry Point Discovery

1. `game.toml` → `repl=` or `entry=`
2. `core/<game>_repl.sh` (convention)
3. `<game>.sh` (fallback)

Entry functions tried: `game_run()`, `<game>_run()`, `main()`

## See Also

- `games help play` - Launching games
- `games help orgs` - Organization structure
- `games help pak` - Backup and restore
- `games help sync` - S3 synchronization
