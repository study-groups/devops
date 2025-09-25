#!/usr/bin/env bash

# TUI Render - Screen drawing and update functions
# Coordinates layout, colors, and content display

# Source TUI components
TUI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TUI_DIR/colors.sh"
source "$TUI_DIR/layout.sh"
source "$TUI_DIR/input.sh"

# Render state
declare -g LAST_RENDER_STATE=""
declare -g RENDER_DIRTY="true"

# Screen buffer for efficient updates
declare -ga SCREEN_BUFFER=()

# Mark screen as dirty (needs redraw)
mark_dirty() {
    RENDER_DIRTY="true"
}

# Check if screen needs redraw
is_dirty() {
    [[ "$RENDER_DIRTY" == "true" ]]
}

# Generate render state hash
generate_state_hash() {
    local hostname="$1"
    local current_env="$2"
    local current_mode="$3"
    local current_action_index="$4"
    local environments_str="$5"
    local modes_str="$6"
    local actions_str="$7"
    local content="$8"
    local status="$9"

    # Simple hash based on concatenation
    echo "${hostname}|${current_env}|${current_mode}|${current_action_index}|${environments_str}|${modes_str}|${actions_str}|${content}|${status}|${INPUT_MODE}" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "fallback_hash"
}

# Full screen render
render_full_screen() {
    local hostname="$1"
    local current_env="$2"
    local current_mode="$3"
    local current_action_index="$4"
    local environments_str="$5"
    local modes_str="$6"
    local actions_str="$7"
    local content="${8:-}"
    local status="${9:-}"
    local status_type="${10:-info}"

    # Generate state hash
    local state_hash=$(generate_state_hash "$hostname" "$current_env" "$current_mode" "$current_action_index" "$environments_str" "$modes_str" "$actions_str" "$content" "$status")

    # Skip render if state hasn't changed
    if [[ "$state_hash" == "$LAST_RENDER_STATE" && "$RENDER_DIRTY" != "true" ]]; then
        return 0
    fi

    # Update screen dimensions
    update_screen_size
    adjust_layout

    # Clear screen
    clear_screen

    # Render header
    render_header "$hostname" "$current_env" "$current_mode" "$current_action_index" "$environments_str" "$modes_str" "$actions_str"

    # Render content if provided
    if [[ -n "$content" ]]; then
        render_content "$content"
    fi

    # Render status if provided
    if [[ -n "$status" ]]; then
        render_status "$status" "$status_type"
    fi

    # Render help/mode indicator
    render_mode_indicator

    # Update state
    LAST_RENDER_STATE="$state_hash"
    RENDER_DIRTY="false"
}

# Render just the content area (partial update)
render_content_only() {
    local content="$1"

    render_content "$content"
    mark_dirty  # Force full render next time
}

# Render just the status line
render_status_only() {
    local status="$1"
    local status_type="${2:-info}"

    render_status "$status" "$status_type"
}

# Render mode indicator (gamepad/REPL)
render_mode_indicator() {
    local mode_line=$((${SCREEN["height"]}))
    position_cursor $mode_line 1
    tput el 2>/dev/null || echo -e "\033[K"

    case "$INPUT_MODE" in
        "gamepad")
            local help_text="e/E=env d/D=mode a/A=action l/Enter=execute /=repl q=quit"
            ;;
        "repl")
            local help_text="REPL mode - type 'help' for commands, 'gamepad' to return"
            ;;
        *)
            local help_text="Unknown input mode: $INPUT_MODE"
            ;;
    esac

    local help_colored=$(colorize "dim_white" "$help_text")
    echo -e "$help_colored"
}

# Render modal dialog
render_modal() {
    local title="$1"
    local content="$2"
    local width="${3:-60}"
    local height="${4:-10}"

    # Calculate modal position (centered)
    local start_line=$(( (${SCREEN["height"]} - height) / 2 ))
    local start_col=$(( (${SCREEN["width"]} - width) / 2 ))

    # Save cursor position
    tput sc 2>/dev/null || true

    # Draw modal border
    for ((i=0; i<height; i++)); do
        position_cursor $((start_line + i)) $start_col
        if [[ $i -eq 0 || $i -eq $((height-1)) ]]; then
            # Top/bottom border
            printf "+"
            printf "%*s" $((width-2)) "" | tr ' ' '-'
            printf "+"
        else
            # Side borders
            printf "|"
            printf "%*s" $((width-2)) ""
            printf "|"
        fi
    done

    # Draw title
    if [[ -n "$title" ]]; then
        position_cursor $((start_line + 1)) $((start_col + 2))
        local title_colored=$(colorize "bold_white" "$title")
        echo -e "$title_colored"

        # Title separator
        position_cursor $((start_line + 2)) $((start_col + 1))
        printf "%*s" $((width-2)) "" | tr ' ' '-'
    fi

    # Draw content
    local content_start=$((start_line + 3))
    local content_width=$((width - 4))

    # Split content into lines
    IFS=$'\n' read -rd '' -a content_lines <<< "$content" || true

    for ((i=0; i<${#content_lines[@]}; i++)); do
        if [[ $((content_start + i)) -ge $((start_line + height - 1)) ]]; then
            break  # Don't overflow modal
        fi

        position_cursor $((content_start + i)) $((start_col + 2))
        local line="${content_lines[$i]}"
        # Truncate line if too long
        if [[ ${#line} -gt $content_width ]]; then
            line="${line:0:$((content_width-3))}..."
        fi
        echo "$line"
    done

    # Restore cursor position
    tput rc 2>/dev/null || true
}

# Close modal (redraw screen)
close_modal() {
    mark_dirty  # Force full redraw
}

# Render loading indicator
render_loading() {
    local message="${1:-Loading...}"
    local spinner_chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local spinner_index=0

    # This would typically be called in a loop
    local char="${spinner_chars:$spinner_index:1}"
    render_status_only "$char $message" "info"
}

# Render error state
render_error() {
    local error_message="$1"
    local details="${2:-}"

    local content="ERROR: $error_message"
    if [[ -n "$details" ]]; then
        content+="\n\nDetails:\n$details"
    fi
    content+="\n\nPress any key to continue..."

    render_modal "Error" "$content" 60 8
}

# Render help modal
render_help_modal() {
    local help_content=""

    case "$INPUT_MODE" in
        "gamepad")
            help_content="Gamepad Navigation:\n\n"
            help_content+="e/E     Navigate environments\n"
            help_content+="d/D     Navigate modes\n"
            help_content+="a/A     Navigate actions\n"
            help_content+="l/Enter Execute selected action\n"
            help_content+="r/R     Refresh view\n"
            help_content+="/       Enter REPL mode\n"
            help_content+="h/H/?   Show this help\n"
            help_content+="q/Q     Quit application"
            ;;
        "repl")
            help_content="REPL Commands:\n\n"
            help_content+="env <name>     Change environment\n"
            help_content+="mode <name>    Change mode\n"
            help_content+="action <name>  Execute action\n"
            help_content+="list           List actions\n"
            help_content+="gamepad        Return to gamepad\n"
            help_content+="help           Show this help\n"
            help_content+="quit           Quit application"
            ;;
    esac

    render_modal "Help" "$help_content" 50 12
}

# Animation frame counter (for loading spinners, etc.)
declare -g ANIMATION_FRAME=0

# Animate loading indicator
animate_loading() {
    local message="${1:-Loading...}"
    local spinner_chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local char_index=$((ANIMATION_FRAME % ${#spinner_chars}))
    local char="${spinner_chars:$char_index:1}"

    render_status_only "$char $message" "info"
    ANIMATION_FRAME=$((ANIMATION_FRAME + 1))
}

# Initialize render system
init_render() {
    LAST_RENDER_STATE=""
    RENDER_DIRTY="true"
    ANIMATION_FRAME=0

    # Initialize layout
    init_layout

    # Clear any existing content
    clear_screen
}

# Cleanup render system
cleanup_render() {
    # Cleanup layout
    cleanup_layout

    # Reset state
    LAST_RENDER_STATE=""
    RENDER_DIRTY="true"
}

# Render debug info (for development)
render_debug_info() {
    local debug_info="$1"

    # Position in top-right corner
    local debug_line=1
    local debug_col=$((${SCREEN["width"]} - 20))

    position_cursor $debug_line $debug_col
    local debug_colored=$(colorize "dim_yellow" "[DEBUG: $debug_info]")
    echo -e "$debug_colored"
}