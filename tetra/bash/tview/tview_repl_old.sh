#!/usr/bin/env bash

# TView REPL - Tetra View with Modal Navigation

# Global state - Hierarchical navigation paradigm
CURRENT_ENV="LOCAL"      # SYSTEM | LOCAL | DEV | STAGING | PROD (primary navigation)
CURRENT_MODE="TOML"      # TOML | TKM | TSM | DEPLOY | ORG (secondary navigation)
CURRENT_ITEM=0           # Item within current environment+mode
DRILL_LEVEL=0            # 0=normal view, 1=drilled into item

# Available environments and modes (reordered for new hierarchy)
ENVIRONMENTS=("SYSTEM" "LOCAL" "DEV" "STAGING" "PROD")
MODES=("TOML" "TKM" "TSM" "DEPLOY" "ORG")

# TView REPL main function - Complete redesign for modal navigation
tview_repl() {
    local content_lines=0
    local terminal_lines=${LINES:-24}

    # Initialize display
    setup_colors
    detect_active_toml

    # Cache for reducing unnecessary redraws
    local last_display=""
    local data_refresh_counter=0
    local ssh_check_counter=0

    while true; do
        # Only refresh data periodically, not every keystroke
        if [[ $data_refresh_counter -eq 0 ]]; then
            load_toml_data
            load_environment_data
            data_refresh_counter=10  # Refresh every 10 keystrokes
        fi

        # SSH connectivity is expensive - check even less frequently
        if [[ $ssh_check_counter -eq 0 ]]; then
            load_ssh_connectivity
            ssh_check_counter=30  # Check SSH every 30 keystrokes
        fi

        # Generate ALL content in buffer first (complete double-buffering)
        local full_display=""

        # Header with mode selector and environment
        full_display+=$(render_header)
        full_display+=$'\n'

        # Main content based on mode + environment
        full_display+=$(render_mode_environment_content)

        # Calculate content lines for padding
        content_lines=$(echo "$full_display" | wc -l)

        # Add padding to push status to bottom (reserve 4 lines)
        local padding_needed=$((terminal_lines - content_lines - 4))
        if [[ $padding_needed -gt 0 ]]; then
            for ((i=0; i<$padding_needed; i++)); do
                full_display+=$'\n'
            done
        fi

        # Add status and navigation info
        full_display+=$(render_status_line)
        full_display+=$'\n'

        # Add navigation prompt
        full_display+="[tview] Env: w-left e-right | Mode: a,d | Items: i,k | Drill: l(in), j(out)"$'\n'
        full_display+="Commands: enter, r, q, h, t, g, v (view TOML)"$'\n'

        # Only clear and redraw if content actually changed
        if [[ "$full_display" != "$last_display" ]]; then
            clear
            echo -n "$full_display"
            last_display="$full_display"
        fi

        # Decrement counters
        ((data_refresh_counter--))
        ((ssh_check_counter--))

        read -p "> " -n1 key

        case "$key" in
            'w'|'W')
                navigate_environment "left"
                ;;
            'e'|'E')
                navigate_environment "right"
                ;;
            'a'|'A')
                navigate_mode "left"
                ;;
            'd'|'D')
                navigate_mode "right"
                ;;
            'j'|'J')
                drill_out
                ;;
            'i'|'I')
                navigate_item "up"
                ;;
            'k'|'K')
                navigate_item "down"
                ;;
            'l'|'L')
                drill_into
                ;;
            '')  # Enter key
                show_item_modal
                ;;
            'q'|'Q')
                echo "Exiting tview..."
                break
                ;;
            'r'|'R')
                # Force immediate data refresh
                data_refresh_counter=0
                ssh_check_counter=0
                ;;
            'h'|'H')
                show_tview_help
                ;;
            't'|'T')
                execute_tsm_command
                ;;
            'g'|'G')
                execute_git_command
                ;;
            'v'|'V')
                view_toml_file
                ;;
            *)
                # Silently ignore unknown keys to maintain display flow
                ;;
        esac
    done
}

# Navigate between modes (A/D keys)
navigate_mode() {
    local direction="$1"
    local current_idx

    # Find current mode index
    for i in "${!MODES[@]}"; do
        if [[ "${MODES[$i]}" == "$CURRENT_MODE" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#MODES[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#MODES[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_MODE="${MODES[$current_idx]}"
    CURRENT_ITEM=0  # Reset item when changing modes
    DRILL_LEVEL=0   # Reset drill level when changing modes
}

# Navigate between environments (W/E keys)
navigate_environment() {
    local direction="$1"
    local current_idx

    # Find current environment index
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ "${ENVIRONMENTS[$i]}" == "$CURRENT_ENV" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#ENVIRONMENTS[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#ENVIRONMENTS[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_ENV="${ENVIRONMENTS[$current_idx]}"
    CURRENT_ITEM=0  # Reset item when changing environments
    DRILL_LEVEL=0   # Reset drill level when changing environments
}

# Navigate items within current mode+environment (J/I/K/L keys)
navigate_item() {
    local direction="$1"
    local max_items=$(get_max_items_for_current_context)

    if [[ $max_items -le 1 ]]; then
        return  # No navigation needed for single items
    fi

    if [[ "$direction" == "down" || "$direction" == "right" ]]; then
        CURRENT_ITEM=$((CURRENT_ITEM + 1))
        if [[ $CURRENT_ITEM -ge $max_items ]]; then
            CURRENT_ITEM=0
        fi
    else
        CURRENT_ITEM=$((CURRENT_ITEM - 1))
        if [[ $CURRENT_ITEM -lt 0 ]]; then
            CURRENT_ITEM=$((max_items - 1))
        fi
    fi
}

# Drill into selected item (L key)
drill_into() {
    if [[ $DRILL_LEVEL -eq 0 ]]; then
        DRILL_LEVEL=1
    fi
}

# Drill out of item (J key)
drill_out() {
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        DRILL_LEVEL=0
    fi
}

# Get maximum items for current environment+mode combination
get_max_items_for_current_context() {
    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML") echo 4 ;;     # TOML file, organization, project, status
        "LOCAL:TOML") echo 4 ;;      # Local config items
        "DEV:TOML") echo 5 ;;        # Dev server infrastructure items
        "STAGING:TOML") echo 5 ;;    # Staging server infrastructure items
        "PROD:TOML") echo 5 ;;       # Prod server infrastructure items
        "SYSTEM:TKM") echo 2 ;;      # Key status, known hosts
        "LOCAL:TKM") echo 3 ;;       # Local keys, SSH config, status
        *":TKM") echo 2 ;;           # SSH connectivity, key deployment
        "SYSTEM:TSM") echo 2 ;;      # Service manager status
        "LOCAL:TSM")
            if [[ -n "$TSM_SERVICES" ]]; then
                echo $(echo "$TSM_SERVICES" | wc -l)
            else
                echo 1
            fi
            ;;
        *":TSM") echo 2 ;;           # Remote service status (if SSH connected)
        "SYSTEM:DEPLOY") echo 2 ;;   # Deploy status overview
        "LOCAL:DEPLOY") echo 3 ;;    # Git status, artifacts, deploy readiness
        *":DEPLOY") echo 3 ;;        # Deployment status, last deploy, actions
        "SYSTEM:ORG") echo 3 ;;      # Organization overview, total orgs, status
        "LOCAL:ORG") echo 4 ;;       # Create, switch, templates, settings
        *":ORG") echo 3 ;;           # Push/pull config, sync status
        *) echo 1 ;;
    esac
}

# Render the header with mode selector and current environment
render_header() {
    local header="${BOLD}${CYAN}TETRA VIEW${RESET}"

    # Show active TOML file if detected
    if [[ -n "$ACTIVE_TOML" ]]; then
        header+=" - ${BOLD}${YELLOW}${ACTIVE_TOML}${RESET}"
    fi

    echo "$header"
    echo

    # Environment selector (top line)
    local env_bar="Environment: "
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$CURRENT_ENV" ]]; then
            env_bar+="[${BOLD}${BLUE}${env}${RESET}] "
        else
            env_bar+="${env} "
        fi
    done

    # Add drill level indicator to environment line
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        env_bar+="   ${BOLD}${YELLOW}[DRILLED IN]${RESET}"
    fi

    echo "$env_bar"

    # Mode selector (bottom line, indented to align colons)
    local mode_bar="     Mode: "
    for mode in "${MODES[@]}"; do
        if [[ "$mode" == "$CURRENT_MODE" ]]; then
            mode_bar+="[${BOLD}${GREEN}${mode}${RESET}] "
        else
            mode_bar+="${mode} "
        fi
    done

    echo "$mode_bar"
    echo "════════════════════════════════════════════════════════════════"
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
        *) echo "Unknown environment/mode combination: $CURRENT_ENV:$CURRENT_MODE" ;;
    esac
}

# Show drilled-in content for selected item
show_drilled_content() {
    echo
    echo "${BOLD}${YELLOW}>>> DRILLED INTO ITEM $((CURRENT_ITEM + 1)) <<<${RESET}"
    echo

    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML")
            show_toml_system_details
            ;;
        "LOCAL:TOML")
            show_toml_local_details
            ;;
        "DEV:TOML"|"STAGING:TOML"|"PROD:TOML")
            show_toml_environment_details "$CURRENT_ENV"
            ;;
        "LOCAL:TSM")
            show_tsm_local_details
            ;;
        "DEV:TSM"|"STAGING:TSM"|"PROD:TSM")
            show_tsm_remote_details "$CURRENT_ENV"
            ;;
        "SYSTEM:ORG")
            show_org_system_details
            ;;
        "LOCAL:ORG")
            show_org_local_details
            ;;
        "DEV:ORG"|"STAGING:ORG"|"PROD:ORG")
            show_org_environment_details "$CURRENT_ENV"
            ;;
        *)
            echo "    ${BOLD}${CYAN}Detailed view for $CURRENT_ENV:$CURRENT_MODE${RESET}"
            echo "    ├─ Environment: $CURRENT_ENV"
            echo "    ├─ Mode: $CURRENT_MODE"
            echo "    ├─ Selected Item: $((CURRENT_ITEM + 1))"
            echo "    └─ Press 'j' to drill out"
            ;;
    esac

    echo
    echo "${BOLD}${YELLOW}Press 'j' to drill out${RESET}"
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

# TOML mode renderers
render_toml_system() {
    cat << EOF

TOML Configuration Overview

$(highlight_line "Active TOML: ${ACTIVE_TOML:-No TOML file detected}" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Organization: ${ACTIVE_ORG:-Local Project}" "$(is_current_item 1)" "$MAGENTA")
$(highlight_line "Project: ${PROJECT_NAME:-Unknown}" "$(is_current_item 2)" "$CYAN")
$(highlight_line "Parse Status: ${TOML_SYNC_STATUS:-Ready for sync}" "$(is_current_item 3)" "$GREEN")

Infrastructure Summary:
  Dev: ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})
  Staging: ${STAGING_SERVER:-Unknown} (${STAGING_IP:-Unknown})
  Prod: ${PROD_SERVER:-Unknown} (${PROD_IP:-Unknown})

Configuration Sections: ${TOML_SECTIONS:-None detected}
Domain Base: ${DOMAIN_BASE:-Unknown}

EOF
}

render_toml_local() {
    cat << EOF

LOCAL Environment Configuration

$(highlight_line "Domain: ${LOCAL_DOMAIN:-localhost}" "$(is_current_item 0)" "$CYAN")
$(highlight_line "Port: ${LOCAL_PORT:-8000}" "$(is_current_item 1)" "$CYAN")
$(highlight_line "Node Env: ${LOCAL_NODE_ENV:-development}" "$(is_current_item 2)" "$CYAN")
$(highlight_line "Data Dir: ${LOCAL_DATA_DIR:-/home/dev/pj/pd}" "$(is_current_item 3)" "$CYAN")

Local development environment configuration.
Used for localhost development and testing.

EOF
}

render_toml_dev() {
    cat << EOF

DEV Environment Infrastructure

$(highlight_line "Server: ${DEV_SERVER:-Unknown}" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Public IP: ${DEV_IP:-Unknown}" "$(is_current_item 1)" "$GREEN")
$(highlight_line "Private IP: ${DEV_PRIVATE_IP:-Unknown}" "$(is_current_item 2)" "$GREEN")
$(highlight_line "Memory: ${DEV_MEMORY:-Unknown} | Region: ${DEV_REGION:-Unknown}" "$(is_current_item 3)" "$GREEN")
$(highlight_line "SSH Status: ${DEV_SSH_STATUS:-Testing...}" "$(is_current_item 4)" "$([[ ${DEV_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")

Domain: ${DEV_DOMAIN:-dev.pixeljamarcade.com}
Environment: Development server for shared development

EOF
}

render_toml_staging() {
    cat << EOF

STAGING Environment Infrastructure

$(highlight_line "Server: ${STAGING_SERVER:-Unknown}" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Public IP: ${STAGING_IP:-Unknown}" "$(is_current_item 1)" "$YELLOW")
$(highlight_line "Private IP: ${STAGING_PRIVATE_IP:-Unknown}" "$(is_current_item 2)" "$YELLOW")
$(highlight_line "Memory: ${STAGING_MEMORY:-Unknown} | Region: ${STAGING_REGION:-Unknown}" "$(is_current_item 3)" "$YELLOW")
$(highlight_line "SSH Status: ${STAGING_SSH_STATUS:-Testing...}" "$(is_current_item 4)" "$([[ ${STAGING_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")

Domain: ${STAGING_DOMAIN:-staging.pixeljamarcade.com}
Environment: Pre-production testing and validation

EOF
}

render_toml_prod() {
    cat << EOF

PROD Environment Infrastructure

$(highlight_line "Server: ${PROD_SERVER:-Unknown}" "$(is_current_item 0)" "$RED")
$(highlight_line "Public IP: ${PROD_IP:-Unknown}" "$(is_current_item 1)" "$RED")
$(highlight_line "Private IP: ${PROD_PRIVATE_IP:-Unknown}" "$(is_current_item 2)" "$RED")
$(highlight_line "Memory: ${PROD_MEMORY:-Unknown} | Region: ${PROD_REGION:-Unknown}" "$(is_current_item 3)" "$RED")
$(highlight_line "SSH Status: ${PROD_SSH_STATUS:-Testing...}" "$(is_current_item 4)" "$([[ ${PROD_SSH_STATUS} == *"Connected"* ]] && echo $GREEN || echo $RED)")

Domain: ${PROD_DOMAIN:-pixeljamarcade.com}
Environment: Production - Live environment

EOF
}

# Placeholder renderers for other modes (TKM, TSM, DEPLOY)
render_tkm_system() {
    cat << EOF

TKM - Tetra Key Manager Overview

$(highlight_line "SSH Keys: ${TKM_KEY_COUNT:-0} keys configured" "$(is_current_item 0)" "$GREEN")
$(highlight_line "Known Hosts: ${TKM_KNOWN_HOSTS_COUNT:-0} hosts" "$(is_current_item 1)" "$GREEN")

Key management for secure server access.
Use W/S to select environments for key deployment.

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

# Data loading functions
detect_active_toml() {
    # Check for organization-based TOML first
    local tetra_toml="$TETRA_DIR/config/tetra.toml"

    if [[ -L "$tetra_toml" ]]; then
        # Organization system is active
        ACTIVE_TOML="$tetra_toml"
        local target=$(readlink "$tetra_toml")
        ACTIVE_ORG=$(basename "$(dirname "$target")")
        PROJECT_NAME="$ACTIVE_ORG"
    else
        # Fallback to local TOML files
        local toml_files=(*.toml)
        if [[ -f "${toml_files[0]}" ]]; then
            ACTIVE_TOML="${toml_files[0]}"
            PROJECT_NAME="$(basename "$ACTIVE_TOML" .toml)"
            ACTIVE_ORG=""
        else
            ACTIVE_TOML=""
            PROJECT_NAME=""
            ACTIVE_ORG=""
        fi
    fi
}

load_toml_data() {
    # Source the TOML parser
    source "$TETRA_SRC/bash/utils/toml_parser.sh" 2>/dev/null || true

    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        # Use enhanced TOML parser for comprehensive data extraction
        if toml_parse "$ACTIVE_TOML" "TOML" 2>/dev/null; then
            # Extract infrastructure data using TOML parser
            DEV_SERVER=$(toml_get "infrastructure" "dev_server" "TOML" 2>/dev/null || grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_IP=$(toml_get "infrastructure" "dev_ip" "TOML" 2>/dev/null || grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_PRIVATE_IP=$(toml_get "infrastructure" "dev_private_ip" "TOML" 2>/dev/null || grep "^dev_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_MEMORY=$(toml_get "infrastructure" "dev_memory" "TOML" 2>/dev/null || grep "^dev_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_REGION=$(toml_get "infrastructure" "dev_region" "TOML" 2>/dev/null || grep "^dev_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

            STAGING_SERVER=$(toml_get "infrastructure" "qa_server" "TOML" 2>/dev/null || grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_IP=$(toml_get "infrastructure" "qa_ip" "TOML" 2>/dev/null || grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_PRIVATE_IP=$(toml_get "infrastructure" "qa_private_ip" "TOML" 2>/dev/null || grep "^qa_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_MEMORY=$(toml_get "infrastructure" "qa_memory" "TOML" 2>/dev/null || grep "^qa_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_REGION=$(toml_get "infrastructure" "qa_region" "TOML" 2>/dev/null || grep "^qa_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

            PROD_SERVER=$(toml_get "infrastructure" "prod_server" "TOML" 2>/dev/null || grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_IP=$(toml_get "infrastructure" "prod_ip" "TOML" 2>/dev/null || grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_PRIVATE_IP=$(toml_get "infrastructure" "prod_private_ip" "TOML" 2>/dev/null || grep "^prod_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_MEMORY=$(toml_get "infrastructure" "prod_memory" "TOML" 2>/dev/null || grep "^prod_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_REGION=$(toml_get "infrastructure" "prod_region" "TOML" 2>/dev/null || grep "^prod_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

            # Extract domain configuration - multiple fallback strategies
            DOMAIN_BASE=$(toml_get "domains" "base_domain" "TOML" 2>/dev/null || \
                         toml_get "domain" "base" "TOML" 2>/dev/null || \
                         grep "^base_domain" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || \
                         echo "pixeljamarcade.com")

            # Environment-specific domains with enhanced fallbacks
            DEV_DOMAIN=$(toml_get "environments_dev" "domain" "TOML" 2>/dev/null || \
                        toml_get "domains" "dev" "TOML" 2>/dev/null || \
                        toml_get "domain" "dev" "TOML" 2>/dev/null || \
                        echo "dev.$DOMAIN_BASE")

            STAGING_DOMAIN=$(toml_get "environments_staging" "domain" "TOML" 2>/dev/null || \
                           toml_get "domains" "staging" "TOML" 2>/dev/null || \
                           toml_get "domain" "staging" "TOML" 2>/dev/null || \
                           echo "staging.$DOMAIN_BASE")

            PROD_DOMAIN=$(toml_get "environments_prod" "domain" "TOML" 2>/dev/null || \
                         toml_get "domains" "prod" "TOML" 2>/dev/null || \
                         toml_get "domain" "prod" "TOML" 2>/dev/null || \
                         echo "$DOMAIN_BASE")

            # Organization metadata
            ORG_NAME=$(toml_get "metadata" "name" "TOML" 2>/dev/null || \
                      toml_get "org" "name" "TOML" 2>/dev/null || \
                      echo "Unknown")
            ORG_TYPE=$(toml_get "metadata" "type" "TOML" 2>/dev/null || echo "standard")

            # Check for shared infrastructure scenarios
            SHARED_IP_MODE="false"
            if [[ "$DEV_IP" == "$STAGING_IP" && "$STAGING_IP" == "$PROD_IP" && "$DEV_IP" != "Unknown" ]]; then
                SHARED_IP_MODE="true"
                SHARED_IP="$DEV_IP"
            fi

            # Extract port and service configuration
            LOCAL_DOMAIN="localhost"
            LOCAL_PORT=$(toml_get "ports" "default" "TOML" 2>/dev/null || grep "^default_port" "$ACTIVE_TOML" | awk '{print $3}' 2>/dev/null || echo "8000")
            LOCAL_NODE_ENV="development"
            LOCAL_DATA_DIR=$(toml_get "paths" "data" "TOML" 2>/dev/null || echo "/home/dev/pj/pd")

            # Extract additional configuration sections
            TOML_SECTIONS=""
            if command -v toml_sections >/dev/null 2>&1; then
                TOML_SECTIONS=$(toml_sections "TOML" | tr '\n' ' ')
            fi

            TOML_SYNC_STATUS="Enhanced TOML data loaded"
        else
            # Fallback to basic grep parsing
            DEV_SERVER=$(grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_IP=$(grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_SERVER=$(grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_IP=$(grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_SERVER=$(grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_IP=$(grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DOMAIN_BASE=$(grep "^domain_base" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "pixeljamarcade.com")
            LOCAL_PORT=$(grep "^default_port" "$ACTIVE_TOML" | awk '{print $3}' 2>/dev/null || echo "8000")

            DEV_DOMAIN="dev.$DOMAIN_BASE"
            STAGING_DOMAIN="staging.$DOMAIN_BASE"
            PROD_DOMAIN="$DOMAIN_BASE"
            LOCAL_DOMAIN="localhost"
            LOCAL_NODE_ENV="development"
            LOCAL_DATA_DIR="/home/dev/pj/pd"

            TOML_SYNC_STATUS="Basic TOML parsing"
        fi
    else
        # Set defaults when no TOML
        DEV_SERVER="Unknown"
        DEV_IP="Unknown"
        STAGING_SERVER="Unknown"
        STAGING_IP="Unknown"
        PROD_SERVER="Unknown"
        PROD_IP="Unknown"
        TOML_SYNC_STATUS="No TOML file - use NH_ variables or create TOML"
        LOCAL_DOMAIN="localhost"
        LOCAL_PORT="8000"
        LOCAL_NODE_ENV="development"
        LOCAL_DATA_DIR="/home/dev/pj/pd"
        DOMAIN_BASE="localhost"
        DEV_DOMAIN="localhost"
        STAGING_DOMAIN="localhost"
        PROD_DOMAIN="localhost"
        TOML_SECTIONS=""
    fi
}

load_ssh_connectivity() {
    # Fast SSH connectivity test with timeout and parallel execution
    if [[ "$DEV_IP" != "Unknown" ]]; then
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$DEV_IP" exit 2>/dev/null; then
            DEV_SSH_STATUS="✓ Connected"
        else
            DEV_SSH_STATUS="○ No SSH"
        fi
    else
        DEV_SSH_STATUS="○ No IP"
    fi

    if [[ "$STAGING_IP" != "Unknown" ]]; then
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$STAGING_IP" exit 2>/dev/null; then
            STAGING_SSH_STATUS="✓ Connected"
        else
            STAGING_SSH_STATUS="○ No SSH"
        fi
    else
        STAGING_SSH_STATUS="○ No IP"
    fi

    if [[ "$PROD_IP" != "Unknown" ]]; then
        if timeout 1 ssh -o ConnectTimeout=1 -o BatchMode=yes -o StrictHostKeyChecking=no tetra@"$PROD_IP" exit 2>/dev/null; then
            PROD_SSH_STATUS="✓ Connected"
        else
            PROD_SSH_STATUS="○ No SSH"
        fi
    else
        PROD_SSH_STATUS="○ No IP"
    fi
}

load_environment_data() {
    # Load TSM data
    if command -v tsm >/dev/null 2>&1; then
        TSM_SERVICES=$(tsm list 2>/dev/null | tail -n +3 || echo "")
        TSM_COUNT_RUNNING=$(echo "$TSM_SERVICES" | grep -c "online" 2>/dev/null || echo "0")
        TSM_COUNT_STOPPED=$(echo "$TSM_SERVICES" | grep -c "stopped\|offline" 2>/dev/null || echo "0")
    else
        TSM_SERVICES=""
        TSM_COUNT_RUNNING=0
        TSM_COUNT_STOPPED=0
    fi

    # Load Git data
    if git rev-parse --git-dir >/dev/null 2>&1; then
        GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
        GIT_STATUS=$(git status --porcelain 2>/dev/null)
        if [[ -z "$GIT_STATUS" ]]; then
            GIT_CLEAN="✓"
        else
            GIT_CLEAN="✗"
        fi
    else
        GIT_BRANCH="main"
        GIT_CLEAN="○"
    fi

    # Load Organization data
    if [[ -f "$TETRA_DIR/config/tetra.toml" ]]; then
        # Try to extract active organization from symlink target
        local toml_target=$(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null)
        if [[ -n "$toml_target" ]]; then
            ACTIVE_ORG=$(basename "$(dirname "$toml_target")")
        else
            ACTIVE_ORG="Local Project"
        fi
    else
        ACTIVE_ORG="No active organization"
    fi

    # Count total organizations
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        TOTAL_ORGS=$(find "$TETRA_DIR/orgs" -maxdepth 1 -type d | wc -l)
        TOTAL_ORGS=$((TOTAL_ORGS - 1)) # Subtract 1 for the orgs directory itself
    else
        TOTAL_ORGS=0
    fi

    # Set other defaults
    SSH_AGENT_STATUS="Unknown"
    TKM_KEY_COUNT="Unknown"
    TKM_KNOWN_HOSTS_COUNT="Unknown"
    DEPLOY_READINESS="Unknown"
    BUILD_STATUS="Unknown"
    ORG_STATUS="Ready"
    DEV_ORG_SYNC="Unknown"
    STAGING_ORG_SYNC="Unknown"
    PROD_ORG_SYNC="Unknown"
}

# Modal and command functions
show_item_modal() {
    clear
    echo
    echo "    ╔══════════════════════════════════════════════════════════╗"
    echo "    ║  DETAILED VIEW: $CURRENT_MODE - $CURRENT_ENV"
    echo "    ╚══════════════════════════════════════════════════════════╝"
    echo

    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:SYSTEM")
            show_toml_system_details
            ;;
        "TOML:LOCAL")
            show_toml_local_details
            ;;
        "TOML:DEV")
            show_toml_environment_details "DEV"
            ;;
        "TOML:STAGING")
            show_toml_environment_details "STAGING"
            ;;
        "TOML:PROD")
            show_toml_environment_details "PROD"
            ;;
        "TSM:LOCAL")
            show_tsm_local_details
            ;;
        "TSM:DEV"|"TSM:STAGING"|"TSM:PROD")
            show_tsm_remote_details "$CURRENT_ENV"
            ;;
        "ORG:SYSTEM")
            show_org_system_details
            ;;
        "ORG:LOCAL")
            show_org_local_details
            ;;
        "ORG:DEV"|"ORG:STAGING"|"ORG:PROD")
            show_org_environment_details "$CURRENT_ENV"
            ;;
        "TKM:"*)
            show_tkm_details "$CURRENT_ENV"
            ;;
        "DEPLOY:"*)
            show_deploy_details "$CURRENT_ENV"
            ;;
        *)
            echo "    Mode: $CURRENT_MODE"
            echo "    Environment: $CURRENT_ENV"
            echo "    Item: $((CURRENT_ITEM + 1))"
            echo
            echo "    Detailed view not yet implemented for this combination."
            ;;
    esac

    echo
    echo "    ─────────────────────────────────────────────────────────"
    echo "    Press any key to return to dashboard..."
    read -n1 -s
}

# Detailed view functions for TOML deep dive
show_toml_system_details() {
    case $CURRENT_ITEM in
        0)
            echo "    📄 TOML File Details:"
            echo "    ├─ Path: ${ACTIVE_TOML:-No TOML file}"
            if [[ -f "$ACTIVE_TOML" ]]; then
                echo "    ├─ Size: $(wc -c < "$ACTIVE_TOML") bytes"
                echo "    ├─ Lines: $(wc -l < "$ACTIVE_TOML") lines"
                echo "    ├─ Modified: $(date -r "$ACTIVE_TOML" 2>/dev/null || echo "Unknown")"
                echo "    └─ Sections: ${TOML_SECTIONS:-None}"
            fi
            ;;
        1)
            echo "    🏢 Organization Details:"
            echo "    ├─ Active: ${ACTIVE_ORG:-Local Project}"
            echo "    ├─ Total Organizations: ${TOTAL_ORGS:-0}"
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "Local Project" ]]; then
                echo "    ├─ Org Directory: $TETRA_DIR/orgs/$ACTIVE_ORG"
                echo "    └─ Config Path: $(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null || echo "None")"
            fi
            ;;
        2)
            echo "    📦 Project Configuration:"
            echo "    ├─ Name: ${PROJECT_NAME:-Unknown}"
            echo "    ├─ Domain Base: ${DOMAIN_BASE:-Unknown}"
            echo "    ├─ Local Port: ${LOCAL_PORT:-8000}"
            echo "    └─ Data Directory: ${LOCAL_DATA_DIR:-/home/dev/pj/pd}"
            ;;
        3)
            echo "    ⚡ Configuration Status:"
            echo "    ├─ Parse Status: ${TOML_SYNC_STATUS:-Unknown}"
            echo "    ├─ TOML Parser: $(command -v toml_parse >/dev/null && echo "Available" || echo "Not available")"
            if [[ -n "$TOML_SECTIONS" ]]; then
                echo "    └─ Available Sections:"
                for section in $TOML_SECTIONS; do
                    echo "        • $section"
                done
            fi
            ;;
    esac
}

show_toml_local_details() {
    echo "    🏠 Local Development Configuration:"
    echo "    ├─ Domain: ${LOCAL_DOMAIN:-localhost}"
    echo "    ├─ Port: ${LOCAL_PORT:-8000}"
    echo "    ├─ Node Environment: ${LOCAL_NODE_ENV:-development}"
    echo "    ├─ Data Directory: ${LOCAL_DATA_DIR:-/home/dev/pj/pd}"
    echo "    └─ Full URL: http://${LOCAL_DOMAIN:-localhost}:${LOCAL_PORT:-8000}"
    echo
    echo "    📋 Local Services (TSM):"
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "$TSM_SERVICES" | head -10
    else
        echo "    └─ No local services running"
    fi
}

show_toml_environment_details() {
    local env="$1"
    local server_var="${env}_SERVER"
    local ip_var="${env}_IP"
    local private_ip_var="${env}_PRIVATE_IP"
    local memory_var="${env}_MEMORY"
    local region_var="${env}_REGION"
    local domain_var="${env}_DOMAIN"
    local ssh_status_var="${env}_SSH_STATUS"

    echo "    🌐 $env Environment Infrastructure:"
    echo "    ├─ Server: ${!server_var:-Unknown}"
    echo "    ├─ Public IP: ${!ip_var:-Unknown}"
    echo "    ├─ Private IP: ${!private_ip_var:-Unknown}"
    echo "    ├─ Memory: ${!memory_var:-Unknown}"
    echo "    ├─ Region: ${!region_var:-Unknown}"
    echo "    ├─ Domain: ${!domain_var:-Unknown}"
    echo "    └─ SSH Status: ${!ssh_status_var:-Unknown}"
    echo
    echo "    🔗 Connection Details:"
    if [[ "${!ip_var}" != "Unknown" ]]; then
        echo "    ├─ SSH Command: ssh tetra@${!ip_var}"
        echo "    ├─ Full URL: https://${!domain_var}"
        echo "    └─ Private Network: ${!private_ip_var:-Unknown}"
    else
        echo "    └─ No IP configuration available"
    fi
}

show_tsm_local_details() {
    echo "    ⚙️  Local Service Manager (TSM) Details:"
    echo "    ├─ Running Services: ${TSM_COUNT_RUNNING:-0}"
    echo "    ├─ Stopped Services: ${TSM_COUNT_STOPPED:-0}"
    echo "    └─ TSM Directory: $TETRA_DIR/tsm"
    echo
    echo "    📊 Service List:"
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "$TSM_SERVICES"
    else
        echo "    └─ No services found"
    fi
    echo
    echo "    🎯 Port Registry:"
    if command -v tsm >/dev/null 2>&1; then
        tsm ports list 2>/dev/null | head -10 || echo "    └─ Port registry not available"
    else
        echo "    └─ TSM command not available"
    fi
}

show_tsm_remote_details() {
    local env="$1"
    local ssh_status_var="${env}_SSH_STATUS"
    local ip_var="${env}_IP"

    echo "    🌐 Remote Service Manager - $env:"
    echo "    ├─ SSH Status: ${!ssh_status_var:-Unknown}"
    echo "    ├─ Target IP: ${!ip_var:-Unknown}"
    echo "    └─ Remote TSM: $(if [[ "${!ssh_status_var}" == *"Connected"* ]]; then echo "Available"; else echo "Not connected"; fi)"
    echo
    if [[ "${!ssh_status_var}" == *"Connected"* && "${!ip_var}" != "Unknown" ]]; then
        echo "    📊 Remote Services (attempting connection...):"
        echo "    └─ ssh tetra@${!ip_var} 'tsm list' || echo 'Remote TSM not available'"
    else
        echo "    ⚠️  Cannot connect to remote services"
        echo "    └─ SSH connection required for remote service monitoring"
    fi
}

show_tview_help() {
    clear
    cat << EOF

╔══════════════════════════════════════════════════════════╗
║                     TETRA VIEW HELP                     ║
╚══════════════════════════════════════════════════════════╝

HIERARCHICAL NAVIGATION SYSTEM:
  w, e        Switch environments (SYSTEM ← → LOCAL ← → DEV ← → STAGING ← → PROD)
  a, d        Switch modes (TOML ← → TKM ← → TSM ← → DEPLOY ← → ORG)
  i, k        Navigate items up/down within current context
  l           Drill INTO selected item (detailed view)
  j           Drill OUT of item (back to overview)

ACTIONS:
  Enter       Show detailed modal for selected item
  r           Refresh dashboard data
  q           Quit dashboard

COMMANDS:
  h           Show this help screen
  t           Execute 'tsm list' command
  g           Execute 'git status' command

MODES:
  TOML        Infrastructure configuration and environment data
  TKM         SSH key management and server connectivity
  TSM         Service management (local and remote)
  DEPLOY      Deployment status and operations
  ORG         Organization management and multi-client infrastructure

ENVIRONMENTS:
  SYSTEM      Overview/summary across all environments
  LOCAL       Your development machine
  DEV         Development server
  STAGING     Staging/QA server
  PROD        Production server

Press any key to return to dashboard...
EOF
    read -n1 -s
}

execute_tsm_command() {
    echo "Executing: tsm list"
    tsm list 2>/dev/null || echo "TSM not available"
    echo "Press any key to continue..."
    read -n1 -s
}

execute_git_command() {
    echo "Executing: git status"
    git status 2>/dev/null || echo "Not a git repository"
    echo "Press any key to continue..."
    read -n1 -s
}

view_toml_file() {
    clear
    echo
    echo "    ╔══════════════════════════════════════════════════════════╗"
    echo "    ║  RAW TOML CONFIGURATION"
    echo "    ╚══════════════════════════════════════════════════════════╝"
    echo

    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "    📄 File: $ACTIVE_TOML"
        echo "    ═══════════════════════════════════════════════════════════"
        echo

        # Show file with line numbers, limited to screen size
        local terminal_lines=${LINES:-24}
        local content_lines=$((terminal_lines - 15))  # Reserve space for header/footer

        nl -ba "$ACTIVE_TOML" | head -n "$content_lines"

        local total_lines=$(wc -l < "$ACTIVE_TOML")
        if [[ $total_lines -gt $content_lines ]]; then
            echo
            echo "    ... showing first $content_lines of $total_lines total lines"
            echo "    Use 'cat $ACTIVE_TOML' to view complete file"
        fi

        echo
        echo "    ═══════════════════════════════════════════════════════════"
        echo "    📊 File Stats: $total_lines lines, $(wc -c < "$ACTIVE_TOML") bytes"
        if command -v toml_sections >/dev/null 2>&1; then
            local sections=$(toml_sections "TOML" 2>/dev/null | tr '\n' ' ')
            echo "    🔧 Sections: ${sections:-None detected}"
        fi
    else
        echo "    ⚠️  No TOML file available"
        echo "    ├─ Active TOML: ${ACTIVE_TOML:-Not set}"
        echo "    └─ Status: ${TOML_SYNC_STATUS:-Unknown}"
        echo
        echo "    💡 To create a TOML configuration:"
        echo "    ├─ Create a .toml file in your project"
        echo "    └─ Or use organization management: tetra org template"
    fi

    echo
    echo "    ─────────────────────────────────────────────────────────"
    echo "    Press any key to return to dashboard..."
    read -n1 -s
}
# ORG mode detailed views
show_org_system_details() {
    echo "    🏢 Organization System Overview:"
    echo "    ├─ Active Organization: ${ACTIVE_ORG:-No active organization}"
    echo "    ├─ Total Organizations: ${TOTAL_ORGS:-0}"
    echo "    └─ Organization Directory: $TETRA_DIR/orgs"
    echo
    echo "    📋 Available Organizations:"
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        for org_dir in "$TETRA_DIR/orgs"/*; do
            if [[ -d "$org_dir" ]]; then
                local org_name=$(basename "$org_dir")
                local config_file="$org_dir/${org_name}.toml"
                if [[ "$org_name" == "${ACTIVE_ORG:-}" ]]; then
                    echo "    ├─ → $org_name (active) - $(if [[ -f "$config_file" ]]; then echo "configured"; else echo "missing config"; fi)"
                else
                    echo "    ├─   $org_name - $(if [[ -f "$config_file" ]]; then echo "configured"; else echo "missing config"; fi)"
                fi
            fi
        done
    else
        echo "    └─ No organizations directory found"
    fi
    echo
    echo "    ⚙️  Organization Commands:"
    echo "    ├─ tetra org list                List all organizations"
    echo "    ├─ tetra org templates           Show available templates"
    echo "    └─ tetra org template <name>     Create from template"
}

show_org_local_details() {
    echo "    🏠 Local Organization Management:"
    if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        echo "    ├─ Current Organization: $ACTIVE_ORG"
        local config_path=$(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null)
        echo "    ├─ Configuration Path: ${config_path:-None}"
        if [[ -f "$config_path" ]]; then
            echo "    ├─ Config Size: $(wc -c < "$config_path") bytes"
            echo "    └─ Last Modified: $(date -r "$config_path" 2>/dev/null || echo "Unknown")"
        fi
    else
        echo "    ├─ No active organization"
        echo "    └─ Using local project configuration"
    fi
    echo
    echo "    📦 Available Templates:"
    if [[ -d "$TETRA_SRC/templates/organizations" ]]; then
        for template in "$TETRA_SRC/templates/organizations"/*.toml; do
            if [[ -f "$template" ]]; then
                local name=$(basename "$template" .toml)
                echo "    ├─ $name"
            fi
        done
    else
        echo "    └─ No templates found"
    fi
    echo
    echo "    🔧 Local Actions:"
    echo "    ├─ Switch organization: tetra org switch <name>"
    echo "    ├─ Create from template: tetra org template <template> <name>"
    echo "    └─ Validate configuration: tetra org validate <name>"
}

show_org_environment_details() {
    local env="$1"
    local env_lower=$(echo "$env" | tr '[:upper:]' '[:lower:]')

    echo "    🌐 Organization Deployment - $env Environment:"

    if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        local org_dir="$TETRA_DIR/orgs/$ACTIVE_ORG"
        local deployment_file="$org_dir/deployments/${env_lower}.toml"
        local deployed_config="$org_dir/deployed/${env_lower}.toml"

        echo "    ├─ Organization: $ACTIVE_ORG"
        echo "    ├─ Target Environment: $env"

        if [[ -f "$deployment_file" ]]; then
            echo "    ├─ Deployment History: Available"
            echo "    ├─ Last Deployment: $(grep "^timestamp" "$deployment_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")"
            echo "    ├─ Deployed By: $(grep "^deployed_by" "$deployment_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")"
        else
            echo "    ├─ Deployment History: No deployments to $env"
        fi

        if [[ -f "$deployed_config" ]]; then
            echo "    ├─ Deployed Config: $(wc -c < "$deployed_config") bytes"
            echo "    └─ Config Modified: $(date -r "$deployed_config" 2>/dev/null || echo "Unknown")"
        else
            echo "    └─ Deployed Config: Not found"
        fi

        echo
        echo "    🚀 Deployment Actions:"
        echo "    ├─ Push config: tetra org push $ACTIVE_ORG $env_lower"
        echo "    ├─ Pull config: tetra org pull $ACTIVE_ORG $env_lower"
        echo "    ├─ View history: tetra org history $ACTIVE_ORG $env_lower"
        echo "    └─ Rollback: tetra org rollback $ACTIVE_ORG $env_lower"

        echo
        echo "    📊 Backup Status:"
        local backup_dir="$org_dir/backups"
        if [[ -d "$backup_dir" ]]; then
            local backup_count=$(find "$backup_dir" -name "${env_lower}_*.toml" 2>/dev/null | wc -l)
            echo "    └─ Backups for $env: $backup_count files"
        else
            echo "    └─ No backup directory found"
        fi
    else
        echo "    ├─ No active organization"
        echo "    └─ Cannot deploy without active organization"
        echo
        echo "    💡 To use organization deployment:"
        echo "    ├─ 1. Create organization: tetra org template <template> <name>"
        echo "    ├─ 2. Switch to it: tetra org switch <name>"
        echo "    └─ 3. Deploy: tetra org push <name> $env_lower"
    fi
}

# TKM mode detailed views
show_tkm_details() {
    local env="$1"
    echo "    🔑 SSH Key Management - $env:"

    case "$env" in
        "SYSTEM")
            echo "    ├─ SSH Keys Directory: ~/.ssh/"
            echo "    ├─ SSH Config: ~/.ssh/config"
            echo "    ├─ Known Hosts: ~/.ssh/known_hosts"
            if command -v ssh-add >/dev/null 2>&1; then
                echo "    └─ SSH Agent: $(ssh-add -l 2>/dev/null | wc -l) keys loaded"
            else
                echo "    └─ SSH Agent: Not available"
            fi
            echo
            echo "    📋 Local SSH Keys:"
            if [[ -d ~/.ssh ]]; then
                for keyfile in ~/.ssh/id_*; do
                    if [[ -f "$keyfile" && "$keyfile" != *".pub" ]]; then
                        local keyname=$(basename "$keyfile")
                        echo "    ├─ $keyname $(if [[ -f "${keyfile}.pub" ]]; then echo "(public key available)"; else echo "(private only)"; fi)"
                    fi
                done
            fi
            ;;
        "LOCAL")
            echo "    ├─ Local SSH Configuration"
            echo "    ├─ Key Generation and Management"
            echo "    └─ SSH Agent Configuration"
            ;;
        *)
            local ip_var="${env}_IP"
            local ssh_status_var="${env}_SSH_STATUS"
            echo "    ├─ Target Server: ${!ip_var:-Unknown}"
            echo "    ├─ SSH Status: ${!ssh_status_var:-Unknown}"
            echo "    └─ Key Deployment Status: $(if [[ "${!ssh_status_var}" == *"Connected"* ]]; then echo "Keys accessible"; else echo "Cannot verify"; fi)"
            ;;
    esac
}

# DEPLOY mode detailed views
show_deploy_details() {
    local env="$1"
    echo "    🚀 Deployment Details - $env:"

    case "$env" in
        "SYSTEM")
            echo "    ├─ Git Repository: $(if git rev-parse --git-dir >/dev/null 2>&1; then echo "Detected"; else echo "Not a git repository"; fi)"
            echo "    ├─ Current Branch: ${GIT_BRANCH:-Unknown}"
            echo "    ├─ Working Tree: $(if [[ "$GIT_CLEAN" == "✓" ]]; then echo "Clean"; else echo "Modified files"; fi)"
            echo "    └─ Deploy Readiness: ${DEPLOY_READINESS:-Unknown}"
            ;;
        "LOCAL")
            echo "    ├─ Local Development Status"
            echo "    ├─ Git Status: ${GIT_CLEAN:-Unknown}"
            echo "    ├─ Branch: ${GIT_BRANCH:-main}"
            echo "    └─ Build Status: ${BUILD_STATUS:-Unknown}"
            if git rev-parse --git-dir >/dev/null 2>&1; then
                echo
                echo "    📊 Git Status:"
                git status --porcelain | head -5
            fi
            ;;
        *)
            local deploy_status_var="${env}_DEPLOY_STATUS"
            local last_deploy_var="${env}_LAST_DEPLOY"
            local health_var="${env}_HEALTH_STATUS"
            echo "    ├─ Environment: $env"
            echo "    ├─ Deploy Status: ${!deploy_status_var:-Unknown}"
            echo "    ├─ Last Deploy: ${!last_deploy_var:-Never}"
            echo "    └─ Health Status: ${!health_var:-Unknown}"
            ;;
    esac
}
