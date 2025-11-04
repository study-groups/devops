#!/usr/bin/env bash

# Tree Helper Functions
# Utilities for working with the tree data structure

# Note: Tree core should be loaded before using these functions
# Functions will check for tree availability at runtime

# Get description for a tree node
# Falls back to title if description not available
# Args: $1 = tree path (e.g., "help.tdocs.init")
# Returns: description string or empty
tree_get_description() {
    local path="$1"

    if [[ -z "$path" ]]; then
        echo "Error: tree_get_description requires path argument" >&2
        return 1
    fi

    # Try description first (preferred for single-line help)
    local desc=$(tree_get "$path" "description" 2>/dev/null)
    if [[ -n "$desc" ]]; then
        echo "$desc"
        return 0
    fi

    # Fall back to title
    local title=$(tree_get "$path" "title" 2>/dev/null)
    if [[ -n "$title" ]]; then
        echo "$title"
        return 0
    fi

    # No description available
    return 1
}

# List all commands under a namespace with their descriptions
# Args: $1 = namespace path (e.g., "help.tdocs")
#       $2 = format (default: "compact", options: "compact", "detailed", "names-only")
# Output: Formatted list of commands with descriptions
tree_list_commands() {
    local namespace="$1"
    local format="${2:-compact}"

    if [[ -z "$namespace" ]]; then
        echo "Error: tree_list_commands requires namespace argument" >&2
        return 1
    fi

    # Get all children of type "command"
    local children=$(tree_children "$namespace" 2>/dev/null)

    if [[ -z "$children" ]]; then
        return 0
    fi

    # Filter to commands only
    local commands=()
    for child in $children; do
        # Type is stored in TREE_TYPE associative array
        local type="${TREE_TYPE[$child]}"
        if [[ "$type" == "command" ]]; then
            commands+=("$child")
        fi
    done

    # Output based on format
    case "$format" in
        names-only)
            # Just command names, space-separated
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                echo "$name"
            done | tr '\n' ' '
            ;;

        detailed)
            # Name, synopsis, and description
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                local desc=$(tree_get_description "$cmd_path")
                local synopsis=$(tree_get "$cmd_path" "synopsis" 2>/dev/null)

                echo "$name"
                [[ -n "$synopsis" ]] && echo "  Usage: $synopsis"
                [[ -n "$desc" ]] && echo "  $desc"
                echo ""
            done
            ;;

        compact|*)
            # Name and description, aligned
            local max_width=0

            # Find longest command name for alignment
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                local len=${#name}
                [[ $len -gt $max_width ]] && max_width=$len
            done

            # Print commands with aligned descriptions
            for cmd_path in "${commands[@]}"; do
                local name="${cmd_path##*.}"
                local desc=$(tree_get_description "$cmd_path")

                if [[ -n "$desc" ]]; then
                    printf "%-${max_width}s  %s\n" "$name" "$desc"
                else
                    echo "$name"
                fi
            done
            ;;
    esac
}

# Generate space-separated action list from tree namespace
# Used to implement module_actions() from tree data
# Args: $1 = namespace path (e.g., "help.tdocs")
# Output: Space-separated command names
tree_to_module_actions() {
    local namespace="$1"

    if [[ -z "$namespace" ]]; then
        echo "Error: tree_to_module_actions requires namespace argument" >&2
        return 1
    fi

    tree_list_commands "$namespace" "names-only"
}

# Dispatch command based on handler metadata in tree
# Args: $1 = namespace (e.g., "help.tdocs")
#       $2 = command name (e.g., "init")
#       $@ = remaining args passed to handler
# Returns: Result of handler function
tree_dispatch() {
    local namespace="$1"
    local command="$2"
    shift 2

    if [[ -z "$namespace" || -z "$command" ]]; then
        echo "Error: tree_dispatch requires namespace and command arguments" >&2
        return 1
    fi

    local cmd_path="$namespace.$command"
    local handler=$(tree_get "$cmd_path" "handler" 2>/dev/null)

    if [[ -z "$handler" ]]; then
        echo "Error: No handler found for $cmd_path" >&2
        return 1
    fi

    # Check if handler function exists
    if ! declare -F "$handler" >/dev/null 2>&1; then
        echo "Error: Handler function '$handler' not found" >&2
        return 1
    fi

    # Dispatch to handler
    "$handler" "$@"
}

# Get all aliases for a command
# Args: $1 = command path (e.g., "help.tdocs.list")
# Output: Space-separated alias list
tree_get_aliases() {
    local path="$1"

    if [[ -z "$path" ]]; then
        return 1
    fi

    local aliases=$(tree_get "$path" "aliases" 2>/dev/null)
    echo "$aliases"
}

# Find command path by name or alias
# Args: $1 = namespace (e.g., "help.tdocs")
#       $2 = command name or alias (e.g., "ls" or "list")
# Output: Full command path
tree_find_command() {
    local namespace="$1"
    local search="$2"

    if [[ -z "$namespace" || -z "$search" ]]; then
        return 1
    fi

    local children=$(tree_children "$namespace" 2>/dev/null)

    for child in $children; do
        local type="${TREE_TYPE[$child]}"
        if [[ "$type" != "command" ]]; then
            continue
        fi

        local name="${child##*.}"

        # Direct match
        if [[ "$name" == "$search" ]]; then
            echo "$child"
            return 0
        fi

        # Alias match
        local aliases=$(tree_get_aliases "$child")
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

# Export all helper functions
export -f tree_get_description
export -f tree_list_commands
export -f tree_to_module_actions
export -f tree_dispatch
export -f tree_get_aliases
export -f tree_find_command
