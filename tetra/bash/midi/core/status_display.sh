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

# Add an event to the ring buffer
status_display_add_event() {
    local event="$1"

    # Append to file
    echo "$event" >> "$STATUS_DISPLAY_EVENTS_FILE"

    # Keep only last 4 lines - use a unique temp file to avoid race conditions
    local temp_file="${STATUS_DISPLAY_EVENTS_FILE}.tmp.$$"
    tail -4 "$STATUS_DISPLAY_EVENTS_FILE" > "$temp_file" && mv "$temp_file" "$STATUS_DISPLAY_EVENTS_FILE"
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
    local controller="" instance="" variant="" variant_name="" last_cc="" last_val=""
    if [[ -f "$state_file" ]]; then
        while IFS= read -r pair; do
            local key="${pair%%=*}"
            local value="${pair#*=}"
            case "$key" in
                controller) controller="$value" ;;
                instance) instance="$value" ;;
                variant) variant="$value" ;;
                variant_name) variant_name="$value" ;;
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

    # Build compact device status for d16 d16 format
    local left_status="${controller:-none}"
    [[ "$instance" != "0" && -n "$instance" ]] && left_status+="[$instance]"
    [[ -n "$variant" ]] && left_status+=":${variant}"
    [[ -n "$variant_name" ]] && left_status+=" ${variant_name}"

    local right_status="log:${log_mode}"

    # Pad/truncate to exactly 16 chars each
    printf -v left_padded "%-16.16s" "$left_status"
    printf -v right_padded "%-16.16s" "$right_status"

    local status_line="${left_padded} ${right_padded}"

    # Render status line at bottom
    tput cup $status_start 0 2>/dev/null || true
    printf "${TETRA_CYAN}━%.0s" $(seq 1 $term_width)
    printf "${TETRA_NC}"

    tput cup $((status_start + 1)) 0 2>/dev/null || true
    printf "${TETRA_GREEN}%-${term_width}s${TETRA_NC}" "$status_line"

    # Render RAW event data lines - dimmed, maximum info density
    local line_num=$((status_start + 2))
    local event_count=0

    if [[ -f "$events_file" && "$log_mode" != "off" ]]; then
        while IFS= read -r event && [[ $event_count -lt 3 ]]; do
            tput cup $line_num 0 2>/dev/null || true
            printf "${TETRA_DIM}%-${term_width}s${TETRA_NC}" "$event"
            ((line_num++))
            ((event_count++))
        done < "$events_file"
    fi

    # Fill remaining event lines with blanks
    while [[ $event_count -lt 3 ]]; do
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
export -f status_display_clear
export -f status_display_add_event
export -f status_display_render
export -f status_display_refresh_loop
