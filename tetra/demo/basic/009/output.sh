#!/usr/bin/env bash

# TUI Output System - Screen Layout and Positioning
# Responsibility: Layout, positioning, screen regions, terminal control
# Never contains business logic or content generation

# UI configuration variables
declare -g UI_HEADER_LINES=4
declare -g UI_FOOTER_LINES=4  # Resizable footer starting at 4 lines
declare -g UI_SEPARATOR_LINES=1
declare -g UI_REPL_LINES=1  # REPL prompt line above footer

# Screen buffer for efficient rendering
declare -g SCREEN_BUFFER=""
declare -g PREV_SCREEN_BUFFER=""

# Initialize terminal for TUI mode
init_terminal() {
    tput civis  # Hide cursor
    tput clear  # Initial clear only
}

# Restore terminal on exit
cleanup_terminal() {
    tput cnorm  # Show cursor
    tput clear
}

# Calculate terminal regions
get_terminal_regions() {
    local term_width=${COLUMNS:-80}
    local term_height=${LINES:-24}

    # Header region: lines 1-4
    REGION_HEADER_START=1
    REGION_HEADER_END=$UI_HEADER_LINES

    # Content region: after header + separator, before REPL + footer
    REGION_CONTENT_START=$((UI_HEADER_LINES + UI_SEPARATOR_LINES + 1))
    REGION_CONTENT_END=$((term_height - UI_REPL_LINES - UI_FOOTER_LINES))

    # REPL region: line above footer (left-aligned)
    REGION_REPL_LINE=$((term_height - UI_FOOTER_LINES))

    # Footer region: last 4 lines
    REGION_FOOTER_START=$((term_height - UI_FOOTER_LINES + 1))
    REGION_FOOTER_END=$term_height

    # Available content lines
    REGION_CONTENT_LINES=$((REGION_CONTENT_END - REGION_CONTENT_START + 1))
}

# Position cursor at specific region
position_at_header() { tput cup 0 0; }
position_at_content() { tput cup $((REGION_CONTENT_START - 1)) 0; }
position_at_footer() { tput cup $((REGION_FOOTER_START - 1)) 0; }
position_at_cli() { tput cup $((REGION_CLI_START - 1)) 0; }

# Generate screen buffer for header region
generate_header_buffer() {
    local term_width=${COLUMNS:-80}
    SCREEN_BUFFER=""

    # Line 1: Header
    SCREEN_BUFFER+="$(tput cup 0 0)$(render_header | cut -c1-$term_width)$(tput el)"$'\n'

    # Line 2: Environment
    SCREEN_BUFFER+="$(tput cup 1 0)$(render_environment_line | cut -c1-$term_width)$(tput el)"$'\n'

    # Line 3: Mode
    SCREEN_BUFFER+="$(tput cup 2 0)$(render_mode_line | cut -c1-$term_width)$(tput el)"$'\n'

    # Line 4: Action
    SCREEN_BUFFER+="$(tput cup 3 0)$(render_action_line | cut -c1-$term_width)$(tput el)"$'\n'

    # Line 5: Separator
    SCREEN_BUFFER+="$(tput cup 4 0)$(printf '%.40s' '----------------------------------------')$(tput el)"$'\n'
}

# Generate content buffer for content region
generate_content_buffer() {
    local content_start=$1
    local available_lines=$2
    local max_width=$3
    local buffer=""
    local current_line=$content_start

    get_terminal_regions

    if [[ -n "$CONTENT" ]]; then
        # Display actual content
        while IFS= read -r line && [[ $current_line -le $((content_start + available_lines - 1)) ]]; do
            buffer+="$(tput cup $((current_line - 1)) 0)$(echo "$line" | cut -c1-$max_width)$(tput el)"$'\n'
            ((current_line++))
        done <<< "$CONTENT"
    else
        # Default content
        buffer+="$(tput cup $((current_line - 1)) 0)Demo v009 - CLI REPL Integration$(tput el)"$'\n'
        ((current_line++))
        buffer+="$(tput cup $((current_line - 1)) 0)$(tput el)"$'\n'
        ((current_line++))
        buffer+="$(tput cup $((current_line - 1)) 0)E×M+A=R: Environment × Mode + Action = Result$(tput el)"$'\n'
        ((current_line++))

        if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_GAMEPAD" ]]; then
            buffer+="$(tput cup $((current_line - 1)) 0)Home row: e/d/s/f | a=info A=fire | REPL: /$(tput el)"$'\n'
            ((current_line++))
        fi
    fi

    # Clear remaining content lines
    while [[ $current_line -le $((content_start + available_lines - 1)) ]]; do
        buffer+="$(tput cup $((current_line - 1)) 0)$(tput el)"$'\n'
        ((current_line++))
    done

    echo -n "$buffer"
}

# Generate footer buffer (4 lines)
generate_footer_buffer() {
    local term_width=${COLUMNS:-80}
    local buffer=""

    get_terminal_regions

    # Main footer line (centered)
    buffer+="$(tput cup $((REGION_FOOTER_START - 1)) 0)$(render_footer | cut -c1-$term_width)$(tput el)"$'\n'

    # Clear remaining footer lines
    local line=$((REGION_FOOTER_START + 1))
    while [[ $line -le $REGION_FOOTER_END ]]; do
        buffer+="$(tput cup $((line - 1)) 0)$(tput el)"$'\n'
        ((line++))
    done

    echo -n "$buffer"
}

# Display complete screen (gamepad mode)
show_gamepad_display() {
    local term_width=${COLUMNS:-80}
    local term_height=${LINES:-24}

    get_terminal_regions

    # Generate header buffer
    generate_header_buffer

    # Add content buffer
    SCREEN_BUFFER+="$(generate_content_buffer "$REGION_CONTENT_START" "$REGION_CONTENT_LINES" "$term_width")"

    # Add footer buffer
    SCREEN_BUFFER+="$(generate_footer_buffer)"

    # Output the complete buffer
    printf "%s" "$SCREEN_BUFFER"
}

# Clear REPL region only (preserve header/content/footer)
clear_repl_region() {
    get_terminal_regions
    tput cup $((REGION_REPL_LINE - 1)) 0
    tput el
}

# Position for REPL input (left-aligned on line above footer)
position_repl_input() {
    get_terminal_regions
    tput cup $((REGION_REPL_LINE - 1)) 0
}

# Update only content region (preserve header/footer/cli)
update_content_region() {
    local term_width=${COLUMNS:-80}
    get_terminal_regions

    # Generate and display only content buffer
    local content_buffer=$(generate_content_buffer "$REGION_CONTENT_START" "$REGION_CONTENT_LINES" "$term_width")
    printf "%s" "$content_buffer"
}