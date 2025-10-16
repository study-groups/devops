#!/usr/bin/env bash

# Vox REPL - Interactive Text-to-Speech system with QA integration

vox_repl() {
    echo "🔊 Vox Interactive REPL - Text-to-Speech System"
    echo "Commands: ls, a, id, voices, voice, grade, matrix, qa, help, status, exit"
    echo "Current voice: $(_vox_get_active_voice)"
    echo "Tip: Use 'a 1' to speak last QA answer!"
    echo

    while true; do
        read -e -p "vox> " input

        # Handle empty input
        [[ -z "$input" ]] && continue

        # Add to history
        history -s "$input"

        # Parse command and arguments
        read -r cmd args <<< "$input"

        case "$cmd" in
            "exit"|"quit"|"q")
                echo "Thanks for using Say!"
                break
                ;;
            "help"|"h")
                _vox_repl_help "$args"
                ;;
            "status"|"s")
                vox_status
                ;;
            "a")
                # Vox QA answer by index
                if [[ -n "$args" ]]; then
                    vox_answer $args
                else
                    echo "Usage: a <index> [voice]"
                fi
                ;;
            "id")
                # Vox specific QA ID
                if [[ -n "$args" ]]; then
                    vox_by_id $args
                else
                    echo "Usage: id <qa_id> [voice]"
                fi
                ;;
            "text"|"say")
                # Vox arbitrary text
                if [[ -n "$args" ]]; then
                    vox_text "$args"
                else
                    echo "Usage: text <text> [voice]"
                fi
                ;;
            "replay"|"r")
                vox_replay
                ;;
            "voices"|"v")
                vox_list_voices
                ;;
            "voice")
                if [[ -n "$args" ]]; then
                    vox_set_voice "$args"
                else
                    vox_get_active_voice
                fi
                ;;
            "voice-test")
                vox_voice_test "$args"
                ;;
            "voice-enable")
                vox_voice_enable "$args"
                ;;
            "voice-disable")
                vox_voice_disable "$args"
                ;;
            "matrix")
                vox_show_matrix $args
                ;;
            "generate-matrix")
                vox_generate_matrix $args
                ;;
            "grade")
                # Parse: grade <qa_id> <voice> <rating> [notes]
                read -r qa_id voice rating notes <<< "$args"
                vox_grade "$qa_id" "$voice" "$rating" "$notes"
                ;;
            "grades")
                vox_show_grades $args
                ;;
            "best")
                vox_play_best $args
                ;;
            "cache")
                vox_cache_status
                ;;
            "cost")
                vox_cost_summary
                ;;
            "cost-by-voice")
                vox_cost_by_voice
                ;;
            "qa")
                # Run QA query and speak result
                if [[ -n "$args" ]]; then
                    echo "🔍 Querying QA: $args"
                    local answer=$(qa query "$args")
                    if [[ $? -eq 0 ]]; then
                        echo
                        echo "$answer"
                        echo
                        echo "🔊 Speaking answer..."
                        say a 0  # Speak last answer
                    fi
                else
                    echo "Usage: qa <question>"
                fi
                ;;
            "clear")
                clear
                ;;
            "pwd")
                pwd
                ;;
            "ls")
                vox_ls $args
                ;;
            "")
                # Empty input, continue
                ;;
            *)
                # Treat as text to say
                echo "🔊 Speaking: $input"
                vox_text "$input"
                ;;
        esac
    done
}

_vox_repl_help() {
    local topic="$1"

    case "$topic" in
        "voices")
            cat <<EOF
🔊 Voice Management:

Available commands:
  voices               - List all available voices
  voice <id>           - Set active voice
  voice-test <id>      - Test a voice
  voice-enable <id>    - Enable a voice
  voice-disable <id>   - Disable a voice

Voice naming:
  Voices have friendly IDs like "sally", "marcus", "alex"
  Each voice has tags like [female], [male], [non-binary]

Configuration:
  voice-available/     - All possible voice configs
  voice-enabled/       - Currently enabled voices (symlinks)
EOF
            ;;
        "qa")
            cat <<EOF
🔊 QA Integration:

Commands:
  a <index> [voice]    - Vox QA answer (0=last, 1=second-to-last, etc.)
  id <qa_id> [voice]   - Vox specific QA ID
  qa <question>        - Ask QA and speak the answer

Matrix commands:
  matrix [qa_id]       - Show voice matrix for QA answer(s)
  generate-matrix <id> - Generate all voice variations for an answer

Grading:
  grade <qa_id> <voice> <1-5> [notes]  - Rate a voice/answer combo
  grades [qa_id]       - Show grades
  best <qa_id>         - Play best-rated voice

File naming:
  {qa_id}.vox.{voice}.mp3     - Audio file
  {qa_id}.vox.{voice}.meta    - Metadata (cost, timing)
  {qa_id}.vox.{voice}.grade   - User rating
EOF
            ;;
        *)
            cat <<EOF
🔊 Vox Interactive REPL Help:

Quick Start:
  a 1                  - Vox last QA answer
  a 1 marcus           - Vox last answer with Marcus voice
  qa What is AI?       - Ask QA and speak answer
  voices               - List available voices
  voice sally          - Switch to Sally voice

Core Commands:
  ls [filter]          - List all audio files (table format)
  a <index> [voice]    - Vox QA answer by index
  id <qa_id> [voice]   - Vox specific QA ID
  text <text> [voice]  - Vox arbitrary text
  replay               - Replay last audio
  qa <question>        - Ask QA and speak answer

Voice Management:
  voices               - List all voices
  voice <id>           - Set active voice
  voice-test <id>      - Test a voice

Matrix & Grading:
  matrix [qa_id]       - Show voice matrix
  grade <qa_id> <voice> <1-5> [notes]  - Rate a combo
  grades [qa_id]       - Show grades
  best <qa_id>         - Play best-rated voice

System:
  cache                - Show cache statistics
  cost                 - Show cost summary
  status               - System status
  help <topic>         - Help (topics: voices, qa)
  exit                 - Exit REPL

Caching:
  Vox caches all generated audio. Requests for the same
  QA ID + voice combination are served from cache instantly.

Type 'help voices' or 'help qa' for more details.
EOF
            ;;
    esac
}
