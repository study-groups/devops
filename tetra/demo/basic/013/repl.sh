#!/usr/bin/env bash

# REPL Command Execution for Demo 013

# Execute REPL command
execute_repl_command() {
    local input="$1"

    case "$input" in
        help|h|\?)
            TUI_BUFFERS["@tui[content]"]="REPL Help
────────────────────────────────────────
Commands:
  help              Show this help
  env [name]        Switch environment (APP, DEV)
  mode [name]       Switch mode (Learn, Try, Test)
  fire <action>     Execute action (e.g., fire show:demo)
  list              List available actions
  exit              Exit REPL mode (or 'q')

Examples:
  env DEV           Switch to DEV environment
  mode Test         Switch to Test mode
  fire show:demo    Execute show:demo action
  list              Show all actions"
            ;;

        env*)
            local env_name="${input#env }"
            env_name="${env_name// /}"
            for i in "${!ENVIRONMENTS[@]}"; do
                if [[ "${ENVIRONMENTS[$i],,}" == "${env_name,,}" ]]; then
                    ENV_INDEX=$i
                    MODE_INDEX=0
                    ACTION_INDEX=0
                    TUI_BUFFERS["@tui[content]"]="Switched to environment: ${ENVIRONMENTS[$i]}"
                    return
                fi
            done
            TUI_BUFFERS["@tui[content]"]="Unknown environment: $env_name
Available: ${ENVIRONMENTS[*]}"
            ;;

        mode*)
            local mode_name="${input#mode }"
            mode_name="${mode_name// /}"
            local current_modes=($(get_current_modes))
            for i in "${!current_modes[@]}"; do
                if [[ "${current_modes[$i],,}" == "${mode_name,,}" ]]; then
                    MODE_INDEX=$i
                    ACTION_INDEX=0
                    TUI_BUFFERS["@tui[content]"]="Switched to mode: ${current_modes[$i]}"
                    return
                fi
            done
            TUI_BUFFERS["@tui[content]"]="Unknown mode: $mode_name
Available: ${current_modes[*]}"
            ;;

        fire*)
            local action_name="${input#fire }"
            action_name="${action_name// /}"
            local actions=($(get_actions))
            for i in "${!actions[@]}"; do
                if [[ "${actions[$i]}" == "$action_name" ]]; then
                    ACTION_INDEX=$i
                    execute_current_action
                    return
                fi
            done
            TUI_BUFFERS["@tui[content]"]="Unknown action: $action_name
Use 'list' to see available actions"
            ;;

        list|ls)
            local actions=($(get_actions))
            local content="Available Actions
────────────────────────────────────────

"
            for i in "${!actions[@]}"; do
                local action="${actions[$i]}"
                if [[ $i -eq $ACTION_INDEX ]]; then
                    content+="► $((i+1)). $action (current)
"
                else
                    content+="  $((i+1)). $action
"
                fi
            done
            TUI_BUFFERS["@tui[content]"]="$content"
            ;;

        "")
            # Empty input - do nothing
            ;;

        *)
            TUI_BUFFERS["@tui[content]"]="Unknown command: $input
Type 'help' for available commands"
            ;;
    esac
}
