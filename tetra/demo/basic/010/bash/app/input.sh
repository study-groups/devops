#!/usr/bin/env bash

# TUI Input System - Interface Concern Only
# Responsibility: Key handling, navigation, mode switching
# Never contains content or business logic

# Input mode constants
declare -g INPUT_MODE_GAMEPAD="gamepad"
declare -g INPUT_MODE_REPL="repl"
declare -g CURRENT_INPUT_MODE="$INPUT_MODE_GAMEPAD"

# Navigation state functions (TUI concerns only) - Using pub/sub event system
navigate_env_right() {
    local new_index=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ENV_INDEX=$new_index
    ACTION_INDEX=0  # Reset action when context changes

    # Publish event for state synchronization
    if command -v publish >/dev/null 2>&1; then
        publish "env_changed" "${ENVIRONMENTS[$new_index]}" "$new_index"
    fi

    log_action "Navigation: Environment -> ${ENVIRONMENTS[$new_index]}"
}

navigate_env_left() {
    local new_index=$(( (ENV_INDEX - 1 + ${#ENVIRONMENTS[@]}) % ${#ENVIRONMENTS[@]} ))
    ENV_INDEX=$new_index
    ACTION_INDEX=0  # Reset action when context changes

    # Publish event for state synchronization
    if command -v publish >/dev/null 2>&1; then
        publish "env_changed" "${ENVIRONMENTS[$new_index]}" "$new_index"
    fi

    log_action "Navigation: Environment <- ${ENVIRONMENTS[$new_index]}"
}

navigate_mode_right() {
    local new_index=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    MODE_INDEX=$new_index
    ACTION_INDEX=0  # Reset action when context changes

    # Publish event for state synchronization
    if command -v publish >/dev/null 2>&1; then
        publish "mode_changed" "${MODES[$new_index]}" "$new_index"
    fi

    log_action "Navigation: Mode -> ${MODES[$new_index]}"
}

navigate_mode_left() {
    local new_index=$(( (MODE_INDEX - 1 + ${#MODES[@]}) % ${#MODES[@]} ))
    MODE_INDEX=$new_index
    ACTION_INDEX=0  # Reset action when context changes

    # Publish event for state synchronization
    if command -v publish >/dev/null 2>&1; then
        publish "mode_changed" "${MODES[$new_index]}" "$new_index"
    fi

    log_action "Navigation: Mode <- ${MODES[$new_index]}"
}

navigate_action_right() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        local new_index=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
        ACTION_INDEX=$new_index

        # Publish event for state synchronization
        if command -v publish >/dev/null 2>&1; then
            publish "action_changed" "${actions[$new_index]}" "$new_index"
        fi

        log_action "Navigation: Action -> ${actions[$new_index]}"
    fi
}

navigate_action_left() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        local new_index=$(( (ACTION_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
        ACTION_INDEX=$new_index

        # Publish event for state synchronization
        if command -v publish >/dev/null 2>&1; then
            publish "action_changed" "${actions[$new_index]}" "$new_index"
        fi

        log_action "Navigation: Action <- ${actions[$new_index]}"
    fi
}

navigate_action_up() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        local new_index=$(( (ACTION_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
        ACTION_INDEX=$new_index

        # Publish event for state synchronization
        if command -v publish >/dev/null 2>&1; then
            publish "action_changed" "${actions[$new_index]}" "$new_index"
        fi

        log_action "Navigation: Action ↑ ${actions[$new_index]}"

        # Refresh content display if in actionList mode
        if [[ "$CONTENT_MODE" == "actionList" ]]; then
            refresh_content_display
        fi
    fi
}

navigate_action_down() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        local new_index=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
        ACTION_INDEX=$new_index

        # Publish event for state synchronization
        if command -v publish >/dev/null 2>&1; then
            publish "action_changed" "${actions[$new_index]}" "$new_index"
        fi

        log_action "Navigation: Action ↓ ${actions[$new_index]}"

        # Refresh content display if in actionList mode
        if [[ "$CONTENT_MODE" == "actionList" ]]; then
            refresh_content_display
        fi
    fi
}

# Clear UI content (TUI concern)
clear_ui_content() {
    CONTENT=""
    log_action "UI: Content cleared"
}

# Core input handler - delegates to mode-specific handlers
handle_input() {
    local key="$1"

    case "$CURRENT_INPUT_MODE" in
        "$INPUT_MODE_GAMEPAD")
            handle_gamepad_input "$key"
            ;;
        "$INPUT_MODE_REPL")
            handle_repl_input "$key"
            ;;
        *)
            log_action "Error: Unknown input mode $CURRENT_INPUT_MODE"
            return 0
            ;;
    esac
}

# Gamepad mode input handling
handle_gamepad_input() {
    local key="$1"

    case "$key" in
        # Environment navigation (bidirectional)
        'e') navigate_env_right ;;
        'E') navigate_env_left ;;

        # Mode navigation (bidirectional)
        'd') navigate_mode_right ;;
        'D') navigate_mode_left ;;

        # Action navigation (a/A cycles through actions and shows summary, executes if immediate)
        'a')
            navigate_action_right
            # Auto-show summary when 'a' is pressed
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                local action="${actions[$ACTION_INDEX]}"
                if [[ "$action" == *:* ]]; then
                    local verb="${action%%:*}"
                    local noun="${action##*:}"

                    # Execute immediately if it's an immediate action
                    if is_immediate_action "$verb" "$noun"; then
                        execute_current_action
                    else
                        show_action_info
                    fi
                else
                    show_action_info
                fi
            fi
            ;;
        'A')
            navigate_action_left
            # Auto-show summary when 'A' is pressed
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                local action="${actions[$ACTION_INDEX]}"
                if [[ "$action" == *:* ]]; then
                    local verb="${action%%:*}"
                    local noun="${action##*:}"

                    # Execute immediately if it's an immediate action
                    if is_immediate_action "$verb" "$noun"; then
                        execute_current_action
                    else
                        show_action_info
                    fi
                else
                    show_action_info
                fi
            fi
            ;;

        $'\n'|$'\r')  # Return key executes action
            log_action "Input: Execute action requested"
            execute_current_action
            ;;

        # UI controls
        'c'|'C') clear_ui_content ;;
        'r'|'R')
            log_action "Input: Refresh requested"
            clear_ui_content

            # Enhanced feedback for testing using new formatting
            local current_env="${ENVIRONMENTS[$ENV_INDEX]}"
            local reset_status="RESET: UI cleared"
            local reset_details

            if [[ "$current_env" == "TEST" ]]; then
                reset_details="Env: $current_env | Mode: ${MODES[$MODE_INDEX]} | Ready for TDD testing | Press <Enter> to test show:tui stability"
            else
                reset_details="Env: $current_env | Mode: ${MODES[$MODE_INDEX]} | Content cleared successfully"
            fi

            FOOTER_CONTENT="$(format_footer_combined "$reset_status" "$reset_details")"
            ;;

        # Mode switching
        '/')
            switch_to_repl_mode
            return 0
            ;;

        # Action navigation (vi-style)
        'i')
            log_action "Input: Action up (i)"
            navigate_action_up
            ;;
        'k')
            log_action "Input: Action down (k)"
            navigate_action_down
            ;;

        # Old 'f' key - now deprecated, but leaving for backward compatibility
        'f'|'F')
            log_action "Input: Deprecated key 'f' used - please use 'a/A' instead"
            ;;

        # Test diagnostics (comprehensive)
        'T')
            log_action "Input: Test diagnostics requested"
            show_test_diagnostics
            ;;

        # Help
        '?'|'h'|'H')
            log_action "Input: Help requested"
            show_help
            ;;

        # Handle escape sequences (arrow keys, etc.)
        $'\033')
            # Use arrow handler module
            if ! process_arrow_key; then
                return 1  # Signal to quit if ESC pressed
            fi
            ;;

        # Exit
        'q'|'Q')
            log_action "Input: Quit requested"
            return 1  # Signal to quit
            ;;

        # Unknown key
        *)
            if [[ -n "$key" ]]; then
                log_action "Input: Unknown key '$key' in gamepad mode"
            fi
            ;;
    esac

    return 0
}

# REPL mode input handling with command editing
handle_repl_input() {
    local key="$1"

    case "$key" in
        $'\033') # ESC key
            switch_to_gamepad_mode
            return 1  # Signal to exit REPL
            ;;
        $'
'|$'\r') # Enter key
            if [[ -n "$REPL_INPUT" ]]; then
                # Add to history
                REPL_HISTORY+=("$REPL_INPUT")
                REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

                # Execute command
                execute_repl_command "$REPL_INPUT"

                # Clear input
                REPL_INPUT=""
                REPL_CURSOR_POS=0
            fi
            ;;
        $'\177'|$'\b') # Backspace
            if [[ ${#REPL_INPUT} -gt 0 ]]; then
                REPL_INPUT="${REPL_INPUT%?}"
                if [[ $REPL_CURSOR_POS -gt 0 ]]; then
                    ((REPL_CURSOR_POS--))
                fi
            fi
            ;;
        $'\t') # Tab key - command completion
            handle_repl_tab_completion
            ;;
        *) # Regular character input
            if [[ -n "$key" ]] && [[ ${#key} -eq 1 ]]; then
                REPL_INPUT+="$key"
                ((REPL_CURSOR_POS++))
            fi
            ;;
    esac

    return 0
}

# Handle tab completion in REPL
handle_repl_tab_completion() {
    local current_word="$REPL_INPUT"
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    # Simple completion for commands and contexts
    case "$current_word" in
        "env "*)
            # Complete environment names
            local partial="${current_word#env }"
            for env_name in "${ENVIRONMENTS[@]}"; do
                if [[ "${env_name,,}" =~ ^"${partial,,}" ]]; then
                    REPL_INPUT="env ${env_name,,}"
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
        "mode "*)
            # Complete mode names
            local partial="${current_word#mode }"
            for mode_name in "${MODES[@]}"; do
                if [[ "${mode_name,,}" =~ ^"${partial,,}" ]]; then
                    REPL_INPUT="mode ${mode_name,,}"
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
        "fire "*)
            # Complete action names
            local partial="${current_word#fire }"
            local actions=($(get_actions))
            for action in "${actions[@]}"; do
                if [[ "$action" =~ ^"$partial" ]]; then
                    REPL_INPUT="fire $action"
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
        *)
            # Complete command names
            local commands=("env" "mode" "fire" "ls" "list" "help" "clear")
            for cmd in "${commands[@]}"; do
                if [[ "$cmd" =~ ^"$current_word" ]]; then
                    REPL_INPUT="$cmd "
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
    esac
}

# Mode switching functions
switch_to_gamepad_mode() {
    CURRENT_INPUT_MODE="$INPUT_MODE_GAMEPAD"
    log_action "Input: Switched to gamepad mode"
}

switch_to_repl_mode() {
    CURRENT_INPUT_MODE="$INPUT_MODE_REPL"
    log_action "Input: Switched to REPL mode"
    # Don't echo - let the display system handle it
}

# Input validation and sanitization
validate_action_index() {
    local actions=($(get_actions))
    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
        log_action "Navigation: Action index reset to 0"
    fi
}

# Get environment-specific information
get_env_specific_info() {
    local env="$1"
    local verb="$2"
    local noun="$3"

    case "$env" in
        "MODULES")
            case "$verb:$noun" in
                "show:palette")
                    FOOTER_CONTENT="Color Module: 4 palettes (ENV,MODE,VERBS,NOUNS) × 8 colors
Advanced: weighted distance, 3-way separation, WCAG compliance
Files: color_core.sh color_palettes.sh color_designer.sh"
                    ;;
                "show:input")
                    FOOTER_CONTENT="Input Module: gamepad/REPL modes, e,d,f navigation
Execution: immediate/return/confirm modes, tab completion
Files: input.sh (417 lines)"
                    ;;
                "show:output")
                    FOOTER_CONTENT="Output Module: 4-line header + content + footer regions
Rendering: buffered updates, terminal compatibility
Files: output.sh (266 lines)"
                    ;;
                *)
                    FOOTER_CONTENT="Module System: color, input, output, nouns_verbs
Architecture: clean separation, 010 iteration
Path: $DEMO_DIR/modules/"
                    ;;
            esac
            ;;
        "TUI")
            # Show all actions with response colors (tight format)
            local actions=($(get_actions))
            local info_lines=()
            for action in "${actions[@]}"; do
                if [[ "$action" == *:* ]]; then
                    local action_verb="${action%%:*}"
                    local action_noun="${action##*:}"
                    local response_type=$(get_result_type "$action_verb" "$action_noun" "${MODES[$MODE_INDEX]}")
                    local tag=$(get_mode_tag "${MODES[$MODE_INDEX]}" "$action_verb" "$action_noun")

                    # Use response colors, action colors in parens
                    info_lines+=("$(get_response_type_color "$response_type")@$response_type:$tag$(reset_color) ($(render_action_verb_noun "$action_verb" "$action_noun")$(reset_color))")
                fi
            done

            FOOTER_CONTENT="TUI Actions:
$(printf "%s\n" "${info_lines[@]}")"
            ;;
        *)
            FOOTER_CONTENT="Demo Environment: basic patterns and mechanics
Navigation: e=env d=mode f=action
Execution: immediate show, return others"
            ;;
    esac
}

# Show tightened action information (TUI concern)
show_action_info() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -eq 0 ]]; then
        CONTENT="No actions available"
        return
    fi

    local current_action="${actions[$ACTION_INDEX]}"
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    # Parse verb:noun if available
    if [[ "$current_action" == *:* ]]; then
        local verb="${current_action%%:*}"
        local noun="${current_action##*:}"

        CONTENT="$(render_equation "$env" "$mode" "$verb" "$noun")
$(printf '%.30s' '==============================')

$(get_env_specific_info "$env" "$verb" "$noun")"
    else
        CONTENT="$current_action → ${env}:${mode}
$(printf '%.30s' '==============================')

$(get_env_specific_info "$env" "" "")"
    fi
}

# Help display (TUI concern)
show_help() {
    CONTENT="🎮 Navigation: e,d,a Pattern
=============================

e/E = Environment (left/right)
d/D = Mode (left/right)
a/A = Action (forward/back)
return = Execute current action

c = Clear content
/ = REPL mode
q = Quit

Current: $CURRENT_INPUT_MODE"
}

# Show all currently available functions in E×M context
show_action_catalog() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Simple action catalog display - use new footer formatting
    local display_status="Display Mode: Action List"
    local display_details="Current: $env × $mode | ${#actions[@]} actions available | a=toggle c=clear"

    FOOTER_CONTENT="$(format_footer_combined "$display_status" "$display_details")"

    # Show actions with full equation format
    CONTENT="Available Actions for $env × $mode:
$(generate_section_separator)

"
    for i in "${!actions[@]}"; do
        local action="${actions[$i]}"
        local prefix="  "
        if [[ $i -eq $ACTION_INDEX ]]; then
            prefix="► "
        fi

        if [[ "$action" == *:* ]]; then
            local action_verb="${action%%:*}"
            local action_noun="${action##*:}"

            # Get response type and format equation
            local response_type=$(get_result_type "$action_verb" "$action_noun" "$mode")
            local tag=$(get_mode_tag "$mode" "$action_verb" "$action_noun")

            # Format: verb:noun @stdin[input] → @stdout[output]
            local equation="$(render_action_verb_noun "$action_verb" "$action_noun") @stdin[input] → $(get_response_type_color "$response_type")@$response_type$(reset_color)[output]"

            CONTENT+="$prefix$equation
"
        else
            CONTENT+="$prefix$action
"
        fi
    done
}

# Comprehensive Test diagnostics (moved from action catalog)
show_test_diagnostics() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Comprehensive TDD diagnostic display
    CONTENT=""

    # Enhanced header for Test diagnostics
    CONTENT+="🔬 \033[1;33mTEST DIAGNOSTICS & TDD ANALYSIS\033[0m
================================================================

\033[1;36mCURRENT STATE:\033[0m
Environment: $env | Mode: $mode | Action Index: $ACTION_INDEX
Actions Available: ${#actions[@]}

\033[1;36mTEST MODE BEHAVIOR:\033[0m
"
    if [[ "$mode" == "Test" ]]; then
        CONTENT+="✓ Test mode is ACTIVE - expects exactly 1 action: show:tui
✓ Test mode overrides environment nouns for consistent testing
✓ Purpose: Screen jostling detection and TUI stability validation
"
    else
        CONTENT+="⚠ Test mode is NOT active - normal E×M action generation
ℹ To activate Test mode: navigate to any environment, then switch to Test mode
ℹ Test mode provides consistent single-action behavior for TDD
"
    fi

    CONTENT+="

\033[1;36mACTION METADATA ANALYSIS:\033[0m
"

    for i in "${!actions[@]}"; do
        local action="${actions[$i]}"
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"

            # Get ALL available metadata
            local result_type=$(get_result_type "$verb" "$noun" "$mode" 2>/dev/null || echo "output")
            local tag=$(get_mode_tag "$mode" "$verb" "$noun" 2>/dev/null || echo "$mode")
            local execution_mode=$(get_action_execution_mode "$verb" "$noun" 2>/dev/null || echo "unknown")
            local description=$(get_action_description "$verb" "$noun" 2>/dev/null || echo "No description")
            local is_immediate=$(is_immediate_action "$verb" "$noun" && echo "✓" || echo "×")

            # Function signature with comprehensive metadata
            local signature="$verb($noun)"
            local return_type="$result_type[$tag]"

            # Execution timing indicator
            local timing_indicator=""
            case "$execution_mode" in
                "immediate") timing_indicator="⚡ instant" ;;
                "return") timing_indicator="⏎ delayed" ;;
                "confirm") timing_indicator="⚠ confirm" ;;
                *) timing_indicator="? unknown" ;;
            esac

            # Current action gets detailed diagnostic treatment
            if [[ $i -eq $ACTION_INDEX ]]; then
                CONTENT+="$(printf "\033[1;33m► %-16s\033[0m → \033[1;36m%-16s\033[0m \033[1;32m%-12s\033[0m \033[1;35mIMM:%s\033[0m" "$signature" "$return_type" "$timing_indicator" "$is_immediate")"$'\n'

                # Enhanced diagnostic for any mode
                CONTENT+="  \033[1;31m🎯 CURRENT TEST TARGET:\033[0m $description"$'\n'
                CONTENT+="  \033[2m   • Execution: $execution_mode mode (immediate execution: $is_immediate)\033[0m"$'\n'
                CONTENT+="  \033[2m   • Context: $env × $mode\033[0m"$'\n'
                CONTENT+="  \033[2m   • Expected: Clean execution, stable screen regions, no jostling\033[0m"$'\n'
            else
                # Other actions get compact display
                CONTENT+="$(printf "\033[2m  %-16s → %-16s %-12s IMM:%s\033[0m" "$signature" "$return_type" "$timing_indicator" "$is_immediate")"$'\n'
            fi

            CONTENT+=""$'\n'
        fi
    done

    CONTENT+="================================================================
\033[1;36mTDD TEST PATTERNS TO RECOGNIZE:\033[0m
• \033[1;32mImmediate actions\033[0m should execute on 'f' navigation without <Enter>
• \033[1;33mFooter updates\033[0m should not cause screen jumping or cursor displacement
• \033[1;35mContent clearing\033[0m should be clean and stable with 'c' key
• \033[1;31mScreen regions\033[0m should maintain consistent positioning during all operations
• \033[1;36mNavigation\033[0m should be smooth with e/d/f keys and no visual artifacts

\033[1;33mTDD WORKFLOW:\033[0m
1. Switch to Test mode (any environment × Test)
2. Verify exactly 1 action appears: show:tui
3. Press 'f' to execute (immediate mode)
4. Check footer for diagnostic info, no screen jostling
5. Press 'r' to reset, verify clean state
6. Repeat across different environments for consistency testing

\033[1;31mKNOWN ISSUES TO TEST FOR:\033[0m
• Screen jostling during action execution
• Cursor position instability
• Footer content formatting inconsistencies
• Echo statement leakage causing display disruption
"
}

# Show function signatures with enhanced expressive formatting and rich colors
show_function_signatures() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Generate expressive documentation with rich formatting and color variations
    {
        # Main header with dynamic colors
        format_section_header "TView Action System" "topic_special"

        # Context information with environmental colors
        local env_color="env_$(echo "$env" | tr '[:upper:]' '[:lower:]')"
        local mode_color="mode_$(echo "$mode" | tr '[:upper:]' '[:lower:]')"

        format_paragraph "topic_info" "Active Context" "vivid" "$env_color" "$env"
        format_paragraph "topic_accent" "Current Mode" "vivid" "$mode_color" "$mode"
        format_paragraph "content_subtle" "Scope Definition" "dim" "content_secondary" "This context defines available operations and resource scope for infrastructure transformation"

        format_section_header "Available Transformations" "topic_primary"

        for i in "${!actions[@]}"; do
            local action="${actions[$i]}"
            if [[ "$action" == *:* ]]; then
                local verb="${action%%:*}"
                local noun="${action##*:}"
                local result_type=$(get_result_type "$verb" "$noun" "$mode")
                local tag=$(get_mode_tag "$mode" "$verb" "$noun")

                # Refresh colors for current action
                refresh_color_state "$verb" "$noun"

                # Function signature with tetra terminology and colors
                if [[ $i -eq $ACTION_INDEX ]]; then
                    # Current action: bold and prominent
                    printf "\033[1m%2d. %s → @%s[%s]\033[0m\n" \
                        $((i+1)) "$(render_action_verb_noun "$verb" "$noun")" "$result_type" "$tag"
                else
                    # Non-current action: dimmed
                    printf "\033[2m%2d. %s → @%s[%s]\033[0m\n" \
                        $((i+1)) "$(render_action_verb_noun "$verb" "$noun")" "$result_type" "$tag"
                fi

                # Enhanced explanation with tetra concepts
                echo "$(indent_content "$(description_text "Transforms") $(tetra_term "$noun") $(description_text "resource using") $(tetra_term "$verb") $(description_text "operation in") $(tetra_term "$env") $(description_text "environment")")"

                # Technical details
                case "$verb:$noun" in
                    "show:demo")
                        echo "$(indent_content "$(description_text "• Renders active") $(tetra_term "Context") $(description_text "state and available") $(tetra_term "Module") $(description_text "operations")")"
                        echo "$(indent_content "$(description_text "• Demonstrates") $(tetra_term "E×M") $(description_text "algebra through interactive TUI mechanics")")"
                        ;;
                    "show:colors")
                        echo "$(indent_content "$(description_text "• Exposes") $(tetra_term "TUI") $(description_text "color system with") $(tetra_term "ENV/MODE/VERBS/NOUNS") $(description_text "palette architecture")")"
                        echo "$(indent_content "$(description_text "• Demonstrates semantic design tokens for") $(tetra_term "Module") $(description_text "composition")")"
                        ;;
                    "configure:"*)
                        echo "$(indent_content "$(description_text "• Enables") $(tetra_term "verb×noun") $(description_text "state editing through TUI interface")")"
                        echo "$(indent_content "$(description_text "• Shows how all") $(tetra_term "Tetra Modules") $(description_text "support configuration through standardized patterns")")"
                        ;;
                    "test:"*)
                        echo "$(indent_content "$(description_text "• Validates") $(tetra_term "transformation") $(description_text "correctness and") $(tetra_term "Module") $(description_text "behavior")")"
                        echo "$(indent_content "$(description_text "• Demonstrates") $(tetra_term "Context") $(description_text "isolation and reproducible operations")")"
                        ;;
                esac
                echo
            fi
        done

        echo "$(generate_emphasis_separator)"
        echo
        echo "$(tetra_term "Core Tetra Concepts"):"
        echo
        echo "$(indent_content "$(tetra_term "Environment"): $(description_text "Execution context that determines available resources and scope")")"
        echo "$(indent_content "$(tetra_term "Module"): $(description_text "Functional unit providing specific capabilities with standardized interface")")"
        echo "$(indent_content "$(tetra_term "Transformation"): $(description_text "Type-safe operation that converts input resources to output resources")")"
        echo "$(indent_content "$(tetra_term "Context Algebra"): $(description_text "Mathematical foundation ensuring composable and predictable operations")")"
        echo "$(indent_content "$(tetra_term "verb×noun"): $(description_text "UI state mechanism enabling configuration editing through standardized patterns")")"
        echo
        echo "$(tetra_term "Design Philosophy"): $(description_text "Every") $(tetra_term "Module") $(description_text "supports introspection and configuration through") $(tetra_term "verb×noun") $(description_text "interactions, creating a uniform management interface across all") $(tetra_term "Tetra") $(description_text "infrastructure components.")"

    } | less -R

    # Clear screen after less exits
    clear_ui_content
}

# Get input mode for display
get_input_mode_display() {
    case "$CURRENT_INPUT_MODE" in
        "$INPUT_MODE_GAMEPAD") echo "🎮" ;;
        "$INPUT_MODE_REPL") echo "💻" ;;
        *) echo "?" ;;
    esac
}