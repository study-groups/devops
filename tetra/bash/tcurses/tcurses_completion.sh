#!/usr/bin/env bash
# TCurses TAB Completion
# Provides TAB completion for TUI REPLs

# Completion state
declare -g REPL_COMPLETION_WORDS=()
declare -g REPL_COMPLETION_MATCHES=()
declare -g REPL_COMPLETION_INDEX=0
declare -g REPL_COMPLETION_ORIGINAL=""

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
    # Get current word
    local word_info="$(_repl_get_current_word)"
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    # First TAB - find completions
    if [[ -z "$REPL_COMPLETION_ORIGINAL" ]]; then
        REPL_COMPLETION_ORIGINAL="$current_word"
        _repl_find_completions "$current_word"
        REPL_COMPLETION_INDEX=0

        if [[ ${#REPL_COMPLETION_MATCHES[@]} -eq 0 ]]; then
            # No matches - beep or do nothing
            return
        elif [[ ${#REPL_COMPLETION_MATCHES[@]} -eq 1 ]]; then
            # Single match - complete it
            local match="${REPL_COMPLETION_MATCHES[0]}"
            REPL_INPUT="${REPL_INPUT:0:$word_start}${match}${REPL_INPUT:$word_end}"
            REPL_CURSOR_POS=$((word_start + ${#match}))
            REPL_COMPLETION_ORIGINAL=""
            return
        fi

        # Multiple matches - show first one
        local match="${REPL_COMPLETION_MATCHES[$REPL_COMPLETION_INDEX]}"
        REPL_INPUT="${REPL_INPUT:0:$word_start}${match}${REPL_INPUT:$word_end}"
        REPL_CURSOR_POS=$((word_start + ${#match}))

    else
        # Subsequent TAB - cycle through matches
        if [[ ${#REPL_COMPLETION_MATCHES[@]} -gt 0 ]]; then
            REPL_COMPLETION_INDEX=$(( (REPL_COMPLETION_INDEX + 1) % ${#REPL_COMPLETION_MATCHES[@]} ))
            local match="${REPL_COMPLETION_MATCHES[$REPL_COMPLETION_INDEX]}"

            # Get word boundaries again
            word_info="$(_repl_get_current_word)"
            IFS='|' read -r word_start word_end current_word <<< "$word_info"

            REPL_INPUT="${REPL_INPUT:0:$word_start}${match}${REPL_INPUT:$word_end}"
            REPL_CURSOR_POS=$((word_start + ${#match}))
        fi
    fi
}

# Reset completion state (call when any non-TAB key is pressed)
repl_reset_completion() {
    REPL_COMPLETION_ORIGINAL=""
    REPL_COMPLETION_MATCHES=()
    REPL_COMPLETION_INDEX=0
}

# Show completion popup (optional - for showing all matches)
repl_show_completions() {
    if [[ ${#REPL_COMPLETION_MATCHES[@]} -eq 0 ]]; then
        return
    fi

    # Build completion display
    local display=""
    for ((i=0; i<${#REPL_COMPLETION_MATCHES[@]}; i++)); do
        local match="${REPL_COMPLETION_MATCHES[$i]}"
        if [[ $i -eq $REPL_COMPLETION_INDEX ]]; then
            display+="  > $match\n"
        else
            display+="    $match\n"
        fi
    done

    # Set as response (will be displayed above input)
    repl_set_response "$display"
}

# Export functions
export -f repl_register_completion_words
export -f repl_load_completion_words
export -f repl_set_completion_generator
export -f _repl_generate_completion_words
export -f _repl_get_current_word
export -f _repl_find_completions
export -f repl_handle_tab
export -f repl_reset_completion
export -f repl_show_completions
