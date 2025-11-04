#!/usr/bin/env bash
# TDS Theme Stack
# Manages hierarchical theme switching: System → Module → restore
# Allows module REPLs to temporarily override system theme

# Theme stack state
declare -ga TDS_THEME_STACK=()
declare -g TDS_SYSTEM_THEME="default"

# ============================================================================
# THEME STACK OPERATIONS
# ============================================================================

# Push current theme onto stack and switch to new theme
# Args: new_theme_name, context_label
# Returns: 0 on success, 1 on failure
tds_push_theme() {
    local new_theme="$1"
    local context="${2:-unnamed}"

    # Save current theme to stack
    local current_theme="${TDS_ACTIVE_THEME:-default}"
    TDS_THEME_STACK+=("$current_theme:$context")

    # Switch to new theme
    if ! TDS_QUIET_LOAD=1 tds_switch_theme "$new_theme" 2>/dev/null; then
        echo "ERROR: Failed to push theme '$new_theme'" >&2
        # Pop the item we just added since switch failed
        unset 'TDS_THEME_STACK[-1]'
        return 1
    fi

    return 0
}

# Pop theme from stack and restore it
# Returns: 0 on success, 1 if stack empty
tds_pop_theme() {
    # Check if stack is empty
    if [[ ${#TDS_THEME_STACK[@]} -eq 0 ]]; then
        echo "WARNING: Theme stack is empty, cannot pop" >&2
        return 1
    fi

    # Get last item from stack
    local stack_item="${TDS_THEME_STACK[-1]}"
    local theme_name="${stack_item%%:*}"

    # Remove from stack
    unset 'TDS_THEME_STACK[-1]'

    # Restore theme
    if ! TDS_QUIET_LOAD=1 tds_switch_theme "$theme_name" 2>/dev/null; then
        echo "ERROR: Failed to restore theme '$theme_name'" >&2
        return 1
    fi

    return 0
}

# Peek at stack without popping
# Returns: theme_name:context of top of stack
tds_peek_theme() {
    if [[ ${#TDS_THEME_STACK[@]} -eq 0 ]]; then
        echo "none"
        return 1
    fi

    echo "${TDS_THEME_STACK[-1]}"
    return 0
}

# Show theme stack
tds_show_theme_stack() {
    echo "TDS Theme Stack"
    echo "==============="
    echo "Active: $TDS_ACTIVE_THEME"
    echo "System: $TDS_SYSTEM_THEME"
    echo
    echo "Stack (newest first):"

    if [[ ${#TDS_THEME_STACK[@]} -eq 0 ]]; then
        echo "  (empty)"
        return 0
    fi

    local idx=${#TDS_THEME_STACK[@]}
    for ((i=${#TDS_THEME_STACK[@]}-1; i>=0; i--)); do
        local item="${TDS_THEME_STACK[$i]}"
        local theme="${item%%:*}"
        local context="${item#*:}"
        printf "  [%d] %s (%s)\n" "$idx" "$theme" "$context"
        ((idx--))
    done
}

# Clear stack and restore system theme
tds_reset_to_system_theme() {
    TDS_THEME_STACK=()
    TDS_QUIET_LOAD=1 tds_switch_theme "$TDS_SYSTEM_THEME" 2>/dev/null
}

# ============================================================================
# SYSTEM THEME MANAGEMENT
# ============================================================================

# Set the system-level theme (used by TUI, CLI, etc.)
# Args: theme_name
tds_set_system_theme() {
    local theme="$1"

    if ! TDS_QUIET_LOAD=1 tds_switch_theme "$theme" 2>/dev/null; then
        echo "ERROR: Failed to set system theme '$theme'" >&2
        return 1
    fi

    TDS_SYSTEM_THEME="$theme"
    export TDS_SYSTEM_THEME

    return 0
}

# Get current system theme
tds_get_system_theme() {
    echo "$TDS_SYSTEM_THEME"
}

# ============================================================================
# MODULE REPL INTEGRATION
# ============================================================================

# Enter module REPL with temperature theme
# This is the proper way for REPLs to switch themes
# Args: module_name, temperature_theme
repl_enter_with_temperature() {
    local module="$1"
    local temperature="$2"

    # Validate temperature theme exists
    if [[ -z "${TDS_THEME_REGISTRY[$temperature]}" ]]; then
        echo "WARNING: Temperature theme '$temperature' not found, using system theme" >&2
        return 1
    fi

    # Push system theme and switch to temperature
    tds_push_theme "$temperature" "module:$module" || {
        echo "ERROR: Failed to enter module REPL with temperature '$temperature'" >&2
        return 1
    }

    return 0
}

# Exit module REPL and restore previous theme
# This pops the theme stack
repl_exit_restore_theme() {
    tds_pop_theme || {
        echo "WARNING: Failed to restore theme, falling back to system theme" >&2
        tds_reset_to_system_theme
        return 1
    }

    return 0
}

# ============================================================================
# INITIALIZATION
# ============================================================================

# Initialize theme stack system
tds_init_theme_stack() {
    # Set system theme from environment or default
    TDS_SYSTEM_THEME="${TDS_SYSTEM_THEME:-${TDS_ACTIVE_THEME:-default}}"
    export TDS_SYSTEM_THEME

    # Ensure we start with empty stack
    TDS_THEME_STACK=()
}

# ============================================================================
# EXPORT
# ============================================================================

export -f tds_push_theme
export -f tds_pop_theme
export -f tds_peek_theme
export -f tds_show_theme_stack
export -f tds_reset_to_system_theme
export -f tds_set_system_theme
export -f tds_get_system_theme
export -f repl_enter_with_temperature
export -f repl_exit_restore_theme
export -f tds_init_theme_stack

# Auto-initialize
tds_init_theme_stack
