#!/usr/bin/env bash

# Games REPL - Main launcher for game selection and play
# Provides org-style prompt showing active game and user

# Source dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Load TDS for borders
TDS_SRC="${TETRA_SRC}/bash/tds"
if [[ -f "$TDS_SRC/layout/borders.sh" ]]; then
    source "$TDS_SRC/core/ansi.sh"
    source "$TDS_SRC/layout/borders.sh"
fi

# Load games registry
source "$ENGINE_SRC/core/game_registry.sh"

# ============================================================================
# DYNAMIC GAME LOADING (nginx-style available/enabled pattern)
# ============================================================================
# Structure:
#   available/gamename/game.toml   - Game with metadata
#   enabled/gamename -> ../available/gamename  - Symlink enables game

_games_load_enabled() {
    local enabled_dir="$ENGINE_SRC/../enabled"

    [[ ! -d "$enabled_dir" ]] && return 0

    for game_link in "$enabled_dir"/*; do
        [[ ! -L "$game_link" ]] && continue

        local game_id=$(basename "$game_link")
        local game_dir=$(readlink -f "$game_link")
        local toml_file="$game_dir/game.toml"

        [[ ! -f "$toml_file" ]] && continue

        # Parse repl path from TOML
        local repl=$(grep -E '^repl\s*=' "$toml_file" | sed 's/.*=\s*"\(.*\)"/\1/' | head -1)
        local repl_file="$game_dir/${repl:-${game_id}_repl.sh}"

        if [[ -f "$repl_file" ]]; then
            source "$repl_file"
        fi
    done
}

# Load all enabled games
_games_load_enabled

# PixelJam Arcade org (single REPL for all PJA games)
# Note: This path may not exist after refactoring - skip if missing
if [[ -f "$GAMES_SRC/orgs/pixeljam-arcade/pja_game_repl.sh" ]]; then
    source "$GAMES_SRC/orgs/pixeljam-arcade/pja_game_repl.sh"
fi

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/games/games_repl_history"

# ============================================================================
# PROMPT BUILDER (org-style)
# ============================================================================

_games_repl_build_prompt() {
    # Build prompt: [org x user x game] >
    # Similar to org REPL: [org x env x mode] action>

    local tmpfile
    tmpfile=$(mktemp /tmp/games_repl_prompt.XXXXXX) || return 1

    # Opening bracket (colored)
    text_color "$REPL_BRACKET" >> "$tmpfile"
    printf '[' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Organization
    text_color "$REPL_ORG_ACTIVE" >> "$tmpfile"
    printf '%s' "${GAME_ACTIVE_ORG:-tetra}" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Separator (colored)
    text_color "$REPL_SEPARATOR" >> "$tmpfile"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # User
    if [[ -n "$GAME_ACTIVE_USER" ]]; then
        text_color "$REPL_ENV_LOCAL" >> "$tmpfile"
        printf '%s' "$GAME_ACTIVE_USER" >> "$tmpfile"
    else
        text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"
        printf 'none' >> "$tmpfile"
    fi
    reset_color >> "$tmpfile"

    # Separator (colored)
    text_color "$REPL_SEPARATOR" >> "$tmpfile"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Game
    if [[ -n "$GAME_ACTIVE" ]]; then
        text_color "$REPL_ENV_DEV" >> "$tmpfile"  # Green for active game
        printf '%s' "$GAME_ACTIVE" >> "$tmpfile"
    else
        text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"
        printf 'lobby' >> "$tmpfile"
    fi
    reset_color >> "$tmpfile"

    # Closing bracket (colored)
    text_color "$REPL_BRACKET" >> "$tmpfile"
    printf '] ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Prompt arrow (colored)
    text_color "$REPL_ARROW" >> "$tmpfile"
    printf '> ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# HELP SYSTEM
# ============================================================================

games_repl_show_help() {
    echo ""
    text_color "66FFFF"
    echo "GAMES REPL"
    reset_color
    echo "========================================="
    echo ""

    text_color "8888FF"
    echo "GAME MANAGEMENT:"
    reset_color
    echo "  $(text_color "FFAA00")ls$(reset_color)                 List enabled games for current org"
    echo "  $(text_color "FFAA00")ls all$(reset_color)             List enabled games for all orgs"
    echo "  $(text_color "FFAA00")play <game>$(reset_color)        Launch a game (TUI games launch binary)"
    echo "  $(text_color "FFAA00")play <game> --repl$(reset_color) Launch game's bash REPL instead of binary"
    echo "  $(text_color "FFAA00")org <name>$(reset_color)         Switch organization"
    echo "  $(text_color "FFAA00")status$(reset_color)             Show current session status"
    echo ""

    text_color "8888FF"
    echo "ENABLE/DISABLE (nginx-style):"
    reset_color
    echo "  $(text_color "FFAA00")available$(reset_color)          List games available to enable"
    echo "  $(text_color "FFAA00")enable <game>$(reset_color)      Enable a game (symlink to enabled/)"
    echo "  $(text_color "FFAA00")disable <game>$(reset_color)     Disable a game (remove symlink)"
    echo ""

    text_color "8888FF"
    echo "USER MANAGEMENT:"
    reset_color
    echo "  $(text_color "FFAA00")user$(reset_color)               Show current user"
    echo "  $(text_color "FFAA00")user <name>$(reset_color)        Switch to user"
    echo "  $(text_color "FFAA00")user new <name>$(reset_color)    Create provisional account"
    echo "  $(text_color "FFAA00")user list$(reset_color)          List all user accounts"
    echo "  $(text_color "FFAA00")user status <name>$(reset_color) Show user account details"
    echo ""

    text_color "8888FF"
    echo "ORGANIZATIONS:"
    reset_color
    echo "  $(text_color "FFFFFF")tetra$(reset_color)              Core Tetra games (pulsar, estovox, formant)"
    echo "  $(text_color "FFFFFF")pixeljam-arcade$(reset_color)    PixelJam Arcade games"
    echo ""

    text_color "8888FF"
    echo "GAME TYPES:"
    reset_color
    echo "  $(text_color "8888FF")[bash]$(reset_color)             Pure bash games (pulsar, formant)"
    echo "  $(text_color "00FFAA")[TUI]$(reset_color)              Binary TUI games with bash REPL (estoface)"
    echo "  $(text_color "FF8800")[HTML]$(reset_color)             Web/browser games (future)"
    echo ""

    text_color "8888FF"
    echo "UTILITY:"
    reset_color
    echo "  $(text_color "FFAA00")help, h, ?$(reset_color)         Show this help"
    echo "  $(text_color "FFAA00")quit, exit, q$(reset_color)      Exit REPL"
    echo ""

    text_color "666666"
    echo "The prompt shows: [org x user x game]"
    echo "  org   - Current organization"
    echo "  user  - Current player name"
    echo "  game  - Active game (or 'lobby' if none)"
    reset_color
    echo ""

    text_color "666666"
    echo "Examples:"
    reset_color
    echo "  $(text_color "FFAA00")ls$(reset_color)                      # List games for current org"
    echo "  $(text_color "FFAA00")play estoface$(reset_color)           # Launch Estoface TUI binary"
    echo "  $(text_color "FFAA00")play estoface --repl$(reset_color)    # Enter Estoface bash REPL"
    echo "  $(text_color "FFAA00")play pulsar$(reset_color)             # Launch Pulsar bash REPL"
    echo "  $(text_color "FFAA00")org pixeljam-arcade$(reset_color)     # Switch to PixelJam games"
    echo ""
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_games_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Exit commands
    case "$input" in
        exit|quit|q)
            return 1
            ;;
        help|h|\?)
            games_repl_show_help
            return 0
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        ls|list)
            # ls [all] - list games (optionally all orgs)
            games_list "${cmd_args[1]}"
            ;;
        play)
            # play <game> [--repl] - launch game (binary or REPL)
            games_play "${cmd_args[1]}" "${cmd_args[2]}"
            ;;
        org)
            games_org "${cmd_args[1]}"
            ;;
        user)
            # Pass all args to games_user (handles subcommands like 'new')
            games_user "${cmd_args[@]:1}"
            ;;
        status)
            games_status
            ;;
        available)
            games_available
            ;;
        enable)
            games_enable "${cmd_args[1]}"
            ;;
        disable)
            games_disable "${cmd_args[1]}"
            ;;
        *)
            text_color "FF0000"
            echo "Unknown command: $cmd"
            reset_color
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

games_repl_run() {
    echo ""
    text_color "66FFFF"
    echo "GAMES REPL v1.0"
    reset_color
    echo ""
    text_color "AAAAAA"
    echo "Type 'ls' to see available games, 'help' for commands"
    reset_color
    echo ""

    # Register prompt builder
    REPL_PROMPT_BUILDERS=(_games_repl_build_prompt)

    # Run REPL loop
    while true; do
        # Build prompt
        _games_repl_build_prompt

        # Read input
        read -e -p "$REPL_PROMPT" input

        # Add to history
        [[ -n "$input" ]] && history -s "$input"

        # Process input
        _games_repl_process_input "$input" || break

        echo ""
    done

    echo ""
    text_color "66FFFF"
    echo "Goodbye!"
    reset_color
    echo ""
}

# Export main function
export -f games_repl_run
