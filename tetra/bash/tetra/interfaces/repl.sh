#!/usr/bin/env bash
# Tetra REPL Interface - Simple readline with tab completion
# Pattern: like org's interface, no tcurses

TETRA_REPL_HISTORY="${TETRA_DIR}/tetra/repl_history"

# =============================================================================
# PROMPT
# =============================================================================

_tetra_repl_prompt() {
    local count="${#TETRA_MODULE_LIST[@]}"
    echo "[${count}] tetra> "
}

# =============================================================================
# COMPLETION (for read -e)
# =============================================================================

# Build completion words for current input
_tetra_repl_completions() {
    local input="$1"
    local words=()

    # Parse input into tokens
    local first="${input%% *}"
    local rest="${input#* }"
    [[ "$first" == "$input" ]] && rest=""

    # No input yet - show all commands
    if [[ -z "$input" ]]; then
        words=(status modules module doctor help version clear exit quit)
        words+=("${TETRA_MODULE_LIST[@]}")
        printf '%s\n' "${words[@]}"
        return
    fi

    # Check if input ends with space (ready for next word)
    local ends_with_space=0
    [[ "$input" == *" " ]] && ends_with_space=1

    # First word partial - complete commands (no trailing space)
    if [[ -z "$rest" && $ends_with_space -eq 0 ]]; then
        local candidates=(status modules module doctor help version clear exit quit)
        candidates+=("${TETRA_MODULE_LIST[@]}")
        for w in "${candidates[@]}"; do
            [[ "$w" == "$first"* ]] && echo "$w"
        done
        return
    fi

    # Trailing space after first word - show all options for second word
    if [[ $ends_with_space -eq 1 && -z "$rest" ]]; then
        rest=""  # Empty partial
    fi

    # Second word - depends on first
    case "$first" in
        modules)
            # modules <tab> shows all loaded modules
            for m in "${TETRA_MODULE_LIST[@]}"; do
                [[ "$m" == "$rest"* ]] && echo "$m"
            done
            ;;
        module|mod|m)
            for w in list info stats; do
                [[ "$w" == "$rest"* ]] && echo "$w"
            done
            ;;
        info)
            for m in "${TETRA_MODULE_LIST[@]}"; do
                [[ "$m" == "$rest"* ]] && echo "$m"
            done
            ;;
        org)
            for w in status list switch env help; do
                [[ "$w" == "$rest"* ]] && echo "$w"
            done
            ;;
        tsm)
            for w in list start stop restart logs ports doctor help; do
                [[ "$w" == "$rest"* ]] && echo "$w"
            done
            ;;
        deploy)
            for w in push show list history doctor help; do
                [[ "$w" == "$rest"* ]] && echo "$w"
            done
            ;;
    esac
}

# Readline completion function
_tetra_repl_readline_complete() {
    local cur="${READLINE_LINE}"
    local completions

    mapfile -t completions < <(_tetra_repl_completions "$cur")

    if [[ ${#completions[@]} -eq 1 ]]; then
        # Single match - complete it
        READLINE_LINE="${completions[0]} "
        READLINE_POINT=${#READLINE_LINE}
    elif [[ ${#completions[@]} -gt 1 ]]; then
        # Multiple matches - show them
        echo ""
        printf '%s  ' "${completions[@]}"
        echo ""
    fi
}

# =============================================================================
# HELP
# =============================================================================

_tetra_repl_help() {
    cat << 'EOF'
TETRA REPL
==========

COMMANDS
  status              Show tetra status
  modules             List loaded modules (Tab for names)
  modules <name>      Run module command
  doctor              Health check
  help                Show this help

  exit, quit, q       Exit REPL

MODULES
EOF
    # Dynamic module list
    for m in "${TETRA_MODULE_LIST[@]}"; do
        printf "  %-18s %s\n" "$m" "Run $m commands"
    done
    cat << 'EOF'

MODULE COMMANDS (examples)
  org status          Organization status
  tsm list            List running services
  deploy push <t> <e> Deploy to environment

TAB COMPLETION
  modules <Tab>       Show available modules
  org <Tab>           Show org subcommands
EOF
}

# =============================================================================
# MAIN REPL
# =============================================================================

tetra_repl() {
    mkdir -p "$(dirname "$TETRA_REPL_HISTORY")"
    touch "$TETRA_REPL_HISTORY"

    # Load history
    history -r "$TETRA_REPL_HISTORY" 2>/dev/null

    # Bind Tab to completion function
    bind -x '"\t": _tetra_repl_readline_complete' 2>/dev/null

    # Welcome
    local count="${#TETRA_MODULE_LIST[@]}"
    echo ""
    echo "Tetra REPL v$TETRA_VERSION"
    echo "Modules: $count loaded"
    echo ""
    echo "Type 'help' for commands, Tab for completion"
    echo ""

    # REPL loop
    while true; do
        local prompt="$(_tetra_repl_prompt)"
        local input

        # Read with readline support
        if ! read -e -p "$prompt" input; then
            echo ""
            break
        fi

        [[ -z "$input" ]] && continue

        # Add to history
        history -s "$input"
        echo "$input" >> "$TETRA_REPL_HISTORY"

        # Exit commands
        case "$input" in
            exit|quit|q)
                echo "Goodbye!"
                break
                ;;
            help|h)
                _tetra_repl_help
                continue
                ;;
            clear)
                clear
                continue
                ;;
        esac

        # Check if first word is a tetra subcommand
        local first="${input%% *}"
        local rest="${input#* }"
        [[ "$first" == "$input" ]] && rest=""

        case "$first" in
            status|module|doctor|version)
                tetra $input
                ;;
            modules)
                if [[ -z "$rest" ]]; then
                    # Just "modules" - list them
                    tetra module list
                else
                    # "modules <name>" - run that module
                    eval "$rest"
                fi
                ;;
            *)
                # Try to eval as shell (module commands like org, tsm, deploy)
                eval "$input"
                ;;
        esac
    done

    # Save history
    history -w "$TETRA_REPL_HISTORY" 2>/dev/null
}

# =============================================================================
# EXPORTS
# =============================================================================

export TETRA_REPL_HISTORY
export -f tetra_repl _tetra_repl_prompt _tetra_repl_help
export -f _tetra_repl_completions _tetra_repl_readline_complete
