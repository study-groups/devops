#!/usr/bin/env bash
# bash/tree/core.sh - Minimal tree data structure
# Generic hierarchical tree using associative arrays

# Global tree storage (single tree, namespaced paths)
declare -gA TREE_TYPE        # path -> node_type
declare -gA TREE_PARENT      # path -> parent_path
declare -gA TREE_CHILDREN    # path -> "child1 child2 child3"
declare -gA TREE_META        # path.key -> value

# Path utilities

# Normalize path to dot notation
tree_normalize_path() {
    local path="$1"
    # Convert slash to dot
    path="${path//\//\.}"
    # Remove leading/trailing dots
    path="${path#.}"
    path="${path%.}"
    echo "$path"
}

# Get parent path from a path
tree_path_parent() {
    local path="$1"
    local parent="${path%.*}"

    # If no dot, it's a root node (no parent)
    [[ "$parent" == "$path" ]] && echo "" || echo "$parent"
}

# Split path into segments
tree_path_segments() {
    local path="$1"
    echo "$path" | tr '.' '\n'
}

# Core operations

# Insert a node into the tree
# Usage: tree_insert <path> <type> [key=value...]
tree_insert() {
    local original_path="$1"
    local type="$2"
    shift 2

    # Normalize path
    local path=$(tree_normalize_path "$original_path")

    # Set node type
    TREE_TYPE["$path"]="$type"

    # Auto-create parent chain
    local current_path="$path"
    local parent=$(tree_path_parent "$current_path")
    while [[ -n "$parent" ]]; do
        # Create parent if it doesn't exist
        if [[ -z "${TREE_TYPE[$parent]}" ]]; then
            TREE_TYPE["$parent"]="category"
        fi

        # Add this path to parent's children (if not already there)
        local children="${TREE_CHILDREN[$parent]}"
        local leaf="${current_path##*.}"
        if [[ ! " $children " =~ " $leaf " ]]; then
            TREE_CHILDREN["$parent"]="${children:+$children }$leaf"
        fi

        # Set parent relationship
        TREE_PARENT["$current_path"]="$parent"

        # Move up the tree
        current_path="$parent"
        parent=$(tree_path_parent "$current_path")
    done

    # Store metadata (key=value pairs)
    while [[ $# -gt 0 ]]; do
        local kv="$1"
        if [[ "$kv" =~ ^([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            TREE_META["$path.$key"]="$value"
        fi
        shift
    done
}

# Get node metadata
# Usage: tree_get <path> [key]
tree_get() {
    local path="$1"
    local key="$2"

    path=$(tree_normalize_path "$path")

    if [[ -z "$key" ]]; then
        # Get all metadata for node
        local prefix="$path."
        local result=""
        for k in "${!TREE_META[@]}"; do
            if [[ "$k" == "$prefix"* ]]; then
                local meta_key="${k#$prefix}"
                result+="$meta_key=${TREE_META[$k]}"$'\n'
            fi
        done
        echo -n "$result"
    else
        # Get specific key
        echo "${TREE_META[$path.$key]}"
    fi
}

# Get node type
# Usage: tree_type <path>
tree_type() {
    local path=$(tree_normalize_path "$1")
    echo "${TREE_TYPE[$path]}"
}

# Get immediate children of a node
# Usage: tree_children <path> [--type TYPE] [--limit N]
tree_children() {
    local path=$(tree_normalize_path "$1")
    shift

    local filter_type=""
    local limit=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type)
                filter_type="$2"
                shift 2
                ;;
            --limit)
                limit="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    local children="${TREE_CHILDREN[$path]}"
    [[ -z "$children" ]] && return 0

    local count=0
    local result=()

    for child_name in $children; do
        local child_path="$path.$child_name"
        local child_type="${TREE_TYPE[$child_path]}"

        # Apply type filter if specified
        if [[ -n "$filter_type" ]]; then
            # Support comma-separated types
            local match=0
            IFS=',' read -ra types <<< "$filter_type"
            for t in "${types[@]}"; do
                if [[ "$child_type" == "$t" ]]; then
                    match=1
                    break
                fi
            done
            [[ $match -eq 0 ]] && continue
        fi

        result+=("$child_path")
        ((count++))

        # Apply limit if specified
        [[ -n "$limit" ]] && [[ $count -ge $limit ]] && break
    done

    # Output results
    printf '%s\n' "${result[@]}"
}

# Get parent of a node
# Usage: tree_parent <path>
tree_parent() {
    local path=$(tree_normalize_path "$1")
    echo "${TREE_PARENT[$path]}"
}

# Check if node exists
# Usage: tree_exists <path>
tree_exists() {
    local path=$(tree_normalize_path "$1")
    [[ -n "${TREE_TYPE[$path]}" ]]
}

# Delete a node
# Usage: tree_delete <path> [--recursive]
tree_delete() {
    local path=$(tree_normalize_path "$1")
    local recursive=0

    [[ "$2" == "--recursive" ]] && recursive=1

    # Delete children if recursive
    if [[ $recursive -eq 1 ]]; then
        local children
        children=$(tree_children "$path")
        for child in $children; do
            tree_delete "$child" --recursive
        done
    fi

    # Remove from parent's children list
    local parent="${TREE_PARENT[$path]}"
    if [[ -n "$parent" ]]; then
        local child_name="${path##*.}"
        local children="${TREE_CHILDREN[$parent]}"
        TREE_CHILDREN["$parent"]="${children//$child_name/}"
        # Clean up extra spaces
        TREE_CHILDREN["$parent"]=$(echo "${TREE_CHILDREN[$parent]}" | tr -s ' ')
    fi

    # Remove node data
    unset TREE_TYPE["$path"]
    unset TREE_PARENT["$path"]
    unset TREE_CHILDREN["$path"]

    # Remove metadata
    local prefix="$path."
    for k in "${!TREE_META[@]}"; do
        if [[ "$k" == "$prefix"* ]]; then
            unset TREE_META["$k"]
        fi
    done
}

# Traversal operations

# Get breadcrumb path from root to node
# Usage: tree_breadcrumb <path>
tree_breadcrumb() {
    local path=$(tree_normalize_path "$1")
    local crumbs=()

    while [[ -n "$path" ]]; do
        crumbs=("$path" "${crumbs[@]}")
        path="${TREE_PARENT[$path]}"
    done

    printf '%s\n' "${crumbs[@]}"
}

# Get all descendants of a node (recursive)
# Usage: tree_descendants <path> [--depth N] [--type TYPE]
tree_descendants() {
    local path=$(tree_normalize_path "$1")
    shift

    local max_depth=""
    local filter_type=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --depth)
                max_depth="$2"
                shift 2
                ;;
            --type)
                filter_type="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    _tree_descendants_recursive "$path" 0 "$max_depth" "$filter_type"
}

_tree_descendants_recursive() {
    local path="$1"
    local current_depth="$2"
    local max_depth="$3"
    local filter_type="$4"

    # Check depth limit
    if [[ -n "$max_depth" ]] && [[ $current_depth -ge $max_depth ]]; then
        return
    fi

    local children
    if [[ -n "$filter_type" ]]; then
        children=$(tree_children "$path" --type "$filter_type")
    else
        children=$(tree_children "$path")
    fi

    for child in $children; do
        echo "$child"
        _tree_descendants_recursive "$child" $((current_depth + 1)) "$max_depth" "$filter_type"
    done
}

# Query operations

# Find nodes matching criteria
# Usage: tree_query [--type TYPE] [--has KEY] [--where KEY=VALUE] [--limit N]
tree_query() {
    local filter_type=""
    local has_key=""
    local where_key=""
    local where_value=""
    local limit=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type)
                filter_type="$2"
                shift 2
                ;;
            --has)
                has_key="$2"
                shift 2
                ;;
            --where)
                if [[ "$2" =~ ^([^=]+)=(.*)$ ]]; then
                    where_key="${BASH_REMATCH[1]}"
                    where_value="${BASH_REMATCH[2]}"
                fi
                shift 2
                ;;
            --limit)
                limit="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    local count=0
    local results=()

    for path in "${!TREE_TYPE[@]}"; do
        local match=1

        # Type filter
        if [[ -n "$filter_type" ]] && [[ "${TREE_TYPE[$path]}" != "$filter_type" ]]; then
            match=0
        fi

        # Has key filter
        if [[ $match -eq 1 ]] && [[ -n "$has_key" ]] && [[ -z "${TREE_META[$path.$has_key]}" ]]; then
            match=0
        fi

        # Where filter
        if [[ $match -eq 1 ]] && [[ -n "$where_key" ]]; then
            if [[ "${TREE_META[$path.$where_key]}" != "$where_value" ]]; then
                match=0
            fi
        fi

        if [[ $match -eq 1 ]]; then
            results+=("$path")
            ((count++))
            [[ -n "$limit" ]] && [[ $count -ge $limit ]] && break
        fi
    done

    printf '%s\n' "${results[@]}"
}

# Export functions
export -f tree_normalize_path
export -f tree_path_parent
export -f tree_path_segments
export -f tree_insert
export -f tree_get
export -f tree_type
export -f tree_children
export -f tree_parent
export -f tree_exists
export -f tree_delete
export -f tree_breadcrumb
export -f tree_descendants
export -f tree_query
export -f _tree_descendants_recursive
