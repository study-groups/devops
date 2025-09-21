#!/usr/bin/env bash

# TDash REPL - Tetra Dashboard with 4-Mode, 4-Environment Navigation

# Global state - New navigation paradigm
CURRENT_MODE="TOML"      # TOML | TKM | TSM | DEPLOY
CURRENT_ENV="LOCAL"      # LOCAL | DEV | STAGING | PROD
CURRENT_ITEM=0           # Item within current mode+environment

# Available modes and environments
MODES=("TOML" "TKM" "TSM" "DEPLOY")
ENVIRONMENTS=("SYSTEM" "LOCAL" "DEV" "STAGING" "PROD")

# TDash REPL main function - Complete redesign for 4-mode navigation
tdash_repl() {
    local content_lines=0
    local terminal_lines=${LINES:-24}

    # Initialize display
    setup_colors
    detect_active_toml

    while true; do
        # Load fresh data BEFORE clearing screen
        load_toml_data
        load_ssh_connectivity
        load_environment_data

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
        full_display+="[tdash] Mode: a,d | Env: w,s | Items: j,i,k,l"$'\n'
        full_display+="Commands: enter, r, q, h, t, g"$'\n'

        # NOW clear and display everything at once
        clear
        echo -n "$full_display"
        read -p "> " -n1 key

        case "$key" in
            'a'|'A')
                navigate_mode "left"
                ;;
            'd'|'D')
                navigate_mode "right"
                ;;
            'w'|'W')
                navigate_environment "up"
                ;;
            's'|'S')
                navigate_environment "down"
                ;;
            'j'|'J')
                navigate_item "left"
                ;;
            'i'|'I')
                navigate_item "up"
                ;;
            'k'|'K')
                navigate_item "down"
                ;;
            'l'|'L')
                navigate_item "right"
                ;;
            '')  # Enter key
                show_item_modal
                ;;
            'q'|'Q')
                echo "Exiting tdash..."
                break
                ;;
            'r'|'R')
                # Just continue to refresh
                ;;
            'h'|'H')
                show_tdash_help
                ;;
            't'|'T')
                execute_tsm_command
                ;;
            'g'|'G')
                execute_git_command
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
}

# Navigate between environments (W/S keys)
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

    if [[ "$direction" == "up" ]]; then
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

# Get maximum items for current mode+environment combination
get_max_items_for_current_context() {
    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:SYSTEM") echo 3 ;;     # TOML file, project info, sync status
        "TOML:LOCAL") echo 4 ;;      # Local config items
        "TOML:DEV") echo 5 ;;        # Dev server infrastructure items
        "TOML:STAGING") echo 5 ;;    # Staging server infrastructure items
        "TOML:PROD") echo 5 ;;       # Prod server infrastructure items
        "TKM:SYSTEM") echo 2 ;;      # Key status, known hosts
        "TKM:LOCAL") echo 3 ;;       # Local keys, SSH config, status
        "TKM:"*) echo 2 ;;           # SSH connectivity, key deployment
        "TSM:SYSTEM") echo 2 ;;      # Service manager status
        "TSM:LOCAL")
            if [[ -n "$TSM_SERVICES" ]]; then
                echo $(echo "$TSM_SERVICES" | wc -l)
            else
                echo 1
            fi
            ;;
        "TSM:"*) echo 2 ;;           # Remote service status (if SSH connected)
        "DEPLOY:SYSTEM") echo 2 ;;   # Deploy status overview
        "DEPLOY:LOCAL") echo 3 ;;    # Git status, artifacts, deploy readiness
        "DEPLOY:"*) echo 3 ;;        # Deployment status, last deploy, actions
        *) echo 1 ;;
    esac
}

# Render the header with mode selector and current environment
render_header() {
    local header="${BOLD}${CYAN}TETRA DASHBOARD${RESET}"

    # Show active TOML file if detected
    if [[ -n "$ACTIVE_TOML" ]]; then
        header+=" - ${BOLD}${YELLOW}${ACTIVE_TOML}${RESET}"
    fi

    echo "$header"
    echo

    # Mode selector bar
    local mode_bar="Mode: "
    for mode in "${MODES[@]}"; do
        if [[ "$mode" == "$CURRENT_MODE" ]]; then
            mode_bar+="[${BOLD}${GREEN}${mode}${RESET}] "
        else
            mode_bar+="${mode} "
        fi
    done

    mode_bar+="   Environment: ${BOLD}${BLUE}${CURRENT_ENV}${RESET}"
    echo "$mode_bar"
    echo "════════════════════════════════════════════════════════════════"
}

# Render content based on current mode and environment
render_mode_environment_content() {
    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:SYSTEM") render_toml_system ;;
        "TOML:LOCAL") render_toml_local ;;
        "TOML:DEV") render_toml_dev ;;
        "TOML:STAGING") render_toml_staging ;;
        "TOML:PROD") render_toml_prod ;;
        "TKM:SYSTEM") render_tkm_system ;;
        "TKM:LOCAL") render_tkm_local ;;
        "TKM:DEV") render_tkm_dev ;;
        "TKM:STAGING") render_tkm_staging ;;
        "TKM:PROD") render_tkm_prod ;;
        "TSM:SYSTEM") render_tsm_system ;;
        "TSM:LOCAL") render_tsm_local ;;
        "TSM:DEV") render_tsm_dev ;;
        "TSM:STAGING") render_tsm_staging ;;
        "TSM:PROD") render_tsm_prod ;;
        "DEPLOY:SYSTEM") render_deploy_system ;;
        "DEPLOY:LOCAL") render_deploy_local ;;
        "DEPLOY:DEV") render_deploy_dev ;;
        "DEPLOY:STAGING") render_deploy_staging ;;
        "DEPLOY:PROD") render_deploy_prod ;;
        *) echo "Unknown mode/environment combination: $CURRENT_MODE:$CURRENT_ENV" ;;
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

# TOML mode renderers
render_toml_system() {
    cat << EOF

TOML Configuration Overview

$(highlight_line "Active TOML: ${ACTIVE_TOML:-No TOML file detected}" "$(is_current_item 0)" "$YELLOW")
$(highlight_line "Project: ${PROJECT_NAME:-Unknown}" "$(is_current_item 1)" "$CYAN")
$(highlight_line "Sync Status: ${TOML_SYNC_STATUS:-Ready for sync}" "$(is_current_item 2)" "$GREEN")

Infrastructure Summary:
  Dev: ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})
  Staging: ${STAGING_SERVER:-Unknown} (${STAGING_IP:-Unknown})
  Prod: ${PROD_SERVER:-Unknown} (${PROD_IP:-Unknown})

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
    local toml_files=(*.toml)
    if [[ -f "${toml_files[0]}" ]]; then
        ACTIVE_TOML="${toml_files[0]}"
        PROJECT_NAME="$(basename "$ACTIVE_TOML" .toml)"
    else
        ACTIVE_TOML=""
        PROJECT_NAME=""
    fi
}

load_toml_data() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        # Parse TOML infrastructure data
        DEV_SERVER=$(grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        DEV_IP=$(grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        DEV_PRIVATE_IP=$(grep "^dev_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        DEV_MEMORY=$(grep "^dev_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        DEV_REGION=$(grep "^dev_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

        STAGING_SERVER=$(grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        STAGING_IP=$(grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        STAGING_PRIVATE_IP=$(grep "^qa_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        STAGING_MEMORY=$(grep "^qa_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        STAGING_REGION=$(grep "^qa_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

        PROD_SERVER=$(grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        PROD_IP=$(grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        PROD_PRIVATE_IP=$(grep "^prod_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        PROD_MEMORY=$(grep "^prod_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
        PROD_REGION=$(grep "^prod_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

        # Extract domain configuration
        DOMAIN_BASE=$(grep "^domain_base" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "pixeljamarcade.com")
        DEV_DOMAIN="dev.$DOMAIN_BASE"
        STAGING_DOMAIN="staging.$DOMAIN_BASE"
        PROD_DOMAIN="$DOMAIN_BASE"

        # Extract other config
        LOCAL_DOMAIN="localhost"
        LOCAL_PORT=$(grep "^default_port" "$ACTIVE_TOML" | awk '{print $3}' 2>/dev/null || echo "8000")
        LOCAL_NODE_ENV="development"
        LOCAL_DATA_DIR="/home/dev/pj/pd"

        TOML_SYNC_STATUS="TOML data loaded"
    else
        # Set defaults when no TOML
        DEV_SERVER="Unknown"
        DEV_IP="Unknown"
        STAGING_SERVER="Unknown"
        STAGING_IP="Unknown"
        PROD_SERVER="Unknown"
        PROD_IP="Unknown"
        TOML_SYNC_STATUS="No TOML file - use NH_ variables or create TOML"
    fi
}

load_ssh_connectivity() {
    # Test SSH connectivity to each environment (background jobs for speed)
    if [[ "$DEV_IP" != "Unknown" ]]; then
        DEV_SSH_STATUS="Testing..."
        if ssh -o ConnectTimeout=2 -o BatchMode=yes tetra@"$DEV_IP" exit 2>/dev/null; then
            DEV_SSH_STATUS="✓ Connected"
        else
            DEV_SSH_STATUS="○ No SSH"
        fi
    else
        DEV_SSH_STATUS="○ No IP"
    fi

    if [[ "$STAGING_IP" != "Unknown" ]]; then
        STAGING_SSH_STATUS="Testing..."
        if ssh -o ConnectTimeout=2 -o BatchMode=yes tetra@"$STAGING_IP" exit 2>/dev/null; then
            STAGING_SSH_STATUS="✓ Connected"
        else
            STAGING_SSH_STATUS="○ No SSH"
        fi
    else
        STAGING_SSH_STATUS="○ No IP"
    fi

    if [[ "$PROD_IP" != "Unknown" ]]; then
        PROD_SSH_STATUS="Testing..."
        if ssh -o ConnectTimeout=2 -o BatchMode=yes tetra@"$PROD_IP" exit 2>/dev/null; then
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

    # Set other defaults
    SSH_AGENT_STATUS="Unknown"
    TKM_KEY_COUNT="Unknown"
    TKM_KNOWN_HOSTS_COUNT="Unknown"
    DEPLOY_READINESS="Unknown"
    BUILD_STATUS="Unknown"
}

# Modal and command functions
show_item_modal() {
    clear
    echo
    echo "    ╔══════════════════════════════════════════════════════════╗"
    echo "    ║  ITEM DETAILS: $CURRENT_MODE - $CURRENT_ENV"
    echo "    ╚══════════════════════════════════════════════════════════╝"
    echo
    echo "    Mode: $CURRENT_MODE"
    echo "    Environment: $CURRENT_ENV"
    echo "    Item: $((CURRENT_ITEM + 1))"
    echo
    echo "    Detailed view not yet implemented for this combination."
    echo
    echo "    ─────────────────────────────────────────────────────────"
    echo "    Press any key to return to dashboard..."
    read -n1 -s
}

show_tdash_help() {
    clear
    cat << EOF

╔══════════════════════════════════════════════════════════╗
║                    TETRA DASHBOARD HELP                 ║
╚══════════════════════════════════════════════════════════╝

NEW NAVIGATION SYSTEM:
  a, d        Switch between modes (TOML ← → TKM ← → TSM ← → DEPLOY)
  w, s        Switch between environments (SYSTEM ↕ LOCAL ↕ DEV ↕ STAGING ↕ PROD)
  j, i, k, l  Navigate items within current mode+environment

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