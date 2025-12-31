#!/usr/bin/env bash
# Tetra Mode REPL
# REPL switching controller with Ctrl-Tab navigation

# Ensure dependencies
: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source dependencies
source "$TETRA_SRC/bash/utils/function_helpers.sh"
source "$TETRA_SRC/bash/tetra/modes/matrix.sh"
source "$TETRA_SRC/bash/repl/temperature_loader.sh"
source "$TETRA_SRC/bash/tcurses/tcurses_keychord.sh"

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

# Current context
declare -g MODE_REPL_ENV="Local"
declare -g MODE_REPL_MODE="Inspect"

# Active modules for current context
declare -ga MODE_REPL_MODULES=()
declare -g MODE_REPL_CURRENT_INDEX=0

# REPL state
declare -g MODE_REPL_ACTIVE=false

# ============================================================================
# CONTEXT MANAGEMENT
# ============================================================================

# Set context (environment and mode)
mode_repl_set_context() {
    local env="$1"
    local mode="$2"

    MODE_REPL_ENV="$env"
    MODE_REPL_MODE="$mode"

    # Get modules for this context
    local modules_list=$(get_modules_for_context "$env" "$mode")
    MODE_REPL_MODULES=($modules_list)

    # Reset to first module
    MODE_REPL_CURRENT_INDEX=0

    # Load temperature for first module
    if [[ ${#MODE_REPL_MODULES[@]} -gt 0 ]]; then
        local module="${MODE_REPL_MODULES[$MODE_REPL_CURRENT_INDEX]}"
        repl_load_temperature "$module"
    fi
}

# Get current module
mode_repl_get_current_module() {
    if [[ ${#MODE_REPL_MODULES[@]} -gt 0 ]]; then
        echo "${MODE_REPL_MODULES[$MODE_REPL_CURRENT_INDEX]}"
    fi
}

# Get current context
mode_repl_get_context() {
    echo "$MODE_REPL_ENV:$MODE_REPL_MODE"
}

# ============================================================================
# MODULE SWITCHING (Ctrl-Tab)
# ============================================================================

# Switch to next module (Ctrl-Tab)
mode_repl_next_module() {
    local num_modules=${#MODE_REPL_MODULES[@]}

    [[ $num_modules -eq 0 ]] && return 1
    [[ $num_modules -eq 1 ]] && return 0  # Only one module

    local from_module=$(mode_repl_get_current_module)

    # Advance index
    MODE_REPL_CURRENT_INDEX=$(( (MODE_REPL_CURRENT_INDEX + 1) % num_modules ))

    local to_module=$(mode_repl_get_current_module)

    # Phase shift to new module
    repl_phase_shift "$from_module" "$to_module"

    return 0
}

# Switch to previous module (Shift-Ctrl-Tab)
mode_repl_prev_module() {
    local num_modules=${#MODE_REPL_MODULES[@]}

    [[ $num_modules -eq 0 ]] && return 1
    [[ $num_modules -eq 1 ]] && return 0  # Only one module

    local from_module=$(mode_repl_get_current_module)

    # Go back
    MODE_REPL_CURRENT_INDEX=$(( (MODE_REPL_CURRENT_INDEX - 1 + num_modules) % num_modules ))

    local to_module=$(mode_repl_get_current_module)

    # Phase shift to new module
    repl_phase_shift "$from_module" "$to_module"

    return 0
}

# ============================================================================
# REPL INTERFACE
# ============================================================================

# Build REPL prompt for current module
mode_repl_build_prompt() {
    local module=$(mode_repl_get_current_module)
    local marker=$(get_module_marker "$module")

    # Temperature indicator
    repl_temperature_indicator

    # Module marker and name
    tds_text_color "repl.prompt"
    echo -n "$marker $module"
    reset_color

    # Context indicator
    tds_text_color "content.dim"
    echo -n " [$MODE_REPL_ENV:$MODE_REPL_MODE]"
    reset_color

    echo -n "> "
}

# Process input for current module
mode_repl_process_input() {
    local input="$1"
    local module=$(mode_repl_get_current_module)

    # Check for meta commands
    case "$input" in
        "")
            return 0
            ;;
        "exit"|"quit"|"q")
            return 1  # Exit signal
            ;;
        "help")
            mode_repl_show_help
            return 0
            ;;
        "context")
            mode_repl_show_context
            return 0
            ;;
        "modules")
            mode_repl_show_modules
            return 0
            ;;
    esac

    # Delegate to module's REPL
    if tetra_function_exists "${module}_repl_process"; then
        ${module}_repl_process "$input"
    else
        echo "Module $module does not have REPL implementation"
        return 1
    fi
}

# ============================================================================
# HELP & STATUS
# ============================================================================

# Show help
mode_repl_show_help() {
    echo
    echo "Tetra Mode REPL - Help"
    echo
    echo "Context: $MODE_REPL_ENV × $MODE_REPL_MODE"
    echo "Modules: ${MODE_REPL_MODULES[*]}"
    echo
    echo "Key Chords:"
    echo "  Ctrl-Tab         Switch to next module"
    echo "  Shift-Ctrl-Tab   Switch to previous module"
    echo "  ESC              Return to TUI"
    echo
    echo "Commands:"
    echo "  help             Show this help"
    echo "  context          Show current context"
    echo "  modules          List available modules"
    echo "  exit, quit, q    Exit REPL"
    echo
}

# Show current context
mode_repl_show_context() {
    echo
    echo "Current Context:"
    echo "  Environment: $MODE_REPL_ENV"
    echo "  Mode: $MODE_REPL_MODE"
    echo "  Module: $(mode_repl_get_current_module)"
    echo "  Temperature: $(repl_get_temperature_info)"
    echo
}

# Show available modules
mode_repl_show_modules() {
    echo
    echo "Available Modules:"
    local idx=0
    for module in "${MODE_REPL_MODULES[@]}"; do
        local marker=$(get_module_marker "$module")
        local temp=$(get_module_temperature "$module")
        local current=""
        [[ $idx -eq $MODE_REPL_CURRENT_INDEX ]] && current=" ← current"
        echo "  $marker $module ($temp)$current"
        ((idx++))
    done
    echo
}

# Show footer with module list
mode_repl_show_footer() {
    local num_modules=${#MODE_REPL_MODULES[@]}

    if [[ $num_modules -gt 1 ]]; then
        tds_text_color "content.dim"
        echo -n "["

        local idx=0
        for module in "${MODE_REPL_MODULES[@]}"; do
            if [[ $idx -eq $MODE_REPL_CURRENT_INDEX ]]; then
                tds_text_color "marker.active"
                echo -n "$module"
                tds_text_color "content.dim"
            else
                echo -n "$module"
            fi

            if [[ $idx -lt $((num_modules - 1)) ]]; then
                echo -n " "
            fi
            ((idx++))
        done

        echo -n "] | Ctrl-Tab=next"
        reset_color
        echo
    fi
}

# ============================================================================
# MAIN REPL LOOP
# ============================================================================

# Run mode REPL
mode_repl_run() {
    local env="${1:-Local}"
    local mode="${2:-Inspect}"

    # Set context
    mode_repl_set_context "$env" "$mode"

    # Check if we have modules
    if [[ ${#MODE_REPL_MODULES[@]} -eq 0 ]]; then
        echo "No modules available for $env:$mode"
        return 1
    fi

    MODE_REPL_ACTIVE=true

    # Override keychord actions
    keychord_action_next() { mode_repl_next_module; }
    keychord_action_prev() { mode_repl_prev_module; }

    # Clear and show welcome
    clear
    echo "Entering Mode REPL: $env × $mode"
    echo "Modules: ${MODE_REPL_MODULES[*]}"
    echo
    mode_repl_show_help
    sleep 1

    # Main loop
    while true; do
        # Show footer
        mode_repl_show_footer

        # Show prompt
        local prompt=$(mode_repl_build_prompt)
        echo -ne "$prompt"

        # Read input with chord detection
        local input=""
        local chord=""

        while true; do
            chord=$(keychord_read 0.01)

            case "$chord" in
                "ctrl-tab")
                    mode_repl_next_module
                    echo  # New line after chord
                    break
                    ;;
                "shift-ctrl-tab")
                    mode_repl_prev_module
                    echo  # New line after chord
                    break
                    ;;
                $'\e')  # ESC
                    echo
                    MODE_REPL_ACTIVE=false
                    repl_restore_default_temperature
                    return 0
                    ;;
                $'\n'|'')  # Enter
                    echo
                    mode_repl_process_input "$input" || {
                        MODE_REPL_ACTIVE=false
                        repl_restore_default_temperature
                        return 0
                    }
                    break
                    ;;
                $'\x7f'|$'\b')  # Backspace
                    if [[ -n "$input" ]]; then
                        input="${input%?}"
                        echo -ne "\b \b"
                    fi
                    ;;
                *)
                    # Regular character
                    if [[ ${#chord} -eq 1 ]]; then
                        input+="$chord"
                        echo -n "$chord"
                    fi
                    ;;
            esac
        done
    done
}

# ============================================================================
# EXPORT
# ============================================================================

export -f mode_repl_set_context
export -f mode_repl_get_current_module
export -f mode_repl_get_context
export -f mode_repl_next_module
export -f mode_repl_prev_module
export -f mode_repl_build_prompt
export -f mode_repl_process_input
export -f mode_repl_show_help
export -f mode_repl_show_context
export -f mode_repl_show_modules
export -f mode_repl_show_footer
export -f mode_repl_run
