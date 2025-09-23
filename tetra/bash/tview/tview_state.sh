#!/usr/bin/env bash

# TView State Management - Comprehensive state tracking for cursor, page, and mode context
# Single responsibility: Centralized state management and mode-aware key handling

# Global comprehensive state tracking
declare -gA TVIEW_STATE=(
    # Cursor and selection state
    ["cursor_row"]=0
    ["cursor_col"]=0
    ["selected_item"]=0
    ["max_items"]=0

    # Page and scroll state
    ["page_offset"]=0
    ["visible_lines"]=0
    ["total_lines"]=0
    ["scroll_position"]=0

    # Navigation history
    ["previous_mode"]=""
    ["previous_env"]=""
    ["mode_history"]=""
    ["navigation_depth"]=0

    # Input state
    ["last_key"]=""
    ["key_sequence"]=""
    ["repeat_count"]=0

    # Display state
    ["terminal_width"]=80
    ["terminal_height"]=24
    ["header_lines"]=3
    ["footer_lines"]=1
    ["content_lines"]=20

    # Modal and interaction state
    ["modal_active"]="false"
    ["edit_mode"]="false"
    ["edit_buffer"]=""
    ["edit_field"]=""

    # Mode-specific state
    ["rcm_current_env"]="dev_root"
    ["rcm_edit_mode"]="false"
    ["rcm_selected_command"]=""
)

# Mode-specific key mappings with descriptions
declare -gA RCM_KEYMAP=(
    ["enter"]="Execute selected command"
    ["space"]="Toggle result expansion"
    ["e"]="Edit SSH prefix for current environment"
    ["t"]="Test SSH connectivity"
    ["r"]="Retry/refresh command execution"
    ["c"]="Cancel running command"
    ["u"]="Undo SSH prefix changes"
    ["s"]="Save SSH prefix changes"
    ["i"]="Navigate up in command list"
    ["k"]="Navigate down in command list"
    ["l"]="Drill into command details"
    ["j"]="Back to overview"
    ["L"]="Show contextual hints"
    ["h"]="Show this help"
)

declare -gA TOML_KEYMAP=(
    ["enter"]="Show detailed view"
    ["v"]="View with syntax highlighting"
    ["l"]="Drill into section details"
    ["r"]="Refresh TOML data"
    ["g"]="Git operations"
    ["i"]="Navigate up"
    ["k"]="Navigate down"
    ["j"]="Back to overview"
    ["L"]="Show contextual hints"
    ["h"]="Show this help"
)

declare -gA TKM_KEYMAP=(
    ["enter"]="Connect/manage keys"
    ["t"]="Test SSH connection"
    ["l"]="Drill into key details"
    ["g"]="Generate new key"
    ["r"]="Refresh key status"
    ["i"]="Navigate up"
    ["k"]="Navigate down"
    ["j"]="Back to overview"
    ["L"]="Show contextual hints"
    ["h"]="Show this help"
)

declare -gA TSM_KEYMAP=(
    ["enter"]="Manage service"
    ["t"]="Execute TSM command"
    ["l"]="Drill into service details"
    ["r"]="Refresh service status"
    ["i"]="Navigate up"
    ["k"]="Navigate down"
    ["j"]="Back to overview"
    ["L"]="Show contextual hints"
    ["h"]="Show this help"
)

declare -gA GLOBAL_KEYMAP=(
    ["e"]="Cycle environments (SYSTEM→LOCAL→DEV→STAGING→PROD→QA)"
    ["m"]="Cycle modes (TOML→TKM→TSM→DEPLOY→ORG→RCM)"
    ["w"]="Context-aware up navigation"
    ["a"]="Context-aware left navigation"
    ["s"]="Context-aware down navigation"
    ["d"]="Context-aware right navigation"
    ["ESC"]="Return to navigation mode"
    ["/"]="Enter REPL mode"
    ["q"]="Quit TView"
    ["h"]="Show help"
    ["L"]="Show contextual hints"
)

# Update terminal dimensions
update_terminal_dimensions() {
    TVIEW_STATE["terminal_width"]=${COLUMNS:-80}
    TVIEW_STATE["terminal_height"]=${LINES:-24}
    TVIEW_STATE["content_lines"]=$((${TVIEW_STATE[terminal_height]} - ${TVIEW_STATE[header_lines]} - ${TVIEW_STATE[footer_lines]}))
}

# Update cursor state
update_cursor_state() {
    local row="$1"
    local col="$2"
    TVIEW_STATE["cursor_row"]="$row"
    TVIEW_STATE["cursor_col"]="$col"
}

# Update selection state
update_selection_state() {
    local selected_item="$1"
    local max_items="$2"
    TVIEW_STATE["selected_item"]="$selected_item"
    TVIEW_STATE["max_items"]="$max_items"
}

# Track navigation history
push_navigation_state() {
    local current_state="${CURRENT_MODE}:${CURRENT_ENV}:${CURRENT_ITEM}"
    local history="${TVIEW_STATE[mode_history]}"

    if [[ -n "$history" ]]; then
        TVIEW_STATE["mode_history"]="$history|$current_state"
    else
        TVIEW_STATE["mode_history"]="$current_state"
    fi

    TVIEW_STATE["navigation_depth"]=$((${TVIEW_STATE[navigation_depth]} + 1))
}

# Navigate back in history
pop_navigation_state() {
    local history="${TVIEW_STATE[mode_history]}"
    if [[ -n "$history" ]]; then
        # Get last state
        local last_state="${history##*|}"

        # Remove last state from history
        if [[ "$history" == *"|"* ]]; then
            TVIEW_STATE["mode_history"]="${history%|*}"
        else
            TVIEW_STATE["mode_history"]=""
        fi

        # Parse and restore state
        IFS=':' read -r mode env item <<< "$last_state"
        CURRENT_MODE="$mode"
        CURRENT_ENV="$env"
        CURRENT_ITEM="$item"

        TVIEW_STATE["navigation_depth"]=$((${TVIEW_STATE[navigation_depth]} - 1))
        return 0
    fi
    return 1
}

# Get current mode keymap
get_current_keymap() {
    local keymap_name="${CURRENT_MODE}_KEYMAP[@]"
    case "$CURRENT_MODE" in
        "RCM") declare -n keymap_ref=RCM_KEYMAP ;;
        "TOML") declare -n keymap_ref=TOML_KEYMAP ;;
        "TKM") declare -n keymap_ref=TKM_KEYMAP ;;
        "TSM") declare -n keymap_ref=TSM_KEYMAP ;;
        *) declare -n keymap_ref=GLOBAL_KEYMAP ;;
    esac

    for key in "${!keymap_ref[@]}"; do
        printf "%-8s %s\n" "$key" "${keymap_ref[$key]}"
    done
}

# Generate keymap help content
generate_keymap_help() {
    local mode="$1"
    local help_content=""

    help_content+="=== $mode MODE KEYS ===\n\n"

    # Mode-specific keys
    case "$mode" in
        "RCM")
            for key in "${!RCM_KEYMAP[@]}"; do
                help_content+="$(printf '%-8s %s\n' "$key" "${RCM_KEYMAP[$key]}")"
            done
            ;;
        "TOML")
            for key in "${!TOML_KEYMAP[@]}"; do
                help_content+="$(printf '%-8s %s\n' "$key" "${TOML_KEYMAP[$key]}")"
            done
            ;;
        "TKM")
            for key in "${!TKM_KEYMAP[@]}"; do
                help_content+="$(printf '%-8s %s\n' "$key" "${TKM_KEYMAP[$key]}")"
            done
            ;;
        "TSM")
            for key in "${!TSM_KEYMAP[@]}"; do
                help_content+="$(printf '%-8s %s\n' "$key" "${TSM_KEYMAP[$key]}")"
            done
            ;;
    esac

    help_content+="\n=== GLOBAL NAVIGATION ===\n\n"
    for key in "${!GLOBAL_KEYMAP[@]}"; do
        help_content+="$(printf '%-8s %s\n' "$key" "${GLOBAL_KEYMAP[$key]}")"
    done

    echo -e "$help_content"
}

# Update input state
update_input_state() {
    local key="$1"
    TVIEW_STATE["last_key"]="$key"

    # Build key sequence for potential chord detection
    local sequence="${TVIEW_STATE[key_sequence]}"
    if [[ ${#sequence} -gt 10 ]]; then
        # Truncate old sequence
        sequence="${sequence: -5}"
    fi
    TVIEW_STATE["key_sequence"]="$sequence$key"
}

# Check for key chords/sequences
check_key_sequence() {
    local sequence="${TVIEW_STATE[key_sequence]}"
    local last_chars="${sequence: -2}"

    case "$last_chars" in
        "gg") echo "goto_top" ;;
        "GG") echo "goto_bottom" ;;
        "dd") echo "delete_item" ;;
        "yy") echo "copy_item" ;;
        *) echo "none" ;;
    esac
}

# Get state summary for debugging
get_state_summary() {
    cat << EOF
=== TVIEW STATE SUMMARY ===
Mode: $CURRENT_MODE | Env: $CURRENT_ENV | Item: $CURRENT_ITEM
Terminal: ${TVIEW_STATE[terminal_width]}x${TVIEW_STATE[terminal_height]}
Selection: ${TVIEW_STATE[selected_item]}/${TVIEW_STATE[max_items]}
Navigation Depth: ${TVIEW_STATE[navigation_depth]}
Last Key: ${TVIEW_STATE[last_key]}
Modal Active: ${TVIEW_STATE[modal_active]}
Edit Mode: ${TVIEW_STATE[edit_mode]}
EOF
}

# Initialize state system
init_state_system() {
    update_terminal_dimensions
    TVIEW_STATE["mode_history"]=""
    TVIEW_STATE["navigation_depth"]=0
}