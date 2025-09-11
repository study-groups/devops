#!/usr/bin/env bash

# tsm_repl.sh - Interactive REPL for tetra service manager
# Provides slash command syntax and custom commands

# History management
TSM_HISTORY_LOG="$TETRA_DIR/tsm/repl_history.log"

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
  /ps               Show system processes
  /disk             Show disk usage
  /mem              Show memory usage
  /env              Show environment variables

TSM Commands (without prefix):
  start [--env env.sh] <script> [name]  Start a script
  stop <process|*>                      Stop processes
  restart <process|*>                   Restart processes
  list, ls                              List all processes
  logs <process> [--lines N]            Show process logs
  ports                                 Show PORT mappings
  setup                                 Setup tsm environment

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
                echo "Goodbye!"
                return 1
                ;;
            list)
                output=$(tsm list)
                echo "$output"
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
            last)
                tsm_repl_get_last "$args"
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
    echo "Type /help for commands, /exit to quit"
    echo
    
    # Setup completion
    complete -F tsm_repl_completion tsm_repl_process_command 2>/dev/null || true
    
    while true; do
        # Show prompt
        echo -n "tsm> "
        
        # Read input
        read -r input
        
        # Process command
        if ! tsm_repl_process_command "$input"; then
            break
        fi
        
        echo
    done
}

# If script is run directly, start REPL
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tsm_repl_main "$@"
fi