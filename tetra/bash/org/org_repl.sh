#!/usr/bin/env bash
# Org REPL - Interactive Organization Management Shell
# Integrates with bash/repl, bash/tree, bash/thelp, TDS, and TSM

# Verify TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC not set. Please source tetra.sh first." >&2
    return 1 2>/dev/null || exit 1
fi

# Source dependencies (follow module hierarchy)
# bash/repl - Universal REPL system
if [[ ! -f "$TETRA_SRC/bash/repl/repl.sh" ]]; then
    echo "Error: Required dependency not found: $TETRA_SRC/bash/repl/repl.sh" >&2
    return 1 2>/dev/null || exit 1
fi
source "$TETRA_SRC/bash/repl/repl.sh"

if [[ ! -f "$TETRA_SRC/bash/repl/command_processor.sh" ]]; then
    echo "Error: Required dependency not found: $TETRA_SRC/bash/repl/command_processor.sh" >&2
    return 1 2>/dev/null || exit 1
fi
source "$TETRA_SRC/bash/repl/command_processor.sh"

# Set module name for completion
REPL_MODULE_NAME="org"

# bash/tree - Tree-based help and completion
if [[ ! -f "$TETRA_SRC/bash/tree/core.sh" ]]; then
    echo "Error: Required dependency not found: $TETRA_SRC/bash/tree/core.sh" >&2
    return 1 2>/dev/null || exit 1
fi
source "$TETRA_SRC/bash/tree/core.sh"

if [[ ! -f "$TETRA_SRC/bash/tree/help.sh" ]]; then
    echo "Error: Required dependency not found: $TETRA_SRC/bash/tree/help.sh" >&2
    return 1 2>/dev/null || exit 1
fi
source "$TETRA_SRC/bash/tree/help.sh"

# bash/color - Color system (loaded by repl.sh, but explicit for clarity)
if [[ ! -f "$TETRA_SRC/bash/color/repl_colors.sh" ]]; then
    echo "Error: Required dependency not found: $TETRA_SRC/bash/color/repl_colors.sh" >&2
    return 1 2>/dev/null || exit 1
fi
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

# Check required org modules
for required_file in "org_constants.sh" "actions.sh" "action_runner.sh" "org_tree.sh" "org_completion.sh"; do
    if [[ ! -f "$ORG_SRC/$required_file" ]]; then
        echo "Error: Required org module not found: $ORG_SRC/$required_file" >&2
        return 1 2>/dev/null || exit 1
    fi
done

source "$ORG_SRC/org_constants.sh"
source "$ORG_SRC/actions.sh"
source "$ORG_SRC/action_runner.sh"  # Safe version - TTS disabled
source "$ORG_SRC/org_help.sh" 2>/dev/null || true
source "$ORG_SRC/org_tree.sh"  # Tree-based help structure
source "$ORG_SRC/org_completion.sh"  # Tree-based completion
source "$ORG_SRC/org_tes_viewer.sh"  # Enhanced TES viewer with SSH commands

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
ORG_REPL_SINGLE_KEY_MODE=false  # true when space pressed as first char

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

    # Display available actions for new environment
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    _org_display_available_actions "$env" "$mode"
}

_org_cycle_mode() {
    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % ${#ORG_REPL_MODES[@]} ))
    ORG_REPL_ACTION_INDEX=0

    # Display available actions for new mode
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    _org_display_available_actions "$env" "$mode"
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

        # Mode indicator and prompt sigil
        printf " " >> "$tmpfile"
        tds_text_color "repl.prompt.arrow" >> "$tmpfile"
        if [[ "$ORG_REPL_SINGLE_KEY_MODE" == "true" ]]; then
            printf "⌨" >> "$tmpfile"
        elif [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
            printf "|" >> "$tmpfile"
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
        if [[ "$ORG_REPL_SINGLE_KEY_MODE" == "true" ]]; then
            printf " ⌨ " >> "$tmpfile"  # Single-key mode indicator
        elif [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
            printf " | " >> "$tmpfile"  # Armed/unlocked mode
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

# Display action expansion with TES resolution
_org_display_action_expansion() {
    local action="$1"
    local env="$2"
    local mode="$3"

    local verb="${action%%:*}"
    local noun="${action##*:}"
    local active_org=$(_org_active 2>/dev/null || echo "none")

    # Clear screen above prompt and display expansion
    echo "" >&2
    echo "╭─ Action: $action ─────────────────────────────" >&2
    echo "│" >&2
    echo "│ Environment:  $env" >&2
    echo "│ Mode:         $mode" >&2
    echo "│" >&2
    echo "│ TES Resolution:" >&2

    # Get TES preview
    local tes_preview=$(org_resolve_tes_preview "$action" "$env")
    echo "$tes_preview" >&2

    echo "│" >&2
    echo "│ Variables:" >&2

    # Check variable resolution
    if [[ "$active_org" == "none" || "$active_org" == "[UNRESOLVED]" ]]; then
        echo "│   active_org = [UNRESOLVED]" >&2
    else
        echo "│   active_org = $active_org ✓" >&2
    fi

    echo "│   TETRA_DIR  = $TETRA_DIR ✓" >&2

    echo "│" >&2
    echo "│ Action Details:" >&2
    echo "│   Verb:       $verb (what to do)" >&2
    echo "│   Noun:       $noun (target)" >&2
    echo "│   Full Spec:  $verb:$noun @ $env in $mode mode" >&2

    echo "╰───────────────────────────────────────────────" >&2
    echo "" >&2
}

# Display all available actions for current env/mode
_org_display_available_actions() {
    local env="$1"
    local mode="$2"

    local actions=($(_org_actions))

    echo "" >&2
    echo "Available actions for $env / $mode:" >&2
    echo "" >&2

    local i=0
    for action in "${actions[@]}"; do
        local verb="${action%%:*}"
        local noun="${action##*:}"
        local marker="  "

        # Mark current action
        if [[ $i -eq $ORG_REPL_ACTION_INDEX ]]; then
            marker="▶ "
        fi

        printf "%s%d. %-20s [%s → %s]\n" "$marker" "$((i+1))" "$action" "$verb" "$noun" >&2
        ((i++))
    done

    echo "" >&2
}

_org_handle_tab() {
    # If in single-key mode, TAB copies current action to line and shows full TES spec
    if [[ "$ORG_REPL_SINGLE_KEY_MODE" == "true" ]]; then
        local actions=($(_org_actions))
        local action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"

        if [[ "$action" != "none" ]]; then
            # Copy action to input line
            REPL_INPUT="$action"
            REPL_CURSOR_POS=${#REPL_INPUT}

            # Exit single-key mode
            ORG_REPL_SINGLE_KEY_MODE=false

            # Show full TES specification
            local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
            local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

            echo "" >&2
            echo "TES Specification:" >&2
            echo "  Environment: $env" >&2
            echo "  Mode: $mode" >&2
            echo "  Action: $action" >&2
            echo "" >&2

            # Rebuild prompt
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
        fi
        return 0
    fi

    # If in armed mode, show resolved TES endpoints
    if [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
        local actions=($(_org_actions))
        local action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"
        local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
        local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

        echo "" >&2
        echo "Resolved TES Endpoints:" >&2
        echo "  Action: $action" >&2
        echo "  Environment: $env" >&2
        echo "  Mode: $mode" >&2
        echo "" >&2

        # Get active org for TES resolution
        local org=$(_org_active)
        if [[ "$org" != "none" ]]; then
            local symbol="@${env,,}"
            echo "  Symbol: $symbol" >&2

            # Try to resolve if TES functions available
            if command -v tes_resolve_symbol &>/dev/null; then
                local address=$(tes_resolve_symbol "$symbol" 2>/dev/null || echo "N/A")
                echo "  Address: $address" >&2

                if command -v tes_resolve_channel &>/dev/null; then
                    local channel=$(tes_resolve_channel "$symbol" 2>/dev/null || echo "N/A")
                    echo "  Channel: $channel" >&2
                fi

                if command -v tes_resolve_connector &>/dev/null; then
                    local connector=$(tes_resolve_connector "$symbol" 2>/dev/null || echo "N/A")
                    echo "  Connector: $connector" >&2
                fi
            else
                echo "  (TES resolution not available)" >&2
            fi
        else
            echo "  (No active organization)" >&2
        fi
        echo "" >&2
        return 0
    fi

    # Normal mode: Browse forward through actions (stay in browse mode ▶)
    # First display current action expansion, then cycle to next
    local actions=($(_org_actions))
    local current_action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

    # Show expansion of current action
    if [[ "$current_action" != "none" ]]; then
        _org_display_action_expansion "$current_action" "$env" "$mode"
    fi

    # Cycle to next action
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
    # First display current action expansion, then cycle to previous
    local actions=($(_org_actions))
    local current_action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

    # Show expansion of current action
    if [[ "$current_action" != "none" ]]; then
        _org_display_action_expansion "$current_action" "$env" "$mode"
    fi

    # Cycle to previous action
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
    # Check if space is pressed as first character (empty input, cursor at 0)
    if [[ -z "$REPL_INPUT" && $REPL_CURSOR_POS -eq 0 ]]; then
        # Show action explorer menu
        local selected_action
        selected_action=$(org_explore_actions)
        local result=$?

        if [[ $result -eq 0 && -n "$selected_action" ]]; then
            # Action was selected - populate input line with it
            REPL_INPUT="$selected_action"
            REPL_CURSOR_POS=${#selected_action}

            # Update the action index to match selected action
            local actions=($(_org_actions))
            local i=0
            for action in "${actions[@]}"; do
                if [[ "$action" == "$selected_action" ]]; then
                    ORG_REPL_ACTION_INDEX=$i
                    break
                fi
                ((i++))
            done

            # Enter execute mode (armed to run)
            ORG_REPL_EXECUTE_MODE=true
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
        else
            # Cancelled - just rebuild display
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
        fi
        return 0
    fi

    # If not first char, insert space normally
    return 1
}

_org_handle_esc() {
    # Exit single-key mode if active
    if [[ "$ORG_REPL_SINGLE_KEY_MODE" == "true" ]]; then
        ORG_REPL_SINGLE_KEY_MODE=false

        # Rebuild prompt
        _org_repl_build_prompt
        TCURSES_READLINE_PROMPT="$REPL_PROMPT"
        return 0
    fi

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

# Single-key mode handler - processes a/e/m keys when in single-key mode
repl_handle_single_key() {
    local key="$1"

    # Only process if in single-key mode
    if [[ "$ORG_REPL_SINGLE_KEY_MODE" != "true" ]]; then
        return 1  # Not handled, allow normal processing
    fi

    case "$key" in
        a|A)
            # Cycle action
            _org_cycle_action
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
            return 0  # Handled
            ;;
        e|E)
            # Cycle environment
            _org_cycle_env
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
            return 0  # Handled
            ;;
        m|M)
            # Cycle mode
            _org_cycle_mode
            _org_repl_build_prompt
            TCURSES_READLINE_PROMPT="$REPL_PROMPT"
            return 0  # Handled
            ;;
        *)
            # Not a single-key command, allow normal processing
            return 1
            ;;
    esac
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_org_repl_process_input() {
    local input="$1"

    # Empty input - output TTS action with TES endpoints if in armed mode (|)
    if [[ -z "$input" ]]; then
        if [[ "$ORG_REPL_EXECUTE_MODE" == "true" ]]; then
            local actions=($(_org_actions))
            local action="${actions[$ORG_REPL_ACTION_INDEX]}"
            local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
            local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

            if [[ -n "$action" && "$action" != "none" ]]; then
                # Output TTS (Task/Target/State) action with TES formatted endpoints
                echo ""
                echo "TTS Action Specification:"
                echo "  Task: $action"
                echo "  Target: ${env} environment"
                echo "  State: ${mode} mode"
                echo ""
                echo "TES Endpoints:"

                # Get active org for TES resolution
                local org=$(_org_active)
                if [[ "$org" != "none" ]]; then
                    # Show TES resolution for this environment
                    local symbol="@${env,,}"  # e.g., @local, @dev, @staging, @prod
                    echo "  Symbol: $symbol"

                    # If we can resolve, show the details
                    if command -v tes_resolve_symbol &>/dev/null; then
                        local address=$(tes_resolve_symbol "$symbol" 2>/dev/null || echo "N/A")
                        echo "  Address: $address"

                        if command -v tes_resolve_channel &>/dev/null; then
                            local channel=$(tes_resolve_channel "$symbol" 2>/dev/null || echo "N/A")
                            echo "  Channel: $channel"
                        fi
                    fi
                else
                    echo "  (No active organization - TES resolution unavailable)"
                fi
                echo ""

                # Return to browse mode after displaying
                ORG_REPL_EXECUTE_MODE=false
                return 0
            else
                echo "No action selected" >&2
                return 0
            fi
        else
            # In browse mode (▶), empty return does nothing
            return 0
        fi
    fi

    # Shell command - execute with bash -c for safer execution
    if [[ "$input" == !* ]]; then
        local shell_cmd="${input:1}"
        # Validate command isn't empty
        if [[ -z "$shell_cmd" ]]; then
            echo "Error: Empty shell command" >&2
            return 1
        fi
        # Use bash -c for safer execution (still inherits environment but prevents some injection)
        bash -c "$shell_cmd"
        return $?
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

        # TOML viewing commands
        view|v)
            org_tes_view_all
            return 0
            ;;
        view\ *|v\ *)
            local section="${input#view }"
            section="${section#v }"
            org_toml_view_section "$section"
            return 0
            ;;
        symbols)
            org_toml_view_section "symbols"
            return 0
            ;;
        connectors)
            org_toml_view_section "connectors"
            return 0
            ;;
        environments)
            org_toml_view_section "environments"
            return 0
            ;;

        # SSH commands
        ssh\ *|connect\ *)
            local symbol="${input#ssh }"
            symbol="${symbol#connect }"
            org_tes_connect "$symbol"
            return 0
            ;;
        test\ *)
            local symbol="${input#test }"
            org_tes_test "$symbol"
            return 0
            ;;
    esac

    # Action (verb:noun format) - Use safe action runner (no TTS)
    if [[ "$input" == *:* ]]; then
        local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"

        # Store mode for action runner
        export ORG_REPL_MODE="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

        # Use action runner with TES resolution (TTS disabled for safety)
        org_run_action "$input" "$env"
        local exit_code=$?

        unset ORG_REPL_MODE
        return $exit_code
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

TOML Viewing (New!):
  view, v        View all TES endpoints with full SSH commands
  symbols        View [symbols] section (address mappings)
  connectors     View [connectors] with ready-to-copy SSH commands
  environments   View [environments] section

Connection:
  ssh <symbol>   Connect to endpoint (e.g., ssh @dev)
  test <symbol>  Test connectivity to endpoint

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

Examples:
  view           Show all TES endpoints
  connectors     Show SSH commands for all connectors
  ssh @dev       Connect to dev environment
  test @prod     Test connection to prod environment

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
    export -f repl_build_prompt repl_process_input repl_handle_tab repl_handle_shift_tab repl_handle_space repl_handle_esc repl_handle_single_key

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
export -f repl_handle_single_key
export -f _org_repl_build_prompt
export -f _org_repl_process_input
export -f _org_show_help
export -f _org_show_actions
export -f _org_static_completions
export -f _org_display_action_expansion
export -f _org_display_available_actions
