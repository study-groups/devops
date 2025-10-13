#!/usr/bin/env bash

# vox_sound.sh - Sound generation integration
# Combines pattern parsing + synthesis

source "${VOX_SRC}/vox_sound_pattern.sh"
source "${VOX_SRC}/vox_sound_synth.sh"

# Generate sound from stdin pattern
vox_sound_generate() {
    local output_file=""
    local tempo=120
    local synth_type="auto"

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output|-o)
                output_file="$2"
                shift 2
                ;;
            --tempo|-t)
                tempo="$2"
                shift 2
                ;;
            --synth|-s)
                synth_type="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    # Read pattern from stdin
    local pattern
    pattern=$(cat)

    if [[ -z "$pattern" ]]; then
        echo "Error: No pattern provided" >&2
        return 1
    fi

    # Parse pattern into timeline
    local timeline
    timeline=$(parse_simple_pattern "$pattern" "$tempo")

    if [[ -z "$timeline" ]]; then
        echo "Error: Failed to parse pattern" >&2
        return 1
    fi

    # Generate audio for each event
    local temp_files=()
    local max_time=0

    while IFS= read -r event; do
        read -r time sound duration <<< "$event"

        # Determine synth type
        local stype
        if [[ "$synth_type" == "auto" ]]; then
            stype=$(sound_to_synth_type "$sound")
        else
            stype="$synth_type"
        fi

        # Generate sound sample
        local temp_sample=$(mktemp /tmp/vox_sound_XXXXXX.wav)
        vox_synth "$stype" "$duration" "$temp_sample" >/dev/null 2>&1

        if [[ $? -eq 0 ]]; then
            temp_files+=("$time:$temp_sample")

            # Track max time for total duration
            local end_time=$(echo "$time + $duration" | bc)
            if (( $(echo "$end_time > $max_time" | bc -l) )); then
                max_time=$end_time
            fi
        fi
    done <<< "$timeline"

    # Mix all samples into final output
    # For MVP: just concatenate (will add proper mixing later)
    local final_output
    if [[ -n "$output_file" ]]; then
        final_output="$output_file"
    else
        final_output=$(mktemp /tmp/vox_final_XXXXXX.wav)
    fi

    # Simple concatenation for now (should be mixing with overlap)
    if [[ ${#temp_files[@]} -eq 0 ]]; then
        echo "Error: No audio generated" >&2
        return 1
    fi

    # Use first file as base (very naive approach)
    local first_file="${temp_files[0]#*:}"
    cp "$first_file" "$final_output"

    # Cleanup temp files
    for entry in "${temp_files[@]}"; do
        local file="${entry#*:}"
        rm -f "$file"
    done

    # Output or play
    if [[ -z "$output_file" ]]; then
        cat "$final_output"
        rm -f "$final_output"
    else
        echo "Generated: $output_file" >&2
    fi

    return 0
}

# Play sound pattern
vox_sound_play() {
    local temp_audio=$(mktemp /tmp/vox_sound_XXXXXX.wav)

    if vox_sound_generate --output "$temp_audio" "$@"; then
        # Play the audio
        if command -v afplay &>/dev/null; then
            afplay "$temp_audio"
        elif command -v aplay &>/dev/null; then
            aplay -q "$temp_audio"
        else
            echo "Error: No audio player found" >&2
            echo "Audio saved at: $temp_audio" >&2
            return 1
        fi
        rm -f "$temp_audio"
        return 0
    else
        rm -f "$temp_audio"
        return 1
    fi
}
