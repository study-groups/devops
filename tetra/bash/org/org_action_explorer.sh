#!/usr/bin/env bash
# org_action_explorer.sh - Interactive menu for exploring and selecting actions

# Action descriptions for better UX
declare -A ORG_ACTION_DESCRIPTIONS=(
    # Local:Inspect
    ["view:orgs"]="List all organizations and their status"
    ["view:toml"]="Display tetra.toml configuration file"
    ["view:secrets"]="Show secrets.env (keys only, values masked)"
    ["validate:toml"]="Check tetra.toml syntax and structure"
    ["list:templates"]="Show available organization templates"

    # Local:Transfer
    ["import:nh"]="Import configuration from NixOS host"
    ["import:json"]="Import configuration from JSON file"
    ["export:toml"]="Export current config to TOML"
    ["backup:org"]="Create backup of organization files"

    # Local:Execute
    ["compile:toml"]="Generate compiled tetra.toml"
    ["create:org"]="Create new organization"
    ["switch:org"]="Switch to different organization"
    ["refresh:config"]="Reload configuration from disk"

    # Dev:Inspect
    ["view:env"]="Show remote environment variables"
    ["check:connectivity"]="Test SSH connection to dev server"
    ["view:services"]="List running services on dev"

    # Dev:Transfer
    ["push:config"]="Push tetra.toml and secrets to dev"
    ["pull:config"]="Pull remote configuration from dev"
    ["sync:resources"]="Synchronize local and remote files"

    # Dev:Execute
    ["deploy:services"]="Deploy services to dev environment"
    ["restart:service"]="Restart a specific service"
    ["rollback:deployment"]="Rollback to previous deployment"

    # Staging:Inspect
    ["view:services"]="List running services on staging"

    # Staging:Transfer
    ["push:config"]="Push configuration to staging"
    ["pull:config"]="Pull configuration from staging"

    # Staging:Execute
    ["deploy:services"]="Deploy to staging environment"
    ["validate:deployment"]="Validate staging deployment"

    # Production:Inspect
    ["view:status"]="View production system status"

    # Production:Transfer
    ["pull:config"]="Pull configuration from production"
    ["backup:remote"]="Backup production configuration"

    # Production:Execute
    ["validate:deployment"]="Validate production deployment"
    ["check:health"]="Run health checks on production"
)

# Display action menu and return selected action
org_show_action_menu() {
    local env="${1:-Local}"
    local mode="${2:-Inspect}"

    # Get actions for current context
    local actions_str=$(org_get_actions "$env" "$mode")
    read -ra actions <<< "$actions_str"

    local action_count=${#actions[@]}

    if [[ $action_count -eq 0 ]]; then
        echo "No actions available for $env:$mode" >&2
        return 1
    fi

    # Clear screen and show menu
    clear

    # Header
    echo "╭───────────────────────────────────────────────────────────────╮"
    echo "│                    ACTION EXPLORER                            │"
    echo "├───────────────────────────────────────────────────────────────┤"
    echo "│  Environment: $env"
    echo "│  Mode:        $mode"
    echo "│  Actions:     $action_count available"
    echo "╰───────────────────────────────────────────────────────────────╯"
    echo ""

    # Display actions with numbers and descriptions
    local i=1
    for action in "${actions[@]}"; do
        local verb="${action%%:*}"
        local noun="${action##*:}"
        local desc="${ORG_ACTION_DESCRIPTIONS[$action]:-No description}"

        printf "%2d. %-20s %s\n" "$i" "$action" "$desc"
        ((i++))
    done

    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo ""
    echo "Select action [1-$action_count], or:"
    echo "  e - Change Environment  |  m - Change Mode  |  q - Cancel"
    echo ""
    printf "Choice: "

    # Read user choice
    local choice
    read -r choice

    case "$choice" in
        [0-9]*)
            if [[ $choice -ge 1 && $choice -le $action_count ]]; then
                local selected_action="${actions[$((choice - 1))]}"
                echo "$selected_action"
                return 0
            else
                echo "error:invalid_number" >&2
                return 1
            fi
            ;;
        e|E)
            echo "cycle:env"
            return 2
            ;;
        m|M)
            echo "cycle:mode"
            return 3
            ;;
        q|Q|"")
            echo "cancel"
            return 4
            ;;
        *)
            echo "error:invalid_choice" >&2
            return 1
            ;;
    esac
}

# Interactive action explorer with cycling
org_explore_actions() {
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]:-Local}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]:-Inspect}"

    while true; do
        local result
        result=$(org_show_action_menu "$env" "$mode")
        local exit_code=$?

        case "$exit_code" in
            0)
                # Valid action selected
                echo "$result"
                return 0
                ;;
            2)
                # Cycle environment
                ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % ${#ORG_REPL_ENVIRONMENTS[@]} ))
                env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
                continue
                ;;
            3)
                # Cycle mode
                ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % ${#ORG_REPL_MODES[@]} ))
                mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
                continue
                ;;
            4)
                # Cancelled
                return 1
                ;;
            *)
                # Error
                echo "" >&2
                echo "Invalid choice. Press ENTER to try again..." >&2
                read -r
                continue
                ;;
        esac
    done
}

# Compact inline action list (alternative to full menu)
org_show_actions_inline() {
    local env="${1:-Local}"
    local mode="${2:-Inspect}"

    local actions_str=$(org_get_actions "$env" "$mode")
    read -ra actions <<< "$actions_str"

    echo ""
    echo "Available actions for $env:$mode:"
    echo ""

    local i=1
    for action in "${actions[@]}"; do
        local desc="${ORG_ACTION_DESCRIPTIONS[$action]:-}"
        printf "  %d) %-18s %s\n" "$i" "$action" "$desc"
        ((i++))
    done
    echo ""
}

export -f org_show_action_menu
export -f org_explore_actions
export -f org_show_actions_inline
