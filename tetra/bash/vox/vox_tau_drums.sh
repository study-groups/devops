#!/usr/bin/env bash

# vox_tau_drums.sh - Drum synthesis via tau voices
# Uses tau's 8 voices with LIF modulation for percussive sounds

#==============================================================================
# DRUM VOICE MAPPING
#==============================================================================

# Voice assignments (1-4 for drums, 5-8 reserved for synth)
declare -gA VOX_TAU_DRUM_VOICE=(
    [bd]=1 [kick]=1
    [sd]=2 [snare]=2
    [cp]=3 [clap]=3
    [hh]=4 [hihat]=4
)

# Drum sound parameters
declare -gA VOX_TAU_DRUM_FREQ=(
    [bd]=60   [kick]=60      # Bass drum: low frequency
    [sd]=200  [snare]=200    # Snare: mid frequency
    [cp]=800  [clap]=800     # Clap: high frequency
    [hh]=8000 [hihat]=8000   # Hi-hat: very high frequency
)

declare -gA VOX_TAU_DRUM_DECAY=(
    [bd]=0.3   [kick]=0.3     # Bass drum: moderate decay
    [sd]=0.15  [snare]=0.15   # Snare: quick decay
    [cp]=0.1   [clap]=0.1     # Clap: very quick decay
    [hh]=0.05  [hihat]=0.05   # Hi-hat: fastest decay
)

declare -gA VOX_TAU_DRUM_GAIN=(
    [bd]=0.2  [kick]=0.2     # Bass drum: strong
    [sd]=0.15 [snare]=0.15   # Snare: moderate
    [cp]=0.1  [clap]=0.1     # Clap: softer
    [hh]=0.1  [hihat]=0.1    # Hi-hat: subtle
)

#==============================================================================
# DRUM INITIALIZATION
#==============================================================================

# Initialize drum voices in tau
# Call once at startup or when drum kit changes
vox_tau_drum_init() {
    vox_tau_ensure_running || return 1

    echo "Initializing tau drum voices..." >&2

    local drum
    for drum in bd sd cp hh; do
        local voice="${VOX_TAU_DRUM_VOICE[$drum]}"
        local freq="${VOX_TAU_DRUM_FREQ[$drum]}"
        local gain="${VOX_TAU_DRUM_GAIN[$drum]}"
        local decay="${VOX_TAU_DRUM_DECAY[$drum]}"

        # Configure voice
        vox_tau_send "VOICE $voice FREQ $freq" >/dev/null
        vox_tau_send "VOICE $voice GAIN $gain" >/dev/null
        vox_tau_send "VOICE $voice WAVE 0" >/dev/null  # SINE wave (pure)

        # Set envelope: PERC mode, 5ms attack (snappy), decay from drum config
        vox_tau_send "VOICE $voice ENV PERC 0.005 $decay" >/dev/null

        # Route to channel 0 (main output)
        vox_tau_send "VOICE $voice CHAN 0" >/dev/null
    done

    echo "Drum voices ready (bd:1, sd:2, cp:3, hh:4)" >&2
    return 0
}

#==============================================================================
# DRUM TRIGGERING
#==============================================================================

# Trigger a drum sound
# Usage: vox_tau_drum_trigger bd|sd|cp|hh [velocity]
vox_tau_drum_trigger() {
    local drum="$1"
    local velocity="${2:-1.0}"

    # Map alias to canonical name
    local voice="${VOX_TAU_DRUM_VOICE[$drum]}"

    if [[ -z "$voice" ]]; then
        echo "Unknown drum: $drum (use: bd, sd, cp, hh)" >&2
        return 1
    fi

    # Scale gain by velocity
    if [[ "$velocity" != "1.0" ]]; then
        local base_gain="${VOX_TAU_DRUM_GAIN[$drum]}"
        local scaled_gain=$(echo "scale=3; $base_gain * $velocity" | bc)
        vox_tau_send "VOICE $voice GAIN $scaled_gain" >/dev/null
    fi

    # Use TRIG for click-free envelope (PERC mode handles decay automatically)
    vox_tau_send "VOICE $voice TRIG" >/dev/null

    return 0
}

# Trigger multiple drums simultaneously (polyphony)
# Usage: vox_tau_drum_chord bd sd hh
vox_tau_drum_chord() {
    local drums=("$@")

    # Trigger all voices simultaneously (PERC mode handles decay)
    for drum in "${drums[@]}"; do
        local voice="${VOX_TAU_DRUM_VOICE[$drum]}"
        if [[ -n "$voice" ]]; then
            vox_tau_send "VOICE $voice TRIG" >/dev/null &
        fi
    done
    wait
}

#==============================================================================
# PATTERN PLAYBACK
#==============================================================================

# Parse a token, handling brackets and repeats
# Returns space-separated drums for chords
_vox_tau_parse_token() {
    local token="$1"

    # Handle [bd sd] bracket notation (chord/poly)
    if [[ "$token" =~ ^\[(.+)\]$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    # Handle bd*4 repeat notation
    if [[ "$token" =~ ^([a-z]+)\*([0-9]+)$ ]]; then
        local sound="${BASH_REMATCH[1]}"
        local count="${BASH_REMATCH[2]}"
        local result=""
        for ((i=0; i<count; i++)); do
            result+="$sound "
        done
        echo "$result"
        return 0
    fi

    # Plain token
    echo "$token"
}

# Play a pattern through tau drums
# Supports: bd sd ~ [bd hh] bd*4 <bd sd>
# Usage: echo "bd sd cp hh" | vox_tau_drum_pattern [tempo] [cycle]
vox_tau_drum_pattern() {
    local tempo="${1:-120}"
    local cycle="${2:-0}"  # Current cycle for alternation

    # Calculate step duration (assuming 16th notes at tempo)
    local step_duration=$(echo "scale=6; 60 / $tempo / 4" | bc)

    # Read pattern from stdin
    local pattern
    pattern=$(cat)

    # Pre-process: add spaces around brackets and angle brackets for tokenization
    pattern="${pattern//\[/ [}"
    pattern="${pattern//\]/ ]}"
    pattern="${pattern//</  <}"
    pattern="${pattern//>/ >}"

    # Tokenize handling brackets and angle brackets as units
    local tokens=()
    local in_bracket=false
    local in_angle=false
    local bracket_content=""
    local angle_content=""

    for word in $pattern; do
        if [[ "$word" == "[" ]]; then
            in_bracket=true
            bracket_content=""
        elif [[ "$word" == "]" ]]; then
            in_bracket=false
            tokens+=("[$bracket_content]")
        elif [[ "$word" == "<" ]]; then
            in_angle=true
            angle_content=""
        elif [[ "$word" == ">" ]]; then
            in_angle=false
            tokens+=("<$angle_content>")
        elif $in_bracket; then
            bracket_content+="$word "
        elif $in_angle; then
            angle_content+="$word "
        else
            tokens+=("$word")
        fi
    done

    # Ensure drums are initialized
    vox_tau_drum_init 2>/dev/null

    # Play each step
    for token in "${tokens[@]}"; do
        if [[ "$token" == "~" ]]; then
            # Rest
            sleep "$step_duration"
        elif [[ "$token" =~ ^\[.+\]$ ]]; then
            # Chord: [bd sd hh]
            local drums="${token:1:-1}"  # Strip brackets
            vox_tau_drum_chord $drums
            # Chord function handles its own timing, add remaining step time
            local remaining=$(echo "scale=6; $step_duration - 0.1" | bc)
            [[ $(echo "$remaining > 0" | bc) -eq 1 ]] && sleep "$remaining"
        elif [[ "$token" =~ ^\<.+\>$ ]]; then
            # Alternation: <bd sd cp> - pick one based on cycle
            local alts="${token:1:-1}"  # Strip angle brackets
            local alt_array=($alts)
            local alt_count=${#alt_array[@]}
            local pick_idx=$((cycle % alt_count))
            local picked="${alt_array[$pick_idx]}"
            if [[ -n "${VOX_TAU_DRUM_VOICE[$picked]}" ]]; then
                vox_tau_drum_trigger "$picked"
            fi
            sleep "$step_duration"
        elif [[ "$token" =~ ^([a-z]+)\*([0-9]+)$ ]]; then
            # Repeat: bd*4
            local sound="${BASH_REMATCH[1]}"
            local count="${BASH_REMATCH[2]}"
            local sub_duration=$(echo "scale=6; $step_duration / $count" | bc)
            for ((i=0; i<count; i++)); do
                if [[ -n "${VOX_TAU_DRUM_VOICE[$sound]}" ]]; then
                    vox_tau_drum_trigger "$sound"
                fi
                sleep "$sub_duration"
            done
        elif [[ -n "${VOX_TAU_DRUM_VOICE[$token]}" ]]; then
            # Known drum
            vox_tau_drum_trigger "$token"
            sleep "$step_duration"
        else
            # Unknown token, rest
            sleep "$step_duration"
        fi
    done

    return 0
}

# Play pattern in a loop
# Usage: echo "bd ~ sd ~" | vox_tau_drum_loop [tempo] [loops]
vox_tau_drum_loop() {
    local tempo="${1:-120}"
    local loops="${2:-4}"

    local pattern
    pattern=$(cat)

    for ((i=0; i<loops; i++)); do
        echo "$pattern" | vox_tau_drum_pattern "$tempo" "$i"
    done
}

#==============================================================================
# PRESET PATTERNS
#==============================================================================

# Common drum patterns
vox_tau_drum_preset() {
    local preset="$1"
    local tempo="${2:-120}"
    local loops="${3:-1}"

    local pattern
    case "$preset" in
        basic|4-4)
            # Basic 4/4: kick on 1 & 3, snare on 2 & 4, hh on every beat
            pattern="bd hh sd hh bd hh sd hh"
            ;;
        house)
            # House: four-on-the-floor kick
            pattern="bd hh bd hh bd hh bd hh"
            ;;
        breakbeat)
            # Breakbeat pattern
            pattern="bd ~ sd ~ ~ bd ~ sd bd ~ sd ~ bd ~ sd ~"
            ;;
        hiphop)
            # Hip-hop boom bap
            pattern="bd ~ ~ sd ~ ~ bd ~ sd ~ bd ~ ~ sd ~ ~"
            ;;
        rock)
            # Rock beat
            pattern="bd hh sd hh bd hh sd hh bd hh sd hh bd hh sd hh"
            ;;
        *)
            echo "Unknown preset: $preset" >&2
            echo "Available: basic, house, breakbeat, hiphop, rock" >&2
            return 1
            ;;
    esac

    echo "Playing $preset at ${tempo}bpm ($loops loops)" >&2
    for ((i=0; i<loops; i++)); do
        echo "$pattern" | vox_tau_drum_pattern "$tempo"
    done
}

#==============================================================================
# COMMAND INTERFACE
#==============================================================================

vox_tau_drum_cmd() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        init)
            vox_tau_drum_init
            ;;
        trigger|trig|t)
            vox_tau_drum_trigger "$@"
            ;;
        chord)
            vox_tau_drum_chord "$@"
            ;;
        pattern|play)
            vox_tau_drum_pattern "$@"
            ;;
        loop)
            vox_tau_drum_loop "$@"
            ;;
        preset|p)
            vox_tau_drum_preset "$@"
            ;;
        help|--help|-h)
            cat <<'EOF'
vox tau drum - Drum synthesis via tau voices

COMMANDS:
  init                    Initialize drum voices
  trigger <drum>          Trigger single drum (bd, sd, cp, hh)
  chord <drum> [drum]...  Trigger multiple drums simultaneously
  pattern [tempo]         Play pattern from stdin
  loop [tempo] [n]        Loop pattern n times
  preset <name> [tempo]   Play preset pattern

DRUM TOKENS:
  bd / kick    Bass drum (voice 1, 60Hz)
  sd / snare   Snare drum (voice 2, 200Hz)
  cp / clap    Clap (voice 3, 800Hz)
  hh / hihat   Hi-hat (voice 4, 8000Hz)

MINI-NOTATION (Strudel-style):
  ~            Rest (silence)
  [bd sd]      Chord (play simultaneously)
  bd*4         Repeat (subdivide into 4 hits)
  <bd sd>      Alternate each cycle

PRESETS:
  basic        Standard 4/4 beat
  house        Four-on-the-floor
  breakbeat    Classic breakbeat
  hiphop       Boom bap pattern
  rock         Rock beat

EXAMPLES:
  vox tau drum trigger bd
  vox tau drum chord bd hh
  echo "bd sd cp hh" | vox tau drum pattern 120
  vox tau drum preset house 128 4
EOF
            ;;
        *)
            echo "Unknown drum command: $cmd" >&2
            return 1
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_tau_drum_init vox_tau_drum_trigger vox_tau_drum_chord
export -f vox_tau_drum_pattern vox_tau_drum_loop vox_tau_drum_preset
export -f vox_tau_drum_cmd _vox_tau_parse_token
