#!/usr/bin/env bash

# PixelJam Arcade Game REPL - Universal REPL for all PJA games
# Handles: cornhole-hero, cheap-golf, grid-ranger

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/game/pja_game_repl_history"
PJA_GAME_REPL_OUTPUT_LOG="$TETRA_DIR/game/pja_game_repl_output.log"

# REPL State
PJA_GAME_REPL_ENGINE_RUNNING=0
PJA_GAME_REPL_CURRENT_GAME=""

# ============================================================================
# GAME METADATA
# ============================================================================

declare -A PJA_GAME_EMOJI=(
    [cornhole-hero]="🎯"
    [cheap-golf]="⛳"
    [grid-ranger]="🎮"
)

declare -A PJA_GAME_TITLE=(
    [cornhole-hero]="CORNHOLE HERO"
    [cheap-golf]="CHEAP GOLF"
    [grid-ranger]="GRID RANGER"
)

declare -A PJA_GAME_DESC=(
    [cornhole-hero]="Arcade Cornhole Physics"
    [cheap-golf]="Minimalist Golf with Tricks"
    [grid-ranger]="Grid-Based Action Adventure"
)

# ============================================================================
# ENGINE MANAGEMENT (Stub)
# ============================================================================

pja_game_repl_start_engine() {
    local game="$PJA_GAME_REPL_CURRENT_GAME"
    local emoji="${PJA_GAME_EMOJI[$game]}"
    local title="${PJA_GAME_TITLE[$game]}"

    echo ""
    local header="$emoji $title ENGINE v0.1 (Skeleton)"
    local width=$((${#header} - 1 + ${#emoji}))  # Adjust for emoji
    tds_panel_header "$header" "$width"
    echo ""
    text_color "FFAA00"
    echo "  ⚠️  Engine not yet implemented"
    reset_color
    echo "  📋 This is a skeleton structure"
    echo ""
}

pja_game_repl_status() {
    local game="$PJA_GAME_REPL_CURRENT_GAME"

    echo ""
    text_color "666666"
    echo "  🏗️  ${PJA_GAME_TITLE[$game]} Status: Skeleton"
    reset_color
    echo "  └─ Engine: Not implemented"
    echo ""
}

# ============================================================================
# HELP SYSTEM (Stub)
# ============================================================================

pja_game_repl_show_help() {
    local game="$PJA_GAME_REPL_CURRENT_GAME"
    local emoji="${PJA_GAME_EMOJI[$game]}"
    local title="${PJA_GAME_TITLE[$game]}"
    local desc="${PJA_GAME_DESC[$game]}"

    echo ""
    text_color "8888FF"
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    printf "║  %s %s - %s (Skeleton)" "$emoji" "$title" "$desc"
    # Pad to 70 chars
    local line="$emoji $title - $desc (Skeleton)"
    local padding=$((68 - ${#line}))
    printf "%${padding}s║\n" ""
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    reset_color
    echo ""
    text_color "FFAA00"
    echo "⚠️  This is a skeleton implementation"
    reset_color
    echo ""
    echo "PLANNED COMMANDS:"

    case "$game" in
        cornhole-hero)
            echo "  start              Start the game engine (not implemented)"
            echo "  throw              Launch a bag (not implemented)"
            echo "  power              Set throw power (not implemented)"
            echo "  angle              Set throw angle (not implemented)"
            ;;
        cheap-golf)
            echo "  start              Start the game engine (not implemented)"
            echo "  swing              Hit the ball (not implemented)"
            echo "  power              Set swing power (not implemented)"
            echo "  aim                Set aim direction (not implemented)"
            echo "  hole               Load a hole/course (not implemented)"
            ;;
        grid-ranger)
            echo "  start              Start the game engine (not implemented)"
            echo "  move               Move character (not implemented)"
            echo "  action             Perform action (not implemented)"
            echo "  inventory          Show inventory (not implemented)"
            echo "  map                Show map (not implemented)"
            ;;
    esac

    echo "  status             Show game status"
    echo "  help               Show this help"
    echo "  quit               Exit REPL"
    echo ""
    text_color "666666"
    echo "This game is under development. Part of PixelJam Arcade collection."
    reset_color
    echo ""
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_pja_game_repl_build_prompt() {
    local game="$PJA_GAME_REPL_CURRENT_GAME"
    local status_symbol="🏗️"
    local status_color="666666"

    if [[ "$PJA_GAME_REPL_ENGINE_RUNNING" == "1" ]]; then
        status_symbol="${PJA_GAME_EMOJI[$game]}"
        status_color="0088FF"
    fi

    # Build prompt
    local tmpfile
    tmpfile=$(mktemp /tmp/pja_game_repl_prompt.XXXXXX) || return 1

    printf "%s%s%s " "$(text_color "$status_color")" "$status_symbol" "$(reset_color)" > "$tmpfile"
    printf "%s%s%s" "$(text_color "FFFFFF")" "$game" "$(reset_color)" >> "$tmpfile"
    printf " %s▶%s " "$(text_color "FFAA00")" "$(reset_color)" >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_pja_game_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Exit commands
    case "$input" in
        exit|quit|q)
            return 1
            ;;
        help|h|\?)
            pja_game_repl_show_help
            return 0
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        start)
            pja_game_repl_start_engine
            ;;
        status)
            pja_game_repl_status
            ;;
        *)
            text_color "FFAA00"
            echo "⚠️  Command not implemented: $cmd"
            reset_color
            echo "   This is a skeleton. Type 'help' for info."
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINTS (one per game)
# ============================================================================

cornhole_hero_game_repl_run() {
    PJA_GAME_REPL_CURRENT_GAME="cornhole-hero"
    _pja_game_repl_run
}

cheap_golf_game_repl_run() {
    PJA_GAME_REPL_CURRENT_GAME="cheap-golf"
    _pja_game_repl_run
}

grid_ranger_game_repl_run() {
    PJA_GAME_REPL_CURRENT_GAME="grid-ranger"
    _pja_game_repl_run
}

# ============================================================================
# SHARED REPL LOOP
# ============================================================================

_pja_game_repl_run() {
    local game="$PJA_GAME_REPL_CURRENT_GAME"
    local emoji="${PJA_GAME_EMOJI[$game]}"
    local title="${PJA_GAME_TITLE[$game]}"

    echo ""
    # Use TDS panel header (+1 for emoji width)
    local header="$emoji $title REPL v0.1 (Skeleton)"
    local width=$((${#header} - 1 + ${#emoji}))
    tds_panel_header "$header" "$width"
    echo ""
    text_color "FFAA00"
    echo "⚠️  Skeleton implementation - engine not yet built"
    reset_color
    echo "Type 'help' for planned features"
    echo ""

    # Register prompt builder
    REPL_PROMPT_BUILDERS=(_pja_game_repl_build_prompt)

    # Run REPL loop
    while true; do
        # Build prompt
        _pja_game_repl_build_prompt

        # Read input
        read -e -p "$REPL_PROMPT" input

        # Add to history
        [[ -n "$input" ]] && history -s "$input"

        # Process input
        _pja_game_repl_process_input "$input" || break

        echo ""
    done

    echo ""
    text_color "0088FF"
    echo "Goodbye! $emoji"
    reset_color
    echo ""
}

# Export main functions
export -f cornhole_hero_game_repl_run cheap_golf_game_repl_run grid_ranger_game_repl_run
