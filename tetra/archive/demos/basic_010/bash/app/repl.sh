#!/usr/bin/env bash

# TUI REPL System - Bottom CLI Interface
# Responsibility: CLI positioning at bottom, input handling, line length control
# Never clears screen - only uses bottom region

# REPL state
REPL_HISTORY=()
REPL_HISTORY_INDEX=-1
REPL_INPUT=""
REPL_CURSOR_VISIBLE=true

# Web server state management
WEB_SERVER_PORT=8080
WEB_SERVER_PID_FILE="/tmp/tetra_demo_server.pid"
WEB_SERVER_RUNNING=false

# Source web server functions
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/../utils/serve_dashboard.sh" 2>/dev/null || true

# Web server management functions
is_web_server_running() {
    if [[ -f "$WEB_SERVER_PID_FILE" ]]; then
        local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 $pid 2>/dev/null; then
            WEB_SERVER_RUNNING=true
            return 0
        else
            rm -f "$WEB_SERVER_PID_FILE"
            WEB_SERVER_RUNNING=false
        fi
    fi
    return 1
}

start_web_server() {
    local port="${1:-$WEB_SERVER_PORT}"

    if is_web_server_running; then
        CONTENT="⚠️  Web server already running on port $WEB_SERVER_PORT"$'\n'
        CONTENT+="📱 Dashboard: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
        update_content_region
        return 1
    fi

    CONTENT="🚀 Starting web server on port $port..."$'\n'
    update_content_region

    # Generate fresh AST data
    bash "$SCRIPT_DIR/../utils/generate_ast_json.sh" >/dev/null 2>&1

    # Start server in background
    cd "$(dirname "$(dirname "$SCRIPT_DIR")")"  # Go to project root
    python3 -m http.server $port > /dev/null 2>&1 &
    local pid=$!

    # Save PID and port
    echo $pid > "$WEB_SERVER_PID_FILE"
    WEB_SERVER_PORT=$port

    # Wait and check if started
    sleep 1
    if kill -0 $pid 2>/dev/null; then
        WEB_SERVER_RUNNING=true
        CONTENT="✅ Web server started successfully"$'\n'
        CONTENT+="📱 Dashboard: http://localhost:$port/web/dashboard.html"$'\n'
        CONTENT+="🔧 Use 'web stop' to stop server"
    else
        CONTENT="❌ Failed to start web server"
        rm -f "$WEB_SERVER_PID_FILE"
        WEB_SERVER_RUNNING=false
    fi
    update_content_region
}

stop_web_server() {
    if ! is_web_server_running; then
        CONTENT="⚠️  Web server is not running"
        update_content_region
        return 1
    fi

    local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
    if [[ -n "$pid" ]] && kill -0 $pid 2>/dev/null; then
        CONTENT="🛑 Stopping web server (PID: $pid)..."$'\n'
        update_content_region
        kill $pid
        rm -f "$WEB_SERVER_PID_FILE"
        WEB_SERVER_RUNNING=false
        CONTENT="✅ Web server stopped"
    else
        CONTENT="❌ Could not stop server (invalid PID)"
        rm -f "$WEB_SERVER_PID_FILE"
        WEB_SERVER_RUNNING=false
    fi
    update_content_region
}

show_web_server_status() {
    if is_web_server_running; then
        local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
        CONTENT="✅ Web server is running"$'\n'
        CONTENT+="  PID: $pid"$'\n'
        CONTENT+="  Port: $WEB_SERVER_PORT"$'\n'
        CONTENT+="  URL: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"$'\n'
        CONTENT+="  Status: Active"
    else
        CONTENT="❌ Web server is not running"$'\n'
        CONTENT+="  Use 'web start [port]' to start server"
    fi
    update_content_region
}

restart_web_server() {
    local port="${1:-$WEB_SERVER_PORT}"
    CONTENT="🔄 Restarting web server..."$'\n'
    update_content_region
    stop_web_server
    sleep 1
    start_web_server "$port"
}

open_web_dashboard() {
    if ! is_web_server_running; then
        CONTENT="❌ Web server is not running. Start it first with 'web start'"
        update_content_region
        return 1
    fi

    if command -v open >/dev/null 2>&1; then
        open "http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
        CONTENT="🌐 Opening dashboard in browser..."$'\n'
        CONTENT+="📱 URL: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
    else
        CONTENT="🌐 Open manually: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"$'\n'
        CONTENT+="(Browser auto-open not available on this system)"
    fi
    update_content_region
}

refresh_web_data() {
    CONTENT="🔄 Refreshing web dashboard data..."$'\n'
    update_content_region
    if bash "$SCRIPT_DIR/../utils/generate_ast_json.sh" >/dev/null 2>&1; then
        CONTENT="✅ Web dashboard data refreshed"$'\n'
        CONTENT+="📊 AST data regenerated from current codebase"
    else
        CONTENT="❌ Failed to refresh web dashboard data"
    fi
    update_content_region
}

show_system_inspect() {
    # Check web server status for inspect
    is_web_server_running

    CONTENT="🔍 System State Inspection"$'\n'
    CONTENT+="========================"$'\n'
    CONTENT+=""$'\n'
    CONTENT+="📍 Current State:"$'\n'
    CONTENT+="  Environment: ${ENVIRONMENTS[$ENV_INDEX]} (index: $ENV_INDEX)"$'\n'
    CONTENT+="  Mode: ${MODES[$MODE_INDEX]} (index: $MODE_INDEX)"$'\n'
    CONTENT+="  Action: ${CURRENT_ACTION:-none} (index: ${ACTION_INDEX:-none})"$'\n'
    CONTENT+="  Input Mode: ${CURRENT_INPUT_MODE:-gamepad}"$'\n'
    CONTENT+=""$'\n'
    CONTENT+="🌐 Web Server:"$'\n'
    if [[ "$WEB_SERVER_RUNNING" == "true" ]]; then
        local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
        CONTENT+="  Status: ✅ Running (PID: $pid)"$'\n'
        CONTENT+="  Port: $WEB_SERVER_PORT"$'\n'
        CONTENT+="  URL: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"$'\n'
    else
        CONTENT+="  Status: ❌ Not running"$'\n'
        CONTENT+="  Last Port: $WEB_SERVER_PORT"$'\n'
    fi
    CONTENT+=""$'\n'
    CONTENT+="📂 Project Paths:"$'\n'
    CONTENT+="  Script Dir: $SCRIPT_DIR"$'\n'
    CONTENT+="  Project Root: $(dirname "$(dirname "$SCRIPT_DIR")")"$'\n'
    CONTENT+="  PID File: $WEB_SERVER_PID_FILE"$'\n'
    CONTENT+=""$'\n'
    CONTENT+="💾 REPL State:"$'\n'
    CONTENT+="  History Count: ${#REPL_HISTORY[@]}"$'\n'
    CONTENT+="  Current Input: '$REPL_INPUT'"$'\n'
    CONTENT+="  History Index: $REPL_HISTORY_INDEX"$'\n'

    update_content_region
}

# Get dynamic prompt based on current context
get_repl_prompt() {
    local env="${ENVIRONMENTS[$ENV_INDEX],,}"
    local mode="${MODES[$MODE_INDEX],,}"

    # Add web server status indicator
    local web_status=""
    if is_web_server_running >/dev/null 2>&1; then
        web_status="[web:$WEB_SERVER_PORT]"
    fi

    echo "${env}:${mode}${web_status}> "
}

# Show REPL prompt left-aligned above footer with solid cursor
show_repl_prompt() {
    local prompt=$(get_repl_prompt)

    # Position at REPL line (left-aligned)
    position_repl_input
    printf "%s%s" "$prompt" "$REPL_INPUT"

    # Show solid cursor
    if [[ "$REPL_CURSOR_VISIBLE" == "true" ]]; then
        printf "█"
    fi

    # Clear rest of line
    tput el
}

# Execute REPL command
execute_repl_command() {
    local input="$1"

    # Add to history
    REPL_HISTORY+=("$input")
    REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

    # Move to next line for output
    printf "\n"

    # Process command
    case "$input" in
        "exit"|"q"|"quit")
            return 1  # Signal to exit REPL
            ;;
        "help"|"h")
            show_repl_help
            ;;
        "clear"|"c")
            clear_cli_region
            update_content_region
            ;;
        "ls"|"list")
            show_actions_list
            ;;
        env*)
            local env_name="${input#env }"
            switch_environment "$env_name"
            ;;
        mode*)
            local mode_name="${input#mode }"
            switch_mode "$mode_name"
            ;;
        fire*)
            local action_name="${input#fire }"
            fire_action "$action_name"
            ;;
        web*)
            # Parse web subcommands
            local web_cmd="${input#web }"
            case "$web_cmd" in
                "start"|"start "*)
                    local port="${web_cmd#start }"
                    [[ "$port" == "start" ]] && port=""
                    start_web_server "$port"
                    ;;
                "stop")
                    stop_web_server
                    ;;
                "status")
                    show_web_server_status
                    ;;
                "restart"|"restart "*)
                    local port="${web_cmd#restart }"
                    [[ "$port" == "restart" ]] && port=""
                    restart_web_server "$port"
                    ;;
                "open")
                    open_web_dashboard
                    ;;
                "refresh")
                    refresh_web_data
                    ;;
                *)
                    CONTENT="❌ Unknown web command: $web_cmd"$'\n'
                    CONTENT+="Available: start [port], stop, status, restart [port], open, refresh"
                    update_content_region
                    ;;
            esac
            ;;
        "restart")
            CONTENT="🔄 Restarting TUI application..."$'\n'
            update_content_region
            sleep 1
            # Exit with special code to signal restart
            exit 42
            ;;
        "reload")
            CONTENT="🔄 Reloading modules and configuration..."$'\n'
            update_content_region
            # Re-source modules if needed
            source "$SCRIPT_DIR/../utils/serve_dashboard.sh" 2>/dev/null || true
            CONTENT="✅ Modules reloaded"
            update_content_region
            ;;
        "debug")
            CONTENT="🐛 Debug mode toggle - feature coming soon"
            update_content_region
            ;;
        "inspect")
            show_system_inspect
            ;;
        *)
            printf "Unknown command: %s (type 'help' for commands)\n" "$input"
            ;;
    esac

    return 0
}

# Show REPL help in content area (not CLI area)
show_repl_help() {
    # Check web server status for help display
    is_web_server_running

    CONTENT="🎮 REPL Commands"$'\n'
    CONTENT+="==============="$'\n'
    CONTENT+=""$'\n'
    CONTENT+="📍 Navigation:"$'\n'
    CONTENT+="  env <name>    - Switch environment (demo, local, remote)"$'\n'
    CONTENT+="  mode <name>   - Switch mode (learn, build, test)"$'\n'
    CONTENT+="  fire <action> - Execute action"$'\n'
    CONTENT+="  ls            - List current actions"$'\n'
    CONTENT+=""$'\n'
    CONTENT+="🌐 Web Server:"$'\n'
    CONTENT+="  web start [port] - Start dashboard server (default: 8080)"$'\n'
    CONTENT+="  web stop         - Stop dashboard server"$'\n'
    CONTENT+="  web status       - Show server status"$'\n'
    CONTENT+="  web restart [port] - Restart server"$'\n'
    CONTENT+="  web open         - Open dashboard in browser"$'\n'
    CONTENT+="  web refresh      - Regenerate AST discovery data"$'\n'

    if [[ "$WEB_SERVER_RUNNING" == "true" ]]; then
        CONTENT+="  Current: ✅ Running on port $WEB_SERVER_PORT"$'\n'
    else
        CONTENT+="  Current: ❌ Not running"$'\n'
    fi

    CONTENT+=""$'\n'
    CONTENT+="🔧 System:"$'\n'
    CONTENT+="  restart       - Restart TUI application"$'\n'
    CONTENT+="  reload        - Reload modules and config"$'\n'
    CONTENT+="  inspect       - Show system state"$'\n'
    CONTENT+="  clear         - Clear content"$'\n'
    CONTENT+="  help          - Show this help"$'\n'
    CONTENT+="  exit          - Return to gamepad mode"

    update_content_region
}

# Show actions list in content area
show_actions_list() {
    CONTENT="📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"$'\n'
    local actions=($(get_actions))
    for action in "${actions[@]}"; do
        CONTENT+="  • $action"$'\n'
    done

    update_content_region
}

# Switch environment via REPL
switch_environment() {
    local env_name="${1,,}"  # lowercase
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ "${ENVIRONMENTS[$i],,}" == "$env_name" ]]; then
            ENV_INDEX=$i
            ACTION_INDEX=0
            printf "Environment switched to: %s\n" "${ENVIRONMENTS[$ENV_INDEX]}"

            # Publish event for state synchronization
            if command -v publish >/dev/null 2>&1; then
                publish "env_changed" "${ENVIRONMENTS[$ENV_INDEX]}" "$ENV_INDEX"
            fi

            update_content_region
            return
        fi
    done
    printf "Unknown environment: %s\n" "$env_name"
}

# Switch mode via REPL
switch_mode() {
    local mode_name="${1,,}"  # lowercase
    for i in "${!MODES[@]}"; do
        if [[ "${MODES[$i],,}" == "$mode_name" ]]; then
            MODE_INDEX=$i
            ACTION_INDEX=0
            printf "Mode switched to: %s\n" "${MODES[$MODE_INDEX]}"

            # Publish event for state synchronization
            if command -v publish >/dev/null 2>&1; then
                publish "mode_changed" "${MODES[$MODE_INDEX]}" "$MODE_INDEX"
            fi

            update_content_region
            return
        fi
    done
    printf "Unknown mode: %s\n" "$mode_name"
}

# Fire action via REPL
fire_action() {
    local action_name="$1"
    local actions=($(get_actions))
    for i in "${!actions[@]}"; do
        if [[ "${actions[$i]}" == "$action_name" ]]; then
            ACTION_INDEX=$i
            printf "Executing: %s\n" "$action_name"

            # Publish event for state synchronization
            if command -v publish >/dev/null 2>&1; then
                publish "action_changed" "$action_name" "$ACTION_INDEX"
            fi

            execute_current_action
            return
        fi
    done
    printf "Unknown action: %s\n" "$action_name"
}

# Truncate input to prevent line wrapping
truncate_input() {
    local input="$1"
    local max_length="$2"

    if [[ ${#input} -gt $max_length ]]; then
        echo "${input:0:$max_length}"
    else
        echo "$input"
    fi
}

# Handle character input for REPL
handle_repl_char() {
    local key="$1"
    local term_width=${COLUMNS:-80}

    case "$key" in
        $'\n'|$'\r')  # Enter - execute command
            if [[ -n "$REPL_INPUT" ]]; then
                # Add to history
                REPL_HISTORY+=("$REPL_INPUT")
                REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

                # Execute command
                local cmd="$REPL_INPUT"
                REPL_INPUT=""

                # Clear prompt line before execution
                clear_repl_region

                if ! execute_repl_command "$cmd"; then
                    return 1  # Exit REPL
                fi
            fi
            ;;
        $'\177'|$'\b')  # Backspace
            if [[ ${#REPL_INPUT} -gt 0 ]]; then
                REPL_INPUT="${REPL_INPUT%?}"
            fi
            ;;
        $'\033')  # ESC - exit REPL
            return 1
            ;;
        *)  # Regular character
            if [[ -n "$key" ]] && [[ ${#key} -eq 1 ]]; then
                # Prevent wrapping by limiting input length
                local prompt=$(get_repl_prompt)
                local max_input_len=$((term_width - ${#prompt} - 10))  # Safety margin
                if [[ ${#REPL_INPUT} -lt $max_input_len ]]; then
                    REPL_INPUT+="$key"
                fi
            fi
            ;;
    esac

    return 0
}

# Main REPL loop for TUI mode
run_repl_loop() {
    # Show cursor when entering REPL mode
    show_cursor

    # Show initial content update to reflect REPL mode
    CONTENT="🎯 REPL Mode Active
Type commands below, ESC to return to gamepad"
    update_content_region

    while true; do
        local prompt=$(get_repl_prompt)
        local input

        # Position at REPL line and clear it
        position_repl_input
        printf "\033[K"  # Clear line using ANSI

        # Use readline with history support and proper line clearing
        if ! read -e -r -p "$prompt" input; then
            break
        fi

        # Clear REPL line after command entered using minimal escape sequence
        clear_repl_region

        # Add to bash history for this session
        if [[ -n "$input" ]]; then
            history -s "$input"
        fi

        # Handle ESC or empty input
        if [[ -z "$input" ]]; then
            continue
        fi

        # Check for ESC sequence (if user types 'esc' or similar)
        if [[ "$input" == "esc" || "$input" == "exit" || "$input" == "q" ]]; then
            break
        fi

        # Handle ESC key directly
        if [[ "$input" == $'\033' ]]; then
            break
        fi

        # Handle shell commands first (! prefix)
        if [[ "$input" == !* ]]; then
            local cmd="${input#!}"
            FOOTER_CONTENT="Shell: $cmd
$(eval "$cmd" 2>&1 | head -3)"
            update_footer_region
            continue
        fi

        # Execute REPL commands (no / prefix needed)
        case "$input" in
            "clear")
                FOOTER_CONTENT=""
                update_footer_region
                ;;
            "help")
                CONTENT="🎮 REPL Commands:
  env [name]    - Switch environment or list all
  mode [name]   - Switch mode or list all
  fire <action> - Execute action
  ls            - List current actions
  status        - Show system status
  ui            - Design token system
  clear         - Clear footer
  !<command>    - Execute shell command
  exit/esc      - Return to gamepad mode"
                ;;
            "status")
                CONTENT="📊 System Status:
  Environment: ${ENVIRONMENTS[$ENV_INDEX]}
  Mode: ${MODES[$MODE_INDEX]}
  Module: module/tview/$(echo "${MODES[$MODE_INDEX]}" | tr '[:upper:]' '[:lower:]')
  Actions: $(get_actions | wc -l) available
  REPL: v009 TUI mode"
                ;;
            "ui")
                CONTENT="$(cat help/ui_commands.txt 2>/dev/null || echo "UI commands help not available")"
                ;;
            ui*)
                local ui_args=($input)
                if [[ "${ui_args[1]}" == "palette" ]]; then
                    # Use the new gold standard palette.sh
                    CONTENT="🎨 Gold Standard Color Palette System:
$(./modules/colors/palette.sh 2>/dev/null || echo "Dynamic palette system with ENV, MODE, VERBS, NOUNS
Four sections: desaturated both, bg desaturated, brightness fade, fg only")"
                elif [[ "${ui_args[1]}" == "theme" && ${#ui_args[@]} -eq 2 ]]; then
                    local theme_name="${ui_args[2]}"
                    case "$theme_name" in
                        "light"|"dark"|"solarized")
                            set_theme "$theme_name"
                            CONTENT="✅ Set theme to $theme_name"
                            update_content_region
                            update_gamepad_display
                            ;;
                        *)
                            CONTENT="❌ Unknown theme: $theme_name - use: light, dark, solarized"
                            ;;
                    esac
                elif [[ "${ui_args[1]}" == "background" && ${#ui_args[@]} -eq 2 ]]; then
                    local bg_color="${ui_args[2]}"
                    set_screen_background "$bg_color"
                    CONTENT="✅ Set screen background to #$bg_color"
                    update_content_region
                    update_gamepad_display
                elif [[ "${ui_args[1]}" == "set" && ${#ui_args[@]} -eq 4 ]]; then
                    local category="${ui_args[2]}"
                    local color="${ui_args[3]}"
                    local hex="${ui_args[4]}"
                    case "$category" in
                        "env")
                            ENV_PRIMARY[$color]="$hex"
                            generate_complements ENV_PRIMARY ENV_COMPLEMENT
                            CONTENT="✅ Set env color $color to #$hex"
                            ;;
                        "mode")
                            MODE_PRIMARY[$color]="$hex"
                            generate_complements MODE_PRIMARY MODE_COMPLEMENT
                            CONTENT="✅ Set mode color $color to #$hex"
                            ;;
                        "tetra")
                            TETRA_PRIMARY[$color]="$hex"
                            generate_complements TETRA_PRIMARY TETRA_COMPLEMENT
                            CONTENT="✅ Set tetra color $color to #$hex"
                            ;;
                        *)
                            CONTENT="❌ Unknown category: $category (use: env, mode, tetra)"
                            ;;
                    esac
                elif [[ "${ui_args[1]}" == "assign" && ${#ui_args[@]} -eq 4 ]]; then
                    local category="${ui_args[2]}"
                    local element="${ui_args[3]}"
                    local color="${ui_args[4]}"
                    case "$category" in
                        "env")
                            case "$element" in
                                "label") UI_ASSIGNMENTS[env_label]="$color" ;;
                                "selected") UI_ASSIGNMENTS[env_selected]="$color" ;;
                                "other") UI_ASSIGNMENTS[env_other]="$color" ;;
                                *) CONTENT="❌ Unknown element: $element (use: label, selected, other)"; continue ;;
                            esac
                            CONTENT="✅ Assigned env $element to color $color"
                            ;;
                        "mode")
                            case "$element" in
                                "label") UI_ASSIGNMENTS[mode_label]="$color" ;;
                                "selected") UI_ASSIGNMENTS[mode_selected]="$color" ;;
                                "other") UI_ASSIGNMENTS[mode_other]="$color" ;;
                                *) CONTENT="❌ Unknown element: $element (use: label, selected, other)"; continue ;;
                            esac
                            CONTENT="✅ Assigned mode $element to color $color"
                            ;;
                        "action")
                            case "$element" in
                                "label") UI_ASSIGNMENTS[action_label]="$color" ;;
                                "selected") UI_ASSIGNMENTS[action_selected]="$color" ;;
                                "other") UI_ASSIGNMENTS[action_other]="$color" ;;
                                *) CONTENT="❌ Unknown element: $element (use: label, selected, other)"; continue ;;
                            esac
                            CONTENT="✅ Assigned action $element to color $color"
                            ;;
                        *)
                            CONTENT="❌ Unknown category: $category - use: env, mode, action"
                            ;;
                    esac
                else
                    CONTENT="🎨 UI Commands:
  ui            - Show design tokens and assignments
  ui palette    - Show gold standard color palette system
  ui theme NAME - Set screen theme: light, dark, solarized
  ui background HEX - Set screen background color
  ui set CATEGORY COLOR HEX - Set color value
  ui assign CATEGORY ELEMENT COLOR - Assign UI colors

Examples:
  ui theme dark
  ui background 001122
  ui set env forest 22AA22
  ui assign env label mint"
                fi
                ;;
            "env")
                CONTENT="🌍 Available environments:"
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ $i -eq $ENV_INDEX ]]; then
                        CONTENT+="
  • ${ENVIRONMENTS[$i]} (current)"
                    else
                        CONTENT+="
  • ${ENVIRONMENTS[$i]}"
                    fi
                done
                CONTENT+="
Usage: env <name>"
                ;;
            env*)
                local env_name="${input#env }"
                env_name="${env_name// /}"
                env_name="${env_name,,}"
                local found=false
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ "${ENVIRONMENTS[$i],,}" == "$env_name" ]]; then
                        ENV_INDEX=$i
                        ACTION_INDEX=0
                        CONTENT="Environment switched to: ${ENVIRONMENTS[$ENV_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    CONTENT="Unknown environment: $env_name
Available: ${ENVIRONMENTS[*],,}"
                fi
                ;;
            "mode")
                CONTENT="🔧 Available modes:"
                for i in "${!MODES[@]}"; do
                    if [[ $i -eq $MODE_INDEX ]]; then
                        CONTENT+="
  • ${MODES[$i]} (current)"
                    else
                        CONTENT+="
  • ${MODES[$i]}"
                    fi
                done
                CONTENT+="
Usage: mode <name>"
                ;;
            mode*)
                local mode_name="${input#mode }"
                mode_name="${mode_name// /}"
                mode_name="${mode_name,,}"
                local found=false
                for i in "${!MODES[@]}"; do
                    if [[ "${MODES[$i],,}" == "$mode_name" ]]; then
                        MODE_INDEX=$i
                        ACTION_INDEX=0
                        CONTENT="Mode switched to: ${MODES[$MODE_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    CONTENT="Unknown mode: $mode_name
Available: ${MODES[*],,}"
                fi
                ;;
            "ls")
                CONTENT="📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                local actions=($(get_actions))
                for action in "${actions[@]}"; do
                    CONTENT+="
  • $action"
                done
                ;;
            fire*)
                local action_name="${input#fire }"
                local actions=($(get_actions))
                local found=false
                for i in "${!actions[@]}"; do
                    if [[ "${actions[$i]}" == "$action_name" ]]; then
                        ACTION_INDEX=$i
                        execute_current_action
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    CONTENT="Unknown action: $action_name
Available: ${actions[*]}"
                fi
                ;;
            *)
                CONTENT="Unknown command: $input
Type '/help' for commands, 'exit' to return to gamepad"
                ;;
        esac

        # Update content region with results
        update_content_region
    done

    # Clean up and return to gamepad mode
    switch_to_gamepad_mode
    clear_repl_region
    hide_cursor
}