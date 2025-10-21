#!/usr/bin/env bash
# Org REPL TUI - Full screen control with in-place prompt updates

source "$TETRA_SRC/bash/tcurses/tcurses.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"
source "$TETRA_SRC/bash/org/actions.sh"

# State
ORG_REPL_ENV_INDEX=0
ORG_REPL_MODE_INDEX=0
ORG_REPL_ACTION_INDEX=0
ORG_REPL_ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
ORG_REPL_MODES=("Inspect" "Transfer" "Execute")
ORG_REPL_INPUT=""
ORG_REPL_CURSOR_POS=0
ORG_REPL_OUTPUT_LINES=()
ORG_REPL_RUNNING=true
ORG_REPL_SHOW_ACTION_MENU=false
ORG_REPL_ACTION_MENU_INDEX=0
ORG_REPL_COMMAND_HISTORY=()
ORG_REPL_LOG_LINES=()

# Helpers
_org_active() { org_active 2>/dev/null || echo "none"; }
_org_actions() {
    org_get_actions "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" \
                    "${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
}

# Build prompt string
_org_build_prompt_text() {
    local org=$(_org_active)
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    local actions=($(_org_actions))
    local action="${actions[$ORG_REPL_ACTION_INDEX]:-none}"

    # Build colored prompt string
    local prompt=""
    prompt+="$(text_color "$REPL_BRACKET")[$(reset_color)"

    if [[ -z "$org" || "$org" == "none" ]]; then
        prompt+="$(text_color "$REPL_ORG_INACTIVE")none$(reset_color)"
    else
        prompt+="$(text_color "$REPL_ORG_ACTIVE")${org}$(reset_color)"
    fi

    prompt+="$(text_color "$REPL_SEPARATOR") x $(reset_color)"
    prompt+="$(text_color "$(repl_env_color "$ORG_REPL_ENV_INDEX")")${env}$(reset_color)"
    prompt+="$(text_color "$REPL_SEPARATOR") x $(reset_color)"
    prompt+="$(text_color "$(repl_mode_color "$ORG_REPL_MODE_INDEX")")${mode}$(reset_color)"
    prompt+="$(text_color "$REPL_BRACKET")] $(reset_color)"

    if [[ -z "$action" || "$action" == "none" ]]; then
        prompt+="$(text_color "$REPL_ACTION_NONE")none$(reset_color)"
    else
        prompt+="$(text_color "$REPL_ACTION_ACTIVE")${action}$(reset_color)"
    fi

    prompt+="$(text_color "$REPL_ARROW")> $(reset_color)"

    echo "$prompt"
}

# Render the screen
# Layout from top to bottom:
# 1. Header (lines 0-2)
# 2. Help text (line 3)
# 3. Prompt/Input (lines 4-5)
# 4. Results area (lines 6 to term_height-6)
# 5. Log footer (last 4 lines: term_height-5 to term_height-1)
_org_render() {
    local term_height=$(tput lines)
    local term_width=$(tput cols)

    tcurses_buffer_clear

    # Header (lines 0-2)
    local header="═══════════════════════════════════════════════════════════"
    tcurses_buffer_write_line 0 "$header"
    tcurses_buffer_write_line 1 "  TETRA ORGANIZATION MANAGEMENT"
    tcurses_buffer_write_line 2 "$header"

    # Help text (line 3)
    tcurses_buffer_write_line 3 "Ctrl+E/R/A navigate, Ctrl+X execute, Tab actions | 'help' for more"

    # Prompt and input line (lines 4-5)
    local prompt_text=$(_org_build_prompt_text)
    local input_line="${prompt_text}${ORG_REPL_INPUT}"

    # Add cursor (simplified - just append at end)
    input_line="${input_line}█"

    tcurses_buffer_write_line 4 ""
    tcurses_buffer_write_line 5 "$input_line"

    # Results area (from line 6 to term_height-6)
    local results_start=6
    local log_height=5  # 1 separator + 4 log lines
    local results_end=$((term_height - log_height - 1))
    local max_results_lines=$((results_end - results_start))
    local line_num=results_start

    tcurses_buffer_write_line $line_num ""
    ((line_num++))

    # Show action menu if active
    if $ORG_REPL_SHOW_ACTION_MENU; then
        tcurses_buffer_write_line $line_num "Available actions (↑/↓ to navigate, Enter to select, Tab to close):"
        ((line_num++))
        tcurses_buffer_write_line $line_num ""
        ((line_num++))

        local actions=($(_org_actions))
        for ((i = 0; i < ${#actions[@]} && line_num <= results_end; i++)); do
            local action="${actions[$i]}"
            if [[ $i -eq $ORG_REPL_ACTION_MENU_INDEX ]]; then
                tcurses_buffer_write_line $line_num "  → $(text_color "$REPL_ACTION_ACTIVE")${action}$(reset_color)"
            else
                tcurses_buffer_write_line $line_num "    ${action}"
            fi
            ((line_num++))
        done
    else
        # Show regular output (most recent results)
        for ((i = 0; i < ${#ORG_REPL_OUTPUT_LINES[@]} && line_num <= results_end; i++)); do
            tcurses_buffer_write_line $line_num "${ORG_REPL_OUTPUT_LINES[$i]}"
            ((line_num++))
        done
    fi

    # Log footer (last 4 lines, bottom-up)
    local log_start=$((term_height - 4))
    tcurses_buffer_write_line $((log_start - 1)) "───────────────────────────────────────────────────────────"

    # Show last 4 log lines (bottom-up: most recent at bottom)
    local log_count=${#ORG_REPL_LOG_LINES[@]}
    local log_display_start=$((log_count > 4 ? log_count - 4 : 0))

    local log_line_num=$log_start
    for ((i = log_display_start; i < log_count && log_line_num < term_height; i++)); do
        tcurses_buffer_write_line $log_line_num "${ORG_REPL_LOG_LINES[$i]}"
        ((log_line_num++))
    done

    tcurses_buffer_render_diff
}

# Add output line (clears previous output)
_org_add_output() {
    ORG_REPL_OUTPUT_LINES+=("$1")
}

# Clear output area
_org_clear_output() {
    ORG_REPL_OUTPUT_LINES=()
}

# Add log line (keeps last 20, shows last 4)
_org_add_log() {
    local timestamp=$(date '+%H:%M:%S')
    ORG_REPL_LOG_LINES+=("$(text_color "$REPL_SEPARATOR")[$timestamp]$(reset_color) $1")

    # Keep only last 20 log entries
    if [[ ${#ORG_REPL_LOG_LINES[@]} -gt 20 ]]; then
        ORG_REPL_LOG_LINES=("${ORG_REPL_LOG_LINES[@]:(-20)}")
    fi
}

# Toggle action menu
_org_toggle_action_menu() {
    if $ORG_REPL_SHOW_ACTION_MENU; then
        ORG_REPL_SHOW_ACTION_MENU=false
    else
        ORG_REPL_SHOW_ACTION_MENU=true
        ORG_REPL_ACTION_MENU_INDEX=0
    fi
}

# Navigate action menu
_org_action_menu_up() {
    local actions=($(_org_actions))
    [[ ${#actions[@]} -gt 0 ]] && ORG_REPL_ACTION_MENU_INDEX=$(( (ORG_REPL_ACTION_MENU_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
}

_org_action_menu_down() {
    local actions=($(_org_actions))
    [[ ${#actions[@]} -gt 0 ]] && ORG_REPL_ACTION_MENU_INDEX=$(( (ORG_REPL_ACTION_MENU_INDEX + 1) % ${#actions[@]} ))
}

# Select action from menu
_org_select_action_from_menu() {
    local actions=($(_org_actions))
    local action="${actions[$ORG_REPL_ACTION_MENU_INDEX]}"
    if [[ -n "$action" && "$action" != "none" ]]; then
        ORG_REPL_INPUT="$action"
        ORG_REPL_CURSOR_POS=${#ORG_REPL_INPUT}
        ORG_REPL_SHOW_ACTION_MENU=false
    fi
}

# Handle input character
_org_handle_char() {
    local char="$1"
    ORG_REPL_INPUT="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}${char}${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
    ((ORG_REPL_CURSOR_POS++))
}

# Handle backspace
_org_handle_backspace() {
    if [[ $ORG_REPL_CURSOR_POS -gt 0 ]]; then
        ORG_REPL_INPUT="${ORG_REPL_INPUT:0:$((ORG_REPL_CURSOR_POS-1))}${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
        ((ORG_REPL_CURSOR_POS--))
    fi
}

# Handle enter
_org_handle_enter() {
    local input="$ORG_REPL_INPUT"
    ORG_REPL_INPUT=""
    ORG_REPL_CURSOR_POS=0

    if [[ -z "$input" ]]; then
        return
    fi

    # Clear previous output
    _org_clear_output

    # Add to log
    _org_add_log "$(text_color "$REPL_ARROW")>$(reset_color) $input"

    # Process command
    case "$input" in
        exit|quit|q)
            _org_add_log "Exiting..."
            ORG_REPL_RUNNING=false
            ;;
        clear)
            _org_clear_output
            ORG_REPL_LOG_LINES=()
            _org_add_log "Screen cleared"
            ;;
        help|h|\?)
            _org_add_output "Commands:"
            _org_add_output "  Ctrl+E         Cycle environment (Local/Dev/Staging/Production)"
            _org_add_output "  Ctrl+R         Cycle mode (Inspect/Transfer/Execute)"
            _org_add_output "  Ctrl+A         Cycle action (view:toml/view:env/etc)"
            _org_add_output "  Tab            Show/hide action menu (↑/↓ to navigate)"
            _org_add_output "  Ctrl+X/Enter   Execute current action (shown in prompt)"
            _org_add_output "  verb:noun      Execute action directly"
            _org_add_output "  list           List organizations"
            _org_add_output "  clear          Clear output"
            _org_add_output "  help           Show this help"
            _org_add_output "  exit           Exit REPL"
            _org_add_output ""
            _org_add_log "Showed help"
            ;;
        list|ls)
            local output=$(org_list 2>&1)
            while IFS= read -r line; do
                _org_add_output "  $line"
            done <<< "$output"
            _org_add_output ""
            _org_add_log "Listed organizations"
            ;;
        '')
            # Empty command - execute current action from prompt
            local actions=($(_org_actions))
            local action="${actions[$ORG_REPL_ACTION_INDEX]}"
            if [[ -n "$action" && "$action" != "none" ]]; then
                _org_add_log "Executing: $action"
                local output=$(org_execute_action "$action" "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" 2>&1)
                while IFS= read -r line; do
                    _org_add_output "  $line"
                done <<< "$output"
                _org_add_output ""
            fi
            ;;
        *)
            if [[ "$input" == *:* ]]; then
                _org_add_log "Executing: $input"
                local output=$(org_execute_action "$input" "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" 2>&1)
                while IFS= read -r line; do
                    _org_add_output "  $line"
                done <<< "$output"
                _org_add_output ""
            else
                _org_add_output "  Unknown: $input (try 'help')"
                _org_add_output ""
                _org_add_log "Unknown command: $input"
            fi
            ;;
    esac
}

# Cycle environment
_org_cycle_env() {
    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % ${#ORG_REPL_ENVIRONMENTS[@]} ))
    ORG_REPL_ACTION_INDEX=0
    # Prompt will update on next render
}

# Cycle mode
_org_cycle_mode() {
    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % ${#ORG_REPL_MODES[@]} ))
    ORG_REPL_ACTION_INDEX=0
    # Prompt will update on next render
}

# Cycle action
_org_cycle_action() {
    local actions=($(_org_actions))
    [[ ${#actions[@]} -gt 0 ]] && ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX + 1) % ${#actions[@]} ))
    # Prompt will update on next render
}

# Main TUI loop
org_repl_tui() {
    # Initialize tcurses
    tcurses_init
    tcurses_buffer_init

    # Clear output buffer
    ORG_REPL_OUTPUT_LINES=()

    # Clear screen
    tput clear
    tput civis  # Hide cursor

    # Initial render
    _org_render

    # Main loop
    while $ORG_REPL_RUNNING; do
        # Read single character
        IFS= read -rsn1 char

        case "$char" in
            $'\x1b')  # Escape sequence
                read -rsn2 -t 0.1 seq
                case "$seq" in
                    '[D')  # Left arrow
                        if ! $ORG_REPL_SHOW_ACTION_MENU; then
                            [[ $ORG_REPL_CURSOR_POS -gt 0 ]] && ((ORG_REPL_CURSOR_POS--))
                        fi
                        ;;
                    '[C')  # Right arrow
                        if ! $ORG_REPL_SHOW_ACTION_MENU; then
                            [[ $ORG_REPL_CURSOR_POS -lt ${#ORG_REPL_INPUT} ]] && ((ORG_REPL_CURSOR_POS++))
                        fi
                        ;;
                    '[A')  # Up arrow
                        if $ORG_REPL_SHOW_ACTION_MENU; then
                            _org_action_menu_up
                        fi
                        ;;
                    '[B')  # Down arrow
                        if $ORG_REPL_SHOW_ACTION_MENU; then
                            _org_action_menu_down
                        fi
                        ;;
                esac
                ;;
            $'\x09')  # Tab - toggle action menu
                _org_toggle_action_menu
                ;;
            $'\x7f'|$'\x08')  # Backspace
                _org_handle_backspace
                ;;
            $'\x0a'|$'\x0d'|'')  # Enter (0x0a = LF, 0x0d = CR, '' = edge case)
                if $ORG_REPL_SHOW_ACTION_MENU; then
                    _org_select_action_from_menu
                else
                    _org_handle_enter
                fi
                ;;
            $'\x05')  # Ctrl+E - cycle environment
                _org_cycle_env
                _org_add_log "Environment: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
                ;;
            $'\x12')  # Ctrl+R - cycle mode
                _org_cycle_mode
                _org_add_log "Mode: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
                ;;
            $'\x18')  # Ctrl+X - execute current action
                _org_handle_enter
                ;;
            $'\x01')  # Ctrl+A - cycle action
                _org_cycle_action
                local actions=($(_org_actions))
                _org_add_log "Action: ${actions[$ORG_REPL_ACTION_INDEX]:-none}"
                ;;
            $'\x03')  # Ctrl+C - exit
                ORG_REPL_RUNNING=false
                ;;
            [[:print:]])  # Printable character
                _org_handle_char "$char"
                ;;
        esac

        # Re-render after each input
        _org_render
    done

    # Cleanup
    tput cnorm  # Show cursor
    tput clear
    tcurses_cleanup
}

export -f org_repl_tui
