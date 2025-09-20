#!/usr/bin/env bash

# Shared REPL Utility Functions
# Provides common functions for all Tetra REPL implementations

# Common REPL help footer
_repl_standard_footer() {
    cat <<'EOF'

System Commands:
  help              Show this help
  exit, quit        Exit REPL

Bash Commands:
  !<command>        Execute bash command (e.g. !ls -l)

Special:
  /command          Force slash command (for conflicts)
EOF
}

# Standard prompt display
_repl_get_prompt() {
    local module_name="${1:-tetra}"
    echo "${module_name}> "
}

# Process bash commands (starting with !)
_repl_process_bash() {
    local input="$1"

    if [[ "$input" =~ ^! ]]; then
        local bash_cmd="${input#!}"
        if [[ -n "$bash_cmd" ]]; then
            eval "$bash_cmd"
        fi
        return 0
    fi

    return 1
}

# Parse command and arguments from input
_repl_parse_input() {
    local input="$1"
    local -n cmd_ref="$2"
    local -n args_ref="$3"

    # Handle slash commands (legacy/forced)
    if [[ "$input" =~ ^/ ]]; then
        input="${input#/}"
    fi

    # Parse command and arguments
    if [[ "$input" =~ [[:space:]] ]]; then
        cmd_ref="${input%% *}"
        args_ref="${input#* }"
    else
        cmd_ref="$input"
        args_ref=""
    fi
}

# Standard exit handling
_repl_handle_exit() {
    local cmd="$1"

    case "$cmd" in
        exit|quit)
            echo "Goodbye!"
            return 1
            ;;
        *)
            return 0
            ;;
    esac
}

# Standard help handling
_repl_handle_help() {
    local cmd="$1"
    local help_function="$2"

    case "$cmd" in
        help|"?")
            if declare -f "$help_function" >/dev/null 2>&1; then
                "$help_function"
            else
                echo "Help function '$help_function' not found"
            fi
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Standard unknown command handling
_repl_handle_unknown() {
    local cmd="$1"
    echo "Unknown command: $cmd"
    echo "Type 'help' for available commands"
}

# Generic REPL main loop
_repl_main_loop() {
    local module_name="$1"
    local process_function="$2"
    local init_function="${3:-}"

    echo "Tetra ${module_name^} REPL"
    echo "Type 'help' for commands, 'exit' to quit"
    echo

    # Call initialization function if provided
    if [[ -n "$init_function" ]] && declare -f "$init_function" >/dev/null 2>&1; then
        "$init_function"
    fi

    while true; do
        local prompt
        prompt="$(_repl_get_prompt "$module_name")"
        echo -n "$prompt"

        if ! read -r input; then
            # EOF reached
            echo
            break
        fi

        # Skip empty lines
        if [[ -z "$input" ]]; then
            continue
        fi

        # Process bash commands first
        if _repl_process_bash "$input"; then
            echo
            continue
        fi

        # Call the module-specific command processor
        if ! "$process_function" "$input"; then
            break
        fi
        echo
    done
}

# History management for REPL commands
_repl_save_history() {
    local module_name="$1"
    local command="$2"
    local history_dir="${TETRA_DIR}/${module_name}/history"
    local history_file="${history_dir}/repl_history.log"

    # Create history directory if it doesn't exist
    mkdir -p "$history_dir" 2>/dev/null || true

    # Save command with timestamp
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $command" >> "$history_file"

    # Keep only last 1000 entries
    if [[ -f "$history_file" ]]; then
        tail -1000 "$history_file" > "${history_file}.tmp" && mv "${history_file}.tmp" "$history_file"
    fi
}

# Load shared completion utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/completion_utils.sh"

# Load command history for display
_repl_show_history() {
    local module_name="$1"
    local lines="${2:-20}"
    local history_file="${TETRA_DIR}/${module_name}/history/repl_history.log"

    if [[ -f "$history_file" ]]; then
        echo "Recent REPL Commands (last $lines):"
        echo "================================="
        tail -"$lines" "$history_file"
    else
        echo "No command history found"
    fi
}

# Completion support for REPL modules
_repl_enable_completion() {
    local module_name="$1"
    local completion_function="$2"

    if declare -f "$completion_function" >/dev/null 2>&1; then
        complete -F "$completion_function" "${module_name}_repl" 2>/dev/null || true
    fi
}

# Common status display utilities
_repl_show_module_status() {
    local module_name="$1"
    local module_dir="${TETRA_DIR}/${module_name}"

    _tetra_status_header "${module_name^} REPL"

    # Module directory status
    _tetra_status_section "Module Directory"
    if [[ -d "$module_dir" ]]; then
        _tetra_status_item "success" "Location" "$(_tetra_format_path "$module_dir")"
    else
        _tetra_status_item "missing" "Location" "$(_tetra_format_path "$module_dir")"
        return 1
    fi
    echo

    # File counts
    _tetra_status_section "REPL Data"
    local history_count=$(find "$module_dir/history" -name "*.log" 2>/dev/null | wc -l | tr -d ' ')
    local config_count=$(find "$module_dir/config" -name "*" -type f 2>/dev/null | wc -l | tr -d ' ')
    local log_count=$(find "$module_dir/logs" -name "*.log" 2>/dev/null | wc -l | tr -d ' ')

    _tetra_status_item "info" "History files" "$history_count"
    _tetra_status_item "info" "Config files" "$config_count"
    _tetra_status_item "info" "Log files" "$log_count"
}

# Validate REPL environment
_repl_validate_environment() {
    local module_name="$1"
    local issues=0

    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ TETRA_DIR environment variable not set"
        ((issues++))
    elif [[ ! -d "$TETRA_DIR" ]]; then
        echo "❌ TETRA_DIR directory does not exist: $TETRA_DIR"
        ((issues++))
    fi

    local module_dir="${TETRA_DIR}/${module_name}"
    if [[ ! -d "$module_dir" ]]; then
        echo "⚠️  Module directory does not exist: $module_dir"
        echo "    Creating directory structure..."
        mkdir -p "$module_dir"/{config,logs,history} 2>/dev/null || ((issues++))
    fi

    if [[ $issues -eq 0 ]]; then
        return 0
    else
        echo "❌ REPL environment validation failed with $issues issues"
        return 1
    fi
}

# Enhanced command dispatcher with history
_repl_dispatch_with_history() {
    local module_name="$1"
    local input="$2"
    local process_function="$3"

    # Save to history (skip empty commands and bash commands)
    if [[ -n "$input" && ! "$input" =~ ^! ]]; then
        _repl_save_history "$module_name" "$input"
    fi

    # Process the command
    "$process_function" "$input"
}

# Auto-setup function to be called by REPL modules
_repl_auto_setup() {
    local module_name="$1"

    # Validate environment
    _repl_validate_environment "$module_name"

    # Set up signal handlers
    trap 'echo; exit 0' INT
    trap 'echo; exit 0' TERM
}

# Common error handling
_repl_error() {
    local message="$1"
    local module_name="${2:-tetra}"

    echo "❌ ${module_name^} REPL Error: $message" >&2
    return 1
}

# Success message
_repl_success() {
    local message="$1"

    echo "✅ $message"
}

# Info message
_repl_info() {
    local message="$1"

    echo "ℹ️  $message"
}

true