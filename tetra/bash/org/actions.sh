#!/usr/bin/env bash

# Org Module Actions - TUI Integration
# Defines verb:noun actions for organization management

# Source canonical constants
source "${TETRA_SRC}/bash/org/org_constants.sh"

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
        local toml_path="$TETRA_DIR/orgs/$active_org/tetra.toml"
        if [[ -f "$toml_path" ]]; then
            echo "Organization: $active_org"
            echo "─────────────────────────────────────"
            echo ""

            # Ensure TDS is loaded for syntax highlighting
            if [[ -z "${TDS_LOADED:-}" ]] && [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
                source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
            fi

            # Use TDS renderer if available, otherwise plain text
            if command -v tds_toml &>/dev/null; then
                tds_toml "$toml_path"
            else
                # Fallback to plain text with indentation
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
            fi
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
        echo "Secrets file location: $TETRA_DIR/orgs/$active_org/secrets.env"
        echo "(Showing structure only, not values)"
        local secrets_file="$TETRA_DIR/orgs/$active_org/secrets.env"
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
        local toml_path="$TETRA_DIR/orgs/$active_org/tetra.toml"
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
    local active_org=$(org_active)
    local toml_path="$TETRA_DIR/orgs/$active_org/tetra.toml"

    if [[ "$active_org" == "none" ]]; then
        echo "ERROR: No active organization" >&2
        return 1
    fi

    echo ""
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h2"
        printf "Environment: %s @ %s" "$env" "$active_org"
        reset_color
    else
        echo "╭─ Environment: $env @ $active_org ───────────────"
    fi
    echo ""
    echo ""

    # Show TES resolution
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        echo "TES Resolution"
        reset_color
    else
        echo "TES Resolution:"
    fi
    echo ""

    local symbol="@${env,,}"
    local env_lower="${env,,}"

    if [[ "$env" == "Local" ]]; then
        echo "  Symbol:       $symbol"
        echo "  Type:         local"
        echo "  Source:       $toml_path"
        echo ""

        # Show local environment section from tetra.toml
        if [[ -f "$toml_path" ]]; then
            if type tds_text_color &>/dev/null; then
                tds_text_color "content.heading.h3"
                echo "Configuration [environments.local]"
                reset_color
            else
                echo "Configuration [environments.local]:"
            fi
            echo ""

            # Extract and display [environments.local] section
            awk '/^\[environments\.local\]$/,/^\[/ {
                if (/^\[environments\.local\]$/) next
                if (/^\[/ && !/^\[environments\.local\]/) exit
                if (NF > 0 && !/^#/) print "  " $0
            }' "$toml_path"
            echo ""

            # Show raw TOML lines for debugging
            if type tds_text_color &>/dev/null; then
                tds_text_color "content.text.muted"
                echo "Raw TOML Lines:"
                reset_color
            else
                echo "Raw TOML Lines:"
            fi
            echo ""
            grep -A20 "^\[environments\.local\]" "$toml_path" | head -21 | while IFS= read -r line; do
                echo "  $line"
            done
            echo ""
        else
            echo "  ERROR: tetra.toml not found at $toml_path"
            echo ""
        fi
    else
        # Remote environment
        local ssh_cmd=$(org_tes_ssh_command "$symbol" "$toml_path" 2>/dev/null)

        echo "  Symbol:       $symbol"
        echo "  Type:         remote"

        if [[ -n "$ssh_cmd" && "$ssh_cmd" != "bash" ]]; then
            echo "  SSH:          $ssh_cmd"
        else
            echo "  SSH:          [UNRESOLVED]"
        fi
        echo ""

        # Show what WOULD be fetched from remote
        if type tds_text_color &>/dev/null; then
            tds_text_color "content.heading.h3"
            echo "Local Configuration [environments.${env_lower}]"
            reset_color
            tds_text_color "content.text.muted"
            echo "(showing local copy - remote fetch not implemented yet)"
            reset_color
        else
            echo "Local Configuration [environments.${env_lower}]:"
            echo "(showing local copy - remote fetch not implemented yet)"
        fi
        echo ""

        if [[ -f "$toml_path" ]]; then
            # Extract and display the environment section
            awk -v env="$env_lower" '
                BEGIN { in_section=0 }
                $0 ~ "^\\[environments\\." env "\\]$" { in_section=1; next }
                /^\[/ && in_section { exit }
                in_section && NF > 0 && !/^#/ { print "  " $0 }
            ' "$toml_path"
            echo ""

            # Show raw TOML lines
            if type tds_text_color &>/dev/null; then
                tds_text_color "content.text.muted"
                echo "Raw TOML Lines:"
                reset_color
            else
                echo "Raw TOML Lines:"
            fi
            echo ""
            grep -A20 "^\[environments\.$env_lower\]" "$toml_path" | head -21 | while IFS= read -r line; do
                echo "  $line"
            done
            echo ""
        else
            echo "  ERROR: tetra.toml not found at $toml_path"
            echo ""
        fi

        # Show TTS format for execution
        if type tds_text_color &>/dev/null; then
            tds_text_color "content.text.muted"
            echo "TTS Transaction (if executed remotely):"
            reset_color
        else
            echo "TTS Transaction (if executed remotely):"
        fi
        echo ""
        echo "  Would execute:  $ssh_cmd \"cat /home/$env_lower/tetra/orgs/$active_org/tetra.toml\""
        echo "  Would log to:   $TETRA_DIR/org/txns/$active_org/$(date +%Y-%m-%d).log"
        echo ""
    fi
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

# ═══════════════════════════════════════════════════════════
# NGINX DOCS ACTIONS
# Authenticated doc subdomain management
# ═══════════════════════════════════════════════════════════

# Load nginx docs module
if [[ -f "$TETRA_SRC/bash/org/nginx_docs.sh" ]]; then
    source "$TETRA_SRC/bash/org/nginx_docs.sh"
fi

org_action_nginx_docs_generate() {
    local doc_type="$1"
    org_nginx_docs_generate "$doc_type"
}

org_action_nginx_docs_deploy() {
    local doc_type="$1"
    local env="${2:-prod}"
    org_nginx_docs_deploy "$doc_type" "$env"
}

org_action_nginx_docs_list() {
    org_nginx_docs_list
}

org_action_nginx_docs_show() {
    local doc_type="$1"
    org_nginx_docs_show "$doc_type"
}

org_action_nginx_docs_init() {
    local doc_type="$1"
    local subdomain="$2"
    org_nginx_docs_init "$doc_type" "$subdomain"
}

# Export functions
export -f org_get_actions
export -f org_execute_action
export -f org_action_nginx_docs_generate
export -f org_action_nginx_docs_deploy
export -f org_action_nginx_docs_list
export -f org_action_nginx_docs_show
export -f org_action_nginx_docs_init
