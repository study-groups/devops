#!/usr/bin/env bash
# Estovox REPL Commands
# Command processing and execution

# === COMMAND HANDLERS ===

estovox_cmd_phoneme() {
    local phoneme=$1
    local rate=${2:-0.3}

    if [[ -z "$phoneme" ]]; then
        echo "Usage: phoneme <ipa> [rate]" >&2
        return 1
    fi

    estovox_apply_preset "$phoneme" "$rate"
}

estovox_cmd_expression() {
    local expr=$1
    local rate=${2:-0.3}

    if [[ -z "$expr" ]]; then
        echo "Usage: expression <name> [rate]" >&2
        return 1
    fi

    estovox_apply_preset "$expr" "$rate"
}

estovox_cmd_set() {
    local param=$1
    local value=$2
    local rate=${3:-0.2}

    if [[ -z "$param" ]] || [[ -z "$value" ]]; then
        echo "Usage: set <param> <value> [rate]" >&2
        return 1
    fi

    # Add prefix if not present
    if [[ ! "$param" =~ ^ESTOVOX_ ]]; then
        param="ESTOVOX_${param}"
    fi

    estovox_set_target "$param" "$value" "$rate"
}

estovox_cmd_setimm() {
    local param=$1
    local value=$2

    if [[ -z "$param" ]] || [[ -z "$value" ]]; then
        echo "Usage: setimm <param> <value>" >&2
        return 1
    fi

    # Add prefix if not present
    if [[ ! "$param" =~ ^ESTOVOX_ ]]; then
        param="ESTOVOX_${param}"
    fi

    estovox_set_param "$param" "$value"
}

estovox_cmd_get() {
    local param=$1

    if [[ -z "$param" ]]; then
        echo "Usage: get <param>" >&2
        return 1
    fi

    # Add prefix if not present
    if [[ ! "$param" =~ ^ESTOVOX_ ]]; then
        param="ESTOVOX_${param}"
    fi

    estovox_get_param "$param"
}

estovox_cmd_sequence() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: sequence <phoneme:duration_ms> [...]" >&2
        return 1
    fi

    estovox_play_sequence "$@"
}

estovox_cmd_say() {
    local text=$*

    if [[ -z "$text" ]]; then
        echo "Usage: say <text>" >&2
        return 1
    fi

    # Simple text-to-phoneme mapping (could be expanded)
    local -a phonemes=()
    local char

    for ((i=0; i<${#text}; i++)); do
        char="${text:$i:1}"
        case "$char" in
            a|A) phonemes+=("a:150") ;;
            e|E) phonemes+=("e:150") ;;
            i|I) phonemes+=("i:150") ;;
            o|O) phonemes+=("o:150") ;;
            u|U) phonemes+=("u:150") ;;
            m|M) phonemes+=("m:100") ;;
            p|P) phonemes+=("p:80") ;;
            b|B) phonemes+=("b:80") ;;
            s|S) phonemes+=("s:120") ;;
            w|W) phonemes+=("w:100") ;;
            l|L) phonemes+=("l:100") ;;
            r|R) phonemes+=("r:100") ;;
            h|H) phonemes+=("h:80") ;;
            " ") phonemes+=("rest:100") ;;
            *) phonemes+=("schwa:100") ;;
        esac
    done

    estovox_play_sequence "${phonemes[@]}"
}

estovox_cmd_reset() {
    estovox_reset_state
    echo "State reset to defaults"
}

estovox_cmd_clear() {
    tput clear
}

estovox_cmd_ipa() {
    # Source IPA chart if not already loaded
    if ! type -t estovox_render_ipa_chart >/dev/null 2>&1; then
        local mod_dir="${BASH_SOURCE[0]%/*}/.."
        source "$mod_dir/tui/ipa_chart.sh"
    fi

    estovox_render_ipa_chart
}

estovox_cmd_controls() {
    # Source IPA chart module for controls help
    if ! type -t estovox_render_controls_help >/dev/null 2>&1; then
        local mod_dir="${BASH_SOURCE[0]%/*}/.."
        source "$mod_dir/tui/ipa_chart.sh"
    fi

    estovox_render_controls_help
}

estovox_cmd_interactive() {
    echo "Switching to interactive mode..."
    echo "(This command only works in TUI mode, not legacy REPL)"
    sleep 2
}

estovox_cmd_list() {
    local what=${1:-all}

    # Clear screen for list output
    tput clear

    case $what in
        phonemes|phoneme)
            estovox_list_phonemes
            ;;
        expressions|expression|expr)
            estovox_list_expressions
            ;;
        params|parameters)
            echo "Animatable Parameters:"
            for param in "${ESTOVOX_PARAMS[@]}"; do
                local short_name="${param#ESTOVOX_}"
                local value=$(estovox_get_param "$param")
                printf "  %-25s %.3f\n" "$short_name" "$value"
            done
            ;;
        all)
            echo "=== Phonemes ==="
            estovox_list_phonemes
            echo ""
            echo "=== Expressions ==="
            estovox_list_expressions
            ;;
        *)
            echo "Usage: list [phonemes|expressions|params|all]" >&2
            return 1
            ;;
    esac

    echo ""
    echo "Press any key to continue..."
    read -n 1 -s
    tput clear
}

estovox_cmd_help() {
    # Clear the screen first
    tput clear

    cat <<'EOF'
╭────────────────────────────────────────────────────────────╮
│                    Estovox REPL Commands                    │
╰────────────────────────────────────────────────────────────╯

Articulation:
  ph, phoneme <ipa> [rate]     - Articulate IPA phoneme
  expr <name> [rate]            - Apply facial expression
  say <text>                    - Simple text articulation
  seq <ph:ms> <ph:ms> ...       - Play phoneme sequence

State Control:
  set <param> <value> [rate]    - Tween parameter to value
  setimm <param> <value>        - Set parameter immediately
  get <param>                   - Get current parameter value
  reset                         - Reset all state to defaults

Information:
  list [type]                   - List available presets/params
    - phonemes                  - List IPA phonemes
    - expressions               - List expressions
    - params                    - List all parameters
    - all                       - List everything
  ipa, chart                    - Show IPA phoneme chart (color-coded)
  controls                      - Show keyboard controls help
  help                          - Show this help
  clear                         - Clear screen and redraw

Mode Control (TUI only):
  interactive, int              - Switch to interactive mode

Control:
  quit, exit                    - Exit Estovox

Examples:
  ph a 0.5                      - Articulate 'a' sound
  expr happy                    - Show happy expression
  seq a:200 i:150 u:200         - Sequence: a-i-u
  say hello                     - Say "hello"
  set JAW_OPENNESS 0.8 0.3      - Open jaw smoothly

Shortcuts:
  ph = phoneme
  seq = sequence
EOF

    echo ""
    echo "Press any key to continue..."
    read -n 1 -s
    tput clear
}

# === COMMAND DISPATCHER ===

estovox_process_command() {
    local cmd=$1
    shift

    case $cmd in
        ph|phoneme)
            estovox_cmd_phoneme "$@"
            ;;
        expr|expression)
            estovox_cmd_expression "$@"
            ;;
        set)
            estovox_cmd_set "$@"
            ;;
        setimm)
            estovox_cmd_setimm "$@"
            ;;
        get)
            estovox_cmd_get "$@"
            ;;
        seq|sequence)
            estovox_cmd_sequence "$@"
            ;;
        say)
            estovox_cmd_say "$@"
            ;;
        reset)
            estovox_cmd_reset "$@"
            ;;
        clear|cls)
            estovox_cmd_clear "$@"
            ;;
        ipa|chart)
            estovox_cmd_ipa "$@"
            ;;
        controls)
            estovox_cmd_controls "$@"
            ;;
        interactive|int)
            estovox_cmd_interactive "$@"
            ;;
        list|ls)
            estovox_cmd_list "$@"
            ;;
        help|h|\?)
            estovox_cmd_help "$@"
            ;;
        quit|exit|q)
            return 99  # Special exit code
            ;;
        "")
            # Empty command, do nothing
            return 0
            ;;
        *)
            echo "Unknown command: $cmd (try 'help')" >&2
            return 1
            ;;
    esac
}

# === COMMAND COMPLETION ===

estovox_get_completions() {
    local partial=$1
    local context=$2  # Previous word for context-aware completion

    case $context in
        ph|phoneme)
            echo "i e a o u m p b f v s z sh zh w l r h j y rest neutral schwa"
            ;;
        expr|expression)
            echo "neutral happy sad angry surprised fear disgust thinking raised furrowed skeptical wink_left wink_right blink animated"
            ;;
        list|ls)
            echo "phonemes expressions params all"
            ;;
        set|setimm|get)
            # Parameter names without prefix
            for param in "${ESTOVOX_PARAMS[@]}"; do
                echo "${param#ESTOVOX_}"
            done
            ;;
        *)
            # Top-level commands
            echo "phoneme ph expr expression set setimm get seq sequence say reset clear cls list ls help quit exit"
            ;;
    esac
}
