# Tetra Game Module Specification

**Version:** 1.0
**TCS Version:** 3.0
**Module:** `game`
**Status:** Active
**Reference Implementation:** `bash/org`, `bash/tsm`

---

## Quick Start

```bash
# Launch game selector REPL
game repl

# List available games
[user x lobby] > ls

# Play a game
[user x lobby] > play pulsar

# Direct game launch
game quadrapole
```

---

## Overview

The Game module provides a framework for terminal-based interactive games, with a launcher REPL for game selection and individual game REPLs for gameplay.

### Key Features

- **Game Registry** - Centralized game discovery and management
- **Launcher REPL** - Interactive game selector with org-style prompt `[user x game]`
- **Per-Game REPLs** - Each game has its own REPL environment
- **Pulsar Engine** - C-based sprite animation engine with protocol shell
- **Module Compliance** - Follows Tetra Module Convention v2.0

---

## Architecture

### Module Structure (TCS 3.0 Compliant)

```
bash/game/                          # Module source ($GAME_SRC)
├── game.sh                          # Core functionality (REQUIRED)
├── includes.sh                      # Module entry point (REQUIRED)
├── actions.sh                       # TUI integration (REQUIRED)
├── game_repl.sh                     # Game launcher REPL
├── README.md                        # Module documentation (REQUIRED)
├── TETRA_GAME_SPECIFICATION.md      # This file (START HERE)
├── core/                            # Core components
│   ├── game_registry.sh             # Game discovery and management
│   ├── doctor.sh                    # System diagnostics
│   ├── entities.sh                  # Entity system
│   ├── game_loop.sh                 # Game loop implementation
│   ├── timing.sh                    # Timing and FPS control
│   └── input_detect.sh              # Input device detection
├── games/                           # Individual games
│   ├── pulsar/                      # Pulsar game
│   │   ├── pulsar.sh                # Engine protocol
│   │   ├── pulsar_repl.sh           # Game REPL
│   │   └── pulsar_help.sh           # Help system
│   └── estovox/                     # Estovox game (skeleton)
│       ├── README.md
│       └── core/
│           └── estovox_repl.sh
├── engine/                          # C engine (optional)
│   ├── src/                         # C source code
│   ├── bin/                         # Compiled binaries
│   └── Makefile
├── animation/                       # Animation systems
├── rendering/                       # Rendering systems
├── demos/                           # Demo implementations
├── config/                          # Module configuration
├── docs/                            # Documentation
│   ├── archive/                     # Historical docs
│   ├── ARCHITECTURE.md              # Architecture overview
│   ├── GAMEPAD_SETUP.md            # Gamepad configuration
│   ├── GAMEPLAY_CONCEPTS.md         # Game design concepts
│   ├── PULSAR_REPL.md              # Pulsar REPL guide
│   └── QUADRUPOLE_QUICKSTART.md     # Quadrupole game guide
└── tools/                           # Development tools
```

### Runtime Data Structure (TCS 3.0 Database Pattern)

```
$TETRA_DIR/game/                    # Module runtime directory
├── config/                          # Module configuration
├── logs/                            # Module logs
└── db/                              # Module database (timestamp-based)

$TETRA_DIR/games/<gamename>/        # Per-game data directories
├── db/                              # Game-specific database
│   └── {timestamp}.ext             # Timestamp-based files
├── config/                          # Game configuration
├── saves/                           # Game saves
└── cache/                           # Game cache
```

---

## Module Globals

Following TCS 3.0 strong global conventions:

```bash
# Module source (strong global, always set)
GAME_SRC="$TETRA_SRC/bash/game"
export GAME_SRC

# Module runtime directory
GAME_DIR="${GAME_DIR:-$TETRA_DIR/game}"
export GAME_DIR

# Game engine availability
GAME_PULSAR_AVAILABLE=true|false
export GAME_PULSAR_AVAILABLE
```

### Path Functions

```bash
# Module database directory
game_get_db_dir() {
    echo "$GAME_DIR/db"
}

# Per-game data directory
game_get_game_dir() {
    local gamename="$1"
    echo "$TETRA_DIR/games/$gamename"
}

# Per-game database
game_get_game_db_dir() {
    local gamename="$1"
    echo "$(game_get_game_dir "$gamename")/db"
}

# Timestamp generation
game_generate_timestamp() {
    date +%s
}
```

---

## Game Registry System

### Game Metadata

Games are registered in `core/game_registry.sh` with metadata:

```bash
declare -gA GAME_REGISTRY_NAMES=(
    [pulsar]="Pulsar Engine"
    [estovox]="Estovox"
)

declare -gA GAME_REGISTRY_DESC=(
    [pulsar]="Terminal Sprite Animation System"
    [estovox]="Audio-Visual Synthesis Engine"
)

declare -gA GAME_REGISTRY_STATUS=(
    [pulsar]="ready"      # ✓ Fully implemented
    [estovox]="skeleton"  # ○ Structure only
)

declare -gA GAME_REGISTRY_REPL=(
    [pulsar]="pulsar_game_repl_run"
    [estovox]="estovox_game_repl_run"
)
```

### Game Status Indicators

| Status | Icon | Meaning |
|--------|------|---------|
| `ready` | ✓ | Fully implemented and playable |
| `skeleton` | ○ | Structure exists, not implemented |
| `wip` | ◐ | Work in progress |

---

## Game Launcher REPL

### Prompt Format (Org-Style)

```
[user x game] > command
```

Where:
- `user` - Current player name (from `$USER` or `$GAME_ACTIVE_USER`)
- `game` - Active game ID or "lobby" if none

### Launcher Commands

```bash
ls, list              # List available games
play <game>           # Launch a game
status                # Show active game status
help, h, ?            # Show help
quit, exit, q         # Exit launcher
```

### Example Session

```bash
$ game repl

╔══════════════════════════════════════════════════╗
║            ⚡ GAME REPL v1.0                     ║
║          Interactive Game Launcher               ║
╚══════════════════════════════════════════════════╝

[mricos x lobby] > ls

⚡ Available Games
═══════════════════════════════════════

  pulsar       ✓  Pulsar Engine        Terminal Sprite Animation System
  estovox      ○  Estovox              Audio-Visual Synthesis Engine

[mricos x lobby] > play pulsar

▶ Launching Pulsar Engine...

╔═════════════════════════════════════════════╗
║           ⚡ PULSAR REPL v1.0               ║
║     Interactive Engine Protocol Shell       ║
╚═════════════════════════════════════════════╝

[mricos x pulsar] > help

... Pulsar help system ...
```

---

## Individual Games

### Pulsar Engine

**Status:** ✓ Ready
**Type:** Sprite animation system
**Engine:** C (optional, with bash fallback)

**Features:**
- Terminal sprite animation
- Real-time protocol shell (REPL)
- Named sprite management
- Parameter hot-reloading
- Script loading (.pql format)
- Narrow/deep help tree

**Location:** `games/pulsar/`
**Documentation:** `docs/PULSAR_REPL.md`
**REPL Function:** `pulsar_game_repl_run()`

**Data Directory:** `$TETRA_DIR/games/pulsar/`

### Estovox

**Status:** ○ Skeleton
**Type:** Audio-visual synthesis engine
**Engine:** Planned (C)

**Planned Features:**
- Real-time audio synthesis
- Visual waveform display
- Interactive parameter control
- Preset sound configurations

**Location:** `games/estovox/`
**Documentation:** `games/estovox/README.md`
**REPL Function:** `estovox_game_repl_run()`

**Data Directory:** `$TETRA_DIR/games/estovox/`

---

## Creating a New Game

### Step 1: Create Game Structure

```bash
GAMENAME="mygame"

# Create game directory
mkdir -p "games/$GAMENAME/core"
mkdir -p "games/$GAMENAME/config"
mkdir -p "games/$GAMENAME/scripts"

# Create game data directory
mkdir -p "$TETRA_DIR/games/$GAMENAME/db"
mkdir -p "$TETRA_DIR/games/$GAMENAME/config"
```

### Step 2: Register Game

Edit `core/game_registry.sh`:

```bash
declare -gA GAME_REGISTRY_NAMES=(
    [pulsar]="Pulsar Engine"
    [estovox]="Estovox"
    [mygame]="My Game"  # Add here
)

declare -gA GAME_REGISTRY_DESC=(
    [pulsar]="Terminal Sprite Animation System"
    [estovox]="Audio-Visual Synthesis Engine"
    [mygame]="My awesome game description"  # Add here
)

declare -gA GAME_REGISTRY_STATUS=(
    [pulsar]="ready"
    [estovox]="skeleton"
    [mygame]="wip"  # Add here
)

declare -gA GAME_REGISTRY_REPL=(
    [pulsar]="pulsar_game_repl_run"
    [estovox]="estovox_game_repl_run"
    [mygame]="mygame_game_repl_run"  # Add here
)
```

### Step 3: Implement Game REPL

Create `games/mygame/core/mygame_repl.sh`:

```bash
#!/usr/bin/env bash

# MyGame REPL - Interactive Game Shell

REPL_HISTORY_BASE="${TETRA_DIR}/games/mygame/mygame_repl_history"

mygame_game_repl_run() {
    echo ""
    tds_border_top 50
    tds_border_line "🎮 MYGAME REPL v1.0" 50
    tds_border_line "Interactive Game Shell" 50
    tds_border_bottom 50
    echo ""

    # Register prompt builder
    REPL_PROMPT_BUILDERS=(_mygame_repl_build_prompt)

    # Run REPL loop
    while true; do
        _mygame_repl_build_prompt
        read -e -p "$REPL_PROMPT" input
        [[ -n "$input" ]] && history -s "$input"
        _mygame_repl_process_input "$input" || break
    done

    echo "Goodbye! 🎮"
}

export -f mygame_game_repl_run
```

### Step 4: Source in game.sh

Edit `game.sh` to source your game:

```bash
# Load game modules
source "$GAME_SRC/games/pulsar/pulsar_repl.sh"
source "$GAME_SRC/games/estovox/core/estovox_repl.sh"
source "$GAME_SRC/games/mygame/core/mygame_repl.sh"  # Add here
```

### Step 5: Test

```bash
$ game repl
[mricos x lobby] > ls

  pulsar       ✓  Pulsar Engine        Terminal Sprite Animation System
  estovox      ○  Estovox              Audio-Visual Synthesis Engine
  mygame       ◐  My Game              My awesome game description

[mricos x lobby] > play mygame
```

---

## Module Integration (TCS 3.0)

### Dependencies

```bash
# bash/repl - Universal REPL system
# bash/color - Color system (simple variables)
# bash/tds - Display system (borders and layout)
# bash/tcurses - Input handling
```

### Action Declarations (Optional)

To integrate with demo 014 TUI, create `actions.sh`:

```bash
#!/usr/bin/env bash

source "$(dirname "${BASH_SOURCE[0]}")/game.sh"

game_register_actions() {
    if ! declare -f declare_action >/dev/null 2>&1; then
        return 1
    fi

    # Launch game selector
    declare_action "launch_games" \
        "verb=launch" "noun=games" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "can=Launch interactive game selector REPL"

    # Run diagnostics
    declare_action "check_games" \
        "verb=check" "noun=games" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=read" \
        "can=Check game module status and dependencies"
}

game_execute_action() {
    local action="$1"
    shift

    case "$action" in
        launch:games)
            game_repl_run
            ;;
        check:games)
            game_doctor
            ;;
        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

export -f game_register_actions
export -f game_execute_action
```

---

## Database Pattern (TCS 3.0)

### Module Data

Module-level data stored in `$TETRA_DIR/game/db/`:

```bash
# Example: Game session logs
1760229927.session.log
1760229927.session.meta

# Example: High scores
1760229927.score.pulsar
```

### Per-Game Data

Game-specific data in `$TETRA_DIR/games/<gamename>/db/`:

```bash
# Pulsar sprite definitions
1760229927.sprite.json

# Estovox sound synthesis
1760229927.synth.wav
1760229927.synth.meta

# Game saves (preserve timestamp for session correlation)
1760229927.save.slot1
```

### Cross-Module Correlation

Games can reference data from other modules:

```bash
# VOX generates audio
vox generate sally "Welcome to the game"
# → Creates: $TETRA_DIR/vox/db/1760229927.vox.sally.mp3

# Game plays that audio
game play-audio @vox:1760229927
# → Reads: $TETRA_DIR/vox/db/1760229927.vox.sally.mp3
# → Creates: $TETRA_DIR/games/mygame/db/1760229927.audio-playback.log
```

---

## Command Reference

### Main Command

```bash
game <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `repl` | Launch game selector REPL |
| `quadrapole` | Launch Quadrapole demo (Pulsar C engine) |
| `quadrapole-bash` | Launch Quadrapole demo (bash renderer) |
| `doctor` | Run system diagnostics |
| `help` | Show help message |
| `version` | Show version information |

---

## Engine Diagnostics

### Game Doctor

```bash
$ game doctor

╔═══════════════════════════════════════╗
║         🏥 GAME MODULE DOCTOR         ║
╚═══════════════════════════════════════╝

Engine Status:
  ✓ Pulsar C engine available
  ✓ Binary found: engine/bin/pulsar

Terminal Capabilities:
  ✓ 256-color support detected
  ✓ Terminal size: 160×96

Input Devices:
  ✓ Keyboard detected
  ○ Gamepad not detected

Dependencies:
  ✓ bash/color loaded
  ✓ bash/tds loaded
  ✓ bash/tcurses loaded
  ✓ bash/repl loaded

Overall: READY
```

---

## Development Workflow

### Building the C Engine

```bash
cd bash/game/engine
make

# Verify build
./bin/pulsar --version
```

### Testing Games

```bash
# Test game launcher
bash/game/test_game_launcher.sh

# Test help system
bash/game/test_help.sh

# Test borders
bash/game/test_borders.sh
```

### Adding Features

1. Implement in appropriate subdirectory (`core/`, `animation/`, `rendering/`)
2. Source in `game.sh`
3. Export functions if needed
4. Update documentation
5. Add tests

---

## Documentation Index

### Start Here
- **TETRA_GAME_SPECIFICATION.md** (this file) - Main specification

### Core Documentation
- `README.md` - Module overview
- `docs/ARCHITECTURE.md` - Architecture overview
- `docs/QUICK_START.md` - Quick start guide

### Game Documentation
- `docs/PULSAR_REPL.md` - Pulsar REPL guide
- `docs/QUADRUPOLE_QUICKSTART.md` - Quadrupole game guide
- `docs/GAMEPLAY_CONCEPTS.md` - Game design concepts
- `games/estovox/README.md` - Estovox specification

### Technical Documentation
- `docs/GAMEPAD_SETUP.md` - Gamepad configuration
- `docs/GAMEPAD_FIFO_PROTOCOL.md` - Gamepad protocol
- `engine/CLIENT_SERVER_MODE.md` - Engine client-server mode

### Historical Documentation
- `docs/archive/` - Archived development documentation

---

## Version History

- **1.0** (2025-10-23) - Initial specification
  - TCS 3.0 compliant module structure
  - Game registry system
  - Launcher REPL with org-style prompt
  - Pulsar and Estovox games
  - Database pattern integration
  - Proper data directory separation

---

## See Also

- [Tetra Module Convention](~/src/devops/tetra/docs/Tetra_Module_Convention.md) - Module standards
- [Tetra Core Specification](~/src/devops/tetra/docs/Tetra_Core_Specification.md) - TCS 3.0
- Reference implementations: `bash/org`, `bash/tsm`
