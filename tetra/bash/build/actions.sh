#!/usr/bin/env bash
# build/actions.sh - Build module actions registry

# Source main module if not already loaded
[[ -z "${BUILD_VERSION:-}" ]] && source "${TETRA_SRC}/bash/build/build.sh"

# Register build actions
declare -gA BUILD_ACTIONS=(
    [build]="tetra_build"
    [help]="_build_help"
)

# Action dispatcher
build_action() {
    local action="${1:-build}"
    shift 2>/dev/null || true

    if [[ -n "${BUILD_ACTIONS[$action]}" ]]; then
        "${BUILD_ACTIONS[$action]}" "$@"
    else
        tetra_build "$action" "$@"
    fi
}

export -f build_action
