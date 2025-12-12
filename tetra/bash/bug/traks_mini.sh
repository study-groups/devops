#!/usr/bin/env bash

# Minimal traks - debug version with 256 colors

# Save terminal state
SAVED_STTY=$(stty -g)

cleanup() {
    stty "$SAVED_STTY"
    printf '\033[?25h'  # show cursor
    printf '\033[0m'    # reset colors
    clear
}
trap cleanup EXIT

# Raw mode
stty -echo -icanon min 0 time 0

# Hide cursor, clear screen
printf '\033[?25l'
printf '\033[2J'
printf '\033[H'

# Game state
PX=10
PY=10
HEADING="right"

# 256-color codes
RED=196
YELLOW=220
GRAY=245

# Main loop
while true; do
    # Clear and draw
    printf '\033[H'

    # Draw border (gray)
    printf '\033[38;5;%dm' $GRAY
    echo "┌────────────────────────────────────────┐"
    for ((i=0; i<20; i++)); do
        echo "│                                        │"
    done
    echo "└────────────────────────────────────────┘"
    printf '\033[0m'

    # Draw player (red)
    printf '\033[%d;%dH' $((PY + 2)) $((PX + 2))
    printf '\033[38;5;%dm' $RED
    case "$HEADING" in
        up) printf '▲' ;;
        down) printf '▼' ;;
        left) printf '◀' ;;
        right) printf '▶' ;;
    esac
    printf '\033[0m'

    # Status line (yellow)
    printf '\033[24;1H'
    printf '\033[38;5;%dm' $YELLOW
    printf 'Pos: %d,%d  Heading: %s  (WASD=move, Q=quit)' "$PX" "$PY" "$HEADING"
    printf '\033[0m\033[K'

    # Read input
    key=""
    read -t 0.1 -n1 key

    case "$key" in
        w|W) ((PY--)); HEADING="up" ;;
        s|S) ((PY++)); HEADING="down" ;;
        a|A) ((PX--)); HEADING="left" ;;
        d|D) ((PX++)); HEADING="right" ;;
        q|Q) break ;;
    esac

    # Bounds
    ((PX < 1)) && PX=1
    ((PX > 38)) && PX=38
    ((PY < 1)) && PY=1
    ((PY > 18)) && PY=18
done

echo ""
echo "Done!"
