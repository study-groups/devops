#!/usr/bin/env bash
# REPL Command Processor
# Dispatches input to appropriate handlers

# Register a slash command
repl_register_slash_command() {
    local command="$1"
    local handler="$2"

    if ! command -v "$handler" >/dev/null 2>&1; then
        echo "Warning: Slash command handler not found: $handler" >&2
        return 1
    fi

    REPL_SLASH_COMMANDS+=("$command")
    REPL_SLASH_HANDLERS["$command"]="$handler"
}

# Process input (main dispatcher)
repl_process_input() {
    local input="$1"
    local processed_input="$input"

    # Process symbols if present
    if repl_has_symbols "$input"; then
        processed_input=$(repl_process_symbols "$input")
    fi

    # Debug
    if [[ "${REPL_DEBUG:-0}" -eq 1 ]]; then
        echo "[DEBUG] input='$input' processed='$processed_input' mode=$(repl_get_execution_mode)" >&2
    fi

    # Skip if processed input is empty or whitespace-only (symbol-only commands)
    if [[ -z "${processed_input// /}" ]]; then
        return 0
    fi

    # Route based on execution mode
    if repl_is_takeover; then
        # TAKEOVER MODE: commands are module by default
        # ! prefix = shell escape
        if [[ "${processed_input:0:1}" == "!" ]]; then
            # Shell command
            eval "${processed_input#!}"
            return 0
        elif [[ "$processed_input" == /* ]]; then
            # Slash command (meta)
            repl_dispatch_slash "${processed_input#/}"
            return $?
        else
            # Module command (action system or module handler)
            if [[ "${REPL_DISABLE_ACTION_DISPATCH:-0}" -eq 0 ]] && command -v tetra_dispatch_action >/dev/null 2>&1; then
                tetra_dispatch_action $processed_input
                return $?
            else
                # No action system - show error, don't execute shell
                echo "Unknown command: $processed_input" >&2
                echo "Tip: Use !$processed_input for shell commands, or /mode to switch to shell mode" >&2
                return 0
            fi
        fi
    else
        # AUGMENT MODE: commands are shell by default
        # / prefix = module/meta command
        if [[ "$processed_input" == /* ]]; then
            # ALL slash commands go to dispatcher (handles priority)
            repl_dispatch_slash "${processed_input#/}"
            return $?
        elif [[ "${processed_input:0:1}" == "!" ]]; then
            # Explicit shell escape (redundant in augment mode but allowed)
            eval "${processed_input#!}"
            return 0
        else
            # Default: shell command
            # But if it looks like a common REPL command, suggest using slash
            case "$processed_input" in
                help|exit|quit|mode|theme|history|clear)
                    echo "Did you mean: /$processed_input ?" >&2
                    echo "Tip: Use /$processed_input for REPL commands, or !$processed_input for shell" >&2
                    return 0
                    ;;
                *)
                    eval "$processed_input"
                    return 0
                    ;;
            esac
        fi
    fi
}

# Dispatch slash command
# Priority: 1) Module handlers, 2) Built-in meta, 3) Action system, 4) Unknown
repl_dispatch_slash() {
    local input="$1"
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$cmd" == "$input" ]] && args=""

    # Priority 1: Module registered handler (override)
    if [[ -n "${REPL_SLASH_HANDLERS[$cmd]}" ]]; then
        "${REPL_SLASH_HANDLERS[$cmd]}" $args
        return $?
    fi

    # Priority 2: Built-in REPL meta-commands
    case "$cmd" in
        help|h)
            repl_cmd_help $args
            return 0
            ;;
        exit|quit|q)
            return 1  # Signal exit
            ;;
        mode)
            repl_cmd_mode $args
            return $?
            ;;
        theme)
            repl_cmd_theme $args
            return $?
            ;;
        history)
            repl_cmd_history $args
            return 0
            ;;
        clear)
            clear
            return 0
            ;;
    esac

    # Priority 3: Try action system (for module commands)
    if [[ "${REPL_DISABLE_ACTION_DISPATCH:-0}" -eq 0 ]] && command -v tetra_dispatch_action >/dev/null 2>&1; then
        tetra_dispatch_action "$cmd" $args
        return $?
    fi

    # Priority 4: Unknown
    echo "Unknown command: /$cmd (try /help)" >&2
    return 0
}

# Built-in slash commands

repl_cmd_help() {
    local topic="$1"

    if [[ -n "$topic" ]]; then
        # Module-specific help
        if command -v "repl_help_$topic" >/dev/null 2>&1; then
            "repl_help_$topic"
            return 0
        fi
    fi

    # Generic help
    cat <<'EOF'
REPL Commands
=============

Slash Commands (built-in):
  /help [topic]     Show help
  /exit, /quit, /q  Exit REPL
  /mode [mode]      Toggle execution mode (shell/repl)
  /theme [name]     Change color theme
  /history [n]      Show command history
  /clear            Clear screen

Execution Modes:
  shell - Shell commands by default, /cmd for module (default)
  repl  - Module commands by default, !cmd for shell
  tui   - Full-screen TUI mode (planned: /tui <screen-name>)

  Tip: Use /mode with no argument to toggle between shell/repl modes

Symbol Processing:
  @symbol   - File/endpoint references
  ::range   - Range notation (e.g., ::100,200)
  #tag      - Tag/metadata markers

EOF

    # Show registered slash commands
    if [[ ${#REPL_SLASH_COMMANDS[@]} -gt 0 ]]; then
        echo "Module Slash Commands:"
        for cmd in "${REPL_SLASH_COMMANDS[@]}"; do
            echo "  /$cmd"
        done
        echo ""
    fi

    echo "Press Ctrl-D to exit"
}

repl_cmd_theme() {
    local theme="$1"

    if [[ -z "$theme" ]]; then
        # Show current theme
        if command -v theme_list >/dev/null 2>&1; then
            theme_list
        else
            echo "Theme system not available"
        fi
        return 0
    fi

    # Set theme
    if command -v theme_set >/dev/null 2>&1; then
        if theme_set "$theme"; then
            echo "Theme changed to: $(theme_current)"
            return 2  # Signal prompt rebuild
        else
            echo "Failed to set theme: $theme"
            return 0
        fi
    else
        echo "Theme system not available"
        return 0
    fi
}

repl_cmd_history() {
    local n="${1:-20}"
    local mode_display=$(_repl_mode_display "$(repl_get_execution_mode)")

    echo "History ($mode_display mode): $REPL_HISTORY_FILE"
    echo ""

    if [[ -f "$REPL_HISTORY_FILE" ]]; then
        tail -n "$n" "$REPL_HISTORY_FILE" | nl
    else
        echo "No history available"
    fi

    echo ""
    echo "Tip: History is mode-specific. Switch modes with /mode to see other history."
}

# Map internal modes to display names
_repl_mode_display() {
    case "$1" in
        augment) echo "shell" ;;
        takeover) echo "repl" ;;
        *) echo "$1" ;;
    esac
}

repl_cmd_mode() {
    local mode="$1"

    if [[ -z "$mode" ]]; then
        # No argument: toggle mode
        local current=$(repl_get_execution_mode)
        if [[ "$current" == "augment" ]]; then
            mode="takeover"
        else
            mode="augment"
        fi

        # Set and show
        if repl_set_execution_mode "$mode"; then
            local from=$(_repl_mode_display "$current")
            local to=$(_repl_mode_display "$mode")
            echo "Execution mode: $from → $to"
            echo ""
            if [[ "$mode" == "takeover" ]]; then
                echo "  Commands are module/action by default"
                echo "  Use !<cmd> for shell commands"
            else
                echo "  Commands are shell by default"
                echo "  Use /<cmd> for module commands"
            fi
        fi
        return 2  # Signal prompt rebuild
    fi

    # Explicit mode set
    case "$mode" in
        augment|shell|takeover|repl|toggle)
            if [[ "$mode" == "toggle" ]]; then
                # Call ourselves with no arg to toggle
                repl_cmd_mode ""
                return $?
            fi
            if repl_set_execution_mode "$mode"; then
                local display=$(_repl_mode_display "$(repl_get_execution_mode)")
                echo "Execution mode: $display"
                return 2  # Signal prompt rebuild
            else
                return 0
            fi
            ;;
        *)
            echo "Unknown mode: $mode"
            echo "Available modes: shell, repl, toggle"
            echo ""
            echo "  shell  - Shell commands by default, /cmd for module"
            echo "  repl   - Module commands by default, !cmd for shell"
            echo "  toggle - Switch between shell/repl modes"
            echo ""
            echo "Tip: '/mode' with no argument also toggles"
            return 0
            ;;
    esac
}

export -f repl_register_slash_command
export -f repl_process_input
export -f repl_dispatch_slash
export -f repl_cmd_help
export -f repl_cmd_theme
export -f repl_cmd_history
export -f repl_cmd_mode
export -f _repl_mode_display
