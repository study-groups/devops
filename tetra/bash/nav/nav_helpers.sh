#!/usr/bin/env bash
# nav/nav_helpers.sh - Helper utilities for nav structures

NAV_HELPERS_SRC="${NAV_HELPERS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source nav core
source "$NAV_HELPERS_SRC/nav.sh"

# Get description for a nav node
# Falls back to title if description not available
# Args: $1 = path (e.g., "help.tdocs.init")
nav_get_description() {
    local path="$1"

    if [[ -z "$path" ]]; then
        echo "Error: nav_get_description requires path argument" >&2
        return 1
    fi

    # Try description first
    local desc=$(nav_get "$path" "description" 2>/dev/null)
    if [[ -n "$desc" ]]; then
        echo "$desc"
        return 0
    fi

    # Fall back to title
    local title=$(nav_get "$path" "title" 2>/dev/null)
    if [[ -n "$title" ]]; then
        echo "$title"
        return 0
    fi

    return 1
}

# List all commands under a namespace with their descriptions
# Args: $1 = namespace path (e.g., "help.tdocs")
#       $2 = format (default: "compact", options: "compact", "detailed", "names-only")
nav_list_commands() {
    local namespace="$1"
    local format="${2:-compact}"

    if [[ -z "$namespace" ]]; then
        echo "Error: nav_list_commands requires namespace argument" >&2
        return 1
    fi

    local children=$(nav_children "$namespace" 2>/dev/null)
    [[ -z "$children" ]] && return 0

    # Filter to commands only
    local commands=()
    for child in $children; do
        local type="${NAV_TYPE[$child]}"
        if [[ "$type" == "command" ]]; then
            commands+=("$child")
        fi
    done

    case "$format" in
        names-only)
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                echo "$name"
            done | tr '\n' ' '
            ;;

        detailed)
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                local desc=$(nav_get_description "$cmd_path")
                local synopsis=$(nav_get "$cmd_path" "synopsis" 2>/dev/null)

                echo "$name"
                [[ -n "$synopsis" ]] && echo "  Usage: $synopsis"
                [[ -n "$desc" ]] && echo "  $desc"
                echo ""
            done
            ;;

        compact|*)
            local max_width=0
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                local len=${#name}
                [[ $len -gt $max_width ]] && max_width=$len
            done

            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                local desc=$(nav_get_description "$cmd_path")

                if [[ -n "$desc" ]]; then
                    printf "%-${max_width}s  %s\n" "$name" "$desc"
                else
                    echo "$name"
                fi
            done
            ;;
    esac
}

# Generate space-separated action list from nav namespace
# Used to implement module_actions() from nav data
nav_to_module_actions() {
    local namespace="$1"

    if [[ -z "$namespace" ]]; then
        echo "Error: nav_to_module_actions requires namespace argument" >&2
        return 1
    fi

    nav_list_commands "$namespace" "names-only"
}

# Dispatch command based on handler metadata in nav
# Args: $1 = namespace (e.g., "help.tdocs")
#       $2 = command name (e.g., "init")
#       $@ = remaining args passed to handler
nav_dispatch() {
    local namespace="$1"
    local command="$2"
    shift 2

    if [[ -z "$namespace" || -z "$command" ]]; then
        echo "Error: nav_dispatch requires namespace and command arguments" >&2
        return 1
    fi

    local cmd_path="$namespace.$command"
    local handler=$(nav_get "$cmd_path" "handler" 2>/dev/null)

    if [[ -z "$handler" ]]; then
        echo "Error: No handler found for $cmd_path" >&2
        return 1
    fi

    if ! declare -F "$handler" >/dev/null 2>&1; then
        echo "Error: Handler function '$handler' not found" >&2
        return 1
    fi

    "$handler" "$@"
}

# Get all aliases for a command
nav_get_aliases() {
    local path="$1"
    [[ -z "$path" ]] && return 1
    nav_get "$path" "aliases" 2>/dev/null
}

# Find command path by name or alias
# Args: $1 = namespace (e.g., "help.tdocs")
#       $2 = command name or alias
nav_find_command() {
    local namespace="$1"
    local search="$2"

    [[ -z "$namespace" || -z "$search" ]] && return 1

    local children=$(nav_children "$namespace" 2>/dev/null)

    for child in $children; do
        local type="${NAV_TYPE[$child]}"
        [[ "$type" != "command" ]] && continue

        local name="${child##*.}"

        # Direct match
        if [[ "$name" == "$search" ]]; then
            echo "$child"
            return 0
        fi

        # Alias match
        local aliases=$(nav_get_aliases "$child")
        if [[ -n "$aliases" ]]; then
            for alias in ${aliases//,/ }; do
                if [[ "$alias" == "$search" ]]; then
                    echo "$child"
                    return 0
                fi
            done
        fi
    done

    return 1
}

# =============================================================================
# TREE_* COMPATIBILITY SHIMS
# =============================================================================

tree_get_description() { nav_get_description "$@"; }
tree_list_commands() { nav_list_commands "$@"; }
tree_to_module_actions() { nav_to_module_actions "$@"; }
tree_dispatch() { nav_dispatch "$@"; }
tree_get_aliases() { nav_get_aliases "$@"; }
tree_find_command() { nav_find_command "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f nav_get_description nav_list_commands nav_to_module_actions
export -f nav_dispatch nav_get_aliases nav_find_command
export -f tree_get_description tree_list_commands tree_to_module_actions
export -f tree_dispatch tree_get_aliases tree_find_command
