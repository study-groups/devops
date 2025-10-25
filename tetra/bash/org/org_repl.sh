#!/usr/bin/env bash
# Org REPL - Interactive Organization Management Shell
# Integrates with bash/repl, TDS, and TSM

# Source dependencies (follow module hierarchy)
# bash/repl - Universal REPL system
source "$TETRA_SRC/bash/repl/repl.sh"

# bash/color - Color system (loaded by repl.sh, but explicit for clarity)
source "$TETRA_SRC/bash/color/repl_colors.sh"

# bash/tds - Display system (borders and layout only)
TDS_SRC="${TETRA_SRC}/bash/tds"
if [[ -f "$TDS_SRC/layout/borders.sh" ]]; then
    # Load only what we need: ANSI utilities and borders
    source "$TDS_SRC/core/ansi.sh"
    source "$TDS_SRC/layout/borders.sh"
else
    echo "Warning: TDS borders not found, layout may not align" >&2
fi

# Org-specific modules
ORG_SRC="${TETRA_SRC}/bash/org"
source "$ORG_SRC/org_constants.sh"
source "$ORG_SRC/actions.sh"
source "$ORG_SRC/org_help.sh" 2>/dev/null || true

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/org/history/org_repl"

# REPL State
ORG_REPL_ENV_INDEX=0
ORG_REPL_MODE_INDEX=0
ORG_REPL_ACTION_INDEX=0
ORG_REPL_ENVIRONMENTS=("${ORG_ENVIRONMENTS[@]}")
ORG_REPL_MODES=("${ORG_MODES[@]}")

# ============================================================================
# STATE HELPERS
# ============================================================================

_org_active() {
    org_active 2>/dev/null || echo "none"
}

_org_actions() {
    org_get_actions "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" \
                    "${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
}

# ============================================================================
# NAVIGATION (State Cyclers)
# ============================================================================

_org_cycle_env() {
    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % ${#ORG_REPL_ENVIRONMENTS[@]} ))
    ORG_REPL_ACTION_INDEX=0
}

_org_cycle_mode() {
    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % ${#ORG_REPL_MODES[@]} ))
    ORG_REPL_ACTION_INDEX=0
}

_org_cycle_action() {
    local actions=($(_org_actions))
    [[ ${#actions[@]} -gt 0 ]] && ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX + 1) % ${#actions[@]} ))
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_org_repl_build_prompt() {
    local org=$(_org_active)
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    local actions=($(_org_actions))
    local action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"

    # Build prompt using TDS theme palette
    local tmpfile
    tmpfile=$(mktemp /tmp/org_repl_prompt.XXXXXX) || return 1

    # Use TDS color tokens if available
    if type tds_text_color &>/dev/null; then
        # Takeover mode: colored brackets from theme
        tds_text_color "repl.prompt.bracket" > "$tmpfile"
        printf "[" >> "$tmpfile"
        reset_color >> "$tmpfile"

        # Organization name
        if [[ "$org" == "none" ]]; then
            tds_text_color "repl.org.inactive" >> "$tmpfile"
        else
            tds_text_color "repl.org.active" >> "$tmpfile"
        fi
        printf "%s" "$org" >> "$tmpfile"
        reset_color >> "$tmpfile"

        tds_text_color "repl.prompt.bracket" >> "$tmpfile"
        printf "]" >> "$tmpfile"
        reset_color >> "$tmpfile"
        printf " " >> "$tmpfile"

        # Environment (colored based on env type)
        local env_lower="${env,,}"
        tds_text_color "repl.env.${env_lower}" >> "$tmpfile"
        printf "%s" "$env" >> "$tmpfile"
        reset_color >> "$tmpfile"

        # Separator
        printf " " >> "$tmpfile"
        tds_text_color "repl.prompt.separator" >> "$tmpfile"
        printf "×" >> "$tmpfile"
        reset_color >> "$tmpfile"
        printf " " >> "$tmpfile"

        # Mode (colored based on mode type)
        local mode_lower="${mode,,}"
        tds_text_color "repl.mode.${mode_lower}" >> "$tmpfile"
        printf "%s" "$mode" >> "$tmpfile"
        reset_color >> "$tmpfile"

        # Action (if present)
        if [[ "$action" != "none" ]]; then
            printf " " >> "$tmpfile"
            tds_text_color "repl.feedback.arrow" >> "$tmpfile"
            printf "→" >> "$tmpfile"
            reset_color >> "$tmpfile"
            printf " " >> "$tmpfile"
            tds_text_color "repl.action.primary" >> "$tmpfile"
            printf "%s" "$action" >> "$tmpfile"
            reset_color >> "$tmpfile"
        fi

        # Prompt arrow
        printf " " >> "$tmpfile"
        tds_text_color "repl.prompt.arrow" >> "$tmpfile"
        printf "▶" >> "$tmpfile"
        reset_color >> "$tmpfile"
        printf " " >> "$tmpfile"
    else
        # Fallback: simple prompt without TDS
        printf "[%s] %s × %s" "$org" "$env" "$mode" > "$tmpfile"
        if [[ "$action" != "none" ]]; then
            printf " → %s" "$action" >> "$tmpfile"
        fi
        printf " ▶ " >> "$tmpfile"
    fi

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_org_repl_process_input() {
    local input="$1"

    # Empty input - execute current action
    if [[ -z "$input" ]]; then
        local actions=($(_org_actions))
        local action="${actions[$ORG_REPL_ACTION_INDEX]}"
        if [[ -n "$action" && "$action" != "none" ]]; then
            input="$action"
        else
            return 0
        fi
    fi

    # Shell command
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Parse command (full takeover mode - no / prefix needed)
    case "$input" in
        # Navigation commands
        env|e)
            _org_cycle_env
            echo "Environment: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
            return 2  # Signal prompt refresh
            ;;
        mode|m)
            _org_cycle_mode
            echo "Mode: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
            return 2  # Signal prompt refresh
            ;;
        action|a)
            _org_cycle_action
            local actions=($(_org_actions))
            local action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"
            echo "Action: $action"
            return 2  # Signal prompt refresh
            ;;
        next|n)
            # Cycle all three in order
            _org_cycle_action
            local actions=($(_org_actions))
            if [[ $ORG_REPL_ACTION_INDEX -eq 0 ]]; then
                _org_cycle_mode
                if [[ $ORG_REPL_MODE_INDEX -eq 0 ]]; then
                    _org_cycle_env
                fi
            fi
            return 2  # Signal prompt refresh
            ;;

        # Exit commands
        exit|quit|q)
            return 1
            ;;

        # Help commands
        help|h|\?)
            _org_show_help
            return 0
            ;;
        help\ *|h\ *)
            # Help with topic (future extension)
            local topic="${input#help }"
            topic="${topic#h }"
            _org_show_help "$topic"
            return 0
            ;;

        # Info commands
        actions)
            _org_show_actions
            return 0
            ;;
    esac

    # Action (verb:noun format)
    if [[ "$input" == *:* ]]; then
        echo ""
        echo "Executing: $input (${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]})"
        echo "---"
        org_execute_action "$input" "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
        echo ""
        return 0
    fi

    # Legacy commands
    case "$input" in
        list|ls)
            org_list
            ;;
        active)
            org_active
            ;;
        status)
            echo ""
            echo "Active org: $(_org_active)"
            echo "Environment: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
            echo "Mode: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
            local actions=($(_org_actions))
            echo "Available actions: ${#actions[@]}"
            echo ""
            ;;
        *)
            echo "Unknown command: $input"
            echo "Type 'help' for available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# HELP SYSTEM
# ============================================================================

_org_show_help() {
    local topic="${1:-}"

    if [[ -z "$topic" ]]; then
        cat <<EOF

═══════════════════════════════════════════════════════════
  ORG REPL - Organization Management Shell (Takeover Mode)
═══════════════════════════════════════════════════════════

Navigation:
  env, e         Cycle environment (Local→Dev→Staging→Production)
  mode, m        Cycle mode (Inspect→Transfer→Execute)
  action, a      Cycle action
  next, n        Cycle to next (action→mode→env)

Commands:
  verb:noun      Execute action (e.g., view:toml, push:config)
  !command       Run shell command (prefix with !)
  help, h, ?     Show this help
  actions        List available actions
  status         Show current state
  list, ls       List organizations
  active         Show active organization
  exit, quit, q  Exit REPL

Note: This REPL is in takeover mode - commands are executed
directly without / prefix. Use ! for shell commands.

EOF
    else
        # Topic-specific help (delegate to org_help if available)
        if type org_help &>/dev/null; then
            org_help "$topic"
        else
            echo "No detailed help available for: $topic"
        fi
    fi
}

_org_show_actions() {
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    local actions=($(_org_actions))

    echo ""
    echo "Available actions for: $env × $mode"
    echo "---"
    if [[ ${#actions[@]} -gt 0 ]]; then
        printf '  %s\n' "${actions[@]}"
    else
        echo "  (no actions available)"
    fi
    echo ""
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

org_repl() {
    echo ""
    text_color "66FFFF"
    echo "🏢 ORG REPL v2.0"
    reset_color
    echo ""

    # Show takeover mode indicator
    if type tds_text_color &>/dev/null; then
        tds_text_color "repl.exec.repl"
        printf "⚡ TAKEOVER MODE"
        reset_color
        echo " - org commands by default, !cmd for shell"
    else
        echo "Mode: TAKEOVER - org commands by default, !cmd for shell"
    fi

    echo ""
    echo "Active organization: $(_org_active)"
    echo ""
    echo "Type 'help' for commands, 'env'/'mode'/'action' to navigate"
    echo ""

    # Set execution mode to takeover
    REPL_EXECUTION_MODE="takeover"

    # Override REPL callbacks with org-specific implementations
    repl_build_prompt() { _org_repl_build_prompt "$@"; }
    repl_process_input() { _org_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run unified REPL loop
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    echo "Goodbye!"
    echo ""
}

# Export functions
export -f org_repl
export -f _org_active
export -f _org_actions
export -f _org_cycle_env
export -f _org_cycle_mode
export -f _org_cycle_action
export -f _org_repl_build_prompt
export -f _org_repl_process_input
export -f _org_show_help
export -f _org_show_actions
