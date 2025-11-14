#!/usr/bin/env bash

# MIDI LED Control Helper
# Send note messages to control button LEDs on MIDI controllers

: "${MIDI_SRC:=$TETRA_SRC/bash/midi}"

midi_led() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: midi_led <command> [args]

Commands:
  on BUTTON [COLOR]      Turn on LED (color = velocity 1-127, default 127)
  off BUTTON             Turn off LED
  color BUTTON VELOCITY  Set LED to specific velocity/color
  test                   Test all button LEDs in sequence

Button names (VMX8):
  b1a b1b b1c b1d   (track 1, buttons a-d)
  b2a b2b b2c b2d   (track 2, buttons a-d)
  ... through b8d

Examples:
  midi_led on b1a           # Turn on button 1a (full brightness)
  midi_led on b1a 64        # Turn on button 1a (medium brightness)
  midi_led off b1a          # Turn off button 1a
  midi_led color b2c 32     # Set button 2c to low brightness
  midi_led test             # Test all buttons

Common velocities:
  1-42   = dim/red
  43-84  = medium/yellow
  85-127 = bright/green
  (exact colors depend on your controller)
EOF
        return 0
    fi

    shift || true

    case "$action" in
        on)
            local button="$1"
            local velocity="${2:-127}"
            midi_led_set "$button" "$velocity"
            ;;

        off)
            local button="$1"
            midi_led_set "$button" 0
            ;;

        color)
            local button="$1"
            local velocity="$2"
            midi_led_set "$button" "$velocity"
            ;;

        test)
            midi_led_test
            ;;

        *)
            echo "Unknown command: $action"
            midi_led
            return 1
            ;;
    esac
}

# Get note number for button name
midi_led_get_note() {
    local button="$1"

    # Parse button name: b[track][letter]
    # b1a=40, b1b=41, b1c=42, b1d=43
    # b2a=44, b2b=45, b2c=46, b2d=47
    # etc.

    if [[ ! "$button" =~ ^b([1-8])([a-d])$ ]]; then
        echo "ERROR: Invalid button name: $button" >&2
        echo "Use format: b1a, b2c, etc." >&2
        return 1
    fi

    local track="${BASH_REMATCH[1]}"
    local letter="${BASH_REMATCH[2]}"

    # Calculate note: base = 40 + (track-1)*4 + letter_offset
    local base=40
    local track_offset=$(( (track - 1) * 4 ))

    local letter_offset=0
    case "$letter" in
        a) letter_offset=0 ;;
        b) letter_offset=1 ;;
        c) letter_offset=2 ;;
        d) letter_offset=3 ;;
    esac

    local note=$(( base + track_offset + letter_offset ))
    echo "$note"
}

# Set LED state for a button
midi_led_set() {
    local button="$1"
    local velocity="$2"

    local note
    note=$(midi_led_get_note "$button") || return 1

    # Send OSC message: /midi/out/note channel note velocity
    node "$MIDI_SRC/osc_send.js" 239.1.1.1 1983 "/midi/out/note" 1 "$note" "$velocity"

    if [[ "$velocity" -eq 0 ]]; then
        echo "LED $button (note $note): OFF"
    else
        echo "LED $button (note $note): ON (velocity $velocity)"
    fi
}

# Test all button LEDs
midi_led_test() {
    echo "Testing all button LEDs..."
    echo "Press Ctrl+C to stop"

    for track in {1..8}; do
        for letter in a b c d; do
            local button="b${track}${letter}"
            echo -n "Testing $button... "
            midi_led_set "$button" 127 >/dev/null
            sleep 0.1
        done
    done

    echo ""
    echo "Turning all LEDs off..."

    for track in {1..8}; do
        for letter in a b c d; do
            local button="b${track}${letter}"
            midi_led_set "$button" 0 >/dev/null
        done
    done

    echo "Test complete!"
}

# Export functions
export -f midi_led
export -f midi_led_set
export -f midi_led_get_note
export -f midi_led_test
