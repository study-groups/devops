#!/usr/bin/env bash
# Test REPL - Simple demonstration of bash/repl library

# Ensure TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    TETRA_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    export TETRA_SRC
fi

# Source REPL library
source "$TETRA_SRC/bash/repl/repl.sh"

# Disable action dispatcher for this test
REPL_DISABLE_ACTION_DISPATCH=1

# Test state
TEST_STATE="ready"
TEST_COUNTER=0
TEST_SELECTED_FILE=""

# Prompt builders
test_prompt_state() {
    local color
    case "$TEST_STATE" in
        ready)   color=$(env_color 2) ;;
        working) color=$(verbs_color 2) ;;
        done)    color=$(env_color 0) ;;
    esac

    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        printf "%b[%s]%b " "$color" "$TEST_STATE" "$(reset_color)"
    else
        printf "[%s] " "$TEST_STATE"
    fi
}

test_prompt_counter() {
    if [[ $TEST_COUNTER -gt 0 ]]; then
        if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
            printf "%b(%d)%b " "$(mode_color 1)" "$TEST_COUNTER" "$(reset_color)"
        else
            printf "(%d) " "$TEST_COUNTER"
        fi
    fi
}

test_prompt_base() {
    local exec_mode=$(repl_prompt_mode)
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        printf "%b%s>%b " "$(mode_color 0)" "$exec_mode" "$(reset_color)"
    else
        printf "%s> " "$exec_mode"
    fi
}

# Slash commands
test_cmd_start() {
    TEST_STATE="working"
    echo "Started working..."
    return 2  # Signal prompt rebuild
}

test_cmd_finish() {
    TEST_STATE="done"
    echo "Finished!"
    return 2  # Signal prompt rebuild
}

test_cmd_reset() {
    TEST_STATE="ready"
    TEST_COUNTER=0
    echo "Reset to initial state"
    return 2  # Signal prompt rebuild
}

test_cmd_count() {
    ((TEST_COUNTER++))
    echo "Counter incremented to $TEST_COUNTER"
    return 2  # Signal prompt rebuild
}

test_cmd_status() {
    echo "Test REPL Status"
    echo "================"
    echo "State: $TEST_STATE"
    echo "Counter: $TEST_COUNTER"
    echo "Selected File: ${TEST_SELECTED_FILE:-none}"
    echo "Execution Mode: $(repl_get_execution_mode)"
    echo "Input Mode: $REPL_MODE"
    echo "History: $REPL_HISTORY_FILE"
    echo "Color: ${COLOR_ENABLED:-0}"
    echo ""
    echo "Available commands:"
    echo "  /start   - Change state to 'working'"
    echo "  /finish  - Change state to 'done'"
    echo "  /reset   - Reset to initial state"
    echo "  /count   - Increment counter"
    echo "  /mode    - Switch execution mode"
    echo "  /status  - Show this status"
    echo "  /theme   - Change color theme"
    echo "  /help    - Show help"
    echo "  /exit    - Exit REPL"
    echo ""
    echo "Symbol handlers:"
    echo "  @file    - Select file (shows in prompt)"
    echo "  ::range  - Parse range notation"
    echo "  #tag     - Process tag"
}

# Register prompt builders
repl_register_prompt_builder "state" "test_prompt_state"
repl_register_prompt_builder "counter" "test_prompt_counter"
repl_register_prompt_builder "base" "test_prompt_base"

# Symbol handlers
test_symbol_at() {
    local token="$1"
    local type="$2"

    # Simple file selector - in real use, this would call fzf
    echo "[@symbol detected: $token]" >&2

    # Store selected file
    TEST_SELECTED_FILE="$token"

    # Return resolved value (empty string means "no command, just info")
    echo ""
}

test_symbol_range() {
    local token="$1"
    local type="$2"

    echo "[::range detected: $token]" >&2
    # Return empty - this is informational only
    echo ""
}

test_symbol_tag() {
    local token="$1"
    local type="$2"

    echo "[#tag detected: $token]" >&2
    # Return empty - this is informational only
    echo ""
}

# Register symbol handlers
repl_register_symbol "@" "test_symbol_at"
repl_register_symbol "::" "test_symbol_range"
repl_register_symbol "#" "test_symbol_tag"

# Register slash commands
repl_register_slash_command "start" "test_cmd_start"
repl_register_slash_command "finish" "test_cmd_finish"
repl_register_slash_command "reset" "test_cmd_reset"
repl_register_slash_command "count" "test_cmd_count"
repl_register_slash_command "status" "test_cmd_status"

# Welcome message
echo ""
if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
    printf "%bTest REPL - bash/repl Library Demo%b\n" "$(mode_color 0)" "$(reset_color)"
else
    echo "Test REPL - bash/repl Library Demo"
fi
echo ""
echo "Features:"
echo "  • Runtime mode switching (/mode shell|repl)"
echo "  • Symbol detection (@file, ::range, #tag)"
echo "  • Dynamic colored prompts"
echo "  • Theme switching (/theme)"
echo ""
echo "Current mode: $(repl_prompt_mode)"
echo ""
echo "Type /help for commands, /status for info, /exit to quit"
echo ""

# Set history base (will be split into .shell and .repl)
REPL_HISTORY_BASE="${TETRA_DIR:-$HOME/.tetra}/repl/test_history"

# Run REPL (mode auto-detected)
repl_run
