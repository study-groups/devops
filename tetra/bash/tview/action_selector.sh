#!/usr/bin/env bash

# TView Action Selector - Clean action-centric interface
# Shows available actions for current Env x Mode with help text and position

# Action selector state
declare -gA ACTION_SELECTOR=(
    ["current_index"]="0"
    ["total_actions"]="0"
    ["show_content"]="false"
)

# Action definitions for each Env x Mode combination
declare -gA ACTIONS=(
    # TETRA environment actions
    ["TOML:TETRA"]="edit_config|Edit TOML configuration|Opens TOML editor for tetra.toml"
    ["TSM:TETRA"]="list_services|List all services|Shows running and stopped services"
    ["TKM:TETRA"]="show_modules|Show loaded modules|Display currently loaded Tetra modules"

    # LOCAL environment actions
    ["TOML:LOCAL"]="edit_local|Edit local config|Opens local environment settings"
    ["TSM:LOCAL"]="local_services|Local services|Manage local development services"

    # DEV environment actions
    ["TOML:DEV"]="edit_dev|Edit DEV config|Configure DEV environment settings"
    ["TSM:DEV"]="deploy_dev|Deploy to DEV|Deploy current branch to DEV server"
    ["SSH:DEV"]="connect_dev|Connect to DEV|SSH into DEV server"

    # STAGING environment actions
    ["TOML:STAGING"]="edit_staging|Edit staging config|Configure staging environment"
    ["TSM:STAGING"]="deploy_staging|Deploy to staging|Deploy to staging environment"
    ["SSH:STAGING"]="connect_staging|Connect to staging|SSH into staging server"

    # PROD environment actions
    ["TOML:PROD"]="edit_prod|Edit PROD config|Configure production environment"
    ["TSM:PROD"]="deploy_prod|Deploy to PROD|Deploy to production (careful!)"
    ["SSH:PROD"]="connect_prod|Connect to PROD|SSH into production server"
)

# Get actions for current environment and mode
get_current_actions() {
    local env="$1"
    local mode="$2"
    local actions=()

    # Find all actions matching current env:mode
    for key in "${!ACTIONS[@]}"; do
        if [[ "$key" == "$mode:$env" ]]; then
            actions+=("${ACTIONS[$key]}")
        fi
    done

    # If no specific actions, show generic ones
    if [[ ${#actions[@]} -eq 0 ]]; then
        actions=("help|Show help|Display available commands")
    fi

    printf '%s\n' "${actions[@]}"
}

# Parse action string (action_id|name|description)
parse_action() {
    local action_string="$1"
    local part="$2"  # 0=id, 1=name, 2=description

    echo "$action_string" | cut -d'|' -f$((part + 1))
}

# Render action selector header
render_action_selector() {
    local env="$CURRENT_ENV"
    local mode="$CURRENT_MODE"
    local current_index="${ACTION_SELECTOR[current_index]}"

    # Get current actions
    local -a current_actions
    mapfile -t current_actions < <(get_current_actions "$env" "$mode")
    ACTION_SELECTOR["total_actions"]="${#current_actions[@]}"

    # Ensure index is within bounds
    if [[ $current_index -ge ${#current_actions[@]} ]]; then
        current_index=0
        ACTION_SELECTOR["current_index"]="0"
    fi

    echo "╭─ $env × $mode Actions ─────────────────────────────────────────────────────────╮"

    # Show actions with current one highlighted
    for i in "${!current_actions[@]}"; do
        local action="${current_actions[$i]}"
        local action_name
        local action_desc
        action_name=$(parse_action "$action" 1)
        action_desc=$(parse_action "$action" 2)

        if [[ $i -eq $current_index ]]; then
            # Highlighted action
            printf "│ → %-20s %s%s%s (%d/%d) │\n" \
                "$action_name" \
                "$GRAY" "$action_desc" "$RESET" \
                "$((current_index + 1))" "${#current_actions[@]}"
        else
            # Non-highlighted action
            printf "│   %-20s %s%s%s        │\n" \
                "$action_name" \
                "$DIM_GRAY" "$action_desc" "$RESET"
        fi
    done

    echo "╰─ i/k:navigate  l:execute  j:back  q:quit ────────────────────────────────────╯"
    echo ""
}

# Navigate through actions
navigate_action_selector() {
    local direction="$1"
    local current_index="${ACTION_SELECTOR[current_index]}"
    local total_actions="${ACTION_SELECTOR[total_actions]}"

    case "$direction" in
        "up")
            if [[ $current_index -gt 0 ]]; then
                ACTION_SELECTOR["current_index"]="$((current_index - 1))"
            fi
            ;;
        "down")
            if [[ $current_index -lt $((total_actions - 1)) ]]; then
                ACTION_SELECTOR["current_index"]="$((current_index + 1))"
            fi
            ;;
    esac
}

# Execute selected action
execute_selected_action() {
    local env="$CURRENT_ENV"
    local mode="$CURRENT_MODE"
    local current_index="${ACTION_SELECTOR[current_index]}"

    # Get current actions
    local -a current_actions
    mapfile -t current_actions < <(get_current_actions "$env" "$mode")

    if [[ $current_index -lt ${#current_actions[@]} ]]; then
        local action="${current_actions[$current_index]}"
        local action_id
        action_id=$(parse_action "$action" 0)

        # Execute the action
        execute_action "$action_id" "$env" "$mode"

        # Show content area after execution
        ACTION_SELECTOR["show_content"]="true"
    fi
}

# Execute specific action (to be implemented by TView)
execute_action() {
    local action_id="$1"
    local env="$2"
    local mode="$3"

    case "$action_id" in
        "edit_config"|"edit_local"|"edit_dev"|"edit_staging"|"edit_prod")
            # Launch TOML editor
            if command -v start_toml_editor_takeover >/dev/null 2>&1; then
                start_toml_editor_takeover
            fi
            ;;
        "list_services"|"local_services")
            # Show TSM services
            echo "Loading services..."
            ;;
        "deploy_"*)
            # Deployment actions
            echo "Deploying to $env..."
            ;;
        "connect_"*)
            # SSH connections
            echo "Connecting to $env..."
            ;;
        "help")
            # Show help
            show_action_help
            ;;
        *)
            echo "Action not implemented: $action_id"
            ;;
    esac
}

# Show help for actions
show_action_help() {
    clear
    echo "TView Action System Help"
    echo "========================"
    echo ""
    echo "Navigation:"
    echo "  i/k     - Navigate up/down through actions"
    echo "  l       - Execute selected action"
    echo "  j       - Go back to environment/mode selection"
    echo "  q       - Quit TView"
    echo ""
    echo "Actions are context-sensitive based on:"
    echo "  Environment: TETRA, LOCAL, DEV, STAGING, PROD"
    echo "  Mode: TOML, TSM, TKM, SSH"
    echo ""
    echo "Press any key to continue..."
    read -n1 -s

    # Refresh screen after help
    clear
    if command -v redraw_screen >/dev/null 2>&1; then
        redraw_screen
    fi
}

# Initialize action selector
init_action_selector() {
    ACTION_SELECTOR["current_index"]="0"
    ACTION_SELECTOR["show_content"]="false"
}

# Export functions
export -f get_current_actions parse_action render_action_selector
export -f navigate_action_selector execute_selected_action execute_action
export -f show_action_help init_action_selector