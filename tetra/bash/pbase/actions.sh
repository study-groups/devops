#!/usr/bin/env bash

# pbase Module Actions - Service + Admin Integration
# Defines verb:noun actions for pdata service management

# Get pbase-specific actions for context
pbase_get_actions() {
    local context="${1:-service}"
    local mode="${2:-inspect}"

    local actions=""

    case "$context:$mode" in
        "service:inspect")
            actions="check:env show:status show:info"
            ;;
        "service:execute")
            actions="start:service stop:service restart:service run:tests"
            ;;
        "users:inspect")
            actions="list:users show:status"
            ;;
        "users:execute")
            actions="add:user delete:user"
            ;;
        "files:inspect")
            actions="list:files tree:files show:status"
            ;;
        "files:execute")
            actions="clean:temp"
            ;;
        "audit:inspect")
            actions="tail:log watch:log show:status"
            ;;
        *)
            actions="check:env show:status help:pbase"
            ;;
    esac

    echo "$actions"
}

# Action dispatcher - routes verb:noun to appropriate function
pbase_action() {
    local action="$1"
    shift

    # Split verb:noun
    local verb="${action%%:*}"
    local noun="${action#*:}"

    case "$verb:$noun" in
        # Service actions
        check:env)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_check_env
            ;;
        show:status)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_status
            ;;
        show:info)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_info
            ;;
        start:service)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_start "$@"
            ;;
        stop:service)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_stop
            ;;
        restart:service)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_stop
            sleep 1
            pdata_start "$@"
            ;;
        run:tests)
            source "$TETRA_SRC/bash/pbase/service.sh"
            pdata_test
            ;;

        # User actions
        list:users)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_user_list
            ;;
        add:user)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_user_add "$@"
            ;;
        delete:user)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_user_delete "$@"
            ;;

        # File actions
        list:files)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_file_list "$@"
            ;;
        tree:files)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_file_tree "$@"
            ;;

        # Audit actions
        tail:log)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_audit_tail "$@"
            ;;
        watch:log)
            source "$TETRA_SRC/bash/pbase/admin.sh"
            admin_audit_watch
            ;;

        # Meta actions
        help:pbase)
            pbase_help
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

# Help text
pbase_help() {
    cat <<'EOF'
pbase - PData Service Management Module

Actions (verb:noun):

Service:
  check:env          Validate environment setup
  show:status        Show service status
  show:info          Show configuration
  start:service      Start pdata service
  stop:service       Stop pdata service
  restart:service    Restart pdata service
  run:tests          Run pdata tests

Users:
  list:users         List all users
  add:user           Add new user
  delete:user        Delete user

Files:
  list:files         List files in pdata
  tree:files         Show file tree

Audit:
  tail:log           Show recent audit entries
  watch:log          Watch audit log (live)

Usage:
  pbase repl                    Start interactive REPL
  pbase <action> [args]         Execute action directly

Examples:
  pbase start:service 3000
  pbase list:users
  pbase tail:log 50
EOF
}

export -f pbase_get_actions
export -f pbase_action
export -f pbase_help
