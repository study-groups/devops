#!/usr/bin/env bash

# vox_repl.sh - Interactive REPL for vox audio system
# Follows tsm REPL pattern with slash commands and history

# History management
VOX_HISTORY_LOG="$VOX_DIR/repl_history.log"
VOX_HISTORY_FILE="$VOX_DIR/.vox_history"
VOX_LAST_AUDIO=""

vox_repl_help() {
    cat <<'EOF'
Vox Interactive REPL
====================

Built-in Commands:
  /help, /?           Show this help
  /exit, /quit        Exit REPL
  /history [n]        Show command history (default: 20)
  /last [n]           Show last command output
  /clear              Clear screen
  /voices             List available voices
  /voice <name>       Set default voice
  /cache              Show cache statistics
  /cost               Show cost summary (future)

TTS Commands (without prefix):
  play <voice> <id>        Play audio from QA reference
  a <index> [voice]        Play QA answer (0=latest)
  gen <voice> <id> -o file Generate and save audio
  dry qa <id> [voice]      Dry-run QA reference
  dry batch <voice> [N]    Dry-run batch analysis
  ls [qa|cache]            List sources

Sound Commands:
  sound <pattern>          Generate and play sound pattern
  sound <pattern> -o file  Generate sound to file

QA Commands:
  qa ls                    List QA answers
  qa cat <id>              Show QA answer content
  qa info <id>             Show QA metadata

Bash Commands:
  !<command>               Execute bash command (e.g. !ls, !pwd)

Text Input:
  "<text>"                 Generate TTS from quoted text

Examples:
  a 0 sally                Play latest QA with sally
  play nova qa:5           Play QA #5 with nova
  dry qa qa:0 alloy        Analyze latest QA without API call
  sound "bd sd cp hh"      Play drum pattern
  "Hello world!"           Generate TTS from text
  !ls *.mp3                List audio files
  /voices                  Show available voices
EOF
}

vox_repl_save_output() {
    local command="$1"
    local output="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    mkdir -p "$(dirname "$VOX_HISTORY_LOG")"

    echo "==== ENTRY $timestamp ====" >> "$VOX_HISTORY_LOG"
    echo "COMMAND: $command" >> "$VOX_HISTORY_LOG"
    echo "OUTPUT:" >> "$VOX_HISTORY_LOG"
    echo "$output" >> "$VOX_HISTORY_LOG"
    echo "" >> "$VOX_HISTORY_LOG"
}

vox_repl_get_last() {
    local n="${1:-0}"

    if [[ ! -f "$VOX_HISTORY_LOG" ]]; then
        echo "No command history found"
        return 1
    fi

    local entry_lines=($(grep -n "^==== ENTRY" "$VOX_HISTORY_LOG" | cut -d: -f1))
    local total_entries=${#entry_lines[@]}

    if (( total_entries == 0 )); then
        echo "No command history found"
        return 1
    fi

    local entry_index=$((total_entries - 1 - n))

    if (( entry_index < 0 )); then
        echo "Not enough history entries (only $total_entries available)"
        return 1
    fi

    local start_line=${entry_lines[$entry_index]}
    local end_line

    if (( entry_index + 1 < total_entries )); then
        end_line=$((${entry_lines[$((entry_index + 1))]} - 1))
    else
        end_line=$(wc -l < "$VOX_HISTORY_LOG")
    fi

    sed -n "${start_line},${end_line}p" "$VOX_HISTORY_LOG"
}

vox_repl_list_voices() {
    echo "Available Voices:"
    echo "  alloy    - Neutral, balanced"
    echo "  echo     - Clear, articulate"
    echo "  fable    - Expressive, warm"
    echo "  onyx     - Deep, authoritative"
    echo "  nova     - Friendly, conversational"
    echo "  shimmer  - Bright, energetic"
    echo ""
    echo "Current: ${VOX_DEFAULT_VOICE:-alloy}"
}

vox_repl_set_voice() {
    local voice="$1"
    if [[ -z "$voice" ]]; then
        echo "Current voice: ${VOX_DEFAULT_VOICE:-alloy}"
        return 0
    fi

    case "$voice" in
        alloy|ash|coral|echo|fable|nova|onyx|sage|shimmer)
            export VOX_DEFAULT_VOICE="$voice"
            echo "Default voice set to: $voice"
            ;;
        *)
            echo "Unknown voice: $voice"
            echo "Valid voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer"
            return 1
            ;;
    esac
}

vox_repl_cache_stats() {
    echo "=== Cache Statistics ==="
    vox_cache_stats
}

vox_repl_process_command() {
    local input="$1"
    local output=""
    local skip_save=false

    # Handle slash commands
    if [[ "$input" =~ ^/ ]]; then
        local cmd="${input#/}"
        local args=""

        if [[ "$cmd" =~ [[:space:]] ]]; then
            args="${cmd#* }"
            cmd="${cmd%% *}"
        fi

        case "$cmd" in
            help|"?")
                vox_repl_help
                skip_save=true
                ;;
            exit|quit)
                return 1
                ;;
            history|hist)
                local lines="${args:-20}"
                if [[ -f "$VOX_HISTORY_FILE" ]]; then
                    output=$(tail -n "$lines" "$VOX_HISTORY_FILE" | nl -w3 -s': ')
                    echo "Vox Command History (last $lines commands):"
                    echo "$output"
                else
                    echo "No command history found"
                fi
                ;;
            last)
                vox_repl_get_last "$args"
                skip_save=true
                ;;
            clear|cls)
                clear
                skip_save=true
                ;;
            voices|v)
                vox_repl_list_voices
                skip_save=true
                ;;
            voice)
                vox_repl_set_voice "$args"
                skip_save=true
                ;;
            cache|c)
                vox_repl_cache_stats
                ;;
            cost)
                echo "Cost tracking coming soon!"
                skip_save=true
                ;;
            *)
                echo "Unknown command: /$cmd"
                echo "Type /help for available commands"
                ;;
        esac

    elif [[ "$input" =~ ^! ]]; then
        # Bash command (prefixed with !)
        local bash_cmd="${input#!}"
        if [[ -n "$bash_cmd" ]]; then
            output=$(eval "$bash_cmd" 2>&1)
            echo "$output"
        fi

    elif [[ "$input" =~ ^\".*\"$ ]]; then
        # Quoted text - generate TTS
        local text="${input:1:-1}"  # Remove quotes
        local voice="${VOX_DEFAULT_VOICE:-alloy}"
        echo "🔊 Generating TTS with $voice..."
        output=$(echo "$text" | vox play "$voice" 2>&1)
        echo "$output"

    else
        # Parse vox commands
        local cmd args
        read -r cmd args <<< "$input"

        case "$cmd" in
            play|p)
                # play <voice> <id>
                local voice id
                read -r voice id <<< "$args"
                if [[ -z "$id" ]]; then
                    echo "Usage: play <voice> <id>"
                    echo "Example: play sally qa:0"
                else
                    echo "🔊 Playing $id with $voice..."
                    output=$(vox play "$voice" "$id" 2>&1)
                    echo "$output"
                    VOX_LAST_AUDIO="$voice:$id"
                fi
                ;;

            a)
                # a <index> [voice]
                local index voice
                read -r index voice <<< "$args"
                voice="${voice:-${VOX_DEFAULT_VOICE:-alloy}}"

                if [[ -z "$index" ]]; then
                    echo "Usage: a <index> [voice]"
                    echo "Example: a 0 sally"
                else
                    echo "🔊 Playing qa:$index with $voice..."
                    output=$(vox a "$index" "$voice" 2>&1)
                    echo "$output"
                    VOX_LAST_AUDIO="$voice:qa:$index"
                fi
                ;;

            gen|generate)
                # gen <voice> <id> -o <file>
                echo "Generate command: $args"
                output=$(eval "vox generate $args" 2>&1)
                echo "$output"
                ;;

            dry|analyze)
                # dry qa <id> [voice] OR dry batch <voice> [N]
                local subcmd rest
                read -r subcmd rest <<< "$args"

                case "$subcmd" in
                    qa)
                        local id voice
                        read -r id voice <<< "$rest"
                        voice="${voice:-${VOX_DEFAULT_VOICE:-alloy}}"

                        if [[ -z "$id" ]]; then
                            echo "Usage: dry qa <id> [voice]"
                        else
                            output=$(vox dry-run qa "$id" "$voice" 2>&1)
                            echo "$output"
                        fi
                        ;;
                    batch)
                        local voice start count
                        read -r voice start count <<< "$rest"
                        voice="${voice:-${VOX_DEFAULT_VOICE:-alloy}}"
                        start="${start:-0}"
                        count="${count:-5}"

                        output=$(vox dry-run batch "$voice" "$start" "$count" 2>&1)
                        echo "$output"
                        ;;
                    stdin)
                        # dry stdin <voice> - read from next line
                        local voice
                        read -r voice <<< "$rest"
                        voice="${voice:-${VOX_DEFAULT_VOICE:-alloy}}"

                        echo "Enter text (Ctrl-D when done):"
                        local text=$(cat)
                        output=$(echo "$text" | vox dry-run stdin "$voice" 2>&1)
                        echo "$output"
                        ;;
                    *)
                        echo "Usage: dry qa <id> [voice] | dry batch <voice> [start] [count] | dry stdin [voice]"
                        ;;
                esac
                ;;

            sound|s)
                # sound <pattern> [-o <file>]
                if [[ -z "$args" ]]; then
                    echo "Usage: sound <pattern> [-o file]"
                    echo "Example: sound \"bd sd cp hh\""
                else
                    echo "🎵 Generating sound..."
                    output=$(echo "$args" | vox sound play 2>&1)
                    echo "$output"
                fi
                ;;

            ls|list)
                # ls [qa|cache]
                local subcmd
                read -r subcmd <<< "$args"
                output=$(vox ls "$subcmd" 2>&1)
                echo "$output"
                ;;

            qa)
                # qa ls | qa cat <id> | qa info <id>
                local subcmd rest
                read -r subcmd rest <<< "$args"

                case "$subcmd" in
                    ls|list)
                        output=$(vox ls qa 2>&1)
                        echo "$output"
                        ;;
                    cat|show)
                        if [[ -n "$rest" ]]; then
                            local path=$(vox_qa_get_path "qa:$rest" 2>/dev/null)
                            if [[ -f "$path" ]]; then
                                output=$(cat "$path")
                                echo "$output"
                            else
                                echo "QA answer not found: $rest"
                            fi
                        else
                            echo "Usage: qa cat <id>"
                        fi
                        ;;
                    info)
                        if [[ -n "$rest" ]]; then
                            local path=$(vox_qa_get_path "qa:$rest" 2>/dev/null)
                            if [[ -f "$path" ]]; then
                                echo "QA Answer: $rest"
                                echo "Path: $path"
                                echo "Size: $(stat -f%z "$path" 2>/dev/null || stat -c%s "$path" 2>/dev/null) bytes"
                                local prompt=$(vox_qa_get_prompt "$rest" 2>/dev/null)
                                echo "Prompt: $prompt"
                            else
                                echo "QA answer not found: $rest"
                            fi
                        else
                            echo "Usage: qa info <id>"
                        fi
                        ;;
                    *)
                        echo "Usage: qa ls | qa cat <id> | qa info <id>"
                        ;;
                esac
                ;;

            help|h)
                vox_repl_help
                skip_save=true
                ;;

            "")
                # Empty input - show QA list
                output=$(vox ls qa 2>/dev/null || echo "No QA sources available")
                echo "$output"
                ;;

            *)
                echo "Unknown command: $cmd"
                echo "Type /help or help for available commands"
                ;;
        esac
    fi

    # Save command and output to history
    if [[ "$skip_save" == "false" && -n "$input" && -n "$output" ]]; then
        vox_repl_save_output "$input" "$output"
    fi

    return 0
}

vox_repl_main() {
    echo "🔊 Vox Interactive REPL"
    echo "Type /help for commands, /exit or Ctrl-C to quit"
    echo "Default voice: ${VOX_DEFAULT_VOICE:-alloy}"
    echo ""

    # Ensure directories exist
    mkdir -p "$VOX_DIR"
    mkdir -p "$(dirname "$VOX_HISTORY_FILE")"

    # Trap Ctrl-C to exit gracefully
    trap 'echo -e "\n👋 Goodbye!"; exit 0' SIGINT

    while true; do
        # Read input with history support
        if [[ -t 0 ]]; then
            read -e -r -p "vox> " input || break
        else
            echo -n "vox> "
            read -r input || break
        fi

        # Save to history
        if [[ -n "$input" ]]; then
            echo "$input" >> "$VOX_HISTORY_FILE"
        fi

        # Process command
        case "$input" in
            /exit|/quit)
                echo "👋 Goodbye!"
                break
                ;;
            *)
                if ! vox_repl_process_command "$input"; then
                    break
                fi
                ;;
        esac

        echo
    done
}

# Export functions
export -f vox_repl_main
export -f vox_repl_process_command
export -f vox_repl_help
