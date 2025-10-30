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
# ENGINE MANAGEMENT AND TUI BINARY LAUNCH
# ============================================================================

# Launch the TUI binary
estoface_repl_run_binary() {
    local binary_path="$GAME_SRC/games/estoface/bin/estoface"

    if [[ ! -f "$binary_path" ]]; then
        echo ""
        text_color "FF0000"
        echo "❌ Binary not found: $binary_path"
        reset_color
        echo "   Try building the game first: cd games/estoface && make"
        echo ""
        return 1
    fi

    echo ""
    text_color "00FFAA"
    echo "⚡ Launching Estoface TUI..."
    reset_color
    echo ""
    text_color "66FFFF"
    echo "Exiting REPL and running binary:"
    reset_color
    text_color "AAAAAA"
    echo "  $binary_path"
    reset_color
    echo ""

    # Launch the binary
    "$binary_path"
    local exit_code=$?

    echo ""
    text_color "66FFFF"
    echo "Binary exited (code: $exit_code)"
    reset_color
    echo ""
}

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

estoface_repl_stop_engine() {
    echo ""
    text_color "AAAAAA"
    echo "  🛑 Engine stopped (stub)"
    reset_color
    echo ""
}

estoface_repl_status() {
    echo ""
    text_color "00FFAA"
    echo "  🏗️  Estoface Status"
    reset_color
    echo "  ├─ Type: TUI Binary + Bash REPL"
    echo "  ├─ Binary: games/estoface/bin/estoface"
    echo "  └─ REPL: Commands for config, test, script"
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

        # TUI Binary Launch
        run|play)
            estoface_repl_run_binary
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

        # Configuration commands
        config)
            echo ""
            text_color "00FFAA"
            echo "⚙️  Configuration"
            reset_color
            echo "  Available settings:"
            echo "    • Display: Width, Height, FPS"
            echo "    • Audio: Sample Rate, Buffer Size"
            echo "    • Controls: Gamepad mapping"
            echo ""
            echo "  Note: Configuration not yet implemented"
            echo "  See: help config"
            echo ""
            ;;

        setup)
            echo ""
            text_color "00FFAA"
            echo "🔧 Setup & Configuration"
            reset_color
            echo "  Game setup wizard (not yet implemented)"
            echo "  See: help setup"
            echo ""
            ;;

        # Testing & Development
        test)
            echo ""
            text_color "8888FF"
            echo "🧪 Test Mode"
            reset_color
            echo "  Available tests:"
            echo "    • Rendering: Frame timing, sprite updates"
            echo "    • Audio: Formant synthesis, phoneme playback"
            echo "    • Input: Gamepad calibration"
            echo ""
            echo "  Note: Testing not yet implemented"
            echo "  See: help testing"
            echo ""
            ;;

        debug)
            echo ""
            text_color "8888FF"
            echo "🐛 Debug Mode"
            reset_color
            echo "  Debug utilities:"
            echo "    • Logging: Verbose output, trace"
            echo "    • Profiling: Performance metrics"
            echo "    • Memory: Allocation tracking"
            echo ""
            echo "  Note: Debugging not yet implemented"
            echo "  See: help debug"
            echo ""
            ;;

        # Scripting & Automation
        script)
            local script_file="${cmd_args[1]}"
            echo ""
            text_color "FFAA00"
            echo "📜 Script Mode"
            reset_color
            if [[ -n "$script_file" ]]; then
                echo "  Loading script: $script_file"
                echo "  Note: Scripting not yet implemented"
            else
                echo "  Usage: script <file>"
                echo "  Load and execute estoface command script"
            fi
            echo "  See: help script"
            echo ""
            ;;

        record)
            echo ""
            text_color "FF0088"
            echo "⏺️  Record Mode"
            reset_color
            echo "  Recording features:"
            echo "    • Sequence: Record animation sequences"
            echo "    • Performance: Record gameplay"
            echo "    • Audio: Record phoneme samples"
            echo ""
            echo "  Note: Recording not yet implemented"
            echo "  See: help testing.record"
            echo ""
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

        # Display commands
        show)
            echo "Show grid: Not yet implemented"
            echo "See: help gamepad.grid"
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
    # Register module
    repl_register_module "estoface" "run play config setup test debug script record status" "help.game.estoface"
    repl_set_module_context "estoface"

    echo ""
    text_color "00AAFF"
    echo "⚡ ESTOFACE REPL v0.2"
    reset_color
    echo ""
    text_color "FFFFFF"
    echo "Facial animation + speech synthesis"
    reset_color
    text_color "AAAAAA"
    echo "  • Type 'run' or 'play' to launch the TUI binary"
    echo "  • Type 'help' for bash REPL commands"
    echo "  • Type 'quit' to return to game lobby"
    reset_color
    echo ""
    text_color "00FFAA"
    echo "Commands: run, config, test, debug, script, record, status"
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
