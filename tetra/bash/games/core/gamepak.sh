#!/usr/bin/env bash

# Gamepak - Game Package Management
# Create, install, list, and remove game packages
#
# Gamepak format: <name>.gamepak.tar.gz
#   manifest.toml     - Package metadata
#   games/            - Game directories
#     <game>/
#       game.toml     - Per-game metadata
#       *.sh          - Game scripts

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: gamepak requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# PATHS
# =============================================================================

# System games (tetra org)
GAMEPAK_SYSTEM_DIR="${TETRA_DIR}/orgs/tetra/games"

# User games (installed gamepaks)
GAMEPAK_USER_DIR="${TETRA_DIR}/games"

# =============================================================================
# CREATE GAMEPAK
# =============================================================================

# Create gamepak from directory
# Usage: gamepak_create <source_dir> [output_file]
gamepak_create() {
    local source_dir="$1"
    local output="${2:-}"

    if [[ ! -d "$source_dir" ]]; then
        echo "Error: source directory not found: $source_dir" >&2
        return 1
    fi

    # Check for manifest
    if [[ ! -f "$source_dir/manifest.toml" ]]; then
        echo "Error: manifest.toml not found in $source_dir" >&2
        echo "" >&2
        echo "Create manifest.toml with:" >&2
        cat << 'EOF' >&2
[gamepak]
name = "my-games"
version = "1.0.0"
author = "your-name"
description = "Description"

[[games]]
id = "game-id"
name = "Game Name"
engine = "flax"
entry = "game.sh"
EOF
        return 1
    fi

    # Check for games directory
    if [[ ! -d "$source_dir/games" ]]; then
        echo "Error: games/ directory not found in $source_dir" >&2
        return 1
    fi

    # Parse name from manifest
    local name
    name=$(grep -E '^name\s*=' "$source_dir/manifest.toml" | head -1 | sed 's/.*=\s*"\(.*\)"/\1/')

    if [[ -z "$name" ]]; then
        echo "Error: could not parse name from manifest.toml" >&2
        return 1
    fi

    # Default output filename
    if [[ -z "$output" ]]; then
        output="${name}.gamepak.tar.gz"
    fi

    echo "Creating gamepak: $output"
    echo "  Name: $name"
    echo "  Source: $source_dir"

    # Create tarball
    tar -czf "$output" -C "$source_dir" manifest.toml games/

    if [[ $? -eq 0 ]]; then
        echo "Created: $output"
        ls -lh "$output"
    else
        echo "Error creating gamepak" >&2
        return 1
    fi
}

# =============================================================================
# INSTALL GAMEPAK
# =============================================================================

# Install gamepak
# Usage: gamepak_install <file.gamepak.tar.gz> [--system]
gamepak_install() {
    local file="$1"
    local target_dir="$GAMEPAK_USER_DIR"

    # Check for --system flag
    if [[ "$2" == "--system" ]]; then
        target_dir="$GAMEPAK_SYSTEM_DIR"
    fi

    if [[ ! -f "$file" ]]; then
        echo "Error: file not found: $file" >&2
        return 1
    fi

    # Validate gamepak (check for manifest)
    if ! tar -tzf "$file" manifest.toml >/dev/null 2>&1; then
        echo "Error: invalid gamepak (missing manifest.toml)" >&2
        return 1
    fi

    # Extract manifest to temp location to get name
    local tmpdir
    tmpdir=$(mktemp -d)
    tar -xzf "$file" -C "$tmpdir" manifest.toml

    local name
    name=$(grep -E '^name\s*=' "$tmpdir/manifest.toml" | head -1 | sed 's/.*=\s*"\(.*\)"/\1/')
    rm -rf "$tmpdir"

    if [[ -z "$name" ]]; then
        echo "Error: could not parse name from manifest" >&2
        return 1
    fi

    echo "Installing gamepak: $name"
    echo "  Target: $target_dir"

    # Create target directory
    mkdir -p "$target_dir"

    # Extract games
    tar -xzf "$file" -C "$target_dir" --strip-components=1 games/

    # Store manifest for reference
    tar -xzf "$file" -C "$target_dir" manifest.toml
    mv "$target_dir/manifest.toml" "$target_dir/.${name}.manifest.toml" 2>/dev/null || true

    echo "Installed: $name"

    # List installed games
    echo ""
    echo "Games installed:"
    for game_dir in "$target_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        local game_name
        game_name=$(basename "$game_dir")
        [[ "$game_name" == "."* ]] && continue
        echo "  - $game_name"
    done
}

# =============================================================================
# LIST GAMEPAKS
# =============================================================================

# List installed games
# Usage: gamepak_list [--system|--user|--all]
gamepak_list() {
    local filter="${1:---all}"

    echo "Installed Games"
    echo "==============="

    if [[ "$filter" == "--system" || "$filter" == "--all" ]]; then
        echo ""
        echo "System ($GAMEPAK_SYSTEM_DIR):"
        if [[ -d "$GAMEPAK_SYSTEM_DIR" ]]; then
            for game_dir in "$GAMEPAK_SYSTEM_DIR"/*/; do
                [[ -d "$game_dir" ]] || continue
                local game_name
                game_name=$(basename "$game_dir")
                [[ "$game_name" == "."* ]] && continue

                local engine="unknown"
                if [[ -f "$game_dir/game.toml" ]]; then
                    engine=$(grep -E '^engine\s*=' "$game_dir/game.toml" | sed 's/.*=\s*"\(.*\)"/\1/' || echo "unknown")
                fi
                printf "  %-20s [%s]\n" "$game_name" "$engine"
            done
        else
            echo "  (none)"
        fi
    fi

    if [[ "$filter" == "--user" || "$filter" == "--all" ]]; then
        echo ""
        echo "User ($GAMEPAK_USER_DIR):"
        if [[ -d "$GAMEPAK_USER_DIR" ]]; then
            local found=0
            for game_dir in "$GAMEPAK_USER_DIR"/*/; do
                [[ -d "$game_dir" ]] || continue
                local game_name
                game_name=$(basename "$game_dir")
                [[ "$game_name" == "."* ]] && continue

                local engine="unknown"
                if [[ -f "$game_dir/game.toml" ]]; then
                    engine=$(grep -E '^engine\s*=' "$game_dir/game.toml" | sed 's/.*=\s*"\(.*\)"/\1/' || echo "unknown")
                fi
                printf "  %-20s [%s]\n" "$game_name" "$engine"
                ((found++))
            done
            ((found == 0)) && echo "  (none)"
        else
            echo "  (none)"
        fi
    fi
}

# =============================================================================
# REMOVE GAMEPAK
# =============================================================================

# Remove installed game
# Usage: gamepak_remove <game_name> [--system]
gamepak_remove() {
    local game_name="$1"
    local target_dir="$GAMEPAK_USER_DIR"

    if [[ "$2" == "--system" ]]; then
        target_dir="$GAMEPAK_SYSTEM_DIR"
    fi

    local game_dir="$target_dir/$game_name"

    if [[ ! -d "$game_dir" ]]; then
        echo "Error: game not found: $game_name" >&2
        echo "Location checked: $game_dir" >&2
        return 1
    fi

    echo "Removing: $game_name"
    echo "  Location: $game_dir"

    read -p "Are you sure? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 1
    fi

    rm -rf "$game_dir"
    echo "Removed: $game_name"
}

# =============================================================================
# RUN GAME
# =============================================================================

# Run a game by name
# Usage: gamepak_run <game_name> [--system]
gamepak_run() {
    local game_name="$1"
    shift

    # Search user games first, then system
    local game_dir=""

    if [[ -d "$GAMEPAK_USER_DIR/$game_name" ]]; then
        game_dir="$GAMEPAK_USER_DIR/$game_name"
    elif [[ -d "$GAMEPAK_SYSTEM_DIR/$game_name" ]]; then
        game_dir="$GAMEPAK_SYSTEM_DIR/$game_name"
    else
        echo "Error: game not found: $game_name" >&2
        return 1
    fi

    # Get entry point from game.toml
    local entry="game.sh"
    if [[ -f "$game_dir/game.toml" ]]; then
        entry=$(grep -E '^entry\s*=' "$game_dir/game.toml" | sed 's/.*=\s*"\(.*\)"/\1/' || echo "game.sh")
    fi

    local entry_file="$game_dir/$entry"

    if [[ ! -f "$entry_file" ]]; then
        echo "Error: entry point not found: $entry_file" >&2
        return 1
    fi

    # Get engine
    local engine="flax"
    if [[ -f "$game_dir/game.toml" ]]; then
        engine=$(grep -E '^engine\s*=' "$game_dir/game.toml" | sed 's/.*=\s*"\(.*\)"/\1/' || echo "flax")
    fi

    # Load engine
    case "$engine" in
        flax)
            source "$GAMES_SRC/engines/flax/flax.sh"
            ;;
        tui)
            source "$GAMES_SRC/engines/tui/tui.sh"
            ;;
        pulsar)
            echo "Pulsar engine requires compilation" >&2
            return 1
            ;;
        *)
            echo "Unknown engine: $engine" >&2
            return 1
            ;;
    esac

    # Run game
    echo "Running: $game_name (engine: $engine)"
    source "$entry_file"

    # Try to call standard entry function
    if declare -f "${game_name}_run" >/dev/null 2>&1; then
        "${game_name}_run" "$@"
    elif declare -f "game_run" >/dev/null 2>&1; then
        game_run "$@"
    elif declare -f "main" >/dev/null 2>&1; then
        main "$@"
    fi
}

# =============================================================================
# VALIDATE GAMEPAK
# =============================================================================

# Validate gamepak file or directory
# Usage: gamepak_validate <file_or_dir>
gamepak_validate() {
    local target="$1"
    local errors=0

    echo "Validating: $target"
    echo ""

    if [[ -f "$target" ]]; then
        # Validate tarball
        echo "Type: gamepak archive"

        if ! tar -tzf "$target" manifest.toml >/dev/null 2>&1; then
            echo "  [FAIL] Missing manifest.toml"
            ((errors++))
        else
            echo "  [OK] manifest.toml present"
        fi

        if ! tar -tzf "$target" games/ >/dev/null 2>&1; then
            echo "  [FAIL] Missing games/ directory"
            ((errors++))
        else
            echo "  [OK] games/ directory present"
        fi

    elif [[ -d "$target" ]]; then
        # Validate directory
        echo "Type: gamepak directory"

        if [[ ! -f "$target/manifest.toml" ]]; then
            echo "  [FAIL] Missing manifest.toml"
            ((errors++))
        else
            echo "  [OK] manifest.toml present"
        fi

        if [[ ! -d "$target/games" ]]; then
            echo "  [FAIL] Missing games/ directory"
            ((errors++))
        else
            echo "  [OK] games/ directory present"

            # Validate each game
            for game_dir in "$target/games"/*/; do
                [[ -d "$game_dir" ]] || continue
                local game_name
                game_name=$(basename "$game_dir")

                if [[ ! -f "$game_dir/game.toml" ]]; then
                    echo "  [WARN] $game_name: missing game.toml"
                else
                    echo "  [OK] $game_name: valid"
                fi
            done
        fi
    else
        echo "Error: not found: $target" >&2
        return 1
    fi

    echo ""
    if ((errors > 0)); then
        echo "Validation failed with $errors error(s)"
        return 1
    else
        echo "Validation passed"
        return 0
    fi
}

# =============================================================================
# COMMAND INTERFACE
# =============================================================================

# Main gamepak command
gamepak() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        create)
            gamepak_create "$@"
            ;;
        install)
            gamepak_install "$@"
            ;;
        list|ls)
            gamepak_list "$@"
            ;;
        remove|rm)
            gamepak_remove "$@"
            ;;
        run|play)
            gamepak_run "$@"
            ;;
        validate)
            gamepak_validate "$@"
            ;;
        help|-h|--help)
            gamepak_help
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Run 'gamepak help' for usage" >&2
            return 1
            ;;
    esac
}

gamepak_help() {
    cat << EOF
Gamepak - Game Package Management
=================================

USAGE:
    gamepak <command> [args]

COMMANDS:
    create <dir> [output]      Create gamepak from directory
    install <file> [--system]  Install gamepak
    list [--system|--user]     List installed games
    remove <name> [--system]   Remove installed game
    run <name>                 Run a game
    validate <file_or_dir>     Validate gamepak

GAMEPAK FORMAT:
    <name>.gamepak.tar.gz
    ├── manifest.toml          Package metadata
    └── games/
        └── <game>/
            ├── game.toml      Game metadata
            └── *.sh           Game scripts

DIRECTORIES:
    System: $GAMEPAK_SYSTEM_DIR
    User:   $GAMEPAK_USER_DIR

EXAMPLES:
    gamepak create ./my-games
    gamepak install tetra-classics.gamepak.tar.gz
    gamepak list
    gamepak run traks
    gamepak remove quadrapole
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export GAMEPAK_SYSTEM_DIR GAMEPAK_USER_DIR
export -f gamepak_create gamepak_install gamepak_list gamepak_remove
export -f gamepak_run gamepak_validate gamepak gamepak_help
