#!/usr/bin/env bash

# Games Config Module - Read/write PJA_CONFIG in game startup.js files
#
# Convention: Games have a startup.js file with PJA_CONFIG:
#   // PJA Startup Config - game-name
#   // Auto-managed by: games config <game> <key> <value>
#   const PJA_CONFIG = {
#       initialVolume: 0.5,
#   };
#
# Usage:
#   games config <game>                     Show all config
#   games config <game> <key>               Get specific value
#   games config <game> <key> <value>       Set value
#   games config --list                     List games with startup.js
#   games config --init <game>              Create startup.js for game

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games_config requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

# Get game directory
_config_get_game_dir() {
    local game="$1"
    local org=$(_games_get_org)
    local game_dir="${TETRA_DIR}/orgs/${org}/games/${game}"

    if [[ ! -d "$game_dir" ]]; then
        echo "Game not found: $game" >&2
        return 1
    fi

    echo "$game_dir"
}

# Get startup.js path for a game
_config_get_startup() {
    local game="$1"
    local game_dir
    game_dir=$(_config_get_game_dir "$game") || return 1
    echo "${game_dir}/startup.js"
}

# Check if game has startup.js
_config_has_startup() {
    local game="$1"
    local startup
    startup=$(_config_get_startup "$game") 2>/dev/null || return 1
    [[ -f "$startup" ]]
}

# Get a specific config value from startup.js
_config_get_value() {
    local startup="$1"
    local key="$2"

    if [[ ! -f "$startup" ]]; then
        return 1
    fi

    # Extract value for key (handles numbers, strings, booleans)
    grep -E "^[[:space:]]*${key}:" "$startup" | head -1 | sed -E 's/.*:[[:space:]]*([^,]+),?.*/\1/' | tr -d ' '
}

# Set a config value in startup.js
_config_set_value() {
    local startup="$1"
    local key="$2"
    local value="$3"

    if [[ ! -f "$startup" ]]; then
        echo "Error: startup.js not found: $startup" >&2
        echo "Create it with: games config --init <game>" >&2
        return 1
    fi

    # Check if key exists
    if grep -qE "^[[:space:]]*${key}:" "$startup"; then
        # Update existing key - preserve comments
        sed -i '' -E "s/^([[:space:]]*${key}:)[[:space:]]*[0-9.]+/\1 ${value}/" "$startup"
        echo "Updated: ${key} = ${value}"
    else
        # Add new key before closing brace
        sed -i '' "/^};/i\\
\\    ${key}: ${value},
" "$startup"
        echo "Added: ${key} = ${value}"
    fi
}

# Create startup.js for a game
_config_init() {
    local game="$1"
    local game_dir
    game_dir=$(_config_get_game_dir "$game") || return 1

    local startup="${game_dir}/startup.js"

    if [[ -f "$startup" ]]; then
        echo "startup.js already exists: $startup"
        cat "$startup"
        return 0
    fi

    cat > "$startup" << EOF
// PJA Startup Config - ${game}
// Auto-managed by: games config <game> <key> <value>
const PJA_CONFIG = {
    initialVolume: 0.5,
};
EOF

    echo "Created: $startup"
    echo ""
    echo "Add to index.html:"
    echo '  <script src="startup.js"></script>'
    echo ""
    echo "Reference in game code:"
    echo '  player.volume = PJA_CONFIG.initialVolume;'
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

games_config() {
    local game=""
    local key=""
    local value=""
    local list_mode=false
    local init_mode=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --list|-l)
                list_mode=true
                ;;
            --init|-i)
                init_mode=true
                ;;
            --help|-h)
                _config_help
                return 0
                ;;
            -*)
                echo "Unknown option: $1" >&2
                return 1
                ;;
            *)
                if [[ -z "$game" ]]; then
                    game="$1"
                elif [[ -z "$key" ]]; then
                    key="$1"
                else
                    value="$1"
                fi
                ;;
        esac
        shift
    done

    # List mode: show all games with startup.js
    if $list_mode; then
        _config_list_all
        return $?
    fi

    # Need a game name for other operations
    if [[ -z "$game" ]]; then
        _config_help
        return 1
    fi

    # Init mode: create startup.js
    if $init_mode; then
        _config_init "$game"
        return $?
    fi

    local startup
    startup=$(_config_get_startup "$game") || return 1

    # No key: show all config
    if [[ -z "$key" ]]; then
        _config_show "$game" "$startup"
        return $?
    fi

    # Key but no value: get value
    if [[ -z "$value" ]]; then
        local val
        val=$(_config_get_value "$startup" "$key")
        if [[ -n "$val" ]]; then
            echo "$val"
        else
            echo "Key not found: $key" >&2
            return 1
        fi
        return 0
    fi

    # Key and value: set value
    _config_set_value "$startup" "$key" "$value"
}

# Show all config for a game
_config_show() {
    local game="$1"
    local startup="$2"

    echo "PJA_CONFIG for $game:"
    echo ""

    if [[ ! -f "$startup" ]]; then
        echo "  (no startup.js found)"
        echo ""
        echo "Create with: games config --init $game"
        return 1
    fi

    cat "$startup" | sed 's/^/  /'
    echo ""
    echo "File: $startup"
}

# List all games with startup.js
_config_list_all() {
    local org=$(_games_get_org)
    local games_dir="${TETRA_DIR}/orgs/${org}/games"

    echo "Games with startup.js in $org:"
    echo ""
    printf "  %-25s %s\n" "GAME" "initialVolume"
    printf "  %-25s %s\n" "----" "-------------"

    local found=0
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        local game=$(basename "$game_dir")
        local startup="${game_dir}/startup.js"

        if [[ -f "$startup" ]]; then
            local vol=$(_config_get_value "$startup" "initialVolume")
            [[ -z "$vol" ]] && vol="-"
            printf "  %-25s %s\n" "$game" "$vol"
            ((found++))
        fi
    done

    echo ""
    echo "Found: $found game(s) with startup.js"

    if ((found == 0)); then
        echo ""
        echo "Create startup.js for a game:"
        echo "  games config --init <game>"
    fi
}

# Help text
_config_help() {
    cat << 'EOF'
GAMES CONFIG - Read/write PJA_CONFIG in startup.js

USAGE
  games config <game>                 Show all PJA_CONFIG settings
  games config <game> <key>           Get specific value
  games config <game> <key> <value>   Set value

OPTIONS
  --init, -i <game>       Create startup.js for a game
  --list, -l              List all games with startup.js
  --help, -h              Show this help

FILE FORMAT (startup.js)
  // PJA Startup Config - game-name
  // Auto-managed by: games config <game> <key> <value>
  const PJA_CONFIG = {
      initialVolume: 0.5,
  };

EXAMPLES
  games config gamma-bros                    # Show config
  games config gamma-bros initialVolume      # Get volume
  games config gamma-bros initialVolume 0.3  # Set to 30%
  games config --init my-game                # Create startup.js
  games config --list                        # List configured games

SETUP
  1. Create startup.js:  games config --init <game>
  2. Add to index.html:  <script src="startup.js"></script>
  3. Use in game code:   player.volume = PJA_CONFIG.initialVolume;

COMMON SETTINGS
  initialVolume    0.0-1.0   Volume level on game load
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_config
export -f _config_get_game_dir
export -f _config_get_startup
export -f _config_has_startup
export -f _config_get_value
export -f _config_set_value
export -f _config_init
export -f _config_show
export -f _config_list_all
export -f _config_help
