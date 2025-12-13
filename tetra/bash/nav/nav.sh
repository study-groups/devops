#!/usr/bin/env bash
# nav.sh - Navigation/namespace system for commands and help
#
# A path-based registry for defining command structures with metadata.
# Supports tab-completion and help generation from the same data.
#
# Usage: source $TETRA_SRC/bash/nav/nav.sh
#
# Example:
#   nav_define "myapp.config.set" command title="Set value"
#   nav_options "myapp.config"     # → set get show
#   nav_complete "myapp" "con"     # → config

NAV_SRC="${NAV_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# =============================================================================
# STORAGE - Single global namespace
# =============================================================================

declare -gA NAV_TYPE        # path -> node_type (command, category, option, flag)
declare -gA NAV_PARENT      # path -> parent_path
declare -gA NAV_CHILDREN    # path -> "child1 child2 child3"
declare -gA NAV_META        # path.key -> value

# =============================================================================
# PATH UTILITIES
# =============================================================================

# Normalize path to dot notation
nav_normalize_path() {
    local path="$1"
    path="${path//\//\.}"
    path="${path#.}"
    path="${path%.}"
    echo "$path"
}

# Get parent path
_nav_parent_path() {
    local path="$1"
    local parent="${path%.*}"
    [[ "$parent" == "$path" ]] && echo "" || echo "$parent"
}

# =============================================================================
# CORE API
# =============================================================================

# Define a node in the navigation tree
# Usage: nav_define <path> <type> [key=value...]
nav_define() {
    local original_path="$1"
    local type="$2"
    shift 2

    local path=$(nav_normalize_path "$original_path")

    # Set node type
    NAV_TYPE["$path"]="$type"

    # Auto-create parent chain
    local current_path="$path"
    local parent=$(_nav_parent_path "$current_path")
    while [[ -n "$parent" ]]; do
        # Create parent if missing
        [[ -z "${NAV_TYPE[$parent]}" ]] && NAV_TYPE["$parent"]="category"

        # Add to parent's children
        local children="${NAV_CHILDREN[$parent]}"
        local leaf="${current_path##*.}"
        if [[ ! " $children " =~ " $leaf " ]]; then
            NAV_CHILDREN["$parent"]="${children:+$children }$leaf"
        fi

        # Set parent relationship
        NAV_PARENT["$current_path"]="$parent"

        # Move up
        current_path="$parent"
        parent=$(_nav_parent_path "$current_path")
    done

    # Store metadata
    while [[ $# -gt 0 ]]; do
        if [[ "$1" =~ ^([^=]+)=(.*)$ ]]; then
            NAV_META["$path.${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
        fi
        shift
    done
}

# Get node metadata
# Usage: nav_get <path> [key]
nav_get() {
    local path=$(nav_normalize_path "$1")
    local key="$2"

    if [[ -z "$key" ]]; then
        # All metadata
        local prefix="$path."
        for k in "${!NAV_META[@]}"; do
            [[ "$k" == "$prefix"* ]] && echo "${k#$prefix}=${NAV_META[$k]}"
        done
    else
        echo "${NAV_META[$path.$key]}"
    fi
}

# Get node type
nav_type() {
    local path=$(nav_normalize_path "$1")
    echo "${NAV_TYPE[$path]}"
}

# Check if node exists
nav_exists() {
    local path=$(nav_normalize_path "$1")
    [[ -n "${NAV_TYPE[$path]}" ]]
}

# Get parent
nav_parent() {
    local path=$(nav_normalize_path "$1")
    echo "${NAV_PARENT[$path]}"
}

# =============================================================================
# NAVIGATION / LISTING
# =============================================================================

# Get child paths (full paths)
# Usage: nav_children <path> [--type TYPE]
nav_children() {
    local path=$(nav_normalize_path "$1")
    shift

    local filter_type=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type) filter_type="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    local children="${NAV_CHILDREN[$path]}"
    [[ -z "$children" ]] && return 0

    for child_name in $children; do
        local child_path="$path.$child_name"
        if [[ -z "$filter_type" ]] || [[ "${NAV_TYPE[$child_path]}" == "$filter_type" ]]; then
            echo "$child_path"
        fi
    done
}

# Get child names only (for completion)
# Usage: nav_options <path> [prefix]
nav_options() {
    local path=$(nav_normalize_path "$1")
    local prefix="${2:-}"

    local children="${NAV_CHILDREN[$path]}"
    [[ -z "$children" ]] && return 0

    for name in $children; do
        if [[ -z "$prefix" ]] || [[ "$name" == "$prefix"* ]]; then
            echo "$name"
        fi
    done
}

# =============================================================================
# TAB COMPLETION
# =============================================================================

# Generate completions for bash
# Usage: nav_complete <path> [current_word]
nav_complete() {
    local path=$(nav_normalize_path "$1")
    local current="${2:-}"

    nav_options "$path" "$current"
}

# Get completion values from metadata
# Usage: nav_complete_values <path>
nav_complete_values() {
    local path=$(nav_normalize_path "$1")

    # Check for completion_values metadata
    local values="${NAV_META[$path.completion_values]}"
    if [[ -n "$values" ]]; then
        echo "$values" | tr ',' '\n'
        return 0
    fi

    # Check for completion_fn metadata
    local fn="${NAV_META[$path.completion_fn]}"
    if [[ -n "$fn" ]] && declare -F "$fn" >/dev/null 2>&1; then
        "$fn"
        return 0
    fi

    # Default: children
    nav_options "$path"
}

# Build path from COMP_WORDS (for bash completion functions)
# Usage: nav_build_path <namespace>
nav_build_path() {
    local namespace="$1"
    local path="$namespace"

    if [[ ${COMP_CWORD} -gt 1 ]]; then
        for ((i=1; i<COMP_CWORD; i++)); do
            local word="${COMP_WORDS[$i]}"
            [[ "$word" == -* ]] && continue
            path="$path.$word"
        done
    fi
    echo "$path"
}

# =============================================================================
# TRAVERSAL
# =============================================================================

# Get breadcrumb path from root
nav_breadcrumb() {
    local path=$(nav_normalize_path "$1")
    local crumbs=()

    while [[ -n "$path" ]]; do
        crumbs=("$path" "${crumbs[@]}")
        path="${NAV_PARENT[$path]}"
    done

    printf '%s\n' "${crumbs[@]}"
}

# Get all descendants
# Usage: nav_descendants <path> [--type TYPE]
nav_descendants() {
    local path=$(nav_normalize_path "$1")
    shift
    local filter_type=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type) filter_type="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    _nav_descendants_recursive "$path" "$filter_type"
}

_nav_descendants_recursive() {
    local path="$1"
    local filter_type="$2"

    local children
    children=$(nav_children "$path")

    for child in $children; do
        if [[ -z "$filter_type" ]] || [[ "${NAV_TYPE[$child]}" == "$filter_type" ]]; then
            echo "$child"
        fi
        _nav_descendants_recursive "$child" "$filter_type"
    done
}

# =============================================================================
# QUERY
# =============================================================================

# Find nodes matching criteria
# Usage: nav_query [--type TYPE] [--has KEY] [--where KEY=VALUE]
nav_query() {
    local filter_type="" has_key="" where_key="" where_value=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type) filter_type="$2"; shift 2 ;;
            --has) has_key="$2"; shift 2 ;;
            --where)
                [[ "$2" =~ ^([^=]+)=(.*)$ ]] && {
                    where_key="${BASH_REMATCH[1]}"
                    where_value="${BASH_REMATCH[2]}"
                }
                shift 2 ;;
            *) shift ;;
        esac
    done

    for path in "${!NAV_TYPE[@]}"; do
        local match=1

        [[ -n "$filter_type" && "${NAV_TYPE[$path]}" != "$filter_type" ]] && match=0
        [[ $match -eq 1 && -n "$has_key" && -z "${NAV_META[$path.$has_key]}" ]] && match=0
        [[ $match -eq 1 && -n "$where_key" && "${NAV_META[$path.$where_key]}" != "$where_value" ]] && match=0

        [[ $match -eq 1 ]] && echo "$path"
    done
}

# =============================================================================
# DELETE
# =============================================================================

nav_delete() {
    local path=$(nav_normalize_path "$1")
    local recursive=0
    [[ "$2" == "--recursive" ]] && recursive=1

    # Delete children if recursive
    if [[ $recursive -eq 1 ]]; then
        for child in $(nav_children "$path"); do
            nav_delete "$child" --recursive
        done
    fi

    # Remove from parent's children
    local parent="${NAV_PARENT[$path]}"
    if [[ -n "$parent" ]]; then
        local leaf="${path##*.}"
        NAV_CHILDREN["$parent"]="${NAV_CHILDREN[$parent]//$leaf/}"
        NAV_CHILDREN["$parent"]=$(echo "${NAV_CHILDREN[$parent]}" | tr -s ' ')
    fi

    # Remove node
    unset NAV_TYPE["$path"]
    unset NAV_PARENT["$path"]
    unset NAV_CHILDREN["$path"]

    # Remove metadata
    for k in "${!NAV_META[@]}"; do
        [[ "$k" == "$path."* ]] && unset NAV_META["$k"]
    done
}

# =============================================================================
# DISPLAY
# =============================================================================

# Show colored options table for a path
# Usage: nav_show <path>
nav_show() {
    local path=$(nav_normalize_path "$1")
    local children="${NAV_CHILDREN[$path]}"

    if [[ -z "$children" ]]; then
        echo "No options for: ${path##*.}"
        return 1
    fi

    # Colors - try tds, fallback to ansi, fallback to none
    local c_cmd="" c_cat="" c_dim="" c_reset=""
    if declare -F tds_text_color >/dev/null 2>&1; then
        c_cmd=$(tds_text_color "interactive.success" 2>/dev/null; echo -n) || true
        c_cat=$(tds_text_color "content.link" 2>/dev/null; echo -n) || true
        c_dim=$(tds_text_color "text.secondary" 2>/dev/null; echo -n) || true
        c_reset=$(reset_color 2>/dev/null; echo -n) || true
    elif [[ -t 1 ]]; then
        # Only use ansi if stdout is a terminal
        c_cmd=$'\033[32m'
        c_cat=$'\033[36m'
        c_dim=$'\033[90m'
        c_reset=$'\033[0m'
    fi

    for name in $children; do
        local child_path="$path.$name"
        local type="${NAV_TYPE[$child_path]:-}"
        local title="${NAV_META[$child_path.title]:-}"
        local help="${NAV_META[$child_path.help]:-}"
        local desc="${title:-$help}"

        # Color by type
        case "$type" in
            command|action) printf "  %s%-14s%s" "$c_cmd" "$name" "$c_reset" ;;
            category)       printf "  %s%-14s%s" "$c_cat" "$name" "$c_reset" ;;
            *)              printf "  %-14s" "$name" ;;
        esac

        # Description
        [[ -n "$desc" ]] && printf "%s%s%s" "$c_dim" "$desc" "$c_reset"
        echo
    done
}

# =============================================================================
# TREE_* COMPATIBILITY SHIMS
# =============================================================================
# These allow existing code using tree_* to keep working

tree_normalize_path() { nav_normalize_path "$@"; }
tree_path_parent() { _nav_parent_path "$@"; }
tree_insert() { nav_define "$@"; }
tree_get() { nav_get "$@"; }
tree_type() { nav_type "$@"; }
tree_exists() { nav_exists "$@"; }
tree_parent() { nav_parent "$@"; }
tree_children() { nav_children "$@"; }
tree_complete() { nav_complete "$@"; }
tree_complete_values() { nav_complete_values "$@"; }
tree_build_path_from_words() { nav_build_path "$@"; }
tree_breadcrumb() { nav_breadcrumb "$@"; }
tree_descendants() { nav_descendants "$@"; }
tree_query() { nav_query "$@"; }
tree_delete() { nav_delete "$@"; }

# Expose old globals as aliases
declare -gn TREE_TYPE=NAV_TYPE
declare -gn TREE_PARENT=NAV_PARENT
declare -gn TREE_CHILDREN=NAV_CHILDREN
declare -gn TREE_META=NAV_META

# =============================================================================
# EXPORTS
# =============================================================================

export -f nav_normalize_path nav_define nav_get nav_type nav_exists nav_parent
export -f nav_children nav_options nav_complete nav_complete_values nav_build_path
export -f nav_breadcrumb nav_descendants nav_query nav_delete nav_show
export -f _nav_parent_path _nav_descendants_recursive

# Tree compatibility exports
export -f tree_normalize_path tree_path_parent tree_insert tree_get tree_type
export -f tree_exists tree_parent tree_children tree_complete tree_complete_values
export -f tree_build_path_from_words tree_breadcrumb tree_descendants tree_query tree_delete
