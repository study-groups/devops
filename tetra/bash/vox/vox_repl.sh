#!/usr/bin/env bash
# vox_repl.sh - Interactive REPL for vox audio system
# Uses tetra REPL framework for proper tab completion

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Run: source ~/tetra/tetra.sh" >&2
    exit 1
fi

# Source the tetra REPL framework
source "$TETRA_SRC/bash/repl/repl.sh"

# Set module name for completion
REPL_MODULE_NAME="vox"

# REPL state
VOX_REPL_VOICE="${VOX_DEFAULT_VOICE:-alloy}"
VOX_LAST_AUDIO=""

# Static completions for vox REPL
_vox_static_completions() {
    # Commands
    cat <<'EOF'
play
p
a
gen
generate
dry
sound
s
ls
list
qa
help
h
/help
/exit
/quit
/history
/voices
/voice
/cache
/clear
EOF

    # Voices
    cat <<'EOF'
alloy
ash
coral
echo
fable
nova
onyx
sage
shimmer
EOF

    # QA references
    echo "qa:0"
    echo "qa:1"
    echo "qa:2"
    echo "qa:latest"

    # Dry-run subcommands
    cat <<'EOF'
batch
stdin
file
EOF

    # QA subcommands
    cat <<'EOF'
cat
info
EOF

    # Sound subcommands
    cat <<'EOF'
generate
EOF

    # Ls subcommands
    cat <<'EOF'
qa
cache
mp3
EOF
}

# Try to register with nav system, fall back to static
if command -v repl_register_nav_completion >/dev/null 2>&1; then
    repl_register_nav_completion "help.vox" "_vox_static_completions"
else
    # Fallback: just register static completions
    repl_set_completion_generator "_vox_static_completions" 2>/dev/null || true
fi

# Build prompt: vox [voice] n >
_vox_repl_build_prompt() {
    local voice="${VOX_REPL_VOICE:-alloy}"
    local qa_count=0

    # Count QA answers if directory exists
    local qa_dir="${QA_DIR:-$TETRA_DIR/qa}/db"
    if [[ -d "$qa_dir" ]]; then
        qa_count=$(find "$qa_dir" -name "*.answer" 2>/dev/null | wc -l | tr -d ' ')
    fi

    # Simple colored prompt
    REPL_PROMPT="vox [$voice] $qa_count > "
}

# Process REPL input
_vox_repl_process_input() {
    local input="$1"

    # Empty input - show status
    [[ -z "$input" ]] && return 0

    # Shell escape (!cmd)
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Slash commands
    if [[ "$input" =~ ^/ ]]; then
        local cmd="${input#/}"
        local args=""
        if [[ "$cmd" =~ [[:space:]] ]]; then
            args="${cmd#* }"
            cmd="${cmd%% *}"
        fi

        case "$cmd" in
            help|"?")
                _vox_repl_help
                ;;
            exit|quit)
                return 1
                ;;
            history|hist)
                local lines="${args:-20}"
                if [[ -f "$REPL_HISTORY_FILE" ]]; then
                    echo "Vox Command History (last $lines):"
                    tail -n "$lines" "$REPL_HISTORY_FILE" | nl -w3 -s': '
                else
                    echo "No command history found"
                fi
                ;;
            clear|cls)
                clear
                ;;
            voices|v)
                _vox_repl_list_voices
                ;;
            voice)
                _vox_repl_set_voice "$args"
                ;;
            cache|c)
                vox_cache_stats 2>/dev/null || echo "Cache stats unavailable"
                ;;
            cost)
                echo "Cost tracking coming soon!"
                ;;
            *)
                echo "Unknown command: /$cmd"
                echo "Type /help for available commands"
                ;;
        esac
        return 0
    fi

    # Quoted text - generate TTS directly
    if [[ "$input" =~ ^\".*\"$ ]]; then
        local text="${input:1:-1}"
        local voice="${VOX_REPL_VOICE:-alloy}"
        echo "Generating TTS with $voice..."
        echo "$text" | vox play "$voice" 2>&1
        return 0
    fi

    # Parse vox commands
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$cmd" == "$input" ]] && args=""

    case "$cmd" in
        play|p)
            # play <voice> <id>
            local voice id
            read -r voice id <<< "$args"
            if [[ -z "$id" ]]; then
                echo "Usage: play <voice> <id>"
                echo "Example: play sally qa:0"
            else
                echo "Playing $id with $voice..."
                vox play "$voice" "$id" 2>&1
                VOX_LAST_AUDIO="$voice:$id"
            fi
            ;;

        a)
            # a <index> [voice]
            local index voice
            read -r index voice <<< "$args"
            voice="${voice:-${VOX_REPL_VOICE:-alloy}}"

            if [[ -z "$index" ]]; then
                echo "Usage: a <index> [voice]"
                echo "Example: a 0 sally"
            else
                echo "Playing qa:$index with $voice..."
                vox a "$index" "$voice" 2>&1
                VOX_LAST_AUDIO="$voice:qa:$index"
            fi
            ;;

        gen|generate)
            # gen <voice> <id> -o <file>
            echo "Generate command: $args"
            eval "vox generate $args" 2>&1
            ;;

        dry|analyze)
            # dry qa <id> [voice] OR dry batch <voice> [N]
            local subcmd rest
            read -r subcmd rest <<< "$args"

            case "$subcmd" in
                qa)
                    local id voice
                    read -r id voice <<< "$rest"
                    voice="${voice:-${VOX_REPL_VOICE:-alloy}}"

                    if [[ -z "$id" ]]; then
                        echo "Usage: dry qa <id> [voice]"
                    else
                        vox dry-run qa "$id" "$voice" 2>&1
                    fi
                    ;;
                batch)
                    local voice start count
                    read -r voice start count <<< "$rest"
                    voice="${voice:-${VOX_REPL_VOICE:-alloy}}"
                    start="${start:-0}"
                    count="${count:-5}"
                    vox dry-run batch "$voice" "$start" "$count" 2>&1
                    ;;
                stdin)
                    local voice
                    read -r voice <<< "$rest"
                    voice="${voice:-${VOX_REPL_VOICE:-alloy}}"
                    echo "Enter text (Ctrl-D when done):"
                    local text=$(cat)
                    echo "$text" | vox dry-run stdin "$voice" 2>&1
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
                echo "Generating sound..."
                echo "$args" | vox sound play 2>&1
            fi
            ;;

        ls|list)
            # ls [qa|cache]
            vox ls "$args" 2>&1
            ;;

        qa)
            # qa ls | qa cat <id> | qa info <id>
            local subcmd rest
            read -r subcmd rest <<< "$args"

            case "$subcmd" in
                ls|list|"")
                    vox ls qa 2>&1
                    ;;
                cat|show)
                    if [[ -n "$rest" ]]; then
                        local path
                        path=$(vox_qa_get_path "qa:$rest" 2>/dev/null)
                        if [[ -f "$path" ]]; then
                            cat "$path"
                        else
                            echo "QA answer not found: $rest"
                        fi
                    else
                        echo "Usage: qa cat <id>"
                    fi
                    ;;
                info)
                    if [[ -n "$rest" ]]; then
                        local path
                        path=$(vox_qa_get_path "qa:$rest" 2>/dev/null)
                        if [[ -f "$path" ]]; then
                            echo "QA Answer: $rest"
                            echo "Path: $path"
                            echo "Size: $(stat -f%z "$path" 2>/dev/null || stat -c%s "$path" 2>/dev/null) bytes"
                            local prompt
                            prompt=$(vox_qa_get_prompt "$rest" 2>/dev/null)
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
            _vox_repl_help
            ;;

        exit|quit|q)
            return 1
            ;;

        "")
            # Empty - show QA list
            vox ls qa 2>/dev/null || echo "No QA sources available"
            ;;

        *)
            echo "Unknown command: $cmd"
            echo "Type /help or help for available commands"
            ;;
    esac

    return 0
}

_vox_repl_help() {
    cat <<'EOF'
Vox Interactive REPL
====================

Built-in Commands:
  /help, /?           Show this help
  /exit, /quit        Exit REPL
  /history [n]        Show command history (default: 20)
  /clear              Clear screen
  /voices             List available voices
  /voice <name>       Set default voice
  /cache              Show cache statistics

TTS Commands:
  play <voice> <id>        Play audio from QA reference
  a <index> [voice]        Play QA answer (0=latest)
  gen <voice> <id> -o file Generate and save audio
  dry qa <id> [voice]      Dry-run QA reference
  dry batch <voice> [N]    Dry-run batch analysis

Sound Commands:
  sound <pattern>          Generate and play sound pattern

QA Commands:
  qa ls                    List QA answers
  qa cat <id>              Show QA answer content
  qa info <id>             Show QA metadata

Bash Commands:
  !<command>               Execute bash command

Text Input:
  "<text>"                 Generate TTS from quoted text

Tab Completion:
  Press TAB to complete commands and arguments
  Press TAB twice to see all options

Examples:
  a 0 sally                Play latest QA with sally
  play nova qa:5           Play QA #5 with nova
  dry qa qa:0 alloy        Analyze latest QA
  sound "bd sd cp hh"      Play drum pattern
  "Hello world!"           Generate TTS from text
EOF
}

_vox_repl_list_voices() {
    echo "Available Voices:"
    echo "  alloy    - Neutral, balanced"
    echo "  ash      - Clear, articulate"
    echo "  coral    - Warm, conversational"
    echo "  echo     - Clear, articulate"
    echo "  fable    - Expressive, warm"
    echo "  nova     - Friendly, conversational"
    echo "  onyx     - Deep, authoritative"
    echo "  sage     - Wise, calm"
    echo "  shimmer  - Bright, energetic"
    echo ""
    echo "Current: ${VOX_REPL_VOICE:-alloy}"
}

_vox_repl_set_voice() {
    local voice="$1"
    if [[ -z "$voice" ]]; then
        echo "Current voice: ${VOX_REPL_VOICE:-alloy}"
        return 0
    fi

    case "$voice" in
        alloy|ash|coral|echo|fable|nova|onyx|sage|shimmer)
            VOX_REPL_VOICE="$voice"
            echo "Default voice set to: $voice"
            ;;
        *)
            echo "Unknown voice: $voice"
            echo "Valid voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer"
            return 1
            ;;
    esac
}

# Main REPL entry point
vox_repl() {
    # Register with REPL system
    repl_register_module "vox" "play a gen dry sound ls qa"

    # Set module context
    repl_set_module_context "vox"

    # Set history base
    REPL_HISTORY_BASE="${TETRA_DIR}/vox/repl_history"

    # Set execution mode
    REPL_EXECUTION_MODE="takeover"

    # Override REPL callbacks
    repl_build_prompt() { _vox_repl_build_prompt "$@"; }
    repl_process_input() { _vox_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Welcome message
    cat <<EOF
Vox Interactive REPL
====================
Voice synthesis and audio generation

Current voice: ${VOX_REPL_VOICE:-alloy}
Tab completion enabled - press TAB for commands

Commands: play, a, dry, sound, qa, ls
Type 'help' for all commands, '/exit' to quit
EOF
    echo ""

    # Run the REPL
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    echo "Goodbye!"
}

# Backward compatibility - original function name
vox_repl_main() {
    vox_repl "$@"
}

# Export functions
export -f vox_repl
export -f vox_repl_main
export -f _vox_repl_build_prompt
export -f _vox_repl_process_input
export -f _vox_repl_help
export -f _vox_repl_list_voices
export -f _vox_repl_set_voice
export -f _vox_static_completions

# Launch REPL if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    vox_repl "$@"
fi
