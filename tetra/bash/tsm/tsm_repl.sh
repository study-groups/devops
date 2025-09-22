#!/usr/bin/env bash

# tsm_repl.sh - Interactive REPL for tetra service manager
# Provides slash command syntax and custom commands

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

# History management
TSM_HISTORY_LOG="$TSM_DIR/history/repl_history.log"
TSM_HISTORY_FILE="$TSM_DIR/history/.tsm_history"

tsm_repl_help() {
    cat <<'EOF'
TSM Interactive REPL
===================

Built-in Commands:
  /help, /?         Show this help
  /exit, /quit      Exit REPL
  /list             List all processes
  /kill <process>   Kill/delete process
  /last [n]         Show last command output (n=0 default, n=1 goes back one, etc.)
  /history [n]      Show command history (default: 20 lines)
  /ps               Show system processes
  /disk             Show disk usage
  /mem              Show memory usage
  /env              Show environment variables
  /orphans          Find orphaned processes
  /clean            Clean stale tracking files
  /validate <cmd>   Validate command before running
  /doctor           Quick system health check
  /json <cmd>       Execute command with JSON output
  /tview            Launch TView dashboard (gamepad navigation)

TSM Commands (without prefix):
  start [--env env.sh] <script> [name]  Start a script
  stop <process|*>                      Stop processes
  restart <process|*>                   Restart processes
  list, ls                              List all processes
  logs <process> [--lines N]            Show process logs
  ports                                 Show PORT mappings
  setup                                 Setup tsm environment
  doctor <subcommand>                   Diagnostic tools

Bash Commands:
  !<command>        Execute bash command (e.g. !ls, !ps, !df -h)

Special:
  <empty>           Show process list

Examples:
  ls                List processes
  !ls               List files
  start server.sh   Start server script
  !ps aux           Show system processes
  /last             Show last command output
EOF
}

tsm_repl_save_output() {
    local command="$1"
    local output="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Create delimiter entry
    echo "==== ENTRY $timestamp ====" >> "$TSM_HISTORY_LOG"
    echo "COMMAND: $command" >> "$TSM_HISTORY_LOG"
    echo "OUTPUT:" >> "$TSM_HISTORY_LOG"
    echo "$output" >> "$TSM_HISTORY_LOG"
    echo "" >> "$TSM_HISTORY_LOG"
}

tsm_repl_get_last() {
    local n="${1:-0}"
    
    if [[ ! -f "$TSM_HISTORY_LOG" ]]; then
        echo "No command history found"
        return 1
    fi
    
    # Get all entry markers and their line numbers
    local entry_lines=($(grep -n "^==== ENTRY" "$TSM_HISTORY_LOG" | cut -d: -f1))
    local total_entries=${#entry_lines[@]}
    
    if (( total_entries == 0 )); then
        echo "No command history found"
        return 1
    fi
    
    # Calculate which entry to show (0-indexed from most recent)
    local entry_index=$((total_entries - 1 - n))
    
    if (( entry_index < 0 )); then
        echo "Not enough history entries (only $total_entries available)"
        return 1
    fi
    
    # Get start and end line numbers for the entry
    local start_line=${entry_lines[$entry_index]}
    local end_line
    
    if (( entry_index + 1 < total_entries )); then
        end_line=$((${entry_lines[$((entry_index + 1))]} - 1))
    else
        end_line=$(wc -l < "$TSM_HISTORY_LOG")
    fi
    
    # Extract and display the entry
    sed -n "${start_line},${end_line}p" "$TSM_HISTORY_LOG"
}

tsm_repl_custom_ps() {
    echo "=== System Processes ==="
    ps aux | head -20
}

tsm_repl_custom_disk() {
    echo "=== Disk Usage ==="
    df -h
}

tsm_repl_custom_mem() {
    echo "=== Memory Usage ==="
    if [[ "$OSTYPE" == "darwin"* ]]; then
        top -l 1 | grep PhysMem
        vm_stat
    else
        free -h
    fi
}

tsm_repl_custom_env() {
    echo "=== Environment Variables ==="
    echo "TETRA_DIR: $TETRA_DIR"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "NODE_ENV: $NODE_ENV"
    echo "PORT: $PORT"
    echo "PD_DIR: $PD_DIR"
}

tsm_repl_process_command() {
    local input="$1"
    local output=""
    
    # Skip saving output for /last commands to avoid recursion
    local skip_save=false
    
    # Handle slash commands
    if [[ "$input" =~ ^/ ]]; then
        local cmd="${input#/}"
        local args=""
        
        # Split command and args
        if [[ "$cmd" =~ [[:space:]] ]]; then
            args="${cmd#* }"
            cmd="${cmd%% *}"
        fi
        
        case "$cmd" in
            help|"?")
                output=$(tsm_repl_help)
                echo "$output"
                ;;
            exit|quit)
                # Handled in main function
                return 0
                ;;
            list)
                output=$(tsm list)
                echo "$output"
                ;;
            history|hist)
                local lines="${args:-20}"
                if [[ -f "$TSM_HISTORY_FILE" ]]; then
                    output=$(tail -n "$lines" "$TSM_HISTORY_FILE" | nl -w3 -s': ')
                    echo "TSM Command History (last $lines commands):"
                    echo "$output"
                else
                    echo "No command history found"
                fi
                ;;
            kill)
                if [[ -n "$args" ]]; then
                    output=$(tsm kill "$args" 2>&1)
                    echo "$output"
                else
                    output="Usage: /kill <process>"
                    echo "$output"
                fi
                ;;
            ps)
                output=$(tsm_repl_custom_ps)
                echo "$output"
                ;;
            disk)
                output=$(tsm_repl_custom_disk)
                echo "$output"
                ;;
            mem)
                output=$(tsm_repl_custom_mem)
                echo "$output"
                ;;
            env)
                output=$(tsm_repl_custom_env)
                echo "$output"
                ;;
            orphans)
                output=$(tsm doctor orphans 2>&1)
                echo "$output"
                ;;
            clean)
                output=$(tsm doctor clean 2>&1)
                echo "$output"
                ;;
            validate)
                if [[ -n "$args" ]]; then
                    output=$(tsm doctor validate "$args" 2>&1)
                    echo "$output"
                else
                    output="Usage: /validate <command>"
                    echo "$output"
                fi
                ;;
            doctor)
                if [[ -n "$args" ]]; then
                    output=$(tsm doctor "$args" 2>&1)
                    echo "$output"
                else
                    # Quick health check
                    output=$(tsm doctor scan 2>&1)
                    echo "$output"
                fi
                ;;
            json)
                if [[ -n "$args" ]]; then
                    output=$(eval "tsm $args --json" 2>&1)
                    echo "$output"
                else
                    output="Usage: /json <tsm-command>\nExample: /json list"
                    echo "$output"
                fi
                ;;
            last)
                tsm_repl_get_last "$args"
                skip_save=true
                ;;
            tview)
                echo "Launching TView dashboard..."
                if command -v tview >/dev/null 2>&1; then
                    source "$TETRA_SRC/bash/tview/tview.sh"
                    tview dashboard
                else
                    echo "TView not available. Source tetra.sh first."
                fi
                skip_save=true
                ;;
            *)
                output="Unknown command: /$cmd\nType /help for available commands"
                echo -e "$output"
                ;;
        esac
    elif [[ "$input" =~ ^! ]]; then
        # Bash command (prefixed with !)
        local bash_cmd="${input#!}"
        if [[ -n "$bash_cmd" ]]; then
            output=$(eval "$bash_cmd" 2>&1)
            echo "$output"
        fi
    else
        # Handle empty input - show process list
        if [[ -z "$input" ]]; then
            output=$(tpm list)
            echo "$output"
        else
            # Regular tsm command
            output=$(eval "tsm $input" 2>&1)
            echo "$output"
        fi
    fi
    
    # Save command and output to history (unless it's /last)
    if [[ "$skip_save" == "false" && -n "$input" && -n "$output" ]]; then
        tsm_repl_save_output "$input" "$output"
    fi
    
    return 0
}

tsm_repl_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local commands="start stop restart delete del kill list ls logs ports setup help"
    local slash_commands="/help /? /exit /quit /ls /list /kill /ps /disk /mem /env /last"
    
    if [[ "$cur" =~ ^/ ]]; then
        COMPREPLY=($(compgen -W "$slash_commands" -- "$cur"))
    else
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    fi
}

tsm_repl_main() {
    echo "TSM Interactive REPL"
    echo "Type /help for commands, /exit or Ctrl-C to quit"
    echo
    
    # Setup completion
    complete -F tsm_repl_completion tsm_repl_process_command 2>/dev/null || true
    
    # Trap Ctrl-C to exit gracefully
    trap 'echo -e "\nExiting TSM REPL..."; exit 0' SIGINT
    
    local exit_repl=false
    while [[ "$exit_repl" == "false" ]]; do
        # Read input with history support
        if [[ -t 0 ]]; then
            read -e -r -p "tsm> " input || break
        else
            echo -n "tsm> "
            read -r input || break
        fi
        
        # Save to history
        [[ -n "$input" ]] && echo "$input" >> "$TSM_HISTORY_FILE"
        
        # Process command
        case "$input" in
            /exit|/quit)
                echo "Goodbye!"
                exit_repl=true
                break
                ;;
            *)
                if ! tsm_repl_process_command "$input"; then
                    exit_repl=true
                    break
                fi
                ;;
        esac
        
        echo
    done
}

# If script is run directly, start REPL
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    source "$HOME/tetra/tetra.sh"
    tsm_repl_main "$@"
fi