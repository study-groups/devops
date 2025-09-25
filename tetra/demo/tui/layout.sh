#!/usr/bin/env bash

# TUI Layout - 4-line header and screen region management
# Handles positioning, screen clearing, and responsive layout

# Source color definitions
TUI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TUI_DIR/colors.sh"

# Layout constants
declare -gA LAYOUT=(
    ["header_lines"]="4"
    ["status_line"]="1"
    ["min_width"]="60"
    ["max_action_name"]="15"
    ["max_mode_name"]="10"
    ["max_env_name"]="8"
)

# Screen dimensions (updated dynamically)
declare -gA SCREEN=(
    ["width"]="80"
    ["height"]="24"
)

# Update screen dimensions
update_screen_size() {
    if command -v tput >/dev/null 2>&1; then
        SCREEN["width"]=$(tput cols 2>/dev/null || echo "80")
        SCREEN["height"]=$(tput lines 2>/dev/null || echo "24")
    fi
}

# Clear entire screen
clear_screen() {
    clear
}

# Clear specific region
clear_region() {
    local start_line="$1"
    local end_line="$2"

    for ((i=start_line; i<=end_line; i++)); do
        tput cup $((i-1)) 0 2>/dev/null || echo -e "\033[${i};1H"
        tput el 2>/dev/null || echo -e "\033[K"
    done
}

# Position cursor
position_cursor() {
    local line="$1"
    local column="$2"
    tput cup $((line-1)) $((column-1)) 2>/dev/null || echo -e "\033[${line};${column}H"
}

# Truncate text to fit width
truncate_text() {
    local text="$1"
    local max_width="$2"

    if [[ ${#text} -gt $max_width ]]; then
        echo "${text:0:$((max_width-3))}..."
    else
        echo "$text"
    fi
}

# Render line 1: TVIEW hostname | MODE:ENV
render_line1() {
    local hostname="$1"
    local mode="$2"
    local env="$3"

    local title="TVIEW"
    local context="${mode}:${env}"

    # Colorize components
    local title_colored=$(colorize "bold_white" "$title")
    local hostname_colored=$(colorize "bold_white" "$hostname")
    local separator_colored=$(colorize "dim_white" " | ")
    local context_colored=$(colorize_env "$env" "$context")

    echo -e "${title_colored} ${hostname_colored}${separator_colored}${context_colored}"
}

# Render line 2: Env: [CURRENT] others others others
render_line2() {
    local current_env="$1"
    shift
    local all_envs=("$@")

    local line="Env: "

    for env in "${all_envs[@]}"; do
        local env_name=$(truncate_text "$env" "${LAYOUT[max_env_name]}")
        if [[ "$env" == "$current_env" ]]; then
            line+="$(highlight_current "$env_name" "true") "
        else
            line+="$(highlight_current "$env_name" "false") "
        fi
    done

    echo -e "$line"
}

# Render line 3: Mode: [CURRENT] others others others
render_line3() {
    local current_mode="$1"
    shift
    local all_modes=("$@")

    local line="Mode: "

    for mode in "${all_modes[@]}"; do
        local mode_name=$(truncate_text "$mode" "${LAYOUT[max_mode_name]}")
        if [[ "$mode" == "$current_mode" ]]; then
            line+="$(highlight_current "$mode_name" "true") "
        else
            line+="$(highlight_current "$mode_name" "false") "
        fi
    done

    echo -e "$line"
}

# Render line 4: Action: [current] other other (position/total)
render_line4() {
    local current_index="$1"
    shift
    local actions=("$@")

    local line="Action: "
    local total=${#actions[@]}

    if [[ $total -eq 0 ]]; then
        line+="$(colorize "dim_white" "No actions available")"
    else
        # Ensure current_index is within bounds
        if [[ $current_index -ge $total ]]; then
            current_index=0
        elif [[ $current_index -lt 0 ]]; then
            current_index=$((total - 1))
        fi

        # Display actions
        for i in "${!actions[@]}"; do
            local action_display=$(echo "${actions[$i]}" | cut -d':' -f2)
            local action_name=$(truncate_text "$action_display" "${LAYOUT[max_action_name]}")

            if [[ $i -eq $current_index ]]; then
                line+="$(highlight_current "$action_name" "true") "
            else
                line+="$(highlight_current "$action_name" "false") "
            fi
        done

        # Add position indicator
        local position_text="($(($current_index + 1))/$total)"
        line+="$(colorize "dim_yellow" "$position_text")"
    fi

    echo -e "$line"
}

# Render complete 4-line header
render_header() {
    local hostname="$1"
    local current_env="$2"
    local current_mode="$3"
    local current_action_index="$4"
    local environments_str="$5"
    local modes_str="$6"
    local actions_str="$7"

    # Parse arrays from strings
    IFS=',' read -ra environments <<< "$environments_str"
    IFS=',' read -ra modes <<< "$modes_str"
    IFS=',' read -ra actions <<< "$actions_str"

    # Update screen size
    update_screen_size

    # Render each line
    position_cursor 1 1
    render_line1 "$hostname" "$current_mode" "$current_env"

    position_cursor 2 1
    render_line2 "$current_env" "${environments[@]}"

    position_cursor 3 1
    render_line3 "$current_mode" "${modes[@]}"

    position_cursor 4 1
    render_line4 "$current_action_index" "${actions[@]}"
}

# Render status line at bottom
render_status() {
    local message="$1"
    local type="${2:-info}"

    local status_line=$((${SCREEN["height"]} - 1))
    position_cursor $status_line 1
    tput el 2>/dev/null || echo -e "\033[K"

    if [[ -n "$message" ]]; then
        status_message "$type" "$message"
    fi
}

# Render help text
render_help() {
    local help_line=$((${SCREEN["height"]}))
    position_cursor $help_line 1
    tput el 2>/dev/null || echo -e "\033[K"

    local help_text="e/E=env d/D=mode a/A=action l/Enter=execute q=quit /=repl"
    local help_colored=$(colorize "dim_white" "$help_text")
    echo -e "$help_colored"
}

# Get content area bounds
get_content_area() {
    local start_line=$((${LAYOUT["header_lines"]} + 2))
    local end_line=$((${SCREEN["height"]} - ${LAYOUT["status_line"]} - 1))

    echo "$start_line $end_line"
}

# Render content in content area
render_content() {
    local content="$1"

    read start_line end_line <<< "$(get_content_area)"

    # Clear content area
    clear_region $start_line $end_line

    # Position at start of content area
    position_cursor $start_line 1

    # Render content with line wrapping
    echo -e "$content"
}

# Responsive layout adjustments
adjust_layout() {
    local screen_width="${SCREEN[width]}"

    if [[ $screen_width -lt ${LAYOUT[min_width]} ]]; then
        # Narrow screen adjustments
        LAYOUT["max_action_name"]=8
        LAYOUT["max_mode_name"]=6
        LAYOUT["max_env_name"]=4
    elif [[ $screen_width -gt 100 ]]; then
        # Wide screen adjustments
        LAYOUT["max_action_name"]=20
        LAYOUT["max_mode_name"]=15
        LAYOUT["max_env_name"]=12
    else
        # Standard screen
        LAYOUT["max_action_name"]=15
        LAYOUT["max_mode_name"]=10
        LAYOUT["max_env_name"]=8
    fi
}

# Initialize layout system
init_layout() {
    update_screen_size
    adjust_layout

    # Set terminal to application mode
    tput smcup 2>/dev/null || true

    # Hide cursor during updates
    tput civis 2>/dev/null || true

    # Clear screen
    clear_screen
}

# Cleanup layout system
cleanup_layout() {
    # Show cursor
    tput cnorm 2>/dev/null || true

    # Exit application mode
    tput rmcup 2>/dev/null || true

    # Clear screen
    clear_screen
}