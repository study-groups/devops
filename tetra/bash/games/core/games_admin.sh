#!/usr/bin/env bash

# Games Admin Module - Core administration functions
# Handles deploy string parsing and game management

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games_admin requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# DEPLOY STRING PARSER
# Format: org:category:env:action
# Examples:
#   pixeljam-arcade:pja-games:prod:list
#   tetra:games:dev:sync
#   pja-games:prod:list  (shorthand - uses GAMES_CTX_ORG)
# =============================================================================

# Parse deploy string into components
# Usage: games_parse_deploy_string "org:category:env:action"
# Sets: GAMES_PARSED_ORG, GAMES_PARSED_CATEGORY, GAMES_PARSED_ENV, GAMES_PARSED_ACTION
games_parse_deploy_string() {
    local deploy_string="$1"

    if [[ -z "$deploy_string" ]]; then
        echo "Error: deploy string required" >&2
        echo "Format: org:category:env:action" >&2
        echo "Example: pixeljam-arcade:pja-games:prod:list" >&2
        return 1
    fi

    # Reset parsed values
    GAMES_PARSED_ORG=""
    GAMES_PARSED_CATEGORY=""
    GAMES_PARSED_ENV=""
    GAMES_PARSED_ACTION=""

    # Split by colon
    IFS=':' read -ra parts <<< "$deploy_string"
    local count=${#parts[@]}

    case $count in
        4)
            # Full format: org:category:env:action
            GAMES_PARSED_ORG="${parts[0]}"
            GAMES_PARSED_CATEGORY="${parts[1]}"
            GAMES_PARSED_ENV="${parts[2]}"
            GAMES_PARSED_ACTION="${parts[3]}"
            ;;
        3)
            # Shorthand: category:env:action (use context org)
            if [[ -z "$GAMES_CTX_ORG" ]]; then
                echo "Error: org required (no org context set)" >&2
                echo "Use: games org:category:env:action" >&2
                return 1
            fi
            GAMES_PARSED_ORG="$GAMES_CTX_ORG"
            GAMES_PARSED_CATEGORY="${parts[0]}"
            GAMES_PARSED_ENV="${parts[1]}"
            GAMES_PARSED_ACTION="${parts[2]}"
            ;;
        *)
            echo "Error: invalid deploy string format" >&2
            echo "Expected: org:category:env:action or category:env:action" >&2
            return 1
            ;;
    esac

    # Validate action
    case "$GAMES_PARSED_ACTION" in
        list|sync|validate|status|pull|push|run|pack|install)
            ;;
        *)
            echo "Error: unknown action '$GAMES_PARSED_ACTION'" >&2
            echo "Valid actions: list, sync, validate, status, pull, push, run, pack, install" >&2
            return 1
            ;;
    esac

    return 0
}

# =============================================================================
# PATH HELPERS
# =============================================================================

# Get games directory for an org
# Usage: games_get_org_dir "pixeljam-arcade"
games_get_org_dir() {
    local org="$1"
    echo "${TETRA_DIR}/orgs/${org}/games"
}

# Get games directory for a category
# Usage: games_get_category_dir "pixeljam-arcade" "pja-games"
games_get_category_dir() {
    local org="$1"
    local category="$2"
    echo "${TETRA_DIR}/orgs/${org}/games/${category}"
}

# Get tetra.toml path for an org
# Usage: games_get_toml_path "pixeljam-arcade"
games_get_toml_path() {
    local org="$1"
    echo "${TETRA_DIR}/orgs/${org}/tetra.toml"
}

# =============================================================================
# LIST COMMAND
# =============================================================================

# List games in a category
# Usage: games_list "pixeljam-arcade" "pja-games"
games_list() {
    local org="$1"
    local category="$2"

    local games_dir
    games_dir=$(games_get_category_dir "$org" "$category")

    if [[ ! -d "$games_dir" ]]; then
        echo "No games directory: $games_dir" >&2
        return 1
    fi

    echo "Games in $org/$category:"
    echo "========================"

    local count=0
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue

        local game_name
        game_name=$(basename "$game_dir")

        # Check validation status
        local status_icon
        if _games_validate_single "$game_dir" "$category" >/dev/null 2>&1; then
            status_icon="[ok]"
        else
            status_icon="[!]"
        fi

        printf "  %-30s %s\n" "$game_name" "$status_icon"
        ((count++))
    done

    if ((count == 0)); then
        echo "  (no games found)"
    fi

    echo ""
    echo "Total: $count games"
}

# =============================================================================
# VALIDATE COMMAND
# =============================================================================

# Validate all games in a category
# Usage: games_validate "pixeljam-arcade" "pja-games"
games_validate() {
    local org="$1"
    local category="$2"

    local games_dir
    games_dir=$(games_get_category_dir "$org" "$category")

    if [[ ! -d "$games_dir" ]]; then
        echo "No games directory: $games_dir" >&2
        return 1
    fi

    echo "Validating $org/$category:"
    echo "=========================="

    local valid=0
    local invalid=0

    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue

        local game_name
        game_name=$(basename "$game_dir")

        local error_msg
        if error_msg=$(_games_validate_single "$game_dir" "$category" 2>&1); then
            printf "  [ok]  %s\n" "$game_name"
            ((valid++))
        else
            printf "  [ERR] %s - %s\n" "$game_name" "$error_msg"
            ((invalid++))
        fi
    done

    echo ""
    echo "Valid: $valid, Invalid: $invalid"

    ((invalid > 0)) && return 1
    return 0
}

# Validate a single game directory
# Usage: _games_validate_single "/path/to/game" "pja-games"
_games_validate_single() {
    local game_dir="$1"
    local category="$2"

    # Get validation type based on category
    local validation_type
    case "$category" in
        pja-games|pja-vector)
            validation_type="html"
            ;;
        tetra|games)
            validation_type="toml"
            ;;
        *)
            validation_type="html"  # Default to HTML
            ;;
    esac

    case "$validation_type" in
        html)
            if [[ ! -f "${game_dir}/index.html" ]]; then
                echo "missing index.html"
                return 1
            fi
            ;;
        toml)
            if [[ ! -f "${game_dir}/game.toml" ]]; then
                echo "missing game.toml"
                return 1
            fi
            ;;
    esac

    return 0
}

# =============================================================================
# STATUS COMMAND
# =============================================================================

# Show status comparing local vs S3
# Usage: games_status "pixeljam-arcade" "pja-games" "prod"
games_status() {
    local org="$1"
    local category="$2"
    local env="$3"

    local games_dir
    games_dir=$(games_get_category_dir "$org" "$category")

    echo "Status: $org/$category ($env)"
    echo "=============================="

    # Count local games
    local local_count=0
    if [[ -d "$games_dir" ]]; then
        for d in "$games_dir"/*/; do
            [[ -d "$d" ]] && ((local_count++))
        done
    fi

    echo "Local games: $local_count"
    echo "Local path:  $games_dir"

    # S3 status requires sync module
    if declare -f games_s3_list >/dev/null 2>&1; then
        echo ""
        echo "S3 status:"
        games_s3_list "$org" "$category" 2>/dev/null || echo "  (S3 not configured)"
    else
        echo "S3 status: (sync module not loaded)"
    fi
}

# =============================================================================
# COMMAND DISPATCHER
# =============================================================================

# Execute a games admin command from deploy string
# Usage: games_admin_dispatch "pixeljam-arcade:pja-games:prod:list"
games_admin_dispatch() {
    local deploy_string="$1"
    shift

    if ! games_parse_deploy_string "$deploy_string"; then
        return 1
    fi

    local org="$GAMES_PARSED_ORG"
    local category="$GAMES_PARSED_CATEGORY"
    local env="$GAMES_PARSED_ENV"
    local action="$GAMES_PARSED_ACTION"

    case "$action" in
        list)
            games_list "$org" "$category"
            ;;
        validate)
            games_validate "$org" "$category"
            ;;
        status)
            games_status "$org" "$category" "$env"
            ;;
        sync)
            if declare -f games_sync >/dev/null 2>&1; then
                games_sync "$org" "$category" "$env" "$@"
            else
                echo "Error: sync module not loaded" >&2
                return 1
            fi
            ;;
        pull)
            if declare -f games_pull >/dev/null 2>&1; then
                games_pull "$org" "$category" "$env" "$@"
            else
                echo "Error: sync module not loaded" >&2
                return 1
            fi
            ;;
        push)
            if declare -f games_push >/dev/null 2>&1; then
                games_push "$org" "$category" "$env" "$@"
            else
                echo "Error: sync module not loaded" >&2
                return 1
            fi
            ;;
        run)
            games_run_game "$org" "$@"
            ;;
        pack)
            games_create_gamepak "$org" "$@"
            ;;
        install)
            if declare -f gamepak_install >/dev/null 2>&1; then
                gamepak_install "$@"
            else
                echo "Error: gamepak module not loaded" >&2
                return 1
            fi
            ;;
        *)
            echo "Error: unhandled action '$action'" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# PLAY GAME
# =============================================================================

# Parse TOML value - extracts quoted string value from "key = "value"" line
# Usage: _games_toml_get "key" "file.toml"
_games_toml_get() {
    local key="$1"
    local file="$2"
    local line value

    line=$(grep -E "^${key}[[:space:]]*=" "$file" 2>/dev/null | head -1)
    [[ -z "$line" ]] && return 1

    # Extract value between quotes
    if [[ "$line" =~ =\"([^\"]+)\" ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    return 1
}

# Play a game by name from an org's games
# Usage: games_play "tetra" "quadrapole"
games_play() {
    local org="$1"
    local game_name="$2"
    shift 2 2>/dev/null || true

    if [[ -z "$game_name" ]]; then
        echo "Error: game name required" >&2
        echo "Usage: games play <game_name>" >&2
        echo "       games play <org> <game_name>" >&2
        return 1
    fi

    # Search in org's games directory
    local games_dir="${TETRA_DIR}/orgs/${org}/games"
    local game_dir=""

    # Direct path check
    if [[ -d "${games_dir}/${game_name}" ]]; then
        game_dir="${games_dir}/${game_name}"
    else
        # Search in subdirectories
        for subdir in "$games_dir"/*/; do
            if [[ -d "${subdir}${game_name}" ]]; then
                game_dir="${subdir}${game_name}"
                break
            fi
        done
    fi

    if [[ -z "$game_dir" || ! -d "$game_dir" ]]; then
        echo "Error: game not found: $game_name" >&2
        echo "Searched in: $games_dir" >&2
        return 1
    fi

    # Check for game.toml
    if [[ ! -f "$game_dir/game.toml" ]]; then
        echo "Error: no game.toml in $game_dir" >&2
        return 1
    fi

    # Parse entry point from game.toml
    local entry
    entry=$(_games_toml_get "entry" "$game_dir/game.toml") || entry="${game_name}.sh"

    local entry_file="$game_dir/$entry"
    if [[ ! -f "$entry_file" ]]; then
        echo "Error: entry file not found: $entry_file" >&2
        return 1
    fi

    # Get engine from game.toml
    local engine
    engine=$(_games_toml_get "engine" "$game_dir/game.toml") || engine="unknown"

    # Load engine if specified
    case "$engine" in
        flax)
            [[ -f "$GAMES_SRC/engines/flax/flax.sh" ]] && source "$GAMES_SRC/engines/flax/flax.sh"
            ;;
        tui)
            [[ -f "$GAMES_SRC/engines/tui/tui.sh" ]] && source "$GAMES_SRC/engines/tui/tui.sh"
            ;;
    esac

    echo "Playing: $game_name (engine: $engine)"

    # Source game
    source "$entry_file"

    # Try standard entry points
    if declare -f game_run >/dev/null 2>&1; then
        game_run "$@"
    elif declare -f "${game_name}_run" >/dev/null 2>&1; then
        "${game_name}_run" "$@"
    elif declare -f main >/dev/null 2>&1; then
        main "$@"
    else
        echo "Error: no entry point function found (tried: game_run, ${game_name}_run, main)" >&2
        return 1
    fi
}

# Alias for backwards compatibility
games_run_game() {
    games_play "$@"
}

# =============================================================================
# CREATE GAMEPAK
# =============================================================================

# Create a gamepak from an org's games
# Usage: games_create_gamepak "tetra" [output_file]
games_create_gamepak() {
    local org="$1"
    local output="$2"

    local games_dir="${TETRA_DIR}/orgs/${org}/games"

    if [[ ! -d "$games_dir" ]]; then
        echo "Error: no games directory for org: $org" >&2
        return 1
    fi

    # Create temp directory with gamepak structure
    local tmpdir
    tmpdir=$(mktemp -d)
    mkdir -p "$tmpdir/games"

    # Copy games (only those with game.toml)
    local count=0
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        [[ -f "$game_dir/game.toml" ]] || continue

        local game_name
        game_name=$(basename "$game_dir")
        cp -r "$game_dir" "$tmpdir/games/"
        ((count++))
    done

    if ((count == 0)); then
        echo "Error: no valid games found in $games_dir" >&2
        rm -rf "$tmpdir"
        return 1
    fi

    # Create manifest.toml
    cat > "$tmpdir/manifest.toml" << EOF
[gamepak]
name = "${org}-games"
version = "1.0.0"
author = "$org"
description = "Games collection from $org"
EOF

    # Add games to manifest
    for game_dir in "$tmpdir/games"/*/; do
        [[ -d "$game_dir" ]] || continue
        local game_name
        game_name=$(basename "$game_dir")

        # Parse game info
        local game_toml="$game_dir/game.toml"
        local name entry engine
        name=$(grep -E '^name\s*=' "$game_toml" 2>/dev/null | sed 's/.*=\s*"\(.*\)"/\1/' || echo "$game_name")
        entry=$(grep -E '^entry\s*=' "$game_toml" 2>/dev/null | sed 's/.*=\s*"\(.*\)"/\1/' || echo "${game_name}.sh")
        engine=$(grep -E '^engine\s*=' "$game_toml" 2>/dev/null | sed 's/.*=\s*"\(.*\)"/\1/' || echo "flax")

        cat >> "$tmpdir/manifest.toml" << EOF

[[games]]
id = "$game_name"
name = "$name"
engine = "$engine"
entry = "$entry"
EOF
    done

    # Default output filename
    if [[ -z "$output" ]]; then
        output="${org}-games.gamepak.tar.gz"
    fi

    echo "Creating gamepak: $output"
    echo "  Org: $org"
    echo "  Games: $count"

    # Create tarball
    tar -czf "$output" -C "$tmpdir" manifest.toml games/

    rm -rf "$tmpdir"

    if [[ -f "$output" ]]; then
        echo "Created: $output"
        ls -lh "$output"
    else
        echo "Error creating gamepak" >&2
        return 1
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_play
export -f games_run_game
export -f _games_toml_get
export -f games_create_gamepak
export -f games_parse_deploy_string
export -f games_get_org_dir
export -f games_get_category_dir
export -f games_get_toml_path
export -f games_list
export -f games_validate
export -f games_status
export -f games_admin_dispatch
export -f _games_validate_single
