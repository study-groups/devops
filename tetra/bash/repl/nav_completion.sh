#!/usr/bin/env bash
# REPL Nav Completion Integration
# Connects native REPL TAB completion with the nav help system

# Source dependencies
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Ensure nav system is loaded
if ! command -v nav_complete >/dev/null 2>&1; then
    source "$TETRA_SRC/bash/nav/nav.sh" 2>/dev/null || true
fi

# Parse REPL input and build nav path
# Usage: repl_nav_build_path <namespace> <input> <cursor_pos>
# Example: repl_nav_build_path "help.org" "switch pixe" 11
# Returns: "help.org.switch"
repl_nav_build_path() {
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

    # Build nav path from prefix words
    local nav_path="$namespace"

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
            nav_path="$nav_path.$word"
        done
    fi

    echo "$nav_path"
}

# Generate completions from nav based on current REPL state
# Usage: repl_nav_complete <namespace>
# Requires: REPL_INPUT and REPL_CURSOR_POS to be set (by tcurses_readline)
# Sets REPL_COMPLETION_WORDS and REPL_COMPLETION_HINTS directly (no stdout)
repl_nav_complete() {
    local nav_namespace="$1"

    # Get current input state from tcurses_readline
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    # Parse to get current word
    local word_info=$(_repl_get_current_word)
    IFS='|' read -r word_start word_end current_word <<< "$word_info"

    # Build nav path from input
    local nav_path
    nav_path=$(repl_nav_build_path "$nav_namespace" "$input" "$cursor")

    # Debug output if enabled
    if [[ "${REPL_NAV_DEBUG:-0}" == "1" ]]; then
        echo "[NAV] input='$input' cursor=$cursor" >&2
        echo "[NAV] current_word='$current_word'" >&2
        echo "[NAV] nav_path='$nav_path'" >&2
    fi

    # Clear arrays (must unset+redeclare to preserve global scope)
    REPL_COMPLETION_WORDS=()
    # Clear hints without creating local scope
    local key
    for key in "${!REPL_COMPLETION_HINTS[@]}"; do
        unset "REPL_COMPLETION_HINTS[$key]"
    done

    # Get completions using nav_complete_values (which handles both children and values)
    if command -v nav_complete_values >/dev/null 2>&1; then
        local nav_results
        nav_results=$(nav_complete_values "$nav_path" 2>/dev/null)
        if [[ -n "$nav_results" ]]; then
            # Filter by current word
            while IFS= read -r value; do
                if [[ -z "$current_word" ]] || [[ "$value" == "$current_word"* ]]; then
                    REPL_COMPLETION_WORDS+=("$value")
                    # Get description from nav metadata
                    local child_path="${nav_path}.${value}"
                    local help_text
                    help_text=$(nav_get "$child_path" "help" 2>/dev/null)
                    [[ -n "$help_text" ]] && REPL_COMPLETION_HINTS[$value]="$help_text"
                fi
            done <<< "$nav_results"
        fi
    fi

    # If at root or no nav matches, provide base commands
    if [[ ${#REPL_COMPLETION_WORDS[@]} -eq 0 ]] && [[ "$nav_path" == "$nav_namespace" ]]; then
        # Get root level commands
        local root_children
        root_children=$(nav_children "$nav_namespace" 2>/dev/null)
        for child in $root_children; do
            local leaf="${child##*.}"
            # Filter by current word
            if [[ -z "$current_word" ]] || [[ "$leaf" == "$current_word"* ]]; then
                REPL_COMPLETION_WORDS+=("$leaf")
                # Get description from nav metadata
                local help_text
                help_text=$(nav_get "$child" "help" 2>/dev/null)
                [[ -n "$help_text" ]] && REPL_COMPLETION_HINTS[$leaf]="$help_text"
            fi
        done
    fi
}

# Register nav-based completion generator for a REPL
# Usage: repl_register_nav_completion <nav_namespace> [fallback_generator]
# Example: repl_register_nav_completion "help.org" "_org_static_completions"
repl_register_nav_completion() {
    local nav_namespace="$1"
    local fallback_generator="${2:-}"

    # Validate nav namespace exists
    if ! nav_exists "$nav_namespace" 2>/dev/null; then
        echo "Warning: Nav namespace '$nav_namespace' not found" >&2
        echo "Nav completion may not work until nav tree is initialized" >&2
    fi

    # Create a generator function that calls repl_nav_complete directly
    # repl_nav_complete sets REPL_COMPLETION_WORDS and REPL_COMPLETION_HINTS
    local safe_name="${nav_namespace//\./_}"

    if [[ -n "$fallback_generator" ]]; then
        # With fallback: try nav first, then fallback
        eval "
        _repl_nav_generator_${safe_name}() {
            # Call directly - sets REPL_COMPLETION_WORDS and REPL_COMPLETION_HINTS
            repl_nav_complete \"$nav_namespace\"
            # If no results, try fallback
            if [[ \${#REPL_COMPLETION_WORDS[@]} -eq 0 ]] && command -v \"$fallback_generator\" >/dev/null 2>&1; then
                \"$fallback_generator\"
            fi
        }
        "
    else
        # Nav only - direct call
        eval "
        _repl_nav_generator_${safe_name}() {
            repl_nav_complete \"$nav_namespace\"
        }
        "
    fi

    # Register with REPL completion system
    repl_set_completion_generator "_repl_nav_generator_${safe_name}"

    if [[ "${REPL_NAV_DEBUG:-0}" == "1" ]]; then
        echo "[NAV] Registered nav completion for: $nav_namespace" >&2
        echo "[NAV] Generator function: _repl_nav_generator_${safe_name}" >&2
    fi
}

# Helper: Initialize nav if not already done
# Usage: repl_nav_ensure_init <init_function>
# Example: repl_nav_ensure_init "org_nav_init"
repl_nav_ensure_init() {
    local init_function="$1"

    if ! command -v "$init_function" >/dev/null 2>&1; then
        echo "Warning: Nav init function '$init_function' not found" >&2
        return 1
    fi

    # Call the init function (should be idempotent)
    "$init_function" 2>/dev/null || true
}

# Show available completions with descriptions (for help/preview)
# Usage: repl_nav_show_completions <namespace>
repl_nav_show_completions() {
    local nav_namespace="$1"
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    # Build nav path
    local nav_path
    nav_path=$(repl_nav_build_path "$nav_namespace" "$input" "$cursor")

    echo "Completions for: $nav_path"
    echo ""

    # Get children with metadata
    local children
    children=$(nav_children "$nav_path" 2>/dev/null)

    if [[ -z "$children" ]]; then
        echo "  (no completions available)"
        return 1
    fi

    for child in $children; do
        local leaf="${child##*.}"
        local type=$(nav_type "$child" 2>/dev/null)
        local title=$(nav_get "$child" "title" 2>/dev/null)
        local description=$(nav_get "$child" "description" 2>/dev/null)

        printf "  %-20s  %-12s  %s\n" "$leaf" "[$type]" "${title:-$description}"
    done
}

# Debug function: Show nav state
# Usage: repl_nav_debug <namespace>
repl_nav_debug() {
    local nav_namespace="$1"
    local input="${REPL_INPUT:-}"
    local cursor="${REPL_CURSOR_POS:-0}"

    echo "=== REPL Nav Debug ==="
    echo "Namespace: $nav_namespace"
    echo "Input: '$input'"
    echo "Cursor: $cursor"
    echo ""

    local nav_path
    nav_path=$(repl_nav_build_path "$nav_namespace" "$input" "$cursor")
    echo "Nav path: $nav_path"
    echo "Exists: $(nav_exists "$nav_path" 2>/dev/null && echo "yes" || echo "no")"
    echo ""

    echo "Children:"
    nav_children "$nav_path" 2>/dev/null | sed 's/^/  /'
    echo ""

    echo "Completions:"
    repl_nav_complete "$nav_namespace" | sed 's/^/  /'
}

# DEPRECATION SHIMS - emit warning then delegate to nav_ functions
repl_tree_build_path() {
    echo "DEPRECATED: repl_tree_build_path() - use repl_nav_build_path()" >&2
    repl_nav_build_path "$@"
}

repl_tree_complete() {
    echo "DEPRECATED: repl_tree_complete() - use repl_nav_complete()" >&2
    repl_nav_complete "$@"
}

repl_register_tree_completion() {
    echo "DEPRECATED: repl_register_tree_completion() - use repl_register_nav_completion()" >&2
    repl_register_nav_completion "$@"
}

repl_tree_ensure_init() {
    echo "DEPRECATED: repl_tree_ensure_init() - use repl_nav_ensure_init()" >&2
    repl_nav_ensure_init "$@"
}

repl_tree_show_completions() {
    echo "DEPRECATED: repl_tree_show_completions() - use repl_nav_show_completions()" >&2
    repl_nav_show_completions "$@"
}

repl_tree_debug() {
    echo "DEPRECATED: repl_tree_debug() - use repl_nav_debug()" >&2
    repl_nav_debug "$@"
}

# Export functions
export -f repl_nav_build_path
export -f repl_nav_complete
export -f repl_register_nav_completion
export -f repl_nav_ensure_init
export -f repl_nav_show_completions
export -f repl_nav_debug

# Export deprecated shims for backward compatibility
export -f repl_tree_build_path
export -f repl_tree_complete
export -f repl_register_tree_completion
export -f repl_tree_ensure_init
export -f repl_tree_show_completions
export -f repl_tree_debug
