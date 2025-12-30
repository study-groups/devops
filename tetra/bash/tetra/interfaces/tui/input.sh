#!/usr/bin/env bash
# Tetra TUI - Input Handling
# Key dispatch for command, view, and normal modes

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

    # View mode input - use pager system
    if [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        case "$key" in
            $'\e[A'|$'\eOA'|'k')  # Up arrow or k
                tui_pager_scroll_up
                ;;
            $'\e[B'|$'\eOB'|'j')  # Down arrow or j
                tui_pager_scroll_down
                ;;
            $'\e[5~'|'b')  # Page Up or b
                tui_pager_page_up
                ;;
            $'\e[6~'|' ')  # Page Down or space
                tui_pager_page_down
                ;;
            'g')  # Go to top
                tui_pager_top
                ;;
            'G')  # Go to bottom
                tui_pager_bottom
                ;;
            'q')  # q to exit view mode
                CONTENT_MODEL[view_mode]="false"
                TUI_PAGER_MODE="direct"
                TUI_PAGER_OFFSET=0
                ;;
            *)  # Ignore all other keys in view mode
                ;;
        esac
        return 0
    fi

    # Normal mode input
    case "$key" in
        'e'|'E')
            nav_env
            ;;
        'm'|'M'|$'\x1b[C')  # m or Right arrow
            nav_module
            ;;
        $'\x1b[D')  # Left arrow
            nav_module_prev
            ;;
        $'\x1b[A')  # Up arrow - move split up (smaller content, bigger CLI)
            if [[ $TUI_SPLIT_ROW -gt 3 ]]; then
                ((TUI_SPLIT_ROW--))
                calculate_layout
                is_first_render=true
            fi
            ;;
        $'\x1b[B')  # Down arrow - move split down (bigger content, smaller CLI)
            if [[ $TUI_SPLIT_ROW -lt $((TUI_HEIGHT - 3)) ]]; then
                ((TUI_SPLIT_ROW++))
                calculate_layout
                is_first_render=true
            fi
            ;;
        '+'|'=')  # Increase split (more content)
            if [[ $TUI_SPLIT_ROW -lt $((TUI_HEIGHT - 3)) ]]; then
                ((TUI_SPLIT_ROW++))
                calculate_layout
                is_first_render=true
            fi
            ;;
        '-'|'_')  # Decrease split (less content)
            if [[ $TUI_SPLIT_ROW -gt 3 ]]; then
                ((TUI_SPLIT_ROW--))
                calculate_layout
                is_first_render=true
            fi
            ;;
        '0')  # Reset split to auto (2/3)
            TUI_SPLIT_ROW=0
            calculate_layout
            is_first_render=true
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
        $'\x1a')  # Ctrl-Z: suspend to background
            # Restore terminal before suspending
            stty "$old_tty_state" 2>/dev/null || stty sane
            tput cnorm 2>/dev/null  # Show cursor
            tput rmcup 2>/dev/null  # Restore screen
            echo "tetra_tui suspended. Use 'fg' to resume."
            kill -TSTP $$           # Suspend self
            # When resumed (fg), restore TUI state
            tput smcup 2>/dev/null  # Alternate screen
            tput civis 2>/dev/null  # Hide cursor
            stty -echo -icanon 2>/dev/null
            is_first_render=true
            needs_redraw=true
            ;;
    esac

    return 0
}
