#!/usr/bin/env bash
# Tetra REPL Interface
# Simple line-based REPL using tcurses_input_read_line

# Source tcurses input
source "$TETRA_SRC/bash/tcurses/tcurses_input.sh"

# REPL history
TETRA_REPL_HISTORY="${TETRA_DIR}/tetra/repl_history"

# Build dynamic prompt
tetra_repl_build_prompt() {
    local org="$(tetra_get_org)"
    local env="$(tetra_get_env)"
    local mode="$(tetra_get_mode)"
    echo "[${org} × ${env} × ${mode:-all}] tetra> "
}

# Process completed line
tetra_repl_process_line() {
    local line="$1"

    [[ -z "$line" ]] && return 0

    # Slash commands
    if [[ "$line" == /* ]]; then
        local cmd="${line#/}"
        local cmd_name="${cmd%% *}"
        local cmd_args="${cmd#* }"
        [[ "$cmd_name" == "$cmd" ]] && cmd_args=""

        case "$cmd_name" in
            help|h)
                tetra_repl_help
                return 0
                ;;
            exit|quit|q)
                return 1  # Signal exit
                ;;
            status)
                tetra show status
                return 0
                ;;
            org)
                if [[ -n "$cmd_args" ]]; then
                    tetra_set_org "$cmd_args"
                    printf 'Organization: %s\n' "$cmd_args"
                    return 2  # Signal prompt update
                else
                    printf 'Organization: %s\n' "$(tetra_get_org)"
                    return 0
                fi
                ;;
            env)
                if [[ -n "$cmd_args" ]]; then
                    tetra_set_env "$cmd_args"
                    printf 'Environment: %s\n' "$cmd_args"
                    return 2  # Signal prompt update
                else
                    printf 'Environment: %s\n' "$(tetra_get_env)"
                    return 0
                fi
                ;;
            mode)
                if [[ -n "$cmd_args" ]]; then
                    tetra_set_mode "$cmd_args"
                    printf 'Mode: %s\n' "$cmd_args"
                    return 2  # Signal prompt update
                else
                    printf 'Mode: %s\n' "$(tetra_get_mode)"
                    return 0
                fi
                ;;
            context)
                tetra_context_summary
                return 0
                ;;
            history)
                [[ -f "$TETRA_REPL_HISTORY" ]] && tail -20 "$TETRA_REPL_HISTORY" | nl
                return 0
                ;;
            clear)
                clear
                return 0
                ;;
            *)
                printf 'Unknown: /%s (try /help)\n' "$cmd_name"
                return 0
                ;;
        esac
    else
        # Dispatch to orchestrator
        tetra_dispatch_action $line
    fi
}

# Help
tetra_repl_help() {
    cat <<'EOF'
TETRA REPL - Quick Reference
=============================

SLASH COMMANDS
  /help, /h                   Show this help
  /exit, /quit, /q            Exit REPL

  Context Management
    /org [name]               Get/set organization
    /env [name]               Get/set environment (Local, Dev, Staging, Production)
    /mode [modules]           Get/set mode filter (comma-separated module names)
    /context                  Show [Org × Env × Mode] → Actions mapping

  System
    /status                   Show orchestrator status
    /history                  Show recent command history
    /clear                    Clear screen

ACTIONS (no / prefix)
  Meta Actions
    list modules              List all loaded modules
    list actions              List all available actions
    help [topic]              Show help (topics: commands, modules, agents, etc.)

  Module Actions
    <module> <action> [args]  Execute module action

    Examples:
      rag list agents         List RAG agents
      flow create "task"      Create flow from task

EDITING
  Readline: Arrow keys, Ctrl-A/E, Ctrl-U/W
  Enhanced: tetra repl --rlwrap (persistent history)

LEARN MORE
  help                        Main help with all topics
  help repl                   Detailed REPL documentation
  help context                Context management guide
  help modules                Module system documentation
EOF
}

# Main REPL entry
tetra_repl() {
    mkdir -p "$(dirname "$TETRA_REPL_HISTORY")"
    touch "$TETRA_REPL_HISTORY"

    # Welcome
    local org="$(tetra_get_org)"
    local env="$(tetra_get_env)"
    local mode="$(tetra_get_mode)"

    printf '\nTetra REPL\n'
    printf '==========\n\n'
    printf 'Context: [%s × %s × %s]\n' "$org" "$env" "${mode:-all}"
    printf '\n'
    printf '/help for commands\n'
    printf 'Readline editing enabled (Ctrl-A/E, arrows, history)\n'
    if command -v rlwrap >/dev/null 2>&1; then
        printf 'Tip: Run with "rlwrap tetra repl" for enhanced history\n'
    fi
    printf '\n'

    # REPL loop - use tcurses if interactive, fallback to read -r otherwise
    while true; do
        local input

        # Rebuild prompt dynamically
        local prompt="$(tetra_repl_build_prompt)"

        # Check if we have an interactive terminal
        if [[ -t 0 && -e /dev/tty ]]; then
            # Interactive: use tcurses_input_read_line with readline support
            input=$(tcurses_input_read_line "$prompt" "$TETRA_REPL_HISTORY")
            local read_status=$?

            # Check for EOF (Ctrl-D on empty line)
            if [[ $read_status -ne 0 ]]; then
                printf '\n'
                break
            fi
        else
            # Non-interactive (piped input): simple read
            printf '%s' "$prompt"
            if ! read -r input; then
                printf '\n'
                break
            fi
            # Save to history
            [[ -n "$input" ]] && echo "$input" >> "$TETRA_REPL_HISTORY"
        fi

        # Process line (returns: 0=continue, 1=exit, 2=prompt changed)
        tetra_repl_process_line "$input"
        local status=$?
        if [[ $status -eq 1 ]]; then
            # Exit requested
            printf 'Exiting tetra REPL\n'
            break
        fi
        # status=2 means prompt changed, will rebuild on next iteration
    done

    printf '\n'
}

# rlwrap wrapper (optional but recommended)
tetra_repl_with_rlwrap() {
    if command -v rlwrap >/dev/null 2>&1; then
        exec rlwrap -H "$TETRA_REPL_HISTORY" \
                    -C tetra \
                    bash -c "source '$TETRA_SRC/bash/tetra/tetra.sh' && tetra repl"
    else
        printf 'rlwrap not found, using basic mode\n' >&2
        tetra_repl
    fi
}

export -f tetra_repl
export -f tetra_repl_with_rlwrap
export -f tetra_repl_process_line
export -f tetra_repl_help
