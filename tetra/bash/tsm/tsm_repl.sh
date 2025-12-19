#!/usr/bin/env bash

# TSM REPL - Migrated to bash/repl
# Replaces bash/tsm/interfaces/repl.sh with bash/repl library integration
#
# Features:
# - Progressive enhancement (basic/enhanced/TUI modes)
# - Color support via bash/color
# - Mode switching (shell ⟷ repl)
# - Dynamic prompts showing service status
# - All original TSM slash commands preserved
# - Output history (/last) preserved
# - Session analytics preserved

# Note: This file is sourced by core/include.sh as part of TSM loading,
# so tsm function won't exist yet. Skip the check when being loaded.

# Source bash/repl library
source "$TETRA_SRC/bash/repl/repl.sh" 2>/dev/null || true

# === CONFIGURATION ===

# History base path (bash/repl creates .shell and .repl variants)
REPL_HISTORY_BASE="${TETRA_DIR}/tsm/repl_history"

# Output history (TSM-specific feature)
TSM_HISTORY_LOG="$TETRA_DIR/tsm/repl_output_history.log"

# === HELPER FUNCTIONS ===

# Count running processes (for prompt)
tsm_count_running() {
    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        echo "0"
        return 0
    fi

    local count=0
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local meta_file="${process_dir}meta.json"
        if [[ -f "$meta_file" ]]; then
            local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
            if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                ((count++))
            fi
        fi
    done

    echo "$count"
}

# Save command output for /last feature
tsm_repl_save_output() {
    local command="$1"
    local output="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    mkdir -p "$(dirname "$TSM_HISTORY_LOG")"

    echo "==== ENTRY $timestamp ====" >> "$TSM_HISTORY_LOG"
    echo "COMMAND: $command" >> "$TSM_HISTORY_LOG"
    echo "OUTPUT:" >> "$TSM_HISTORY_LOG"
    echo "$output" >> "$TSM_HISTORY_LOG"
    echo "" >> "$TSM_HISTORY_LOG"
}

# Get last command output
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

# === PROMPT BUILDERS ===

# Dynamic status prompt showing running service count with colors
tsm_prompt_status() {
    local count=$(tsm_count_running)
    local color=""

    # Simple ANSI colors (avoid complex color system issues)
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        case $count in
            0) color='\033[0;31m' ;;      # Red - no services
            [1-4]) color='\033[1;33m' ;;  # Yellow - few services
            *) color='\033[0;32m' ;;      # Green - many services
        esac
        printf "%b●%d\033[0m " "$color" "$count"
    else
        printf "[%d] " "$count"
    fi
}

# Base prompt with mode indicator
tsm_prompt_base() {
    local mode_indicator=$(repl_prompt_mode)  # Built-in from bash/repl

    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        printf "\033[0;36mtsm%s>\033[0m " "$mode_indicator"
    else
        printf "tsm%s> " "$mode_indicator"
    fi
}

# === SLASH COMMAND HANDLERS ===

# /list - List all processes
tsm_cmd_list() {
    tsm list
}

# /kill - Kill/delete process or raw PID
tsm_cmd_kill() {
    local args="$*"
    if [[ -z "$args" ]]; then
        echo "Usage: kill <process|pid|port>"
        echo "  kill 0          # Kill TSM process ID 0"
        echo "  kill 8000       # Kill process on port 8000"
        echo "  kill 12345      # Kill PID 12345 (if not TSM-managed)"
        return 0
    fi

    # If numeric, check if it's a TSM process first
    if [[ "$args" =~ ^[0-9]+$ ]]; then
        # Try TSM smart resolver (TSM ID, PID, port)
        if tetra_tsm_smart_resolve "$args" >/dev/null 2>&1; then
            # It's a TSM-managed process
            tsm kill "$args"
            return $?
        fi

        # Not TSM-managed - check if it's a running PID
        if kill -0 "$args" 2>/dev/null; then
            echo "🔍 PID $args is running but not managed by TSM"
            echo -n "Kill this process? [y/N] "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                if kill "$args" 2>/dev/null; then
                    echo "✅ Killed PID $args"
                else
                    echo "❌ Failed to kill PID $args (try: sudo kill $args)"
                fi
            else
                echo "Cancelled"
            fi
            return 0
        fi

        # Check if it's a port with a process
        local port_pid=$(lsof -ti :$args 2>/dev/null | head -1)
        if [[ -n "$port_pid" ]]; then
            local cmd=$(ps -p $port_pid -o args= 2>/dev/null || echo "unknown")
            echo "🔍 Found process on port $args:"
            echo "  PID: $port_pid"
            echo "  Command: $cmd"
            echo -n "Kill this process? [y/N] "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                if kill "$port_pid" 2>/dev/null; then
                    echo "✅ Killed PID $port_pid (port $args)"
                else
                    echo "❌ Failed to kill PID $port_pid"
                fi
            else
                echo "Cancelled"
            fi
            return 0
        fi

        echo "❌ No process found with TSM ID, PID, or port: $args"
        return 1
    fi

    # Non-numeric - pass to TSM
    tsm kill "$args"
}

# /last - Show last command output (TSM-specific feature)
tsm_cmd_last() {
    tsm_repl_get_last "$@"
}

# /ps - Show system processes
tsm_cmd_ps() {
    echo "=== System Processes ==="
    ps aux | head -20
}

# /disk - Show disk usage
tsm_cmd_disk() {
    echo "=== Disk Usage ==="
    df -h
}

# /mem - Show memory usage
tsm_cmd_mem() {
    echo "=== Memory Usage ==="
    if [[ "$OSTYPE" == "darwin"* ]]; then
        top -l 1 | grep PhysMem
        vm_stat
    else
        free -h
    fi
}

# /env - Show environment variables
tsm_cmd_env() {
    echo "=== Environment Variables ==="
    echo "TETRA_DIR: $TETRA_DIR"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "TSM_PROCESSES_DIR: $TSM_PROCESSES_DIR"
    echo "NODE_ENV: ${NODE_ENV:-}"
    echo "PORT: ${PORT:-}"
}

# /orphans - Find orphaned processes
tsm_cmd_orphans() {
    tsm doctor orphans
}

# /clean - Clean stale tracking files
tsm_cmd_clean() {
    tsm doctor clean
}

# /validate - Validate command
tsm_cmd_validate() {
    local args="$*"
    if [[ -z "$args" ]]; then
        echo "Usage: /validate <command>"
        return 0
    fi
    tsm doctor validate "$args"
}

# /doctor - System health check
tsm_cmd_doctor() {
    local args="$*"
    if [[ -z "$args" ]]; then
        # Quick health check
        tsm doctor scan
    else
        tsm doctor "$args"
    fi
}

# /json - Execute command with JSON output
tsm_cmd_json() {
    local args="$*"
    if [[ -z "$args" ]]; then
        echo "Usage: /json <tsm-command>"
        echo "Example: /json list"
        return 0
    fi
    eval "tsm $args --json"
}

# /tview - Launch TView dashboard
tsm_cmd_tview() {
    echo "Launching TView dashboard..."
    if command -v tview >/dev/null 2>&1; then
        source "$TETRA_SRC/bash/tview/tview.sh"
        tview dashboard
    else
        echo "TView not available. Source tetra.sh first."
    fi
}

# /sessions - Session analytics
tsm_cmd_sessions() {
    local args="$*"

    if [[ -z "$args" || "$args" == "help" ]]; then
        cat <<'EOF'
Session Analytics Commands:
===========================

  /sessions help              Show this help
  /sessions summary           Show session summary for devpages
  /sessions list [service]    List active sessions
  /sessions users [service]   Show user traffic analysis
  /sessions patterns          Show user behavior patterns
  /sessions clicks            Show click timing analysis
  /sessions journey [session] Show user journey timeline

Examples:
  /sessions summary
  /sessions users devpages
  /sessions patterns devpages admin
  /sessions clicks devpages
  /sessions journey devpages session_abc123

Note: Default service is 'devpages' if not specified.
EOF
        return 0
    fi

    local cmd="${args%% *}"
    local remaining="${args#* }"
    local service="devpages"  # Default service

    # Extract service if provided
    if [[ "$remaining" != "$args" && "$remaining" =~ ^[a-zA-Z] ]]; then
        service="${remaining%% *}"
        remaining="${remaining#* }"
    fi

    case "$cmd" in
        summary)
            echo "📊 Session Summary for $service"
            echo "══════════════════════════════"
            tsm sessions "$service"
            ;;
        list)
            echo "📋 Active Sessions for $service"
            echo "═══════════════════════════════"
            tsm sessions "$service"
            ;;
        users)
            echo "👥 User Traffic Analysis for $service"
            echo "════════════════════════════════════"
            tsm users "$service"
            ;;
        patterns)
            local user_filter=""
            if [[ "$remaining" != "$service" ]]; then
                user_filter="$remaining"
            fi

            if [[ -n "$user_filter" ]]; then
                echo "🎯 Behavioral Patterns for user '$user_filter' in $service"
                echo "═══════════════════════════════════════════════════════"
                tsm patterns "$service" "$user_filter"
            else
                echo "🎯 Behavioral Patterns for $service"
                echo "══════════════════════════════════"
                tsm patterns "$service"
            fi
            ;;
        clicks)
            echo "🖱️  Click Analysis for $service"
            echo "═══════════════════════════════"
            tsm clicks "$service"
            ;;
        journey)
            local session_id=""
            if [[ "$remaining" != "$service" ]]; then
                session_id="$remaining"
            fi

            if [[ -n "$session_id" ]]; then
                echo "🗺️  User Journey for session '$session_id' in $service"
                echo "═══════════════════════════════════════════════════════"
                tsm journey "$service" "$session_id"
            else
                echo "🗺️  Recent User Journeys for $service"
                echo "════════════════════════════════════"
                tsm journey "$service"
            fi
            ;;
        *)
            echo "Unknown sessions command: $cmd"
            echo "Use '/sessions help' for available commands"
            ;;
    esac
}

# Main help - concise, colorful, with sections
tsm_cmd_help() {
    local topic="$1"

    # If topic provided, dispatch to topic handler
    if [[ -n "$topic" ]]; then
        if [[ -n "${REPL_HELP_TOPICS[$topic]:-}" ]]; then
            "${REPL_HELP_TOPICS[$topic]}"
            return 0
        else
            echo -e "\033[0;31m✗\033[0m Unknown help topic: \033[1;33m$topic\033[0m"
            echo -e "Available topics: \033[0;36mcommands\033[0m, \033[0;36msystem\033[0m, \033[0;36mrepl\033[0m, \033[0;36mexamples\033[0m"
            echo ""
        fi
    fi

    # Main help (concise, colorful, no borders)
    echo -e "\033[1;37mTSM Interactive REPL\033[0m"
    echo ""
    echo -e "\033[1;33m◆ Process Management\033[0m"
    echo -e "  \033[0;32mlist\033[0m, \033[0;32mls\033[0m              List running processes"
    echo -e "  \033[0;32mstart\033[0m <cmd>           Start a service/command"
    echo -e "  \033[0;32mstop\033[0m <process|id>     Stop a process"
    echo -e "  \033[0;32mrestart\033[0m <process|id>  Restart a process"
    echo -e "  \033[0;32mlogs\033[0m <process> [-f]   Show/follow process logs"
    echo ""
    echo -e "\033[1;33m◆ Quick Actions\033[0m"
    echo -e "  \033[0;32mports\033[0m                 Show port mappings"
    echo -e "  \033[0;32mkill\033[0m <process>        Kill/delete process"
    echo -e "  \033[0;32mdoctor\033[0m [cmd]          System diagnostics"
    echo -e "  \033[0;32mlast\033[0m [n]              Show last command output"
    echo ""
    echo -e "\033[1;33m◆ Shell & Navigation\033[0m"
    echo -e "  \033[0;35m!\033[0m<cmd>                Execute shell command"
    echo -e "  \033[0;32mexit\033[0m, \033[0;32mquit\033[0m, \033[0;32mq\033[0m         Quit REPL"
    echo ""
    echo -e "\033[1;33m◆ More Help\033[0m"
    echo -e "  \033[0;36mhelp commands\033[0m         All TSM commands"
    echo -e "  \033[0;36mhelp system\033[0m           System/diagnostics commands"
    echo -e "  \033[0;36mhelp repl\033[0m             REPL features & modes"
    echo -e "  \033[0;36mhelp examples\033[0m         Common usage examples"
    echo ""
}

# Help: commands topic
tsm_cmd_help_commands() {
    echo -e "\033[1;37mTSM Commands Reference\033[0m"
    echo ""
    echo -e "\033[1;33m◆ Process Lifecycle\033[0m"
    echo -e "  \033[0;32mstart\033[0m [--env ENV] <cmd> [name]  Start script/command"
    echo -e "  \033[0;32mstop\033[0m <process|id|*>            Stop processes"
    echo -e "  \033[0;32mrestart\033[0m <process|id|*>         Restart processes"
    echo -e "  \033[0;32mkill\033[0m <process|id|*>            Delete processes and logs"
    echo ""
    echo -e "\033[1;33m◆ Process Information\033[0m"
    echo -e "  \033[0;32mlist\033[0m, \033[0;32mls\033[0m                      List running processes"
    echo -e "  \033[0;32minfo\033[0m <process|id>              Detailed process info"
    echo -e "  \033[0;32mlogs\033[0m <process|id> [-f]         Show logs (-f to follow)"
    echo -e "  \033[0;32menv\033[0m <process|id>               Show process environment"
    echo -e "  \033[0;32mpaths\033[0m <process|id>             Show process file paths"
    echo ""
    echo -e "\033[1;33m◆ Port Management\033[0m"
    echo -e "  \033[0;32mports\033[0m                          List port mappings"
    echo -e "  \033[0;32mports overview\033[0m                 Port status overview"
    echo -e "  \033[0;32mports conflicts\033[0m                Find port conflicts"
    echo ""
    echo -e "\033[0;90mMore:\033[0m \033[0;36mhelp system\033[0m, \033[0;36mhelp repl\033[0m, \033[0;36mhelp examples\033[0m"
    echo ""
}

# Help: system topic
tsm_cmd_help_system() {
    echo -e "\033[1;37mSystem & Diagnostics\033[0m"
    echo ""
    echo -e "\033[1;33m◆ Health & Diagnostics\033[0m"
    echo -e "  \033[0;32mdoctor\033[0m                       Quick health check"
    echo -e "  \033[0;32mdoctor healthcheck\033[0m           Full system validation"
    echo -e "  \033[0;32mdoctor scan\033[0m                  Scan ports and diagnose"
    echo -e "  \033[0;32mdoctor orphans\033[0m               Find orphaned processes"
    echo -e "  \033[0;32mdoctor clean\033[0m                 Clean stale files"
    echo ""
    echo -e "\033[1;33m◆ System Info\033[0m"
    echo -e "  \033[0;32mps\033[0m                           System processes (top 20)"
    echo -e "  \033[0;32mdisk\033[0m                         Disk usage"
    echo -e "  \033[0;32mmem\033[0m                          Memory usage"
    echo -e "  \033[0;32menv\033[0m                          Environment variables"
    echo ""
    echo -e "\033[1;33m◆ Analytics\033[0m"
    echo -e "  \033[0;32msessions help\033[0m                Session analytics help"
    echo -e "  \033[0;32msessions summary\033[0m             Session summary"
    echo -e "  \033[0;32mlast\033[0m [n]                     Show last command output"
    echo ""
    echo -e "\033[0;90mMore:\033[0m \033[0;36mhelp commands\033[0m, \033[0;36mhelp repl\033[0m, \033[0;36mhelp examples\033[0m"
    echo ""
}

# Help: repl topic
tsm_cmd_help_repl() {
    echo -e "\033[1;37mREPL Features\033[0m"
    echo ""
    echo -e "\033[1;33m◆ Execution Mode\033[0m"
    echo -e "  Currently in: \033[1;32mREPL mode\033[0m"
    echo -e "  • Commands are \033[0;32mTSM by default\033[0m"
    echo -e "  • Use \033[0;35m!\033[0m<cmd> for shell commands"
    echo ""
    echo -e "\033[1;33m◆ Prompt Colors\033[0m"
    echo -e "  \033[0;31m●\033[0mN tsm>  Red: No services"
    echo -e "  \033[1;33m●\033[0mN tsm>  Yellow: 1-4 services"
    echo -e "  \033[0;32m●\033[0mN tsm>  Green: 5+ services"
    echo ""
    echo -e "\033[1;33m◆ Built-in Commands\033[0m"
    echo -e "  \033[0;32mhelp\033[0m [topic]       Show help"
    echo -e "  \033[0;32mexit\033[0m, \033[0;32mquit\033[0m, \033[0;32mq\033[0m      Exit REPL"
    echo -e "  \033[0;32mhistory\033[0m [n]        Show command history"
    echo -e "  \033[0;32mclear\033[0m              Clear screen"
    echo -e "  \033[0;32mreload\033[0m             Reload TSM modules"
    echo ""
    echo -e "\033[0;90mMore:\033[0m \033[0;36mhelp commands\033[0m, \033[0;36mhelp system\033[0m, \033[0;36mhelp examples\033[0m"
    echo ""
}

# Help: examples topic
tsm_cmd_help_examples() {
    echo -e "\033[1;37mUsage Examples\033[0m"
    echo ""
    echo -e "\033[1;33m◆ Starting Services\033[0m"
    echo -e "  \033[0;32mstart\033[0m server.js              Start a node server"
    echo -e "  \033[0;32mstart\033[0m --env dev.env app.sh  Start with environment"
    echo -e "  \033[0;32mstart\033[0m devpages              Start named service"
    echo ""
    echo -e "\033[1;33m◆ Managing Processes\033[0m"
    echo -e "  \033[0;32mlist\033[0m                        Show running processes"
    echo -e "  \033[0;32mlogs\033[0m devpages-4444 -f       Follow devpages logs"
    echo -e "  \033[0;32mstop\033[0m 0                      Stop process ID 0"
    echo -e "  \033[0;32mkill\033[0m *                      Kill all processes"
    echo ""
    echo -e "\033[1;33m◆ Diagnostics\033[0m"
    echo -e "  \033[0;32mdoctor healthcheck\033[0m          Full system check"
    echo -e "  \033[0;32mdoctor orphans\033[0m              Find orphaned processes"
    echo -e "  \033[0;32mports conflicts\033[0m             Check port conflicts"
    echo ""
    echo -e "\033[1;33m◆ Shell Commands\033[0m"
    echo -e "  \033[0;35m!\033[0mps aux                     Shell ps command"
    echo -e "  \033[0;35m!\033[0mls -la                     Shell ls command"
    echo ""
    echo -e "\033[0;90mMore:\033[0m \033[0;36mhelp commands\033[0m, \033[0;36mhelp system\033[0m, \033[0;36mhelp repl\033[0m"
    echo ""
}

# History command
tsm_cmd_history() {
    local n="${1:-20}"
    local hist_file="${TETRA_DIR}/tsm/repl_history.tsm"

    echo -e "\033[0;36m╭─────────────────────────────────────────────╮\033[0m"
    echo -e "\033[0;36m│\033[0m \033[1;37mCommand History\033[0m (last $n commands)      \033[0;36m│\033[0m"
    echo -e "\033[0;36m╰─────────────────────────────────────────────╯\033[0m"
    echo ""

    if [[ -f "$hist_file" ]]; then
        tail -n "$n" "$hist_file" | nl -w3 -s':  ' | sed 's/^/  /'
    else
        echo -e "  \033[0;90mNo history available\033[0m"
    fi
    echo ""
}

# Clear screen command
tsm_cmd_clear() {
    clear
}

# Reload TSM modules
tsm_cmd_reload() {
    echo -e "\033[1;36m♻️  Reloading TSM modules...\033[0m"

    # Unset all tetra_tsm_* functions to ensure clean reload
    local func_count=0
    for func in $(declare -F | grep "tetra_tsm_" | awk '{print $3}'); do
        unset -f "$func" 2>/dev/null
        ((func_count++))
    done

    # Reload TSM core
    if [[ -f "$TETRA_SRC/bash/tsm/tsm.sh" ]]; then
        source "$TETRA_SRC/bash/tsm/tsm.sh"
        echo -e "\033[0;32m✅ Reloaded TSM core ($func_count functions cleared)\033[0m"
    else
        echo -e "\033[0;31m❌ Failed to reload: $TETRA_SRC/bash/tsm/tsm.sh not found\033[0m"
        return 1
    fi

    echo -e "\033[0;90m   Updated functions are now available\033[0m"
    echo ""
}

# Legacy tsm-help command (redirect to hierarchical help)
tsm_cmd_tsm_help() {
    echo -e "\033[1;33m→\033[0m TSM help is now hierarchical. Try:"
    echo -e "  \033[0;36mhelp\033[0m              Main help"
    echo -e "  \033[0;36mhelp commands\033[0m     All TSM commands"
    echo -e "  \033[0;36mhelp system\033[0m       System & diagnostics"
    echo -e "  \033[0;36mhelp repl\033[0m         REPL features"
    echo -e "  \033[0;36mhelp examples\033[0m     Usage examples"
    echo ""
    tsm_cmd_help
}

# === REGISTRATION ===

# Register prompt builders
repl_register_prompt_builder "status" "tsm_prompt_status"
repl_register_prompt_builder "base" "tsm_prompt_base"

# Register TSM slash commands with bash/repl (proper integration)
# These work as /command in any mode
repl_register_slash_command "help" "tsm_cmd_help"
repl_register_slash_command "list" "tsm_cmd_list"
repl_register_slash_command "ls" "tsm_cmd_list"
repl_register_slash_command "kill" "tsm_cmd_kill"
repl_register_slash_command "last" "tsm_cmd_last"
repl_register_slash_command "ps" "tsm_cmd_ps"
repl_register_slash_command "disk" "tsm_cmd_disk"
repl_register_slash_command "mem" "tsm_cmd_mem"
repl_register_slash_command "env" "tsm_cmd_env"
repl_register_slash_command "orphans" "tsm_cmd_orphans"
repl_register_slash_command "clean" "tsm_cmd_clean"
repl_register_slash_command "validate" "tsm_cmd_validate"
repl_register_slash_command "doctor" "tsm_cmd_doctor"
repl_register_slash_command "json" "tsm_cmd_json"
repl_register_slash_command "tview" "tsm_cmd_tview"
repl_register_slash_command "sessions" "tsm_cmd_sessions"
repl_register_slash_command "history" "tsm_cmd_history"
repl_register_slash_command "clear" "tsm_cmd_clear"
repl_register_slash_command "reload" "tsm_cmd_reload"
repl_register_slash_command "tsm-help" "tsm_cmd_tsm_help"

# Register help topics as separate handlers
declare -g -A REPL_HELP_TOPICS
REPL_HELP_TOPICS["commands"]="tsm_cmd_help_commands"
REPL_HELP_TOPICS["system"]="tsm_cmd_help_system"
REPL_HELP_TOPICS["repl"]="tsm_cmd_help_repl"
REPL_HELP_TOPICS["examples"]="tsm_cmd_help_examples"

# === OVERRIDE BASH/REPL INPUT PROCESSOR (Minimal Override) ===

# Minimal override: let bash/repl handle slash commands and shell escapes,
# but route non-slash commands to tsm by default (TSM takeover mode)
_tsm_define_input_processor() {
    repl_process_input() {
        local input="$1"

        # Handle empty input
        [[ -z "$input" ]] && return 0

        # TSM TAKEOVER MODE: TSM commands by default
        # The repl library is now always in "hybrid" mode, but TSM overrides
        # the input processor to make TSM commands the default

        # Shell escape (!) - execute shell command
        # SECURITY NOTE: This feature allows arbitrary command execution
        # This is intentional for interactive REPL usage (similar to IPython's ! syntax)
        # Only use this REPL in trusted environments with trusted users
        if [[ "${input:0:1}" == "!" ]]; then
            eval "${input#!}"
            return 0
        fi

        # Slash commands - delegate to bash/repl's dispatcher
        # This will check REPL_SLASH_HANDLERS first, then built-ins
        if [[ "$input" == /* ]]; then
            repl_dispatch_slash "${input#/}"
            return $?
        fi

        # Exit commands (built-in)
        case "$input" in
            exit|quit|q)
                return 1  # Signal exit
                ;;
        esac

        # Default: pass to tsm (our module command handler)
        tsm $input
        return 0
    }
}

# === MAIN ENTRY POINT ===

tsm_repl_main() {
    echo "TSM Interactive REPL"
    echo "Type 'help' for commands, 'help <topic>' for details"
    echo "Use !<cmd> for shell commands"
    echo "Type 'quit' or 'exit' or press Ctrl-D to quit"
    echo ""


    # Define the input processor NOW, after all handlers are registered
    # This overrides the default repl input processor to make TSM commands default
    _tsm_define_input_processor

    # Set history base
    REPL_HISTORY_BASE="${TETRA_DIR}/tsm/repl_history"

    # Run bash/repl (auto-detects best mode: basic/enhanced/tui)
    # Our overridden repl_process_input will handle all commands
    repl_run
}

# Export main function for tsm.sh integration
export -f tsm_repl_main

# If script is run directly, start REPL
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Ensure TETRA_SRC is set
    if [[ -z "$TETRA_SRC" ]]; then
        if [[ -f "$HOME/tetra/tetra.sh" ]]; then
            source "$HOME/tetra/tetra.sh"
        else
            echo "Error: TETRA_SRC not set. Source tetra.sh first." >&2
            exit 1
        fi
    fi

    tsm_repl_main "$@"
fi
