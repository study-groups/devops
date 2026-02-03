#!/usr/bin/env bash
# deploy_diagnostics.sh - Doctor, completion diagnostics, and history
#
# Functions: deploy_doctor, _deploy_doctor_complete, deploy_history

deploy_doctor() {
    local cmd="${1:-}"
    local arg="${2:-}"

    case "$cmd" in
        reload|r)
            echo "Reloading deploy module..."
            source "$DEPLOY_SRC/includes.sh"
            echo "done"
            return 0
            ;;
        complete|comp)
            # Show completion diagnostics
            _deploy_doctor_complete "$arg"
            return 0
            ;;
        "")
            # Default: show status
            ;;
        *)
            echo "usage: deploy doctor [reload|complete [target]]"
            return 1
            ;;
    esac

    local org=$(org_active 2>/dev/null)
    local ctx="[${DEPLOY_CTX_ORG:-?}:${DEPLOY_CTX_TARGET:-?}:${DEPLOY_CTX_ENV:-?}]"

    echo "deploy doctor"
    echo "  ctx: $ctx"
    echo "  org: ${org:-(none)}"
    echo "  tps: ${DEPLOY_TPS_REGISTERED:-0}"

    # Targets
    if [[ -n "$org" && "$org" != "none" ]]; then
        local targets_dir="$TETRA_DIR/orgs/$org/targets"
        if [[ -d "$targets_dir" ]]; then
            local count=$(find "$targets_dir" \( -name "*.toml" -o -name "tetra-deploy.toml" \) 2>/dev/null | wc -l | tr -d ' ')
            echo "  targets: $count"
        fi
    fi

    [[ -f "./tetra-deploy.toml" ]] && echo "  cwd: tetra-deploy.toml"
}

# Completion diagnostics
_deploy_doctor_complete() {
    local target="${1:-}"

    echo "Completion Diagnostics"
    echo "======================"
    echo ""

    # Org resolution
    echo "Org Resolution:"
    echo "  DEPLOY_CTX_ORG:    ${DEPLOY_CTX_ORG:-(empty)}"
    echo "  org_active:        $(type org_active &>/dev/null && org_active 2>/dev/null || echo "(unavailable)")"
    echo "  _deploy_active_org: $(type _deploy_active_org &>/dev/null && _deploy_active_org 2>/dev/null || echo "(unavailable)")"

    local org=$(_deploy_active_org 2>/dev/null)
    [[ -z "$org" ]] && org=$(org_active 2>/dev/null)
    echo "  resolved:          ${org:-(none)}"
    echo ""

    # Targets directory
    if [[ -n "$org" && "$org" != "none" ]]; then
        local targets_dir="$TETRA_DIR/orgs/$org/targets"
        echo "Targets Directory:"
        echo "  path: $targets_dir"
        echo "  exists: $([[ -d "$targets_dir" ]] && echo "yes" || echo "no")"
        echo ""

        if [[ -d "$targets_dir" ]]; then
            echo "Available Targets:"
            # .toml files
            for f in "$targets_dir"/*.toml; do
                [[ -f "$f" ]] && echo "  $(basename "$f" .toml) (file)"
            done
            # Directories
            for d in "$targets_dir"/*/; do
                [[ -d "$d" && -f "$d/tetra-deploy.toml" ]] && echo "  $(basename "$d") (dir)"
            done
            echo ""

            # If target specified, show its pipelines
            if [[ -n "$target" ]]; then
                local toml=""
                if [[ -f "$targets_dir/$target/tetra-deploy.toml" ]]; then
                    toml="$targets_dir/$target/tetra-deploy.toml"
                elif [[ -f "$targets_dir/${target}.toml" ]]; then
                    toml="$targets_dir/${target}.toml"
                fi

                if [[ -n "$toml" ]]; then
                    echo "Target: $target"
                    echo "  toml: $toml"
                    echo ""
                    echo "  Pipelines (tab-completable):"
                    awk '/^\[pipeline\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print "    " $1}' "$toml"
                    echo ""
                    echo "  Aliases (hidden from tab, power-user shortcuts):"
                    awk '/^\[alias\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print "    " $1}' "$toml" || echo "    (none)"
                else
                    echo "Target '$target' not found"
                fi
            fi
        fi
    else
        echo "No org resolved - cannot list targets"
    fi
}

deploy_history() {
    local log_file="$MOD_DIR/logs/deploy.log"
    local verbose=0
    local limit=20

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--verbose) verbose=1; shift ;;
            [0-9]*) limit="$1"; shift ;;
            *) shift ;;
        esac
    done

    if [[ ! -f "$log_file" ]]; then
        echo "No deployment history"
        return 0
    fi

    echo "Recent Deployments"
    echo "=================="

    if [[ $verbose -eq 1 ]]; then
        # Verbose format
        printf "%-20s %-12s %-6s %-10s %-7s %5s %-8s %-12s %s\n" \
            "TIMESTAMP" "TARGET" "ENV" "ACTION" "STATUS" "SECS" "USER" "BRANCH" "COMMIT"
        printf "%-20s %-12s %-6s %-10s %-7s %5s %-8s %-12s %s\n" \
            "---------" "------" "---" "------" "------" "----" "----" "------" "------"

        tail -n "$limit" "$log_file" | tac | while IFS='|' read -r ts target env action status duration user branch commit extra; do
            # Trim whitespace
            ts="${ts## }"; ts="${ts%% }"
            target="${target## }"; target="${target%% }"
            env="${env## }"; env="${env%% }"
            action="${action## }"; action="${action%% }"
            status="${status## }"; status="${status%% }"
            duration="${duration## }"; duration="${duration%% }"
            user="${user## }"; user="${user%% }"
            branch="${branch## }"; branch="${branch%% }"
            commit="${commit## }"; commit="${commit%% }"

            # Shorten timestamp
            ts="${ts%+*}"  # Remove timezone
            ts="${ts/T/ }" # Replace T with space

            # Truncate long fields
            [[ ${#target} -gt 12 ]] && target="${target:0:11}…"
            [[ ${#branch} -gt 12 ]] && branch="${branch:0:11}…"

            printf "%-20s %-12s %-6s %-10s %-7s %5s %-8s %-12s %s\n" \
                "$ts" "$target" "$env" "$action" "$status" "${duration:-0}" "$user" "$branch" "$commit"
        done
    else
        # Compact format
        printf "%-20s %-15s %-8s %-12s %-8s %s\n" "TIMESTAMP" "TARGET" "ENV" "ACTION" "STATUS" "TIME"
        printf "%-20s %-15s %-8s %-12s %-8s %s\n" "---------" "------" "---" "------" "------" "----"

        tail -n "$limit" "$log_file" | tac | while IFS='|' read -r ts target env action status duration rest; do
            # Trim whitespace
            ts="${ts## }"; ts="${ts%% }"
            target="${target## }"; target="${target%% }"
            env="${env## }"; env="${env%% }"
            action="${action## }"; action="${action%% }"
            status="${status## }"; status="${status%% }"
            duration="${duration## }"; duration="${duration%% }"

            # Shorten timestamp
            ts="${ts%+*}"  # Remove timezone
            ts="${ts/T/ }" # Replace T with space

            # Format duration
            local time_str="${duration:-0}s"

            printf "%-20s %-15s %-8s %-12s %-8s %s\n" "$ts" "$target" "$env" "$action" "$status" "$time_str"
        done
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

