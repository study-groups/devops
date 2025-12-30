#!/usr/bin/env bash

# vox_tau_synth.sh - Synthesis helpers for tau voices
# Implements double-tau exponential envelopes, chords, and modulation

#==============================================================================
# ENVELOPE MODEL: Double-Tau Exponential (ASR)
#==============================================================================
#
# Attack:  gain(t) = target * (1 - e^(-t/tau1))
# Sustain: gain(t) = target (hold)
# Release: gain(t) = target * e^(-t/tau2)
#
# tau1, tau2 in seconds (time constants)
# Smaller tau = faster response
# tau ≈ 0.001 = nearly instant (but no click)
# tau ≈ 0.01  = snappy
# tau ≈ 0.1   = smooth
# tau ≈ 1.0   = slow swell

#==============================================================================
# CHORD DEFINITIONS
#==============================================================================

declare -gA VOX_CHORD_FREQS

# Base frequencies (A = 220Hz, octave 3)
_vox_note_freq() {
    local note="$1"
    local octave="${2:-3}"

    # Semitones from A3 (220Hz)
    local -A semitones=(
        [C]=-9 [Cs]=-8 [Db]=-8 [D]=-7 [Ds]=-6 [Eb]=-6
        [E]=-5 [F]=-4 [Fs]=-3 [Gb]=-3 [G]=-2 [Gs]=-1 [Ab]=-1
        [A]=0 [As]=1 [Bb]=1 [B]=2
    )

    local semi="${semitones[$note]:-0}"
    local octave_shift=$((octave - 3))
    local total_semi=$((semi + octave_shift * 12))

    # freq = 220 * 2^(semitones/12)
    echo "scale=2; 220 * e($total_semi * l(2) / 12)" | bc -l
}

# Define chord intervals (semitones from root)
declare -gA VOX_CHORD_INTERVALS=(
    # Triads
    [maj]="0 4 7"
    [min]="0 3 7"
    [dim]="0 3 6"
    [aug]="0 4 8"

    # 7th chords
    [maj7]="0 4 7 11"
    [min7]="0 3 7 10"
    [dom7]="0 4 7 10"
    [dim7]="0 3 6 9"
    [m7b5]="0 3 6 10"  # half-diminished

    # Extended
    [maj9]="0 4 7 11 14"
    [min9]="0 3 7 10 14"
    [add9]="0 4 7 14"

    # Sus chords
    [sus2]="0 2 7"
    [sus4]="0 5 7"
    [7sus4]="0 5 7 10"
)

# Parse chord name: Am7 -> root=A, type=min7
_vox_parse_chord() {
    local chord="$1"
    local root type

    # Extract root note (with optional sharp/flat)
    if [[ "$chord" =~ ^([A-G][sb]?) ]]; then
        root="${BASH_REMATCH[1]}"
        # Normalize: s->s, b->b, #->s
        root="${root//#/s}"
    else
        echo "Error: Invalid chord $chord" >&2
        return 1
    fi

    # Extract chord type
    local suffix="${chord:${#root}}"
    case "$suffix" in
        ""|maj|M) type="maj" ;;
        m|min|-) type="min" ;;
        7) type="dom7" ;;
        maj7|M7|Δ7) type="maj7" ;;
        m7|min7|-7) type="min7" ;;
        dim|°) type="dim" ;;
        dim7|°7) type="dim7" ;;
        aug|+) type="aug" ;;
        m7b5|ø|ø7) type="m7b5" ;;
        sus2) type="sus2" ;;
        sus4) type="sus4" ;;
        9) type="maj9" ;;
        m9) type="min9" ;;
        add9) type="add9" ;;
        *) type="maj" ;;
    esac

    echo "$root $type"
}

# Get frequencies for a chord
_vox_chord_frequencies() {
    local chord="$1"
    local octave="${2:-3}"

    local parsed
    parsed=$(_vox_parse_chord "$chord") || return 1
    read -r root type <<< "$parsed"

    local intervals="${VOX_CHORD_INTERVALS[$type]}"
    if [[ -z "$intervals" ]]; then
        echo "Error: Unknown chord type $type" >&2
        return 1
    fi

    # Get root frequency
    local root_freq
    root_freq=$(_vox_note_freq "$root" "$octave")

    # Calculate each note frequency
    local freqs=()
    for semi in $intervals; do
        local freq
        freq=$(echo "scale=2; $root_freq * e($semi * l(2) / 12)" | bc -l)
        freqs+=("$freq")
    done

    echo "${freqs[*]}"
}

#==============================================================================
# ENVELOPE IMPLEMENTATION (Bash prototype - for C engine later)
#==============================================================================

# Trigger voice with envelope (bash prototype)
# Usage: vox_tau_voice_trigger voice freq gain tau1 sustain tau2
vox_tau_voice_trigger() {
    local voice="$1"
    local freq="$2"
    local target_gain="${3:-0.5}"
    local tau1="${4:-0.01}"      # Attack time constant
    local sustain="${5:-0.1}"    # Sustain duration
    local tau2="${6:-0.05}"      # Decay time constant

    # Set frequency
    vox_tau_send "VOICE $voice FREQ $freq" >/dev/null

    # Attack phase: ramp up gain
    # For bash prototype, use discrete steps
    local steps=5
    local dt=$(echo "scale=6; $tau1 * 3 / $steps" | bc)  # 3*tau ≈ 95% of target

    for ((i=1; i<=steps; i++)); do
        local t=$(echo "scale=6; $i * $dt" | bc)
        local g=$(echo "scale=4; $target_gain * (1 - e(-$t / $tau1))" | bc -l)
        vox_tau_send "VOICE $voice GAIN $g" >/dev/null
        [[ $i -eq 1 ]] && vox_tau_send "VOICE $voice ON" >/dev/null
        sleep "$dt"
    done

    # Sustain phase
    vox_tau_send "VOICE $voice GAIN $target_gain" >/dev/null
    sleep "$sustain"

    # Release phase: ramp down gain
    for ((i=1; i<=steps; i++)); do
        local t=$(echo "scale=6; $i * $dt" | bc)
        local g=$(echo "scale=4; $target_gain * e(-$t / $tau2)" | bc -l)
        vox_tau_send "VOICE $voice GAIN $g" >/dev/null
        sleep "$dt"
    done

    vox_tau_send "VOICE $voice OFF" >/dev/null
}

# Quick drum hit with minimal click (fast attack, natural decay)
vox_tau_drum_hit() {
    local voice="$1"
    local freq="$2"
    local gain="${3:-0.7}"
    local tau2="${4:-0.1}"  # Decay time

    vox_tau_send "VOICE $voice FREQ $freq" >/dev/null
    vox_tau_send "VOICE $voice GAIN $gain" >/dev/null
    vox_tau_send "VOICE $voice ON" >/dev/null

    # Exponential decay over several steps
    local steps=8
    local dt=$(echo "scale=6; $tau2 * 3 / $steps" | bc)

    for ((i=1; i<=steps; i++)); do
        sleep "$dt"
        local t=$(echo "scale=6; $i * $dt" | bc)
        local g=$(echo "scale=4; $gain * e(-$t / $tau2)" | bc -l)
        vox_tau_send "VOICE $voice GAIN $g" >/dev/null
    done

    vox_tau_send "VOICE $voice OFF" >/dev/null
}

#==============================================================================
# CHORD COMMANDS
#==============================================================================

# Start a chord drone on voices 5-8
# Usage: vox_tau_chord_on Am7 [octave] [gain]
vox_tau_chord_on() {
    local chord="$1"
    local octave="${2:-3}"
    local gain="${3:-0.2}"

    local freqs
    freqs=$(_vox_chord_frequencies "$chord" "$octave") || return 1

    local freq_array=($freqs)
    local num_notes=${#freq_array[@]}

    # Use voices 5-8 for chord (max 4 notes)
    local voice=5
    for freq in "${freq_array[@]:0:4}"; do
        vox_tau_send "VOICE $voice FREQ $freq" >/dev/null
        vox_tau_send "VOICE $voice GAIN $gain" >/dev/null
        vox_tau_send "VOICE $voice ON" >/dev/null
        ((voice++))
    done

    echo "Chord $chord: ${freq_array[*]:0:4} Hz" >&2
}

# Stop chord drone
vox_tau_chord_off() {
    for voice in 5 6 7 8; do
        vox_tau_send "VOICE $voice OFF" >/dev/null
    done
    echo "Chord off" >&2
}

# Play chord with envelope (attack/sustain/release)
vox_tau_chord_play() {
    local chord="$1"
    local duration="${2:-1.0}"
    local octave="${3:-3}"
    local gain="${4:-0.3}"
    local tau1="${5:-0.05}"   # Attack
    local tau2="${6:-0.2}"    # Release

    local freqs
    freqs=$(_vox_chord_frequencies "$chord" "$octave") || return 1
    local freq_array=($freqs)

    # Attack: fade in all voices
    local steps=5
    local attack_time=$(echo "scale=6; $tau1 * 3" | bc)
    local dt=$(echo "scale=6; $attack_time / $steps" | bc)

    # Set frequencies and start at zero gain
    local voice=5
    for freq in "${freq_array[@]:0:4}"; do
        vox_tau_send "VOICE $voice FREQ $freq" >/dev/null
        vox_tau_send "VOICE $voice GAIN 0" >/dev/null
        vox_tau_send "VOICE $voice ON" >/dev/null
        ((voice++))
    done

    # Ramp up
    for ((i=1; i<=steps; i++)); do
        local t=$(echo "scale=6; $i * $dt" | bc)
        local g=$(echo "scale=4; $gain * (1 - e(-$t / $tau1))" | bc -l)
        for voice in 5 6 7 8; do
            vox_tau_send "VOICE $voice GAIN $g" >/dev/null &
        done
        wait
        sleep "$dt"
    done

    # Sustain
    for voice in 5 6 7 8; do
        vox_tau_send "VOICE $voice GAIN $gain" >/dev/null
    done
    local sustain_time=$(echo "scale=6; $duration - $attack_time - $tau2 * 3" | bc)
    [[ $(echo "$sustain_time > 0" | bc) -eq 1 ]] && sleep "$sustain_time"

    # Release: fade out
    local release_dt=$(echo "scale=6; $tau2 * 3 / $steps" | bc)
    for ((i=1; i<=steps; i++)); do
        local t=$(echo "scale=6; $i * $release_dt" | bc)
        local g=$(echo "scale=4; $gain * e(-$t / $tau2)" | bc -l)
        for voice in 5 6 7 8; do
            vox_tau_send "VOICE $voice GAIN $g" >/dev/null &
        done
        wait
        sleep "$release_dt"
    done

    vox_tau_chord_off 2>/dev/null
}

#==============================================================================
# COMMAND INTERFACE
#==============================================================================

vox_tau_synth_cmd() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        chord)
            local subcmd="${1:-help}"
            shift || true
            case "$subcmd" in
                on) vox_tau_chord_on "$@" ;;
                off) vox_tau_chord_off ;;
                play) vox_tau_chord_play "$@" ;;
                list)
                    echo "Chord types: ${!VOX_CHORD_INTERVALS[*]}"
                    ;;
                *)
                    cat <<'EOF'
vox tau synth chord - Chord control

  on <chord> [octave] [gain]     Start drone (e.g., Am7, Cmaj7, Dm)
  off                            Stop drone
  play <chord> [dur] [oct] [gain] [tau1] [tau2]
  list                           List chord types

Examples:
  vox tau synth chord on Am7
  vox tau synth chord on Cmaj7 4 0.3
  vox tau synth chord play Dm7 2.0
  vox tau synth chord off
EOF
                    ;;
            esac
            ;;

        env|envelope)
            cat <<'EOF'
Double-Tau Envelope Model (for C engine implementation):

  VOICE n ENV tau1 sustain tau2

  tau1 = attack time constant (seconds)
  tau2 = decay/release time constant (seconds)

  Attack:  gain(t) = target × (1 - e^(-t/τ1))
  Release: gain(t) = target × e^(-t/τ2)

  Recommended values:
    tau=0.001  Nearly instant (click-free)
    tau=0.01   Snappy percussion
    tau=0.05   Smooth pluck
    tau=0.1    Soft pad attack
    tau=0.5    Slow swell
    tau=1.0+   Ambient drone

Future C engine commands:
  VOICE n ENV 0.01 0.2 0.1      # Quick attack, medium decay
  VOICE n FILT LP 800 0.7       # Lowpass at 800Hz, Q=0.7
  VOICE n LFO 0.5 0.1 FREQ      # 0.5Hz vibrato on frequency
  VOICE n LFO 4.0 0.3 GAIN      # 4Hz tremolo on gain
  VOICE n LFO 0.1 200 CUTOFF    # Slow filter sweep
EOF
            ;;

        help|--help|-h)
            cat <<'EOF'
vox tau synth - Synthesis helpers

COMMANDS:
  chord on|off|play|list   Chord control
  env                      Envelope model documentation

ENVELOPE MODEL:
  Double-tau exponential: smooth attack (tau1), sustain, smooth decay (tau2)
  Eliminates clicks from instant on/off

FUTURE (C engine):
  ENV tau1 sustain tau2    Per-voice envelope
  FILT type cutoff q       LP/HP/BP filter
  LFO rate depth target    Modulation
EOF
            ;;
        *)
            echo "Unknown synth command: $cmd" >&2
            return 1
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_tau_synth_cmd
export -f vox_tau_chord_on vox_tau_chord_off vox_tau_chord_play
export -f vox_tau_voice_trigger vox_tau_drum_hit
export -f _vox_note_freq _vox_parse_chord _vox_chord_frequencies
