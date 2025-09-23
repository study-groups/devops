#!/usr/bin/env bash

# TView Rendering - UI and display functions

# Render 4-line header with proper width constraints
render_header() {
    local terminal_width=${COLUMNS:-80}

    # Line 1: Compact brand + environment info
    local line1=""
    if [[ $terminal_width -le 80 ]]; then
        # Compact for 80 columns
        line1="${UI_BRAND_COLOR}${COLOR_BOLD}TVIEW${COLOR_RESET}"
        if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
            line1+=" ${UI_ACCENT_COLOR}${ACTIVE_ORG:0:12}${COLOR_RESET}"  # Truncate org name
        fi
        line1+=" | ${CURRENT_MODE}:${CURRENT_ENV}"
    else
        # Full for wide terminals
        line1="${UI_BRAND_COLOR}${COLOR_BOLD}TVIEW${COLOR_RESET}"
        if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
            line1+=" ${UI_ACCENT_COLOR}${COLOR_BOLD}$ACTIVE_ORG${COLOR_RESET}"
        elif [[ -n "$ACTIVE_TOML" ]]; then
            local short_toml=$(basename "$ACTIVE_TOML")
            line1+=" ${UI_ACCENT_COLOR}${COLOR_BOLD}$short_toml${COLOR_RESET}"
        fi

        if [[ $DRILL_LEVEL -eq 1 ]]; then
            line1+=" ${STATUS_WARNING_COLOR}${COLOR_BOLD}[DRILL]${COLOR_RESET}"
        fi

        local status_content=$(get_current_selection_context)
        local right_content="${TVIEW_HINT:-$status_content}"

        # Right-align status if it fits
        local left_length=$(echo -e "$line1" | sed 's/\x1b\[[0-9;]*m//g' | wc -c)
        local right_length=$(echo -e "$right_content" | sed 's/\x1b\[[0-9;]*m//g' | wc -c)
        if [[ $((left_length + right_length + 3)) -le $terminal_width ]]; then
            local spacing=$((terminal_width - left_length - right_length))
            line1=$(printf "%s%*s%s" "$line1" $spacing "" "$right_content")
        fi
    fi

    # Output line1 truncated to terminal width
    truncate_line "$line1" $terminal_width

    # Line 2: Environment navigation - compact
    local env_line="Env: "
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$CURRENT_ENV" ]]; then
            env_line+="$(render_env_badge "$env" "true") "
        else
            env_line+="$(render_env_badge "$env" "false") "
        fi
    done
    truncate_line "$env_line" $terminal_width

    # Line 3: Mode navigation with themed colors
    local mode_line="Mode: "
    for mode in "${MODES[@]}"; do
        if [[ "$mode" == "$CURRENT_MODE" ]]; then
            mode_line+="$(render_mode_badge "$mode" "true") "
        else
            mode_line+="$(render_mode_badge "$mode" "false") "
        fi
    done
    truncate_line "$mode_line" $terminal_width

    # Line 4: Action - compact semantic command
    local action_line="Action: "
    if [[ $terminal_width -le 80 ]]; then
        action_line+=$(generate_compact_action)
    else
        action_line+=$(generate_semantic_action)
    fi
    truncate_line "$action_line" $terminal_width
}

# Utility function to truncate lines with color codes
truncate_line() {
    local text="$1"
    local max_width="$2"

    # Calculate actual display width (strip ANSI codes)
    local display_text=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
    local display_width=${#display_text}

    if [[ $display_width -le $max_width ]]; then
        echo "$text"
    else
        # Truncate display text and add ellipsis
        local truncated_display="${display_text:0:$((max_width - 3))}..."
        echo "$truncated_display"
    fi
}

# Generate semantic action based on current cursor position
generate_semantic_action() {
    local env_lower=$(echo "$CURRENT_ENV" | tr '[:upper:]' '[:lower:]')

    case "$CURRENT_MODE:$CURRENT_ENV" in
        "RCM:SYSTEM")
            echo "Navigate to environment to see available remote commands"
            ;;
        "RCM:LOCAL")
            echo "tetra exec $(colorize_env "local" "LOCAL"): ${ACTION_VIEW_COLOR}direct execution${COLOR_RESET}"
            ;;
        "RCM:DEV"|"RCM:STAGING"|"RCM:PROD"|"RCM:QA")
            local selected_commands=($(printf '%s\n' "${!RCM_COMMANDS[@]}" | sort))
            if [[ $CURRENT_ITEM -lt ${#selected_commands[@]} ]]; then
                local cmd_name="${selected_commands[$CURRENT_ITEM]}"
                local ssh_prefix="${CURRENT_SSH_PREFIXES[${env_lower}_root]:-ssh root@${env_lower}.pixeljamarcade.com}"
                echo "tetra ssh $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): ${ACTION_SSH_COLOR}${ssh_prefix}${COLOR_RESET} '${RCM_COMMANDS[$cmd_name]}'"
            else
                echo "tetra ssh $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): No command selected"
            fi
            ;;
        "TOML:"*)
            echo "tetra config view $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): ${ACTION_VIEW_COLOR}inspect configuration${COLOR_RESET}"
            ;;
        "TKM:SYSTEM")
            echo "tetra keys overview: ${ACTION_VIEW_COLOR}show four amigos access${COLOR_RESET}"
            ;;
        "TKM:"*)
            echo "tetra keys $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): ${ACTION_SSH_COLOR}manage authentication${COLOR_RESET}"
            ;;
        "TSM:LOCAL")
            case $CURRENT_ITEM in
                0) echo "tetra service status $(colorize_env "LOCAL" "LOCAL"): ${ACTION_SERVICE_COLOR}local service manager${COLOR_RESET}" ;;
                1) echo "tetra config validate $(colorize_env "LOCAL" "LOCAL"): ${ACTION_CONFIG_COLOR}check local configuration${COLOR_RESET}" ;;
                2) echo "tetra service list $(colorize_env "LOCAL" "LOCAL"): ${ACTION_SERVICE_COLOR}show running services${COLOR_RESET}" ;;
                3) echo "tetra logs view $(colorize_env "LOCAL" "LOCAL"): ${ACTION_VIEW_COLOR}local service logs${COLOR_RESET}" ;;
                *) echo "tetra service manage $(colorize_env "LOCAL" "LOCAL"): ${ACTION_SERVICE_COLOR}local operations${COLOR_RESET}" ;;
            esac
            ;;
        "TSM:DEV")
            case $CURRENT_ITEM in
                0) echo "tetra ssh test $(colorize_env "DEV" "DEV"): ${ACTION_SSH_COLOR}${CURRENT_SSH_PREFIXES[dev_root]#ssh }${COLOR_RESET}" ;;
                1) echo "tetra service status $(colorize_env "DEV" "DEV"): ${ACTION_SERVICE_COLOR}systemctl status tetra.service${COLOR_RESET}" ;;
                2) echo "tetra service list $(colorize_env "DEV" "DEV"): ${ACTION_SERVICE_COLOR}tsm list${COLOR_RESET}" ;;
                3) echo "tetra logs tail $(colorize_env "DEV" "DEV"): ${ACTION_VIEW_COLOR}tail -20 /var/log/tetra/tetra.log${COLOR_RESET}" ;;
                *) echo "tetra service manage $(colorize_env "DEV" "DEV"): ${ACTION_SERVICE_COLOR}service operations${COLOR_RESET}" ;;
            esac
            ;;
        "TSM:STAGING")
            case $CURRENT_ITEM in
                0) echo "tetra ssh test $(colorize_env "STAGING" "STAGING"): ${ACTION_SSH_COLOR}${CURRENT_SSH_PREFIXES[staging_root]#ssh }${COLOR_RESET}" ;;
                1) echo "tetra service status $(colorize_env "STAGING" "STAGING"): ${ACTION_SERVICE_COLOR}systemctl status tetra.service${COLOR_RESET}" ;;
                2) echo "tetra service list $(colorize_env "STAGING" "STAGING"): ${ACTION_SERVICE_COLOR}tsm list${COLOR_RESET}" ;;
                3) echo "tetra logs tail $(colorize_env "STAGING" "STAGING"): ${ACTION_VIEW_COLOR}tail -20 /var/log/tetra/tetra.log${COLOR_RESET}" ;;
                *) echo "tetra service manage $(colorize_env "STAGING" "STAGING"): ${ACTION_SERVICE_COLOR}service operations${COLOR_RESET}" ;;
            esac
            ;;
        "TSM:PROD")
            case $CURRENT_ITEM in
                0) echo "tetra ssh test $(colorize_env "PROD" "PROD"): ${ACTION_SSH_COLOR}${CURRENT_SSH_PREFIXES[prod_root]#ssh }${COLOR_RESET}" ;;
                1) echo "tetra service status $(colorize_env "PROD" "PROD"): ${ACTION_SERVICE_COLOR}systemctl status tetra.service${COLOR_RESET}" ;;
                2) echo "tetra service list $(colorize_env "PROD" "PROD"): ${ACTION_SERVICE_COLOR}tsm list${COLOR_RESET}" ;;
                3) echo "tetra logs tail $(colorize_env "PROD" "PROD"): ${ACTION_VIEW_COLOR}tail -20 /var/log/tetra/tetra.log${COLOR_RESET}" ;;
                *) echo "tetra service manage $(colorize_env "PROD" "PROD"): ${ACTION_SERVICE_COLOR}service operations${COLOR_RESET}" ;;
            esac
            ;;
        "TSM:QA")
            case $CURRENT_ITEM in
                0) echo "tetra ssh test $(colorize_env "QA" "QA"): ${ACTION_SSH_COLOR}${CURRENT_SSH_PREFIXES[qa_root]#ssh }${COLOR_RESET}" ;;
                1) echo "tetra service status $(colorize_env "QA" "QA"): ${ACTION_SERVICE_COLOR}systemctl status tetra.service${COLOR_RESET}" ;;
                2) echo "tetra service list $(colorize_env "QA" "QA"): ${ACTION_SERVICE_COLOR}tsm list${COLOR_RESET}" ;;
                3) echo "tetra logs tail $(colorize_env "QA" "QA"): ${ACTION_VIEW_COLOR}tail -20 /var/log/tetra/tetra.log${COLOR_RESET}" ;;
                *) echo "tetra service manage $(colorize_env "QA" "QA"): ${ACTION_SERVICE_COLOR}service operations${COLOR_RESET}" ;;
            esac
            ;;
        "TSM:"*)
            echo "tetra service manage $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): ${ACTION_SERVICE_COLOR}service operations${COLOR_RESET}"
            ;;
        "ORG:"*)
            echo "tetra org manage $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): ${ACTION_CONFIG_COLOR}${ACTIVE_ORG:-current org}${COLOR_RESET}"
            ;;
        "DEPLOY:LOCAL")
            echo "tetra build validate $(colorize_env "LOCAL" "LOCAL"): ${ACTION_CONFIG_COLOR}prepare local deployment${COLOR_RESET}"
            ;;
        "DEPLOY:DEV")
            echo "tetra deploy push $(colorize_env "DEV" "DEV"): ${ACTION_DEPLOY_COLOR}deploy to development${COLOR_RESET}"
            ;;
        "DEPLOY:STAGING")
            echo "tetra deploy promote $(colorize_env "DEV" "DEV") $(colorize_env "STAGING" "STAGING"): ${ACTION_DEPLOY_COLOR}dev → staging${COLOR_RESET}"
            ;;
        "DEPLOY:PROD")
            echo "tetra deploy promote $(colorize_env "STAGING" "STAGING") $(colorize_env "PROD" "PROD"): ${ACTION_DEPLOY_COLOR}staging → production${COLOR_RESET}"
            ;;
        "DEPLOY:QA")
            echo "tetra deploy test $(colorize_env "QA" "QA"): ${ACTION_DEPLOY_COLOR}quality assurance deployment${COLOR_RESET}"
            ;;
        "DEPLOY:"*)
            echo "tetra deploy manage $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"): ${ACTION_DEPLOY_COLOR}deployment operations${COLOR_RESET}"
            ;;
        *)
            echo "Navigate: ${UI_MUTED_COLOR}i/k${COLOR_RESET} items, ${UI_MUTED_COLOR}e/m${COLOR_RESET} env/mode"
            ;;
    esac
}

# Render content based on current environment and mode
render_mode_environment_content() {
    # Show drilled-in view if applicable
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        show_drilled_content
        return
    fi

    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML") render_toml_system ;;
        "LOCAL:TOML") render_toml_local ;;
        "DEV:TOML") render_toml_dev ;;
        "STAGING:TOML") render_toml_staging ;;
        "PROD:TOML") render_toml_prod ;;
        "SYSTEM:TKM") render_tkm_system ;;
        "LOCAL:TKM") render_tkm_local ;;
        "DEV:TKM") render_tkm_dev ;;
        "STAGING:TKM") render_tkm_staging ;;
        "PROD:TKM") render_tkm_prod ;;
        "SYSTEM:TSM") render_tsm_system ;;
        "LOCAL:TSM") render_tsm_local ;;
        "DEV:TSM") render_tsm_dev ;;
        "STAGING:TSM") render_tsm_staging ;;
        "PROD:TSM") render_tsm_prod ;;
        "QA:TSM") render_tsm_qa ;;
        "SYSTEM:DEPLOY") render_deploy_system ;;
        "LOCAL:DEPLOY") render_deploy_local ;;
        "DEV:DEPLOY") render_deploy_dev ;;
        "STAGING:DEPLOY") render_deploy_staging ;;
        "PROD:DEPLOY") render_deploy_prod ;;
        "SYSTEM:ORG") render_org_system ;;
        "LOCAL:ORG") render_org_local ;;
        "DEV:ORG") render_org_dev ;;
        "STAGING:ORG") render_org_staging ;;
        "PROD:ORG") render_org_prod ;;
        "QA:ORG") render_org_qa ;;
        "SYSTEM:RCM") render_rcm_system ;;
        "LOCAL:RCM") render_rcm_local ;;
        "DEV:RCM") render_rcm_dev ;;
        "STAGING:RCM") render_rcm_staging ;;
        "PROD:RCM") render_rcm_prod ;;
        "QA:RCM") render_rcm_qa ;;
        *) echo "Unknown environment/mode combination: $CURRENT_ENV:$CURRENT_MODE" ;;
    esac
}

# Render status line with current selection context
render_status_line() {
    local context=$(get_current_selection_context)
    local max_items=$(get_max_items_for_current_context)

    if [[ $max_items -gt 1 ]]; then
        echo "Status: $context (item $((CURRENT_ITEM + 1))/$max_items)"
    else
        echo "Status: $context"
    fi
}

# Get context-aware status for current selection
get_current_selection_context() {
    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:SYSTEM")
            case $CURRENT_ITEM in
                0) echo "Active TOML: ${ACTIVE_TOML:-No TOML file detected}" ;;
                1) echo "Project: ${PROJECT_NAME:-Unknown}" ;;
                2) echo "Sync Status: ${TOML_SYNC_STATUS:-Unknown}" ;;
            esac ;;
        "TOML:LOCAL") echo "Local TOML configuration" ;;
        "TOML:DEV") echo "Dev environment: ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})" ;;
        "TOML:STAGING") echo "Staging environment: ${STAGING_SERVER:-Unknown} (${STAGING_IP:-Unknown})" ;;
        "TOML:PROD") echo "Prod environment: ${PROD_SERVER:-Unknown} (${PROD_IP:-Unknown})" ;;
        "TKM:"*) echo "Tetra Key Manager - ${CURRENT_ENV}" ;;
        "TSM:"*) echo "Tetra Service Manager - ${CURRENT_ENV}" ;;
        "DEPLOY:"*) echo "Deployment Management - ${CURRENT_ENV}" ;;
        *) echo "$CURRENT_MODE mode - $CURRENT_ENV environment" ;;
    esac
}

# Utility functions
is_current_item() {
    local item_index="$1"
    if [[ $CURRENT_ITEM -eq $item_index ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Generic highlighting system
setup_colors() {
    BOLD=$(tput bold 2>/dev/null || echo "")
    RESET=$(tput sgr0 2>/dev/null || echo "")
    RED=$(tput setaf 1 2>/dev/null || echo "")
    GREEN=$(tput setaf 2 2>/dev/null || echo "")
    YELLOW=$(tput setaf 3 2>/dev/null || echo "")
    BLUE=$(tput setaf 4 2>/dev/null || echo "")
    MAGENTA=$(tput setaf 5 2>/dev/null || echo "")
    CYAN=$(tput setaf 6 2>/dev/null || echo "")
}

highlight_line() {
    local text="$1"
    local is_selected="$2"
    local color="${3:-$GREEN}"

    if [[ "$is_selected" == "true" ]]; then
        echo "    ► ${BOLD}${color}${text}${RESET}"
    else
        echo "      ${text}"
    fi
}

# Show drilled-in content for selected item
show_drilled_content() {
    echo
    echo "${BOLD}${YELLOW}>>> DRILLED INTO ITEM $((CURRENT_ITEM + 1)) <<<${RESET}"
    echo

    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML")
            generate_toml_system_content | head -15
            ;;
        "LOCAL:TOML")
            generate_toml_local_content | head -15
            ;;
        "DEV:TOML"|"STAGING:TOML"|"PROD:TOML"|"QA:TOML")
            cat << EOF
TOML Configuration for $CURRENT_ENV

Server: ${CURRENT_ENV}_SERVER variable
IP: ${CURRENT_ENV}_IP variable
SSH Status: Testing connectivity...
Services: Checking service status...

Configuration files:
- Main TOML: ~/tetra/config/tetra.toml
- Environment: $CURRENT_ENV specific settings
- Services: Service definitions for $CURRENT_ENV

Domain: ${CURRENT_ENV,,}.pixeljamarcade.com
Status: $(rcm_test_ssh_connectivity "${CURRENT_ENV,,}_root" 2>/dev/null || echo "Connection pending...")
EOF
            ;;
        "SYSTEM:RCM")
            echo "RCM System Overview - All Remote Command Environments"
            echo
            rcm_show_top_user_prefixes | head -12
            ;;
        "LOCAL:RCM"|"DEV:RCM"|"STAGING:RCM"|"PROD:RCM"|"QA:RCM")
            echo "RCM Commands for $CURRENT_ENV"
            echo
            echo "Environment: $CURRENT_ENV"
            echo "SSH Prefix: ${CURRENT_SSH_PREFIXES[$CURRENT_RCM_ENV]:-Not configured}"
            echo
            echo "Available Commands:"
            rcm_render_command_list "$CURRENT_RCM_ENV" | head -12
            ;;
        "SYSTEM:TKM"|"LOCAL:TKM"|"DEV:TKM"|"STAGING:TKM"|"PROD:TKM"|"QA:TKM")
            generate_tkm_content "$CURRENT_ENV" | head -15
            ;;
        "SYSTEM:TSM"|"LOCAL:TSM"|"DEV:TSM"|"STAGING:TSM"|"PROD:TSM"|"QA:TSM")
            generate_tsm_content "$CURRENT_ENV" | head -15
            ;;
        "SYSTEM:ORG"|"LOCAL:ORG"|"DEV:ORG"|"STAGING:ORG"|"PROD:ORG"|"QA:ORG")
            cat << EOF
Organization Management for $CURRENT_ENV

Active Organization: ${ACTIVE_ORG:-Local Project}
Environment: $CURRENT_ENV
TOML Path: ${ACTIVE_TOML:-Not set}

Organization Structure:
- Config: ~/tetra/orgs/${ACTIVE_ORG:-current}/
- Services: Service definitions and configurations
- Nginx: Web server configurations
- Deployment: Deployment scripts and configs

Management Operations:
- Switch organizations
- Edit configurations
- Deploy changes
- View deployment history
EOF
            ;;
        "SYSTEM:DEPLOY"|"LOCAL:DEPLOY"|"DEV:DEPLOY"|"STAGING:DEPLOY"|"PROD:DEPLOY"|"QA:DEPLOY")
            cat << EOF
Deployment Management for $CURRENT_ENV

Environment: $CURRENT_ENV
Deployment Target: ${CURRENT_ENV,,}.pixeljamarcade.com
Last Deploy: ${CURRENT_ENV}_LAST_DEPLOY variable
Status: ${CURRENT_ENV}_DEPLOY_STATUS variable

Deployment Pipeline:
1. Configuration validation
2. Service deployment
3. Nginx configuration
4. Health checks
5. Rollback capability

Available Operations:
- Deploy current configuration
- Validate before deployment
- View deployment logs
- Rollback to previous version
EOF
            ;;
        *)
            echo "Detailed view for $CURRENT_ENV:$CURRENT_MODE"
            echo
            echo "Environment: $CURRENT_ENV"
            echo "Mode: $CURRENT_MODE"
            echo "Selected Item: $((CURRENT_ITEM + 1))"
            echo
            echo "Drill view - shows focused details for current selection"
            echo "Use 'j' to return to overview"
            ;;
    esac

    echo
    echo "${BOLD}Navigation: 'j'=back to overview 'ESC'=exit drill${RESET}"
}

# Render file view content with scrolling
render_file_view_content() {
    if [[ "$FILE_VIEW_MODE" != "true" || -z "$FILE_VIEW_CONTENT" ]]; then
        echo "No file content available"
        return
    fi

    local max_lines=${LINES:-24}
    local content_lines=$((max_lines - 8))  # Reserve space for header and status

    echo
    echo "${BOLD}${CYAN}FILE VIEW: ${ACTIVE_TOML}${RESET}"
    echo "Lines: $FILE_VIEW_LINES | Scroll: $SCROLL_OFFSET | Use i,k to scroll, v to exit"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo

    # Display file content with line numbers, starting from SCROLL_OFFSET
    echo "$FILE_VIEW_CONTENT" | nl -ba | sed -n "$((SCROLL_OFFSET + 1)),$((SCROLL_OFFSET + content_lines))p"

    echo
    if [[ $((SCROLL_OFFSET + content_lines)) -lt $FILE_VIEW_LINES ]]; then
        echo "${YELLOW}▼ More content below (press k to scroll down)${RESET}"
    fi
    if [[ $SCROLL_OFFSET -gt 0 ]]; then
        echo "${YELLOW}▲ More content above (press i to scroll up)${RESET}"
    fi
}