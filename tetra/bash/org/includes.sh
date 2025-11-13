#!/usr/bin/env bash
# Org Module - Organization Management System

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

# Load constants first - required by all other modules
source "$ORG_SRC/org_constants.sh"

# Load tree-based help and completion infrastructure
source "$ORG_SRC/org_tree.sh"
source "$ORG_SRC/org_completion.sh"

# Core functionality
if [[ ! -f "$ORG_SRC/tetra_org.sh" ]]; then
    echo "Error: Required core module not found: $ORG_SRC/tetra_org.sh" >&2
    return 1 2>/dev/null || exit 1
fi
source "$ORG_SRC/tetra_org.sh"

# Optional modules - warn if missing but continue
for optional_module in "discovery.sh" "converter.sh" "compiler.sh" "org_help.sh" "actions.sh" "org_action_explorer.sh" "org_repl.sh"; do
    if [[ -f "$ORG_SRC/$optional_module" ]]; then
        source "$ORG_SRC/$optional_module"
    else
        echo "Warning: Optional org module not found: $optional_module (some features may be unavailable)" >&2
    fi
done

# Multi-environment configuration management (optional)
for config_module in "org_config.sh" "env_profiles.sh" "org_deploy.sh"; do
    if [[ -f "$ORG_SRC/$config_module" ]]; then
        source "$ORG_SRC/$config_module"
    fi
done

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

        # Secrets management
        secrets)
            # Load secrets manager
            source "$ORG_SRC/secrets_manager.sh"

            local secrets_action="${1:-list}"
            shift || true

            # Get active org if no org specified
            local org_name="${1:-}"
            if [[ -z "$org_name" ]]; then
                org_name=$(org_active)
                if [[ -z "$org_name" ]]; then
                    echo "Error: No active organization. Use 'org switch <name>' or specify org name" >&2
                    return 1
                fi
            else
                shift || true
            fi

            case "$secrets_action" in
                init)
                    tetra_secrets_init "$org_name" "$@"
                    ;;
                validate)
                    tetra_secrets_validate "$org_name" "$@"
                    ;;
                load)
                    tetra_secrets_load "$org_name" "$@"
                    ;;
                list|ls)
                    tetra_secrets_list "$org_name" "$@"
                    ;;
                copy)
                    local target_org="$1"
                    if [[ -z "$target_org" ]]; then
                        echo "Error: Target organization required" >&2
                        echo "Usage: org secrets copy <source_org> <target_org>" >&2
                        return 1
                    fi
                    tetra_secrets_copy "$org_name" "$target_org"
                    ;;
                resolve)
                    tetra_secrets_resolve "$org_name" "$@"
                    ;;
                help|--help|-h)
                    cat << 'EOF'
Tetra Secrets Management

USAGE:
    org secrets <command> [org_name] [options]

COMMANDS:
    init [org_name]              Initialize secrets.env for organization
    validate [org_name]          Validate secrets file and permissions
    load [org_name] [env]        Load secrets into current environment
    list [org_name]              List secret keys (no values shown)
    copy <src> <target>          Copy secrets between organizations
    resolve [org_name] [file]    Resolve ${VAR} references in tetra.toml

If org_name is not specified, the active organization is used.

EXAMPLES:
    org secrets list                     # List secrets for active org
    org secrets validate pixeljam-arcade # Validate specific org
    org secrets resolve                  # Output resolved TOML to stdout
    org secrets resolve "" /tmp/out.toml # Save resolved TOML to file

SECURITY:
    - secrets.env contains actual secret values (600 permissions, gitignored)
    - tetra.toml contains ${VAR_NAME} references (can be committed to git)
    - Resolution happens at runtime using envsubst
EOF
                    ;;
                *)
                    echo "Unknown secrets command: $secrets_action"
                    echo "Use 'org secrets help' for available commands"
                    return 1
                    ;;
            esac
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
