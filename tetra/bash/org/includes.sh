#!/usr/bin/env bash
# Org Module - Organization Management System

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

# Load constants first - required by all other modules
source "$ORG_SRC/org_constants.sh"

# Load tree-based help and completion infrastructure
source "$ORG_SRC/org_tree.sh"
source "$ORG_SRC/org_completion.sh"

# Core functionality
source "$ORG_SRC/tetra_org.sh"
source "$ORG_SRC/discovery.sh" 2>/dev/null || true
source "$ORG_SRC/converter.sh" 2>/dev/null || true
source "$ORG_SRC/compiler.sh" 2>/dev/null || true
source "$ORG_SRC/org_help.sh" 2>/dev/null || true
source "$ORG_SRC/actions.sh" 2>/dev/null || true
source "$ORG_SRC/org_repl.sh" 2>/dev/null || true

# Multi-environment configuration management
source "$ORG_SRC/org_config.sh" 2>/dev/null || true
source "$ORG_SRC/env_profiles.sh" 2>/dev/null || true
source "$ORG_SRC/org_deploy.sh" 2>/dev/null || true

# Register org actions with action registry
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    # Local:Inspect actions
    action_register "org" "view.orgs" "View all organizations" "" "no"
    action_register "org" "view.toml" "View active organization TOML" "" "no"
    action_register "org" "view.secrets" "View organization secrets" "" "no"
    action_register "org" "validate.toml" "Validate organization TOML structure" "[--strict]" "no"
    action_register "org" "list.templates" "List available organization templates" "" "no"

    # Local:Transfer actions
    action_register "org" "import.nh" "Import organization from NH format" "<source>" "no"
    action_register "org" "import.json" "Import organization from JSON" "<source>" "no"
    action_register "org" "export.toml" "Export organization to TOML" "[dest]" "no"
    action_register "org" "backup.org" "Backup organization configuration" "" "no"

    # Local:Execute actions
    action_register "org" "compile.toml" "Compile TOML to TES endpoint configs" "" "yes"
    action_register "org" "create.org" "Create new organization" "<name>" "no"
    action_register "org" "switch.org" "Switch active organization" "<name>" "no"
    action_register "org" "refresh.config" "Refresh organization configuration" "" "no"

    # Dev/Staging/Prod:Inspect actions
    action_register "org" "view.env" "View environment configuration" "" "yes"
    action_register "org" "check.connectivity" "Check endpoint connectivity" "" "yes"
    action_register "org" "view.services" "View running services" "" "yes"
    action_register "org" "view.status" "View deployment status" "" "yes"

    # Dev/Staging/Prod:Transfer actions
    action_register "org" "push.config" "Push configuration to endpoint" "<config>" "yes"
    action_register "org" "pull.config" "Pull configuration from endpoint" "" "yes"
    action_register "org" "sync.resources" "Sync resources with endpoint" "" "yes"
    action_register "org" "backup.remote" "Backup remote configuration" "" "yes"

    # Dev/Staging/Prod:Execute actions
    action_register "org" "deploy.services" "Deploy services to endpoint" "" "yes"
    action_register "org" "restart.service" "Restart specific service" "<service>" "yes"
    action_register "org" "rollback.deployment" "Rollback to previous deployment" "" "yes"
    action_register "org" "validate.deployment" "Validate deployment integrity" "" "yes"
    action_register "org" "check.health" "Check endpoint health" "" "yes"

    # Help action
    action_register "org" "help.org" "Show organization help" "" "no"
fi

# Main org command - launches enhanced REPL by default
org() {
    local action="${1:-repl}"

    # No args or "repl" - launch REPL
    if [[ -z "$action" ]] || [[ "$action" == "repl" ]]; then
        org_repl
        return $?
    fi

    # Direct command execution (for scripting)
    shift || true

    case "$action" in
        # Organization management
        list|ls)
            org_list "$@"
            ;;
        active)
            org_active "$@"
            ;;
        switch|sw)
            org_switch "$@"
            ;;
        create)
            org_create "$@"
            ;;
        import)
            org_import "$@"
            ;;
        discover)
            org_discover "$@"
            ;;
        validate)
            org_validate "$@"
            ;;
        compile)
            tetra_compile_toml "$@"
            ;;
        push)
            org_push "$@"
            ;;
        pull)
            org_pull "$@"
            ;;
        rollback)
            org_rollback "$@"
            ;;
        history|hist)
            org_history "$@"
            ;;

        # Multi-environment configuration (NEW)
        init)
            org_config_init "$@"
            ;;
        promote)
            org_promote "$@"
            ;;
        env)
            # Sub-commands for environment management
            local env_action="${1:-list}"
            shift || true
            case "$env_action" in
                list|ls)
                    org_config_list "$@"
                    ;;
                edit)
                    org_config_env_edit "$@"
                    ;;
                show)
                    org_config_env_show "$@"
                    ;;
                validate)
                    org_config_validate "$@"
                    ;;
                *)
                    echo "Usage: tsm org env [list|edit|show|validate] <environment>"
                    return 1
                    ;;
            esac
            ;;
        diff)
            org_deploy_diff "$@"
            ;;
        apply)
            org_apply "$@"
            ;;

        help|--help|-h)
            org_help "$@"
            ;;
        *)
            echo "Unknown command: $action"
            echo "Use 'org help' for available commands"
            return 1
            ;;
    esac
}

export -f org

# Register tab completion AFTER org function is defined
# This must happen after the org() function exists
complete -F _org_complete org
