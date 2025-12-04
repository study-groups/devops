#!/usr/bin/env bash

# bug_keyboard.sh - Keyboard input writer for bug game
#
# Reads keyboard input and writes single characters to stdout.
# Pipe to FIFO: ./bug_keyboard.sh > /tmp/bug_input
#
# Controls:
#   Player 1: W/A/S/D
#   Player 2: I/J/K/L
#   Space: Pause, Q: Quit, H: Help

main() {
    local saved_stty key
    saved_stty=$(stty -g)

    # Raw mode: no echo, no line buffering, immediate input
    stty -echo -icanon min 1 time 0

    trap 'stty "$saved_stty"; exit 0' EXIT INT TERM

    while IFS= read -rsn1 key; do
        [[ -n "$key" ]] && printf '%s' "$key"
        # Exit on 'q' after writing it
        [[ "$key" == "q" || "$key" == "Q" ]] && break
    done

    stty "$saved_stty"
}

main
