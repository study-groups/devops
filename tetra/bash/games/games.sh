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
# Priority: GAMES_ORG > GAMES_CTX_ORG > TETRA_ORG > "tetra"
export GAMES_CTX_ORG="${GAMES_CTX_ORG:-${TETRA_ORG:-tetra}}"

# Dynamic path helpers (respect active org)
_games_get_org() {
    echo "${GAMES_ORG:-${GAMES_CTX_ORG:-${TETRA_ORG:-tetra}}}"
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
# LOAD SUBMODULES
# =============================================================================

if [[ -f "$GAMES_SRC/core/help.sh" ]]; then
    source "$GAMES_SRC/core/help.sh"
fi

if [[ -f "$GAMES_SRC/core/games_sync.sh" ]]; then
    source "$GAMES_SRC/core/games_sync.sh"
fi

if [[ -f "$GAMES_SRC/core/games_admin.sh" ]]; then
    source "$GAMES_SRC/core/games_admin.sh"
fi

if [[ -f "$GAMES_SRC/core/games_manifest.sh" ]]; then
    source "$GAMES_SRC/core/games_manifest.sh"
fi

if [[ -f "$GAMES_SRC/core/games_crud.sh" ]]; then
    source "$GAMES_SRC/core/games_crud.sh"
fi

if [[ -f "$GAMES_SRC/core/games_upload.sh" ]]; then
    source "$GAMES_SRC/core/games_upload.sh"
fi

if [[ -f "$GAMES_SRC/core/games_deploy.sh" ]]; then
    source "$GAMES_SRC/core/games_deploy.sh"
fi

if [[ -f "$GAMES_SRC/core/games_preflight.sh" ]]; then
    source "$GAMES_SRC/core/games_preflight.sh"
fi

if [[ -f "$GAMES_SRC/core/games_config.sh" ]]; then
    source "$GAMES_SRC/core/games_config.sh"
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
# DOCTOR - Game management and diagnostics
# =============================================================================

# Rename a game across all touch points
games_doctor_rename() {
    local old="$1" new="$2"

    if [[ -z "$old" || -z "$new" ]]; then
        echo "Usage: games doctor rename <old-name> <new-name>" >&2
        return 1
    fi

    local org=$(_games_get_org)
    local games_dir=$(_games_get_dir)
    local old_dir="${games_dir}/${old}"
    local new_dir="${games_dir}/${new}"

    # Validate
    if [[ ! -d "$old_dir" ]]; then
        echo "Game not found: $old" >&2
        echo "Looked in: $old_dir" >&2
        return 1
    fi

    if [[ -d "$new_dir" ]]; then
        echo "Target already exists: $new" >&2
        echo "Path: $new_dir" >&2
        return 1
    fi

    echo "Renaming game: $old -> $new"
    echo "Org: $org"
    echo ""

    local errors=0

    # 1. Rename directory
    echo "[1/6] Renaming directory..."
    if mv "$old_dir" "$new_dir"; then
        echo "  [OK] ${old}/ -> ${new}/"
    else
        echo "  [FAIL] Could not rename directory" >&2
        return 1
    fi

    # 2. Update game.toml
    echo "[2/6] Updating game.toml..."
    if [[ -f "${new_dir}/game.toml" ]]; then
        # Update id field
        if grep -q "^id = " "${new_dir}/game.toml"; then
            sed -i '' "s/^id = \"[^\"]*\"/id = \"$new\"/" "${new_dir}/game.toml"
            echo "  [OK] Updated id = \"$new\""
        fi
        # Update name field (capitalize first letter)
        local new_name="${new^}"
        if grep -q "^name = " "${new_dir}/game.toml"; then
            sed -i '' "s/^name = \"[^\"]*\"/name = \"$new_name\"/" "${new_dir}/game.toml"
            echo "  [OK] Updated name = \"$new_name\""
        fi
    else
        echo "  [SKIP] No game.toml found"
    fi

    # 3. Update manifest (games.json) if exists
    echo "[3/6] Checking manifest..."
    local manifest="${TETRA_DIR}/orgs/${org}/games/games.json"
    if [[ -f "$manifest" ]]; then
        if jq -e ".games[\"$old\"]" "$manifest" >/dev/null 2>&1; then
            local tmp=$(mktemp)
            jq --arg old "$old" --arg new "$new" '
                .games[$new] = .games[$old] |
                .games[$new].slug = $new |
                del(.games[$old])
            ' "$manifest" > "$tmp" && mv "$tmp" "$manifest"
            echo "  [OK] Renamed entry in games.json"
        else
            echo "  [SKIP] Game not in manifest"
        fi
    else
        echo "  [SKIP] No games.json manifest"
    fi

    # 4. Update enabled symlink
    echo "[4/6] Checking enabled symlinks..."
    local enabled_link="$GAMES_SRC/enabled/$old"
    if [[ -L "$enabled_link" ]]; then
        rm "$enabled_link"
        ln -s "../available/$new" "$GAMES_SRC/enabled/$new"
        echo "  [OK] Updated symlink in enabled/"
    else
        echo "  [SKIP] No enabled symlink"
    fi

    # Also check available directory (source code location)
    local avail_old="$GAMES_SRC/available/$old"
    local avail_new="$GAMES_SRC/available/$new"
    if [[ -d "$avail_old" ]]; then
        mv "$avail_old" "$avail_new"
        echo "  [OK] Renamed in available/"
    fi

    # 5. Rename runtime dir
    echo "[5/6] Checking runtime directory..."
    local runtime_old="${TETRA_DIR}/games/${old}"
    local runtime_new="${TETRA_DIR}/games/${new}"
    if [[ -d "$runtime_old" ]]; then
        mv "$runtime_old" "$runtime_new"
        echo "  [OK] Renamed runtime dir"
    else
        echo "  [SKIP] No runtime directory"
    fi

    # 6. Warn about external references
    echo "[6/6] Checking for external references..."
    games_doctor_refs "$old"

    echo ""
    echo "Rename complete: $old -> $new"
}

# Move a game to a different org
games_doctor_move() {
    local game="$1" target_org="$2"

    if [[ -z "$game" || -z "$target_org" ]]; then
        echo "Usage: games doctor move <game> <target-org>" >&2
        return 1
    fi

    local src_org=$(_games_get_org)
    local src_dir="${TETRA_DIR}/orgs/${src_org}/games/${game}"
    local dst_dir="${TETRA_DIR}/orgs/${target_org}/games/${game}"

    # Validate source
    if [[ ! -d "$src_dir" ]]; then
        echo "Game not found: $game in org $src_org" >&2
        return 1
    fi

    # Validate target org exists
    if [[ ! -d "${TETRA_DIR}/orgs/${target_org}" ]]; then
        echo "Target org not found: $target_org" >&2
        echo "Create it first: mkdir -p ${TETRA_DIR}/orgs/${target_org}/games" >&2
        return 1
    fi

    # Check target doesn't exist
    if [[ -d "$dst_dir" ]]; then
        echo "Game already exists in target org: $dst_dir" >&2
        return 1
    fi

    echo "Moving game: $game"
    echo "From: $src_org -> $target_org"
    echo ""

    # Ensure target games dir exists
    mkdir -p "${TETRA_DIR}/orgs/${target_org}/games"

    # Move the game
    if mv "$src_dir" "$dst_dir"; then
        echo "[OK] Moved to: $dst_dir"
    else
        echo "[FAIL] Could not move game" >&2
        return 1
    fi

    # Update game.toml org field if present
    if [[ -f "${dst_dir}/game.toml" ]]; then
        if grep -q "^org = " "${dst_dir}/game.toml"; then
            sed -i '' "s/^org = \"[^\"]*\"/org = \"$target_org\"/" "${dst_dir}/game.toml"
            echo "[OK] Updated org in game.toml"
        fi
    fi

    echo ""
    echo "Move complete. Switch to org: games org $target_org"
}

# Find references to a game name in the codebase
games_doctor_refs() {
    local game="$1"

    if [[ -z "$game" ]]; then
        echo "Usage: games doctor refs <game-name>" >&2
        return 1
    fi

    echo ""
    echo "References to '$game' in codebase:"

    local count=0
    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        # Skip node_modules and .git
        [[ "$file" == *"node_modules"* ]] && continue
        [[ "$file" == *".git/"* ]] && continue
        echo "  $file"
        ((count++))
    done < <(grep -rl "$game" "$TETRA_SRC" --include="*.md" --include="*.html" --include="*.js" --include="*.sh" 2>/dev/null | head -30)

    if ((count == 0)); then
        echo "  (no references found)"
    else
        echo ""
        echo "Found $count file(s) referencing '$game'"
        echo "Review and update these manually if needed."
    fi
}

# Main doctor dispatch
games_doctor() {
    local subcmd="${1:-}"

    case "$subcmd" in
        rename)
            shift
            games_doctor_rename "$@"
            ;;
        move)
            shift
            games_doctor_move "$@"
            ;;
        refs)
            shift
            games_doctor_refs "$@"
            ;;
        --kill)
            games_doctor_main --kill
            ;;
        ""|help|-h)
            games_doctor_main
            ;;
        *)
            # Unknown subcommand - pass to main diagnostics
            games_doctor_main "$@"
            ;;
    esac
}

# Environment diagnostics (original doctor functionality)
games_doctor_main() {
    local kill_orphans=0
    [[ "$1" == "--kill" ]] && kill_orphans=1

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

    echo "Arcade Integration (PJA_GAMES_DIR):"
    local pja_expected="${TETRA_DIR}/orgs/pixeljam-arcade/games"
    if [[ -n "$PJA_GAMES_DIR" ]]; then
        echo "  [OK] PJA_GAMES_DIR: $PJA_GAMES_DIR"
        if [[ "$PJA_GAMES_DIR" == "$pja_expected" ]]; then
            echo "  [OK] Points to pixeljam-arcade games"
        else
            echo "  [WARN] Expected: $pja_expected"
        fi
        if [[ -d "$PJA_GAMES_DIR" ]]; then
            local pja_count=$(find "$PJA_GAMES_DIR" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
            echo "  [OK] Directory exists ($pja_count games)"
        else
            echo "  [FAIL] Directory not found"
        fi
    else
        echo "  [WARN] PJA_GAMES_DIR not set"
        echo "        Add to env: export PJA_GAMES_DIR=$pja_expected"
        if [[ -d "$pja_expected" ]]; then
            local pja_count=$(find "$pja_expected" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
            echo "  [INFO] Default path exists ($pja_count games)"
        fi
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
    echo ""

    # Orphan process detection
    echo "Processes:"
    local -a tsm_pids=()
    local -a orphan_pids=()
    local -A orphan_info=()

    # Get TSM-managed PIDs
    while IFS= read -r pid; do
        [[ -n "$pid" ]] && tsm_pids+=("$pid")
    done < <(tsm ls 2>/dev/null | awk 'NR>1 {print $3}')

    # Game-related process patterns (binary names, not paths)
    local patterns="bin/pulsar|quasar_local|magnetar|game_bridge"

    # Find all game-related processes (exclude grep and claude shells)
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        # Skip Claude shell processes (false positives from command history)
        [[ "$line" == *"claude"* ]] && continue
        [[ "$line" == *"shell-snapshots"* ]] && continue

        local pid=$(echo "$line" | awk '{print $2}')
        local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf $i" "; print ""}')

        # Check if managed by TSM
        local managed=0
        for tsm_pid in "${tsm_pids[@]}"; do
            [[ "$pid" == "$tsm_pid" ]] && { managed=1; break; }
        done

        if ((managed == 0)); then
            orphan_pids+=("$pid")
            orphan_info[$pid]="$cmd"
        fi
    done < <(ps aux | grep -E "$patterns" | grep -v grep)

    if ((${#orphan_pids[@]} == 0)); then
        echo "  [OK] No orphan game processes"
    else
        echo "  [WARN] ${#orphan_pids[@]} orphan process(es) outside TSM:"
        for pid in "${orphan_pids[@]}"; do
            local cmd="${orphan_info[$pid]}"
            # Truncate long commands
            ((${#cmd} > 60)) && cmd="${cmd:0:57}..."
            printf "    PID %-7s %s\n" "$pid" "$cmd"
        done

        if ((kill_orphans)); then
            echo ""
            echo "  Killing orphan processes..."
            for pid in "${orphan_pids[@]}"; do
                if kill "$pid" 2>/dev/null; then
                    echo "    [OK] Killed PID $pid"
                else
                    echo "    [FAIL] Could not kill PID $pid"
                fi
            done
        else
            echo ""
            echo "  To kill orphans: games doctor --kill"
        fi
    fi
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

        # Context (TPS integration)
        ctx|context)
            games_ctx "$@"
            ;;

        # Backup/restore
        pak|pack|backup)
            games_pak "$@"
            ;;
        unpak|unpack|restore)
            games_unpak "$@"
            ;;

        # S3/Remote operations (requires games_sync.sh)
        remote)
            if declare -f games_remote_list >/dev/null 2>&1; then
                games_remote_list "$@"
            else
                echo "Error: games_sync module not loaded" >&2
                return 1
            fi
            ;;
        fetch)
            if declare -f games_fetch >/dev/null 2>&1; then
                games_fetch "$@"
            else
                echo "Error: games_sync module not loaded" >&2
                return 1
            fi
            ;;
        publish)
            if declare -f games_publish >/dev/null 2>&1; then
                games_publish "$@"
            else
                echo "Error: games_sync module not loaded" >&2
                return 1
            fi
            ;;
        pull)
            if declare -f games_pull >/dev/null 2>&1; then
                games_pull "$@"
            else
                echo "Error: games_sync module not loaded" >&2
                return 1
            fi
            ;;
        push)
            if declare -f games_push >/dev/null 2>&1; then
                games_push "$@"
            else
                echo "Error: games_sync module not loaded" >&2
                return 1
            fi
            ;;
        sync)
            if declare -f games_sync >/dev/null 2>&1; then
                games_sync "$@"
            else
                echo "Error: games_sync module not loaded" >&2
                return 1
            fi
            ;;

        # Manifest (S3 games.json)
        manifest)
            if declare -f games_manifest >/dev/null 2>&1; then
                games_manifest "$@"
            else
                echo "Error: games_manifest module not loaded" >&2
                return 1
            fi
            ;;

        # CRUD - Direct manifest manipulation (games.json is source of truth)
        get)
            games_get "$@"
            ;;
        set)
            games_set "$@"
            ;;
        add)
            games_add "$@"
            ;;
        rm|remove)
            games_rm "$@"
            ;;
        import)
            games_import "$@"
            ;;
        access)
            games_access "$@"
            ;;

        # Upload & Deploy (like admin UI)
        upload)
            games_upload "$@"
            ;;
        url)
            games_url "$@"
            ;;
        deploy)
            games_deploy "$@"
            ;;
        deploy-all)
            games_deploy_all "$@"
            ;;
        deploy-status)
            games_deploy_status "$@"
            ;;

        # Preflight / Deploy-readiness
        preflight|check)
            if declare -f games_preflight >/dev/null 2>&1; then
                games_preflight "$@"
            else
                echo "Error: games_preflight module not loaded" >&2
                return 1
            fi
            ;;

        # Config - PJA_CONFIG management
        config|cfg)
            if declare -f games_config >/dev/null 2>&1; then
                games_config "$@"
            else
                echo "Error: games_config module not loaded" >&2
                return 1
            fi
            ;;

        # Diagnostics
        doctor)
            games_doctor "$@"
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
GAMES - Game Management (games.json is source of truth)

USAGE
  games list                     List installed games
  games play <game> [--controls] Play a game
  games info <game>              Show game details
  games org [name]               Show/set active org
  games orgs                     List orgs with games
  games search <query>           Search games across orgs
  games doctor                   Diagnose environment

MANIFEST CRUD (direct editing - like admin UI)
  games get <slug> [field]       Read game or field from manifest
  games set <slug> <field> <val> Set field value
  games add <slug> [options]     Add new game to manifest
  games rm <slug>                Remove game from manifest
  games import <dir>             Import game.toml into manifest
  games access <slug> [opts]     Set access control (--role, --auth)

PREFLIGHT (deploy-readiness)
  games preflight <game>         Validate SDK + lifecycle handlers
  games preflight --all          Validate all games in org
  games preflight <game> --json  Machine-readable output

CONFIG (PJA_CONFIG management)
  games config <game>            Show PJA_CONFIG settings
  games config <game> <key>      Get specific value
  games config <game> <key> <v>  Set value
  games config --list            List games with PJA_CONFIG

UPLOAD & DEPLOY (like admin UI)
  games upload <file.zip>        Upload and extract game ZIP
  games url <slug> [variant]     Test game URL resolution
  games deploy <slug> <host>     Deploy game via SSH
  games deploy-all <host>        Deploy all games
  games deploy-status <host>     Check deployment status

BACKUP/RESTORE
  games pak <game>               Create backup archive
  games unpak <file>             Restore from archive

S3/REMOTE (requires sync module)
  games manifest rebuild         Rebuild games.json from game.toml files
  games manifest list            Show games in manifest
  games push                     Sync manifest to S3
  games pull                     Sync from S3

EXAMPLES
  games add my-game --name "My Game" --role user
  games set my-game version "2.0.0"
  games access my-game --auth --role premium
  games upload my-game_ver-1.0.0.zip --s3
  games deploy my-game user@arcade.example.com
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
export -f games_doctor_main
export -f games_doctor_rename
export -f games_doctor_move
export -f games_doctor_refs
export -f _games_get_org
export -f _games_get_dir

echo "Games module loaded" >&2
