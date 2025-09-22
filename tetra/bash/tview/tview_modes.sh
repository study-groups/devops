#!/usr/bin/env bash

# TView Mode Renderers - Mode and environment specific content displays

# ===== TOML MODE RENDER FUNCTIONS =====

render_toml_system() {
    cat << EOF

TOML Configuration Overview

$(highlight_line "Active TOML: ${ACTIVE_TOML:-No TOML file detected}" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Organization: ${ORG_NAME:-${ACTIVE_ORG:-Local Project}}" "$(is_current_item 1)" "$MAGENTA")
$(highlight_line "Provider: ${ORG_PROVIDER:-Unknown} | Type: ${ORG_TYPE:-standard}" "$(is_current_item 2)" "$CYAN")
$(highlight_line "Parse Status: ${TOML_SYNC_STATUS:-Ready for sync}" "$(is_current_item 3)" "$GREEN")

TOML Structure:
$(show_toml_structure)

Services Configuration:
$(show_services_summary)

EOF
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

render_tkm_system() {
    cat << EOF

TKM - Tetra Key Manager Overview

$(highlight_line "SSH Keys: ${TKM_KEY_COUNT:-0} keys configured" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Known Hosts: ${TKM_KNOWN_HOSTS_COUNT:-0} hosts" "$(is_current_item 1)" "$GREEN")

Key management for secure server access.
Use W/E to select environments for key deployment.

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

render_tsm_system() {
    cat << EOF

TSM - Tetra Service Manager Overview

$(highlight_line "Local Services: ${TSM_COUNT_RUNNING:-0} running, ${TSM_COUNT_STOPPED:-0} stopped" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Service Registry: ${TSM_REGISTRY_COUNT:-0} services configured" "$(is_current_item 1)" "$GREEN")

Process and service management across environments.

EOF
}

render_tsm_local() {
    cat << EOF

TSM - Local Services

EOF

    if [[ -n "$TSM_SERVICES" ]]; then
        local service_index=0
        echo "$TSM_SERVICES" | while IFS= read -r line; do
            highlight_line "$line" "$(is_current_item $service_index)" "$CYAN"
            ((service_index++))
        done
    else
        highlight_line "No services currently running" "$(is_current_item 0)" "$YELLOW"
    fi

    echo
    echo "Local services managed by TSM."
}

render_tsm_dev() {
    cat << EOF

TSM - DEV Services

$(highlight_line "SSH Status: ${DEV_SSH_STATUS:-Testing...}" "$(is_current_item 0)" "$([[ ${DEV_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")
$(highlight_line "Remote Services: ${DEV_SERVICE_STATUS:-Unknown}" "$(is_current_item 1)" "$YELLOW")

Remote service management on development server.

EOF
}

render_tsm_staging() {
    cat << EOF

TSM - STAGING Services

$(highlight_line "SSH Status: ${STAGING_SSH_STATUS:-Testing...}" "$(is_current_item 0)" "$([[ ${STAGING_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")
$(highlight_line "Remote Services: ${STAGING_SERVICE_STATUS:-Unknown}" "$(is_current_item 1)" "$YELLOW")

Remote service management on staging server.

EOF
}

render_tsm_prod() {
    cat << EOF

TSM - PROD Services

$(highlight_line "SSH Status: ${PROD_SSH_STATUS:-Testing...}" "$(is_current_item 0)" "$([[ ${PROD_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")
$(highlight_line "Remote Services: ${PROD_SERVICE_STATUS:-Unknown}" "$(is_current_item 1)" "$YELLOW")

Remote service management on production server.

EOF
}

# ===== DEPLOY MODE RENDER FUNCTIONS =====

render_deploy_system() {
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

render_org_system() {
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