#!/usr/bin/env bash
# TCurses Key-Chord Library
# Full chord system with modifier support for extensible key bindings
# Extends tcurses_input.sh with chord registry and multi-key sequences

# Source tcurses_input for base key constants
TCURSES_DIR="${TCURSES_DIR:-$(dirname "${BASH_SOURCE[0]}")}"
source "$TCURSES_DIR/tcurses_input.sh" 2>/dev/null || true

# ============================================================================
# CHORD REGISTRY
# ============================================================================

# Chord to action mapping
declare -gA KEYCHORD_MAP=()

# Register a chord → action binding
keychord_register() {
    local chord="$1"
    local action="$2"
    KEYCHORD_MAP["$chord"]="$action"
}

# Get action for chord
keychord_get_action() {
    local chord="$1"
    echo "${KEYCHORD_MAP[$chord]:-}"
}

# ============================================================================
# ESCAPE SEQUENCE DETECTION
# ============================================================================

# Common escape sequences by terminal type
declare -gA KEYCHORD_SEQUENCES=(
    # Ctrl-Tab (various terminals)
    [$'\x1b[1;5I']="ctrl-tab"           # xterm, most modern
    [$'\x1b[27;5;9~']="ctrl-tab"        # rxvt
    [$'\x1b\x09']="ctrl-tab"            # some terminals

    # Shift-Ctrl-Tab
    [$'\x1b[1;6I']="shift-ctrl-tab"     # xterm
    [$'\x1b[27;6;9~']="shift-ctrl-tab"  # rxvt
    [$'\x1b[Z']="shift-tab"             # Standard shift-tab

    # Ctrl-h (example for extensibility)
    [$'\x08']="ctrl-h"

    # Ctrl-/ (search)
    [$'\x1f']="ctrl-slash"

    # Alt combinations
    [$'\x1ba']="alt-a"
    [$'\x1bb']="alt-b"

    # Function keys with modifiers
    [$'\x1b[1;5P']="ctrl-f1"
    [$'\x1b[1;5Q']="ctrl-f2"
)

# ============================================================================
# CHORD READING
# ============================================================================

# Read a single key with chord detection
# Returns: chord name or empty string
keychord_read() {
    local timeout="${1:-0.1}"  # Timeout for multi-byte sequences

    # Read first byte
    local key=""
    read -rsn1 -t "$timeout" key 2>/dev/null || return 1

    # Check if it's start of escape sequence
    if [[ "$key" == $'\x1b' ]]; then
        # Read additional bytes for escape sequence
        local seq="$key"
        local byte=""

        # Try to read up to 10 more bytes with short timeout
        for i in {1..10}; do
            if read -rsn1 -t 0.01 byte 2>/dev/null; then
                seq+="$byte"

                # Check if we have a complete sequence
                if [[ -n "${KEYCHORD_SEQUENCES[$seq]}" ]]; then
                    echo "${KEYCHORD_SEQUENCES[$seq]}"
                    return 0
                fi
            else
                break
            fi
        done

        # Check final sequence
        if [[ -n "${KEYCHORD_SEQUENCES[$seq]}" ]]; then
            echo "${KEYCHORD_SEQUENCES[$seq]}"
            return 0
        fi

        # Return the escape sequence for caller to handle
        echo "$seq"
        return 0
    fi

    # Single byte - check for control characters
    if [[ -n "${KEYCHORD_SEQUENCES[$key]}" ]]; then
        echo "${KEYCHORD_SEQUENCES[$key]}"
        return 0
    fi

    # Return the literal key
    echo "$key"
    return 0
}

# ============================================================================
# MODIFIER DETECTION
# ============================================================================

# Parse modifier keys from escape sequence
# Returns: "ctrl", "alt", "shift", "ctrl-shift", etc.
keychord_parse_modifiers() {
    local seq="$1"
    local modifiers=""

    # Check for Ctrl (usually 5 in escape sequence)
    if [[ "$seq" =~ \;5 ]]; then
        modifiers+="ctrl-"
    fi

    # Check for Shift (usually 2 or 6)
    if [[ "$seq" =~ \;[26] ]]; then
        modifiers+="shift-"
    fi

    # Check for Alt (usually 3 or preceded by ESC)
    if [[ "$seq" =~ \;3 ]] || [[ "$seq" =~ ^\x1b[a-z] ]]; then
        modifiers+="alt-"
    fi

    # Remove trailing dash
    echo "${modifiers%-}"
}

# ============================================================================
# CHORD SEQUENCES
# ============================================================================

# Support for multi-key sequences (like Emacs C-x C-s)
declare -g KEYCHORD_SEQUENCE_BUFFER=""
declare -g KEYCHORD_SEQUENCE_TIMEOUT=1.0

# Add key to sequence buffer
keychord_sequence_add() {
    local key="$1"

    if [[ -n "$KEYCHORD_SEQUENCE_BUFFER" ]]; then
        KEYCHORD_SEQUENCE_BUFFER+=" $key"
    else
        KEYCHORD_SEQUENCE_BUFFER="$key"
    fi
}

# Check if sequence is complete
keychord_sequence_check() {
    local action=$(keychord_get_action "$KEYCHORD_SEQUENCE_BUFFER")

    if [[ -n "$action" ]]; then
        KEYCHORD_SEQUENCE_BUFFER=""
        echo "$action"
        return 0
    fi

    return 1
}

# Clear sequence buffer
keychord_sequence_clear() {
    KEYCHORD_SEQUENCE_BUFFER=""
}

# ============================================================================
# HIGH-LEVEL API
# ============================================================================

# Read and execute a chord
keychord_read_and_execute() {
    local chord=$(keychord_read)
    [[ -z "$chord" ]] && return 1

    local action=$(keychord_get_action "$chord")

    if [[ -n "$action" ]]; then
        # Execute the action function
        if declare -f "$action" >/dev/null 2>&1; then
            "$action"
            return $?
        else
            echo "Warning: Action function not found: $action" >&2
            return 1
        fi
    fi

    # Return the chord for caller to handle
    echo "$chord"
    return 0
}

# Check if chord is registered
keychord_is_registered() {
    local chord="$1"
    [[ -n "${KEYCHORD_MAP[$chord]}" ]]
}

# List all registered chords
keychord_list() {
    local format="${1:-simple}"  # simple, detailed, help

    case "$format" in
        simple)
            for chord in "${!KEYCHORD_MAP[@]}"; do
                echo "$chord"
            done | sort
            ;;
        detailed)
            for chord in "${!KEYCHORD_MAP[@]}"; do
                printf "%-20s → %s\n" "$chord" "${KEYCHORD_MAP[$chord]}"
            done | sort
            ;;
        help)
            echo "Registered Key Chords:"
            echo
            for chord in "${!KEYCHORD_MAP[@]}"; do
                local action="${KEYCHORD_MAP[$chord]}"
                printf "  %-20s %s\n" "$chord" "$action"
            done | sort
            ;;
    esac
}

# ============================================================================
# TERMINAL DETECTION
# ============================================================================

# Detect terminal capabilities
keychord_detect_terminal() {
    local term_type="${TERM:-unknown}"
    local ssh_tty="${SSH_TTY:-}"

    # Check for known terminal types
    case "$term_type" in
        xterm*|rxvt*|screen*|tmux*)
            echo "modern"
            ;;
        linux|vt100|vt220)
            echo "basic"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Test if Ctrl-Tab works in current terminal
keychord_test_ctrl_tab() {
    echo "Press Ctrl-Tab (or q to skip): "
    local chord=$(keychord_read 5.0)

    case "$chord" in
        "ctrl-tab"|"shift-ctrl-tab")
            echo "✓ Ctrl-Tab detected: $chord"
            return 0
            ;;
        "q"|"Q")
            echo "⁘ Skipped"
            return 1
            ;;
        *)
            echo "⁘ Received: $chord (Ctrl-Tab may not work in this terminal)"
            return 1
            ;;
    esac
}

# ============================================================================
# INITIALIZATION
# ============================================================================

# Initialize default chords
keychord_init() {
    # Clear existing mappings
    KEYCHORD_MAP=()

    # Register default chords (these can be overridden)
    keychord_register "ctrl-tab" "keychord_action_next"
    keychord_register "shift-ctrl-tab" "keychord_action_prev"
    keychord_register "ctrl-h" "keychord_action_help"
    keychord_register "ctrl-slash" "keychord_action_search"
}

# Default action stubs (override these)
keychord_action_next() {
    echo "Next (Ctrl-Tab pressed)"
}

keychord_action_prev() {
    echo "Previous (Shift-Ctrl-Tab pressed)"
}

keychord_action_help() {
    echo "Help (Ctrl-h pressed)"
}

keychord_action_search() {
    echo "Search (Ctrl-/ pressed)"
}

# ============================================================================
# EXPORT
# ============================================================================

export -f keychord_register
export -f keychord_get_action
export -f keychord_read
export -f keychord_parse_modifiers
export -f keychord_sequence_add
export -f keychord_sequence_check
export -f keychord_sequence_clear
export -f keychord_read_and_execute
export -f keychord_is_registered
export -f keychord_list
export -f keychord_detect_terminal
export -f keychord_test_ctrl_tab
export -f keychord_init

# Auto-initialize
keychord_init
