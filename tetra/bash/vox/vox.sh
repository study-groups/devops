#!/usr/bin/env bash

# vox - Audio-text synchronization system
# Pipe-first TTS + sound generation

# Module paths
: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

# Source core modules
source "$VOX_SRC/vox_core.sh"
source "$VOX_SRC/vox_sound.sh" 2>/dev/null || true

# Main vox command
vox() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        generate|g)
            # cat file | vox generate sally --output file.mp3 --spans
            local voice="${1:-alloy}"
            local output_file=""
            local generate_spans=false

            # Parse flags
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --output|-o)
                        output_file="$2"
                        shift 2
                        ;;
                    --spans)
                        generate_spans=true
                        shift
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            vox_generate_tts "$voice" "$output_file"
            ;;

        play|p)
            # echo "text" | vox play sally
            local voice="${1:-alloy}"
            vox_play "$voice"
            ;;

        sound)
            # echo "bd sd cp hh" | vox sound generate
            local subcmd="${1:-help}"
            shift || true

            case "$subcmd" in
                generate|g)
                    vox_sound_generate "$@"
                    ;;
                play|p)
                    vox_sound_play "$@"
                    ;;
                *)
                    cat <<'EOF'
vox sound - Programmatic sound generation

Commands:
  generate [options]    Generate sound from pattern
  play [options]        Generate and play sound

Options:
  --output, -o FILE     Output file
  --tempo, -t BPM       Tempo in beats per minute (default: 120)
  --synth, -s TYPE      Synth type (auto, sine, square, saw, triangle)

Patterns:
  bd, kick              Bass drum
  sd, snare             Snare drum
  cp, clap              Clap
  hh, hihat             Hi-hat
  c, d, e, f, g, a, b   Musical notes
  ~                     Rest/silence

Examples:
  echo "bd sd cp hh" | vox sound generate --output beat.wav
  echo "bd ~ sd ~" | vox sound play --tempo 140
  echo "c a f e" | vox sound generate --synth sine --tempo 120
EOF
                    ;;
            esac
            ;;

        help|h|--help|-h)
            cat <<'EOF'
vox - Audio-text synchronization system

Usage: vox <command> [options]

TTS Commands:
  generate <voice> [--output FILE] [--spans]
                        Generate TTS audio from stdin
  play <voice>          Generate and play audio from stdin

Sound Commands:
  sound generate        Generate sound from pattern notation

Examples:
  # TTS from stdin
  echo "Hello world" | vox play alloy
  cat story.txt | vox generate nova --output story.mp3

  # Sound generation
  echo "bd sd cp hh" | vox sound generate --output beat.wav

Voices:
  alloy, echo, fable, onyx, nova, shimmer

Environment:
  OPENAI_API_KEY       OpenAI API key for TTS
  VOX_DIR              Data directory (default: $TETRA_DIR/vox)
EOF
            ;;

        *)
            echo "Unknown command: $cmd" >&2
            echo "Use 'vox help' for usage" >&2
            return 1
            ;;
    esac
}

# Export for subshells
export -f vox
