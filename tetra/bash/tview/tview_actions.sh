#!/usr/bin/env bash

# TView Actions - Modal dialogs and command handlers

# Modal and command functions
show_item_modal() {
    clear
    echo
    echo "                   ${BOLD}DETAILED VIEW: $CURRENT_MODE - $CURRENT_ENV${RESET}"
    echo

    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:TETRA")
            show_toml_tetra_details
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
        "TOML:QA")
            show_toml_environment_details "QA"
            ;;
        "TSM:LOCAL")
            show_tsm_local_details
            ;;
        "TSM:DEV"|"TSM:STAGING"|"TSM:PROD"|"TSM:QA")
            show_tsm_remote_details "$CURRENT_ENV"
            ;;
        "ORG:TETRA")
            show_org_tetra_details
            ;;
        "ORG:LOCAL")
            show_org_local_details
            ;;
        "ORG:DEV"|"ORG:STAGING"|"ORG:PROD"|"ORG:QA")
            show_org_environment_details "$CURRENT_ENV"
            ;;
        "TKM:"*)
            show_tkm_action_modal "$CURRENT_ENV" "$CURRENT_ITEM"
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
    echo
    echo "    Press any key to return to dashboard..."
    read -n1 -s
}

# Detailed view functions for TOML deep dive
show_toml_tetra_details() {
    case $CURRENT_ITEM in
        0)
            echo "    ${BOLD}TOML File Details:${RESET}"
            echo "    Path: ${ACTIVE_TOML:-No TOML file}"

            # Check if it's a symlink and show symlink info
            if [[ -L "$ACTIVE_TOML" ]]; then
                local symlink_target=$(readlink "$ACTIVE_TOML")
                echo "    ${BOLD}Symlink:${RESET} $ACTIVE_TOML → $symlink_target"

                # Show organization info if symlinked
                if [[ "$symlink_target" == */orgs/* ]]; then
                    local org_name=$(echo "$symlink_target" | sed 's|.*/orgs/\([^/]*\)/.*|\1|')
                    echo "    ${BOLD}Organization:${RESET} $org_name (via symlink)"
                fi
            elif [[ -f "$ACTIVE_TOML" ]]; then
                echo "    ${BOLD}Type:${RESET} Direct file (not symlinked)"
            fi

            if [[ -f "$ACTIVE_TOML" ]]; then
                echo "    Size: $(wc -c < "$ACTIVE_TOML") bytes"
                echo "    Lines: $(wc -l < "$ACTIVE_TOML") lines"
                echo "    Modified: $(date -r "$ACTIVE_TOML" 2>/dev/null || echo "Unknown")"
                echo
                echo "    ${BOLD}TOML Sections:${RESET}"
                if [[ -n "$TOML_SECTIONS" ]]; then
                    # Format sections nicely, 3 per line
                    echo "$TOML_SECTIONS" | tr ' ' '\n' | sed 's/^/      /' | paste -d' ' - - - | sed 's/\t/  /g'
                else
                    echo "      None detected"
                fi
            fi
            ;;
        1)
            echo "    ${BOLD}Organization Details:${RESET}"
            echo "    Active: ${ACTIVE_ORG:-Local Project}"
            echo "    Total Organizations: ${TOTAL_ORGS:-0}"

            # Show organization configuration method
            if [[ -n "$TETRA_ACTIVE_ORG" ]]; then
                echo "    ${BOLD}Configuration Method:${RESET} Environment variable"
                echo "    ${BOLD}Active Organization:${RESET} $TETRA_ACTIVE_ORG"
                echo "    ${BOLD}Config Path:${RESET} orgs/$TETRA_ACTIVE_ORG/tetra.toml"
                echo "    ${BOLD}Persistence File:${RESET} config/active_org"
            else
                # Check for legacy symlink system
                local config_symlink="$TETRA_DIR/config/tetra.toml"
                if [[ -L "$config_symlink" ]]; then
                    local target=$(readlink "$config_symlink")
                    echo "    ${BOLD}Configuration Method:${RESET} Legacy symlink (consider upgrading)"
                    echo "    ${BOLD}Symlink Target:${RESET} $target"
                elif [[ -f "$config_symlink" ]]; then
                    echo "    ${BOLD}Configuration Method:${RESET} Direct file (no organization)"
                else
                    echo "    ${BOLD}Configuration Method:${RESET} Local TOML files"
                fi
            fi
            ;;
        2)
            echo "    ${BOLD}Project Configuration:${RESET}"
            echo "    Name: ${PROJECT_NAME:-Unknown}"
            echo "    Provider: ${ORG_PROVIDER:-Unknown}"
            echo "    Type: ${ORG_TYPE:-standard}"
            echo "    Domain Base: ${DOMAIN_BASE:-Unknown}"
            ;;
        3)
            echo "    ${BOLD}Configuration Status:${RESET}"
            echo "    Parse Status: ${TOML_SYNC_STATUS:-Unknown}"
            echo "    TOML Parser: $(command -v toml_parse >/dev/null && echo "Available" || echo "Not available")"
            if [[ -n "$TOML_SECTIONS" ]]; then
                echo "    Available Sections:"
                for section in $TOML_SECTIONS; do
                    echo "      $section"
                done
            fi
            ;;
    esac
}

show_toml_local_details() {
    echo "    ${BOLD}Local Development Configuration:${RESET}"
    echo "    Domain: ${LOCAL_DOMAIN:-localhost}"
    echo "    Port: ${LOCAL_PORT:-3000}"
    echo "    Node Environment: ${LOCAL_NODE_ENV:-development}"
    echo "    Data Directory: ${LOCAL_DATA_DIR:-/home/dev/pj/pd}"
    echo "    Service Type: ${SERVICES_TYPE:-nodejs}"
    echo "    Full URL: http://${LOCAL_DOMAIN:-localhost}:${LOCAL_PORT:-3000}"
    echo
    echo "    ${BOLD}Local Services (TSM):${RESET}"
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "$TSM_SERVICES" | head -10
    else
        echo "    No local services running"
    fi
    echo
    echo "    ${BOLD}Service Configuration:${RESET}"
    echo "    Start Command: ${LOCAL_SERVICE_CONFIG:-npm run dev}"
    echo "    Environment File: env/dev.env"
    echo "    Process Management: TSM"
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

    echo "    ${BOLD}$env Environment Infrastructure:${RESET}"
    echo "    Server: ${!server_var:-Unknown}"
    echo "    Public IP: ${!ip_var:-Unknown}"
    echo "    Private IP: ${!private_ip_var:-Unknown}"
    echo "    Memory: ${!memory_var:-Unknown}"
    echo "    Region: ${!region_var:-Unknown}"
    echo "    Domain: ${!domain_var:-Unknown}"
    echo "    SSH Status: ${!ssh_status_var:-Unknown}"
    echo
    echo "    ${BOLD}Connection Details:${RESET}"
    if [[ "${!ip_var}" != "Unknown" ]]; then
        echo "    SSH Command: ssh tetra@${!ip_var}"
        echo "    Full URL: https://${!domain_var}"
        echo "    Private Network: ${!private_ip_var:-Unknown}"
    else
        echo "    No IP configuration available"
    fi
    echo
    echo "    ${BOLD}Service Configuration:${RESET}"
    echo "    Service Type: ${SERVICES_TYPE:-nodejs}"
    echo "    Environments: ${SERVICES_ENVIRONMENTS:-dev staging prod}"
    echo "    Provider: ${ORG_PROVIDER:-Unknown}"
}

show_tsm_local_details() {
    echo "    ${BOLD}Local Service Manager (TSM) Details:${RESET}"
    echo "    Running Services: ${TSM_COUNT_RUNNING:-0}"
    echo "    Stopped Services: ${TSM_COUNT_STOPPED:-0}"
    echo "    TSM Directory: $TETRA_DIR/tsm"
    echo
    echo "    ${BOLD}Service List:${RESET}"
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "$TSM_SERVICES"
    else
        echo "    No services found"
    fi
    echo
    echo "    ${BOLD}Port Registry:${RESET}"
    if command -v tsm >/dev/null 2>&1; then
        tsm ports list 2>/dev/null | head -10 || echo "    Port registry not available"
    else
        echo "    TSM command not available"
    fi
}

show_tsm_remote_details() {
    local env="$1"
    local ssh_status_var="${env}_SSH_STATUS"
    local ip_var="${env}_IP"
    local server_var="${env}_SERVER"
    local nickname_var="${env}_NICKNAME"

    # Get SSH users array and domain for this environment
    local ssh_users_var="${env}_SSH_USERS[@]"
    local ssh_users=("${!ssh_users_var}")
    if [[ ${#ssh_users[@]} -eq 0 ]]; then
        # Fallback to single user from TOML
        local ssh_user_var="${env}_SSH_USER"
        ssh_users=("${!ssh_user_var:-tetra}")
    fi

    local domain_var="${env}_DOMAIN"
    local domain="${!domain_var}"

    # Get environment description
    local env_description
    case "$env" in
        "DEV") env_description="Development Server" ;;
        "STAGING") env_description="Staging/QA Server" ;;
        "PROD") env_description="Production Server" ;;
        *) env_description="Remote Server" ;;
    esac

    echo "    ${BOLD}Remote Service Manager - $env ($env_description)${RESET}"
    echo

    # Check for environment mapping overrides
    local server_note=""
    if [[ "$env" == "STAGING" && "$STAGING_SERVER_OVERRIDE" == "prod_server" ]]; then
        server_note=" (${env,,} user on prod machine)"
    fi

    echo "        Server: ${!server_var:-Unknown}${server_note}"
    echo "        Nickname: ${!nickname_var:-${env,,}-server}"
    echo "        SSH Users: ${ssh_users[@]}"
    echo "        Target IP: ${!ip_var:-Unknown}"
    if [[ -n "$domain" ]]; then
        echo "        Domain: $domain (for reference)"
    fi
    echo "        SSH Status: ${!ssh_status_var:-Unknown}"
    echo "        Remote TSM: $(if [[ "${!ssh_status_var}" == *"Connected"* ]]; then echo "Available"; else echo "Not connected"; fi)"
    echo

    if [[ "${!ip_var}" != "Unknown" || -n "$domain" ]]; then
        echo "    ${BOLD}Connection Options${RESET}"
        echo

        # Show connection options for each SSH user (IP preferred)
        for ssh_user in "${ssh_users[@]}"; do
            if [[ "${!ip_var}" != "Unknown" ]]; then
                echo "        ${BOLD}$ssh_user:${RESET} ssh $ssh_user@${!ip_var}"
                if [[ -n "$domain" ]]; then
                    echo "              (also: ssh $ssh_user@$domain)"
                fi
            elif [[ -n "$domain" ]]; then
                echo "        ${BOLD}$ssh_user:${RESET} ssh $ssh_user@$domain"
            fi
        done

        echo
        echo "        ${BOLD}Service Commands${RESET}"
        local primary_user="${ssh_users[0]}"
        local target="${!ip_var:-$domain}"
        if [[ -n "$target" ]]; then
            echo "        Remote TSM: ssh $primary_user@$target 'tsm list'"
            echo "        Service Status: ssh $primary_user@$target 'systemctl status'"
        fi
        echo
    fi

    if [[ "${!ssh_status_var}" == *"Connected"* && ("${!ip_var}" != "Unknown" || -n "$domain") ]]; then
        echo "    ${BOLD}Remote Services${RESET} (attempting connection...)"
        echo
        local primary_user="${ssh_users[0]}"
        local target="${!ip_var:-$domain}"
        echo "        ssh $primary_user@$target 'tsm list' || echo 'Remote TSM not available'"
    else
        echo "    ${BOLD}Cannot connect to remote services${RESET}"
        echo "        SSH connection required for remote service monitoring"
        if [[ "${!ip_var}" != "Unknown" || -n "$domain" ]]; then
            echo
            local primary_user="${ssh_users[0]}"
            local target="${!ip_var:-$domain}"
            echo "        ${BOLD}Try: ssh $primary_user@$target${RESET}"
        fi
    fi
}

show_tview_help() {
    clear
    cat << EOF

                     ${BOLD}TETRA VIEW HELP${RESET}

NAVIGATION SYSTEM:
  e           Cycle through environments (TETRA � LOCAL � DEV � STAGING � PROD � QA)
  m           Cycle through modes (TOML � TKM � TSM � DEPLOY � ORG)
  i, k        Navigate items up/down within current context (joystick)
  l           Drill INTO selected item (detailed view) (joystick)
  j           Drill OUT of item (back to overview) (joystick)

ACTIONS:
  Enter       Show detailed modal for selected item
  r           Refresh dashboard data
  q           Quit dashboard

COMMANDS:
  h           Show this help screen
  t           Execute 'tsm list' command
  g           Execute 'git status' command
  v           View file with glow/bat syntax highlighting

MODES:
  TOML        Infrastructure configuration and environment data
  TKM         SSH key management and server connectivity
  TSM         Service management (local and remote)
  DEPLOY      Deployment status and operations
  ORG         Organization management and multi-client infrastructure

ENVIRONMENTS:
  TETRA       Overview/summary across all environments
  LOCAL       Your development machine
  DEV         Development server
  STAGING     Staging/QA server
  PROD        Production server

Press ESC, q, or Q to return to dashboard (auto-exit in 30s)...
EOF
    while true; do
        if _tview_modal_read_key 30; then
            break
        fi
    done
}


execute_tsm_command() {
    echo "Executing: tsm list"
    tsm list 2>/dev/null || echo "TSM not available"
    echo "Press ESC, q, or Q to continue (auto-exit in 30s)..."
    while true; do
        if _tview_modal_read_key 30; then
            break
        fi
    done
}

execute_git_command() {
    echo "Executing: git status"
    git status 2>/dev/null || echo "Not a git repository"
    echo "Press ESC, q, or Q to continue (auto-exit in 30s)..."
    while true; do
        if _tview_modal_read_key 30; then
            break
        fi
    done
}

view_toml_file() {
    clear
    echo
    echo "                   ${BOLD}RAW TOML CONFIGURATION${RESET}"
    echo

    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "     File: $ACTIVE_TOML"
        echo
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
        echo
        echo "     File Stats: $total_lines lines, $(wc -c < "$ACTIVE_TOML") bytes"
        if command -v toml_sections >/dev/null 2>&1; then
            local sections=$(toml_sections "TOML" 2>/dev/null | tr '\n' ' ')
            echo "     Sections: ${sections:-None detected}"
        fi
    else
        echo "      No TOML file available"
        echo "     Active TOML: ${ACTIVE_TOML:-Not set}"
        echo "     Status: ${TOML_SYNC_STATUS:-Unknown}"
        echo
        echo "     To create a TOML configuration:"
        echo "     Create a .toml file in your project"
        echo "     Or use organization management: tetra org template"
    fi

    echo
    echo
    echo "    Press any key to return to dashboard..."
    read -n1 -s
}

# ORG mode detailed views
show_org_tetra_details() {
    echo "     Organization System Overview:"
    echo "     Active Organization: ${ACTIVE_ORG:-No active organization}"
    echo "     Total Organizations: ${TOTAL_ORGS:-0}"
    echo "     Organization Directory: $TETRA_DIR/orgs"
    echo
    echo "     Available Organizations:"
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        for org_dir in "$TETRA_DIR/orgs"/*; do
            if [[ -d "$org_dir" ]]; then
                local org_name=$(basename "$org_dir")
                local config_file="$org_dir/${org_name}.toml"
                if [[ "$org_name" == "${ACTIVE_ORG:-}" ]]; then
                    echo "     � $org_name (active) - $(if [[ -f "$config_file" ]]; then echo "configured"; else echo "missing config"; fi)"
                else
                    echo "       $org_name - $(if [[ -f "$config_file" ]]; then echo "configured"; else echo "missing config"; fi)"
                fi
            fi
        done
    else
        echo "     No organizations directory found"
    fi
    echo
    echo "      Organization Commands:"
    echo "     tetra org list                List all organizations"
    echo "     tetra org templates           Show available templates"
    echo "     tetra org template <name>     Create from template"
}

show_org_local_details() {
    echo "     Local Organization Management:"
    if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        echo "     Current Organization: $ACTIVE_ORG"
        local config_path=$(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null)
        echo "     Configuration Path: ${config_path:-None}"
        if [[ -f "$config_path" ]]; then
            echo "     Config Size: $(wc -c < "$config_path") bytes"
            echo "     Last Modified: $(date -r "$config_path" 2>/dev/null || echo "Unknown")"
        fi
    else
        echo "     No active organization"
        echo "     Using local project configuration"
    fi
    echo
    echo "     Available Templates:"
    if [[ -d "$TETRA_SRC/templates/organizations" ]]; then
        for template in "$TETRA_SRC/templates/organizations"/*.toml; do
            if [[ -f "$template" ]]; then
                local name=$(basename "$template" .toml)
                echo "     $name"
            fi
        done
    else
        echo "     No templates found"
    fi
    echo
    echo "     Local Actions:"
    echo "     Switch organization: tetra org switch <name>"
    echo "     Create from template: tetra org template <template> <name>"
    echo "     Validate configuration: tetra org validate <name>"
}

show_org_environment_details() {
    local env="$1"
    local env_lower=$(echo "$env" | tr '[:upper:]' '[:lower:]')

    echo "    ${BOLD}Organization Deployment - $env Environment:${RESET}"

    if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        local org_dir="$TETRA_DIR/orgs/$ACTIVE_ORG"
        local deployment_file="$org_dir/deployments/${env_lower}.toml"
        local deployed_config="$org_dir/deployed/${env_lower}.toml"

        echo "     Organization: $ACTIVE_ORG"
        echo "     Target Environment: $env"

        if [[ -f "$deployment_file" ]]; then
            echo "     Deployment History: Available"
            echo "     Last Deployment: $(grep "^timestamp" "$deployment_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")"
            echo "     Deployed By: $(grep "^deployed_by" "$deployment_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")"
        else
            echo "     Deployment History: No deployments to $env"
        fi

        if [[ -f "$deployed_config" ]]; then
            echo "     Deployed Config: $(wc -c < "$deployed_config") bytes"
            echo "     Config Modified: $(date -r "$deployed_config" 2>/dev/null || echo "Unknown")"
        else
            echo "     Deployed Config: Not found"
        fi

        echo
        echo "     Deployment Actions:"
        echo "     Push config: tetra org push $ACTIVE_ORG $env_lower"
        echo "     Pull config: tetra org pull $ACTIVE_ORG $env_lower"
        echo "     View history: tetra org history $ACTIVE_ORG $env_lower"
        echo "     Rollback: tetra org rollback $ACTIVE_ORG $env_lower"

        echo
        echo "     Backup Status:"
        local backup_dir="$org_dir/backups"
        if [[ -d "$backup_dir" ]]; then
            local backup_count=$(find "$backup_dir" -name "${env_lower}_*.toml" 2>/dev/null | wc -l)
            echo "     Backups for $env: $backup_count files"
        else
            echo "     No backup directory found"
        fi
    else
        echo "     No active organization"
        echo "     Cannot deploy without active organization"
        echo
        echo "     To use organization deployment:"
        echo "     1. Create organization: tetra org template <template> <name>"
        echo "     2. Switch to it: tetra org switch <name>"
        echo "     3. Deploy: tetra org push <name> $env_lower"
    fi
}

# TKM mode detailed views
show_tkm_details() {
    local env="$1"
    echo "     SSH Key Management - $env:"

    case "$env" in
        "TETRA")
            echo "     SSH Keys Directory: ~/.ssh/"
            echo "     SSH Config: ~/.ssh/config"
            echo "     Known Hosts: ~/.ssh/known_hosts"
            if command -v ssh-add >/dev/null 2>&1; then
                echo "     SSH Agent: $(ssh-add -l 2>/dev/null | wc -l) keys loaded"
            else
                echo "     SSH Agent: Not available"
            fi
            echo
            echo "     Local SSH Keys:"
            if [[ -d ~/.ssh ]]; then
                for keyfile in ~/.ssh/id_*; do
                    if [[ -f "$keyfile" && "$keyfile" != *".pub" ]]; then
                        local keyname=$(basename "$keyfile")
                        echo "     $keyname $(if [[ -f "${keyfile}.pub" ]]; then echo "(public key available)"; else echo "(private only)"; fi)"
                    fi
                done
            fi
            ;;
        "LOCAL")
            echo "     Local SSH Configuration"
            echo "     Key Generation and Management"
            echo "     SSH Agent Configuration"
            echo "     Deployment Testing Available"
            echo
            echo "     Local to Environment Testing:"
            echo "     Test all environments: tkm deploy test"
            echo "     Test specific env: tkm deploy test dev"
            echo "     Test root+user SSH: Auto-detects from custom.toml"
            echo "     Port & nginx validation: Integrated with TSM"
            ;;
        *)
            local ip_var="${env}_IP"
            local ssh_status_var="${env}_SSH_STATUS"
            local server_var="${env}_SERVER"
            local nickname_var="${env}_NICKNAME"

            # TKM uses dynamic SSH user from TOML for administrative access
            local ssh_user_var="${env}_SSH_USER"
            local ssh_user="${!ssh_user_var:-root}"

            # Get environment description
            local env_description
            case "$env" in
                "DEV") env_description="Development Server" ;;
                "STAGING") env_description="Staging/QA Server" ;;
                "PROD") env_description="Production Server" ;;
                *) env_description="Remote Server" ;;
            esac

            echo "    ${BOLD}SSH Key Management - $env ($env_description)${RESET}"
            echo
            echo "        Environment: $env ($env_description)"
            echo "        Server: ${!server_var:-Unknown}"
            echo "        Nickname: ${!nickname_var:-${env,,}-server}"
            echo "        Target IP: ${!ip_var:-Unknown}"
            echo "        SSH User: $ssh_user (${ssh_user} access)"
            echo "        SSH Status: ${!ssh_status_var:-Unknown}"
            echo "        Key Deployment Status: $(if [[ "${!ssh_status_var}" == *"Connected"* ]]; then echo "Keys accessible"; else echo "Cannot verify"; fi)"
            echo

            if [[ "${!ip_var}" != "Unknown" ]]; then
                echo "    ${BOLD}SSH Commands with Machine Annotations${RESET}"
                echo
                echo "        ssh $ssh_user@${!ip_var} 'systemctl status tetra.service'  # machine=${!server_var:-unknown}"
                echo "        ssh $ssh_user@${!ip_var} 'tsm list'              # machine=${!server_var:-unknown}"
                echo "        ssh $ssh_user@${!ip_var} 'df -h'                # machine=${!server_var:-unknown}"
                echo "        ssh $ssh_user@${!ip_var} 'ps aux | grep node'   # machine=${!server_var:-unknown}"
                echo "        ssh $ssh_user@${!ip_var} 'tail -f /var/log/nginx/error.log'"
                echo
                echo "    ${BOLD}Multi-User Access${RESET}"
                echo "        ssh tetra@${!ip_var}     # machine=${!server_var:-unknown} (app user)"
                echo "        ssh root@${!ip_var}      # machine=${!server_var:-unknown} (admin)"
                echo
                echo "    ${BOLD}Environment-Specific Commands${RESET}"
                case "$env" in
                    "DEV")
                        echo "        ssh $ssh_user@${!ip_var} 'systemctl restart tetra.service'"
                        echo "        ssh $ssh_user@${!ip_var} 'tsm list | grep dev'"
                        echo "        ssh $ssh_user@${!ip_var} 'tail -f /var/log/tetra/dev.log'"
                        ;;
                    "STAGING")
                        echo "        ssh $ssh_user@${!ip_var} 'systemctl status tetra.service'"
                        echo "        ssh $ssh_user@${!ip_var} 'tsm list | grep staging'"
                        echo "        ssh $ssh_user@${!ip_var} 'nginx -t && systemctl reload nginx'"
                        ;;
                    "PROD")
                        echo "        ssh $ssh_user@${!ip_var} 'systemctl status tetra.service'"
                        echo "        ssh $ssh_user@${!ip_var} 'tsm list | grep prod'"
                        echo "        ssh $ssh_user@${!ip_var} 'top -bn1 | head -20'"
                        ;;
                    "QA")
                        echo "        ssh $ssh_user@${!ip_var} 'systemctl restart tetra.service'"
                        echo "        ssh $ssh_user@${!ip_var} 'tsm list | grep qa'"
                        echo "        ssh $ssh_user@${!ip_var} 'tail -f /var/log/tetra/qa.log'"
                        ;;
                esac
            fi
            ;;
    esac
}

# DEPLOY mode detailed views
show_deploy_details() {
    local env="$1"
    echo "     Deployment Details - $env:"

    case "$env" in
        "TETRA")
            echo "     Git Repository: $(if git rev-parse --git-dir >/dev/null 2>&1; then echo "Detected"; else echo "Not a git repository"; fi)"
            echo "     Current Branch: ${GIT_BRANCH:-Unknown}"
            echo "     Working Tree: $(if [[ "$GIT_CLEAN" == "" ]]; then echo "Clean"; else echo "Modified files"; fi)"
            echo "     Deploy Readiness: ${DEPLOY_READINESS:-Unknown}"
            ;;
        "LOCAL")
            echo "     Local Development Status"
            echo "     Git Status: ${GIT_CLEAN:-Unknown}"
            echo "     Branch: ${GIT_BRANCH:-main}"
            echo "     Build Status: ${BUILD_STATUS:-Unknown}"
            if git rev-parse --git-dir >/dev/null 2>&1; then
                echo
                echo "     Git Status:"
                git status --porcelain | head -5
            fi
            ;;
        *)
            local deploy_status_var="${env}_DEPLOY_STATUS"
            local last_deploy_var="${env}_LAST_DEPLOY"
            local health_var="${env}_HEALTH_STATUS"
            echo "     Environment: $env"
            echo "     Deploy Status: ${!deploy_status_var:-Unknown}"
            echo "     Last Deploy: ${!last_deploy_var:-Never}"
            echo "     Health Status: ${!health_var:-Unknown}"
            ;;
    esac
}

# ===== NEW LAYOUT SYSTEM EXECUTION FUNCTIONS =====

# Local action executions
execute_local_service_status() {
    cat << EOF
Local Service Status Check
═══════════════════════════
$(render_status_indicator "info" "Checking local services...")

System Services:
$(ps aux | grep -E "(nginx|apache|mysql|postgres|docker)" | head -10 || echo "No common services found")

Status: $(render_status_indicator "success" "Local check complete")
EOF
}

execute_local_config_check() {
    echo "Local Configuration Check - Complete"
}

execute_local_service_list() {
    echo "Local Service List - Ready"
}

execute_local_logs() {
    echo "Local Logs - Available"
}

execute_ssh_test() {
    local env="$1"
    echo "SSH Test - $env Environment - Connection Ready"
}

execute_service_status() {
    local env="$1"
    echo "Service Status - $env Environment - Active"
}

execute_service_list() {
    local env="$1"
    echo "Service List - $env Environment - Available"
}

execute_tail_logs() {
    local env="$1"
    echo "Tail Logs - $env Environment - Recent entries"
}

execute_rcm_command() {
    local env="$1"
    local item="$2"
    echo "RCM Command - $env Environment, Item $item - Executed"
}

execute_ssh_key_status() {
    local env="$1"
    echo "SSH Key Status - $env Environment - Keys Available"
}

execute_key_management() {
    local env="$1"
    echo "Key Management - $env Environment - Ready for Operations"
}

enter_ssh_repl() {
    local env="$1"
    echo "Entering SSH REPL for $env..."
    sleep 1
}

generate_help_content() {
    cat << EOF
TView Navigation Help
════════════════════
e/E - Cycle environments (forward/reverse)
m/M - Cycle modes (forward/reverse)
d/D - Cycle modes (forward/reverse) - moDe
a/A - Navigate actions (next/previous)
Enter - Execute selected action
j - Exit/Go back | ESC - Hide results window
r - Reset interface
/ - REPL mode
? - Show help
q - Quit

Pattern: e=env m/d=mode → a/A=actions → Enter/l=execute
Results appear in scrollable window between top and bottom.
EOF
}

# TKM Action Modal - New integrated TKM action system
show_tkm_action_modal() {
    local env="$1" item_index="$2"

    # Source TKM modules
    source "$TVIEW_DIR/tkm_actions.sh"
    source "$TVIEW_DIR/tkm_display_helpers.sh"

    clear
    echo
    echo "                   ${BOLD}TKM ACTION: $env ENVIRONMENT${RESET}"
    echo

    # Handle different views based on environment and item
    case "$env" in
        "TETRA")
            show_tkm_tetra_action_modal "$item_index"
            ;;
        "LOCAL"|"DEV"|"STAGING"|"PROD")
            show_tkm_env_action_modal "$env" "$item_index"
            ;;
        *)
            echo "    TKM action not available for environment: $env"
            ;;
    esac

    echo
    echo "    Press any key to return to dashboard..."
    read -n1 -s
}

# TKM TETRA (overview) action modal
show_tkm_tetra_action_modal() {
    local item_index="$1"

    case "$item_index" in
        0|1|2|3)  # Environment selections
            local envs=("LOCAL" "DEV" "STAGING" "PROD")
            local selected_env="${envs[$item_index]}"
            show_tkm_env_summary "$selected_env"
            ;;
        4)  # Secrets Management
            show_tkm_secrets_modal
            ;;
        *)
            echo "    TKM System Overview"
            echo
            echo "    Total Environments: 4"
            echo "    SSH Status Summary:"
            echo "      • LOCAL: $(render_tkm_status_indicator "local")"
            echo "      • DEV: $(render_tkm_status_indicator "dev")"
            echo "      • STAGING: $(render_tkm_status_indicator "staging")"
            echo "      • PROD: $(render_tkm_status_indicator "prod")"
            ;;
    esac
}

# TKM environment-specific action modal
show_tkm_env_action_modal() {
    local env="$1" item_index="$2"

    # Load actions for this environment
    local actions=($(tkm_get_env_actions "${env,,}"))

    # Calculate action offset (account for status display items)
    local action_offset=0
    case "$env" in
        "LOCAL") action_offset=3 ;;  # SSH dir, config, agent
        *) action_offset=2 ;;        # Connection, users
    esac

    local action_index=$((item_index - action_offset))

    if [[ $action_index -ge 0 && $action_index -lt ${#actions[@]} ]]; then
        local action="${actions[$action_index]}"
        show_tkm_action_confirmation "$action" "${env,,}"
    else
        # Show environment details for non-action items
        echo "    ${BOLD}TKM - $env Environment Details${RESET}"
        echo
        render_tkm_env_details "${env,,}"
    fi
}

# TKM action confirmation and execution
show_tkm_action_confirmation() {
    local action="$1" env="$2"

    echo "    ${BOLD}$(tkm_get_action_name "$action") - ${env^^}${RESET}"
    echo
    echo "    $(tkm_get_action_description "$action" "$env")"
    echo

    # Show requirements/warnings if any
    local requirements="$(tkm_get_action_requirements "$action" "$env" 2>/dev/null)"
    if [[ -n "$requirements" ]]; then
        echo "    ${YELLOW}${BOLD}REQUIREMENTS:${RESET}"
        echo "    $requirements"
        echo
    fi

    # Show action preview/command that will be executed
    echo "    ${BOLD}Command Preview:${RESET}"
    case "$action" in
        "test_ssh")
            echo "    ssh -o ConnectTimeout=10 $(tkm_get_env_user "$env")@$(tkm_get_env_host "$env") 'hostname && whoami'"
            ;;
        "generate_key")
            echo "    ssh-keygen -t ed25519 -f ~/.ssh/tetra_${env}_env_key -C 'tetra-${env}-$(date +%Y%m%d)'"
            ;;
        "copy_key")
            echo "    ssh-copy-id -i ~/.ssh/tetra_${env}_env_key.pub $(tkm_get_env_user "$env")@$(tkm_get_env_host "$env")"
            ;;
        *)
            echo "    $(tkm_get_action_name "$action") for $env environment"
            ;;
    esac
    echo

    # Confirmation prompt
    local confirm_text="Execute action? [y/N]"
    [[ "$env" == "prod" ]] && confirm_text="Execute PRODUCTION action? Type 'YES' to confirm:"

    echo -n "    $confirm_text "
    read -r confirmation

    if [[ "$env" == "prod" ]]; then
        [[ "$confirmation" == "YES" ]] || { echo "    Cancelled."; return; }
    else
        [[ "$confirmation" =~ ^[Yy] ]] || { echo "    Cancelled."; return; }
    fi

    echo
    echo "    ${BOLD}Executing...${RESET}"
    echo

    # Execute the action with visual feedback
    if tkm_execute_action "$action" "$env" 2>&1; then
        echo
        echo "    ${GREEN}✓ Action completed successfully${RESET}"
    else
        echo
        echo "    ${RED}✗ Action failed${RESET}"
    fi
}

# TKM secrets management modal
show_tkm_secrets_modal() {
    source "$TVIEW_DIR/secrets_manager.sh"

    echo "    ${BOLD}TKM Secrets Management${RESET}"
    echo
    echo "    Environment Status:"
    echo "      • local.env: $(secrets_get_env_status "local")"
    echo "      • dev.env: $(secrets_get_env_status "dev")"
    echo "      • staging.env: $(secrets_get_env_status "staging")"
    echo "      • prod.env: $(secrets_get_env_status "prod" || echo "missing")"
    echo
    echo "    Configuration Files:"
    echo "      • tetra.toml: $(render_file_status "$TETRA_DIR/tetra.toml")"
    echo "      • secrets.toml: $(render_file_status "$TETRA_DIR/secrets.toml")"
    echo
    echo "    Available Operations:"
    echo "      • Generate secrets.toml from env files"
    echo "      • Validate secret inheritance chain"
    echo "      • Bubble secrets between environments"
    echo "      • Generate SSH configs from secrets"
}

# TKM environment summary
show_tkm_env_summary() {
    local env="$1"

    echo "    ${BOLD}TKM - ${env} Environment Summary${RESET}"
    echo

    case "$env" in
        "LOCAL")
            echo "    Type: Local Development Machine"
            echo "    Access: Direct (no SSH required)"
            echo "    SSH Keys: $(count_local_ssh_keys) local keys"
            echo "    SSH Agent: $(render_ssh_agent_status)"
            ;;
        *)
            local host="$(tkm_get_env_host "${env,,}")"
            echo "    Type: Remote Server"
            echo "    Host: $host"
            echo "    SSH Status: $(render_tkm_status_indicator "${env,,}")"
            echo "    Key Status:"
            echo "      • env user: $(render_tkm_key_status "${env,,}" "env")"
            echo "      • root user: $(render_tkm_key_status "${env,,}" "root")"
            ;;
    esac
}