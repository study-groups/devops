#!/usr/bin/env bash

# traks_keyboard.sh - Keyboard input writer for traks game
#
# Reads keyboard input and writes single characters to stdout.
# Pipe to FIFO: ./traks_keyboard.sh > /tmp/traks_input
#
# Controls (Tank Style):
#   Player 1: W=forward, S=backward, A=turn left, D=turn right
#   Player 2: I=forward, K=backward, J=turn left, L=turn right
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
