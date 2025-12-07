#!/usr/bin/env bash
# TCurses TAB Completion
# Provides TAB completion for TUI REPLs

# Completion state
declare -g REPL_COMPLETION_WORDS=()
declare -g REPL_COMPLETION_MATCHES=()
declare -g REPL_COMPLETION_INDEX=0
declare -g REPL_COMPLETION_ORIGINAL=""
declare -g REPL_COMPLETION_TAB_COUNT=0

# Completion metadata (associative array: word -> hint)
declare -gA REPL_COMPLETION_HINTS=()

# Completion categories (associative array: word -> category)
declare -gA REPL_COMPLETION_CATEGORIES=()

# Completion menu position: "above" or "below" (default: above for REPL, below for TUI)
declare -g REPL_COMPLETION_MENU_POSITION="${REPL_COMPLETION_MENU_POSITION:-above}"

# Set completion menu position
# Usage: repl_set_completion_menu_position "above|below"
repl_set_completion_menu_position() {
    REPL_COMPLETION_MENU_POSITION="$1"
}

# Set hint for a completion word
# Usage: repl_set_completion_hint "word" "hint text"
repl_set_completion_hint() {
    REPL_COMPLETION_HINTS["$1"]="$2"
}

# Get hint for a completion word
# Usage: hint=$(repl_get_completion_hint "word")
repl_get_completion_hint() {
    echo "${REPL_COMPLETION_HINTS[$1]}"
}

# Set category for a completion word
# Usage: repl_set_completion_category "word" "category"
repl_set_completion_category() {
    REPL_COMPLETION_CATEGORIES["$1"]="$2"
}

# Get category for a completion word
# Usage: category=$(repl_get_completion_category "word")
repl_get_completion_category() {
    echo "${REPL_COMPLETION_CATEGORIES[$1]}"
}

# Get color for category
# Returns ANSI color code for a given category
_repl_get_category_color() {
    local category="$1"
    case "$category" in
        "TDS") echo "36" ;;  # Cyan for TDS
        "REPL") echo "35" ;; # Magenta for REPL
        "Palette") echo "33" ;; # Yellow for Palette
        *) echo "37" ;; # White for unknown
    esac
}

# Register completion words
# Usage: repl_register_completion_words "word1" "word2" ...
repl_register_completion_words() {
    REPL_COMPLETION_WORDS=("$@")
}

# Load completion words from file
# Usage: repl_load_completion_words <file>
repl_load_completion_words() {
    local file="$1"
    if [[ -f "$file" ]]; then
        mapfile -t REPL_COMPLETION_WORDS < "$file"
    fi
}

# Set completion generator function
# Usage: repl_set_completion_generator <function_name>
repl_set_completion_generator() {
    REPL_COMPLETION_GENERATOR="$1"
}

# Generate completion words dynamically
_repl_generate_completion_words() {
    if [[ -n "$REPL_COMPLETION_GENERATOR" ]] && command -v "$REPL_COMPLETION_GENERATOR" >/dev/null 2>&1; then
        mapfile -t REPL_COMPLETION_WORDS < <("$REPL_COMPLETION_GENERATOR")
    fi
}

# Get current word being completed
_repl_get_current_word() {
    local input="$REPL_INPUT"
    local cursor="$REPL_CURSOR_POS"

    # Find word boundaries
    local word_start=0
    local word_end=$cursor

    # Find start of word (scan backwards from cursor)
    for ((i=cursor-1; i>=0; i--)); do
        local char="${input:$i:1}"
        if [[ "$char" == " " ]] || [[ "$char" == $'\t' ]]; then
            word_start=$((i+1))
            break
        fi
    done

    # Find end of word (scan forwards from cursor)
    for ((i=cursor; i<${#input}; i++)); do
        local char="${input:$i:1}"
        if [[ "$char" == " " ]] || [[ "$char" == $'\t' ]]; then
            word_end=$i
            break
        fi
    done

    local word="${input:$word_start:$((word_end-word_start))}"
    echo "$word_start|$word_end|$word"
}

# Find matching completions
_repl_find_completions() {
    local prefix="$1"
    REPL_COMPLETION_MATCHES=()

    # Regenerate dynamic completions if needed
    if [[ -n "$REPL_COMPLETION_GENERATOR" ]]; then
        _repl_generate_completion_words
    fi

    # Find matches
    for word in "${REPL_COMPLETION_WORDS[@]}"; do
        if [[ "$word" == "$prefix"* ]]; then
            REPL_COMPLETION_MATCHES+=("$word")
        fi
    done
}

# Handle TAB key press
repl_handle_tab() {
    # Debug
    if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[TAB] Starting repl_handle_tab" >&2
        echo "[TAB] REPL_COMPLETION_ORIGINAL='$REPL_COMPLETION_ORIGINAL'" >&2
    fi

    # Get current word
    local word_info="$(_repl_get_current_word)"
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[TAB] current_word='$current_word' start=$word_start end=$word_end" >&2
    fi

    # First TAB - find completions
    # Note: Can't use -z test on ORIGINAL because it might legitimately be empty
    if [[ "$REPL_COMPLETION_TAB_COUNT" -eq 0 ]]; then
        if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
            echo "[TAB] First TAB - finding completions" >&2
        fi

        REPL_COMPLETION_ORIGINAL="$current_word"
        REPL_COMPLETION_TAB_COUNT=1
        REPL_COMPLETION_WORD_START="$word_start"
        REPL_COMPLETION_WORD_END="$word_end"
        _repl_find_completions "$current_word"
        REPL_COMPLETION_INDEX=0

        if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
            echo "[TAB] Set REPL_COMPLETION_ORIGINAL='$REPL_COMPLETION_ORIGINAL'" >&2
            echo "[TAB] Found ${#REPL_COMPLETION_MATCHES[@]} matches" >&2
        fi

        if [[ ${#REPL_COMPLETION_MATCHES[@]} -eq 0 ]]; then
            # No matches - beep or do nothing
            return
        fi

        # Show first match and fill it in
        local match="${REPL_COMPLETION_MATCHES[$REPL_COMPLETION_INDEX]}"
        REPL_INPUT="${REPL_INPUT:0:$word_start}${match}${REPL_INPUT:$word_end}"
        REPL_CURSOR_POS=$((word_start + ${#match}))

        # Update word_end to point after the completed word for next cycle
        REPL_COMPLETION_WORD_END=$((word_start + ${#match}))

    else
        # Subsequent TAB - check for double-TAB or cycle
        REPL_COMPLETION_TAB_COUNT=$((REPL_COMPLETION_TAB_COUNT + 1))

        if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
            echo "[TAB] Subsequent TAB (count=$REPL_COMPLETION_TAB_COUNT, index=$REPL_COMPLETION_INDEX)" >&2
        fi

        # Double-TAB (second TAB press) - show all matches
        if [[ "$REPL_COMPLETION_TAB_COUNT" -eq 2 && ${#REPL_COMPLETION_MATCHES[@]} -gt 1 ]]; then
            if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
                echo "[TAB] Double-TAB detected - showing all matches" >&2
            fi

            # Show all completions
            repl_show_completions

            # Don't cycle yet, let user see the list
            return
        fi

        # Regular cycle through matches
        if [[ ${#REPL_COMPLETION_MATCHES[@]} -gt 0 ]]; then
            REPL_COMPLETION_INDEX=$(( (REPL_COMPLETION_INDEX + 1) % ${#REPL_COMPLETION_MATCHES[@]} ))
            local match="${REPL_COMPLETION_MATCHES[$REPL_COMPLETION_INDEX]}"

            if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
                echo "[TAB] New index=$REPL_COMPLETION_INDEX match='$match'" >&2
            fi

            # Use saved word boundaries from first TAB
            # (don't recalculate, as the word has changed since first TAB)
            local saved_start="$REPL_COMPLETION_WORD_START"
            local saved_end="$REPL_COMPLETION_WORD_END"

            REPL_INPUT="${REPL_INPUT:0:$saved_start}${match}${REPL_INPUT:$saved_end}"
            REPL_CURSOR_POS=$((saved_start + ${#match}))

            # Update word_end for next cycle
            REPL_COMPLETION_WORD_END=$((saved_start + ${#match}))
        fi
    fi
}

# Reset completion state (call when any non-TAB key is pressed)
repl_reset_completion() {
    REPL_COMPLETION_ORIGINAL=""
    REPL_COMPLETION_MATCHES=()
    REPL_COMPLETION_INDEX=0
    REPL_COMPLETION_TAB_COUNT=0
    REPL_COMPLETION_WORD_START=""
    REPL_COMPLETION_WORD_END=""
}

# Preview hook - called when selection changes in completion menu
# Set REPL_COMPLETION_PREVIEW_HOOK to a function name to enable live preview
# The function receives: selected_match, verb (from input context)
# Can set REPL_COMPLETION_PREVIEW_TEXT to display preview text in status line
# Example: REPL_COMPLETION_PREVIEW_HOOK="_my_preview_fn"
declare -g REPL_COMPLETION_PREVIEW_HOOK="${REPL_COMPLETION_PREVIEW_HOOK:-}"
declare -g REPL_COMPLETION_PREVIEW_TEXT=""

# Call preview hook if set
_repl_call_preview_hook() {
    local match="$1"
    REPL_COMPLETION_PREVIEW_TEXT=""  # Reset preview text

    if [[ -n "$REPL_COMPLETION_PREVIEW_HOOK" ]]; then
        # Check if function exists (works for both declared and exported functions)
        if type "$REPL_COMPLETION_PREVIEW_HOOK" &>/dev/null; then
            # Extract verb from current input for context
            local verb=""
            if [[ "$REPL_INPUT" =~ ^([a-z]+) ]]; then
                verb="${BASH_REMATCH[1]}"
            fi
            "$REPL_COMPLETION_PREVIEW_HOOK" "$match" "$verb"
        fi
    fi
}

# Interactive completion menu with arrow key navigation
# Returns: selected index (via REPL_COMPLETION_INDEX)
repl_interactive_completion_menu() {
    if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[INTERACTIVE] Entering interactive menu with ${#REPL_COMPLETION_MATCHES[@]} matches" >&2
    fi

    if [[ ${#REPL_COMPLETION_MATCHES[@]} -eq 0 ]]; then
        return
    fi

    local count=${#REPL_COMPLETION_MATCHES[@]}
    local selected=$REPL_COMPLETION_INDEX
    local menu_lines
    local max_menu_lines=0

    # Save terminal state and ensure raw mode for arrow key capture
    local saved_stty
    saved_stty=$(stty -g 2>/dev/null)
    stty -echo -icanon min 1 time 0 2>/dev/null

    # Hide cursor (redirect tput output to stderr)
    tput civis >&2 2>/dev/null || printf '\033[?25l' >&2

    # Get current cursor row to establish scroll region
    # This prevents arrow keys from scrolling the terminal
    local cursor_row=1
    if [[ -t 2 ]]; then
        # Query cursor position using ANSI DSR
        local pos
        printf '\033[6n' >&2
        IFS=';' read -rs -d R -t 1 pos </dev/tty 2>/dev/null
        cursor_row="${pos#*[}"
        cursor_row="${cursor_row:-1}"
    fi

    # Save prompt line position - menu will draw below it
    # The draw function handles newlines internally

    # Call preview hook BEFORE initial draw so preview text is available
    _repl_call_preview_hook "${REPL_COMPLETION_MATCHES[$selected]}"

    # Draw initial menu and get line count
    _repl_draw_completion_menu_and_return_lines "$selected"
    menu_lines=$REPL_MENU_LINES
    max_menu_lines=$menu_lines

    # Interactive navigation loop
    local should_select=0
    while true; do
        local key
        key=$(tcurses_input_read_key_blocking)

        case "$key" in
            "$TCURSES_KEY_UP")
                # Move up - don't advance cursor
                selected=$(( (selected - 1 + count) % count ))
                _repl_call_preview_hook "${REPL_COMPLETION_MATCHES[$selected]}"
                _repl_redraw_completion_menu "$max_menu_lines" "$selected"
                menu_lines=$REPL_MENU_LINES
                if [[ $menu_lines -gt $max_menu_lines ]]; then
                    max_menu_lines=$menu_lines
                fi
                ;;

            "$TCURSES_KEY_DOWN")
                # Move down - don't advance cursor
                selected=$(( (selected + 1) % count ))
                _repl_call_preview_hook "${REPL_COMPLETION_MATCHES[$selected]}"
                _repl_redraw_completion_menu "$max_menu_lines" "$selected"
                menu_lines=$REPL_MENU_LINES
                if [[ $menu_lines -gt $max_menu_lines ]]; then
                    max_menu_lines=$menu_lines
                fi
                ;;

            "$TCURSES_KEY_LEFT")
                # Move left one column (subtract rows)
                local rows=$(( (count + 2) / 3 ))
                local new_idx=$((selected - rows))
                if ((new_idx >= 0)); then
                    selected=$new_idx
                    _repl_call_preview_hook "${REPL_COMPLETION_MATCHES[$selected]}"
                    _repl_redraw_completion_menu "$max_menu_lines" "$selected"
                    menu_lines=$REPL_MENU_LINES
                    if [[ $menu_lines -gt $max_menu_lines ]]; then
                        max_menu_lines=$menu_lines
                    fi
                fi
                ;;

            "$TCURSES_KEY_RIGHT")
                # Move right one column (add rows)
                local rows=$(( (count + 2) / 3 ))
                local new_idx=$((selected + rows))
                if ((new_idx < count)); then
                    selected=$new_idx
                    _repl_call_preview_hook "${REPL_COMPLETION_MATCHES[$selected]}"
                    _repl_redraw_completion_menu "$max_menu_lines" "$selected"
                    menu_lines=$REPL_MENU_LINES
                    if [[ $menu_lines -gt $max_menu_lines ]]; then
                        max_menu_lines=$menu_lines
                    fi
                fi
                ;;

            "$TCURSES_KEY_ENTER"|"")
                # Select current item and apply to input
                REPL_COMPLETION_INDEX=$selected
                should_select=1
                break
                ;;

            "$TCURSES_KEY_ESC"|"$TCURSES_KEY_CTRL_C"|"q"|"Q")
                # Cancel - revert to original input (ESC, Ctrl-C, or 'q')
                should_select=0
                break
                ;;

            "$TCURSES_KEY_TAB")
                # TAB cycles through selections but doesn't advance cursor yet
                selected=$(( (selected + 1) % count ))
                _repl_call_preview_hook "${REPL_COMPLETION_MATCHES[$selected]}"
                _repl_redraw_completion_menu "$max_menu_lines" "$selected"
                menu_lines=$REPL_MENU_LINES
                if [[ $menu_lines -gt $max_menu_lines ]]; then
                    max_menu_lines=$menu_lines
                fi
                ;;

            *)
                # Any other key - exit menu without selection
                should_select=0
                break
                ;;
        esac
    done

    # Clear menu - move up to prompt line and clear below
    # menu_lines to get back to prompt line (menu starts with newline)
    printf '\033[%dA' "$menu_lines" >&2
    printf '\033[J' >&2                        # Clear from cursor to end of screen

    # Show cursor
    tput cnorm >&2 2>/dev/null || printf '\033[?25h' >&2

    # Restore terminal state
    [[ -n "$saved_stty" ]] && stty "$saved_stty" 2>/dev/null

    # Redraw prompt
    if command -v tcurses_readline_redraw >/dev/null 2>&1; then
        tcurses_readline_redraw "${TCURSES_READLINE_PROMPT:-"> "}"
    else
        printf '%s%s' "${TCURSES_READLINE_PROMPT:-"> "}" "$REPL_INPUT" >&2
    fi

    # Apply selection to input if ENTER was pressed
    if [[ $should_select -eq 1 ]]; then
        local match="${REPL_COMPLETION_MATCHES[$selected]}"

        if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
            echo "[APPLY] match='$match'" >&2
            echo "[APPLY] REPL_INPUT before='$REPL_INPUT'" >&2
            echo "[APPLY] word_start=$REPL_COMPLETION_WORD_START word_end=$REPL_COMPLETION_WORD_END" >&2
        fi

        # Add trailing space so TAB can complete next parameter
        REPL_INPUT="${REPL_INPUT:0:$REPL_COMPLETION_WORD_START}${match} ${REPL_INPUT:$REPL_COMPLETION_WORD_END}"
        REPL_CURSOR_POS=$((REPL_COMPLETION_WORD_START + ${#match} + 1))
        REPL_COMPLETION_WORD_END=$((REPL_COMPLETION_WORD_START + ${#match} + 1))

        if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
            echo "[APPLY] REPL_INPUT after='$REPL_INPUT'" >&2
        fi
    fi

    # Reset completion state after menu closes
    repl_reset_completion
}

# Delete N lines starting at row R, following the provided pattern exactly
delete_lines() {
  local R="$1" N="$2"
  local rows=$(tput lines); rows=$((rows-1))     # bottom row index
  tput civis                   # hide cursor (optional)
  tput csr "$R" "$rows"        # restrict scroll region to [R..bottom]
  tput cup "$R" 0              # position at row R, column 0
  # Many tput impls accept a repeat count arg; fallback to loop if not.
  if tput dl "$N" 2>/dev/null; then :; else
    for _ in $(seq 1 "$N"); do tput dl1; done
  fi
  tput csr 0 "$rows"           # restore full scroll region
  tput cvvis                   # restore cursor
  # Cursor is now at row R, column 0 - don't restore, stay here
}

# Wrapper that calculates R from current position
_repl_delete_completion_lines() {
    local N="$1"  # Number of lines to delete

    # We need to get the current cursor row, then subtract N to get R
    # Use ANSI DSR (Device Status Report) to query cursor position
    local oldstty=$(stty -g)
    stty raw -echo min 0 time 5

    printf '\033[6n' >&2
    IFS=';' read -r -d R -a pos

    stty "$oldstty"

    # Parse response: ESC [ row ; col R
    # pos[0] contains ESC[row, pos[1] contains col
    local current_row="${pos[0]#*[}"

    # Convert to 0-based and calculate menu start row
    local R=$((current_row - 1 - N))

    # Call the delete function with the calculated row
    delete_lines "$R" "$N"
}

# Fade out menu with animation - dims and collapses upward
_repl_fade_out_menu() {
    local lines="$1"

    # Brief pause before starting fade
    sleep 0.05

    # Move to start of menu
    printf "\033[%dA" "$lines" >&2

    # Dim the menu by redrawing in darker colors (optional visual effect)
    # For now, just collapse it smoothly by deleting lines from top

    # Delete lines using terminfo - collapse upward
    local rows=$(tput lines 2>/dev/null || echo 24)
    rows=$((rows - 1))

    # Set scroll region and delete the menu lines
    tput sc 2>/dev/null || printf '\033[s' >&2
    tput civis 2>/dev/null || printf '\033[?25l' >&2

    # Get current cursor position (start of menu)
    # We'll delete all menu lines which collapses them upward
    if tput csr 0 "$rows" 2>/dev/null; then
        # Delete the lines
        if tput dl "$lines" 2>/dev/null; then
            :  # Success
        else
            # Fallback: delete one line at a time
            for ((i=0; i<lines; i++)); do
                tput dl1 2>/dev/null || printf '\033[M' >&2
            done
        fi
        tput csr 0 "$rows" 2>/dev/null  # Restore scroll region
    else
        # Fallback: just clear the lines in place
        for ((i=0; i<lines; i++)); do
            printf "\033[2K\n" >&2
        done
        printf "\033[%dA" "$lines" >&2
    fi

    tput rc 2>/dev/null || printf '\033[u' >&2
    tput cnorm 2>/dev/null || printf '\033[?25h' >&2
}

# Clear completion menu
_repl_clear_completion_menu() {
    local lines="$1"

    # Move to start of menu
    tput cuu "$lines" 2>/dev/null || printf "\033[%dA" "$lines" >&2

    # Clear from cursor down
    tput ed 2>/dev/null || printf '\033[J' >&2
}

# Draw completion menu (helper function) - for backward compatibility
_repl_draw_completion_menu() {
    local selected="$1"
    _repl_draw_completion_menu_and_return_lines "$selected" >/dev/null
}

# Draw completion menu and return line count
_repl_draw_completion_menu_and_return_lines() {
    local selected="$1"
    local count=${#REPL_COMPLETION_MATCHES[@]}

    # Get hint for selected item to show in status line
    local selected_match="${REPL_COMPLETION_MATCHES[$selected]}"
    local hint=""
    ( hint="${REPL_COMPLETION_HINTS[$selected_match]:-}" ) 2>/dev/null && :

    # Print newline
    echo "" >&2

    # Status line: selected item, hint, and minimal nav help
    local hint_text=""
    if [[ -n "$hint" ]]; then
        if [[ "$hint" =~ ^([^•]+)•(.+)$ ]]; then
            hint_text="${BASH_REMATCH[2]}"
        else
            hint_text="$hint"
        fi
    fi

    # Format: "  selected: hint [preview]" left-aligned, "(← → ↑ ↓ | ESC)" right-aligned to col 60
    local nav_hint="(← → ↑ ↓ | ESC)"
    local nav_len=${#nav_hint}

    # Build status line with optional preview text
    printf "  \033[1m%s\033[0m" "$selected_match" >&2
    if [[ -n "$hint_text" ]]; then
        printf "\033[2m: %s\033[0m" "$hint_text" >&2
    fi

    # Show preview text if set (e.g., color swatches)
    if [[ -n "$REPL_COMPLETION_PREVIEW_TEXT" ]]; then
        printf " %b" "$REPL_COMPLETION_PREVIEW_TEXT" >&2
    fi

    # Calculate padding for right-aligned nav hint
    # Note: We approximate since preview text may contain ANSI codes
    local visible_len=$((4 + ${#selected_match} + ${#hint_text}))
    [[ -n "$hint_text" ]] && visible_len=$((visible_len + 2))  # ": "
    local pad_len=$((60 - nav_len - visible_len))
    ((pad_len < 2)) && pad_len=2
    local padding=$(printf '%*s' "$pad_len" '')

    printf "%s\033[2m%s\033[0m\n" "$padding" "$nav_hint" >&2
    echo "" >&2

    # Draw list items in 3-column layout
    local cols=3
    local rows=$(( (count + cols - 1) / cols ))

    for ((row=0; row<rows; row++)); do
        for ((col=0; col<cols; col++)); do
            local idx=$((row + col * rows))
            if [[ $idx -lt $count ]]; then
                local match="${REPL_COMPLETION_MATCHES[$idx]}"
                # Safely access associative array - suppress errors if array doesn't exist
                # or has issues with special characters (bash export -f limitation)
                local category=""
                ( category="${REPL_COMPLETION_CATEGORIES[$match]:-}" ) 2>/dev/null && :
                local color=$(_repl_get_category_color "$category")

                if [[ $idx -eq $selected ]]; then
                    # Highlighted item with category color
                    printf "  \033[1;36m▶\033[0m \033[1;${color}m%-18s\033[0m" "$match" >&2
                else
                    # Regular item with dimmed category color
                    printf "    \033[2;${color}m%-18s\033[0m" "$match" >&2
                fi
            fi
        done
        echo "" >&2
    done

    echo "" >&2

    # Calculate total lines: blank(1) + status_line(1) + blank(1) + rows + blank(1)
    local total_lines=$((4 + rows))

    # Debug output if enabled
    if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[MENU] Calculated total_lines=$total_lines (rows=$rows, hint='$hint')" >&2
    fi

    # Store line count in global variable instead of echoing
    # This avoids stdout/stderr mixing issues
    REPL_MENU_LINES=$total_lines
}

# Redraw completion menu after cursor movement
_repl_redraw_completion_menu() {
    local old_lines="$1"
    local selected="$2"

    if [[ "${TCURSES_COMPLETION_DEBUG:-0}" == "1" ]]; then
        echo "[REDRAW] Moving up $old_lines lines and clearing" >&2
    fi

    # Move cursor up: old_lines (menu) to get back to prompt line
    # The menu starts with a newline, so cursor ends up old_lines below prompt
    printf "\033[%dA" "$old_lines" >&2

    # Clear from cursor to end of screen
    printf "\033[J" >&2

    # Redraw prompt first
    if command -v tcurses_readline_redraw >/dev/null 2>&1; then
        tcurses_readline_redraw "${TCURSES_READLINE_PROMPT:-"> "}"
    else
        printf '%s%s' "${TCURSES_READLINE_PROMPT:-"> "}" "$REPL_INPUT" >&2
    fi

    # Redraw menu (line count stored in REPL_MENU_LINES)
    _repl_draw_completion_menu_and_return_lines "$selected"
}

# Show completion popup (non-interactive fallback)
repl_show_completions() {
    if [[ ${#REPL_COMPLETION_MATCHES[@]} -eq 0 ]]; then
        return
    fi

    # Use interactive menu if tcurses_input is available
    if command -v tcurses_input_read_key_blocking >/dev/null 2>&1; then
        repl_interactive_completion_menu
    else
        # Fallback to static list
        _repl_draw_completion_menu "$REPL_COMPLETION_INDEX" >/dev/null
    fi
}

# Export functions
export -f repl_set_completion_menu_position
export -f repl_set_completion_hint
export -f repl_get_completion_hint
export -f repl_set_completion_category
export -f repl_get_completion_category
export -f _repl_get_category_color
export -f repl_register_completion_words
export -f repl_load_completion_words
export -f repl_set_completion_generator
export -f _repl_generate_completion_words
export -f _repl_get_current_word
export -f _repl_find_completions
export -f repl_handle_tab
export -f repl_reset_completion
export -f repl_show_completions
export -f repl_interactive_completion_menu
export -f _repl_draw_completion_menu
export -f _repl_draw_completion_menu_and_return_lines
export -f _repl_redraw_completion_menu
export -f _repl_clear_completion_menu
export -f _repl_delete_completion_lines
export -f _repl_fade_out_menu
