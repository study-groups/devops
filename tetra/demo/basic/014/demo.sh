#!/usr/bin/env bash

# Demo 014: Harmonized TUI + Typed Actions
# Combines best of 010 (colors, rendering) and 013 (typed actions, TES)

# Source tetra first
source ~/tetra/tetra.sh

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source modules
source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/bash/tui/typography.sh"
source "$DEMO_DIR/bash/tui/colors/color_core.sh"
source "$DEMO_DIR/bash/tui/oscillator.sh"
source "$DEMO_DIR/bash/tui/line_animator.sh"
source "$DEMO_DIR/bash/tui/buffer.sh"
source "$DEMO_DIR/bash/tui/animation_controller.sh"
source "$DEMO_DIR/bash/tui/header.sh"
source "$DEMO_DIR/bash/tui/gamepad_input.sh"
source "$DEMO_DIR/bash/actions/state.sh"
source "$DEMO_DIR/bash/actions/router.sh"
source "$DEMO_DIR/bash/actions/registry.sh"
source "$DEMO_DIR/bash/actions/actions_impl.sh"
source "$DEMO_DIR/bash/actions/executor.sh"
source "$DEMO_DIR/bash/actions/module_discovery.sh"

# Initialize TUI modules
osc_init
line_init
tui_buffer_init
anim_init

# Try to initialize gamepad (optional, won't error if not available)
gamepad_init 2>/dev/null || echo "⌨️  Gamepad not available, using keyboard only"

# Application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
SHOW_DETAIL=false
VIEW_MODE=false
SCROLL_OFFSET=0

# Organization context (set at runtime, not changed by demo)
TETRA_ORG="${TETRA_ORG:-pixeljam-arcade}"

# Layout constants - get actual terminal size
if [[ -e /dev/tty ]]; then
    read TUI_HEIGHT TUI_WIDTH < <(stty size </dev/tty 2>/dev/null)
fi
[[ -z "$TUI_HEIGHT" ]] && TUI_HEIGHT=$(tput lines 2>/dev/null || echo 24)
[[ -z "$TUI_WIDTH" ]] && TUI_WIDTH=$(tput cols 2>/dev/null || echo 80)

SEPARATOR_LINES=1
FOOTER_LINES=5

# Dynamic layout calculation helper
calculate_layout() {
    HEADER_LINES=$(header_get_lines)
    [[ "$HEADER_REPL_ACTIVE" == "true" ]] && ((HEADER_LINES++))
    CONTENT_VIEWPORT_HEIGHT=$((TUI_HEIGHT - HEADER_LINES - SEPARATOR_LINES - FOOTER_LINES))
}

# Execution contexts (where actions start from)
ENVIRONMENTS=("Local" "Dev" "Staging" "Production")
MODES=("Inspect" "Transfer" "Execute")

# Get actions for current context
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    local builtin_actions=""
    local module_actions=""

    # Built-in demo actions
    case "$env:$mode" in
        "Local:Inspect")
            builtin_actions="view:toml view:env check:local show:help help:signatures help:operations"
            ;;
        "Local:Transfer")
            builtin_actions="view:toml help:transfer"
            ;;
        "Local:Execute")
            builtin_actions="check:local help:execute"
            ;;
        "Dev:Inspect")
            builtin_actions="view:env check:remote view:logs"
            ;;
        "Dev:Transfer")
            builtin_actions="fetch:config push:config sync:files"
            ;;
        "Dev:Execute")
            builtin_actions="check:remote view:logs"
            ;;
        "Staging:Inspect")
            builtin_actions="view:env check:remote view:logs"
            ;;
        "Staging:Transfer")
            builtin_actions="fetch:config push:config"
            ;;
        "Staging:Execute")
            builtin_actions="check:remote"
            ;;
        "Production:Inspect")
            builtin_actions="view:env check:remote"
            ;;
        "Production:Transfer")
            builtin_actions="fetch:config"
            ;;
        "Production:Execute")
            builtin_actions="check:remote"
            ;;
        *)
            builtin_actions="view:toml show:help"
            ;;
    esac

    # Get module actions
    module_actions=$(get_module_actions "$env" "$mode")

    # Combine built-in and module actions
    echo "$builtin_actions $module_actions"
}

# Render header with colorized action - outputs to buffer
render_header() {
    # Update region bounds based on header size
    tui_region_update

    # Capture header output line by line
    local line_num=0
    while IFS= read -r line; do
        tui_write_header "$line_num" "$line"
        ((line_num++))
    done < <(header_render)

    # Render animated separator with oscillator - capture as string
    local separator_line=$(line_animate_from_osc "$(osc_get_position)" | tr -d '\n')
    tui_write_separator "$separator_line"
}

# Render content with viewport constraints - outputs to buffer
render_content() {
    # Get content
    local content=""
    if [[ -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
        content="${TUI_BUFFERS["@tui[content]"]}"
    else
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        content="🎯 Demo 014: Action Signatures & File Transfer

Execution Context: $env
  • Actions execute from @${env,,} context
  • Remote operations use @{context} as target
  • File transfers show source → target endpoints

Navigation:
  e - Cycle environment (Local/Dev/Staging/Production)
  m - Cycle mode (Inspect/Transfer/Execute)
  a - Cycle action
  i - Toggle action detail view
  v - View mode (scroll long content)
  ↑/↓ - Scroll in view mode
  Enter - Execute action

Header Controls:
  h - Cycle header size (max/med/min)
  o - Toggle oscillator animation
  / - Toggle REPL line
  ←/→ - Move oscillator marker

Features:
  • Clear I/O signatures: (inputs) → output [where effects]
  • Endpoint-aware operations (@local, @dev, @staging, @prod)
  • TES operation types (read, write, execute)
  • Animated separator with oscillator control"
    fi

    # Prepare content output
    local output=""

    # In view mode, show scroll indicator and apply viewport
    if [[ "$VIEW_MODE" == "true" ]]; then
        # Count total lines
        local total_lines=$(echo -e "$content" | wc -l)
        local viewport_content_lines=$((CONTENT_VIEWPORT_HEIGHT - 1))  # Reserve 1 line for scroll indicator
        local max_offset=$((total_lines - viewport_content_lines))
        [[ $max_offset -lt 0 ]] && max_offset=0

        # Show viewport window with scroll position
        output=$(echo -e "$content" | tail -n +$((SCROLL_OFFSET + 1)) | head -n $viewport_content_lines)

        # Always show scroll indicator in view mode
        local end_line=$((SCROLL_OFFSET + viewport_content_lines))
        [[ $end_line -gt $total_lines ]] && end_line=$total_lines
        output+=$'\n'"${TUI_TEXT_DIM}[Viewing $((SCROLL_OFFSET + 1))-${end_line} of $total_lines lines | ↑/↓=scroll ESC=back]${TUI_TEXT_NORMAL}"
    else
        # Normal mode: truncate to viewport height, reserve 1 line for truncation message if needed
        local line_count=$(echo -e "$content" | wc -l)
        if [[ $line_count -gt $CONTENT_VIEWPORT_HEIGHT ]]; then
            local display_lines=$((CONTENT_VIEWPORT_HEIGHT - 1))
            output=$(echo -e "$content" | head -n $display_lines)
            output+=$'\n'"${TUI_TEXT_DIM}[Content truncated - press 'v' to view all]${TUI_TEXT_NORMAL}"
        else
            output=$(echo -e "$content")
        fi
    fi

    # Write to buffer line by line
    local line_num=0
    while IFS= read -r line; do
        tui_write_content "$line_num" "$line"
        ((line_num++))
    done <<< "$output"
}

# Render footer (grey text, no separator) - outputs to buffer
render_footer() {
    local line_num=0

    # Blank line
    tui_write_footer $line_num ""
    ((line_num++))

    # Expand ANSI codes properly using printf
    local dim_code reset_code
    printf -v dim_code "%b" "\033[2m"
    printf -v reset_code "%b" "\033[0m"

    # Build animation status indicator with FPS
    local anim_status=$(anim_get_status)
    if [[ "$ANIM_ENABLED" == "true" ]]; then
        local fps=$(anim_get_fps)
        [[ $fps -gt 0 ]] && anim_status="ON:${fps}fps" || anim_status="ON"
    fi

    # Check if footer is completion status
    if [[ -n "${TUI_BUFFERS["@tui[footer]"]}" && "${TUI_BUFFERS["@tui[footer]"]}" == completed:* ]]; then
        # Show normal footer nav
        if [[ "$VIEW_MODE" == "true" ]]; then
            tui_write_footer $line_num "${dim_code}$(center_text "↑/↓=scroll  ESC=back  q=quit" 50)${reset_code}"
        else
            tui_write_footer $line_num "${dim_code}$(center_text "e=env  m=mode  a=action  h=header  o=anim:$anim_status  /=repl" 50)${reset_code}"
            ((line_num++))
            tui_write_footer $line_num "${dim_code}$(center_text "Enter=exec  s=sigs  ←/→=osc  c=clear  q=quit" 50)${reset_code}"
        fi
        ((line_num++))
        tui_write_footer $line_num ""

        # Place completion at bottom-right corner (handled separately for now)
        # TODO: Add positioned text support to buffer system
    elif [[ -n "${TUI_BUFFERS["@tui[footer]"]}" ]]; then
        tui_write_footer $line_num "${dim_code}${TUI_BUFFERS["@tui[footer]"]}${reset_code}"
    else
        if [[ "$VIEW_MODE" == "true" ]]; then
            tui_write_footer $line_num "${dim_code}$(center_text "↑/↓=scroll  ESC=back  q=quit" 50)${reset_code}"
        else
            tui_write_footer $line_num "${dim_code}$(center_text "e=env  m=mode  a=action  h=header  o=anim:$anim_status  /=repl" 50)${reset_code}"
            ((line_num++))
            tui_write_footer $line_num "${dim_code}$(center_text "Enter=exec  s=sigs  ←/→=osc  c=clear  q=quit" 50)${reset_code}"
        fi
        ((line_num++))
        tui_write_footer $line_num ""
    fi
}

# Render full screen with differential updates (DOM-like diff)
render_screen() {
    local first_render="${1:-false}"

    # Clear buffer and rebuild
    tui_buffer_clear

    # Populate buffer (these now write to TUI_SCREEN_BUFFER)
    render_header
    render_content
    render_footer

    # Render: full screen on first call, differential updates after
    if [[ "$first_render" == "true" ]]; then
        tui_buffer_render_full
    else
        tui_buffer_render_diff
    fi
}

# Update animated separator with flicker-free rendering
update_separator_animation() {
    # Generate new separator line
    local separator_line=$(line_animate_from_osc "$(osc_get_position)" | tr -d '\n')

    # Update buffer with new separator
    tui_write_separator "$separator_line"

    # Render using vsync for flicker-free updates
    tui_buffer_render_vsync
}

# Execute current action
execute_current_action() {
    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    [[ -z "$action" ]] && return

    local current_state=$(get_action_state "$action")

    # Handle error state - clear on next execute
    if [[ "$current_state" == "error" ]]; then
        set_action_state "$action" "idle"
        clear_content
        return
    fi

    # Handle success state - clear on next execute
    if [[ "$current_state" == "success" ]]; then
        set_action_state "$action" "idle"
        return
    fi

    # Execute
    set_action_state "$action" "executing"
    render_screen
    sleep 0.3

    # Check if this is a module action
    if is_module_action "$action"; then
        # Execute through module system
        local output=$(execute_module_action "$action" 2>&1)
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            TUI_BUFFERS["@tui[content]"]="$output"
            set_action_state "$action" "success"
        else
            TUI_BUFFERS["@tui[content]"]="Error executing $action:\n$output"
            set_action_state "$action" "error"
        fi
    else
        # Execute built-in demo action
        execute_action_with_feedback "$action"
        exit_code=$?
    fi

    render_screen
    sleep 0.3

    if [[ $exit_code -eq 0 ]]; then
        set_action_state "$action" "idle"
    fi
}

# Navigation
nav_env_right() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0
}

nav_mode_right() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0
}

nav_action_right() {
    local actions=($(get_actions))
    [[ ${#actions[@]} -gt 0 ]] && ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
}

# Show execution log
show_execution_log() {
    if [[ ! -f "$EXEC_LOG_FILE" ]]; then
        TUI_BUFFERS["@tui[content]"]="No execution log found."
        return
    fi

    local log_display="Recent Actions:\n"

    tail -10 "$EXEC_LOG_FILE" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
        local verb=$(echo "$line" | grep -o '"verb":"[^"]*"' | cut -d'"' -f4)
        local subject=$(echo "$line" | grep -o '"subject":"[^"]*"' | cut -d'"' -f4)
        local status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

        refresh_color_state_cached "$verb" "$subject"
        printf "${timestamp:11:8} "
        render_action_verb_noun "$verb" "$subject"
        printf " - %s\n" "$status"
    done > /tmp/demo014_log_output

    log_display+=$(cat /tmp/demo014_log_output)
    TUI_BUFFERS["@tui[content]"]="$log_display"
}

# Main loop
main() {
    echo "🎯 Demo 014: Action Signatures & File Transfer"

    # Skip module discovery for now (can be slow/blocking)
    # discover_tetra_modules 2>/dev/null || echo "⚠ No modules loaded"
    echo "Using built-in actions only (module discovery disabled for testing)"

    echo "Starting in 1 second..."
    sleep 1

    # Save terminal state and configure for TUI
    local old_tty_state=$(stty -g)
    tput smcup  # Save screen and enter alternate buffer
    tput civis  # Hide cursor

    # Configure terminal for raw input (reading from /dev/tty)
    # -echo: don't echo input
    # -icanon: disable line buffering (read char-by-char)
    # -isig: disable signal generation (Ctrl-C, Ctrl-Z won't send signals)
    # min 0: read() returns immediately even if no data
    # time 0: no inter-character timer
    stty -echo -icanon -isig min 0 time 0 </dev/tty
    clear

    # Debug logging (use regular file, not FIFO to avoid blocking)
    local DEBUG_FIFO="/tmp/demo014_debug.log"
    echo "=== Demo 014 Debug Log Started $(date) ===" > "$DEBUG_FIFO" 2>/dev/null || true
    echo "TTY device: /dev/tty" >> "$DEBUG_FIFO" 2>/dev/null || true
    echo "TTY settings after configuration:" >> "$DEBUG_FIFO" 2>/dev/null || true
    stty -a </dev/tty >> "$DEBUG_FIFO" 2>/dev/null || true
    echo "---" >> "$DEBUG_FIFO" 2>/dev/null || true

    # Calculate initial layout
    calculate_layout

    # Initialize animation controller
    anim_set_fps 30

    # Track if screen needs redraw
    local needs_redraw=true
    local is_first_render=true
    local show_fps_overlay=false

    # Set up cleanup for gamepad and terminal
    cleanup() {
        # Stop animation first
        anim_stop 2>/dev/null || true

        # Cleanup gamepad resources
        gamepad_cleanup 2>/dev/null || true

        # Restore terminal state (apply to /dev/tty explicitly)
        stty "$old_tty_state" </dev/tty 2>/dev/null || stty sane

        # Show cursor and restore screen
        tput cnorm 2>/dev/null || true
        tput rmcup 2>/dev/null || true

        echo "Demo 014 exited." >&2
    }
    trap cleanup EXIT INT TERM

    # Log that main loop started
    echo "MAIN LOOP STARTED" >> "$DEBUG_FIFO" 2>/dev/null || true

    while true; do
        # Frame timing start (for FPS tracking)
        local frame_start=$(date +%s%N)

        # Only render if something changed
        if [[ "$needs_redraw" == "true" ]]; then
            echo "RENDER: first=$is_first_render" >> "$DEBUG_FIFO" 2>/dev/null || true
            render_screen "$is_first_render"
            needs_redraw=false
            is_first_render=false
        fi

        # Animation tick (only if enabled and not paused)
        if anim_should_tick; then
            osc_tick
            update_separator_animation
            # Record frame for FPS tracking
            anim_record_frame
            anim_check_performance
        fi

        # Calculate frame budget for input timeout
        local target_frame_time=$(anim_get_frame_time)
        local timeout_sec=$(printf "%.6f" "$target_frame_time")

        # Read from keyboard OR gamepad with frame-rate-aware timeout
        local key=""
        echo "READING INPUT (timeout=$timeout_sec, anim=$(anim_should_tick && echo on || echo off))" >> "$DEBUG_FIFO" 2>/dev/null || true
        if anim_should_tick; then
            # Use frame-paced timeout when animation is running
            key=$(get_input_multiplexed "$timeout_sec" 2>/dev/null) || key=""
        else
            # Blocking read when animation is off
            key=$(get_input_multiplexed 0 2>/dev/null) || key=""
        fi

        # Debug log key press
        if [[ -n "$key" ]]; then
            echo "KEY RECEIVED: '$(echo -n "$key" | od -An -tx1)' raw='$key'" >> "$DEBUG_FIFO" 2>/dev/null || true
        else
            echo "NO KEY (timeout)" >> "$DEBUG_FIFO" 2>/dev/null || true
        fi

        # Skip if no key (timeout)
        if [[ -z "$key" ]]; then
            # Show FPS overlay if enabled
            if [[ "$show_fps_overlay" == "true" && "$ANIM_ENABLED" == "true" ]]; then
                local stats=$(anim_get_stats)
                printf '\033[s\033[1;1H\033[K\033[33m%s\033[0m\033[u' "$stats"
            fi
            continue
        fi

        # Key was pressed - will need full redraw after handling
        needs_redraw=true

        # Handle pure ESC key (already processed sequences come from get_input_multiplexed)
        if [[ "$key" == $'\x1b' ]]; then
            # Pure ESC - exit view mode or REPL
            if [[ "$VIEW_MODE" == "true" ]]; then
                VIEW_MODE=false
                SCROLL_OFFSET=0
                continue
            elif [[ "$HEADER_REPL_ACTIVE" == "true" ]]; then
                HEADER_REPL_ACTIVE=false
                HEADER_REPL_INPUT=""
                calculate_layout
                continue
            fi
        fi

        # Debug log before case
        echo "HANDLING KEY: '$key'" >> "$DEBUG_FIFO" 2>/dev/null || true

        case "$key" in
            $'\x03')
                # Ctrl-C - handled gracefully (signal generation disabled via -isig)
                echo "CTRL-C pressed (handled gracefully)" >> "$DEBUG_FIFO" 2>/dev/null || true
                TUI_BUFFERS["@tui[footer]"]="⚠ Ctrl-C is disabled - use 'q' to quit"
                ;;
            'e'|'E')
                echo "ACTION: nav_env_right" >> "$DEBUG_FIFO" 2>/dev/null || true
                VIEW_MODE=false
                SCROLL_OFFSET=0
                nav_env_right
                SHOW_DETAIL=false
                clear_content
                ;;
            'm'|'M')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                nav_mode_right
                SHOW_DETAIL=false
                clear_content
                ;;
            'a'|'A')
                nav_action_right
                [[ "$SHOW_DETAIL" == "true" ]] && continue  # Update detail view
                ;;
            'i'|'I')
                # Toggle detail view
                if [[ "$SHOW_DETAIL" == "true" ]]; then
                    SHOW_DETAIL=false
                    clear_content
                else
                    SHOW_DETAIL=true
                fi
                ;;
            'v'|'V')
                # Toggle view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    VIEW_MODE=false
                    SCROLL_OFFSET=0
                else
                    VIEW_MODE=true
                    SCROLL_OFFSET=0
                fi
                ;;
            'h'|'H')
                # Cycle header size: max -> med -> min -> max
                case "$HEADER_SIZE" in
                    max) header_set_size "med" ;;
                    med) header_set_size "min" ;;
                    min) header_set_size "max" ;;
                esac
                calculate_layout  # Recalculate viewport
                ;;
            'o'|'O')
                # Toggle animation
                anim_toggle
                ;;
            'p'|'P')
                # Pause/resume animation
                if [[ "$ANIM_PAUSED" == "true" ]]; then
                    anim_resume
                else
                    anim_pause
                fi
                ;;
            'f'|'F')
                # Toggle FPS overlay
                show_fps_overlay=$([ "$show_fps_overlay" == "true" ] && echo "false" || echo "true")
                needs_redraw=false  # Don't redraw entire screen for FPS toggle
                ;;
            '/')
                # Toggle REPL (disabled - no input handling implemented yet)
                # header_repl_toggle
                # calculate_layout  # Recalculate viewport (REPL adds a line)
                TUI_BUFFERS["@tui[footer]"]="REPL mode not implemented yet - press any key to continue"
                needs_redraw=true
                ;;
            $'\x1b[D')
                # Left arrow - move oscillator left
                osc_set_position $(($(osc_get_position) - 5))
                ;;
            $'\x1b[C')
                # Right arrow - move oscillator right
                osc_set_position $(($(osc_get_position) + 5))
                ;;
            $'\x1b[A')
                # Up arrow - scroll up in view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    [[ $SCROLL_OFFSET -gt 0 ]] && ((SCROLL_OFFSET--))
                fi
                ;;
            $'\x1b[B')
                # Down arrow - scroll down in view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    local content="${TUI_BUFFERS["@tui[content]"]}"
                    local total_lines=$(echo -e "$content" | wc -l)
                    local viewport_content_lines=$((CONTENT_VIEWPORT_HEIGHT - 1))
                    local max_offset=$((total_lines - viewport_content_lines))
                    [[ $max_offset -lt 0 ]] && max_offset=0
                    [[ $SCROLL_OFFSET -lt $max_offset ]] && ((SCROLL_OFFSET++))
                fi
                ;;
            ''|$'\n')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                execute_current_action
                ;;
            's'|'S')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                TUI_BUFFERS["@tui[content]"]="$(list_action_signatures)"
                ;;
            'l'|'L')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                show_execution_log
                ;;
            'c'|'C')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                clear_content
                ;;
            'q'|'Q') break ;;
        esac
    done

    clear
    echo "Demo 014 complete."
}

main "$@"
