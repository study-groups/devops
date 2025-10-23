#!/usr/bin/env bash

# Game REPL - Main launcher for game selection and play
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

# Load game registry
source "$GAME_SRC/core/game_registry.sh"

# Load org-specific game REPLs
# Tetra org games (native implementations)
source "$GAME_SRC/games/pulsar/pulsar_repl.sh"
source "$GAME_SRC/games/estovox/core/estovox_repl.sh"

# PixelJam Arcade org (single REPL for all PJA games)
source "$GAME_SRC/orgs/pixeljam-arcade/pja_game_repl.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/game/game_repl_history"

# ============================================================================
# PROMPT BUILDER (org-style)
# ============================================================================

_game_repl_build_prompt() {
    # Build prompt: [org x user x game] >
    # Similar to org REPL: [org x env x mode] action>

    local tmpfile
    tmpfile=$(mktemp /tmp/game_repl_prompt.XXXXXX) || return 1

    # Opening bracket (colored)
    text_color "$REPL_BRACKET"
    printf '[' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Organization
    text_color "$REPL_ORG_ACTIVE"
    printf '%s' "${GAME_ACTIVE_ORG:-tetra}" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Separator (colored)
    text_color "$REPL_SEPARATOR"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # User
    if [[ -n "$GAME_ACTIVE_USER" ]]; then
        text_color "$REPL_ENV_LOCAL"
        printf '%s' "$GAME_ACTIVE_USER" >> "$tmpfile"
    else
        text_color "$REPL_ORG_INACTIVE"
        printf 'none' >> "$tmpfile"
    fi
    reset_color >> "$tmpfile"

    # Separator (colored)
    text_color "$REPL_SEPARATOR"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Game
    if [[ -n "$GAME_ACTIVE" ]]; then
        text_color "$REPL_ENV_DEV"  # Green for active game
        printf '%s' "$GAME_ACTIVE" >> "$tmpfile"
    else
        text_color "$REPL_ORG_INACTIVE"
        printf 'lobby' >> "$tmpfile"
    fi
    reset_color >> "$tmpfile"

    # Closing bracket (colored)
    text_color "$REPL_BRACKET"
    printf '] ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Prompt arrow (colored)
    text_color "$REPL_ARROW"
    printf '> ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# HELP SYSTEM
# ============================================================================

game_repl_show_help() {
    echo ""
    text_color "66FFFF"
    echo "⚡ GAME REPL"
    reset_color
    echo "═══════════════════════════════════════"
    echo ""

    text_color "8888FF"
    echo "GAME MANAGEMENT:"
    reset_color
    echo "  $(text_color "FFAA00")ls$(reset_color)                 List games for current organization"
    echo "  $(text_color "FFAA00")ls all$(reset_color)             List games for all organizations"
    echo "  $(text_color "FFAA00")play <game>$(reset_color)        Launch a game"
    echo "  $(text_color "FFAA00")org <name>$(reset_color)         Switch organization"
    echo "  $(text_color "FFAA00")status$(reset_color)             Show current session status"
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
    echo "  $(text_color "FFFFFF")tetra$(reset_color)              Core Tetra games (pulsar, estovox)"
    echo "  $(text_color "FFFFFF")pixeljam-arcade$(reset_color)    PixelJam Arcade games"
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
    echo "  $(text_color "FFAA00")org pixeljam-arcade$(reset_color)  # Switch to PixelJam games"
    echo "  $(text_color "FFAA00")ls$(reset_color)                   # List games for current org"
    echo "  $(text_color "FFAA00")play cornhole-hero$(reset_color)   # Launch Cornhole Hero"
    echo ""
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_game_repl_process_input() {
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
            game_repl_show_help
            return 0
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        ls|list)
            # ls [all] - list games (optionally all orgs)
            game_list "${cmd_args[1]}"
            ;;
        play)
            game_play "${cmd_args[1]}"
            ;;
        org)
            game_org "${cmd_args[1]}"
            ;;
        user)
            # Pass all args to game_user (handles subcommands like 'new')
            game_user "${cmd_args[@]:1}"
            ;;
        status)
            game_status
            ;;
        *)
            text_color "FF0000"
            echo "❌ Unknown command: $cmd"
            reset_color
            echo "   Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

game_repl_run() {
    echo ""
    # Use TDS panel header
    # Note: TDS doesn't handle emoji width correctly yet, so adjust width by +1
    tds_panel_header "⚡ GAME REPL v1.0" 51
    echo ""
    text_color "AAAAAA"
    echo "Type 'ls' to see available games, 'help' for commands"
    reset_color
    echo ""

    # Register prompt builder
    REPL_PROMPT_BUILDERS=(_game_repl_build_prompt)

    # Run REPL loop
    while true; do
        # Build prompt
        _game_repl_build_prompt

        # Read input
        read -e -p "$REPL_PROMPT" input

        # Add to history
        [[ -n "$input" ]] && history -s "$input"

        # Process input
        _game_repl_process_input "$input" || break

        echo ""
    done

    echo ""
    text_color "66FFFF"
    echo "Goodbye! ⚡"
    reset_color
    echo ""
}

# Export main function
export -f game_repl_run
