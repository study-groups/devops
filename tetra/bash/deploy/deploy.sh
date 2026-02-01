#!/usr/bin/env bash
# deploy.sh - Unified deployment system (dispatcher)
#
# Two modes (auto-detected):
#   1. Standalone: SSH config in target TOML ([envs.<env>] has ssh key)
#   2. Org-integrated: SSH from org module (no ssh in target TOML)
#
# Usage:
#   deploy                    With context set: confirm and deploy
#   deploy <target> <env>     Named target from targets/
#   deploy <env>              CWD mode (uses ./tetra-deploy.toml)
#   deploy target <name>      Set current target context
#   deploy env <name>         Set current env context
#   deploy info               Show current context
#   deploy clear              Clear context
#   deploy list               List targets
#   deploy help               Help
#
# Template variables:
#   {{ssh}}         user@host (standalone) or auth_user@host (org)
#   {{host}}        IP/hostname
#   {{user}}        work user
#   {{auth_user}}   SSH login user (org mode)
#   {{work_user}}   app owner user (org mode)
#   {{remote}}      remote path (target.remote or target.cwd)
#   {{domain}}      domain string
#   {{env}}         environment name
#   {{name}}        target name
#   {{local}}       local directory

# =============================================================================
# CONFIGURATION
# =============================================================================

DEPLOY_SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=10"

# =============================================================================
# DISPATCHER
# =============================================================================

deploy() {
    local cmd="${1:-}"

    # No args -> use context if set, else show info
    if [[ -z "$cmd" ]]; then
        if [[ -n "$DEPLOY_CTX_TARGET" && -n "$DEPLOY_CTX_ENV" ]]; then
            deploy_with_context "default"
        elif [[ -n "$DEPLOY_CTX_TARGET" || -n "$DEPLOY_CTX_ENV" ]]; then
            deploy_info
        else
            deploy_list
        fi
        return 0
    fi

    # Check if cmd is a pipeline name (quick, restart, status, etc.) when context is set
    if [[ -n "$DEPLOY_CTX_TARGET" && -n "$DEPLOY_CTX_ENV" ]]; then
        case "$cmd" in
            quick|q|restart|r|status|s|default)
                deploy_with_context "$cmd"
                return $?
                ;;
            -n|--dry-run)
                shift
                deploy_with_context "-n" "${1:-default}"
                return $?
                ;;
        esac
    fi

    case "$cmd" in
        # Context commands
        ctx)
            shift
            deploy_ctx "$@"
            ;;
        org|o)
            shift
            deploy_org_set "$@"
            ;;
        target|t)
            shift
            deploy_target_set "$@"
            ;;
        env|e)
            shift
            case "$1" in
                create) shift; deploy_env_create "$@" ;;
                generate) shift; deploy_env_generate "$@" ;;
                promote) shift; deploy_env_promote "$@" ;;
                validate) shift; deploy_env_validate "$@" ;;
                diff) shift; deploy_env_diff "$@" ;;
                push) shift; deploy_env_push "$@" ;;
                pull) shift; deploy_env_pull "$@" ;;
                edit) shift; deploy_env_edit "$@" ;;
                status) shift; deploy_env_status "$@" ;;
                *) deploy_env_set "$@" ;;  # default: set context env
            esac
            ;;
        info|i)
            deploy_info
            ;;
        clear|c)
            deploy_clear_context
            ;;
        set)
            shift
            deploy_set "$@"
            ;;

        # Items commands
        items)
            shift
            deploy_items "$@"
            ;;
        run)
            shift
            deploy_run "$@"
            ;;

        # Action commands
        push|p)
            shift
            _deploy_smart_dispatch "$@"
            ;;
        show|s)
            shift
            deploy_show "$@"
            ;;
        list|ls)
            deploy_list
            ;;
        doctor|doc)
            shift
            deploy_doctor "$@"
            ;;
        games|g)
            # Route to deploy_games.sh functions
            shift
            local subcmd="${1:-help}"
            shift 2>/dev/null || true
            case "$subcmd" in
                list|ls) deploy_games_list "$@" ;;
                sync|push) deploy_games_sync "$@" ;;
                status|st) deploy_games_status ;;
                help|h|--help) deploy_games_help ;;
                *)
                    # If subcmd looks like a game name, sync it
                    deploy_games_sync "$subcmd" "$@"
                    ;;
            esac
            ;;
        history|hist)
            shift
            deploy_history "$@"
            ;;
        help|h|--help|-h)
            shift
            deploy_help "$@"
            ;;
        -n|--dry-run)
            # Allow: deploy -n target env
            _deploy_smart_dispatch "$@"
            ;;
        *)
            # Check for address syntax: [org:]target[:pipeline][:{items}]
            if [[ "$cmd" == *:* ]]; then
                shift  # Remove cmd

                # Parse address using deploy_addr module
                deploy_addr_parse "$cmd"

                # Apply org override if specified
                local org_override="${DEPLOY_ADDR[org]}"
                local save_org=""
                if [[ -n "$org_override" ]]; then
                    save_org="$DEPLOY_CTX_ORG"
                    export DEPLOY_CTX_ORG="$org_override"
                fi

                # Helper to restore org on exit
                _restore_org() { [[ -n "$org_override" ]] && export DEPLOY_CTX_ORG="$save_org"; }

                # Validate address (org, target, pipeline)
                if ! deploy_addr_validate; then
                    echo -e "${DEPLOY_ADDR[error]}" >&2
                    _restore_org
                    return 1
                fi

                # Resolve exclude/group items after validation (needs toml_path)
                local items_override="${DEPLOY_ADDR[items]}"
                if [[ "${DEPLOY_ADDR[items_mode]}" == "exclude" ]]; then
                    deploy_addr_resolve_exclude
                    items_override="${DEPLOY_ADDR[items]}"
                elif [[ "${DEPLOY_ADDR[items_mode]}" == "group" ]]; then
                    deploy_addr_resolve_group
                    items_override="${DEPLOY_ADDR[items]}"
                fi

                # Extract parsed values
                local target="${DEPLOY_ADDR[target]}"
                local pipeline="${DEPLOY_ADDR[pipeline]}"
                local toml="${DEPLOY_ADDR[toml_path]}"

                # Parse remaining args for --edit and -item/=item
                DEPLOY_EDIT_MODE=0
                _deploy_parse_item_args "$@"
                set -- "${DEPLOY_REMAINING_ARGS[@]}"

                local env="${1:-${DEPLOY_ADDR[env]}}"
                local dry_run=0
                [[ "$2" == "-n" || "$2" == "--dry-run" ]] && dry_run=1

                # Handle --edit mode
                if [[ $DEPLOY_EDIT_MODE -eq 1 ]]; then
                    # Temporarily set target to load items
                    local save_target="$DEPLOY_CTX_TARGET"
                    export DEPLOY_CTX_TARGET="$target"
                    deploy_items_reset

                    # Apply one-shot filters before editing
                    _deploy_apply_oneshot_filters
                    DEPLOY_CTX_ITEMS=("${DEPLOY_WORKING_ITEMS[@]}")

                    _deploy_edit_items || {
                        export DEPLOY_CTX_TARGET="$save_target"
                        _restore_org
                        return 1
                    }

                    # Run pipeline on edited items
                    de_load "$toml" || { export DEPLOY_CTX_TARGET="$save_target"; _restore_org; return 1; }
                    de_run "$pipeline" "$env" "$dry_run" "${DEPLOY_CTX_ITEMS[*]}"
                    local rc=$?

                    # Restore target and org
                    export DEPLOY_CTX_TARGET="$save_target"
                    _restore_org
                    return $rc
                fi

                # Handle one-shot filters (without --edit)
                if [[ ${#DEPLOY_ONESHOT_EXCLUDE[@]} -gt 0 || ${#DEPLOY_ONESHOT_INCLUDE[@]} -gt 0 ]]; then
                    local save_target="$DEPLOY_CTX_TARGET"
                    local save_items=("${DEPLOY_CTX_ITEMS[@]}")
                    local save_modified=$DEPLOY_CTX_ITEMS_MODIFIED

                    export DEPLOY_CTX_TARGET="$target"
                    deploy_items_reset
                    _deploy_apply_oneshot_filters
                    DEPLOY_CTX_ITEMS=("${DEPLOY_WORKING_ITEMS[@]}")

                    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
                        echo "No items remaining after filter" >&2
                        export DEPLOY_CTX_TARGET="$save_target"
                        DEPLOY_CTX_ITEMS=("${save_items[@]}")
                        DEPLOY_CTX_ITEMS_MODIFIED=$save_modified
                        _restore_org
                        return 1
                    fi

                    echo "Items: ${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]})"
                    de_load "$toml" || { export DEPLOY_CTX_TARGET="$save_target"; _restore_org; return 1; }
                    de_run "$pipeline" "$env" "$dry_run" "${DEPLOY_CTX_ITEMS[*]}"
                    local rc=$?

                    # Restore context
                    export DEPLOY_CTX_TARGET="$save_target"
                    DEPLOY_CTX_ITEMS=("${save_items[@]}")
                    DEPLOY_CTX_ITEMS_MODIFIED=$save_modified
                    _restore_org
                    return $rc
                fi

                # Standard target:pipeline run (with optional items_override from brace syntax)
                de_load "$toml" || { _restore_org; return 1; }
                de_run "$pipeline" "$env" "$dry_run" "$items_override"
                local rc=$?
                _restore_org
                return $rc
            fi

            # Default: deploy <target> <env> or deploy <env> (legacy)
            _deploy_smart_dispatch "$@"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy
