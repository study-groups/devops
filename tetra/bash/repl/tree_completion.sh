#!/usr/bin/env bash
# REPL Tree Completion Integration
# Connects native REPL TAB completion with the tree/thelp system

# Source dependencies
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Ensure tree system is loaded
if ! command -v tree_complete >/dev/null 2>&1; then
    source "$TETRA_SRC/bash/tree/core.sh" 2>/dev/null || true
    source "$TETRA_SRC/bash/tree/complete.sh" 2>/dev/null || true
fi

# Parse REPL input and build tree path
# Usage: repl_tree_build_path <namespace> <input> <cursor_pos>
# Example: repl_tree_build_path "help.org" "switch pixe" 11
# Returns: "help.org.switch"
repl_tree_build_path() {
    local namespace="$1"
    local input="$2"
    local cursor_pos="$3"

    # Extract text before cursor
    local prefix="${input:0:$cursor_pos}"

    # Get current word boundaries
    local word_info=$(_repl_get_current_word)
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    # Get everything before the current word
    prefix="${input:0:$word_start}"

    # Clean up prefix: strip leading/trailing spaces
    prefix="${prefix## }"
    prefix="${prefix%% }"

    # Build tree path from prefix words
    local tree_path="$namespace"

    if [[ -n "$prefix" ]]; then
        # Split on spaces and build path
        local IFS=' '
        local words=($prefix)

        for word in "${words[@]}"; do
            # Skip empty words
            [[ -z "$word" ]] && continue

            # Skip shell metacharacters and special chars
            [[ "$word" == [!a-zA-Z0-9_-]* ]] && continue

            # Skip if it looks like an argument (has special chars)
            [[ "$word" == *:* || "$word" == */* || "$word" == *.* ]] && continue

            # Add to path
            tree_path="$tree_path.$word"
        done
    fi

    echo "$tree_path"
}

# Generate completions from tree based on current REPL state
# Usage: repl_tree_complete <namespace>
# Requires: REPL_INPUT and REPL_CURSOR_POS to be set (by tcurses_readline)
repl_tree_complete() {
    local tree_namespace="$1"

    # Get current input state from tcurses_readline
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    # Parse to get current word
    local word_info=$(_repl_get_current_word)
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    # Build tree path from input
    local tree_path
    tree_path=$(repl_tree_build_path "$tree_namespace" "$input" "$cursor")

    # Debug output if enabled
    if [[ "${REPL_TREE_DEBUG:-0}" == "1" ]]; then
        echo "[TREE] input='$input' cursor=$cursor" >&2
        echo "[TREE] current_word='$current_word'" >&2
        echo "[TREE] tree_path='$tree_path'" >&2
    fi

    # Get completions from tree
    local completions=()

    # 1. Get child nodes (subcommands)
    if command -v tree_complete >/dev/null 2>&1; then
        local tree_children
        tree_children=$(tree_complete "$tree_path" "$current_word" 2>/dev/null)
        if [[ -n "$tree_children" ]]; then
            completions+=($tree_children)
        fi
    fi

    # 2. Get dynamic/static values from current node
    if command -v tree_complete_values >/dev/null 2>&1; then
        local tree_values
        tree_values=$(tree_complete_values "$tree_path" 2>/dev/null)
        if [[ -n "$tree_values" ]]; then
            # Filter by current word
            for value in $tree_values; do
                if [[ -z "$current_word" ]] || [[ "$value" == "$current_word"* ]]; then
                    completions+=("$value")
                fi
            done
        fi
    fi

    # 3. If at root or no tree matches, provide base commands
    if [[ ${#completions[@]} -eq 0 ]] && [[ "$tree_path" == "$tree_namespace" ]]; then
        # Get root level commands
        local root_children
        root_children=$(tree_children "$tree_namespace" 2>/dev/null)
        for child in $root_children; do
            local leaf="${child##*.}"
            # Filter by current word
            if [[ -z "$current_word" ]] || [[ "$leaf" == "$current_word"* ]]; then
                completions+=("$leaf")
            fi
        done
    fi

    # Output completions (one per line)
    printf '%s\n' "${completions[@]}"
}

# Register tree-based completion generator for a REPL
# Usage: repl_register_tree_completion <tree_namespace> [fallback_generator]
# Example: repl_register_tree_completion "help.org" "_org_static_completions"
repl_register_tree_completion() {
    local tree_namespace="$1"
    local fallback_generator="${2:-}"

    # Validate tree namespace exists
    if ! tree_exists "$tree_namespace" 2>/dev/null; then
        echo "Warning: Tree namespace '$tree_namespace' not found" >&2
        echo "Tree completion may not work until tree is initialized" >&2
    fi

    # Create a generator function that wraps tree completion
    local safe_name="${tree_namespace//\./_}"

    if [[ -n "$fallback_generator" ]]; then
        # With fallback: try tree first, then fallback
        eval "
        _repl_tree_generator_${safe_name}() {
            local tree_completions
            tree_completions=\$(repl_tree_complete \"$tree_namespace\" 2>/dev/null)

            if [[ -n \"\$tree_completions\" ]]; then
                echo \"\$tree_completions\"
            elif command -v \"$fallback_generator\" >/dev/null 2>&1; then
                \"$fallback_generator\"
            fi
        }
        "
    else
        # Tree only
        eval "
        _repl_tree_generator_${safe_name}() {
            repl_tree_complete \"$tree_namespace\"
        }
        "
    fi

    # Register with REPL completion system
    repl_set_completion_generator "_repl_tree_generator_${safe_name}"

    if [[ "${REPL_TREE_DEBUG:-0}" == "1" ]]; then
        echo "[TREE] Registered tree completion for: $tree_namespace" >&2
        echo "[TREE] Generator function: _repl_tree_generator_${safe_name}" >&2
    fi
}

# Helper: Initialize tree if not already done
# Usage: repl_tree_ensure_init <init_function>
# Example: repl_tree_ensure_init "org_tree_init"
repl_tree_ensure_init() {
    local init_function="$1"

    if ! command -v "$init_function" >/dev/null 2>&1; then
        echo "Warning: Tree init function '$init_function' not found" >&2
        return 1
    fi

    # Call the init function (should be idempotent)
    "$init_function" 2>/dev/null || true
}

# Show available completions with descriptions (for help/preview)
# Usage: repl_tree_show_completions <namespace>
repl_tree_show_completions() {
    local tree_namespace="$1"
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    # Build tree path
    local tree_path
    tree_path=$(repl_tree_build_path "$tree_namespace" "$input" "$cursor")

    echo "Completions for: $tree_path"
    echo ""

    # Get children with metadata
    local children
    children=$(tree_children "$tree_path" 2>/dev/null)

    if [[ -z "$children" ]]; then
        echo "  (no completions available)"
        return 1
    fi

    for child in $children; do
        local leaf="${child##*.}"
        local type=$(tree_type "$child" 2>/dev/null)
        local title=$(tree_get "$child" "title" 2>/dev/null)
        local description=$(tree_get "$child" "description" 2>/dev/null)

        printf "  %-20s  %-12s  %s\n" "$leaf" "[$type]" "${title:-$description}"
    done
}

# Debug function: Show tree state
# Usage: repl_tree_debug <namespace>
repl_tree_debug() {
    local tree_namespace="$1"
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    echo "=== REPL Tree Debug ==="
    echo "Namespace: $tree_namespace"
    echo "Input: '$input'"
    echo "Cursor: $cursor"
    echo ""

    local tree_path
    tree_path=$(repl_tree_build_path "$tree_namespace" "$input" "$cursor")
    echo "Tree path: $tree_path"
    echo "Exists: $(tree_exists "$tree_path" 2>/dev/null && echo "yes" || echo "no")"
    echo ""

    echo "Children:"
    tree_children "$tree_path" 2>/dev/null | sed 's/^/  /'
    echo ""

    echo "Completions:"
    repl_tree_complete "$tree_namespace" | sed 's/^/  /'
}

# Export functions
export -f repl_tree_build_path
export -f repl_tree_complete
export -f repl_register_tree_completion
export -f repl_tree_ensure_init
export -f repl_tree_show_completions
export -f repl_tree_debug
