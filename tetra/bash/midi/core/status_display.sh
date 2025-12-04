#!/usr/bin/env bash

# MIDI Status Display - Real-time status and event log
# Renders a persistent status display at bottom of screen

# Configuration
STATUS_DISPLAY_EVENTS_FILE="${MIDI_DIR}/repl/events.$$"
STATUS_DISPLAY_HEIGHT=5  # 1 status line + 4 event lines (minimal borders)

# Initialize status display
status_display_init() {
    # Create events file
    mkdir -p "$(dirname "$STATUS_DISPLAY_EVENTS_FILE")"
    > "$STATUS_DISPLAY_EVENTS_FILE"

    # Get terminal height
    local term_height=$(tput lines 2>/dev/null || echo 24)

    # Set scroll region to protect bottom 5 lines (status display)
    # Leave one line above status for the prompt
    # Scrolling area: lines 0 to (height - 6)
    tput csr 0 $((term_height - STATUS_DISPLAY_HEIGHT - 1)) 2>/dev/null || true

    # Clear screen
    clear

    # Move cursor to just above status area
    tput cup $((term_height - STATUS_DISPLAY_HEIGHT - 1)) 0 2>/dev/null || true
}

# Cleanup status display
status_display_cleanup() {
    # Reset scroll region to full screen
    local term_height=$(tput lines 2>/dev/null || echo 24)
    tput csr 0 $((term_height - 1)) 2>/dev/null || true

    # Clear status area at bottom
    local status_start=$((term_height - STATUS_DISPLAY_HEIGHT))
    for i in $(seq 0 $((STATUS_DISPLAY_HEIGHT - 1))); do
        tput cup $((status_start + i)) 0 2>/dev/null || true
        tput el 2>/dev/null || printf '\033[K'
    done

    # Show cursor
    tput cnorm 2>/dev/null || printf '\033[?25h'

    # Remove events file
    rm -f "$STATUS_DISPLAY_EVENTS_FILE"
}

# Add an event to the ring buffer (keeps last 4 events)
status_display_add_event() {
    local event="$1"
    local max_events=4

    # Append to file
    echo "$event" >> "$STATUS_DISPLAY_EVENTS_FILE"

    # Keep only last N lines - use a unique temp file to avoid race conditions
    local temp_file="${STATUS_DISPLAY_EVENTS_FILE}.tmp.$$"
    tail -$max_events "$STATUS_DISPLAY_EVENTS_FILE" > "$temp_file" && mv "$temp_file" "$STATUS_DISPLAY_EVENTS_FILE"
}

# Render the status display
status_display_render() {
    local state_file="$1"
    local log_mode_file="$2"
    local events_file="$3"

    # Get terminal dimensions
    local term_height=$(tput lines 2>/dev/null || echo 24)
    local term_width=$(tput cols 2>/dev/null || echo 80)
    local status_start=$((term_height - STATUS_DISPLAY_HEIGHT))

    # Read state
    local controller="" instance="" variant="" variant_name="" input_device="" last_cc="" last_val=""
    if [[ -f "$state_file" ]]; then
        while IFS= read -r pair; do
            local key="${pair%%=*}"
            local value="${pair#*=}"
            case "$key" in
                controller) controller="$value" ;;
                instance) instance="$value" ;;
                variant) variant="$value" ;;
                variant_name) variant_name="$value" ;;
                input_device) input_device="$value" ;;
                last_cc) last_cc="$value" ;;
                last_val) last_val="$value" ;;
            esac
        done < <(tr ' ' '\n' < "$state_file")
    fi

    # Read log mode
    local log_mode="off"
    if [[ -f "$log_mode_file" ]]; then
        log_mode=$(cat "$log_mode_file")
    fi

    # Save cursor position
    tput sc 2>/dev/null || printf '\033[s'

    # Build status line: [device/controller] [CC=val] [log:mode]
    local device_part cc_part
    if [[ -n "$controller" ]]; then
        device_part="${controller}"
        [[ "$instance" != "0" && -n "$instance" ]] && device_part+="[$instance]"
        [[ -n "$variant" ]] && device_part+=":${variant}"
    elif [[ -n "$input_device" && "$input_device" != "none" ]]; then
        device_part="${input_device}"
    else
        device_part="no-device"
    fi

    if [[ -n "$last_cc" && -n "$last_val" ]]; then
        cc_part="CC${last_cc}=${last_val}"
    else
        cc_part="--"
    fi

    local status_text="${device_part} [${cc_part}] log:${log_mode}"

    # Render separator with embedded status
    tput cup $status_start 0 2>/dev/null || true
    printf "${TETRA_CYAN}━━━${TETRA_NC} ${TETRA_GREEN}%s${TETRA_NC} ${TETRA_CYAN}" "$status_text"
    # Fill rest of line with separator chars
    local used_len=$((6 + ${#status_text}))  # 6 = "━━━ " + " "
    local remaining=$((term_width - used_len))
    [[ $remaining -gt 0 ]] && printf '━%.0s' $(seq 1 $remaining)
    printf "${TETRA_NC}"

    # Render event log lines - start right after separator
    local line_num=$((status_start + 1))
    local event_count=0
    local max_events=4  # Use all available lines for events

    if [[ -f "$events_file" && "$log_mode" != "off" ]]; then
        while IFS= read -r event && [[ $event_count -lt $max_events ]]; do
            tput cup $line_num 0 2>/dev/null || true
            printf "${TETRA_DIM}%-${term_width}s${TETRA_NC}" "$event"
            ((line_num++))
            ((event_count++))
        done < "$events_file"
    fi

    # Fill remaining event lines with blanks
    while [[ $event_count -lt $max_events ]]; do
        tput cup $line_num 0 2>/dev/null || true
        tput el 2>/dev/null || printf '\033[K'
        ((line_num++))
        ((event_count++))
    done

    # Restore cursor position
    tput rc 2>/dev/null || printf '\033[u'
}

# Background refresh loop
status_display_refresh_loop() {
    local state_file="$1"
    local log_mode_file="$2"
    local events_file="$3"

    local last_state_mtime=0
    local last_events_mtime=0

    while true; do
        # Check if files changed
        local state_mtime=0
        local events_mtime=0

        if [[ -f "$state_file" ]]; then
            state_mtime=$(stat -f %m "$state_file" 2>/dev/null || stat -c %Y "$state_file" 2>/dev/null || echo 0)
        fi

        if [[ -f "$events_file" ]]; then
            events_mtime=$(stat -f %m "$events_file" 2>/dev/null || stat -c %Y "$events_file" 2>/dev/null || echo 0)
        fi

        # Redraw if anything changed
        if [[ "$state_mtime" != "$last_state_mtime" || "$events_mtime" != "$last_events_mtime" ]]; then
            status_display_render "$state_file" "$log_mode_file" "$events_file"
            last_state_mtime=$state_mtime
            last_events_mtime=$events_mtime
        fi

        # Sleep briefly
        sleep 0.1
    done
}

# Export functions
export -f status_display_init
export -f status_display_cleanup
export -f status_display_add_event
export -f status_display_render
export -f status_display_refresh_loop
