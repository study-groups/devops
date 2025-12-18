#!/usr/bin/env bash

# Games Module - Multi-Org Game Management
#
# Games live at: $TETRA_DIR/orgs/<org>/games/<game-name>/
# Default org: tetra
#
# Usage:
#   games list              List installed games
#   games play <game>       Play a game
#   games org [name]        Show/set active org
#   games pak <game>        Create backup archive

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games module requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# MODULE PATHS & CONTEXT
# =============================================================================

GAMES_SRC="${TETRA_SRC}/bash/games"
export GAMES_SRC

# Context system - org determines which games directory to use
export GAMES_CTX_ORG="${GAMES_CTX_ORG:-tetra}"

# Dynamic path helpers (respect active org)
_games_get_org() {
    echo "${GAMES_ORG:-${GAMES_CTX_ORG:-tetra}}"
}

_games_get_dir() {
    local org=$(_games_get_org)
    echo "${TETRA_DIR}/orgs/${org}/games"
}

# Legacy static export for backwards compatibility
GAMES_DIR="${TETRA_DIR}/orgs/tetra/games"
export GAMES_DIR

# Ensure default games directory exists
[[ ! -d "$GAMES_DIR" ]] && mkdir -p "$GAMES_DIR"

# =============================================================================
# LOAD HELP SYSTEM
# =============================================================================

if [[ -f "$GAMES_SRC/core/help.sh" ]]; then
    source "$GAMES_SRC/core/help.sh"
fi

# =============================================================================
# ORG COMMANDS
# =============================================================================

# Show or set active org
games_org() {
    local org="$1"

    if [[ -z "$org" ]]; then
        # Show current org
        local current=$(_games_get_org)
        local games_dir=$(_games_get_dir)
        local count=0

        if [[ -d "$games_dir" ]]; then
            count=$(find "$games_dir" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
        fi

        echo "Active org: $current"
        echo "Games dir:  $games_dir"
        echo "Games:      $count"
    else
        # Validate org exists
        local org_dir="${TETRA_DIR}/orgs/${org}"
        if [[ ! -d "$org_dir" ]]; then
            echo "Org not found: $org" >&2
            echo "Available orgs:" >&2
            games_orgs 2>&1 | sed 's/^/  /'
            return 1
        fi

        export GAMES_CTX_ORG="$org"
        echo "Switched to org: $org"

        # Create games dir if needed
        local games_dir="${org_dir}/games"
        if [[ ! -d "$games_dir" ]]; then
            mkdir -p "$games_dir"
            echo "Created: $games_dir"
        fi
    fi
}

# List all orgs with games
games_orgs() {
    local orgs_dir="${TETRA_DIR}/orgs"

    if [[ ! -d "$orgs_dir" ]]; then
        echo "No orgs directory: $orgs_dir" >&2
        return 1
    fi

    local current=$(_games_get_org)

    echo "Organizations with games:"
    echo ""
    printf "  %-20s %s\n" "ORG" "GAMES"
    printf "  %-20s %s\n" "---" "-----"

    for org_dir in "$orgs_dir"/*/; do
        [[ -d "$org_dir" ]] || continue
        local org=$(basename "$org_dir")
        local games_dir="${org_dir}games"
        local count=0
        local marker=""

        if [[ -d "$games_dir" ]]; then
            count=$(find "$games_dir" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
        fi

        [[ "$org" == "$current" ]] && marker="*"

        # Only show orgs with games or the current org
        if ((count > 0)) || [[ "$org" == "$current" ]]; then
            printf "  %-20s %d %s\n" "$org" "$count" "$marker"
        fi
    done
}

# Search games across all orgs
games_search() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Usage: games search <query>" >&2
        return 1
    fi

    local orgs_dir="${TETRA_DIR}/orgs"
    local found=0

    echo "Searching for: $query"
    echo ""

    for org_dir in "$orgs_dir"/*/; do
        [[ -d "$org_dir" ]] || continue
        local org=$(basename "$org_dir")
        local games_dir="${org_dir}games"

        [[ -d "$games_dir" ]] || continue

        for game_dir in "$games_dir"/*/; do
            [[ -d "$game_dir" ]] || continue
            local game=$(basename "$game_dir")

            # Match game name or description
            if [[ "$game" == *"$query"* ]]; then
                printf "  %s/%s\n" "$org" "$game"
                ((found++))
            elif [[ -f "${game_dir}game.toml" ]]; then
                if grep -qi "$query" "${game_dir}game.toml" 2>/dev/null; then
                    printf "  %s/%s\n" "$org" "$game"
                    ((found++))
                fi
            fi
        done
    done

    echo ""
    echo "Found: $found games"
}

# =============================================================================
# LIST GAMES
# =============================================================================

games_list() {
    local games_dir=$(_games_get_dir)
    local org=$(_games_get_org)

    echo "Games in $org:"
    echo ""

    if [[ ! -d "$games_dir" ]]; then
        echo "  (games directory not found: $games_dir)"
        return 0
    fi

    local found=0
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        local name=$(basename "$game_dir")
        local desc=""

        # Read description from game.toml if exists
        if [[ -f "${game_dir}game.toml" ]]; then
            desc=$(grep -E '^description[[:space:]]*=' "${game_dir}game.toml" 2>/dev/null | sed 's/.*=[[:space:]]*"\(.*\)"/\1/' | head -1)
        fi

        printf "  %-20s %s\n" "$name" "$desc"
        ((found++))
    done

    if ((found == 0)); then
        echo "  (no games installed)"
    fi
}

# =============================================================================
# CONTROLS - Show game control mappings
# =============================================================================

games_controls() {
    local game="$1"

    if [[ -z "$game" ]]; then
        echo "Usage: games controls <game>" >&2
        return 1
    fi

    local org=$(_games_get_org)
    local game_dir="$TETRA_DIR/orgs/$org/games/$game"
    local controls_file="$game_dir/controls.json"

    if [[ ! -f "$controls_file" ]]; then
        echo "No controls.json found for $game" >&2
        return 1
    fi

    echo "Controls for $game:"
    echo ""

    # Parse actions from controls.json using bash-native JSON parsing
    local in_actions=false
    local current_action=""
    while IFS= read -r line; do
        if [[ "$line" =~ \"actions\" ]]; then
            in_actions=true
            continue
        fi
        if $in_actions; then
            if [[ "$line" =~ \"([a-z0-9_]+)\":[[:space:]]*\{ ]]; then
                current_action="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ \"description\":[[:space:]]*\"([^\"]+)\" ]]; then
                printf "  %-15s %s\n" "$current_action" "${BASH_REMATCH[1]}"
            elif [[ "$line" =~ \"defaults\" ]]; then
                break
            fi
        fi
    done < "$controls_file"

    echo ""
    echo "Controls file: $controls_file"
}

# =============================================================================
# PLAY GAME
# =============================================================================

games_play() {
    local game=""
    local use_controls=false
    local controls_file=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --controls)
                use_controls=true
                if [[ -n "$2" && "$2" != -* ]]; then
                    controls_file="$2"
                    shift
                fi
                ;;
            -*)
                echo "Unknown option: $1" >&2
                return 1
                ;;
            *)
                game="$1"
                ;;
        esac
        shift
    done

    if [[ -z "$game" ]]; then
        echo "Usage: games play <game> [--controls [file]]" >&2
        return 1
    fi

    # Get active org
    local org=$(_games_get_org)
    local game_dir="$TETRA_DIR/orgs/$org/games/$game"

    if [[ ! -d "$game_dir" ]]; then
        echo "Game not found: $game" >&2
        echo "Looked in: $game_dir" >&2
        echo "Run 'games list' to see available games" >&2
        return 1
    fi

    # Look for entry point
    local entry=""

    # Check game.toml for repl or entry
    if [[ -f "${game_dir}/game.toml" ]]; then
        entry=$(grep -E '^repl[[:space:]]*=' "${game_dir}/game.toml" 2>/dev/null | sed 's/.*=[[:space:]]*"\(.*\)"/\1/' | head -1)
        if [[ -z "$entry" ]]; then
            entry=$(grep -E '^entry[[:space:]]*=' "${game_dir}/game.toml" 2>/dev/null | sed 's/.*=[[:space:]]*"\(.*\)"/\1/' | head -1)
        fi
    fi

    # Default entry points
    if [[ -z "$entry" ]]; then
        if [[ -f "${game_dir}/core/${game}_repl.sh" ]]; then
            entry="core/${game}_repl.sh"
        elif [[ -f "${game_dir}/${game}.sh" ]]; then
            entry="${game}.sh"
        fi
    fi

    if [[ -z "$entry" || ! -f "${game_dir}/${entry}" ]]; then
        echo "No entry point found for game: $game" >&2
        echo "Expected: game.toml with repl= or entry=, or ${game}.sh" >&2
        return 1
    fi

    # Set game-specific variables
    local game_name_upper="${game^^}"
    export "${game_name_upper}_SRC=$game_dir"
    export "${game_name_upper}_DIR=$TETRA_DIR/games/$game"

    # Create runtime dir if needed
    [[ ! -d "$TETRA_DIR/games/$game" ]] && mkdir -p "$TETRA_DIR/games/$game"

    # Resolve controls file
    if [[ -z "$controls_file" ]]; then
        controls_file="$game_dir/controls.json"
    fi

    # Check if controls daemon should be started
    local controls_bin="$TETRA_SRC/bash/midi/midi_bridge"
    local controls_pid=""

    if $use_controls && [[ -f "$controls_file" ]]; then
        if [[ ! -x "$controls_bin" ]]; then
            echo "Warning: controls binary not found at $controls_bin" >&2
            echo "Build with: cd \$TETRA_SRC/bash/midi && make" >&2
            use_controls=false
        fi
    fi

    echo "Starting $game..."

    # Source the game
    source "${game_dir}/${entry}"

    if $use_controls && [[ -x "$controls_bin" ]]; then
        echo "Starting controls daemon (MIDI + gamepad)..."

        # Start controls daemon, pipe to game via FIFO
        local fifo="$TETRA_DIR/games/$game/controls.fifo"
        [[ -p "$fifo" ]] || mkfifo "$fifo"

        # Export FIFO path for game to use
        export "${game_name_upper}_FIFO=$fifo"
        export TRAX_USE_FIFO=true
        export TRAX_FIFO="$fifo"

        # Start midi_bridge in background, output to FIFO
        "$controls_bin" -M -g -O > "$fifo" 2>/dev/null &
        controls_pid=$!

        echo "Controls PID: $controls_pid"

        # Cleanup on exit
        trap "kill $controls_pid 2>/dev/null; rm -f '$fifo'" EXIT
    fi

    # Try standard entry points
    if declare -f game_run >/dev/null 2>&1; then
        game_run
    elif declare -f "${game}_run" >/dev/null 2>&1; then
        "${game}_run"
    elif declare -f main >/dev/null 2>&1; then
        main
    elif declare -f "${game}_game_repl_run" >/dev/null 2>&1; then
        "${game}_game_repl_run"
    else
        echo "Warning: no entry function found (tried: game_run, ${game}_run, main)" >&2
    fi

    # Cleanup controls daemon
    if [[ -n "$controls_pid" ]]; then
        kill "$controls_pid" 2>/dev/null
        wait "$controls_pid" 2>/dev/null
    fi
}

# =============================================================================
# INFO - Show game details
# =============================================================================

games_info() {
    local game="$1"

    if [[ -z "$game" ]]; then
        echo "Usage: games info <game>" >&2
        return 1
    fi

    local org=$(_games_get_org)
    local game_dir="$TETRA_DIR/orgs/$org/games/$game"

    if [[ ! -d "$game_dir" ]]; then
        echo "Game not found: $game" >&2
        return 1
    fi

    echo "Game: $game"
    echo "Org:  $org"
    echo "Path: $game_dir"
    echo ""

    if [[ -f "${game_dir}/game.toml" ]]; then
        echo "Configuration (game.toml):"
        sed 's/^/  /' "${game_dir}/game.toml"
        echo ""
    fi

    if [[ -f "${game_dir}/controls.json" ]]; then
        echo "Controls: controls.json present"
    fi

    echo ""
    echo "Files:"
    ls -la "$game_dir" | tail -n +2 | sed 's/^/  /'
}

# =============================================================================
# PAK - Create backup archive
# =============================================================================

games_pak() {
    local game="$1"
    local output="${2:-}"

    if [[ -z "$game" ]]; then
        echo "Usage: games pak <game> [output.tar.gz]" >&2
        return 1
    fi

    local games_dir=$(_games_get_dir)
    local game_dir="${games_dir}/${game}"

    if [[ ! -d "$game_dir" ]]; then
        echo "Game not found: $game" >&2
        return 1
    fi

    # Check for manifest.toml (required for pak)
    if [[ ! -f "${game_dir}/manifest.toml" ]]; then
        echo "Creating manifest.toml for $game..."

        local name="$game"
        local desc=""
        local version="1.0.0"

        if [[ -f "${game_dir}/game.toml" ]]; then
            name=$(grep -E '^name[[:space:]]*=' "${game_dir}/game.toml" 2>/dev/null | sed 's/.*=[[:space:]]*"\(.*\)"/\1/' | head -1)
            desc=$(grep -E '^description[[:space:]]*=' "${game_dir}/game.toml" 2>/dev/null | sed 's/.*=[[:space:]]*"\(.*\)"/\1/' | head -1)
            version=$(grep -E '^version[[:space:]]*=' "${game_dir}/game.toml" 2>/dev/null | sed 's/.*=[[:space:]]*"\(.*\)"/\1/' | head -1)
        fi

        [[ -z "$name" ]] && name="$game"
        [[ -z "$version" ]] && version="1.0.0"

        cat > "${game_dir}/manifest.toml" << EOF
[gamepak]
name = "$name"
version = "$version"
description = "$desc"
created = "$(date -Iseconds)"
org = "$(_games_get_org)"
EOF
        echo "Created manifest.toml"
    fi

    [[ -z "$output" ]] && output="${game}.gamepak.tar.gz"

    echo "Creating gamepak: $output"
    echo "  Game: $game"
    echo "  Source: $game_dir"

    tar -czf "$output" -C "$games_dir" "$game"

    if [[ $? -eq 0 ]]; then
        echo "Created: $output"
        ls -lh "$output"
    else
        echo "Error creating gamepak" >&2
        return 1
    fi
}

# =============================================================================
# UNPAK - Restore from archive
# =============================================================================

games_unpak() {
    local archive="$1"

    if [[ -z "$archive" ]]; then
        echo "Usage: games unpak <file.tar.gz>" >&2
        return 1
    fi

    if [[ ! -f "$archive" ]]; then
        echo "Archive not found: $archive" >&2
        return 1
    fi

    local games_dir=$(_games_get_dir)

    echo "Extracting gamepak: $archive"
    echo "  Destination: $games_dir"

    mkdir -p "$games_dir"
    tar -xzf "$archive" -C "$games_dir"

    if [[ $? -eq 0 ]]; then
        echo "Extracted successfully"
        echo ""
        echo "Installed games:"
        tar -tzf "$archive" | grep -E '^[^/]+/$' | sed 's|/||' | while read game; do
            echo "  - $game"
        done
    else
        echo "Error extracting gamepak" >&2
        return 1
    fi
}

# =============================================================================
# DOCTOR - Diagnose environment
# =============================================================================

games_doctor() {
    echo "Games Environment Diagnostics"
    echo "=============================="
    echo ""

    echo "Module:"
    echo "  GAMES_SRC: $GAMES_SRC"
    echo "  Org:       $(_games_get_org)"
    echo "  Games dir: $(_games_get_dir)"
    echo ""

    echo "Directories:"
    local orgs_dir="${TETRA_DIR}/orgs"
    if [[ -d "$orgs_dir" ]]; then
        echo "  [OK] Orgs dir: $orgs_dir"
    else
        echo "  [FAIL] Orgs dir missing: $orgs_dir"
    fi

    local games_dir=$(_games_get_dir)
    if [[ -d "$games_dir" ]]; then
        echo "  [OK] Games dir: $games_dir"
    else
        echo "  [WARN] Games dir missing: $games_dir"
    fi

    local runtime_dir="${TETRA_DIR}/games"
    if [[ -d "$runtime_dir" ]]; then
        echo "  [OK] Runtime dir: $runtime_dir"
    else
        echo "  [INFO] Runtime dir created on first play"
    fi
    echo ""

    echo "Controls:"
    local controls_bin="$TETRA_SRC/bash/midi/midi_bridge"
    if [[ -x "$controls_bin" ]]; then
        echo "  [OK] midi_bridge: $controls_bin"
    else
        echo "  [WARN] midi_bridge not built"
        echo "        Build: cd \$TETRA_SRC/bash/midi && make"
    fi
    echo ""

    echo "Games by org:"
    local total=0
    for org_dir in "$orgs_dir"/*/; do
        [[ -d "$org_dir" ]] || continue
        local org=$(basename "$org_dir")
        local org_games_dir="${org_dir}games"
        local count=0

        if [[ -d "$org_games_dir" ]]; then
            count=$(find "$org_games_dir" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
        fi

        ((count > 0)) && printf "  %-15s %d games\n" "$org" "$count"
        ((total += count))
    done
    echo ""
    echo "Total: $total games"
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

games() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Game management
        list|ls)
            games_list
            ;;
        play|run)
            games_play "$@"
            ;;
        info)
            games_info "$@"
            ;;
        controls|ctrl)
            games_controls "$@"
            ;;

        # Organization
        org)
            games_org "$@"
            ;;
        orgs)
            games_orgs
            ;;
        search|find)
            games_search "$@"
            ;;

        # Backup/restore
        pak|pack|backup)
            games_pak "$@"
            ;;
        unpak|unpack|restore)
            games_unpak "$@"
            ;;

        # Diagnostics
        doctor)
            games_doctor
            ;;

        # Help (TDS-colored if available)
        help|-h|--help)
            if [[ -n "$1" ]]; then
                if declare -f games_help_topic >/dev/null 2>&1; then
                    games_help_topic "$@"
                else
                    echo "Help topic: $1 (help system not loaded)"
                fi
            else
                if declare -f games_help_main >/dev/null 2>&1; then
                    games_help_main "$@"
                else
                    # Fallback inline help
                    cat << 'EOF'
GAMES - Game Management

USAGE
  games list                     List installed games
  games play <game> [--controls] Play a game
  games org [name]               Show/set active org
  games orgs                     List orgs with games
  games search <query>           Search games across orgs
  games controls <game>          Show control mappings
  games pak <game>               Create backup archive
  games unpak <file>             Restore from archive
  games doctor                   Diagnose environment

Run 'games help <topic>' for: play, orgs, pak, all
EOF
                fi
            fi
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Run 'games help' for usage" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# TAB COMPLETION
# =============================================================================

if [[ -f "$GAMES_SRC/core/games_complete.sh" ]]; then
    source "$GAMES_SRC/core/games_complete.sh"
fi

# =============================================================================
# EXPORTS
# =============================================================================

export -f games
export -f games_list
export -f games_play
export -f games_info
export -f games_controls
export -f games_org
export -f games_orgs
export -f games_search
export -f games_pak
export -f games_unpak
export -f games_doctor
export -f _games_get_org
export -f _games_get_dir

echo "Games module loaded" >&2
