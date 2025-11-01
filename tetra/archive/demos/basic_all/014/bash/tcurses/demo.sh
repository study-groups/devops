#!/usr/bin/env bash

# TCurses Modal Demo
# Clean minimal demo with NORMAL, COMMAND, REPL modes

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Low-level TCurses
source "$SCRIPT_DIR/tcurses_screen.sh"
source "$SCRIPT_DIR/tcurses_input.sh"
source "$SCRIPT_DIR/tcurses_buffer.sh"
source "$SCRIPT_DIR/tcurses_animation.sh"

# Color system (library - source directly like RAG does)
: "${TETRA_SRC:=$(cd "$SCRIPT_DIR/../../../../.." && pwd)}"
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh" 2>/dev/null || true
    COLOR_ENABLED=1
else
    COLOR_ENABLED=0
fi

# High-level components
source "$SCRIPT_DIR/tcurses_log_footer.sh"
source "$SCRIPT_DIR/tcurses_modal.sh"
source "$SCRIPT_DIR/tcurses_repl.sh"
source "$SCRIPT_DIR/tcurses_actions.sh"

# App state
LAST_KEY=""
LAST_KEY_TIME=0

# Init
init_app() {
    tcurses_animation_set_bpm 120
    tcurses_animation_set_fps 30
    tcurses_animation_enable

    log_footer_init
    modal_init
    repl_init

    log_footer_add "system" "init" "TCurses Demo Started"
}

# Get time in milliseconds
get_time_ms() {
    if [[ -n "$EPOCHREALTIME" ]]; then
        awk -v t="$EPOCHREALTIME" 'BEGIN { printf "%d", t * 1000 }'
    else
        echo $(($(date +%s) * 1000))
    fi
}

# Render frame
render_frame() {
    local first="$1"
    tcurses_buffer_clear

    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    # Calculate layout
    local log_height=$(log_footer_height)
    local repl_height=8
    local content_height=$((height - log_height - repl_height))

    # Header - build with exact character counts
    local header_top="╔$(printf '═%.0s' $(seq 1 $((width-2))))╗"
    tcurses_buffer_write_line 0 "$header_top"

    local mode=$(modal_get)
    local mode_display="[$mode]"
    local title="TCurses Demo ${mode_display}"
    # Padding: width - 2 (borders) - 2 (spaces around title) - title length
    local padding=$((width - 4 - ${#title}))
    [[ $padding -lt 0 ]] && padding=0
    local spaces=$(printf ' %.0s' $(seq 1 $padding))
    local header_mid="║ ${title}${spaces} ║"
    tcurses_buffer_write_line 1 "$header_mid"

    local header_bot="╚$(printf '═%.0s' $(seq 1 $((width-2))))╝"
    tcurses_buffer_write_line 2 "$header_bot"

    # Content area
    local mid=$((content_height / 2))
    tcurses_buffer_write_line $((mid - 2)) "  Mode: $(modal_get)"
    tcurses_buffer_write_line $((mid - 1)) "  Info: $(modal_info)"
    tcurses_buffer_write_line $mid ""

    if [[ -n "$LAST_KEY" ]]; then
        local hex=$(echo -n "$LAST_KEY" | od -An -tx1 | tr -d ' ')
        tcurses_buffer_write_line $((mid + 1)) "  Last key: '$LAST_KEY' (0x$hex)"
    fi

    # Instructions based on mode
    local inst_y=$((mid + 3))
    case "$(modal_get)" in
        NORMAL)
            tcurses_buffer_write_line $inst_y "  Keys:"
            tcurses_buffer_write_line $((inst_y + 1)) "    /     - Enter REPL mode"
            tcurses_buffer_write_line $((inst_y + 2)) "    :     - Enter COMMAND mode"
            tcurses_buffer_write_line $((inst_y + 3)) "    q     - Quit"
            ;;
        COMMAND)
            tcurses_buffer_write_line $inst_y "  Command mode (not yet implemented)"
            tcurses_buffer_write_line $((inst_y + 1)) "    ESC   - Back to NORMAL"
            ;;
        REPL)
            tcurses_buffer_write_line $inst_y "  REPL Shortcuts:"
            tcurses_buffer_write_line $((inst_y + 1)) "    Ctrl+A/E - Start/End   Ctrl+K/U - Kill line   Ctrl+W - Kill word"
            tcurses_buffer_write_line $((inst_y + 2)) "    ↑/↓ Ctrl+P/N - History   ←/→ - Move cursor   ESC - Exit to NORMAL"
            ;;
    esac

    # REPL area (if in REPL mode)
    if modal_is "REPL"; then
        repl_render $content_height $repl_height $width
    else
        # Empty REPL area
        local repl_start=$content_height
        tcurses_buffer_write_line $repl_start "$(printf '─%.0s' $(seq 1 $width))"
        for ((i = 1; i < repl_height; i++)); do
            tcurses_buffer_write_line $((repl_start + i)) ""
        done
    fi

    # Log footer at bottom
    log_footer_render $((content_height + repl_height)) $width

    # Render
    if [[ "$first" == "true" ]]; then
        tcurses_buffer_render_full
    else
        tcurses_buffer_render_diff
    fi
}

# Handle input for NORMAL mode
handle_normal_mode() {
    local key="$1"

    case "$key" in
        ':')
            modal_set "COMMAND"
            log_footer_add "mode" "change" "NORMAL -> COMMAND"
            ;;
        '/')
            modal_set "REPL"
            repl_clear_input
            repl_clear_response
            log_footer_add "mode" "change" "NORMAL -> REPL"
            ;;
        'q'|'Q')
            log_footer_add "system" "exit" "User quit"
            return 1
            ;;
    esac

    return 0
}

# Handle input for COMMAND mode
handle_command_mode() {
    local key="$1"

    case "$key" in
        $'\x1b')  # ESC
            modal_set "NORMAL"
            log_footer_add "mode" "change" "COMMAND -> NORMAL"
            ;;
    esac

    return 0
}

# Execute REPL command (using action handler)
execute_repl_command() {
    local cmd="$1"

    log_footer_add "shell" "exec" "$cmd"

    # Use action handler for systematic execution
    local output=""
    local exit_code=0

    output=$(execute_action "shell" "exec" "$cmd" 2>&1)
    exit_code=$?

    local status=$(format_status $exit_code)

    if [[ $exit_code -eq 0 ]]; then
        repl_set_response "$output"
        log_footer_add "shell" "$status" "exit=$exit_code"
    else
        local error_msg="ERROR (exit $exit_code)"
        if [[ $COLOR_ENABLED -eq 1 ]]; then
            error_msg="$(text_color "F7768E")ERROR$(reset_color) (exit $exit_code)"
        fi
        repl_set_response "$error_msg\n$output"
        log_footer_add "shell" "$status" "exit=$exit_code"
    fi
}

# Handle input for REPL mode
handle_repl_mode() {
    local key="$1"
    local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')

    # Debug: log every key in REPL mode
    log_footer_add "repl" "key" "0x$hex len=${#key}"

    # Check for ESC first (must be alone, not part of sequence)
    if [[ "$key" == $'\x1b' && ${#key} -eq 1 ]]; then
        modal_set "NORMAL"
        repl_clear_input
        log_footer_add "mode" "change" "REPL -> NORMAL"
        return 0
    fi

    # Check for backspace (DEL on macOS)
    if [[ "$key" == $'\x7f' ]]; then
        repl_backspace
        log_footer_add "repl" "backspace" "ok"
        return 0
    fi

    # Check for arrow keys and escape sequences (multi-byte)
    if [[ ${#key} -gt 1 ]]; then
        case "$key" in
            $'\x1b[D')  # Left arrow
                repl_cursor_left
                log_footer_add "repl" "cursor" "left"
                return 0
                ;;
            $'\x1b[C')  # Right arrow
                repl_cursor_right
                log_footer_add "repl" "cursor" "right"
                return 0
                ;;
            $'\x1b[A')  # Up arrow - history previous
                repl_history_up
                log_footer_add "repl" "history" "up"
                return 0
                ;;
            $'\x1b[B')  # Down arrow - history next
                repl_history_down
                log_footer_add "repl" "history" "down"
                return 0
                ;;
            $'\x1b[H'|$'\x1b[1~')  # Home key
                repl_cursor_home
                log_footer_add "repl" "cursor" "home"
                return 0
                ;;
            $'\x1b[F'|$'\x1b[4~')  # End key
                repl_cursor_end
                log_footer_add "repl" "cursor" "end"
                return 0
                ;;
            $'\x1bf'|$'\x1bf')  # Alt+F - forward word
                repl_forward_word
                log_footer_add "repl" "cursor" "forward-word"
                return 0
                ;;
            $'\x1bb'|$'\x1bB')  # Alt+B - backward word
                repl_backward_word
                log_footer_add "repl" "cursor" "backward-word"
                return 0
                ;;
            *)
                # Unknown multi-byte sequence
                log_footer_add "repl" "ignore" "multi=$hex"
                return 0
                ;;
        esac
    fi

    # Check for Enter - accept \n, \r, or empty string (Enter on some systems in raw mode)
    if [[ "$key" == $'\n' || "$key" == $'\r' || (-z "$key" && ${#key} -eq 0) ]]; then
        # Only treat as Enter if it's truly one of these cases
        # Empty string from read with -n1 in raw mode can mean Enter was pressed
        local cmd=$(repl_get_input)
        log_footer_add "repl" "enter" "cmd='$cmd'"
        if [[ -n "$cmd" ]]; then
            repl_add_to_history "$cmd"
            execute_repl_command "$cmd"
            repl_clear_input
        fi
        return 0
    fi

    # Handle Ctrl key combinations (single byte control characters)
    if [[ ${#key} -eq 1 ]]; then
        local byte_val=$(printf '%d' "'$key" 2>/dev/null || echo "0")

        case "$key" in
            $'\x01')  # Ctrl+A - beginning of line
                repl_cursor_home
                log_footer_add "repl" "ctrl" "Ctrl+A (home)"
                return 0
                ;;
            $'\x05')  # Ctrl+E - end of line
                repl_cursor_end
                log_footer_add "repl" "ctrl" "Ctrl+E (end)"
                return 0
                ;;
            $'\x04')  # Ctrl+D - delete char
                repl_delete_char
                log_footer_add "repl" "ctrl" "Ctrl+D (delete)"
                return 0
                ;;
            $'\x0b')  # Ctrl+K - kill to end of line
                repl_kill_line
                log_footer_add "repl" "ctrl" "Ctrl+K (kill-line)"
                return 0
                ;;
            $'\x15')  # Ctrl+U - kill whole line
                repl_kill_whole_line
                log_footer_add "repl" "ctrl" "Ctrl+U (kill-whole-line)"
                return 0
                ;;
            $'\x17')  # Ctrl+W - kill word backwards
                repl_kill_word
                log_footer_add "repl" "ctrl" "Ctrl+W (kill-word)"
                return 0
                ;;
            $'\x06')  # Ctrl+F - forward char (same as right arrow)
                repl_cursor_right
                log_footer_add "repl" "ctrl" "Ctrl+F (forward-char)"
                return 0
                ;;
            $'\x02')  # Ctrl+B - backward char (same as left arrow)
                repl_cursor_left
                log_footer_add "repl" "ctrl" "Ctrl+B (backward-char)"
                return 0
                ;;
            $'\x10')  # Ctrl+P - previous history (same as up arrow)
                repl_history_up
                log_footer_add "repl" "ctrl" "Ctrl+P (previous)"
                return 0
                ;;
            $'\x0e')  # Ctrl+N - next history (same as down arrow)
                repl_history_down
                log_footer_add "repl" "ctrl" "Ctrl+N (next)"
                return 0
                ;;
            $'\x0c')  # Ctrl+L - clear screen / refresh (could implement later)
                log_footer_add "repl" "ctrl" "Ctrl+L (ignored)"
                return 0
                ;;
        esac

        # Printable ASCII: space (32) through ~ (126)
        if [[ $byte_val -ge 32 && $byte_val -le 126 ]]; then
            repl_insert_char "$key"
            log_footer_add "repl" "insert" "'$key'"
        else
            log_footer_add "repl" "ignore" "byte=$byte_val"
        fi
    fi

    return 0
}

# Main input handler
handle_input() {
    local key="$1"
    LAST_KEY="$key"
    LAST_KEY_TIME=$(get_time_ms)

    # Route to mode-specific handler
    case "$(modal_get)" in
        NORMAL)
            handle_normal_mode "$key" || return 1
            ;;
        COMMAND)
            handle_command_mode "$key" || return 1
            ;;
        REPL)
            handle_repl_mode "$key" || return 1
            ;;
    esac

    return 0
}

# Tick callback
tick_callback() {
    tcurses_animation_record_frame
}

# TCurses init
tcurses_init() {
    if [[ "${BASH_VERSINFO[0]}" -lt 5 ]] || { [[ "${BASH_VERSINFO[0]}" -eq 5 ]] && [[ "${BASH_VERSINFO[1]}" -lt 2 ]]; }; then
        echo "Error: Requires Bash 5.2+ (found $BASH_VERSION)" >&2
        return 1
    fi

    if ! tcurses_screen_init; then
        echo "tcurses: failed to initialize screen" >&2
        return 1
    fi

    tcurses_buffer_init "$(tcurses_screen_height)" "$(tcurses_screen_width)"
    return 0
}

# Cleanup
tcurses_cleanup() {
    tcurses_animation_disable
    tcurses_screen_cleanup
}

# Main
main() {
    echo "TCurses Modal Demo"
    echo "=================="
    echo ""
    echo "Starting..."

    if ! tcurses_init; then
        echo "Failed to initialize" >&2
        exit 1
    fi

    trap 'tcurses_cleanup; exit' EXIT INT TERM
    init_app

    # Event loop
    local is_first=true
    local needs_redraw=true

    while true; do
        if [[ "$needs_redraw" == "true" ]]; then
            render_frame "$is_first"
            is_first=false
            needs_redraw=false
        fi

        if tcurses_animation_should_tick; then
            tick_callback
            needs_redraw=true
        fi

        local timeout=$(tcurses_animation_get_frame_time)
        local key=""
        key=$(tcurses_input_read_key "$timeout") || key=""

        if [[ -n "$key" ]]; then
            if ! handle_input "$key"; then
                break
            fi
            needs_redraw=true
        fi
    done

    tcurses_cleanup
    clear

    echo ""
    echo "Demo complete"
}

main "$@"
