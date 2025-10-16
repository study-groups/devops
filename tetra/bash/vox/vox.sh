#!/usr/bin/env bash

# vox - Audio-text synchronization system
# Pipe-first TTS + sound generation

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
source "$VOX_SRC/vox_repl.sh"

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
            # Dual mode: pipe or ID
            local voice="${1:-alloy}"
            local source_id="$2"

            if [[ -n "$source_id" ]]; then
                # ID mode: vox play sally qa:1
                vox_play_id "$voice" "$source_id"
            else
                # Pipe mode: echo "text" | vox play sally
                vox_play "$voice"
            fi
            ;;

        a)
            # QA shorthand: vox a 1 sally
            local index="${1:-0}"
            local voice="${2:-alloy}"
            vox_play_id "$voice" "qa:$index"
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

        dry-run|dry|analyze)
            # Dry-run analysis - no API calls
            local subcmd="${1:-help}"
            shift || true

            case "$subcmd" in
                qa)
                    # Analyze specific QA reference
                    local qa_ref="${1:-qa:0}"
                    local voice="${2:-alloy}"
                    vox_dry_run_qa "$qa_ref" "$voice"
                    ;;
                file)
                    # Analyze file
                    local file_path="$1"
                    local voice="${2:-alloy}"
                    vox_dry_run_file "$file_path" "$voice"
                    ;;
                batch)
                    # Batch analysis of multiple QA answers
                    local voice="${1:-alloy}"
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

        repl)
            # Interactive REPL
            vox_repl_main
            ;;

        help|h|--help|-h)
            cat <<'EOF'
vox - Audio-text synchronization system

Usage: vox <command> [options]

TTS Commands:
  play <voice> [id]     Generate and play audio
                        - Pipe mode: cat file | vox play sally
                        - ID mode: vox play sally qa:1728756234
  a <index> [voice]     QA shorthand: vox a 0 sally
  generate <voice> [id] Generate TTS audio
                        - Pipe mode: cat file | vox generate sally -o file.mp3
                        - ID mode: vox generate sally qa:1728756234 -o file.mp3

Analysis Commands:
  dry-run <subcommand>  Analyze inputs without making API calls
                        - qa <ref> [voice]         Analyze QA reference
                        - file <path> [voice]      Analyze file
                        - batch [voice] [start] [N] Analyze N QA answers
                        - stdin [voice]            Analyze stdin
                        Use 'vox dry-run help' for details

Interactive:
  repl                  Start interactive REPL (tsm-style interface)

List Commands:
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
  alloy, echo, fable, onyx, nova, shimmer

Environment:
  OPENAI_API_KEY       OpenAI API key for TTS
  VOX_DIR              Data directory (default: $TETRA_DIR/vox)
  QA_DIR               QA database directory (for qa: references)
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
