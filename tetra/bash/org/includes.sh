#!/usr/bin/env bash
# Org Module - Organization Management System

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

# Load constants first - required by all other modules
source "$ORG_SRC/org_constants.sh"

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
