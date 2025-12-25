#!/usr/bin/env bash
# Tetra TUI Interface
# The definitive tetra app - combines best of 010, 013, 014, and unicode_explorer_v2

# ============================================================================
# INITIALIZATION
# ============================================================================

# Ensure TETRA_SRC is set
: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source TDS for color system
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
else
    echo "Error: TDS not found at $TDS_SRC" >&2
    return 1
fi

# Source buffer system
source "$TETRA_SRC/bash/tetra/rendering/buffer.sh"

# Source action system
source "$TETRA_SRC/bash/tetra/rendering/actions.sh"

# Source mode-module-repl system
source "$TETRA_SRC/bash/tetra/modes/matrix.sh"
source "$TETRA_SRC/bash/repl/temperature_loader.sh"
source "$TETRA_SRC/bash/repl/mode_repl.sh"

# Source module action interfaces (conditionally - some may not exist)
[[ -f "$TETRA_SRC/bash/org/action_interface.sh" ]] && \
    source "$TETRA_SRC/bash/org/action_interface.sh"
[[ -f "$TETRA_SRC/bash/tsm/action_interface.sh" ]] && \
    source "$TETRA_SRC/bash/tsm/action_interface.sh"
[[ -f "$TETRA_SRC/bash/deploy/action_interface.sh" ]] && \
    source "$TETRA_SRC/bash/deploy/action_interface.sh"

# Source bug mode (unicode explorer easter egg)
source "$TETRA_SRC/bash/tetra/modes/bug.sh"

# Tetra branded spinner
declare -ga TETRA_SPINNER=(
    $'\u00B7'    # · - idle/waiting
    $'\u2025'    # ‥ - initializing
    $'\u2026'    # … - processing
    $'\u22EF'    # ⋯ - working
    $'\u2059'    # ⁙ - completing
)

# Spinner state constants
TETRA_SPINNER_IDLE=0
TETRA_SPINNER_INIT=1
TETRA_SPINNER_PROC=2
TETRA_SPINNER_WORK=3
TETRA_SPINNER_DONE=4

# ============================================================================
# CONTENT MODEL
# ============================================================================

declare -gA CONTENT_MODEL=(
    [env]="Local"
    [env_index]="0"
    [mode]="Inspect"
    [mode_index]="0"
    [action]=""
    [action_index]="0"
    [action_state]="idle"
    [spinner_state]="0"
    [status_line]=""
    [header_size]="max"
    [command_mode]="false"
    [command_input]=""
    [view_mode]="false"
    [scroll_offset]="0"
    [preview_mode]="false"
    [animation_enabled]="true"
    [separator_position]="0"
)

# Content buffers
declare -gA TUI_BUFFERS=(
    ["@tui[header]"]=""
    ["@tui[separator]"]=""
    ["@tui[command]"]=""
    ["@tui[content]"]=""
    ["@tui[footer]"]=""
    ["@tui[status]"]=""
)

# ============================================================================
# LAYOUT & DIMENSIONS
# ============================================================================

# Terminal dimensions
TUI_HEIGHT=24
TUI_WIDTH=80

# Region sizes (calculated dynamically)
HEADER_LINES=6
SEPARATOR_LINES=1
COMMAND_LINES=0  # 1 when in command mode
FOOTER_LINES=5
CONTENT_VIEWPORT_HEIGHT=0

# Layout calculation
calculate_layout() {
    # Get current terminal size
    if [[ -e /dev/tty ]]; then
        read TUI_HEIGHT TUI_WIDTH < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$TUI_HEIGHT" ]] && TUI_HEIGHT=$(tput lines 2>/dev/null || echo 24)
    [[ -z "$TUI_WIDTH" ]] && TUI_WIDTH=$(tput cols 2>/dev/null || echo 80)

    # Adjust header size
    case "${CONTENT_MODEL[header_size]}" in
        max) HEADER_LINES=6 ;;
        med) HEADER_LINES=4 ;;
        min) HEADER_LINES=2 ;;
    esac

    # Command line takes 1 line when active
    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        COMMAND_LINES=1
    else
        COMMAND_LINES=0
    fi

    # Calculate content viewport
    CONTENT_VIEWPORT_HEIGHT=$((TUI_HEIGHT - HEADER_LINES - SEPARATOR_LINES - COMMAND_LINES - FOOTER_LINES))
    [[ $CONTENT_VIEWPORT_HEIGHT -lt 1 ]] && CONTENT_VIEWPORT_HEIGHT=1
}

# Resize handler
handle_resize() {
    calculate_layout
    needs_redraw=true
    is_first_render=true
}

# ============================================================================
# RENDERING SYSTEM
# ============================================================================

# Render header
render_header() {
    local env="${CONTENT_MODEL[env]}"
    local mode="${CONTENT_MODEL[mode]}"
    local action="${CONTENT_MODEL[action]}"
    local state="${CONTENT_MODEL[action_state]}"
    local spinner="${TETRA_SPINNER[${CONTENT_MODEL[spinner_state]}]}"

    # Update region boundaries
    tui_region_update

    local line_num=0

    # Top line: state indicator with spinner
    local state_display="$state"
    if [[ "$state" == "executing" ]]; then
        state_display="$spinner $state"
    fi

    local line=""
    line+="$(tds_text_color "tetra.header.state")"
    line+="  $state_display"
    line+="$(reset_color)"
    tui_write_header $line_num "$line"
    ((line_num++))

    # Environment line
    line=""
    line+="$(tds_text_color "tetra.header.label")"
    line+="Env: "
    line+="$(reset_color)"
    line+="$(tds_text_color "tetra.header.env")"
    line+="[$env]"
    line+="$(reset_color)"
    tui_write_header $line_num "$line"
    ((line_num++))

    # Mode line
    line=""
    line+="$(tds_text_color "tetra.header.label")"
    line+="Mode: "
    line+="$(reset_color)"
    line+="$(tds_text_color "tetra.header.mode")"
    line+="[$mode]"
    line+="$(reset_color)"
    tui_write_header $line_num "$line"
    ((line_num++))

    # Action line
    if [[ -n "$action" ]]; then
        line=""
        line+="$(tds_text_color "tetra.header.label")"
        line+="Action: "
        line+="$(reset_color)"
        line+="$(tds_text_color "tetra.action.verb")"
        line+="${action%%:*}"
        line+="$(reset_color)"
        line+=":"
        line+="$(tds_text_color "tetra.action.noun")"
        line+="${action##*:}"
        line+="$(reset_color)"
        tui_write_header $line_num "$line"
        ((line_num++))
    fi

    # Status line
    if [[ -n "${CONTENT_MODEL[status_line]}" ]]; then
        line=""
        line+="$(tds_text_color "tetra.header.label")"
        line+="Status: "
        line+="$(reset_color)"
        line+="${CONTENT_MODEL[status_line]}"
        tui_write_header $line_num "$line"
        ((line_num++))
    fi
}

# Render animated separator
render_separator() {
    local sep_char="─"
    local width="$TUI_WIDTH"
    local position="${CONTENT_MODEL[separator_position]}"

    local output=""
    output+="$(tds_text_color "tetra.separator.line")"

    # Animated marker moves across separator
    for ((i=0; i<width; i++)); do
        if [[ $i -eq $((position % width)) ]] && [[ "${CONTENT_MODEL[animation_enabled]}" == "true" ]]; then
            output+="⋯"
        else
            output+="$sep_char"
        fi
    done

    output+="$(reset_color)"
    tui_write_separator "$output"
}

# Render command line (appears below separator when in command mode)
render_command_line() {
    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        local output=""
        output+="$(tds_text_color "tetra.command.prompt")"
        output+=":"
        output+="$(reset_color)"
        output+="$(tds_text_color "tetra.command.input")"
        output+="${CONTENT_MODEL[command_input]}_"
        output+="$(reset_color)"
        tui_write_command "$output"
    fi
}

# Render content area
render_content() {
    local content="${TUI_BUFFERS["@tui[content]"]}"

    if [[ -z "$content" ]]; then
        local env="${CONTENT_MODEL[env]}"
        local mode="${CONTENT_MODEL[mode]}"

        # Get modules and actions for current context
        local modules=$(get_modules_for_context "$env" "$mode")
        local actions=$(get_actions_for_context "$env" "$mode")

        content="⁘ Tetra Control Center

Context: $env × $mode

Modules:"
        for module in $modules; do
            local marker=$(get_module_marker "$module")
            local temp=$(get_module_temperature "$module")
            content+="
  $marker $module ($temp)"
        done

        content+="

Actions:"
        local count=0
        for action in $actions; do
            if [[ $count -eq 0 ]]; then
                content+="
  "
            fi
            content+="$action "
            ((count++))
            if [[ $count -ge 4 ]]; then
                count=0
            fi
        done

        content+="

Navigation:
  e=env  m=mode  a=action  Enter=execute

Press 'u' for unicode playground
Press 'w' for web dashboard"
    fi

    # Handle view mode scrolling
    if [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        local total_lines=$(echo -e "$content" | wc -l)
        local offset="${CONTENT_MODEL[scroll_offset]}"
        content=$(echo -e "$content" | tail -n +$((offset + 1)) | head -n $((CONTENT_VIEWPORT_HEIGHT - 1)))

        local scroll_info="$(tds_text_color "tetra.content.dim")"
        scroll_info+="[Scroll: $offset/$total_lines | ↑↓=scroll ESC=back]"
        scroll_info+="$(reset_color)"
        content+=$'\n'"$scroll_info"
    else
        # Truncate to viewport
        local line_count=$(echo -e "$content" | wc -l)
        if [[ $line_count -gt $CONTENT_VIEWPORT_HEIGHT ]]; then
            content=$(echo -e "$content" | head -n $((CONTENT_VIEWPORT_HEIGHT - 1)))
            local trunc_info="$(tds_text_color "tetra.content.dim")"
            trunc_info+="[Content truncated - press 'v' to view all]"
            trunc_info+="$(reset_color)"
            content+=$'\n'"$trunc_info"
        fi
    fi

    # Write content line by line to buffer
    local line_num=0
    while IFS= read -r line; do
        tui_write_content $line_num "$line"
        ((line_num++))
    done <<< "$content"
}

# Render footer
render_footer() {
    local line_num=0
    local output=""

    output+="$(tds_text_color "tetra.footer.hint")"

    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        output+="Command mode | ESC=exit Enter=execute"
    elif [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        output+="View mode | ↑↓=scroll ESC=back"
    else
        output+="e=env m=mode a=action Enter=exec | w=web :=cmd | h=header o=anim c=clear q=quit"
    fi

    output+="$(reset_color)"

    # Blank line before footer
    tui_write_footer 0 ""
    # Footer text
    tui_write_footer 1 "$output"
}

# Main render function
render_screen() {
    local first_render="${1:-false}"

    # Clear buffer and rebuild
    tui_buffer_clear

    # Populate buffer
    render_header
    render_separator
    render_command_line
    render_content
    render_footer

    # Render: full screen on first call, differential updates after
    if [[ "$first_render" == "true" ]]; then
        tui_buffer_render_full
    else
        tui_buffer_render_diff
    fi
}

# ============================================================================
# INPUT HANDLING
# ============================================================================

# Handle key press
handle_key() {
    local key="$1"

    # Command mode input
    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        case "$key" in
            $'\x7f'|$'\b')  # Backspace
                CONTENT_MODEL[command_input]="${CONTENT_MODEL[command_input]%?}"
                ;;
            $'\n'|'')  # Enter
                execute_command "${CONTENT_MODEL[command_input]}"
                CONTENT_MODEL[command_mode]="false"
                CONTENT_MODEL[command_input]=""
                calculate_layout
                ;;
            $'\e')  # Escape
                CONTENT_MODEL[command_mode]="false"
                CONTENT_MODEL[command_input]=""
                calculate_layout
                ;;
            *)  # Regular character
                CONTENT_MODEL[command_input]+="$key"
                ;;
        esac
        return
    fi

    # View mode input
    if [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        case "$key" in
            $'\x1b[A')  # Up arrow
                local offset="${CONTENT_MODEL[scroll_offset]}"
                [[ $offset -gt 0 ]] && CONTENT_MODEL[scroll_offset]=$((offset - 1))
                ;;
            $'\x1b[B')  # Down arrow
                CONTENT_MODEL[scroll_offset]=$((CONTENT_MODEL[scroll_offset] + 1))
                ;;
            $'\e')  # Escape
                CONTENT_MODEL[view_mode]="false"
                CONTENT_MODEL[scroll_offset]="0"
                ;;
        esac
        return
    fi

    # Normal mode input
    case "$key" in
        'e'|'E')
            nav_env
            ;;
        'm'|'M')
            nav_mode
            ;;
        'a'|'A')
            nav_action
            ;;
        ''|$'\n')
            execute_action
            ;;
        ':')
            CONTENT_MODEL[command_mode]="true"
            calculate_layout
            ;;
        'v'|'V')
            CONTENT_MODEL[view_mode]="true"
            ;;
        'u'|'U')
            enter_bug_mode
            ;;
        'w'|'W')
            toggle_web_dashboard
            ;;
        'h'|'H')
            cycle_header_size
            ;;
        'o'|'O')
            toggle_animation
            ;;
        'c'|'C')
            TUI_BUFFERS["@tui[content]"]=""
            ;;
        'q'|'Q')
            return 1  # Signal quit
            ;;
    esac

    return 0
}

# ============================================================================
# NAVIGATION
# ============================================================================

ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
MODES=("Inspect" "Transfer" "Execute")

nav_env() {
    local idx="${CONTENT_MODEL[env_index]}"
    idx=$(( (idx + 1) % ${#ENVIRONMENTS[@]} ))
    CONTENT_MODEL[env_index]="$idx"
    CONTENT_MODEL[env]="${ENVIRONMENTS[$idx]}"
}

nav_mode() {
    local idx="${CONTENT_MODEL[mode_index]}"
    idx=$(( (idx + 1) % ${#MODES[@]} ))
    CONTENT_MODEL[mode_index]="$idx"
    CONTENT_MODEL[mode]="${MODES[$idx]}"
}

nav_action() {
    local env="${CONTENT_MODEL[env]}"
    local mode="${CONTENT_MODEL[mode]}"

    # Use matrix system for action discovery
    local actions_list=($(get_actions_for_context "$env" "$mode"))

    if [[ ${#actions_list[@]} -gt 0 ]]; then
        local idx="${CONTENT_MODEL[action_index]}"
        idx=$(( (idx + 1) % ${#actions_list[@]} ))
        CONTENT_MODEL[action_index]="$idx"
        CONTENT_MODEL[action]="${actions_list[$idx]}"
    else
        CONTENT_MODEL[action]=""
    fi
}

# ============================================================================
# ACTIONS
# ============================================================================

execute_action() {
    local action="${CONTENT_MODEL[action]}"
    [[ -z "$action" ]] && return

    local env="${CONTENT_MODEL[env]}"
    local mode="${CONTENT_MODEL[mode]}"

    # Drop into Mode REPL for this context
    # Save terminal state
    local saved_state=$(stty -g 2>/dev/null)

    # Launch mode REPL
    mode_repl_run "$env" "$mode"

    # Restore terminal state
    stty "$saved_state" 2>/dev/null || stty sane
    tput smcup 2>/dev/null
    tput civis 2>/dev/null
    stty -echo -icanon 2>/dev/null

    # Recalculate layout and force redraw
    calculate_layout
    needs_redraw=true
    is_first_render=true
}

execute_command() {
    local cmd="$1"

    case "$cmd" in
        help)
            TUI_BUFFERS["@tui[content]"]="⁘ Command Mode Help

Available commands:
  help     - Show this help
  clear    - Clear content
  env      - Show environments
  quit     - Exit tetra"
            ;;
        clear)
            TUI_BUFFERS["@tui[content]"]=""
            ;;
        quit)
            exit 0
            ;;
        *)
            TUI_BUFFERS["@tui[content]"]="⁘ Unknown command: $cmd"
            ;;
    esac
}

# ============================================================================
# MODES
# ============================================================================

cycle_header_size() {
    case "${CONTENT_MODEL[header_size]}" in
        max) CONTENT_MODEL[header_size]="med" ;;
        med) CONTENT_MODEL[header_size]="min" ;;
        min) CONTENT_MODEL[header_size]="max" ;;
    esac
    calculate_layout
}

toggle_animation() {
    if [[ "${CONTENT_MODEL[animation_enabled]}" == "true" ]]; then
        CONTENT_MODEL[animation_enabled]="false"
    else
        CONTENT_MODEL[animation_enabled]="true"
    fi
}

enter_bug_mode() {
    # Save terminal state
    local saved_state=$(stty -g 2>/dev/null)

    # Clear screen and launch bug mode
    clear
    tetra_bug_mode

    # Restore terminal and tetra TUI
    stty "$saved_state" 2>/dev/null || stty sane
    tput smcup 2>/dev/null
    tput civis 2>/dev/null
    stty -echo -icanon 2>/dev/null
    calculate_layout
    needs_redraw=true
    is_first_render=true
}

toggle_web_dashboard() {
    # TODO: Toggle web server
    TUI_BUFFERS["@tui[content]"]="⁘ Web Dashboard

Coming soon: HTTP server with code analyzer!"
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

tetra_tui() {
    echo "⁘ Tetra TUI initializing..."
    sleep 0.5

    # Save terminal state
    local old_tty_state=$(stty -g 2>/dev/null)
    tput smcup 2>/dev/null  # Alternate screen buffer
    tput civis 2>/dev/null  # Hide cursor
    stty -echo -icanon 2>/dev/null  # Raw mode

    # Set up resize handler
    trap 'handle_resize' WINCH

    # Cleanup function
    cleanup() {
        stty "$old_tty_state" 2>/dev/null || stty sane
        tput cnorm 2>/dev/null  # Show cursor
        tput rmcup 2>/dev/null  # Restore screen
        clear
        echo "⁘ Tetra TUI exited."
    }
    trap cleanup EXIT INT TERM

    # Initial layout calculation
    calculate_layout

    # Main loop
    local needs_redraw=true
    local is_first_render=true

    while true; do
        if [[ "$needs_redraw" == "true" ]]; then
            render_screen "$is_first_render"
            needs_redraw=false
            is_first_render=false
        fi

        # Animate separator if enabled
        if [[ "${CONTENT_MODEL[animation_enabled]}" == "true" ]]; then
            CONTENT_MODEL[separator_position]=$((CONTENT_MODEL[separator_position] + 1))
            render_separator
            # Vsync update - just the separator line
            tui_buffer_render_vsync
        fi

        # Read input with timeout for animation
        local key=""
        read -rsn1 -t 0.1 key 2>/dev/null || true

        # Handle arrow keys (read remaining escape sequence)
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.01 rest 2>/dev/null || true
            key="$key$rest"
        fi

        # Process key if pressed
        if [[ -n "$key" ]]; then
            handle_key "$key" || break
            needs_redraw=true
        fi
    done
}

# Export main function
export -f tetra_tui
