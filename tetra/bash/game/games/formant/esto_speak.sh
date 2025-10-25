#!/usr/bin/env bash
# esto_speak.sh - Estovox Speech Script Player
#
# Reads .esto files and synthesizes speech through formant engine
# Usage: ./esto_speak.sh <file.esto>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/formant.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Global state
CURRENT_PITCH=120
CURRENT_RATE=1.0
CURRENT_EMOTION="NEUTRAL"
CURRENT_EMOTION_INTENSITY=0.5

print_error() {
    echo -e "${RED}ERROR:${NC} $1" >&2
}

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

print_debug() {
    [[ "$VERBOSE" == "1" ]] && echo -e "${YELLOW}DEBUG:${NC} $1"
}

parse_and_speak_esto() {
    local file=$1

    if [[ ! -f "$file" ]]; then
        print_error "File not found: $file"
        return 1
    fi

    print_info "Reading $file..."

    local line_num=0
    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))

        # Strip leading/trailing whitespace
        line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

        # Skip empty lines and comments
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && continue

        # Process directives (@COMMAND)
        if [[ "$line" =~ ^@ ]]; then
            parse_directive "$line" "$line_num"
            continue
        fi

        # Process phoneme line (phoneme:duration:pitch)
        if [[ "$line" =~ ^([^:]+):([0-9]+):([0-9]+) ]]; then
            local phoneme="${BASH_REMATCH[1]}"
            local duration="${BASH_REMATCH[2]}"
            local pitch="${BASH_REMATCH[3]}"

            # Apply rate multiplier to duration
            duration=$(bc -l <<< "scale=0; $duration / $CURRENT_RATE")

            # Skip rest/silence phonemes (pitch 0)
            if [[ "$pitch" == "0" ]]; then
                print_debug "Rest: ${duration}ms"
                sleep $(bc -l <<< "scale=3; $duration / 1000")
                continue
            fi

            print_debug "Phoneme: $phoneme ${duration}ms ${pitch}Hz"

            # Send to formant
            formant_phoneme "$phoneme" "$duration" "$pitch" 0.7 0.3

            # Wait for duration (accounting for rate)
            local wait_time=$(bc -l <<< "scale=3; $duration / 1000")
            sleep "$wait_time"
        else
            # Invalid line format
            print_error "Invalid format at line $line_num: $line"
            print_error "Expected: <phoneme>:<duration_ms>:<pitch_hz>"
        fi
    done < "$file"

    print_info "Speech complete!"
}

parse_directive() {
    local line=$1
    local line_num=$2

    # Remove @ prefix
    line="${line#@}"

    # Split into command and arguments
    read -r cmd args <<< "$line"

    case "$cmd" in
        EMOTION)
            read -r emotion intensity <<< "$args"
            CURRENT_EMOTION="${emotion:-NEUTRAL}"
            CURRENT_EMOTION_INTENSITY="${intensity:-0.5}"
            print_debug "Emotion: $CURRENT_EMOTION ($CURRENT_EMOTION_INTENSITY)"
            formant_emotion "$CURRENT_EMOTION" "$CURRENT_EMOTION_INTENSITY"
            ;;

        PITCH)
            CURRENT_PITCH="$args"
            print_debug "Base Pitch: ${CURRENT_PITCH}Hz"
            formant_prosody "PITCH" "$CURRENT_PITCH"
            ;;

        RATE)
            CURRENT_RATE="$args"
            print_debug "Rate: ${CURRENT_RATE}x"
            formant_prosody "RATE" "$CURRENT_RATE"
            ;;

        VOLUME)
            print_debug "Volume: $args"
            formant_prosody "VOLUME" "$args"
            ;;

        BREATHINESS)
            print_debug "Breathiness: $args"
            formant_prosody "BREATHINESS" "$args"
            ;;

        CREAKY)
            print_debug "Creaky/Vocal Fry: $args"
            formant_prosody "CREAKY" "$args"
            ;;

        TENSION)
            print_debug "Tension: $args"
            formant_prosody "TENSION" "$args"
            ;;

        RESET)
            print_debug "Reset to neutral"
            formant_reset
            CURRENT_PITCH=120
            CURRENT_RATE=1.0
            CURRENT_EMOTION="NEUTRAL"
            CURRENT_EMOTION_INTENSITY=0.5
            ;;

        *)
            print_error "Unknown directive at line $line_num: @$cmd"
            ;;
    esac
}

show_usage() {
    cat <<EOF
Estovox Speech Script Player

Usage: $0 [options] <file.esto>

Options:
  -v, --verbose     Verbose output (show each phoneme)
  -s, --sample-rate Sample rate (default: 48000)
  -b, --buffer      Buffer size (default: 512)
  -h, --help        Show this help

.esto File Format:
  # Comments start with #

  # Directives (settings)
  @EMOTION <emotion> [intensity]    # Set emotion (HAPPY, SAD, etc.)
  @PITCH <hz>                       # Set base pitch
  @RATE <multiplier>                # Set speaking rate
  @VOLUME <0.0-1.0>                 # Set volume
  @RESET                            # Reset to defaults

  # Phonemes (one per line)
  <phoneme>:<duration_ms>:<pitch_hz>

  # Example:
  h:80:120
  e:180:130
  l:100:125
  o:280:120

Examples:
  $0 examples/hello.esto
  $0 -v examples/sentence.esto
  $0 --sample-rate 24000 examples/greeting.esto

EOF
}

main() {
    local esto_file=""
    local sample_rate=48000
    local buffer_size=512
    VERBOSE=0

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -s|--sample-rate)
                sample_rate="$2"
                shift 2
                ;;
            -b|--buffer)
                buffer_size="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                esto_file="$1"
                shift
                ;;
        esac
    done

    # Check if file provided
    if [[ -z "$esto_file" ]]; then
        print_error "No .esto file provided"
        show_usage
        exit 1
    fi

    # Check if formant binary exists
    if [[ ! -x "$FORMANT_BIN" ]]; then
        print_error "Formant binary not found. Run 'make' first."
        exit 1
    fi

    # Start formant engine
    print_info "Starting formant engine (${sample_rate}Hz, ${buffer_size} samples)..."
    formant_start "$sample_rate" "$buffer_size"
    sleep 0.3

    # Parse and speak
    parse_and_speak_esto "$esto_file"

    # Cleanup
    sleep 0.5
    print_info "Stopping formant engine..."
    formant_stop

    echo -e "${GREEN}✓${NC} Done!"
}

main "$@"
