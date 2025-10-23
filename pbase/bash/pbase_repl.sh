#!/usr/bin/env bash
# pbase REPL - Service management + pdata administration

# Source TETRA repl utilities
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$TETRA_SRC/bash/utils/repl_utils.sh"

# Source pbase modules
source "$PBASE_SRC/bash/pdata.sh"
source "$PBASE_SRC/bash/admin.sh"

# State
PBASE_REPL_CONTEXT_INDEX=0
PBASE_REPL_CONTEXTS=("service" "users" "files" "audit")
PBASE_REPL_ACTION_INDEX=0

# Get available actions for current context
_pbase_actions() {
    local context="${PBASE_REPL_CONTEXTS[$PBASE_REPL_CONTEXT_INDEX]}"

    case "$context" in
        service)
            echo "start stop restart status info test"
            ;;
        users)
            echo "list add delete"
            ;;
        files)
            echo "list tree"
            ;;
        audit)
            echo "tail watch status"
            ;;
    esac
}

# Build prompt (sets global REPL_PROMPT)
_pbase_build_prompt() {
    local context="${PBASE_REPL_CONTEXTS[$PBASE_REPL_CONTEXT_INDEX]}"
    local actions=($(_pbase_actions))
    local action="${actions[$PBASE_REPL_ACTION_INDEX]:-none}"

    # Service status indicator
    local status_symbol="○"
    local status_color="\033[90m"  # gray

    if pgrep -f "node.*index.js" > /dev/null; then
        status_symbol="●"
        status_color="\033[32m"  # green
    fi

    # Build colored prompt
    local tmpfile
    tmpfile=$(mktemp) || return 1

    cat > "$tmpfile" <<EOF
${status_color}${status_symbol}\033[0m pbase[\033[36m${context}\033[0m] \033[33m${action}\033[0m>
EOF

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# Cycle context (service -> users -> files -> audit)
_pbase_cycle_context() {
    PBASE_REPL_CONTEXT_INDEX=$(( (PBASE_REPL_CONTEXT_INDEX + 1) % ${#PBASE_REPL_CONTEXTS[@]} ))
    PBASE_REPL_ACTION_INDEX=0

    READLINE_LINE=$'\n'
    READLINE_POINT=${#READLINE_LINE}
}

# Cycle action within context
_pbase_cycle_action() {
    local actions=($(_pbase_actions))
    [[ ${#actions[@]} -gt 0 ]] && PBASE_REPL_ACTION_INDEX=$(( (PBASE_REPL_ACTION_INDEX + 1) % ${#actions[@]} ))

    READLINE_LINE=$'\n'
    READLINE_POINT=${#READLINE_LINE}
}

# Process input
_pbase_process_input() {
    local input="$1"

    # Empty = execute current action
    if [[ -z "$input" ]]; then
        local actions=($(_pbase_actions))
        local action="${actions[$PBASE_REPL_ACTION_INDEX]}"
        [[ -n "$action" && "$action" != "none" ]] && input="$action" || return 0
    fi

    # Shell command
    [[ "$input" == !* ]] && { eval "${input:1}"; return 0; }

    # Parse command
    local cmd args
    if [[ "$input" =~ [[:space:]] ]]; then
        cmd="${input%% *}"
        args="${input#* }"
    else
        cmd="$input"
        args=""
    fi

    # Route to appropriate handler
    local context="${PBASE_REPL_CONTEXTS[$PBASE_REPL_CONTEXT_INDEX]}"

    case "$context" in
        service)
            pdata "$cmd" $args
            ;;
        users)
            admin user "$cmd" $args
            ;;
        files)
            admin file "$cmd" $args
            ;;
        audit)
            admin audit "$cmd" $args
            ;;
    esac
}

# Show help
_pbase_help() {
    cat <<'EOF'
pbase REPL - Service Management + Administration

Navigation:
  Tab          Cycle context (service/users/files/audit)
  Ctrl+Space   Cycle action within context
  Enter        Execute highlighted action

Contexts:
  service      start, stop, restart, status, info, test
  users        list, add, delete
  files        list, tree
  audit        tail, watch, status

Direct Commands:
  Any context command can be typed directly
  Examples:
    start           (in service context)
    add mike pass   (in users context)
    list /uploads   (in files context)

System:
  !<cmd>       Execute bash command
  help         Show this help
  exit, quit   Exit REPL

Status Indicator:
  ● green      pdata service running
  ○ gray       pdata service stopped
EOF
}

# Main REPL
pbase_repl_main() {
    # Check environment
    pdata check || {
        echo "ERROR: Environment check failed. Run 'source init.sh' first" >&2
        return 1
    }

    # Setup readline bindings
    bind -x '"\t": _pbase_cycle_context'
    bind -x '"\C- ": _pbase_cycle_action'  # Ctrl+Space

    # Enable history
    set -o history
    HISTFILE="${PBASE_DIR}/.pbase_history"
    HISTSIZE=1000
    HISTFILESIZE=1000
    shopt -s histappend
    history -r "$HISTFILE" 2>/dev/null || true

    echo "pbase REPL - Type 'help' for commands, Tab to cycle contexts"
    echo ""

    while true; do
        _pbase_build_prompt

        # Read with readline editing
        read -e -r -p "$REPL_PROMPT" input

        # Save to history
        [[ -n "$input" ]] && history -s "$input"

        # Handle special commands
        case "$input" in
            exit|quit)
                echo "Goodbye"
                break
                ;;
            help)
                _pbase_help
                continue
                ;;
        esac

        # Process input
        _pbase_process_input "$input"
    done

    # Save history
    history -w "$HISTFILE"
}

# Entry point
pbase_repl() {
    pbase_repl_main
}
