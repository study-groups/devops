#!/usr/bin/env bash

# Estoface REPL - Interactive Audio-Visual Synthesis Shell
# Skeleton implementation
# Uses unified bash/repl system

# Source dependencies
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$TETRA_SRC/bash/tree/help.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/game/estoface_repl_history"
ESTOFACE_REPL_OUTPUT_LOG="$TETRA_DIR/game/estoface_repl_output.log"

# REPL State
ESTOFACE_REPL_ENGINE_RUNNING=0

# ============================================================================
# ENGINE MANAGEMENT (Stub)
# ============================================================================

estoface_repl_start_engine() {
    echo ""
    text_color "66FFFF"
    echo "🔊 ESTOFACE ENGINE v0.1 (Skeleton)"
    reset_color
    echo ""
    text_color "FFAA00"
    echo "  ⚠️  Engine not yet implemented"
    reset_color
    echo "  📋 This is a skeleton structure"
    echo ""
}

estoface_repl_status() {
    echo ""
    text_color "666666"
    echo "  🏗️  Estoface Status: Skeleton"
    reset_color
    echo "  └─ Engine: Not implemented"
    echo ""
}

# ============================================================================
# HELP SYSTEM (using bash/tree + tab completion)
# ============================================================================

# Source the comprehensive help tree
source "$TETRA_SRC/bash/game/games/estoface/estoface_help.sh"
source "$TETRA_SRC/bash/tree/complete.sh"

# Compact help for :: command mode (tight, near prompt)
estoface_repl_show_help() {
    local topic="${1:-estoface}"

    # Normalize topic
    if [[ "$topic" == "estoface" ]]; then
        topic="help.estoface"
    elif [[ "$topic" != help.* ]]; then
        topic="help.estoface.$topic"
    fi

    # Check if exists
    if ! tree_exists "$topic"; then
        echo "Unknown: $1 (try TAB)"
        return 1
    fi

    local title=$(tree_get "$topic" "title")
    local help_text=$(tree_get "$topic" "help")
    local detail=$(tree_get "$topic" "detail")
    local width="${COLUMNS:-80}"
    local content_width=$((width - 4))

    # Compact display
    echo ""
    text_color "00AAFF"
    echo "■ $title"
    reset_color

    [[ -n "$help_text" ]] && echo "$help_text" | fold -s -w "$content_width" | sed 's/^/  /'
    [[ -n "$detail" ]] && echo "" && echo "$detail" | head -5 | fold -s -w "$content_width" | sed 's/^/  /'

    # Show subtopics as table (left-aligned, 4 col right padding)
    local children
    children=$(tree_children "$topic")
    if [[ -n "$children" ]]; then
        echo ""
        text_color "00FF88"
        echo "Topics (TAB):"
        reset_color
        for child in $children; do
            local leaf="${child##*.}"
            local child_help=$(tree_get "$child" "help")
            printf "  "
            text_color "00FF88"
            printf "%-14s" "$leaf"
            reset_color
            text_color "AAAAAA"
            echo "$child_help" | fold -s -w $((content_width - 16)) | head -1
            reset_color
        done
    fi
    echo ""
}

# Export help function
export -f estoface_repl_show_help

# ============================================================================
# TAB COMPLETION (via unified tree system)
# ============================================================================

# Note: Tab completion is handled by the unified tree system
# No custom readline bindings needed - tree_repl_enable_completion handles it

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_estoface_repl_build_prompt() {
    local status_symbol="🏗️"
    local status_color="666666"

    if [[ "$ESTOFACE_REPL_ENGINE_RUNNING" == "1" ]]; then
        status_symbol="🔊"
        status_color="0088FF"
    fi

    # Build prompt
    local tmpfile
    tmpfile=$(mktemp /tmp/estoface_repl_prompt.XXXXXX) || return 1

    printf "%s%s%s " "$(text_color "$status_color")" "$status_symbol" "$(reset_color)" > "$tmpfile"
    printf "%sestoface%s" "$(text_color "FFFFFF")" "$(reset_color)" >> "$tmpfile"
    printf " %s▶%s " "$(text_color "FFAA00")" "$(reset_color)" >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_estoface_repl_process_input() {
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
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        # Help system
        help|h|\?)
            estoface_repl_show_help "${cmd_args[1]}"
            ;;

        # Engine control
        start)
            estoface_repl_start_engine
            ;;
        stop)
            estoface_repl_stop_engine
            ;;
        restart)
            estoface_repl_stop_engine
            estoface_repl_start_engine
            ;;
        status|st)
            estoface_repl_status
            ;;

        # Mode control
        mode)
            if [[ -n "${cmd_args[1]}" ]]; then
                ESTOFACE_REPL_MODE="${cmd_args[1]}"
                echo "Mode: $ESTOFACE_REPL_MODE"
            else
                echo "Current: $ESTOFACE_REPL_MODE"
                echo "Available: idle, perform, record"
            fi
            ;;

        # Placeholder commands
        show)
            echo "Show grid: Not yet implemented"
            echo "See: help gamepad.grid"
            ;;
        record)
            echo "Record: Not yet implemented"
            echo "See: help testing"
            ;;
        play)
            echo "Playback: Not yet implemented"
            ;;

        # Unknown
        *)
            echo "Unknown: $cmd (try 'help' or TAB)"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT - Uses Standard REPL Pattern
# ============================================================================

estoface_game_repl_run() {
    echo ""
    text_color "00AAFF"
    echo "⚡ ESTOFACE REPL v0.1"
    reset_color
    echo ""
    echo "Facial animation + speech synthesis via bash commands"
    echo "Type 'help' or TAB for topics | 'quit' to exit"
    echo ""
    text_color "AAAAAA"
    echo "Note: C binary (TUI) is separate: ./bin/estoface"
    reset_color
    echo ""

    # Set cleanup handler
    trap 'estoface_repl_stop_engine 2>/dev/null' EXIT

    # Override REPL callbacks with estoface-specific implementations
    repl_build_prompt() { _estoface_repl_build_prompt "$@"; }
    repl_process_input() { _estoface_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Enable tree-based tab completion for estoface namespace
    if command -v tree_repl_enable_completion >/dev/null 2>&1; then
        source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"
        tree_repl_enable_completion "help.estoface"
    fi

    # Run unified REPL loop
    repl_run

    # Cleanup
    if command -v tree_repl_disable_completion >/dev/null 2>&1; then
        tree_repl_disable_completion
    fi
    unset -f repl_build_prompt repl_process_input

    echo ""
    text_color "00AAFF"
    echo "⚡ Goodbye"
    reset_color
    echo ""
}

# Export main function
export -f estoface_game_repl_run
