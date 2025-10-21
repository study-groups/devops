#!/usr/bin/env bash

# TCurses Animated Example
# Demonstrates animation loop and BPM synchronization

# Get script directory
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tcurses.sh"

# Application state
WAVE_TYPE="sine"
SHOW_STATS=false

# Render callback
render_frame() {
    local first_render="$1"

    # Clear back buffer
    tcurses_buffer_clear

    # Get screen dimensions
    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    # Get animation state
    local phase=$(tcurses_animation_get_beat_phase)
    local beats=$(tcurses_animation_get_beat_count)
    local bpm=$(tcurses_animation_get_bpm)
    local fps=$(tcurses_animation_get_fps)
    local status=$(tcurses_animation_get_status)

    # Get wave value
    local wave_value=0
    case "$WAVE_TYPE" in
        sine) wave_value=$(tcurses_animation_beat_sine) ;;
        triangle) wave_value=$(tcurses_animation_beat_triangle) ;;
        square) wave_value=$(tcurses_animation_beat_square) ;;
    esac

    # Header
    tcurses_buffer_write_line 0 "╔$(printf '═%.0s' $(seq 1 $((width-2))))╗"
    tcurses_buffer_write_line 1 "║ TCurses Animated Example - BPM Sync$(printf ' %.0s' $(seq 1 $((width-41))))║"
    tcurses_buffer_write_line 2 "╚$(printf '═%.0s' $(seq 1 $((width-2))))╝"

    # Animation info
    tcurses_buffer_write_line 4 "  Animation: $status @ $fps FPS"
    tcurses_buffer_write_line 5 "  BPM: $bpm"
    tcurses_buffer_write_line 6 "  Beats: $beats"
    tcurses_buffer_write_line 7 "  Phase: $(printf "%.2f" "$phase")"
    tcurses_buffer_write_line 8 ""

    # Wave visualization
    tcurses_buffer_write_line 9 "  Wave Type: $WAVE_TYPE"
    tcurses_buffer_write_line 10 "  Value: $(printf "%.2f" "$wave_value")"
    tcurses_buffer_write_line 11 ""

    # Draw wave bar
    local bar_width=$((width - 6))
    local bar_pos=$(awk -v val="$wave_value" -v max="$bar_width" \
                        'BEGIN {printf "%d", (val + 1.0) * max / 2.0}')
    local bar_line="  ["
    for ((i=0; i<bar_width; i++)); do
        if [[ $i -eq $bar_pos ]]; then
            bar_line+="█"
        elif [[ $i -eq $((bar_width/2)) ]]; then
            bar_line+="│"
        else
            bar_line+=" "
        fi
    done
    bar_line+="]"
    tcurses_buffer_write_line 12 "$bar_line"
    tcurses_buffer_write_line 13 ""

    # Performance stats (if enabled)
    if [[ "$SHOW_STATS" == "true" ]]; then
        local stats=$(tcurses_animation_get_stats)
        tcurses_buffer_write_line 14 "  Stats: $stats"
        tcurses_buffer_write_line 15 ""
    fi

    # Controls
    local ctrl_line=$((height - 8))
    tcurses_buffer_write_line $ctrl_line "  Controls:"
    tcurses_buffer_write_line $((ctrl_line + 1)) "    SPACE - Toggle animation"
    tcurses_buffer_write_line $((ctrl_line + 2)) "    w     - Cycle wave type"
    tcurses_buffer_write_line $((ctrl_line + 3)) "    +/-   - Adjust BPM"
    tcurses_buffer_write_line $((ctrl_line + 4)) "    s     - Toggle stats"
    tcurses_buffer_write_line $((ctrl_line + 5)) "    q     - Quit"

    # Render to screen
    if [[ "$first_render" == "true" ]]; then
        tcurses_buffer_render_full
    else
        tcurses_buffer_render_vsync
    fi
}

# Tick callback (called on each animation frame)
tick_frame() {
    # Nothing to do - all animation state is managed by tcurses_animation
    :
}

# Input callback
handle_input() {
    local key="$1"

    case "$key" in
        'q'|'Q')
            return 1  # Exit loop
            ;;
        ' ')
            tcurses_animation_toggle
            ;;
        'w'|'W')
            case "$WAVE_TYPE" in
                sine) WAVE_TYPE="triangle" ;;
                triangle) WAVE_TYPE="square" ;;
                square) WAVE_TYPE="sine" ;;
            esac
            ;;
        '+')
            local bpm=$(tcurses_animation_get_bpm)
            tcurses_animation_set_bpm $((bpm + 10))
            ;;
        '-')
            local bpm=$(tcurses_animation_get_bpm)
            [[ $bpm -gt 30 ]] && tcurses_animation_set_bpm $((bpm - 10))
            ;;
        's'|'S')
            SHOW_STATS=$([ "$SHOW_STATS" == "true" ] && echo "false" || echo "true")
            ;;
    esac

    return 0  # Continue loop
}

# Main
main() {
    echo "Starting TCurses Animated Example..."
    sleep 1

    # Initialize TCurses with 30 FPS and 120 BPM
    tcurses_init 30 120

    # Set up cleanup trap
    tcurses_setup_cleanup_trap

    # Enable animation
    tcurses_animation_enable

    # Run animation loop
    tcurses_main_loop render_frame handle_input tick_frame

    # Cleanup
    tcurses_cleanup
    clear
    echo "TCurses Animated Example complete."
}

main "$@"
