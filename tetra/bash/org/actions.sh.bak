#!/usr/bin/env bash

# Org Module Actions - TUI Integration
# Defines verb:noun actions for organization management

# Environments for org operations
ORG_ENVIRONMENTS=("Local" "Dev" "Staging" "Production")

# Get org-specific actions for context
org_get_actions() {
    local env="${1:-Local}"
    local mode="${2:-Inspect}"

    local actions=""

    case "$env:$mode" in
        "Local:Inspect")
            actions="view:orgs view:toml view:secrets validate:toml list:templates"
            ;;
        "Local:Transfer")
            actions="import:nh import:json export:toml backup:org"
            ;;
        "Local:Execute")
            actions="compile:toml create:org switch:org refresh:config"
            ;;
        "Dev:Inspect")
            actions="view:env check:connectivity view:services"
            ;;
        "Dev:Transfer")
            actions="push:config pull:config sync:resources"
            ;;
        "Dev:Execute")
            actions="deploy:services restart:service rollback:deployment"
            ;;
        "Staging:Inspect")
            actions="view:env check:connectivity view:services"
            ;;
        "Staging:Transfer")
            actions="push:config pull:config"
            ;;
        "Staging:Execute")
            actions="deploy:services validate:deployment"
            ;;
        "Production:Inspect")
            actions="view:env check:connectivity view:status"
            ;;
        "Production:Transfer")
            actions="pull:config backup:remote"
            ;;
        "Production:Execute")
            actions="validate:deployment check:health"
            ;;
        *)
            actions="view:orgs view:toml help:org"
            ;;
    esac

    echo "$actions"
}

# Execute org action
org_execute_action() {
    local action="$1"
    local env="$2"
    shift 2
    local args=("$@")

    local verb="${action%%:*}"
    local noun="${action##*:}"
    local func_name="org_action_${verb}_${noun}"

    # Call the action function if it exists
    if declare -f "$func_name" &>/dev/null; then
        "$func_name" "$env" "${args[@]}"
    else
        echo "Action not implemented: $action"
        echo "Verb: $verb, Noun: $noun, Environment: $env"
        return 1
    fi
}

# ========== LOCAL:INSPECT ACTIONS ==========

org_action_view_orgs() {
    org_list
}

org_action_view_toml() {
    local active_org=$(org_active)
    if [[ "$active_org" != "none" ]]; then
        local toml_path="$TETRA_DIR/org/$active_org/tetra.toml"
        if [[ -f "$toml_path" ]]; then
            echo "Organization: $active_org"
            echo "─────────────────────────────────────"
            echo ""

            # Parse sections
            local in_section=""
            while IFS= read -r line; do
                if [[ "$line" =~ ^\[(.*)\]$ ]]; then
                    in_section="${BASH_REMATCH[1]}"
                    echo "[$in_section]"
                elif [[ -n "$line" && ! "$line" =~ ^# ]]; then
                    echo "  $line"
                elif [[ "$line" =~ ^# ]]; then
                    echo "  $line"
                elif [[ -z "$line" && -n "$in_section" ]]; then
                    echo ""
                fi
            done < "$toml_path"
        else
            echo "No tetra.toml found for: $active_org"
        fi
    else
        echo "No active organization. Use 'switch:org' to activate one."
    fi
}

org_action_view_secrets() {
    local active_org=$(org_active)
    if [[ "$active_org" != "none" ]]; then
        echo "Secrets file location: $TETRA_DIR/org/$active_org/secrets.env"
        echo "(Showing structure only, not values)"
        local secrets_file="$TETRA_DIR/org/$active_org/secrets.env"
        if [[ -f "$secrets_file" ]]; then
            grep -E '^[A-Z_]+=.*$' "$secrets_file" | sed 's/=.*/=***/' || echo "No secrets defined"
        else
            echo "No secrets.env file found"
        fi
    else
        echo "No active organization"
    fi
}

org_action_validate_toml() {
    local active_org=$(org_active)
    if [[ "$active_org" != "none" ]]; then
        if command -v tetra_validate_toml >/dev/null 2>&1; then
            tetra_validate_toml "$active_org"
        else
            echo "Validation function not available"
        fi
    else
        echo "No active organization"
    fi
}

org_action_list_templates() {
    if command -v org_list_templates >/dev/null 2>&1; then
        org_list_templates
    else
        echo "Templates: (not yet implemented)"
    fi
}

# ========== LOCAL:TRANSFER ACTIONS ==========

org_action_import_nh() {
    echo "Import from NodeHolder"
    echo "Usage: import:nh <nh-dir> <org-name>"
    echo "Example: import:nh ~/nh/myorg myorg"
}

org_action_import_json() {
    echo "Import from DigitalOcean JSON"
    echo "Usage: import:json <json-file> <org-name>"
}

org_action_export_toml() {
    local active_org=$(org_active)
    if [[ "$active_org" != "none" ]]; then
        local toml_path="$TETRA_DIR/org/$active_org/tetra.toml"
        echo "Exporting: $toml_path"
        echo "To: ./tetra-export-$(date +%Y%m%d-%H%M%S).toml"
    else
        echo "No active organization"
    fi
}

org_action_backup_org() {
    local active_org=$(org_active)
    if [[ "$active_org" != "none" ]]; then
        echo "Backing up organization: $active_org"
        echo "To: $TETRA_DIR/org/backups/$active_org-$(date +%Y%m%d-%H%M%S)"
    else
        echo "No active organization"
    fi
}

# ========== LOCAL:EXECUTE ACTIONS ==========

org_action_compile_toml() {
    local active_org=$(org_active)
    if [[ "$active_org" != "none" ]]; then
        echo "Compiling TOML for: $active_org"
        if command -v tetra_compile_toml >/dev/null 2>&1; then
            tetra_compile_toml "$active_org"
        else
            echo "Compiler not available"
        fi
    else
        echo "No active organization"
    fi
}

org_action_create_org() {
    echo "Create new organization"
    echo "Usage: create:org <name>"
}

org_action_switch_org() {
    echo "Available organizations:"
    org_list
    echo ""
    echo "Usage: switch:org <name>"
}

org_action_refresh_config() {
    echo "Refresh configuration from source"
    if command -v tetra_org_refresh >/dev/null 2>&1; then
        tetra_org_refresh
    else
        echo "Refresh function not available"
    fi
}

# ========== REMOTE ACTIONS (DEV/STAGING/PROD) ==========

org_action_view_env() {
    local env="$1"
    echo "Viewing environment: $env"
    echo "Organization: $(org_active)"
}

org_action_check_connectivity() {
    local env="$1"
    echo "Checking connectivity to: $env"
    echo "(SSH connection test)"
}

org_action_view_services() {
    local env="$1"
    echo "Services on: $env"
    if command -v tsm >/dev/null 2>&1; then
        tsm list
    else
        echo "TSM not available"
    fi
}

org_action_push_config() {
    local env="$1"
    echo "Push configuration to: $env"
    echo "(This would use org_push)"
}

org_action_pull_config() {
    local env="$1"
    echo "Pull configuration from: $env"
    echo "(This would use org_pull)"
}

org_action_sync_resources() {
    local env="$1"
    echo "Sync resources to: $env"
}

org_action_deploy_services() {
    local env="$1"
    echo "Deploy services to: $env"
}

org_action_restart_service() {
    local env="$1"
    echo "Restart service on: $env"
}

org_action_rollback_deployment() {
    local env="$1"
    echo "Rollback deployment on: $env"
}

org_action_validate_deployment() {
    local env="$1"
    echo "Validate deployment on: $env"
}

org_action_view_status() {
    local env="$1"
    echo "System status for: $env"
}

org_action_backup_remote() {
    local env="$1"
    echo "Backup remote configuration from: $env"
}

org_action_check_health() {
    local env="$1"
    echo "Health check for: $env"
}

org_action_help_org() {
    echo "Organization Management Actions"
    echo ""
    echo "Use Ctrl+E to cycle environments (Local/Dev/Staging/Production)"
    echo "Use Ctrl+M to cycle modes (Inspect/Transfer/Execute)"
    echo "Use Ctrl+A to cycle available actions"
    echo ""
    echo "Type action name to execute, or !command for shell"
}

# Export functions
export -f org_get_actions
export -f org_execute_action
