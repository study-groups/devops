#!/usr/bin/env bash

# TView Modal System - Pure bash modal overlays using ANSI escapes
# Single responsibility: Create ncurses-like modal windows without ncurses

# Global modal state
declare -gA MODAL_STATE=(
    ["active"]="false"
    ["type"]=""
    ["title"]=""
    ["content"]=""
    ["saved_screen"]=""
)

# ANSI escape sequences for screen manipulation
ANSI_SAVE_SCREEN="\033[?47h"
ANSI_RESTORE_SCREEN="\033[?47l"
ANSI_SAVE_CURSOR="\033[s"
ANSI_RESTORE_CURSOR="\033[u"
ANSI_CLEAR_SCREEN="\033[2J"
ANSI_HOME_CURSOR="\033[H"
ANSI_HIDE_CURSOR="\033[?25l"
ANSI_SHOW_CURSOR="\033[?25h"

# Move cursor to specific position
ansi_move_cursor() {
    local row="$1"
    local col="$2"
    printf "\033[%d;%dH" "$row" "$col"
}

# Clear from cursor to end of line
ansi_clear_eol() {
    printf "\033[K"
}

# Set text attributes
ansi_bold() { printf "\033[1m"; }
ansi_dim() { printf "\033[2m"; }
ansi_reset() { printf "\033[0m"; }
ansi_reverse() { printf "\033[7m"; }

# Box drawing characters (fallback for terminals without Unicode)
BOX_H="─"
BOX_V="│"
BOX_TL="┌"
BOX_TR="┐"
BOX_BL="└"
BOX_BR="┘"
BOX_T="┬"
BOX_B="┴"
BOX_L="├"
BOX_R="┤"

# Fallback to ASCII if Unicode not supported
if [[ "${LC_ALL:-${LANG:-}}" != *"UTF-8"* ]]; then
    BOX_H="-"
    BOX_V="|"
    BOX_TL="+"
    BOX_TR="+"
    BOX_BL="+"
    BOX_BR="+"
    BOX_T="+"
    BOX_B="+"
    BOX_L="+"
    BOX_R="+"
fi

# Draw a box with title
draw_modal_box() {
    local start_row="$1"
    local start_col="$2"
    local width="$3"
    local height="$4"
    local title="$5"

    # Draw top border with title
    ansi_move_cursor "$start_row" "$start_col"
    ansi_bold
    printf "%s" "$BOX_TL"

    # Title in top border
    local title_len=${#title}
    local title_padding=$(( (width - title_len - 4) / 2 ))

    for ((i=0; i<title_padding; i++)); do
        printf "%s" "$BOX_H"
    done

    printf " %s " "$title"

    for ((i=0; i<(width - title_len - title_padding - 4); i++)); do
        printf "%s" "$BOX_H"
    done

    printf "%s" "$BOX_TR"
    ansi_reset

    # Draw sides
    for ((row=1; row<height-1; row++)); do
        ansi_move_cursor $((start_row + row)) "$start_col"
        ansi_bold
        printf "%s" "$BOX_V"
        ansi_move_cursor $((start_row + row)) $((start_col + width - 1))
        printf "%s" "$BOX_V"
        ansi_reset
    done

    # Draw bottom border
    ansi_move_cursor $((start_row + height - 1)) "$start_col"
    ansi_bold
    printf "%s" "$BOX_BL"
    for ((i=1; i<width-1; i++)); do
        printf "%s" "$BOX_H"
    done
    printf "%s" "$BOX_BR"
    ansi_reset
}

# Fill modal content area
fill_modal_content() {
    local start_row="$1"
    local start_col="$2"
    local width="$3"
    local height="$4"
    local content="$5"

    local content_width=$((width - 2))
    local content_height=$((height - 2))

    # Clear content area
    for ((row=1; row<height-1; row++)); do
        ansi_move_cursor $((start_row + row)) $((start_col + 1))
        for ((col=0; col<content_width; col++)); do
            printf " "
        done
    done

    # Write content line by line
    local line_num=1
    while IFS= read -r line && [[ $line_num -lt $content_height ]]; do
        ansi_move_cursor $((start_row + line_num)) $((start_col + 2))

        # Truncate line if too long
        if [[ ${#line} -gt $((content_width - 2)) ]]; then
            line="${line:0:$((content_width - 5))}..."
        fi

        printf "%s" "$line"
        ((line_num++))
    done <<< "$content"
}

# Show modal overlay
show_modal() {
    local type="$1"
    local title="$2"
    local content="$3"

    # Update modal state
    MODAL_STATE["active"]="true"
    MODAL_STATE["type"]="$type"
    MODAL_STATE["title"]="$title"
    MODAL_STATE["content"]="$content"

    # Initialize TOML editor if this is a toml_editor modal
    if [[ "$type" == "toml_editor" && -f "$TETRA_BASH/tview/toml/modal_editor.sh" ]]; then
        source "$TETRA_BASH/tview/toml/modal_editor.sh"
        init_modal_editor "$ACTIVE_TOML" >/dev/null 2>&1
    fi

    # Save current screen state
    printf "%b" "$ANSI_SAVE_CURSOR"
    printf "%b" "$ANSI_SAVE_SCREEN"
    printf "%b" "$ANSI_HIDE_CURSOR"

    # Clear screen for modal
    printf "%b" "$ANSI_CLEAR_SCREEN"
    printf "%b" "$ANSI_HOME_CURSOR"

    # Calculate modal dimensions based on type
    local width height start_row start_col
    case "$type" in
        "help")
            width=70
            height=20
            ;;
        "toml_editor")
            width=80
            height=25
            ;;
        "keymap")
            width=60
            height=15
            ;;
        "error")
            width=50
            height=8
            ;;
        "confirm")
            width=40
            height=6
            ;;
        *)
            width=60
            height=12
            ;;
    esac

    start_col=$(( (COLUMNS - width) / 2 ))
    start_row=$(( (LINES - height) / 2 ))

    # Ensure modal fits on screen
    if [[ $start_col -lt 1 ]]; then start_col=1; fi
    if [[ $start_row -lt 1 ]]; then start_row=1; fi
    if [[ $((start_col + width)) -gt $COLUMNS ]]; then
        width=$((COLUMNS - start_col - 1))
    fi
    if [[ $((start_row + height)) -gt $LINES ]]; then
        height=$((LINES - start_row - 1))
    fi

    # Draw modal
    draw_modal_box "$start_row" "$start_col" "$width" "$height" "$title"
    fill_modal_content "$start_row" "$start_col" "$width" "$height" "$content"

    # Add footer with instructions
    local footer_row=$((start_row + height + 1))
    if [[ $footer_row -lt $LINES ]]; then
        ansi_move_cursor "$footer_row" "$start_col"
        ansi_dim
        case "$type" in
            "confirm")
                printf "y/n to confirm, ESC to cancel"
                ;;
            "toml_editor")
                printf "wasd/jikl navigation, Enter edit, ESC close"
                ;;
            *)
                printf "Press any key to close, ESC to cancel"
                ;;
        esac
        ansi_reset
    fi

    # Show cursor at bottom
    ansi_move_cursor $((LINES - 1)) 1
    printf "%b" "$ANSI_SHOW_CURSOR"
}

# Handle modal input and return result
handle_modal_input() {
    local result=""

    while [[ "${MODAL_STATE[active]}" == "true" ]]; do
        # Use timeout to prevent infinite blocking
        if read -t 30 -n1 -s key; then
            case "${MODAL_STATE[type]}" in
                "confirm")
                    case "$key" in
                        'y'|'Y') result="yes"; break ;;
                        'n'|'N') result="no"; break ;;
                        $'\e'|$'\033') result="cancel"; break ;;  # ESC (handle both forms)
                        '') result="cancel"; break ;;  # Enter in confirm mode cancels
                    esac
                    ;;
                "toml_editor")
                    # TOML editor modal with standard TView keys
                    case "$key" in
                        $'\e'|$'\033') result="cancel"; break ;;  # ESC closes
                        'i'|'I')
                            handle_toml_modal_key "up"
                            # Stay in modal - don't break
                            ;;
                        'k'|'K')
                            handle_toml_modal_key "down"
                            # Stay in modal - don't break
                            ;;
                        'l'|'L')
                            handle_toml_modal_key "drill_in"
                            # Stay in modal - don't break
                            ;;
                        'j'|'J') result="cancel"; break ;;       # J = EXIT/OUT
                        '')
                            handle_toml_modal_key "enter"
                            # Stay in modal - don't break
                            ;;
                        'q'|'Q') result="cancel"; break ;;       # Q also closes
                        'r'|'R')
                            refresh_toml_modal
                            # Stay in modal - don't break
                            ;;
                        *)
                            # Ignore invalid keys silently in modal
                            ;;
                    esac
                    ;;  # This was missing - causing infinite loop!
                *)
                    # Any key closes non-confirm modals
                    case "$key" in
                        $'\e'|$'\033') result="cancel" ;;  # ESC (handle both forms)
                        '') result="ok" ;;  # Enter
                        *) result="ok" ;;   # Any other key
                    esac
                    break
                    ;;
            esac
        else
            # Timeout - close modal
            result="timeout"
            break
        fi
    done

    close_modal
    echo "$result"
}

# Close modal and restore screen
close_modal() {
    MODAL_STATE["active"]="false"
    MODAL_STATE["type"]=""
    MODAL_STATE["title"]=""
    MODAL_STATE["content"]=""

    # Restore screen state
    printf "%b" "$ANSI_HIDE_CURSOR"
    printf "%b" "$ANSI_RESTORE_SCREEN"
    printf "%b" "$ANSI_RESTORE_CURSOR"
    printf "%b" "$ANSI_SHOW_CURSOR"

    # Force screen refresh when returning to main TView
    if command -v redraw_screen >/dev/null 2>&1; then
        redraw_screen
    fi
}

# Check if modal is active
is_modal_active() {
    [[ "${MODAL_STATE[active]}" == "true" ]]
}

# TOML Editor Modal Handlers
handle_toml_modal_key() {
    local key="$1"

    # Load TOML provider and actions if not already loaded
    if ! command -v handle_toml_action >/dev/null 2>&1; then
        source "$TETRA_SRC/bash/tview/toml/toml_actions.sh"
    fi

    # Handle TOML navigation actions using standard TView keys
    case "$key" in
        "up")
            # Move up navigation
            handle_toml_action "navigate" "$CURRENT_ENV" "up" >/dev/null 2>&1
            ;;
        "down")
            # Move down navigation
            handle_toml_action "navigate" "$CURRENT_ENV" "down" >/dev/null 2>&1
            ;;
        "drill_in")
            # Drill in - expand current section
            handle_toml_action "expand" "$CURRENT_ENV" >/dev/null 2>&1
            ;;
        "enter")
            # Enter edit mode - expand current section
            handle_toml_action "expand" "$CURRENT_ENV" >/dev/null 2>&1
            ;;
        *)
            ;;
    esac
}

# Refresh TOML modal display
refresh_toml_modal() {
    # Load TOML provider and actions if not already loaded
    if ! command -v handle_toml_action >/dev/null 2>&1; then
        source "$TETRA_SRC/bash/tview/toml/toml_actions.sh"
    fi

    # Refresh the TOML editor state
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        handle_toml_action "refresh" "${CURRENT_ENV:-TETRA}" >/dev/null 2>&1
    fi

    return 0
}

# Show help message for invalid keys
show_toml_help_message() {
    local invalid_key="$1"

    # Could flash a help message or beep
    # For now, just ignore invalid keys silently
    return 0
}

# Convenience functions for common modal types
show_help_modal() {
    local title="$1"
    local help_content="$2"
    show_modal "help" "$title" "$help_content"
    handle_modal_input
}

show_keymap_modal() {
    local mode="$1"
    local keymap_content="$2"
    show_modal "keymap" "$mode Key Map" "$keymap_content"
    handle_modal_input
}

show_error_modal() {
    local error_message="$1"
    show_modal "error" "Error" "$error_message"
    handle_modal_input
}

show_confirm_modal() {
    local message="$1"
    show_modal "confirm" "Confirm" "$message"
    handle_modal_input
}