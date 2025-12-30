#!/usr/bin/env bash
# repl-cli.sh - Basic Readline REPL with context support
# Pattern: readline + tab completion, no terminal takeover
# Honors TETRA_CTX_* env vars set by `tetra ctx`

: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source context manager
source "$TETRA_SRC/bash/tetra/ctx.sh"

TETRA_REPL_HISTORY="${TETRA_DIR}/tetra/repl_history"

# =============================================================================
# PROMPT (includes context)
# =============================================================================

_repl_cli_prompt() {
    local count="${#TETRA_MODULE_LIST[@]}"
    local ctx=$(tetra_ctx_prompt)
    echo "[$count] $ctx> "
}

# =============================================================================
# COMPLETION (for read -e)
# =============================================================================

_repl_cli_completions() {
    local input="$1"
    local words=()

    local first="${input%% *}"
    local rest="${input#* }"
    [[ "$first" == "$input" ]] && rest=""

    # No input - show all commands
    if [[ -z "$input" ]]; then
        words=(status modules module doctor help version clear exit quit ctx)
        words+=("${TETRA_MODULE_LIST[@]}")
        printf '%s\n' "${words[@]}"
        return
    fi

    local ends_with_space=0
    [[ "$input" == *" " ]] && ends_with_space=1

    # First word partial
    if [[ -z "$rest" && $ends_with_space -eq 0 ]]; then
        local candidates=(status modules module doctor help version clear exit quit ctx)
        candidates+=("${TETRA_MODULE_LIST[@]}")
        for w in "${candidates[@]}"; do
            [[ "$w" == "$first"* ]] && echo "$w"
        done
        return
    fi

    # Trailing space - show options for second word
    if [[ $ends_with_space -eq 1 && -z "$rest" ]]; then
        rest=""
    fi

    # Second word depends on first
    case "$first" in
        ctx)
            for w in show set clear help; do
                [[ "$w" == "$rest"* ]] && echo "$w"
            done
            ;;
        modules)
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

_repl_cli_readline_complete() {
    local cur="${READLINE_LINE}"
    local completions

    mapfile -t completions < <(_repl_cli_completions "$cur")

    if [[ ${#completions[@]} -eq 1 ]]; then
        READLINE_LINE="${completions[0]} "
        READLINE_POINT=${#READLINE_LINE}
    elif [[ ${#completions[@]} -gt 1 ]]; then
        echo ""
        printf '%s  ' "${completions[@]}"
        echo ""
    fi
}

# =============================================================================
# HELP
# =============================================================================

_repl_cli_help() {
    cat << 'EOF'
TETRA REPL (basic-repl)
=======================

CONTEXT
  ctx                   Show current context
  ctx <org:proj:topic>  Set context
  ctx set <key> <val>   Set individual (org, project, topic)
  ctx clear             Clear context

COMMANDS
  status              Show tetra status
  modules             List loaded modules
  modules <name>      Run module command
  doctor              Health check
  help                This help
  exit, quit, q       Exit REPL

MODULE COMMANDS
EOF
    for m in "${TETRA_MODULE_LIST[@]}"; do
        printf "  %-18s %s\n" "$m" "Run $m commands"
    done
    cat << 'EOF'

EXAMPLES
  ctx myorg:myproj:auth   Set context
  org status              Organization status
  tsm list                List services

TAB COMPLETION
  <Tab>               Complete commands/modules
EOF
}

# =============================================================================
# MAIN REPL
# =============================================================================

repl_cli() {
    mkdir -p "$(dirname "$TETRA_REPL_HISTORY")"
    touch "$TETRA_REPL_HISTORY"

    # Load history
    history -r "$TETRA_REPL_HISTORY" 2>/dev/null

    # Bind Tab
    bind -x '"\t": _repl_cli_readline_complete' 2>/dev/null

    # Welcome
    local count="${#TETRA_MODULE_LIST[@]}"
    echo ""
    echo "Tetra REPL v$TETRA_VERSION"
    echo "Modules: $count loaded"
    tetra_ctx_show
    echo ""
    echo "Type 'help' for commands, Tab for completion"
    echo ""

    # REPL loop
    while true; do
        local prompt="$(_repl_cli_prompt)"
        local input

        if ! read -e -p "$prompt" input; then
            echo ""
            break
        fi

        [[ -z "$input" ]] && continue

        # History
        history -s "$input"
        echo "$input" >> "$TETRA_REPL_HISTORY"

        # Builtins
        case "$input" in
            exit|quit|q)
                echo "Goodbye!"
                break
                ;;
            help|h)
                _repl_cli_help
                continue
                ;;
            clear)
                clear
                continue
                ;;
        esac

        # Parse first word
        local first="${input%% *}"
        local rest="${input#* }"
        [[ "$first" == "$input" ]] && rest=""

        # Dispatch
        case "$first" in
            ctx)
                # Context commands
                if [[ -z "$rest" ]]; then
                    tetra_ctx show
                else
                    tetra_ctx $rest
                fi
                ;;
            status|module|doctor|version)
                tetra $input
                ;;
            modules)
                if [[ -z "$rest" ]]; then
                    tetra module list
                else
                    eval "$rest"
                fi
                ;;
            *)
                # Module commands (org, tsm, deploy, etc.)
                eval "$input"
                ;;
        esac
    done

    history -w "$TETRA_REPL_HISTORY" 2>/dev/null
}

# Alias for backward compat
tetra_repl() { repl_cli "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export TETRA_REPL_HISTORY
export -f repl_cli tetra_repl _repl_cli_prompt _repl_cli_help
export -f _repl_cli_completions _repl_cli_readline_complete
