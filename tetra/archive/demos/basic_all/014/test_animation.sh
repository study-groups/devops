#!/usr/bin/env bash

# Enhanced animation test for Demo 014 - Tests new animation controller

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source animation modules
source "$DEMO_DIR/bash/tui/oscillator.sh"
source "$DEMO_DIR/bash/tui/line_animator.sh"
source "$DEMO_DIR/bash/tui/buffer.sh"
source "$DEMO_DIR/bash/tui/animation_controller.sh"

# Get terminal size
if [[ -e /dev/tty ]]; then
    read TUI_HEIGHT TUI_WIDTH < <(stty size </dev/tty 2>/dev/null)
fi
[[ -z "$TUI_HEIGHT" ]] && TUI_HEIGHT=$(tput lines 2>/dev/null || echo 24)
[[ -z "$TUI_WIDTH" ]] && TUI_WIDTH=$(tput cols 2>/dev/null || echo 80)

# Initialize
osc_init
line_init
tui_buffer_init
anim_init
anim_set_fps 30

echo "Testing Enhanced Animation System - Demo 014"
echo ""
echo "Features:"
echo "  • Toggle on/off with FPS tracking"
echo "  • Flicker-free double buffering"
echo "  • Pause/resume support"
echo "  • Real-time FPS display"
echo ""
echo "Controls:"
echo "  o - Toggle animation on/off"
echo "  p - Pause/resume animation"
echo "  f - Toggle FPS overlay"
echo "  ←/→ - Move marker manually"
echo "  q - Quit"
echo ""
echo "Press any key to start..."
read -rsn1

clear

render_frame() {
    local pos=$(osc_get_position)
    local anim_status=$(anim_get_status)
    local fps=$(anim_get_fps)
    local avg_frame_time=$(anim_get_avg_frame_time)

    # Clear and build frame info
    printf '\033[H'
    echo "Animation Test - Demo 014 (Refactored)"
    echo ""
    printf "Animation: %-8s | FPS: %2d/%-2d | Avg Frame: %3dms | Position: %3d\n" \
        "$anim_status" "$fps" "$ANIM_FPS_TARGET" "$avg_frame_time" "$pos"
    echo ""

    # Render animated line
    line_animate_from_osc "$pos"

    echo ""
    echo "o=toggle  p=pause/resume  f=fps overlay  ←/→=move  q=quit"
}

# Main loop with new animation controller
show_fps_overlay=false

trap 'anim_stop; clear; exit' EXIT INT TERM

while true; do
    render_frame

    # Animation tick with FPS tracking
    if anim_should_tick; then
        osc_tick
        anim_record_frame
        anim_check_performance

        # Use frame-paced timeout
        local timeout=$(anim_get_frame_time)
        read -rsn1 -t "$timeout" key || key=""
    else
        # Blocking when animation is off
        read -rsn1 key
    fi

    # Show FPS overlay if enabled
    if [[ "$show_fps_overlay" == "true" && "$ANIM_ENABLED" == "true" ]]; then
        local stats=$(anim_get_stats)
        printf '\033[s\033[10;1H\033[K\033[33m%s\033[0m\033[u' ">> $stats"
    fi

    # Handle input
    case "$key" in
        o|O)
            anim_toggle
            ;;
        p|P)
            if [[ "$ANIM_PAUSED" == "true" ]]; then
                anim_resume
            else
                anim_pause
            fi
            ;;
        f|F)
            show_fps_overlay=$([ "$show_fps_overlay" == "true" ] && echo "false" || echo "true")
            ;;
        $'\x1b')
            # Read arrow key sequence
            read -rsn2 -t 0.01 key2
            if [[ "$key2" == "[D" ]]; then
                # Left arrow
                osc_set_position $(($(osc_get_position) - 5))
            elif [[ "$key2" == "[C" ]]; then
                # Right arrow
                osc_set_position $(($(osc_get_position) + 5))
            fi
            ;;
        q|Q)
            break
            ;;
    esac
done

clear
echo "Animation test complete."
echo ""
echo "Final stats: $(anim_get_stats)"
