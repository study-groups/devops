#!/usr/bin/env bash

# Game Registry System
# Manages available games and active game selection
#
# Uses nginx-style available/enabled pattern:
#   available/  - All game implementations
#   enabled/    - Symlinks to active games
#
# To enable:  ln -s ../available/gamename enabled/gamename
# To disable: rm enabled/gamename

# ============================================================================
# REGISTRY ARRAYS (populated by _game_registry_scan)
# ============================================================================

declare -gA GAME_REGISTRY_NAMES=()
declare -gA GAME_REGISTRY_DESC=()
declare -gA GAME_REGISTRY_STATUS=()
declare -gA GAME_REGISTRY_REPL=()
declare -gA GAME_REGISTRY_ORG=()
declare -gA GAME_REGISTRY_TYPE=()
declare -gA GAME_REGISTRY_NAMESPACE=()
declare -gA GAME_REGISTRY_BINARY=()
declare -gA GAME_REGISTRY_PATH=()
declare -gA GAME_REGISTRY_REPL_FILE=()

# ============================================================================
# STATIC REGISTRY (games not in available/ - e.g., external orgs)
# ============================================================================

_game_registry_static() {
    # PixelJam Arcade games (skeleton implementations)
    GAME_REGISTRY_NAMES[cornhole-hero]="Cornhole Hero"
    GAME_REGISTRY_DESC[cornhole-hero]="Arcade cornhole physics game"
    GAME_REGISTRY_STATUS[cornhole-hero]="skeleton"
    GAME_REGISTRY_REPL[cornhole-hero]="cornhole_hero_game_repl_run"
    GAME_REGISTRY_ORG[cornhole-hero]="pixeljam-arcade"
    GAME_REGISTRY_TYPE[cornhole-hero]="tui"
    GAME_REGISTRY_NAMESPACE[cornhole-hero]="help.game.cornhole-hero"

    GAME_REGISTRY_NAMES[cheap-golf]="Cheap Golf"
    GAME_REGISTRY_DESC[cheap-golf]="Minimalist golf with trick shots"
    GAME_REGISTRY_STATUS[cheap-golf]="skeleton"
    GAME_REGISTRY_REPL[cheap-golf]="cheap_golf_game_repl_run"
    GAME_REGISTRY_ORG[cheap-golf]="pixeljam-arcade"
    GAME_REGISTRY_TYPE[cheap-golf]="tui"
    GAME_REGISTRY_NAMESPACE[cheap-golf]="help.game.cheap-golf"

    GAME_REGISTRY_NAMES[grid-ranger]="Grid Ranger"
    GAME_REGISTRY_DESC[grid-ranger]="Grid-based action adventure"
    GAME_REGISTRY_STATUS[grid-ranger]="skeleton"
    GAME_REGISTRY_REPL[grid-ranger]="grid_ranger_game_repl_run"
    GAME_REGISTRY_ORG[grid-ranger]="pixeljam-arcade"
    GAME_REGISTRY_TYPE[grid-ranger]="tui"
    GAME_REGISTRY_NAMESPACE[grid-ranger]="help.game.grid-ranger"
}

# ============================================================================
# DYNAMIC REGISTRY SCANNER
# ============================================================================
# Scans enabled/ for symlinks to game dirs containing game.toml
# Structure:
#   available/gamename/game.toml
#   enabled/gamename -> ../available/gamename

_game_registry_scan() {
    local enabled_dir="$GAME_SRC/enabled"

    [[ ! -d "$enabled_dir" ]] && return 0

    for game_link in "$enabled_dir"/*; do
        [[ ! -L "$game_link" ]] && continue  # Only symlinks

        local game_id=$(basename "$game_link")
        local game_dir=$(readlink -f "$game_link")
        local toml_file="$game_dir/game.toml"

        [[ ! -f "$toml_file" ]] && continue  # Must have game.toml

        # Parse TOML
        local name=$(grep -E '^name\s*=' "$toml_file" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)
        local desc=$(grep -E '^description\s*=' "$toml_file" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)
        local type=$(grep -E '^type\s*=' "$toml_file" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)
        local org=$(grep -E '^org\s*=' "$toml_file" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)
        local repl=$(grep -E '^repl\s*=' "$toml_file" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)

        GAME_REGISTRY_NAMES[$game_id]="${name:-${game_id^}}"
        GAME_REGISTRY_DESC[$game_id]="${desc:-No description}"
        GAME_REGISTRY_TYPE[$game_id]="${type:-bash}"
        GAME_REGISTRY_ORG[$game_id]="${org:-tetra}"
        GAME_REGISTRY_PATH[$game_id]="$game_dir"
        GAME_REGISTRY_REPL_FILE[$game_id]="${repl:-${game_id}_repl.sh}"
        GAME_REGISTRY_STATUS[$game_id]="ready"
        GAME_REGISTRY_REPL[$game_id]="${game_id}_game_repl_run"
        GAME_REGISTRY_NAMESPACE[$game_id]="help.game.$game_id"

        # Set binary path for TUI games
        if [[ "$type" == "tui" ]]; then
            GAME_REGISTRY_BINARY[$game_id]="$game_dir/bin/$game_id"
        fi
    done
}

# ============================================================================
# INITIALIZE REGISTRY
# ============================================================================

_game_registry_init() {
    # Load static entries first (external orgs, skeletons)
    _game_registry_static

    # Scan enabled/ for dynamic entries (overrides static)
    _game_registry_scan
}

# Run initialization
_game_registry_init

# Current active state
GAME_ACTIVE=""
GAME_ACTIVE_USER="${GAME_ACTIVE_USER:-guest}"
GAME_ACTIVE_ORG="${GAME_ACTIVE_ORG:-tetra}"

# Get per-org game data directory
game_get_org_game_dir() {
    local org="${1:-$GAME_ACTIVE_ORG}"
    local gamename="${2}"

    if [[ -n "$gamename" ]]; then
        echo "$TETRA_DIR/orgs/$org/games/$gamename"
    else
        echo "$TETRA_DIR/orgs/$org/games"
    fi
}

# User management (with subcommands)
game_user() {
    local subcommand="$1"
    local arg="$2"

    if [[ -z "$subcommand" ]]; then
        echo ""
        text_color "66FFFF"
        echo "👤 Current User: $GAME_ACTIVE_USER"
        reset_color
        echo ""
        echo "Usage:"
        echo "  user <name>        - Switch to existing user"
        echo "  user new <name>    - Create new provisional account"
        echo "  user list          - List all user accounts"
        echo "  user status <name> - Show user account details"
        echo ""
        return 0
    fi

    case "$subcommand" in
        new)
            game_user_new "$arg"
            ;;
        list)
            game_user_list
            ;;
        status)
            game_user_show_status "$arg"
            ;;
        *)
            # Assume it's a username to switch to
            GAME_ACTIVE_USER="$subcommand"

            echo ""
            text_color "00AA00"
            echo "✓ User set to: $subcommand"
            reset_color
            echo ""
            ;;
    esac
}

# Create new provisional user account (with MSC visualization)
game_user_new() {
    local name="$1"
    local debug_msc="${DEBUG_MSC:-false}"

    # Source dependencies
    source "$GAME_SRC/core/user_system.sh"
    source "$GAME_SRC/core/api_client.sh"

    if [[ -z "$name" ]]; then
        echo ""
        text_color "FF0000"
        echo "❌ No username provided"
        reset_color
        echo ""
        echo "Usage: user new <name>"
        echo ""
        return 1
    fi

    # Initialize MSC if available and debug enabled
    local msc_enabled=false
    if [[ "$debug_msc" == "true" ]] && declare -f msc_init &>/dev/null; then
        msc_enabled=true
        msc_init "User" "REPL" "UserSystem" "Validator" "Database" "API" "Server"
        msc_message "User" "REPL" "user new $name"
    fi

    echo ""
    text_color "66FFFF"
    echo "📝 Creating Provisional Account"
    reset_color
    echo "════════════════════════════════════════════════════════"
    echo ""

    # Step 1: Validation
    [[ "$msc_enabled" == "true" ]] && msc_message "REPL" "UserSystem" "game_user_new($name)"
    [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "Validator" "validate_username($name)"

    if ! game_user_validate_name "$name"; then
        [[ "$msc_enabled" == "true" ]] && msc_message "Validator" "UserSystem" "ERROR: Invalid name"
        [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "REPL" "validation_failed"
        [[ "$msc_enabled" == "true" ]] && msc_message "REPL" "User" "❌ Validation failed"
        [[ "$msc_enabled" == "true" ]] && echo "" && msc_render
        return 1
    fi

    if game_user_exists "$name"; then
        echo "❌ Username '$name' already exists"
        [[ "$msc_enabled" == "true" ]] && msc_message "Validator" "UserSystem" "ERROR: Name exists"
        [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "REPL" "collision_detected"
        [[ "$msc_enabled" == "true" ]] && msc_message "REPL" "User" "❌ User exists"
        [[ "$msc_enabled" == "true" ]] && echo "" && msc_render
        return 1
    fi

    [[ "$msc_enabled" == "true" ]] && msc_message "Validator" "UserSystem" "OK"

    echo "  ✓ Username valid: $name"

    # Step 2: Create local user record
    [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "Database" "write_user_record()"
    [[ "$msc_enabled" == "true" ]] && msc_note "Database" "Writing TOML to disk"

    local user_id
    user_id=$(game_user_create_provisional "$name" "$GAME_ACTIVE_ORG")
    local create_exit_code=$?

    if [[ $create_exit_code -ne 0 ]]; then
        echo "❌ Failed to create user record"
        [[ "$msc_enabled" == "true" ]] && msc_message "Database" "UserSystem" "ERROR: Write failed"
        [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "REPL" "creation_failed"
        [[ "$msc_enabled" == "true" ]] && msc_message "REPL" "User" "❌ Creation failed"
        [[ "$msc_enabled" == "true" ]] && echo "" && msc_render
        return 1
    fi

    [[ "$msc_enabled" == "true" ]] && msc_message "Database" "UserSystem" "OK (ID: $user_id)"

    echo "  ✓ User record created (ID: $user_id)"

    # Step 3: Call pbase-2600 for token dispensing
    [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "API" "POST /token/dispense"

    local pbase_response
    pbase_response=$(pbase_create_user_integrated "$name" "provisional" "$GAME_ACTIVE_ORG" 2>&1)
    local pbase_exit_code=$?

    if [[ $pbase_exit_code -ne 0 ]]; then
        echo "  ⚠️  pbase-2600 unavailable - local-only mode"
        [[ "$msc_enabled" == "true" ]] && msc_note "API" "pbase-2600 offline"
        [[ "$msc_enabled" == "true" ]] && msc_message "API" "UserSystem" "ERROR: Unavailable"
    else
        [[ "$msc_enabled" == "true" ]] && msc_message "API" "Server" "HTTP POST /token/dispense"
        [[ "$msc_enabled" == "true" ]] && msc_message "Server" "API" "200 OK + tokens dispensed"
        [[ "$msc_enabled" == "true" ]] && msc_message "API" "UserSystem" "token_data"
        echo "  ✓ Tokens dispensed (100 starting tokens)"
    fi

    [[ "$msc_enabled" == "true" ]] && msc_message "UserSystem" "REPL" "success (ID: $user_id)"

    # Success!
    echo ""
    text_color "00AA00"
    echo "✓ Created provisional account: $name"
    reset_color
    echo ""
    text_color "AAAAAA"
    echo "  User ID: $user_id"
    echo "  Type: provisional"
    echo "  Expires: 30 days"
    echo "  Org: $GAME_ACTIVE_ORG"
    reset_color
    echo ""

    # Switch to new user
    GAME_ACTIVE_USER="$name"

    [[ "$msc_enabled" == "true" ]] && msc_message "REPL" "User" "✓ Account created"

    # Render MSC if enabled
    if [[ "$msc_enabled" == "true" ]]; then
        echo ""
        text_color "8888FF"
        echo "═══ Message Sequence Chart ═══"
        reset_color
        echo ""
        msc_render

        # Save MSC to log
        local msc_log="$GAME_DIR/logs/msc_$(date +%s).txt"
        mkdir -p "$(dirname "$msc_log")"
        {
            echo "MSC: User Creation Flow"
            echo "User: $name"
            echo "Timestamp: $(date)"
            echo ""
            msc_render
        } > "$msc_log"

        text_color "666666"
        echo "MSC saved to: $msc_log"
        reset_color
        echo ""
    fi
}

# List all available games (optionally filtered by org)
game_list() {
    local filter_org="${1:-$GAME_ACTIVE_ORG}"
    local show_all_orgs=false

    if [[ "$filter_org" == "all" ]]; then
        show_all_orgs=true
    fi

    echo ""
    text_color "66FFFF"
    if [[ "$show_all_orgs" == "true" ]]; then
        echo "⚡ Available Games (All Organizations)"
    else
        echo "⚡ Available Games (Organization: $filter_org)"
    fi
    reset_color
    echo ""

    # Collect and sort games
    local -a game_list=()
    for game_id in "${!GAME_REGISTRY_NAMES[@]}"; do
        local game_org="${GAME_REGISTRY_ORG[$game_id]}"

        # Filter by org unless "all"
        if [[ "$show_all_orgs" == "false" && "$game_org" != "$filter_org" ]]; then
            continue
        fi

        game_list+=("$game_id")
    done

    # Sort alphabetically (use readarray to avoid IFS issues)
    local sorted_games=()
    readarray -t sorted_games < <(printf '%s\n' "${game_list[@]}" | sort)
    game_list=("${sorted_games[@]}")

    # Display games
    for game_id in "${game_list[@]}"; do
        local game_org="${GAME_REGISTRY_ORG[$game_id]}"
        local name="${GAME_REGISTRY_NAMES[$game_id]}"
        local desc="${GAME_REGISTRY_DESC[$game_id]}"
        local status="${GAME_REGISTRY_STATUS[$game_id]}"
        local game_type="${GAME_REGISTRY_TYPE[$game_id]:-bash}"

        # Status icon and color
        local status_icon="✓"
        local status_color="00AA00"  # Green
        case "$status" in
            skeleton)
                status_icon="○"
                status_color="FFAA00"  # Orange
                ;;
            wip)
                status_icon="◐"
                status_color="0088FF"  # Blue
                ;;
            ready)
                status_icon="✓"
                status_color="00AA00"  # Green
                ;;
        esac

        # Type badge
        local type_badge=""
        case "$game_type" in
            bash)
                type_badge="$(text_color "8888FF")[bash]$(reset_color)"
                ;;
            tui)
                type_badge="$(text_color "00FFAA")[TUI]$(reset_color) "
                ;;
            html)
                type_badge="$(text_color "FF8800")[HTML]$(reset_color)"
                ;;
        esac

        # Only show org badge if showing all orgs
        if [[ "$show_all_orgs" == "true" ]]; then
            text_color "666666"
            printf "  [%-15s] " "$game_org"
            reset_color
        else
            printf "  "
        fi

        # Game ID (orange)
        text_color "FFAA00"
        printf "%-15s" "$game_id"
        reset_color

        # Status indicator
        text_color "$status_color"
        printf " %s " "$status_icon"
        reset_color

        # Type badge
        printf "%b " "$type_badge"

        # Name and description
        text_color "FFFFFF"
        printf "%-20s" "$name"
        reset_color
        text_color "AAAAAA"
        printf "%s" "$desc"
        reset_color

        echo ""
    done

    echo ""
    text_color "666666"
    if [[ "$show_all_orgs" == "false" ]]; then
        echo "Commands: 'play <game>' | 'ls all' (show all orgs)"
    else
        echo "Commands: 'play <game>' | 'org <name>' (switch org)"
    fi
    reset_color
    echo ""
}

# Select and launch a game
game_play() {
    local game_id="$1"
    local launch_mode="${2:---binary}"  # --binary (default) or --repl

    if [[ -z "$game_id" ]]; then
        echo ""
        text_color "FF0000"
        echo "❌ No game specified"
        reset_color
        echo ""
        echo "Usage: play <game> [--repl]"
        echo ""
        game_list
        return 1
    fi

    # Check if game exists
    if [[ -z "${GAME_REGISTRY_NAMES[$game_id]}" ]]; then
        echo ""
        text_color "FF0000"
        echo "❌ Unknown game: $game_id"
        reset_color
        echo ""
        game_list
        return 1
    fi

    # Check if game is ready
    local status="${GAME_REGISTRY_STATUS[$game_id]}"
    if [[ "$status" == "skeleton" ]]; then
        echo ""
        text_color "FFAA00"
        echo "⚠️  $game_id is not yet implemented (skeleton only)"
        reset_color
        echo ""
        return 1
    fi

    # Set active game
    GAME_ACTIVE="$game_id"

    local game_type="${GAME_REGISTRY_TYPE[$game_id]:-bash}"

    # Handle TUI games with direct binary launch
    if [[ "$game_type" == "tui" && "$launch_mode" == "--binary" ]]; then
        local binary_path="${GAME_REGISTRY_BINARY[$game_id]}"
        local full_binary_path="$GAME_SRC/$binary_path"

        # Check if binary exists
        if [[ ! -f "$full_binary_path" ]]; then
            echo ""
            text_color "FF0000"
            echo "❌ Binary not found: $full_binary_path"
            reset_color
            echo "   Try building the game first or use 'play $game_id --repl' for bash REPL"
            echo ""
            GAME_ACTIVE=""
            return 1
        fi

        echo ""
        text_color "00AA00"
        echo "▶ Launching ${GAME_REGISTRY_NAMES[$game_id]}..."
        reset_color
        echo ""
        text_color "66FFFF"
        echo "Exiting REPL and running binary:"
        reset_color
        text_color "AAAAAA"
        echo "  $full_binary_path"
        reset_color
        echo ""

        # Launch the binary
        "$full_binary_path"
        local exit_code=$?

        # Return to game REPL after binary exits
        echo ""
        text_color "66FFFF"
        echo "Binary exited (code: $exit_code)"
        reset_color
        echo ""

        # Launch game-specific REPL for post-game interaction
        local repl_func="${GAME_REGISTRY_REPL[$game_id]}"
        if declare -f "$repl_func" &>/dev/null; then
            "$repl_func"
        fi
    else
        # Launch game REPL (for bash games or TUI games with --repl flag)
        local repl_func="${GAME_REGISTRY_REPL[$game_id]}"
        if declare -f "$repl_func" &>/dev/null; then
            echo ""
            text_color "00AA00"
            echo "▶ Launching ${GAME_REGISTRY_NAMES[$game_id]} REPL..."
            reset_color
            echo ""
            "$repl_func"
        else
            echo ""
            text_color "FF0000"
            echo "❌ Game REPL function not found: $repl_func"
            reset_color
            echo ""
            GAME_ACTIVE=""
            return 1
        fi
    fi

    # Clear active game when done
    GAME_ACTIVE=""
}

# Show current active game
game_status() {
    echo ""
    text_color "66FFFF"
    echo "⚡ Game Session Status"
    reset_color
    echo "═══════════════════════════════════════"
    echo ""

    text_color "AAAAAA"
    echo "  Organization: "
    reset_color
    text_color "FFFFFF"
    echo "$GAME_ACTIVE_ORG"
    reset_color

    text_color "AAAAAA"
    echo "  Player:       "
    reset_color
    text_color "FFFFFF"
    echo "$GAME_ACTIVE_USER"
    reset_color

    if [[ -n "$GAME_ACTIVE" ]]; then
        text_color "AAAAAA"
        echo "  Active Game:  "
        reset_color
        text_color "00AA00"
        echo "${GAME_REGISTRY_NAMES[$GAME_ACTIVE]} ($GAME_ACTIVE)"
        reset_color
    else
        text_color "AAAAAA"
        echo "  Active Game:  "
        reset_color
        text_color "666666"
        echo "None (in lobby)"
        reset_color
    fi

    echo ""
}

# Switch organization
game_org() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        echo ""
        text_color "FF0000"
        echo "❌ No organization specified"
        reset_color
        echo ""
        echo "Available organizations:"
        echo "  tetra           - Core Tetra games"
        echo "  pixeljam-arcade - PixelJam Arcade games"
        echo ""
        echo "Usage: org <name>"
        echo ""
        return 1
    fi

    # Validate org exists in registry
    local org_exists=false
    for game_id in "${!GAME_REGISTRY_ORG[@]}"; do
        if [[ "${GAME_REGISTRY_ORG[$game_id]}" == "$org_name" ]]; then
            org_exists=true
            break
        fi
    done

    if [[ "$org_exists" == "false" ]]; then
        echo ""
        text_color "FF0000"
        echo "❌ Unknown organization: $org_name"
        reset_color
        echo ""
        echo "Available organizations: tetra, pixeljam-arcade"
        echo ""
        return 1
    fi

    GAME_ACTIVE_ORG="$org_name"

    echo ""
    text_color "00AA00"
    echo "✓ Switched to organization: $org_name"
    reset_color
    echo ""

    # Show games for this org
    game_list "$org_name"
}

# ============================================================================
# ENABLE/DISABLE GAMES
# ============================================================================

# List available games (in available/ but not enabled/)
game_available() {
    local available_dir="$GAME_SRC/available"
    local enabled_dir="$GAME_SRC/enabled"

    echo ""
    text_color "66FFFF"
    echo "Available Games (not currently enabled)"
    reset_color
    echo ""

    local found=false
    for game_path in "$available_dir"/*; do
        [[ ! -d "$game_path" ]] && continue
        [[ ! -f "$game_path/game.toml" ]] && continue

        local game_id=$(basename "$game_path")

        # Skip if already enabled
        [[ -L "$enabled_dir/$game_id" ]] && continue

        found=true
        text_color "FFAA00"
        printf "  %-15s" "$game_id"
        reset_color

        local desc=$(grep -E '^description\s*=' "$game_path/game.toml" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)
        text_color "AAAAAA"
        printf "%s" "${desc:-No description}"
        reset_color
        echo ""
    done

    if [[ "$found" == "false" ]]; then
        text_color "666666"
        echo "  All available games are enabled"
        reset_color
    fi

    echo ""
    echo "Usage: enable <game>  - Enable a game"
    echo ""
}

# Enable a game (create symlink to dir)
game_enable() {
    local game_id="$1"
    local available_dir="$GAME_SRC/available"
    local enabled_dir="$GAME_SRC/enabled"

    if [[ -z "$game_id" ]]; then
        game_available
        return 1
    fi

    if [[ ! -d "$available_dir/$game_id" ]]; then
        text_color "FF0000"
        echo "Game not found: $game_id"
        reset_color
        game_available
        return 1
    fi

    if [[ -L "$enabled_dir/$game_id" ]]; then
        text_color "FFAA00"
        echo "Game already enabled: $game_id"
        reset_color
        return 0
    fi

    ln -s "../available/$game_id" "$enabled_dir/$game_id"

    # Re-scan registry
    _game_registry_scan

    text_color "00AA00"
    echo "Enabled: $game_id"
    reset_color
    echo "Note: Restart REPL to load game's REPL functions"
}

# Disable a game (remove symlink)
game_disable() {
    local game_id="$1"
    local enabled_dir="$GAME_SRC/enabled"

    if [[ -z "$game_id" ]]; then
        echo ""
        text_color "66FFFF"
        echo "Currently Enabled Games"
        reset_color
        echo ""
        for link in "$enabled_dir"/*; do
            [[ -L "$link" ]] && echo "  $(basename "$link")"
        done
        echo ""
        echo "Usage: disable <game>  - Disable a game"
        echo ""
        return 1
    fi

    if [[ ! -L "$enabled_dir/$game_id" ]]; then
        text_color "FF0000"
        echo "Game not enabled: $game_id"
        reset_color
        return 1
    fi

    rm "$enabled_dir/$game_id"

    # Remove from registry
    unset "GAME_REGISTRY_NAMES[$game_id]"
    unset "GAME_REGISTRY_DESC[$game_id]"
    unset "GAME_REGISTRY_STATUS[$game_id]"
    unset "GAME_REGISTRY_REPL[$game_id]"
    unset "GAME_REGISTRY_ORG[$game_id]"
    unset "GAME_REGISTRY_TYPE[$game_id]"
    unset "GAME_REGISTRY_NAMESPACE[$game_id]"
    unset "GAME_REGISTRY_BINARY[$game_id]"
    unset "GAME_REGISTRY_PATH[$game_id]"
    unset "GAME_REGISTRY_REPL_FILE[$game_id]"

    text_color "00AA00"
    echo "Disabled: $game_id"
    reset_color
}

# Export functions
export -f game_list game_play game_status game_org game_user game_enable game_disable game_available
