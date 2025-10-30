#!/usr/bin/env bash

# Game Registry System
# Manages available games and active game selection

# Registry of available games
declare -gA GAME_REGISTRY_NAMES=(
    [pulsar]="Pulsar Engine"
    [estoface]="Estoface"
    [formant]="Formant"
    [cornhole-hero]="Cornhole Hero"
    [cheap-golf]="Cheap Golf"
    [grid-ranger]="Grid Ranger"
)

declare -gA GAME_REGISTRY_DESC=(
    [pulsar]="Terminal Sprite Animation System"
    [estoface]="Audio-Visual Synthesis Engine"
    [formant]="Real-time Vocal Synthesis Engine"
    [cornhole-hero]="Arcade cornhole physics game"
    [cheap-golf]="Minimalist golf with trick shots"
    [grid-ranger]="Grid-based action adventure"
)

declare -gA GAME_REGISTRY_STATUS=(
    [pulsar]="ready"
    [estoface]="ready"
    [formant]="ready"
    [cornhole-hero]="skeleton"
    [cheap-golf]="skeleton"
    [grid-ranger]="skeleton"
)

declare -gA GAME_REGISTRY_REPL=(
    [pulsar]="pulsar_game_repl_run"
    [estoface]="estoface_game_repl_run"
    [formant]="formant_game_repl_run"
    [cornhole-hero]="cornhole_hero_game_repl_run"
    [cheap-golf]="cheap_golf_game_repl_run"
    [grid-ranger]="grid_ranger_game_repl_run"
)

declare -gA GAME_REGISTRY_ORG=(
    [pulsar]="tetra"
    [estoface]="tetra"
    [formant]="tetra"
    [cornhole-hero]="pixeljam-arcade"
    [cheap-golf]="pixeljam-arcade"
    [grid-ranger]="pixeljam-arcade"
)

# Game types: bash, tui, html
declare -gA GAME_REGISTRY_TYPE=(
    [pulsar]="bash"
    [estoface]="tui"
    [formant]="bash"
    [cornhole-hero]="tui"
    [cheap-golf]="tui"
    [grid-ranger]="tui"
)

# Help namespaces for tree-based help system
declare -gA GAME_REGISTRY_NAMESPACE=(
    [pulsar]="help.game.pulsar"
    [estoface]="help.game.estoface"
    [formant]="help.game.formant"
    [cornhole-hero]="help.game.cornhole-hero"
    [cheap-golf]="help.game.cheap-golf"
    [grid-ranger]="help.game.grid-ranger"
)

# Binary paths for TUI games (relative to GAME_SRC)
declare -gA GAME_REGISTRY_BINARY=(
    [estoface]="games/estoface/bin/estoface"
    [cornhole-hero]="games/cornhole-hero/bin/cornhole-hero"
    [cheap-golf]="games/cheap-golf/bin/cheap-golf"
    [grid-ranger]="games/grid-ranger/bin/grid-ranger"
)

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

    # Sort alphabetically
    IFS=$'\n' game_list=($(sort <<<"${game_list[*]}"))
    unset IFS

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

# Export functions
export -f game_list game_play game_status game_org game_user
