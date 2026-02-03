#!/usr/bin/env bash

# vox - Audio-text synchronization system
# CLI: vox <cmd> <target> [options]
# TUI: vox tui / vox karaoke
#
# Providers: openai (cloud), coqui (local), formant (research)

# Module paths
: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

# Source core modules
source "$VOX_SRC/vox_paths.sh"
source "$VOX_SRC/vox_cache.sh"
source "$VOX_SRC/vox_qa.sh" 2>/dev/null || true
source "$VOX_SRC/vox_metadata.sh"
source "$VOX_SRC/vox_log.sh"
source "$VOX_SRC/vox_list.sh"
source "$VOX_SRC/vox_core.sh"
source "$VOX_SRC/vox_sound.sh" 2>/dev/null || true
source "$VOX_SRC/vox_dry_run.sh"
source "$VOX_SRC/vox_analyze.sh" 2>/dev/null || true
source "$VOX_SRC/vox_tui_app.sh" 2>/dev/null || true
source "$VOX_SRC/vox_coqui.sh" 2>/dev/null || true
source "$VOX_SRC/vox_align.sh" 2>/dev/null || true

# New architecture modules
source "$VOX_SRC/vox_vars.sh" 2>/dev/null || true
source "$VOX_SRC/vox_provider.sh" 2>/dev/null || true
source "$VOX_SRC/vox_complete.sh" 2>/dev/null || true

# Tau audio engine integration (optional)
source "$VOX_SRC/vox_tau.sh" 2>/dev/null || true

# Main vox command
vox() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        generate|g)
            # cat file | vox generate openai:shimmer --output file.mp3
            local voice_spec="${1:-openai:alloy}"
            shift || true
            local output_file=""

            # Parse flags
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --output|-o)
                        output_file="$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done

            vox_provider_generate "$voice_spec" "$output_file"
            ;;

        play|p)
            # Dual mode: pipe or ID
            # vox play openai:shimmer qa:0 [--backend tau]
            # echo "text" | vox play coqui:xtts [--backend tau]
            local voice_spec=""
            local source_id=""
            local backend=""

            # Parse arguments
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --backend|-b) backend="$2"; shift 2 ;;
                    *)
                        if [[ -z "$voice_spec" ]]; then
                            voice_spec="$1"
                        elif [[ -z "$source_id" ]]; then
                            source_id="$1"
                        fi
                        shift
                        ;;
                esac
            done

            voice_spec="${voice_spec:-openai:alloy}"

            # Set backend for this invocation
            [[ -n "$backend" ]] && export VOX_AUDIO_BACKEND="$backend"

            if [[ -n "$source_id" ]]; then
                # ID mode: vox play openai:shimmer qa:0
                vox_provider_play "$voice_spec" "$source_id"
            else
                # Pipe mode: echo "text" | vox play openai:shimmer
                vox_parse_voice "$voice_spec"
                local handler="${VOX_PROVIDERS[$VOX_PARSED_PROVIDER]}"
                "$handler" play "$VOX_PARSED_VOICE"
            fi
            ;;

        a)
            # QA shorthand: vox a 1 openai:shimmer
            local index="${1:-0}"
            local voice_spec="${2:-openai:alloy}"
            vox_provider_play "$voice_spec" "qa:$index"
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

        ls|list)
            # List available sources
            local subcmd="${1:-mp3}"
            shift || true

            case "$subcmd" in
                mp3|audio)
                    # Default: List MP3 files with metadata
                    vox_list_mp3 "$@"
                    ;;
                esto)
                    # List esto files with generation status
                    vox_list_esto
                    ;;
                recent)
                    # List recent N files
                    local count="${1:-10}"
                    vox_list_recent "$count"
                    ;;
                project)
                    # Project overview
                    vox_list_project
                    ;;
                qa)
                    # QA sources
                    vox_qa_list
                    ;;
                cache)
                    # Cache stats
                    vox_cache_stats
                    ;;
                all)
                    # Everything
                    vox_list_mp3 10
                    echo ""
                    echo ""
                    vox_list_esto
                    echo ""
                    echo ""
                    vox_cache_stats
                    ;;
                *)
                    echo "Unknown listing type: $subcmd" >&2
                    echo "Usage: vox ls [mp3|esto|recent|project|qa|cache|all]" >&2
                    ;;
            esac
            ;;

        info)
            # Show detailed file information
            local file="$1"
            if [[ -z "$file" ]]; then
                echo "Usage: vox info <file>" >&2
                return 1
            fi

            if [[ ! -f "$file" ]]; then
                echo "Error: File not found: $file" >&2
                return 1
            fi

            # Check if it's an MP3 file
            if [[ "$file" =~ \.mp3$ ]]; then
                local meta_file=$(vox_meta_find "$file")
                if [[ -n "$meta_file" ]]; then
                    vox_meta_display "$meta_file"
                else
                    echo "No metadata found for: $file"
                    echo "File: $file"
                    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
                    echo "Size: $(vox_meta_format_size "$size")"
                fi
            # Check if it's an esto file
            elif [[ "$file" =~ \.esto$ ]]; then
                vox_meta_correlate "$file"
            else
                echo "Unsupported file type: $file" >&2
                return 1
            fi
            ;;

        cache)
            # Cache management
            local subcmd="${1:-stats}"
            shift || true

            case "$subcmd" in
                stats|status)
                    vox_cache_stats
                    ;;
                info)
                    vox_cache_info "$@"
                    ;;
                clean)
                    vox_cache_clean "$@"
                    ;;
                *)
                    echo "Usage: vox cache <stats|info|clean>" >&2
                    ;;
            esac
            ;;

        dry-run|dry)
            # Dry-run analysis - no API calls
            local subcmd="${1:-help}"
            shift || true

            case "$subcmd" in
                qa)
                    # Analyze specific QA reference
                    local qa_ref="${1:-qa:0}"
                    local voice_spec="${2:-openai:alloy}"
                    vox_parse_voice "$voice_spec"
                    vox_dry_run_qa "$qa_ref" "$VOX_PARSED_VOICE" "$VOX_PARSED_PROVIDER"
                    ;;
                file)
                    # Analyze file
                    local file_path="$1"
                    local voice_spec="${2:-openai:alloy}"
                    vox_parse_voice "$voice_spec"
                    vox_dry_run_file "$file_path" "$VOX_PARSED_VOICE" "$VOX_PARSED_PROVIDER"
                    ;;
                batch)
                    # Batch analysis of multiple QA answers
                    local voice_spec="${1:-openai:alloy}"
                    vox_parse_voice "$voice_spec"
                    local voice="$VOX_PARSED_VOICE"
                    local provider="$VOX_PARSED_PROVIDER"
                    local start="${2:-0}"
                    local count="${3:-5}"
                    vox_dry_run_batch "$voice" "$start" "$count"
                    ;;
                stdin|-)
                    # Analyze stdin
                    local voice="${1:-alloy}"
                    local text=$(cat)
                    vox_dry_run_analyze "$voice" "" "$text"
                    ;;
                help|*)
                    cat <<'EOF'
vox dry-run - Analyze inputs without making API calls

Usage: vox dry-run <command> [options]

Commands:
  qa <ref> [voice]         Analyze QA reference
  file <path> [voice]      Analyze file
  batch [voice] [start] [N] Analyze N QA answers starting from index
  stdin [voice]            Analyze stdin (cat file | vox dry-run stdin sally)

Examples:
  # Analyze specific QA answer
  vox dry-run qa qa:0 sally
  vox dry-run qa qa:1728756234 nova

  # Analyze file
  vox dry-run file story.txt alloy

  # Analyze from stdin
  echo "Hello world" | vox dry-run stdin sally
  cat article.txt | vox dry-run stdin nova

  # Batch analysis
  vox dry-run batch alloy 0 10      # Analyze qa:0 through qa:9 with alloy

Analysis shows:
  - Content characteristics (chars, words, lines)
  - Content hash for cache lookup
  - Cache status (HIT/MISS)
  - Estimated API cost
  - Whether truncation would occur
  - Content preview
EOF
                    ;;
            esac
            ;;

        log)
            # Transaction log management
            local subcmd="${1:-help}"
            shift || true

            case "$subcmd" in
                retrofit)
                    # Retrofit existing file(s)
                    local file="$1"
                    if [[ -z "$file" ]]; then
                        echo "Usage: vox log retrofit <file>" >&2
                        echo "       vox log retrofit --scan" >&2
                        return 1
                    fi

                    if [[ "$file" == "--scan" ]]; then
                        vox_log_retrofit_scan
                    else
                        vox_log_retrofit "$file"
                    fi
                    ;;
                stats)
                    # Show statistics
                    vox_log_stats
                    ;;
                query)
                    # Query log
                    vox_log_query "$@"
                    ;;
                help|*)
                    cat <<'EOF'
vox log - Transaction log management

Usage: vox log <command> [options]

Commands:
  retrofit <file>    Retrofit existing MP3 into transaction log
  retrofit --scan    Scan and retrofit all MP3 files
  stats              Show transaction statistics
  query [filters]    Query transaction log

Query Filters:
  --limit N          Show last N transactions (default: 20)
  --voice <voice>    Filter by voice
  --source-type <t>  Filter by source type (qa, esto, stdin)
  --cache-hit        Show only cache hits
  --cache-miss       Show only cache misses
  --since <date>     Show since date

Examples:
  # Retrofit your existing MP3
  vox log retrofit ~/tetra/qa/db/1760229927.vox.sally.mp3

  # Scan and retrofit all MP3s
  vox log retrofit --scan

  # Show statistics
  vox log stats

  # Query recent generations
  vox log query --limit 10
  vox log query --voice sally --cache-miss
EOF
                    ;;
            esac
            ;;

        analyze|an)
            # Audio analysis using tau filter bank
            local subcmd="${1:-help}"
            shift || true

            case "$subcmd" in
                file)
                    local audio_file="$1"
                    local output_file="$2"
                    if [[ -z "$audio_file" ]]; then
                        echo "Usage: vox analyze file <audio.mp3> [output.json]" >&2
                        return 1
                    fi
                    vox_analyze "$audio_file" "$output_file"
                    ;;
                summary)
                    local audio_file="$1"
                    if [[ -z "$audio_file" ]]; then
                        echo "Usage: vox analyze summary <audio.mp3>" >&2
                        return 1
                    fi
                    vox_analyze_summary "$audio_file"
                    ;;
                batch)
                    local pattern="$1"
                    local output_dir="$2"
                    vox_analyze_batch "$pattern" "$output_dir"
                    ;;
                help|*)
                    cat <<'EOF'
vox analyze - Audio analysis using tau filter bank

Usage: vox analyze <command> [options]

Commands:
  file <audio> [out]   Full analysis to JSON
  summary <audio>      Quick summary (F0, onsets, energy)
  batch <pattern> [dir] Batch analyze multiple files

Analysis includes:
  - F0 estimation via matched filter bank (80-270Hz bands)
  - Formant energy (F1/F2/F3 bands)
  - Onset detection (phoneme boundaries via tscale)
  - Spectral tilt (high/low frequency ratio)

Requires: tau (TAU_SRC must point to tau installation)

Examples:
  vox analyze file output.mp3
  vox analyze summary output.mp3
  vox analyze batch "*.mp3" ./analysis/
EOF
                    ;;
            esac
            ;;

        # =================================================================
        # NEW ARCHITECTURE COMMANDS
        # =================================================================

        set)
            # Variable management: vox set voice shimmer
            vox_cmd_set "$@"
            ;;

        learn)
            # MIDI CC learning: vox learn voice
            vox_cmd_learn "$@"
            ;;

        cc)
            # CC mapping management: vox cc list
            vox_cmd_cc "$@"
            ;;

        provider|prov)
            # Provider management: vox provider status
            local subcmd="${1:-status}"
            shift || true

            case "$subcmd" in
                status|s)
                    vox_provider_status
                    ;;
                info|i)
                    vox_provider_info "$@"
                    ;;
                list|ls)
                    vox_list_providers
                    ;;
                *)
                    # Specific provider info
                    vox_provider_info "$subcmd"
                    ;;
            esac
            ;;

        formant|fm)
            # Research mode - direct formant/phoneme control
            if declare -f vox_formant_provider &>/dev/null; then
                local subcmd="${1:-info}"
                shift || true
                vox_formant_provider "$subcmd" "$@"
            else
                echo "Error: Formant provider not loaded" >&2
                echo "Ensure formant module is available" >&2
                return 1
            fi
            ;;

        karaoke|k)
            # Karaoke mode - TUI with sync display
            local voice="${1:-${VOX_VARS[voice]:-alloy}}"
            local source="$2"

            if [[ -z "$source" ]]; then
                echo "Usage: vox karaoke <voice> <source>" >&2
                echo "Example: vox karaoke shimmer qa:0" >&2
                return 1
            fi

            # TODO: Launch karaoke TUI
            echo "Karaoke mode: $voice $source"
            echo "(TUI implementation pending - using play for now)"
            vox_provider_play "$voice" "$source"
            ;;

        # =================================================================
        # LEGACY COMMANDS (kept for compatibility)
        # =================================================================

        repl)
            # Interactive REPL (legacy - consider using TUI)
            if declare -f vox_repl_main &>/dev/null; then
                vox_repl_main
            else
                echo "REPL not available" >&2
                return 1
            fi
            ;;

        tui)
            # Full TUI application
            local audio_file="$1"
            if declare -f vox_app_main &>/dev/null; then
                vox_app_main "$audio_file"
            else
                echo "TUI not available" >&2
                return 1
            fi
            ;;

        coqui|local)
            # Local TTS using Coqui
            vox_coqui "$@"
            ;;

        align|al)
            # Word-level alignment using faster-whisper
            vox_align "$@"
            ;;

        help|h|--help|-h)
            cat <<'EOF'
vox - Audio-text synchronization system

Usage: vox <command> <target> [options]

PLAYBACK (auto-detects provider from voice)
  play <voice> [source]     Generate and play audio
                            voice: shimmer, coqui:xtts, formant:ipa
                            source: qa:0, qa:latest, file.txt
  karaoke <voice> <source>  Karaoke TUI with sync display
  a <index> [voice]         QA shorthand: vox a 0 shimmer

PROVIDERS
  openai:   alloy ash coral echo fable nova onyx sage shimmer (cloud)
  coqui:    vits tacotron xtts (local ML)
  formant:  ipa (research - direct phoneme control)

VARIABLES & MIDI
  set [var] [value]     Get/set session variables
                        voice, provider, volume, speed, pitch, theme
  learn <var>           Learn MIDI CC for variable
  cc <list|clear|save>  Manage CC mappings

RESEARCH MODE (formant)
  formant speak "text"  Speak through formant engine
  formant ph <ipa> [dur] [pitch]  Direct phoneme
  formant emotion <name> [intensity]
  formant start/stop    Control engine

PROVIDER MANAGEMENT
  provider status       Show all provider status
  provider info [name]  Detailed provider info
  coqui install         Install Coqui TTS locally
  coqui status          Check Coqui installation

WORD ALIGNMENT (faster-whisper)
  align install         Install faster-whisper
  align status          Check alignment status
  align file <audio>    Get word timings from audio
  align cues <audio>    Output in timeline cue format
  align spans <audio>   Output in SpanDoc format
  align generate <voice> Generate audio + align from stdin

ANALYSIS
  analyze file <audio>  Full JSON analysis (tau filter bank)
  analyze summary <audio>
  dry-run qa <ref>      Analyze without API call

LIST & INFO
  ls [mp3|esto|qa|cache|voices|providers]
  info <file>           Show file metadata

Interactive:
  tui [file]            Full TUI with waveform, timeline
  karaoke <voice> <src> Karaoke display with sync

Legacy Commands:
  ls [type]             List audio files and sources (default: mp3)
                        - ls         Recent MP3 files with metadata
                        - ls mp3     All MP3 files
                        - ls esto    esto files with generation status
                        - ls recent  Last N generated files
                        - ls project Project overview
                        - ls qa      QA answers with IDs
                        - ls cache   Cache statistics
                        - ls all     Complete view
  info <file>           Show detailed file metadata

Sound Commands:
  sound generate        Generate sound from pattern notation
  sound play            Generate and play sound pattern

Cache Commands:
  cache stats           Show cache statistics
  cache info <hash>     Show info for specific content hash
  cache clean           Clean orphaned cache entries

Local TTS (Coqui):
  coqui status          Check Coqui TTS installation
  coqui install         Install Coqui TTS
  coqui models          List available models
  coqui play [model]    Generate and play locally (no API)
  coqui generate [out]  Generate audio file locally

QA Reference Formats:
  qa:0                  Latest answer (relative index)
  qa:1                  Second most recent (relative index)
  qa:latest             Latest answer (explicit)
  qa:1728756234         Specific answer by timestamp (absolute)

  Note: Numbers < 1000000000 are relative indices
        Numbers ≥ 1000000000 are absolute timestamps

Examples:
  # List available sources
  vox ls                           # Show all sources and cache
  vox ls qa                        # List QA answers with IDs

  # TTS pipe mode (no caching)
  echo "Hello world" | vox play alloy
  cat story.txt | vox generate nova --output story.mp3

  # TTS ID mode (with caching)
  vox a 0 sally                    # Play latest QA answer with sally
  vox play nova qa:1728756234      # Play specific QA answer by timestamp
  vox play alloy qa:latest         # Play latest QA answer
  qa a 1 | vox play alloy          # Pipe from QA (no caching)

  # Sound generation
  echo "bd sd cp hh" | vox sound generate --output beat.wav

Voices:
  alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer

Environment:
  OPENAI_API_KEY       OpenAI API key (or use: qa config apikey <key>)
  VOX_DIR              Data directory (default: $TETRA_DIR/vox)
  QA_DIR               QA database directory (shares api_key with vox)
  TAU_SRC              tau installation (for analyze command)
EOF
            ;;

        tau)
            # Tau audio engine integration
            if declare -f vox_tau_cmd &>/dev/null; then
                vox_tau_cmd "$@"
            else
                echo "Error: tau integration not loaded" >&2
                echo "  Source vox_tau.sh or ensure TAU_SRC is set" >&2
                return 1
            fi
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
