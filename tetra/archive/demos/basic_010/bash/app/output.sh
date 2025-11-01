#!/usr/bin/env bash

# TUI Output System - Screen Layout and Positioning
# Responsibility: Layout, positioning, screen regions, terminal control
# Never contains business logic or content generation

# Source separator utilities
source "$DEMO_SRC/bash/tui/modules/separators.sh"

# UI configuration variables
declare -g UI_HEADER_LINES=4
declare -g UI_FOOTER_LINES=4  # Resizable footer starting at 4 lines
declare -g UI_SEPARATOR_LINES=1
declare -g UI_REPL_LINES=1  # REPL prompt line above footer

# Screen buffer for efficient rendering
declare -g SCREEN_BUFFER=""
declare -g PREV_SCREEN_BUFFER=""
declare -g PREV_FOOTER_BUFFER=""

# Initialize terminal for TUI mode
init_terminal() {
    # Get actual terminal size dynamically using /dev/tty
    if [[ -e /dev/tty ]]; then
        read LINES COLUMNS < <(stty size </dev/tty 2>/dev/null)
    fi

    # Fallback to tput if stty failed
    if [[ -z "$LINES" || -z "$COLUMNS" ]]; then
        LINES=$(tput lines 2>/dev/null || echo 24)
        COLUMNS=$(tput cols 2>/dev/null || echo 80)
    fi

    export LINES COLUMNS

    # Log the detected size
    if command -v log_action >/dev/null 2>&1; then
        log_action "Terminal size detected: ${COLUMNS}x${LINES}"
    fi

    tput civis  # Hide cursor initially
    printf '\033[?25l'  # Extra cursor hide command
    tput clear  # Initial clear only
}

# Show cursor for REPL mode
show_cursor() {
    tput cnorm
}

# Hide cursor for gamepad mode
hide_cursor() {
    tput civis
    printf '\033[?25l'  # Extra cursor hide command
}

# Restore terminal on exit
cleanup_terminal() {
    tput cnorm  # Show cursor
    tput clear
}

# Calculate terminal regions
get_terminal_regions() {
    # Always get fresh terminal size - redirect from /dev/tty to ensure TTY access
    local term_height term_width
    if [[ -e /dev/tty ]]; then
        read term_height term_width < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$term_height" ]] && term_height=$(tput lines 2>/dev/null || echo ${LINES:-24})
    [[ -z "$term_width" ]] && term_width=$(tput cols 2>/dev/null || echo ${COLUMNS:-80})

    # Header region: lines 1-4
    REGION_HEADER_START=1
    REGION_HEADER_END=$UI_HEADER_LINES

    # Content region: after header + separator, before footer (and REPL if in REPL mode)
    REGION_CONTENT_START=$((UI_HEADER_LINES + UI_SEPARATOR_LINES + 1))
    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_REPL" ]]; then
        REGION_CONTENT_END=$((term_height - UI_REPL_LINES - UI_FOOTER_LINES))
        # REPL region: line above footer (left-aligned)
        REGION_REPL_LINE=$((term_height - UI_FOOTER_LINES))
    else
        # Use full available height in gamepad mode
        REGION_CONTENT_END=$((term_height - UI_FOOTER_LINES))
        # No REPL region in gamepad mode
        REGION_REPL_LINE=0
    fi

    # Footer region: last 4 lines (or less if terminal is small)
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
    local term_width
    if [[ -e /dev/tty ]]; then
        read _ term_width < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$term_width" ]] && term_width=$(tput cols 2>/dev/null || echo ${COLUMNS:-80})
    SCREEN_BUFFER=""

    # Line 1: Header
    SCREEN_BUFFER+="$(tput cup 0 0)$(render_header | cut -c1-$term_width)$(tput el)"$'\n'

    # Line 2: Environment
    local env_line=$(render_environment_line)
    SCREEN_BUFFER+="$(tput cup 1 0)${env_line}$(tput el)"$'\n'

    # Line 3: Mode
    local mode_line=$(render_mode_line)
    SCREEN_BUFFER+="$(tput cup 2 0)${mode_line}$(tput el)"$'\n'

    # Line 4: Action (ensure complete clearing for shorter lines)
    local action_line=$(render_action_line)
    SCREEN_BUFFER+="$(tput cup 3 0)$(tput el)${action_line}"$'\n'

    # Line 5: Separator (counter moved to bottom right)
    local separator="$(generate_section_separator "${COLUMNS:-80}" "-")"

    SCREEN_BUFFER+="$(tput cup 4 0)${separator}$(tput el)"$'\n'
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
        # Display actual content without truncating
        while IFS= read -r line && [[ $current_line -le $((content_start + available_lines - 1)) ]]; do
            buffer+="$(tput cup $((current_line - 1)) 0)$(printf '%b' "$line")$(tput el)"$'\n'
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
            buffer+="$(tput cup $((current_line - 1)) 0)Keys: 1-env 2-mode 3-action Tab-dropdown | c=clear r=refresh | REPL: /$(tput el)"$'\n'
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
    local term_height term_width
    if [[ -e /dev/tty ]]; then
        read term_height term_width < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$term_height" ]] && term_height=$(tput lines 2>/dev/null || echo ${LINES:-24})
    [[ -z "$term_width" ]] && term_width=$(tput cols 2>/dev/null || echo ${COLUMNS:-80})
    local buffer=""

    get_terminal_regions

    if [[ -n "$FOOTER_CONTENT" ]]; then
        # Count lines in footer content
        local content_lines=$(echo "$FOOTER_CONTENT" | wc -l)
        local available_lines=$UI_FOOTER_LINES

        # Calculate vertical centering offset
        local vertical_offset=0
        if [[ $content_lines -lt $((available_lines - 1)) ]]; then
            vertical_offset=$(( (available_lines - content_lines) / 2 ))
        fi

        # Clear all footer lines first
        local line=$REGION_FOOTER_START
        while [[ $line -le $REGION_FOOTER_END ]]; do
            buffer+="$(printf '\033[%d;1H\033[K' $line)"$'\n'
            ((line++))
        done

        # Render centered footer content
        local line_num=0
        while IFS= read -r line && [[ $line_num -lt $available_lines ]]; do
            local target_line=$((REGION_FOOTER_START + vertical_offset + line_num))
            if [[ $target_line -le $REGION_FOOTER_END ]]; then
                buffer+="$(printf '\033[%d;1H%s\033[K' $target_line "$line")"$'\n'
            fi
            ((line_num++))
        done <<< "$FOOTER_CONTENT"
    else
        # Default footer - always centered
        local footer_text=$(render_footer)
        buffer+="$(printf '\033[%d;1H%s\033[K' $REGION_FOOTER_START "$footer_text")"$'\n'

        # Clear remaining footer lines
        local line=$((REGION_FOOTER_START + 1))
        while [[ $line -le $REGION_FOOTER_END ]]; do
            buffer+="$(printf '\033[%d;1H\033[K' $line)"$'\n'
            ((line++))
        done
    fi

    # Add completed counter at bottom right (2 char margin on right, 1 line margin on bottom)
    local actions=($(get_actions 2>/dev/null || true))
    if [[ ${#actions[@]} -gt 0 ]]; then
        local counter="$(($ACTION_INDEX + 1))/${#actions[@]}"
        local counter_col=$((term_width - ${#counter} - 2))
        local counter_row=$((term_height - 2))  # 1 line margin from bottom means -2 not -1
        buffer+="$(printf '\033[%d;%dH%s' $counter_row $counter_col "$counter")"$'\n'
    fi

    echo -n "$buffer"
}

# Display complete screen (gamepad mode)
show_gamepad_display() {
    local term_height term_width
    if [[ -e /dev/tty ]]; then
        read term_height term_width < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$term_height" ]] && term_height=$(tput lines 2>/dev/null || echo ${LINES:-24})
    [[ -z "$term_width" ]] && term_width=$(tput cols 2>/dev/null || echo ${COLUMNS:-80})

    # Apply current theme/background before rendering
    apply_current_theme

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

# Apply current theme and background state
apply_current_theme() {
    if [[ -n "$SCREEN_BACKGROUND" ]]; then
        term_bg_color "$SCREEN_BACKGROUND"
    elif [[ -n "$CURRENT_THEME" ]]; then
        term_bg_color "$(get_theme_color bg)"
    fi
}

# Force display update for gamepad mode
update_gamepad_display() {
    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_GAMEPAD" ]]; then
        show_gamepad_display
    fi
}


# Position for REPL input (left-aligned on line above footer)
position_repl_input() {
    get_terminal_regions
    printf "\033[%d;1H" "$REGION_REPL_LINE"
}

# Update only content region (preserve header/footer/cli)
update_content_region() {
    local term_width
    if [[ -e /dev/tty ]]; then
        read _ term_width < <(stty size </dev/tty 2>/dev/null)
    fi
    [[ -z "$term_width" ]] && term_width=$(tput cols 2>/dev/null || echo ${COLUMNS:-80})
    get_terminal_regions

    # Generate and display only content buffer
    local content_buffer=$(generate_content_buffer "$REGION_CONTENT_START" "$REGION_CONTENT_LINES" "$term_width")
    printf "%s" "$content_buffer"
}

# Update only footer region with buffering
update_footer_region() {
    local new_footer_buffer=$(generate_footer_buffer)

    # Only update if changed to reduce flicker
    if [[ "$PREV_FOOTER_BUFFER" != "$new_footer_buffer" ]]; then
        printf "%s" "$new_footer_buffer"
        PREV_FOOTER_BUFFER="$new_footer_buffer"
    fi
}

# Clear REPL region with minimal flicker
clear_repl_region() {
    get_terminal_regions
    # Use single cursor movement and clear
    printf "\033[%d;1H\033[K" "$REGION_REPL_LINE"
}