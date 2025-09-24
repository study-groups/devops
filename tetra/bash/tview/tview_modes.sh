#!/usr/bin/env bash

# TView Mode Renderers - Mode and environment specific content displays

# ===== RCM MODE RENDER FUNCTIONS =====

render_rcm_tetra() {
    cat << EOF

RCM - Remote Command Execution Overview

Remote Access Profiles (Top 3 Per Environment):
$(rcm_show_top_user_prefixes)

Command Categories ($(echo "${!RCM_COMMANDS[@]}" | wc -w) total commands):
$(highlight_line "File System: home_directory, log_directory, nginx_config_dir, tetra_workspace" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Configuration: active_config, nginx_main_config, system_hosts, user_profile" "$(is_current_item 1)" "$GREEN")
$(highlight_line "Monitoring: nginx_errors, nginx_access, system_log, running_processes" "$(is_current_item 2)" "$GREEN")
$(highlight_line "System Info: disk_usage, memory_info, network_connections, system_uptime" "$(is_current_item 3)" "$GREEN")

Current Selection: $CURRENT_RCM_ENV
$(highlight_line "${ENV_COMMENTS[$CURRENT_RCM_ENV]:-No description available}" "$(is_current_item 4)" "$YELLOW")

EOF
}

render_rcm_local() {
    cat << EOF

RCM - Local Command Execution

Current Environment: LOCAL (Direct execution)
SSH Prefix: ${CURRENT_SSH_PREFIXES[local]:-"(none - direct execution)"}

Available Commands:
$(rcm_render_command_list "local")

EOF
}

render_rcm_dev() {
    cat << EOF

RCM - DEV Environment Commands

Current Environment: $CURRENT_RCM_ENV
SSH Prefix: ${CURRENT_SSH_PREFIXES[$CURRENT_RCM_ENV]:-"Not configured"}
$(if [[ "$RCM_EDITING_MODE" == "true" && "$RCM_EDIT_ENV" == "$CURRENT_RCM_ENV" ]]; then
    echo "EDITING> $RCM_EDIT_BUFFER"
fi)

Available Commands:
$(rcm_render_command_list "$CURRENT_RCM_ENV")

EOF
}

render_rcm_staging() {
    cat << EOF

RCM - STAGING Environment Commands

Current Environment: $CURRENT_RCM_ENV
SSH Prefix: ${CURRENT_SSH_PREFIXES[$CURRENT_RCM_ENV]:-"Not configured"}
$(if [[ "$RCM_EDITING_MODE" == "true" && "$RCM_EDIT_ENV" == "$CURRENT_RCM_ENV" ]]; then
    echo "EDITING> $RCM_EDIT_BUFFER"
fi)

Available Commands:
$(rcm_render_command_list "$CURRENT_RCM_ENV")

EOF
}

render_rcm_prod() {
    cat << EOF

RCM - PROD Environment Commands

Current Environment: $CURRENT_RCM_ENV
SSH Prefix: ${CURRENT_SSH_PREFIXES[$CURRENT_RCM_ENV]:-"Not configured"}
$(if [[ "$RCM_EDITING_MODE" == "true" && "$RCM_EDIT_ENV" == "$CURRENT_RCM_ENV" ]]; then
    echo "EDITING> $RCM_EDIT_BUFFER"
fi)

Available Commands:
$(rcm_render_command_list "$CURRENT_RCM_ENV")

EOF
}

render_rcm_qa() {
    cat << EOF

RCM - QA Environment Commands

Current Environment: $CURRENT_RCM_ENV
SSH Prefix: ${CURRENT_SSH_PREFIXES[$CURRENT_RCM_ENV]:-"Not configured"}
$(if [[ "$RCM_EDITING_MODE" == "true" && "$RCM_EDIT_ENV" == "$CURRENT_RCM_ENV" ]]; then
    echo "EDITING> $RCM_EDIT_BUFFER"
fi)

Available Commands:
$(rcm_render_command_list "$CURRENT_RCM_ENV")

EOF
}

# ===== TOML MODE RENDER FUNCTIONS =====

render_toml_tetra() {
    # Source span system if available
    local span_available=false
    if [[ -f "$TETRA_SRC/bash/span/tview/render.sh" ]]; then
        source "$TETRA_SRC/bash/span/tview/render.sh" 2>/dev/null && span_available=true
    fi

    # Source render functions to get parameter dashboard
    if [[ -f "$(dirname "${BASH_SOURCE[0]}")/tview_render.sh" ]]; then
        source "$(dirname "${BASH_SOURCE[0]}")/tview_render.sh"
    fi

    cat << EOF

$(colorize_tetra "TETRA" "purple") × $(colorize_tetra "TOML" "gold") - Configuration Management

$(render_parameter_dashboard)

🎯 TOML Structure Analysis:
EOF

    if [[ "$span_available" == "true" ]]; then
        cat << EOF
$(span_render_toml_sections)

🔍 Available Actions:
$(highlight_line "View TOML Structure" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")    ${UI_MUTED_COLOR}Parse sections and spans${COLOR_RESET}
$(highlight_line "Edit Configuration" "$(is_current_item 1)" "$ACTION_EDIT_COLOR")    ${UI_MUTED_COLOR}Modify with span tracking${COLOR_RESET}
$(highlight_line "Analyze Dependencies" "$(is_current_item 2)" "$ACTION_CONFIG_COLOR") ${UI_MUTED_COLOR}Cross-reference analysis${COLOR_RESET}

📋 Active Multispan: $(span_get_active_multispan)
$(span_render_toml_multispan_preview)
EOF
    else
        cat << EOF
$(highlight_line "View Configuration" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")     ${UI_MUTED_COLOR}Show TOML content${COLOR_RESET}
$(highlight_line "Edit Configuration" "$(is_current_item 1)" "$ACTION_EDIT_COLOR")     ${UI_MUTED_COLOR}Modify settings${COLOR_RESET}
$(highlight_line "Validate TOML" "$(is_current_item 2)" "$ACTION_CONFIG_COLOR")       ${UI_MUTED_COLOR}Check syntax${COLOR_RESET}

⚠ Span system not available - basic TOML operations only
EOF
    fi

    cat << EOF

Environment: $(colorize_env "TETRA" "TETRA") | Mode: $(colorize_mode "TOML" "TOML")
Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to analyze, ${COLOR_BOLD}1-9${COLOR_RESET} to load span slot

EOF
}

# TOML Span Integration Helper Functions
span_render_toml_sections() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "   ├─ [metadata] Project metadata and organization"
        echo "   ├─ [environments] Multi-environment configuration"
        echo "   ├─ [services] Service definitions and ports"
        echo "   ├─ [domains] Domain and routing configuration"
        echo "   └─ [infrastructure] Provider and deployment settings"
    else
        echo "   No TOML file loaded - use ORG mode to select configuration"
    fi
}

span_render_toml_multispan_preview() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "   ├─ cursor_1: tetra.toml:1-8 (metadata section)"
        echo "   ├─ cursor_2: tetra.toml:15-25 (environments.dev)"
        echo "   └─ cursor_3: tetra.toml:45-52 (services configuration)"
    else
        echo "   No active spans - select TOML file to begin analysis"
    fi
}

render_toml_local() {
    cat << EOF

LOCAL Environment Configuration

$(highlight_line "App Port: ${LOCAL_PORT:-3000} | Node Env: ${LOCAL_NODE_ENV:-development}" "$(is_current_item 0)" "$CYAN")
$(highlight_line "Domain: ${LOCAL_DOMAIN:-localhost} | Full URL: http://${LOCAL_DOMAIN:-localhost}:${LOCAL_PORT:-3000}" "$(is_current_item 1)" "$CYAN")
$(highlight_line "Data Directory: ${LOCAL_DATA_DIR:-/home/dev/pj/pd}" "$(is_current_item 2)" "$CYAN")
$(highlight_line "Service Config: ${LOCAL_SERVICE_CONFIG:-npm run dev}" "$(is_current_item 3)" "$CYAN")

Local Services:
$(show_local_services_config)

EOF
}

render_toml_dev() {
    cat << EOF

DEV Environment Infrastructure

$(highlight_line "Server: ${DEV_SERVER:-Unknown} (${DEV_NICKNAME:-dev-server})" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Public IP: ${DEV_IP:-Unknown}" "$(is_current_item 1)" "$GREEN")
$(highlight_line "Private IP: ${DEV_PRIVATE_IP:-Unknown}" "$(is_current_item 2)" "$GREEN")
$(highlight_line "Size: ${DEV_SIZE:-Unknown} | Memory: ${DEV_MEMORY:-Unknown}" "$(is_current_item 3)" "$GREEN")
$(highlight_line "Region: ${DEV_REGION:-Unknown} | SSH: ${DEV_SSH_STATUS:-Testing...}" "$(is_current_item 4)" "$([[ ${DEV_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")

Domain: ${DEV_DOMAIN:-dev.pixeljamarcade.com}
Environment: Development server for shared development
Direct SSH: ssh tetra@${DEV_IP:-unknown}

EOF
}

render_toml_staging() {
    cat << EOF

STAGING Environment Infrastructure

$(highlight_line "Server: ${STAGING_SERVER:-Unknown} (${STAGING_NICKNAME:-staging-server})" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Public IP: ${STAGING_IP:-Unknown}" "$(is_current_item 1)" "$YELLOW")
$(highlight_line "Private IP: ${STAGING_PRIVATE_IP:-Unknown}" "$(is_current_item 2)" "$YELLOW")
$(highlight_line "Size: ${STAGING_SIZE:-Unknown} | Memory: ${STAGING_MEMORY:-Unknown}" "$(is_current_item 3)" "$YELLOW")
$(highlight_line "Region: ${STAGING_REGION:-Unknown} | SSH: ${STAGING_SSH_STATUS:-Testing...}" "$(is_current_item 4)" "$([[ ${STAGING_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")

Domain: ${STAGING_DOMAIN:-staging.pixeljamarcade.com}
Environment: Pre-production testing and validation
Direct SSH: ssh tetra@${STAGING_IP:-unknown}

EOF
}

render_toml_prod() {
    cat << EOF

PROD Environment Infrastructure

$(highlight_line "Server: ${PROD_SERVER:-Unknown} (${PROD_NICKNAME:-prod-server})" "$(is_current_item 0)" "$RED")
$(highlight_line "Public IP: ${PROD_IP:-Unknown}" "$(is_current_item 1)" "$RED")
$(highlight_line "Private IP: ${PROD_PRIVATE_IP:-Unknown}" "$(is_current_item 2)" "$RED")
$(highlight_line "Size: ${PROD_SIZE:-Unknown} | Memory: ${PROD_MEMORY:-Unknown}" "$(is_current_item 3)" "$RED")
$(highlight_line "Region: ${PROD_REGION:-Unknown} | SSH: ${PROD_SSH_STATUS:-Testing...}" "$(is_current_item 4)" "$([[ ${PROD_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")

Domain: ${PROD_DOMAIN:-pixeljamarcade.com}
Environment: Production - Live environment
Direct SSH: ssh tetra@${PROD_IP:-unknown}

EOF
}

# ===== TKM MODE RENDER FUNCTIONS =====

render_tkm_tetra() {
    cat << EOF

$(colorize_mode "TKM" "TKM") - Four Amigos SSH Access Matrix

$(highlight_line "$(colorize_env "LOCAL" "LOCAL") Environment: $(render_status_indicator "success" "Direct Access")" "$(is_current_item 0)" "$(get_env_color "LOCAL")")
$(highlight_line "  ${ACTION_SSH_COLOR}mricos@m2.local${COLOR_RESET} ${UI_MUTED_COLOR}(direct connection)${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${UI_MUTED_COLOR}# Local development machine${COLOR_RESET}" "false" "$COLOR_WHITE")

$(highlight_line "$(colorize_env "DEV" "DEV") Environment: $(render_status_indicator "connected" "SSH Ready")" "$(is_current_item 1)" "$(get_env_color "DEV")")
$(highlight_line "  ${ACTION_SSH_COLOR}root@dev.pixeljamarcade.com${COLOR_RESET}     ${UI_MUTED_COLOR}# Full system access${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_SERVICE_COLOR}tetra@dev.pixeljamarcade.com${COLOR_RESET}    ${UI_MUTED_COLOR}# Service user${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_VIEW_COLOR}ubuntu@dev.pixeljamarcade.com${COLOR_RESET}   ${UI_MUTED_COLOR}# Standard user${COLOR_RESET}" "false" "$COLOR_WHITE")

$(highlight_line "$(colorize_env "STAGING" "STAGING") Environment: $(render_status_indicator "warning" "Staging Access")" "$(is_current_item 2)" "$(get_env_color "STAGING")")
$(highlight_line "  ${ACTION_SSH_COLOR}root@staging.pixeljamarcade.com${COLOR_RESET}     ${UI_MUTED_COLOR}# Full system access${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_DEPLOY_COLOR}deploy@staging.pixeljamarcade.com${COLOR_RESET}   ${UI_MUTED_COLOR}# Deployment user${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_VIEW_COLOR}ubuntu@staging.pixeljamarcade.com${COLOR_RESET}   ${UI_MUTED_COLOR}# Standard user${COLOR_RESET}" "false" "$COLOR_WHITE")

$(highlight_line "$(colorize_env "PROD" "PROD") Environment: $(render_status_indicator "error" "Production Access")" "$(is_current_item 3)" "$(get_env_color "PROD")")
$(highlight_line "  ${ACTION_SSH_COLOR}root@prod.pixeljamarcade.com${COLOR_RESET}     ${UI_MUTED_COLOR}# Full system access${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_DEPLOY_COLOR}deploy@prod.pixeljamarcade.com${COLOR_RESET}   ${UI_MUTED_COLOR}# Deployment user${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_VIEW_COLOR}ubuntu@prod.pixeljamarcade.com${COLOR_RESET}   ${UI_MUTED_COLOR}# Standard user${COLOR_RESET}" "false" "$COLOR_WHITE")

$(highlight_line "$(colorize_env "QA" "QA") Environment: $(render_status_indicator "info" "QA Access")" "$(is_current_item 4)" "$(get_env_color "QA")")
$(highlight_line "  ${ACTION_SSH_COLOR}root@qa.pixeljamarcade.com${COLOR_RESET}     ${UI_MUTED_COLOR}# Full system access${COLOR_RESET}" "false" "$COLOR_WHITE")
$(highlight_line "  ${ACTION_VIEW_COLOR}ubuntu@qa.pixeljamarcade.com${COLOR_RESET}   ${UI_MUTED_COLOR}# QA testing user${COLOR_RESET}" "false" "$COLOR_WHITE")

$(highlight_line "Key Operations: $(render_status_indicator "pending" "Management Ready")" "$(is_current_item 5)" "$MODE_TKM_COLOR")
$(highlight_line "  ${UI_MUTED_COLOR}SSH key rotation, authentication testing, access control${COLOR_RESET}" "false" "$UI_MUTED_COLOR")

EOF
}

render_tkm_local() {
    cat << EOF
TKM - Local Key Management

$(highlight_line "Local SSH Keys: ~/.ssh/ directory" "$(is_current_item 0)" "$CYAN")
$(highlight_line "SSH Config: ~/.ssh/config" "$(is_current_item 1)" "$CYAN")
$(highlight_line "Key Agent: ${SSH_AGENT_STATUS:-Not running}" "$(is_current_item 2)" "$CYAN")

Manage local SSH keys and configuration.
EOF
}

render_tkm_dev() {
    cat << EOF

TKM - DEV Key Deployment

$(highlight_line "SSH Connection: ${DEV_SSH_STATUS:-Testing...}" "$(is_current_item 0)" "$([[ ${DEV_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")
$(highlight_line "Key Deployment: ${DEV_KEY_STATUS:-Not deployed}" "$(is_current_item 1)" "$YELLOW")

Deploy SSH keys to development server.

EOF
}

render_tkm_staging() {
    cat << EOF

TKM - STAGING Key Deployment

$(highlight_line "SSH Connection: ${STAGING_SSH_STATUS:-Testing...}" "$(is_current_item 0)" "$([[ ${STAGING_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")
$(highlight_line "Key Deployment: ${STAGING_KEY_STATUS:-Not deployed}" "$(is_current_item 1)" "$YELLOW")

Deploy SSH keys to staging server.

EOF
}

render_tkm_prod() {
    cat << EOF

TKM - PROD Key Deployment

$(highlight_line "SSH Connection: ${PROD_SSH_STATUS:-Testing...}" "$(is_current_item 0)" "$([[ ${PROD_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")
$(highlight_line "Key Deployment: ${PROD_KEY_STATUS:-Not deployed}" "$(is_current_item 1)" "$YELLOW")

Deploy SSH keys to production server.

EOF
}

# ===== TSM MODE RENDER FUNCTIONS =====

render_tsm_tetra() {
    cat << EOF

TSM - Tetra Service Manager Overview

$(highlight_line "Local Services: ${TSM_COUNT_RUNNING:-0} running, ${TSM_COUNT_STOPPED:-0} stopped" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Service Registry: ${TSM_REGISTRY_COUNT:-0} services configured" "$(is_current_item 1)" "$GREEN")

Process and service management across environments.

EOF
}

render_tsm_local() {
    # Check local service status
    local service_result="$(render_status_indicator "info" "Local Services")"
    local config_result="$(render_status_indicator "success" "Configuration Ready")"

    cat << EOF

$(colorize_mode "TSM" "TSM") - $(colorize_env "LOCAL" "LOCAL") Services

$(highlight_line "Service Manager: $service_result" "$(is_current_item 0)" "$ENV_LOCAL_COLOR")
$(highlight_line "Configuration: $config_result" "$(is_current_item 1)" "$MODE_TSM_COLOR")
$(highlight_line "Service List: $(render_status_indicator "pending" "Loading...")" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Local Logs: $(render_status_indicator "info" "Ready")" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")

Environment: $(colorize_env "LOCAL" "LOCAL")
Path: $(colorize_status "~/tetra/services/" "info")

Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to run, ${COLOR_BOLD}t${COLOR_RESET} for TSM REPL

EOF
}

render_tsm_dev() {
    # Auto SSH connectivity disabled to prevent unwanted connections
    local ssh_result="$(render_status_indicator "info" "SSH Not Auto-Tested")"

    # Service status disabled - no auto SSH connections
    local service_result=""
    # Disabled auto SSH test - use manual action to check status
    # if timeout 2 ssh -o ConnectTimeout=1 -o BatchMode=yes "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "echo 'ok'" >/dev/null 2>&1; then
    #     ssh_result="$(render_status_indicator "connected" "SSH Ready")"
    #     local tetra_status=$(timeout 3 ssh -o ConnectTimeout=1 -o BatchMode=yes "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "systemctl is-active tetra.service 2>/dev/null || echo 'inactive'")
    #     if [[ "$tetra_status" == "active" ]]; then
    #         service_result="$(render_status_indicator "active" "tetra.service running")"
    #     else
    service_result="$(render_status_indicator "info" "Use SSH action to check")"

    cat << EOF

TSM - $(colorize_env "DEV" "DEV") Services

$(highlight_line "SSH Status: $ssh_result" "$(is_current_item 0)" "$(get_status_color "info")")
$(highlight_line "Service Status: $service_result" "$(is_current_item 1)" "$(get_status_color "info")")
$(highlight_line "Quick Actions: $(colorize_status "tsm list" "info"), $(colorize_status "systemctl status tetra.service" "info")" "$(is_current_item 2)" "$(get_mode_color "TSM")")
$(highlight_line "Service Logs: $(colorize_status "tail -f /var/log/tetra/tetra.log" "info")" "$(is_current_item 3)" "$(get_action_color "view")")

Server: $(colorize_env "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "DEV")
Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to run, ${COLOR_BOLD}t${COLOR_RESET} for TSM REPL

EOF
}

render_tsm_staging() {
    # Auto SSH connectivity disabled to prevent unwanted connections
    local ssh_result env_lower="staging"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[staging_root]:-ssh root@staging.pixeljamarcade.com}"

    # Disabled auto SSH test - use manual SSH action to check
    ssh_result="$(render_status_indicator "info" "SSH Not Auto-Tested")"
    local service_result="$(render_status_indicator "info" "Use SSH action to check")"

    cat << EOF

$(colorize_mode "TSM" "TSM") - $(colorize_env "STAGING" "STAGING") Services

$(highlight_line "SSH Test: $ssh_result" "$(is_current_item 0)" "$ENV_STAGING_COLOR")
$(highlight_line "Service Status: $service_result" "$(is_current_item 1)" "$MODE_TSM_COLOR")
$(highlight_line "Service List: $(render_status_indicator "pending" "Loading...")" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Log Tail: $(render_status_indicator "info" "Ready")" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")

Environment: $(colorize_env "STAGING" "STAGING")
SSH: $(colorize_status "$ssh_prefix" "info")

Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to run, ${COLOR_BOLD}t${COLOR_RESET} for TSM REPL

EOF
}

render_tsm_prod() {
    # Auto SSH connectivity disabled to prevent unwanted connections
    local ssh_result env_lower="prod"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[prod_root]:-ssh root@prod.pixeljamarcade.com}"

    # Disabled auto SSH test - use manual SSH action to check
    ssh_result="$(render_status_indicator "info" "SSH Not Auto-Tested")"
    local service_result="$(render_status_indicator "info" "Use SSH action to check")"

    cat << EOF

$(colorize_mode "TSM" "TSM") - $(colorize_env "PROD" "PROD") Services

$(highlight_line "SSH Test: $ssh_result" "$(is_current_item 0)" "$ENV_PROD_COLOR")
$(highlight_line "Service Status: $service_result" "$(is_current_item 1)" "$MODE_TSM_COLOR")
$(highlight_line "Service List: $(render_status_indicator "pending" "Loading...")" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Log Tail: $(render_status_indicator "info" "Ready")" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")

Environment: $(colorize_env "PROD" "PROD")
SSH: $(colorize_status "$ssh_prefix" "warning")

Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to run, ${COLOR_BOLD}t${COLOR_RESET} for TSM REPL

EOF
}

render_tsm_qa() {
    # Test SSH connectivity and get service status
    local ssh_result env_lower="qa"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[qa_root]:-ssh root@qa.pixeljamarcade.com}"

    if timeout 2 ${ssh_prefix#ssh } "echo 'ok'" >/dev/null 2>&1; then
        ssh_result="$(render_status_indicator "connected" "SSH Ready")"
    else
        ssh_result="$(render_status_indicator "error" "SSH Failed")"
    fi

    local service_result="$(render_status_indicator "info" "QA Check")"

    cat << EOF

$(colorize_mode "TSM" "TSM") - $(colorize_env "QA" "QA") Services

$(highlight_line "SSH Test: $ssh_result" "$(is_current_item 0)" "$ENV_QA_COLOR")
$(highlight_line "Service Status: $service_result" "$(is_current_item 1)" "$MODE_TSM_COLOR")
$(highlight_line "Service List: $(render_status_indicator "pending" "Loading...")" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Log Tail: $(render_status_indicator "info" "Ready")" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")

Environment: $(colorize_env "QA" "QA")
SSH: $(colorize_status "$ssh_prefix" "info")

Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to run, ${COLOR_BOLD}t${COLOR_RESET} for TSM REPL

EOF
}

# ===== DEPLOY MODE RENDER FUNCTIONS =====

render_deploy_tetra() {
    cat << EOF

DEPLOY - Deployment Overview

$(highlight_line "Git Status: ${GIT_CLEAN:-Unknown}" "$(is_current_item 0)" "$([[ ${GIT_CLEAN} == "✓" ]] && echo $GREEN || echo $RED)")
$(highlight_line "Deploy Readiness: ${DEPLOY_READINESS:-Unknown}" "$(is_current_item 1)" "$GREEN")

Deployment management across all environments.

EOF
}

render_deploy_local() {
    cat << EOF

DEPLOY - Local Status

$(highlight_line "Git Status: ${GIT_CLEAN:-Unknown} | Branch: ${GIT_BRANCH:-main}" "$(is_current_item 0)" "$([[ ${GIT_CLEAN} == "✓" ]] && echo $GREEN || echo $RED)")
$(highlight_line "Build Artifacts: ${BUILD_STATUS:-Not built}" "$(is_current_item 1)" "$YELLOW")
$(highlight_line "Deploy Readiness: ${DEPLOY_READINESS:-Ready}" "$(is_current_item 2)" "$GREEN")

Local deployment preparation and status.

EOF
}

render_deploy_dev() {
    cat << EOF

DEPLOY - DEV Deployment

$(highlight_line "Last Deploy: ${DEV_LAST_DEPLOY:-Never}" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Deploy Status: ${DEV_DEPLOY_STATUS:-Ready}" "$(is_current_item 1)" "$GREEN")
$(highlight_line "Health Check: ${DEV_HEALTH_STATUS:-Unknown}" "$(is_current_item 2)" "$YELLOW")

Development server deployment status.

EOF
}

render_deploy_staging() {
    cat << EOF

DEPLOY - STAGING Deployment

$(highlight_line "Last Deploy: ${STAGING_LAST_DEPLOY:-Never}" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Deploy Status: ${STAGING_DEPLOY_STATUS:-Ready}" "$(is_current_item 1)" "$YELLOW")
$(highlight_line "Health Check: ${STAGING_HEALTH_STATUS:-Unknown}" "$(is_current_item 2)" "$YELLOW")

Staging server deployment status.

EOF
}

render_deploy_prod() {
    cat << EOF

DEPLOY - PROD Deployment

$(highlight_line "Last Deploy: ${PROD_LAST_DEPLOY:-Never}" "$(is_current_item 0)" "$RED")
$(highlight_line "Deploy Status: ${PROD_DEPLOY_STATUS:-Ready}" "$(is_current_item 1)" "$RED")
$(highlight_line "Health Check: ${PROD_HEALTH_STATUS:-Unknown}" "$(is_current_item 2)" "$RED")

Production server deployment status.

EOF
}

# ===== ORG MODE RENDER FUNCTIONS =====

render_org_tetra() {
    cat << EOF

ORG - Organization Overview

$(highlight_line "Active Organization: ${ACTIVE_ORG:-No active organization}" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Total Organizations: ${TOTAL_ORGS:-0}" "$(is_current_item 1)" "$CYAN")
$(highlight_line "Organization Status: ${ORG_STATUS:-Ready}" "$(is_current_item 2)" "$GREEN")

Available Organizations:
$(list_available_organizations)

EOF
}

render_org_local() {
    cat << EOF

ORG - Local Organization Management

$(highlight_line "Create New Organization" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Switch Organization" "$(is_current_item 1)" "$CYAN")
$(highlight_line "Organization Settings" "$(is_current_item 2)" "$YELLOW")
$(highlight_line "Sync Configuration" "$(is_current_item 3)" "$MAGENTA")

Local organization management and configuration.

EOF
}

render_org_dev() {
    cat << EOF

ORG - DEV Organization Sync

$(highlight_line "Push Config to DEV" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Pull Config from DEV" "$(is_current_item 1)" "$CYAN")
$(highlight_line "DEV Sync Status: ${DEV_ORG_SYNC:-Unknown}" "$(is_current_item 2)" "$YELLOW")

Deploy organization configuration to dev environment.

EOF
}

render_org_staging() {
    cat << EOF

ORG - STAGING Organization Sync

$(highlight_line "Push Config to STAGING" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Pull Config from STAGING" "$(is_current_item 1)" "$CYAN")
$(highlight_line "STAGING Sync Status: ${STAGING_ORG_SYNC:-Unknown}" "$(is_current_item 2)" "$YELLOW")

Deploy organization configuration to staging environment.

EOF
}

render_org_prod() {
    cat << EOF

ORG - PROD Organization Sync

$(highlight_line "Push Config to PROD" "$(is_current_item 0)" "$RED")
$(highlight_line "Pull Config from PROD" "$(is_current_item 1)" "$RED")
$(highlight_line "PROD Sync Status: ${PROD_ORG_SYNC:-Unknown}" "$(is_current_item 2)" "$RED")

Deploy organization configuration to production environment.

EOF
}

# ===== ORG UTILITY FUNCTIONS =====

list_available_organizations() {
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        local org_list=""
        for org_dir in "$TETRA_DIR/orgs"/*; do
            if [[ -d "$org_dir" ]]; then
                local org_name=$(basename "$org_dir")
                if [[ "$org_name" == "${ACTIVE_ORG:-}" ]]; then
                    org_list+="  → $org_name (active)\n"
                else
                    org_list+="    $org_name\n"
                fi
            fi
        done
        [[ -n "$org_list" ]] && echo -e "$org_list" || echo "  No organizations found"
    else
        echo "  Organization directory not found"
    fi
}