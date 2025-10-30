#!/usr/bin/env bash

# TMC Learning Mode
# Interactive MIDI mapping capture and assignment

# Source mapper if not already loaded
if ! declare -f tmc_learn_hardware >/dev/null; then
    source "$(dirname "${BASH_SOURCE[0]}")/mapper.sh"
fi

# Learning state
TMC_LEARNING=0
TMC_LEARN_SYNTAX=""
TMC_LEARN_SEMANTIC=""
TMC_LEARN_MIN=""
TMC_LEARN_MAX=""
TMC_LEARN_TIMEOUT=5  # seconds

# Start learning mode for hardware mapping
# Args: semantic_name [syntax_name] [min] [max]
# Example: /learn VOLUME p1 0.0 1.0
tmc_learn() {
    local semantic="$1"
    local syntax="${2:-}"
    local min="${3:-0}"
    local max="${4:-127}"

    if [[ -z "$semantic" ]]; then
        echo "Usage: /learn <semantic-name> [syntax-name] [min] [max]"
        echo ""
        echo "Examples:"
        echo "  /learn VOLUME p1 0.0 1.0       # Learn pot 1 as volume (normalized)"
        echo "  /learn BRIGHTNESS s1 0 127     # Learn slider 1 as brightness (raw)"
        echo "  /learn TRIGGER_KICK b1a        # Learn button 1a as kick trigger"
        echo "  /learn PLAY play               # Learn transport play button"
        echo ""
        echo "Syntax names:"
        echo "  Pots:      p1, p2, ..., p8"
        echo "  Sliders:   s1, s2, ..., s8"
        echo "  Buttons:   b1a, b1b, b1c, b1d, ..., b8a, b8b, b8c, b8d"
        echo "  Transport: play, pause, stop, back, fwd, fback, ffwd, up, down, left, right"
        echo ""
        echo "If syntax name is omitted, you'll be prompted to move the control."
        return 1
    fi

    # Store learning parameters
    TMC_LEARN_SEMANTIC="$semantic"
    TMC_LEARN_SYNTAX="$syntax"
    TMC_LEARN_MIN="$min"
    TMC_LEARN_MAX="$max"
    TMC_LEARNING=1

    if [[ -n "$syntax" ]]; then
        echo "Learning mode: Move or press control '$syntax' now..."
        echo "(Waiting ${TMC_LEARN_TIMEOUT}s...)"
    else
        echo "Learning mode: Move or press the control for '$semantic' now..."
        echo "(Waiting ${TMC_LEARN_TIMEOUT}s...)"
    fi

    # Set timeout
    (
        sleep "$TMC_LEARN_TIMEOUT"
        if [[ $TMC_LEARNING -eq 1 ]]; then
            echo ""
            echo "Learning timeout - no MIDI event detected"
            TMC_LEARNING=0
        fi
    ) &
}

# Process MIDI event during learning
# Called by socket_server when event is received
# Args: type channel controller value
tmc_learn_process_event() {
    local type="$1"
    local channel="$2"
    local controller="$3"
    local value="$4"

    if [[ $TMC_LEARNING -eq 0 ]]; then
        return 0
    fi

    # Stop learning mode
    TMC_LEARNING=0

    # Auto-detect syntax if not provided
    local syntax="$TMC_LEARN_SYNTAX"
    if [[ -z "$syntax" ]]; then
        # Try to suggest syntax based on context
        echo ""
        echo "Detected: $type channel $channel controller $controller (value: $value)"
        echo ""
        echo "What is this control?"
        echo "  Pot:      p1-p8"
        echo "  Slider:   s1-s8"
        echo "  Button:   b1a-b8d"
        echo "  Transport: play, pause, stop, back, fwd, fback, ffwd, up, down, left, right"
        echo ""
        read -p "Enter syntax name: " syntax

        if [[ -z "$syntax" ]]; then
            echo "Cancelled"
            return 1
        fi

        TMC_LEARN_SYNTAX="$syntax"
    fi

    # Learn hardware mapping
    tmc_learn_hardware "$syntax" "$type" "$channel" "$controller"

    # Learn semantic mapping
    tmc_learn_semantic "$syntax" "$TMC_LEARN_SEMANTIC" "$TMC_LEARN_MIN" "$TMC_LEARN_MAX"

    echo ""
    echo "✓ Learned: $syntax → $TMC_LEARN_SEMANTIC"
    echo "  Hardware: $type ch$channel cc$controller"
    echo "  Range: $TMC_LEARN_MIN - $TMC_LEARN_MAX"
    echo ""
    echo "Use '/save' to save this mapping"

    # Reset learning state
    TMC_LEARN_SYNTAX=""
    TMC_LEARN_SEMANTIC=""
    TMC_LEARN_MIN=""
    TMC_LEARN_MAX=""
}

# Quick learn for all controls (batch mode)
tmc_learn_all() {
    local control_type="$1"

    case "$control_type" in
        pots)
            echo "Learning all 8 pots (p1-p8)..."
            for i in {1..8}; do
                tmc_learn "POT_$i" "p$i" 0.0 1.0
                sleep 1
            done
            ;;
        sliders)
            echo "Learning all 8 sliders (s1-s8)..."
            for i in {1..8}; do
                tmc_learn "SLIDER_$i" "s$i" 0 127
                sleep 1
            done
            ;;
        buttons)
            echo "Learning all 32 buttons (b1a-b8d)..."
            for i in {1..8}; do
                for btn in a b c d; do
                    tmc_learn "BUTTON_${i}${btn}" "b${i}${btn}"
                    sleep 1
                done
            done
            ;;
        transport)
            echo "Learning transport controls..."
            local transport_controls=(play pause stop back fwd fback ffwd up down left right)
            for ctrl in "${transport_controls[@]}"; do
                tmc_learn "TRANSPORT_${ctrl^^}" "$ctrl"
                sleep 1
            done
            ;;
        *)
            echo "Usage: /learn-all <pots|sliders|buttons|transport>"
            return 1
            ;;
    esac
}

# Show learning wizard (step-by-step guide)
tmc_learn_wizard() {
    echo "TMC Learning Wizard"
    echo "==================="
    echo ""
    echo "This wizard will guide you through mapping your MIDI controller."
    echo ""

    # Ask what to learn
    echo "What would you like to map?"
    echo "  1. All pots (p1-p8)"
    echo "  2. All sliders (s1-s8)"
    echo "  3. All buttons (b1a-b8d)"
    echo "  4. Transport controls"
    echo "  5. Custom mapping"
    echo "  6. Cancel"
    echo ""

    read -p "Select [1-6]: " choice

    case "$choice" in
        1)
            tmc_learn_all pots
            ;;
        2)
            tmc_learn_all sliders
            ;;
        3)
            tmc_learn_all buttons
            ;;
        4)
            tmc_learn_all transport
            ;;
        5)
            echo ""
            read -p "Semantic name (e.g., VOLUME): " semantic
            read -p "Syntax name (e.g., p1) [optional]: " syntax
            read -p "Min value [0]: " min
            min="${min:-0}"
            read -p "Max value [127]: " max
            max="${max:-127}"

            tmc_learn "$semantic" "$syntax" "$min" "$max"
            ;;
        6)
            echo "Cancelled"
            return 0
            ;;
        *)
            echo "Invalid choice"
            return 1
            ;;
    esac
}

# Unlearn a mapping
tmc_unlearn() {
    local target="$1"

    if [[ -z "$target" ]]; then
        echo "Usage: /unlearn <syntax-name|semantic-name>"
        return 1
    fi

    # Try syntax name first
    if [[ -n "${TMC_HARDWARE_REV[$target]}" ]]; then
        local key="${TMC_HARDWARE_REV[$target]}"
        unset TMC_HARDWARE_MAP["$key"]
        unset TMC_HARDWARE_REV["$target"]
        echo "Unlearned hardware mapping: $target"
    fi

    # Try semantic name
    if [[ -n "${TMC_SEMANTIC_REV[$target]}" ]]; then
        local syntax="${TMC_SEMANTIC_REV[$target]}"
        unset TMC_SEMANTIC_MAP["$syntax"]
        unset TMC_SEMANTIC_REV["$target"]
        echo "Unlearned semantic mapping: $target"
    fi

    if [[ -z "${TMC_HARDWARE_REV[$target]}" && -z "${TMC_SEMANTIC_REV[$target]}" ]]; then
        echo "No mapping found for: $target"
        return 1
    fi
}

# Clear all mappings
tmc_clear_all() {
    echo "This will clear ALL mappings. Are you sure? [y/N]"
    read -r response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        TMC_HARDWARE_MAP=()
        TMC_HARDWARE_REV=()
        TMC_SEMANTIC_MAP=()
        TMC_SEMANTIC_REV=()
        echo "All mappings cleared"
    else
        echo "Cancelled"
    fi
}

# Show learning help
tmc_learn_help() {
    cat <<EOF
TMC Learning Commands
=====================

Interactive Learning:
  /learn <semantic> [syntax] [min] [max]
      Learn a new mapping. Move/press control when prompted.

      Examples:
        /learn VOLUME p1 0.0 1.0
        /learn TRIGGER_KICK b1a
        /learn PLAY play

  /learn-all <type>
      Batch learn all controls of a type
      Types: pots, sliders, buttons, transport

  /wizard
      Step-by-step learning wizard

Management:
  /unlearn <syntax|semantic>
      Remove a mapping

  /clear
      Clear all mappings (with confirmation)

  /list
      Show all current mappings

  /save [session-name]
      Save mappings to session

  /load [session-name]
      Load mappings from session

Syntax Names:
  Pots:      p1, p2, p3, p4, p5, p6, p7, p8
  Sliders:   s1, s2, s3, s4, s5, s6, s7, s8
  Buttons:   b1a, b1b, b1c, b1d, ..., b8a, b8b, b8c, b8d
  Transport: play, pause, stop, back, fwd, fback, ffwd,
             up, down, left, right

Value Ranges:
  min/max define output range after normalization
  0-127:     Raw MIDI values (default)
  0.0-1.0:   Normalized float (common for volumes)
  -1.0-1.0:  Bipolar (common for pan)
  Custom:    Any numeric range
EOF
}

# Export functions
export -f tmc_learn
export -f tmc_learn_process_event
export -f tmc_learn_all
export -f tmc_learn_wizard
export -f tmc_unlearn
export -f tmc_clear_all
export -f tmc_learn_help
