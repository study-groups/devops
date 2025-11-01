#!/usr/bin/env bash

# Tetra TUI Demo - Canonical Example
# Demonstrates the unified TUI library with double buffering, animation, and REPL

set -euo pipefail

# Source tetra first (required)
source ~/tetra/tetra.sh

# Source TUI library
source "$TETRA_SRC/bash/tui/tui.sh"

# Application state
MENU_INDEX=0
ANIMATION_ENABLED=false
SHOW_FPS=false

# Menu items
MENU_ITEMS=("Animation Demo" "Buffer Demo" "REPL Demo" "Input Demo" "Help" "Quit")

# Calculate layout
calc_layout() {
    HEIGHT=$(tui_screen_height)
    WIDTH=$(tui_screen_width)
    HEADER_LINES=3
    FOOTER_LINES=2
    CONTENT_LINES=$((HEIGHT - HEADER_LINES - FOOTER_LINES))
}

# Render header
render_header() {
    tui_buffer_write_line 0 "┌$(printf '─%.0s' $(seq 1 $((WIDTH - 2))))┐"
    tui_buffer_write_line 1 "│ Tetra TUI Library v$(tui_version) - Demo $(printf ' %.0s' $(seq 1 $((WIDTH - 35))))│"
    tui_buffer_write_line 2 "└$(printf '─%.0s' $(seq 1 $((WIDTH - 2))))┘"
}

# Render menu
render_menu() {
    local start_line=$HEADER_LINES

    tui_buffer_write_line $start_line "Select a demo:"
    ((start_line++))
    tui_buffer_write_line $start_line ""
    ((start_line++))

    for i in "${!MENU_ITEMS[@]}"; do
        local prefix="  "
        if [[ $i -eq $MENU_INDEX ]]; then
            prefix="▶ "
        fi
        tui_buffer_write_line $((start_line + i)) "${prefix}${MENU_ITEMS[$i]}"
    done
}

# Render footer
render_footer() {
    local footer_start=$((HEIGHT - FOOTER_LINES))
    tui_buffer_write_line $footer_start "$(printf '─%.0s' $(seq 1 $WIDTH))"
    tui_buffer_write_line $((footer_start + 1)) "↑/↓: Navigate  Enter: Select  q: Quit"
}

# Animation demo
animation_demo() {
    local frame=0

    while true; do
        tui_buffer_clear
        calc_layout

        # Header
        tui_buffer_write_line 0 "Animation Demo - Press 'q' to return"
        tui_buffer_write_line 1 "$(printf '─%.0s' $(seq 1 $WIDTH))"

        # Animated content
        local phase=$(tui_animation_get_beat_phase)
        local bar_width=$(awk -v phase="$phase" -v width="$((WIDTH - 4))" 'BEGIN {printf "%d", phase * width}')

        tui_buffer_write_line 3 "Beat Phase: $phase"
        tui_buffer_write_line 4 ""
        tui_buffer_write_line 5 "  [$(printf '#%.0s' $(seq 1 $bar_width))$(printf ' %.0s' $(seq 1 $((WIDTH - 4 - bar_width))))]"

        # Stats
        if [[ "$SHOW_FPS" == "true" ]]; then
            local stats=$(tui_animation_get_stats)
            tui_buffer_write_line 7 "  $stats"
        fi

        # Footer
        tui_buffer_write_line $((HEIGHT - 2)) "$(printf '─%.0s' $(seq 1 $WIDTH))"
        tui_buffer_write_line $((HEIGHT - 1)) "f: Toggle FPS  o: Toggle Animation  q: Back"

        # Render
        if [[ $frame -eq 0 ]]; then
            tui_buffer_render_full
        else
            tui_buffer_render_diff
        fi

        # Animation tick
        if tui_animation_should_tick; then
            tui_animation_record_frame
        fi

        # Input
        local timeout=0.033  # 30 FPS
        local key=$(tui_read_key $timeout)

        case "$key" in
            'q'|'Q') break ;;
            'f'|'F') SHOW_FPS=$([ "$SHOW_FPS" == "true" ] && echo "false" || echo "true") ;;
            'o'|'O') tui_animation_toggle ;;
        esac

        ((frame++))
    done
}

# Buffer demo
buffer_demo() {
    tui_buffer_clear
    calc_layout

    # Header
    tui_buffer_write_line 0 "Double Buffering Demo - Press any key to return"
    tui_buffer_write_line 1 "$(printf '─%.0s' $(seq 1 $WIDTH))"

    # Content showing buffer operations
    tui_buffer_write_line 3 "This demo uses double buffering for flicker-free rendering:"
    tui_buffer_write_line 4 ""
    tui_buffer_write_line 5 "  1. tui_buffer_clear          - Clear back buffer"
    tui_buffer_write_line 6 "  2. tui_buffer_write_line N T - Write line N with text T"
    tui_buffer_write_line 7 "  3. tui_buffer_render_diff    - Render only changed lines"
    tui_buffer_write_line 8 ""
    tui_buffer_write_line 9 "Benefits:"
    tui_buffer_write_line 10 "  • No screen flicker"
    tui_buffer_write_line 11 "  • Efficient updates (only changed lines)"
    tui_buffer_write_line 12 "  • Smooth animations"

    # Footer
    tui_buffer_write_line $((HEIGHT - 2)) "$(printf '─%.0s' $(seq 1 $WIDTH))"
    tui_buffer_write_line $((HEIGHT - 1)) "Press any key to continue"

    # Render
    tui_buffer_render_full

    # Wait for key
    tui_read_key_blocking >/dev/null
}

# REPL demo
repl_demo() {
    tui_buffer_clear
    calc_layout

    # Header
    tui_buffer_write_line 0 "REPL Integration Demo - Press any key to return"
    tui_buffer_write_line 1 "$(printf '─%.0s' $(seq 1 $WIDTH))"

    # Content
    tui_buffer_write_line 3 "TUI integrates with bash/repl for command-line input:"
    tui_buffer_write_line 4 ""
    tui_buffer_write_line 5 "  • tui_read_line [PROMPT] [HISTORY]  - Read line with editing"
    tui_buffer_write_line 6 "  • Full readline support (↑/↓ history, Ctrl-A/E, etc.)"
    tui_buffer_write_line 7 "  • History persistence"
    tui_buffer_write_line 8 "  • Emacs-style keybindings"
    tui_buffer_write_line 9 ""
    tui_buffer_write_line 10 "See bash/repl/ for the universal REPL system."
    tui_buffer_write_line 11 "See bash/tui/integration/repl.sh for TUI-specific REPL components."

    # Footer
    tui_buffer_write_line $((HEIGHT - 2)) "$(printf '─%.0s' $(seq 1 $WIDTH))"
    tui_buffer_write_line $((HEIGHT - 1)) "Press any key to continue"

    # Render
    tui_buffer_render_full

    # Wait for key
    tui_read_key_blocking >/dev/null
}

# Input demo
input_demo() {
    tui_buffer_clear
    calc_layout

    # Header
    tui_buffer_write_line 0 "Input Handling Demo - Press keys (q to return)"
    tui_buffer_write_line 1 "$(printf '─%.0s' $(seq 1 $WIDTH))"

    # Instructions
    tui_buffer_write_line 3 "Try pressing different keys to see how they're captured:"
    tui_buffer_write_line 4 ""

    local line_num=6

    # Render initial
    tui_buffer_render_full

    # Input loop
    while true; do
        local key=$(tui_read_key_blocking)

        # Show key info
        tui_buffer_write_line $line_num "  Key: '$key'  Hex: $(echo -n "$key" | od -An -tx1 | tr -d ' ')"
        ((line_num++))

        # Keep last 10 lines
        if [[ $line_num -gt $((HEIGHT - 5)) ]]; then
            line_num=6
            # Clear old lines
            for ((i=6; i<HEIGHT-3; i++)); do
                tui_buffer_write_line $i ""
            done
        fi

        # Footer
        tui_buffer_write_line $((HEIGHT - 2)) "$(printf '─%.0s' $(seq 1 $WIDTH))"
        tui_buffer_write_line $((HEIGHT - 1)) "Press 'q' to return to menu"

        # Render
        tui_buffer_render_diff

        [[ "$key" == "q" || "$key" == "Q" ]] && break
    done
}

# Help screen
show_help() {
    tui_buffer_clear
    calc_layout

    # Header
    tui_buffer_write_line 0 "Help - Press any key to return"
    tui_buffer_write_line 1 "$(printf '─%.0s' $(seq 1 $WIDTH))"

    # Content
    tui_buffer_write_line 3 "Tetra TUI Library"
    tui_buffer_write_line 4 "Version: $(tui_version)"
    tui_buffer_write_line 5 ""
    tui_buffer_write_line 6 "Location: \$TETRA_SRC/bash/tui/"
    tui_buffer_write_line 7 ""
    tui_buffer_write_line 8 "Documentation:"
    tui_buffer_write_line 9 "  • README.md - Complete API reference"
    tui_buffer_write_line 10 "  • demo.sh (this file) - Working example"
    tui_buffer_write_line 11 ""
    tui_buffer_write_line 12 "Components:"
    tui_buffer_write_line 13 "  • core/screen.sh     - Terminal control"
    tui_buffer_write_line 14 "  • core/input.sh      - Keyboard input"
    tui_buffer_write_line 15 "  • core/buffer.sh     - Double buffering"
    tui_buffer_write_line 16 "  • core/animation.sh  - Animation system"
    tui_buffer_write_line 17 ""
    tui_buffer_write_line 18 "See also:"
    tui_buffer_write_line 19 "  • bash/repl/    - Universal REPL"
    tui_buffer_write_line 20 "  • bash/color/   - Color system"
    tui_buffer_write_line 21 "  • bash/game/    - Game engine"

    # Footer
    tui_buffer_write_line $((HEIGHT - 2)) "$(printf '─%.0s' $(seq 1 $WIDTH))"
    tui_buffer_write_line $((HEIGHT - 1)) "Press any key to continue"

    # Render
    tui_buffer_render_full

    # Wait for key
    tui_read_key_blocking >/dev/null
}

# Main menu loop
main_menu() {
    local first_render=true

    while true; do
        # Clear and render
        tui_buffer_clear
        calc_layout
        render_header
        render_menu
        render_footer

        if [[ "$first_render" == "true" ]]; then
            tui_buffer_render_full
            first_render=false
        else
            tui_buffer_render_diff
        fi

        # Input
        local key=$(tui_read_key_blocking)

        case "$key" in
            "$TCURSES_KEY_UP"|'k'|'K')
                if [[ $MENU_INDEX -gt 0 ]]; then
                    ((MENU_INDEX--))
                fi
                ;;
            "$TCURSES_KEY_DOWN"|'j'|'J')
                if [[ $MENU_INDEX -lt $((${#MENU_ITEMS[@]} - 1)) ]]; then
                    ((MENU_INDEX++))
                fi
                ;;
            "$TCURSES_KEY_ENTER"|'')
                case "${MENU_ITEMS[$MENU_INDEX]}" in
                    "Animation Demo") animation_demo ;;
                    "Buffer Demo") buffer_demo ;;
                    "REPL Demo") repl_demo ;;
                    "Input Demo") input_demo ;;
                    "Help") show_help ;;
                    "Quit") return 0 ;;
                esac
                first_render=true
                ;;
            'q'|'Q')
                return 0
                ;;
        esac
    done
}

# Main entry point
main() {
    echo "Tetra TUI Demo v$(tui_version)"
    echo "Starting in 1 second..."
    sleep 1

    # Initialize TUI
    tui_init 30 120  # 30 FPS, 120 BPM

    # Setup cleanup
    trap 'tui_cleanup; echo "Demo complete."' EXIT INT TERM

    # Enable animation
    tui_animation_enable

    # Run main menu
    main_menu
}

main "$@"
