#!/usr/bin/env bash
# TSM - Tetra Service Manager (v2 refactor)
# Minimal CLI router with 15 commands

TSM_SRC="${TSM_SRC:-$TETRA_SRC/bash/tsm}"

# === 3-PHASE LOADING ===

# Phase 1: Foundation
source "$TSM_SRC/lib/platform.sh"
source "$TSM_SRC/lib/utils.sh"
source "$TSM_SRC/lib/time.sh"
source "$TSM_SRC/lib/colors.sh"
source "$TSM_SRC/lib/hooks.sh"
source "$TSM_SRC/core/init.sh"

# Phase 2: Core
source "$TSM_SRC/lib/ports.sh"
source "$TSM_SRC/core/metadata.sh"
source "$TSM_SRC/core/multi_user.sh"
source "$TSM_SRC/core/start.sh"
source "$TSM_SRC/core/process.sh"
source "$TSM_SRC/core/list.sh"
source "$TSM_SRC/core/list_table.sh"
source "$TSM_SRC/core/list_verbose.sh"
source "$TSM_SRC/core/list_services.sh"
source "$TSM_SRC/core/list_json.sh"
source "$TSM_SRC/core/doctor.sh"
source "$TSM_SRC/core/build.sh"

# Phase 3: Services
source "$TSM_SRC/services/registry.sh"
source "$TSM_SRC/services/startup.sh"
source "$TSM_SRC/services/stack.sh"
source "$TSM_SRC/services/logging.sh"

# Phase 4: Optional enhancements
[[ -f "$TSM_SRC/core/remote.sh" ]] && source "$TSM_SRC/core/remote.sh"
[[ -f "$TSM_SRC/core/patrol.sh" ]] && source "$TSM_SRC/core/patrol.sh"
[[ -f "$TSM_SRC/lib/complete.sh" ]] && source "$TSM_SRC/lib/complete.sh"
[[ -f "$TSM_SRC/lib/help.sh" ]] && source "$TSM_SRC/lib/help.sh"
[[ -f "$TSM_SRC/lib/help_render.sh" ]] && source "$TSM_SRC/lib/help_render.sh"

# Phase 5: Integrations (eager-load for hook registration)
[[ -f "$TSM_SRC/integrations/caddy.sh" ]] && source "$TSM_SRC/integrations/caddy.sh"

# === CLI ROUTER ===

tsm() {
    # Check for remote target (@dev, -H host) first
    if type tsm_maybe_remote &>/dev/null; then
        tsm_maybe_remote "$@"
        local rc=$?
        # rc=2 means not a remote command, continue locally
        [[ $rc -ne 2 ]] && return $rc
    fi

    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Process lifecycle
        start)    tsm_start "$@" ;;
        stop)     tsm_stop "$@" ;;
        restart)  tsm_restart "$@" ;;
        kill)     tsm_kill "$@" ;;
        delete)   tsm_delete "$@" ;;

        # Inspection
        list|ls)  tsm_list "$@" ;;
        ports)    tsm_list --ports "$@" ;;
        info)     tsm_info "$@" ;;
        logs)     tsm_logs "$@" ;;
        describe) tsm_describe "$@" ;;

        # Services
        add)      tsm_add "$@" ;;
        promote)  tsm_promote "$@" ;;
        save)     tsm_save "$@" ;;
        enable)   tsm_enable "$@" ;;
        disable)  tsm_disable "$@" ;;
        startup)  tsm_startup "$@" ;;
        stack)    tsm_stack "$@" ;;

        # Build
        build)    tsm_build "$@" ;;

        # Diagnostics
        check)    tsm_check "$@" ;;
        doctor)   tsm_doctor "$@" ;;
        patrol)   tsm_patrol "$@" ;;

        # Multi-user
        users)    tsm_list_users "$@" ;;

        # Integrations (lazy-loaded)
        caddy)
            source "$TSM_SRC/integrations/caddy.sh"
            tsm_caddy "$@"
            ;;

        # Utilities
        cleanup)  tsm_cleanup ;;
        setup)    tsm_setup ;;

        # Help
        help|-h|--help)
            if [[ -n "$1" && "$1" != "-c" && "$1" != --color* ]] && type tsm_show_help &>/dev/null; then
                tsm_show_help "$@"
            else
                _tsm_help "$@"
            fi
            ;;

        # Unknown
        *)
            tsm_error "unknown command: $cmd"
            _tsm_help
            return 1
            ;;
    esac
}

_tsm_help() {
    cat <<'EOF'
TSM - Tetra Service Manager

LIFECYCLE   start, stop, restart, kill, delete
LIST        ls [available|enabled] [-U] [--org ORG]
INSPECT     info, logs, ports, describe
BUILD       build <env>, promote [file.tsm]
SERVICES    save, enable, disable, startup, stack
SYSTEM      check, doctor, patrol, cleanup, setup, users
INTEGRATE   caddy
REMOTE      @target or -H user@host prefix

tsm ls                        Running processes (default)
tsm ls -a                     Include stopped processes
tsm ls -U                     All users (requires root)
tsm ls available              Service definitions catalog
tsm ls enabled                Services that start on startup
tsm ls available --org tetra  Filter by org

tsm build local               Build .tsm from ./tsm/env.toml
tsm promote                   Promote built .tsm to services-available
tsm enable arcade-terrain-local  Enable for auto-start
tsm start ./app.tsm           Start from .tsm file
tsm describe ./app.tsm        Show config & env influence
tsm help start                Detailed command help
EOF
}

