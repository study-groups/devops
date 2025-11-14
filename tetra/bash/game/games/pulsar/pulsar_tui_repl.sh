#!/usr/bin/env bash
# Pulsar TUI REPL - Split-screen interface with real-time animation + REPL
# Combines C engine rendering with TUI/REPL for interactive control

set -euo pipefail

# Source dependencies
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/tui/tui.sh"
source "$TETRA_SRC/bash/tui/integration/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Game-specific modules
PULSAR_GAME_SRC="$GAME_SRC/games/pulsar"
source "$PULSAR_GAME_SRC/pulsar.sh"
source "$PULSAR_GAME_SRC/pulsar_help.sh"

# ============================================================================
# STATE
# ============================================================================

declare -g PULSAR_TUI_RUNNING=true
declare -g PULSAR_TUI_ANIMATION_AREA_HEIGHT=0
declare -g PULSAR_TUI_REPL_AREA_HEIGHT=8
declare -g PULSAR_TUI_GRID_W=160
declare -g PULSAR_TUI_GRID_H=96
declare -A PULSAR_TUI_SPRITE_IDS  # name -> id mapping

# ============================================================================
# LAYOUT CALCULATION
# ============================================================================

calc_layout() {
    local total_height=$(tui_screen_height)
    local total_width=$(tui_screen_width)

    # REPL area at bottom (fixed height)
    PULSAR_TUI_REPL_AREA_HEIGHT=8

    # Animation area gets the rest
    PULSAR_TUI_ANIMATION_AREA_HEIGHT=$((total_height - PULSAR_TUI_REPL_AREA_HEIGHT))
}

# ============================================================================
# ENGINE MANAGEMENT
# ============================================================================

start_pulsar_engine() {
    if pulsar_running; then
        repl_set_response "Engine already running"
        return 0
    fi

    # Start engine with current grid size
    if pulsar_start "$PULSAR_TUI_GRID_W" "$PULSAR_TUI_GRID_H" 2>/dev/null; then
        repl_set_response "✓ Engine started (PID: $_PULSAR_PID)"
        return 0
    else
        repl_set_response "✗ Failed to start engine"
        return 1
    fi
}

stop_pulsar_engine() {
    if ! pulsar_running; then
        repl_set_response "Engine not running"
        return 0
    fi

    pulsar_stop 2>/dev/null || true
    PULSAR_TUI_SPRITE_IDS=()
    repl_set_response "✓ Engine stopped"
}

# ============================================================================
# COMMAND PROCESSOR
# ============================================================================

process_pulsar_command() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"

    case "$cmd" in
        start)
            start_pulsar_engine
            ;;
        stop)
            stop_pulsar_engine
            ;;
        restart)
            stop_pulsar_engine
            start_pulsar_engine
            ;;
        status)
            if pulsar_running; then
                repl_set_response "Engine: Running (PID: $_PULSAR_PID) | Grid: ${PULSAR_TUI_GRID_W}×${PULSAR_TUI_GRID_H} | Sprites: ${#PULSAR_TUI_SPRITE_IDS[@]}"
            else
                repl_set_response "Engine: Stopped"
            fi
            ;;
        spawn)
            if ! pulsar_running; then
                repl_set_response "✗ Engine not running. Use 'start' first."
                return 1
            fi

            local name="${cmd_args[1]}"
            local params=("${cmd_args[@]:2}")

            if [[ ${#params[@]} -lt 7 ]]; then
                repl_set_response "✗ Usage: spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>"
                return 1
            fi

            local spawn_cmd="SPAWN_PULSAR ${params[*]}"
            pulsar_cmd "$spawn_cmd"
            local response=$(pulsar_read_response)

            if [[ "$response" =~ ^ID[[:space:]]([0-9]+) ]]; then
                local id="${BASH_REMATCH[1]}"
                PULSAR_TUI_SPRITE_IDS[$name]=$id
                repl_set_response "✓ Spawned '$name' → ID $id"
            else
                repl_set_response "✗ $response"
            fi
            ;;
        set)
            if ! pulsar_running; then
                repl_set_response "✗ Engine not running"
                return 1
            fi

            local target="${cmd_args[1]}"
            local key="${cmd_args[2]}"
            local value="${cmd_args[3]}"

            # Resolve name to ID
            local id="$target"
            if [[ -n "${PULSAR_TUI_SPRITE_IDS[$target]:-}" ]]; then
                id="${PULSAR_TUI_SPRITE_IDS[$target]}"
            fi

            pulsar_cmd "SET $id $key $value"
            local response=$(pulsar_read_response)
            repl_set_response "$response"
            ;;
        kill)
            if ! pulsar_running; then
                repl_set_response "✗ Engine not running"
                return 1
            fi

            local target="${cmd_args[1]}"
            local id="$target"
            local name=""

            if [[ -n "${PULSAR_TUI_SPRITE_IDS[$target]:-}" ]]; then
                id="${PULSAR_TUI_SPRITE_IDS[$target]}"
                name="$target"
            fi

            pulsar_cmd "KILL $id"
            local response=$(pulsar_read_response)

            if [[ -n "$name" ]]; then
                unset PULSAR_TUI_SPRITE_IDS[$name]
            fi

            repl_set_response "$response"
            ;;
        list)
            if [[ ${#PULSAR_TUI_SPRITE_IDS[@]} -eq 0 ]]; then
                repl_set_response "No named sprites"
            else
                local list=""
                for name in "${!PULSAR_TUI_SPRITE_IDS[@]}"; do
                    list+="$name → ID ${PULSAR_TUI_SPRITE_IDS[$name]}"$'\n'
                done
                repl_set_response "$list"
            fi
            ;;
        hello)
            process_pulsar_command "spawn hello 80 48 18 6 0.5 0.6 0"
            ;;
        trinity)
            process_pulsar_command "spawn left 40 48 18 6 0.5 0.8 0"
            process_pulsar_command "spawn center 80 48 20 8 0.4 -0.3 2"
            process_pulsar_command "spawn right 120 48 15 4 0.7 0.6 5"
            ;;
        dance)
            process_pulsar_command "spawn dancer1 60 48 20 8 0.8 1.2 0"
            process_pulsar_command "spawn dancer2 100 48 20 8 0.8 -1.2 5"
            ;;
        help|h|\?)
            repl_set_response "Commands: start, stop, restart, status, spawn, set, kill, list, hello, trinity, dance, quit"
            ;;
        quit|exit|q)
            PULSAR_TUI_RUNNING=false
            ;;
        *)
            repl_set_response "Unknown command: $cmd (type 'help' for commands)"
            ;;
    esac
}

# ============================================================================
# RENDERING
# ============================================================================

render_animation_area() {
    local start_line=0
    local height=$PULSAR_TUI_ANIMATION_AREA_HEIGHT
    local width=$(tui_screen_width)

    # Header
    tui_buffer_write_line $start_line "┌─ Pulsar Engine $(printf '─%.0s' $(seq 1 $((width - 19))))┐"

    # Content area - show engine status or placeholder
    if pulsar_running; then
        local center_y=$((height / 2))
        tui_buffer_write_line $center_y "$(printf ' %.0s' $(seq 1 $((width / 2 - 20))))⚡ C Engine Rendering to /dev/tty"
        tui_buffer_write_line $((center_y + 1)) "$(printf ' %.0s' $(seq 1 $((width / 2 - 25))))Press Ctrl+C in engine window to return here"
        tui_buffer_write_line $((center_y + 3)) "$(printf ' %.0s' $(seq 1 $((width / 2 - 15))))Active sprites: ${#PULSAR_TUI_SPRITE_IDS[@]}"
    else
        local center_y=$((height / 2))
        tui_buffer_write_line $center_y "$(printf ' %.0s' $(seq 1 $((width / 2 - 10))))Engine Stopped"
        tui_buffer_write_line $((center_y + 1)) "$(printf ' %.0s' $(seq 1 $((width / 2 - 15))))Type 'start' to begin"
    fi

    # Separator
    tui_buffer_write_line $((height - 1)) "└$(printf '─%.0s' $(seq 1 $((width - 2))))┘"
}

render_repl_area() {
    local start_line=$PULSAR_TUI_ANIMATION_AREA_HEIGHT
    local height=$PULSAR_TUI_REPL_AREA_HEIGHT
    local width=$(tui_screen_width)

    # Use integrated REPL render
    repl_render $start_line $height $width
}

# ============================================================================
# MAIN LOOP
# ============================================================================

main_loop() {
    local first_frame=true

    # Initialize REPL
    repl_init
    REPL_PROMPT="pulsar ▶ "

    while $PULSAR_TUI_RUNNING; do
        # Calculate layout
        calc_layout

        # Clear buffer
        tui_buffer_clear

        # Render areas
        render_animation_area
        render_repl_area

        # Render to screen
        if [[ "$first_frame" == "true" ]]; then
            tui_buffer_render_full
            first_frame=false
        else
            tui_buffer_render_diff
        fi

        # Read input (non-blocking)
        local key=$(tui_read_key 0.05)

        if [[ -n "$key" ]]; then
            case "$key" in
                $'\n'|$'\r')  # Enter - execute command
                    local input=$(repl_get_input)
                    repl_add_to_history "$input"
                    process_pulsar_command "$input"
                    repl_clear_input
                    ;;
                $'\x7f')  # Backspace
                    repl_backspace
                    ;;
                $'\x1b[A')  # Up arrow - history
                    repl_history_up
                    ;;
                $'\x1b[B')  # Down arrow - history
                    repl_history_down
                    ;;
                $'\x1b[C')  # Right arrow
                    repl_cursor_right
                    ;;
                $'\x1b[D')  # Left arrow
                    repl_cursor_left
                    ;;
                $'\x01')  # Ctrl-A
                    repl_cursor_home
                    ;;
                $'\x05')  # Ctrl-E
                    repl_cursor_end
                    ;;
                $'\x04')  # Ctrl-D
                    repl_delete_char
                    ;;
                $'\x0b')  # Ctrl-K
                    repl_kill_line
                    ;;
                $'\x15')  # Ctrl-U
                    repl_kill_whole_line
                    ;;
                $'\x17')  # Ctrl-W
                    repl_kill_word
                    ;;
                *)
                    # Regular character
                    if [[ ${#key} -eq 1 ]]; then
                        repl_insert_char "$key"
                    fi
                    ;;
            esac
        fi
    done
}

# ============================================================================
# ENTRY POINT
# ============================================================================

pulsar_tui_repl_run() {
    echo "Starting Pulsar TUI REPL..."
    sleep 1

    # Initialize TUI
    if ! tui_init 30 120; then
        echo "Failed to initialize TUI" >&2
        return 1
    fi

    # Setup cleanup
    trap 'stop_pulsar_engine 2>/dev/null; tui_cleanup' EXIT INT TERM

    # Run main loop
    main_loop

    echo ""
    echo "Pulsar TUI REPL exited. Goodbye! ⚡"
    echo ""
}

# Export
export -f pulsar_tui_repl_run

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    pulsar_tui_repl_run
fi
