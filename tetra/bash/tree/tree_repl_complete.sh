#!/usr/bin/env bash
# bash/tree/tree_repl_complete.sh - Tab completion for tree-based REPLs
# Provides intelligent tab completion using tree structure

# Source dependencies
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"

# Main completion function for tree-based REPL
# Usage in REPL: set TREE_REPL_NAMESPACE and call tree_repl_enable_completion
tree_repl_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local line="${COMP_LINE}"

    # Use TREE_REPL_NAMESPACE if set, otherwise use default
    local namespace="${TREE_REPL_NAMESPACE:-help}"

    # Build path from command words
    local path="$namespace"
    if [[ ${COMP_CWORD} -gt 0 ]]; then
        local i
        for ((i=0; i<${COMP_CWORD}; i++)); do
            local word="${COMP_WORDS[$i]}"
            # Skip flags and options
            [[ "$word" == -* ]] && continue
            # Skip if looks like a value (contains =)
            [[ "$word" == *=* ]] && continue
            # Add to path
            [[ -n "$word" ]] && path="$path.$word"
        done
    fi

    # Get completions from tree
    local completions
    completions=$(tree_complete "$path" "$cur" 2>/dev/null)

    # If no completions and we're at a leaf node, check for dynamic or static completions
    if [[ -z "$completions" ]] && tree_exists "$path"; then
        # Try dynamic completion function first
        local completion_fn=$(tree_get "$path" "completion_fn" 2>/dev/null)
        if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
            # Call dynamic completion function
            local dynamic_values
            dynamic_values=$("$completion_fn" 2>/dev/null | tr '\n' ' ')
            if [[ -n "$dynamic_values" ]]; then
                completions="$dynamic_values"
            fi
        fi

        # Fall back to static completion_values
        if [[ -z "$completions" ]]; then
            completions=$(tree_complete_values "$path" 2>/dev/null)
        fi
    fi

    # Convert to array for COMPREPLY
    local comp_array=()
    while IFS= read -r comp; do
        [[ -n "$comp" ]] && comp_array+=("$comp")
    done <<< "$completions"

    COMPREPLY=($(compgen -W "${comp_array[*]}" -- "$cur"))
}

# Readline-based completion for interactive REPL (bound to TAB)
# This shows completions inline rather than using bash completion
_tree_repl_complete() {
    local cur="${READLINE_LINE}"
    local namespace="${TREE_REPL_NAMESPACE:-help}"

    # Get current prompt if available
    local prompt="${TREE_REPL_PROMPT:-"> "}"
    if declare -f _tree_get_prompt >/dev/null 2>&1; then
        prompt="$(_tree_get_prompt)"
    fi

    # Parse current input into words
    local words=($cur)
    local word_count=${#words[@]}

    # Build tree path from words
    local path="$namespace"
    for word in "${words[@]}"; do
        [[ "$word" != -* && "$word" != *=* && -n "$word" ]] && path="$path.$word"
    done

    # Get current word being completed (last word, or empty)
    local current_word=""
    if [[ "$cur" =~ [[:space:]]$ ]]; then
        # Line ends with space - complete next level
        current_word=""
    else
        # Line doesn't end with space - complete current word
        current_word="${words[-1]}"
        # Remove current word from path
        path="${path%.*}"
    fi

    # Get completions from tree
    local completions
    completions=$(tree_complete "$path" "$current_word" 2>/dev/null)

    # Check if path exists
    if ! tree_exists "$path"; then
        # Path doesn't exist - no completions
        return
    fi

    # If no child completions and we're at a leaf, try dynamic/static completions
    if [[ -z "$completions" ]]; then
        # Try dynamic completion function first
        local completion_fn=$(tree_get "$path" "completion_fn" 2>/dev/null)
        if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
            # Call dynamic completion function
            completions=$("$completion_fn" "$current_word" 2>/dev/null)
        fi

        # Fall back to static completion_values
        if [[ -z "$completions" ]]; then
            local completion_values=$(tree_get "$path" "completion_values" 2>/dev/null)
            if [[ -n "$completion_values" ]]; then
                # Filter by current word
                if [[ -n "$current_word" ]]; then
                    local filtered=""
                    for val in $completion_values; do
                        [[ "$val" == "$current_word"* ]] && filtered="$filtered $val"
                    done
                    completions="${filtered# }"
                else
                    completions="$completion_values"
                fi
            fi
        fi
    fi

    # Convert to array
    local matches=()
    while IFS= read -r match; do
        [[ -n "$match" ]] && matches+=("$match")
    done <<< "$completions"

    # Handle completions
    if [[ ${#matches[@]} -eq 0 ]]; then
        # No matches - check if we're at a leaf
        local node_type=$(tree_type "$path")
        if [[ "$node_type" == "action" || "$node_type" == "command" ]]; then
            # At a leaf - show help
            local help_text=$(tree_get "$path" "help")
            if [[ -n "$help_text" ]]; then
                echo ""
                echo "  $help_text"
                echo ""
                echo -n "$prompt$cur"
            fi
        fi
    elif [[ ${#matches[@]} -eq 1 ]]; then
        # Single match - complete it
        if [[ -n "$current_word" ]]; then
            # Replace current word
            local base="${cur% *}"
            if [[ "$base" == "$cur" ]]; then
                READLINE_LINE="${matches[0]} "
            else
                READLINE_LINE="$base ${matches[0]} "
            fi
        else
            # Append to line
            READLINE_LINE="$cur${matches[0]} "
        fi
        READLINE_POINT=${#READLINE_LINE}
    else
        # Multiple matches - show them with descriptions
        echo ""
        echo "Available options:"
        echo ""

        for match in "${matches[@]}"; do
            local child_path="$path.$match"
            local child_type=$(tree_type "$child_path")
            local child_help=$(tree_get "$child_path" "help")
            local child_title=$(tree_get "$child_path" "title")

            # Format: name [type] - description
            printf "  %-16s " "$match"

            # Color code by type (if color functions available)
            if declare -f text_color >/dev/null 2>&1; then
                case "$child_type" in
                    category)
                        text_color "00AAFF"
                        printf "[%-10s]" "$child_type"
                        reset_color
                        ;;
                    action|command)
                        text_color "00FF88"
                        printf "[%-10s]" "$child_type"
                        reset_color
                        ;;
                    *)
                        printf "[%-10s]" "$child_type"
                        ;;
                esac
            else
                printf "[%-10s]" "$child_type"
            fi

            # Show help or title
            local desc="${child_help:-$child_title}"
            [[ -n "$desc" ]] && printf " %s" "$desc"
            echo ""
        done

        echo ""
        echo -n "$prompt$cur"
    fi
}

# Function to enable completion in tree-based REPL
# Usage: tree_repl_enable_completion [namespace]
tree_repl_enable_completion() {
    local namespace="${1:-help}"
    export TREE_REPL_NAMESPACE="$namespace"

    # Enable programmable completion
    set +o posix 2>/dev/null || true

    # Bind tab completion to work in readline
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true

    # Bind TAB to our custom completion function
    bind -x '"\t": _tree_repl_complete' 2>/dev/null || true
}

# Function to disable tree REPL completion
tree_repl_disable_completion() {
    # Restore default TAB behavior
    bind -r "\t" 2>/dev/null || true
    unset TREE_REPL_NAMESPACE
}

# Helper: Register completion function for specific tree namespace
# Usage: tree_register_completion <command> <namespace>
# Example: tree_register_completion "help" "help.tdoc"
tree_register_completion() {
    local command="$1"
    local namespace="$2"

    # Create wrapper function for this specific command
    eval "
    _${command}_tree_complete() {
        export TREE_REPL_NAMESPACE='$namespace'
        tree_repl_completion
    }
    "

    # Register with bash completion
    complete -F "_${command}_tree_complete" "$command" 2>/dev/null || true
}

# Export functions
export -f tree_repl_completion
export -f _tree_repl_complete
export -f tree_repl_enable_completion
export -f tree_repl_disable_completion
export -f tree_register_completion
