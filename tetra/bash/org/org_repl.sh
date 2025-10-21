#!/usr/bin/env bash
# Org REPL - Clean implementation using bash/repl with simple color system

source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$TETRA_SRC/bash/org/actions.sh"
source "$TETRA_SRC/bash/org/org_repl_tui.sh"

# State
ORG_REPL_ENV_INDEX=0
ORG_REPL_MODE_INDEX=0
ORG_REPL_ACTION_INDEX=0
ORG_REPL_ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
ORG_REPL_MODES=("Inspect" "Transfer" "Execute")

# Helpers
_org_active() { org_active 2>/dev/null || echo "none"; }
_org_actions() {
    org_get_actions "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" \
                    "${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
}

# Prompt builder using simple color system
# Sets global REPL_PROMPT (not via return/echo to avoid command substitution subshell)
_org_build_prompt() {
    local org=$(_org_active)
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    local actions=($(_org_actions))
    local action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"

    # Capture prompt output to global variable via tmpfile (avoids command substitution subshell)
    local tmpfile="/tmp/repl_prompt_$$"
    repl_build_org_prompt "$org" "$env" "$ORG_REPL_ENV_INDEX" "$mode" "$ORG_REPL_MODE_INDEX" "$action" > "$tmpfile"
    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

_org_cycle_env() {
    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % ${#ORG_REPL_ENVIRONMENTS[@]} ))
    ORG_REPL_ACTION_INDEX=0

    # Inject empty command to force loop restart with new prompt
    READLINE_LINE=$'\n'
    READLINE_POINT=${#READLINE_LINE}
}

_org_cycle_mode() {
    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % ${#ORG_REPL_MODES[@]} ))
    ORG_REPL_ACTION_INDEX=0

    # Inject empty command to force loop restart with new prompt
    READLINE_LINE=$'\n'
    READLINE_POINT=${#READLINE_LINE}
}

_org_cycle_action() {
    local actions=($(_org_actions))
    [[ ${#actions[@]} -gt 0 ]] && ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX + 1) % ${#actions[@]} ))

    # Inject empty command to force loop restart with new prompt
    READLINE_LINE=$'\n'
    READLINE_POINT=${#READLINE_LINE}
}

# Input processor
_org_process_input() {
    local input="$1"

    # Empty = execute current action
    if [[ -z "$input" ]]; then
        local actions=($(_org_actions))
        local action="${actions[$ORG_REPL_ACTION_INDEX]}"
        [[ -n "$action" && "$action" != "none" ]] && input="$action" || return 0
    fi

    # Shell command
    [[ "$input" == !* ]] && { eval "${input:1}"; return 0; }

    # Exit
    case "$input" in
        exit|quit|q) return 1 ;;
        help|h|\?) _org_show_help; return 0 ;;
        actions|a) _org_show_actions; return 0 ;;
    esac

    # Action (verb:noun)
    if [[ "$input" == *:* ]]; then
        echo -e "\nExecuting: $input (${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]})\n---"
        org_execute_action "$input" "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
        echo ""
        return 0
    fi

    # Legacy commands
    case "$input" in
        list|ls) org_list ;;
        active) org_active ;;
        *) echo "Unknown: $input (try 'help' or verb:noun)" ;;
    esac
}

# Help
_org_show_help() {
    cat <<EOF

═══════════════════════════════════════════════════════════
  ORG REPL - Full Control Mode
═══════════════════════════════════════════════════════════

Navigation:
  Ctrl+E         Cycle environment (Local→Dev→Staging→Production)
  Ctrl+R         Cycle mode (Inspect→Transfer→Execute)
  Ctrl+A         Cycle action
  Tab            Show/hide action menu (TUI mode only)
  Ctrl+X/Enter   Execute current action

Commands:
  verb:noun      Execute action (e.g., view:toml, push:config)
  !command       Run shell command
  help, h, ?     Show this help
  actions, a     List available actions
  list, ls       List organizations
  exit, quit, q  Exit REPL

EOF
}

_org_show_actions() {
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    local actions=($(_org_actions))

    echo -e "\nAvailable actions for: $env x $mode\n---"
    [[ ${#actions[@]} -gt 0 ]] && printf '  %s\n' "${actions[@]}" || echo "  (none)"
    echo ""
}

# Main entry - use TUI mode for full control
org_repl() {
    # Check if TUI mode available
    if [[ -t 0 && -t 1 ]]; then
        org_repl_tui
    else
        # Fallback to basic mode
        _org_repl_basic
    fi
}

# Basic REPL fallback (non-TUI)
_org_repl_basic() {
    cat <<EOF

═══════════════════════════════════════════════════════════
  TETRA ORGANIZATION MANAGEMENT
═══════════════════════════════════════════════════════════

Full Control Mode - Direct command input
Type 'help' for commands, Ctrl+E/Ctrl+R/Ctrl+A to navigate

Active organization: $(_org_active)

EOF

    # Setup
    REPL_HISTORY_BASE="$TETRA_DIR/org/history/repl"
    bind -x '"\C-e": _org_cycle_env'
    bind -x '"\C-r": _org_cycle_mode'
    bind -x '"\C-a": _org_cycle_action'

    # Wrap bash/repl callbacks with local functions (prevents collision)
    repl_build_prompt() { _org_build_prompt "$@"; }
    repl_process_input() { _org_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run
    repl_run

    # Cleanup
    bind -r '\C-e' '\C-r' '\C-a' 2>/dev/null
    unset -f repl_build_prompt repl_process_input
}

export -f org_repl
export -f _org_repl_basic
