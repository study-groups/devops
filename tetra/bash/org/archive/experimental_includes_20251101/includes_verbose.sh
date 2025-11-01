#!/usr/bin/env bash
# SAFE VERSION - Line by line loading with verbose output

echo "ORG: Starting includes_safe.sh" >&2

echo "ORG: Setting ORG_SRC" >&2
ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"
echo "ORG: ORG_SRC=$ORG_SRC" >&2

echo "ORG: Loading tetra_org.sh..." >&2
if [[ -f "$ORG_SRC/tetra_org.sh" ]]; then
    source "$ORG_SRC/tetra_org.sh" || {
        echo "ORG: FAILED to load tetra_org.sh" >&2
        return 1
    }
    echo "ORG: ✓ tetra_org.sh loaded" >&2
else
    echo "ORG: ERROR - tetra_org.sh not found" >&2
    return 1
fi

echo "ORG: Loading discovery.sh..." >&2
source "$ORG_SRC/discovery.sh" 2>/dev/null && echo "ORG: ✓ discovery.sh" >&2 || echo "ORG: ✗ discovery.sh (optional)" >&2

echo "ORG: Loading converter.sh..." >&2
source "$ORG_SRC/converter.sh" 2>/dev/null && echo "ORG: ✓ converter.sh" >&2 || echo "ORG: ✗ converter.sh (optional)" >&2

echo "ORG: Loading compiler.sh..." >&2
source "$ORG_SRC/compiler.sh" 2>/dev/null && echo "ORG: ✓ compiler.sh" >&2 || echo "ORG: ✗ compiler.sh (optional)" >&2

echo "ORG: Loading refresh.sh..." >&2
source "$ORG_SRC/refresh.sh" 2>/dev/null && echo "ORG: ✓ refresh.sh" >&2 || echo "ORG: ✗ refresh.sh (optional)" >&2

echo "ORG: Loading secrets_manager.sh..." >&2
source "$ORG_SRC/secrets_manager.sh" 2>/dev/null && echo "ORG: ✓ secrets_manager.sh" >&2 || echo "ORG: ✗ secrets_manager.sh (optional)" >&2

echo "ORG: Loading org_help.sh..." >&2
source "$ORG_SRC/org_help.sh" 2>/dev/null && echo "ORG: ✓ org_help.sh" >&2 || echo "ORG: ✗ org_help.sh (optional)" >&2

echo "ORG: Loading org_repl_adapter.sh..." >&2
source "$ORG_SRC/org_repl_adapter.sh" 2>/dev/null && echo "ORG: ✓ org_repl_adapter.sh" >&2 || echo "ORG: ✗ org_repl_adapter.sh (optional)" >&2

echo "ORG: Loading nh_bridge.sh..." >&2
source "$TETRA_SRC/bash/nh/nh_bridge.sh" 2>/dev/null && echo "ORG: ✓ nh_bridge.sh" >&2 || echo "ORG: ✗ nh_bridge.sh (optional)" >&2

echo "ORG: Registering commands..." >&2
tetra_create_lazy_function "tetra_org" "org" 2>/dev/null || echo "ORG: ✗ lazy function (optional)" >&2

echo "ORG: Defining tetra_org function..." >&2
# Main org command interface
tetra_org() {
    local subcommand="${1:-list}"
    shift || true

    case "$subcommand" in
        "list"|"ls") org_list "$@" ;;
        "switch"|"sw") org_switch "$@" ;;
        "active"|"current") org_active "$@" ;;
        "create") org_create "$@" ;;
        "validate") org_validate "$@" ;;
        "push") org_push "$@" ;;
        "pull") org_pull "$@" ;;
        "rollback") org_rollback "$@" ;;
        "template") org_template "$@" ;;
        "templates") org_list_templates "$@" ;;
        "history") org_history "$@" ;;
        "import") org_import "$@" ;;
        "discover") org_discover "$@" ;;
        "compile") tetra_compile_toml "$@" 2>/dev/null || echo "Compiler not available" ;;
        "refresh") tetra_org_refresh "$@" 2>/dev/null || echo "Refresh not available" ;;
        "secrets")
            local secrets_cmd="tetra_secrets_${1:-help}"
            shift 2>/dev/null || true
            if command -v "$secrets_cmd" >/dev/null 2>&1; then
                "$secrets_cmd" "$@"
            else
                echo "Secrets manager not available"
            fi
            ;;
        "repl")
            if command -v org_repl >/dev/null 2>&1; then
                org_repl
            else
                echo "Org REPL not available"
            fi
            ;;
        "help"|"-h"|"--help")
            echo "Tetra Organization Management"
            echo "Usage: tetra org <command>"
            echo "Use 'tetra org help' for full command list"
            ;;
        *)
            echo "Unknown org command: $subcommand"
            echo "Use 'tetra org help' for available commands"
            return 1
            ;;
    esac
}
echo "ORG: ✓ tetra_org defined" >&2

echo "ORG: Defining org function..." >&2
org() {
    if [[ $# -eq 0 ]]; then
        if command -v org_repl >/dev/null 2>&1; then
            org_repl
        else
            echo "Org REPL not available - load org module first"
            return 1
        fi
    else
        tetra_org "$@"
    fi
}
echo "ORG: ✓ org defined" >&2

echo "ORG: Exporting functions..." >&2
export -f org 2>/dev/null || echo "ORG: ✗ export org failed" >&2
export -f org_list 2>/dev/null || echo "ORG: ✗ export org_list failed" >&2
export -f org_active 2>/dev/null || echo "ORG: ✗ export org_active failed" >&2
export -f org_switch 2>/dev/null || echo "ORG: ✗ export org_switch failed" >&2
export -f org_create 2>/dev/null || echo "ORG: ✗ export org_create failed" >&2
export -f org_import 2>/dev/null || echo "ORG: ✗ export org_import failed" >&2
export -f org_discover 2>/dev/null || echo "ORG: ✗ export org_discover failed" >&2
export -f org_validate 2>/dev/null || echo "ORG: ✗ export org_validate failed" >&2
export -f org_push 2>/dev/null || echo "ORG: ✗ export org_push failed" >&2
export -f org_pull 2>/dev/null || echo "ORG: ✗ export org_pull failed" >&2
export -f org_rollback 2>/dev/null || echo "ORG: ✗ export org_rollback failed" >&2
export -f org_history 2>/dev/null || echo "ORG: ✗ export org_history failed" >&2

echo "ORG: ✓✓✓ includes_safe.sh COMPLETE ✓✓✓" >&2
return 0
