#!/usr/bin/env bash
# pbase Module - PData Service Management

PBASE_MOD_SRC="${PBASE_MOD_SRC:-$TETRA_SRC/bash/pbase}"

# Load service management
source "$PBASE_MOD_SRC/service.sh"

# Load admin functions
source "$PBASE_MOD_SRC/admin.sh"

# Load actions
source "$PBASE_MOD_SRC/actions.sh"

# Load REPL
source "$PBASE_MOD_SRC/pbase_repl.sh" 2>/dev/null || true

# Main pbase command - launches REPL by default
pbase() {
    local action="${1:-repl}"

    # No args or "repl" - launch REPL
    if [[ -z "$action" ]] || [[ "$action" == "repl" ]]; then
        pbase_repl
        return $?
    fi

    # Check for verb:noun action
    if [[ "$action" == *":"* ]]; then
        pbase_action "$@"
        return $?
    fi

    # Legacy direct commands
    shift || true

    case "$action" in
        # Service management (legacy)
        start)
            pdata_start "$@"
            ;;
        stop)
            pdata_stop
            ;;
        restart)
            pdata_stop
            sleep 1
            pdata_start "$@"
            ;;
        status)
            pdata_status
            ;;
        info)
            pdata_info
            ;;
        check)
            pdata_check_env
            ;;
        test)
            pdata_test
            ;;

        # Admin (legacy)
        user|users)
            local subcmd="${1:-list}"
            shift || true
            case "$subcmd" in
                list) admin_user_list ;;
                add) admin_user_add "$@" ;;
                delete) admin_user_delete "$@" ;;
                *) echo "Usage: pbase user {list|add|delete}"; return 1 ;;
            esac
            ;;
        file|files)
            local subcmd="${1:-list}"
            shift || true
            case "$subcmd" in
                list) admin_file_list "$@" ;;
                tree) admin_file_tree "$@" ;;
                *) echo "Usage: pbase file {list|tree}"; return 1 ;;
            esac
            ;;
        audit)
            local subcmd="${1:-tail}"
            shift || true
            case "$subcmd" in
                tail) admin_audit_tail "$@" ;;
                watch) admin_audit_watch ;;
                status) admin_status ;;
                *) echo "Usage: pbase audit {tail|watch|status}"; return 1 ;;
            esac
            ;;

        help|--help|-h)
            pbase_help
            ;;
        *)
            # Try as verb:noun action
            pbase_action "$action" "$@"
            ;;
    esac
}

export -f pbase
