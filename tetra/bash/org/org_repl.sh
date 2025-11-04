#!/usr/bin/env bash
# Org REPL - Interactive Organization Management Shell
# Integrates with bash/repl, bash/tree, bash/thelp, TDS, and TSM

# Source dependencies (follow module hierarchy)
# bash/repl - Universal REPL system
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/repl/command_processor.sh"

# Set module name for completion
REPL_MODULE_NAME="org"

# bash/tree - Tree-based help and completion
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/help.sh"

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
source "$ORG_SRC/action_runner.sh"  # Safe version - TTS disabled
source "$ORG_SRC/org_help.sh" 2>/dev/null || true
source "$ORG_SRC/org_tree.sh"  # Tree-based help structure
source "$ORG_SRC/org_completion.sh"  # Tree-based completion

# Initialize org tree for thelp integration
org_tree_init 2>/dev/null || true

# Register with REPL module system
repl_register_module "org" \
    "list active switch create import discover validate compile push pull rollback history env secrets help" \
    "help.org"

# ============================================================================
# TREE-BASED COMPLETION
# ============================================================================

# Static fallback completions (for when tree isn't available)
_org_static_completions() {
    # Navigation commands
    cat <<'EOF'
env
e
mode
m
action
a
next
n
EOF

    # Legacy commands
    cat <<'EOF'
list
ls
active
status
help
h
actions
exit
quit
q
EOF

    # Actions (verb:noun format)
    # Get from org_get_actions if available
    if command -v org_get_actions >/dev/null 2>&1; then
        for env in "${ORG_ENVIRONMENTS[@]}"; do
            for mode in "${ORG_MODES[@]}"; do
                org_get_actions "$env" "$mode" 2>/dev/null | tr ' ' '\n'
            done
        done | sort -u
    fi

    # Environment/mode names
    for env in "${ORG_ENVIRONMENTS[@]}"; do
        echo "${env,,}"
    done
    for mode in "${ORG_MODES[@]}"; do
        echo "${mode,,}"
    done

    # Organization names
    if command -v org_list >/dev/null 2>&1; then
        org_list 2>/dev/null | \
            sed 's/\x1b\[[0-9;]*[mGKHJh]//g; s/\x1b[(][AB]//g; s/\x1b\].*\x07//g' | \
            awk '/\*/ {
                sub(/^[[:space:]]*\*[[:space:]]*/, "");
                sub(/[[:space:]]*\(.*$/, "");
                if (length($0) > 0) print;
            }'
    fi
}

# Register tree-based completion with static fallback
repl_register_tree_completion "help.org" "_org_static_completions"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/org/history/org_repl"

# REPL State
ORG_REPL_ENV_INDEX=0
ORG_REPL_MODE_INDEX=0
ORG_REPL_ACTION_INDEX=0
ORG_REPL_ENVIRONMENTS=("${ORG_ENVIRONMENTS[@]}")
ORG_REPL_MODES=("${ORG_MODES[@]}")
ORG_REPL_EXECUTE_MODE=false  # false = ▶ browse, true = ◆ execute

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

_org_cycle_action_backwards() {
    local actions=($(_org_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX - 1) ))
        if [[ $ORG_REPL_ACTION_INDEX -lt 0 ]]; then
            ORG_REPL_ACTION_INDEX=$(( ${#actions[@]} - 1 ))
        fi
    fi
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

        # Prompt sigil (▶ for browse, ◆ for execute)
        printf " " >> "$tmpfile"
        tds_text_color "repl.prompt.arrow" >> "$tmpfile"
        if [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
            printf "◆" >> "$tmpfile"
        else
            printf "▶" >> "$tmpfile"
        fi
        reset_color >> "$tmpfile"
        printf " " >> "$tmpfile"
    else
        # Fallback: simple prompt without TDS
        printf "[%s] %s × %s" "$org" "$env" "$mode" > "$tmpfile"
        if [[ "$action" != "none" ]]; then
            printf " → %s" "$action" >> "$tmpfile"
        fi
        if [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
            printf " ◆ " >> "$tmpfile"
        else
            printf " ▶ " >> "$tmpfile"
        fi
    fi

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"

    # Always keep TCURSES_READLINE_PROMPT in sync
    TCURSES_READLINE_PROMPT="$REPL_PROMPT"
}

# ============================================================================
# TAB AND ESC HANDLERS
# ============================================================================

_org_handle_tab() {
    # Browse forward through actions (stay in browse mode ▶)
    _org_cycle_action

    # Clear the input line
    REPL_INPUT=""
    REPL_CURSOR_POS=0

    # Rebuild prompt with new action
    _org_repl_build_prompt

    # Update the global prompt variable so the readline loop uses the new prompt
    TCURSES_READLINE_PROMPT="$REPL_PROMPT"
}

_org_handle_shift_tab() {
    # Browse backward through actions (stay in browse mode ▶)
    _org_cycle_action_backwards

    # Clear the input line
    REPL_INPUT=""
    REPL_CURSOR_POS=0

    # Rebuild prompt with new action
    _org_repl_build_prompt

    # Update the global prompt variable so the readline loop uses the new prompt
    TCURSES_READLINE_PROMPT="$REPL_PROMPT"
}

_org_handle_space() {
    # Select current action - switch to execute mode (◆)
    ORG_REPL_EXECUTE_MODE=true

    # Clear the input line
    REPL_INPUT=""
    REPL_CURSOR_POS=0

    # Rebuild prompt to show ◆
    _org_repl_build_prompt

    # Update the global prompt variable so the readline loop uses the new prompt
    TCURSES_READLINE_PROMPT="$REPL_PROMPT"
}

_org_handle_esc() {
    # Deselect - return to browse mode (▶)
    ORG_REPL_EXECUTE_MODE=false

    # Clear the input line
    REPL_INPUT=""
    REPL_CURSOR_POS=0

    # Rebuild prompt
    _org_repl_build_prompt

    # Update the global prompt variable so the readline loop uses the new prompt
    TCURSES_READLINE_PROMPT="$REPL_PROMPT"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_org_repl_process_input() {
    local input="$1"

    echo "DEBUG: _org_repl_process_input called with input='$input'" >&2
    echo "DEBUG: Execute mode=$ORG_REPL_EXECUTE_MODE" >&2

    # Empty input - execute current action ONLY if in execute mode (◆)
    if [[ -z "$input" ]]; then
        echo "DEBUG: Empty input detected" >&2
        if [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
            echo "DEBUG: In execute mode, getting action" >&2
            local actions=($(_org_actions))
            local action="${actions[$ORG_REPL_ACTION_INDEX]}"
            echo "DEBUG: Selected action: '$action'" >&2
            if [[ -n "$action" && "$action" != "none" ]]; then
                input="$action"
                # Return to browse mode after executing
                ORG_REPL_EXECUTE_MODE=false
                echo "DEBUG: Will execute action: $action" >&2
            else
                echo "No action selected" >&2
                return 0
            fi
        else
            echo "DEBUG: In browse mode, empty input ignored" >&2
            # In browse mode (▶), empty return does nothing
            return 0
        fi
    fi

    echo "DEBUG: After empty check, input='$input'" >&2

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
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
            echo "Environment: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
            return 0
            ;;
        mode|m)
            _org_cycle_mode
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
            echo "Mode: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
            return 0
            ;;
        action|a)
            _org_cycle_action
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
            return 0
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
            # Help with topic - use tree help if available
            local topic="${input#help }"
            topic="${topic#h }"

            # Try tree help first
            if tree_exists "help.org.$topic" 2>/dev/null; then
                tree_help_show "help.org.$topic"
            else
                _org_show_help "$topic"
            fi
            return 0
            ;;
        thelp\ *|th\ *)
            # Direct thelp access from REPL
            local query="${input#thelp }"
            query="${query#th }"
            if command -v thelp >/dev/null 2>&1; then
                thelp "org.$query"
            else
                echo "thelp not available - use 'help' instead"
            fi
            return 0
            ;;

        # Info commands
        actions)
            _org_show_actions
            return 0
            ;;
    esac

    # Action (verb:noun format) - Use safe action runner (no TTS)
    if [[ "$input" == *:* ]]; then
        echo "DEBUG: Matched action pattern: $input" >&2
        local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
        echo "DEBUG: Environment: $env" >&2

        # Store mode for action runner
        export ORG_REPL_MODE="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

        echo "DEBUG: About to call org_run_action with: $input $env" >&2

        # Use action runner with TES resolution (TTS disabled for safety)
        org_run_action "$input" "$env"

        echo "DEBUG: org_run_action returned: $?" >&2

        unset ORG_REPL_MODE
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
            echo "Type 'help' for available commands, or press TAB for completions"
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

    # Show native tab completion status
    echo "✓ Native TAB completion enabled"
    echo ""

    echo "Type 'help' for commands, 'env'/'mode'/'action' to navigate"
    echo ""

    # Set execution mode to takeover
    REPL_EXECUTION_MODE="takeover"

    # Tree completion is already registered above
    # No need to set generator here - it's handled by repl_register_tree_completion

    # Override REPL callbacks with org-specific implementations (must be global for subshells)
    eval 'repl_build_prompt() { _org_repl_build_prompt "$@"; }'
    eval 'repl_process_input() { _org_repl_process_input "$@"; }'
    eval 'repl_handle_tab() { _org_handle_tab "$@"; }'
    eval 'repl_handle_shift_tab() { _org_handle_shift_tab "$@"; }'
    eval 'repl_handle_space() { _org_handle_space "$@"; }'
    eval 'repl_handle_esc() { _org_handle_esc "$@"; }'
    export -f repl_build_prompt repl_process_input repl_handle_tab repl_handle_shift_tab repl_handle_space repl_handle_esc

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
export -f _org_cycle_action_backwards
export -f _org_handle_tab
export -f _org_handle_shift_tab
export -f _org_handle_space
export -f _org_handle_esc
export -f _org_repl_build_prompt
export -f _org_repl_process_input
export -f _org_show_help
export -f _org_show_actions
export -f _org_static_completions
