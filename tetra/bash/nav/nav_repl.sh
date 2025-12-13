#!/usr/bin/env bash
# nav/nav_repl.sh - Tab completion for nav-based REPLs
# Provides intelligent tab completion using nav tree structure

NAV_REPL_SRC="${NAV_REPL_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source dependencies
source "$NAV_REPL_SRC/nav.sh"

# Main completion function for nav-based REPL
# Usage in REPL: set NAV_REPL_NAMESPACE and call nav_repl_enable_completion
nav_repl_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local line="${COMP_LINE}"

    # Use NAV_REPL_NAMESPACE if set, otherwise use default
    local namespace="${NAV_REPL_NAMESPACE:-${TREE_REPL_NAMESPACE:-help}}"

    # Build path from command words
    local path="$namespace"
    if [[ ${COMP_CWORD} -gt 0 ]]; then
        local i
        for ((i=0; i<${COMP_CWORD}; i++)); do
            local word="${COMP_WORDS[$i]}"
            [[ "$word" == -* ]] && continue
            [[ "$word" == *=* ]] && continue
            [[ -n "$word" ]] && path="$path.$word"
        done
    fi

    # Get completions from nav
    local completions
    completions=$(nav_complete "$path" "$cur" 2>/dev/null)

    # If no completions and we're at a leaf node, check for dynamic or static completions
    if [[ -z "$completions" ]] && nav_exists "$path"; then
        local completion_fn=$(nav_get "$path" "completion_fn" 2>/dev/null)
        if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
            local dynamic_values
            dynamic_values=$("$completion_fn" 2>/dev/null | tr '\n' ' ')
            if [[ -n "$dynamic_values" ]]; then
                completions="$dynamic_values"
            fi
        fi

        if [[ -z "$completions" ]]; then
            completions=$(nav_complete_values "$path" 2>/dev/null)
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
_nav_repl_complete() {
    local cur="${READLINE_LINE}"
    local namespace="${NAV_REPL_NAMESPACE:-${TREE_REPL_NAMESPACE:-help}}"

    local prompt="${NAV_REPL_PROMPT:-${TREE_REPL_PROMPT:-"> "}}"
    if declare -f _nav_get_prompt >/dev/null 2>&1; then
        prompt="$(_nav_get_prompt)"
    elif declare -f _tree_get_prompt >/dev/null 2>&1; then
        prompt="$(_tree_get_prompt)"
    fi

    # Parse current input into words
    local words=($cur)
    local word_count=${#words[@]}

    # Build nav path from words
    local path="$namespace"
    for word in "${words[@]}"; do
        [[ "$word" != -* && "$word" != *=* && -n "$word" ]] && path="$path.$word"
    done

    # Get current word being completed
    local current_word=""
    if [[ "$cur" =~ [[:space:]]$ ]]; then
        current_word=""
    else
        current_word="${words[-1]}"
        path="${path%.*}"
    fi

    # Get completions from nav
    local completions
    completions=$(nav_complete "$path" "$current_word" 2>/dev/null)

    if ! nav_exists "$path"; then
        return
    fi

    # If no child completions and we're at a leaf, try dynamic/static completions
    if [[ -z "$completions" ]]; then
        local completion_fn=$(nav_get "$path" "completion_fn" 2>/dev/null)
        if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
            completions=$("$completion_fn" "$current_word" 2>/dev/null)
        fi

        if [[ -z "$completions" ]]; then
            local completion_values=$(nav_get "$path" "completion_values" 2>/dev/null)
            if [[ -n "$completion_values" ]]; then
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
        local node_type=$(nav_type "$path")
        if [[ "$node_type" == "action" || "$node_type" == "command" ]]; then
            local help_text=$(nav_get "$path" "help")
            if [[ -n "$help_text" ]]; then
                echo ""
                echo "  $help_text"
                echo ""
                echo -n "$prompt$cur"
            fi
        fi
    elif [[ ${#matches[@]} -eq 1 ]]; then
        if [[ -n "$current_word" ]]; then
            local base="${cur% *}"
            if [[ "$base" == "$cur" ]]; then
                READLINE_LINE="${matches[0]} "
            else
                READLINE_LINE="$base ${matches[0]} "
            fi
        else
            READLINE_LINE="$cur${matches[0]} "
        fi
        READLINE_POINT=${#READLINE_LINE}
    else
        echo ""
        echo "Available options:"
        echo ""

        for match in "${matches[@]}"; do
            local child_path="$path.$match"
            local child_type=$(nav_type "$child_path")
            local child_help=$(nav_get "$child_path" "help")
            local child_title=$(nav_get "$child_path" "title")

            printf "  %-16s " "$match"

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

            local desc="${child_help:-$child_title}"
            [[ -n "$desc" ]] && printf " %s" "$desc"
            echo ""
        done

        echo ""
        echo -n "$prompt$cur"
    fi
}

# Enable completion in nav-based REPL
nav_repl_enable_completion() {
    local namespace="${1:-help}"
    export NAV_REPL_NAMESPACE="$namespace"
    export TREE_REPL_NAMESPACE="$namespace"  # backwards compat

    set +o posix 2>/dev/null || true

    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true

    bind -x '"\t": _nav_repl_complete' 2>/dev/null || true
}

# Disable nav REPL completion
nav_repl_disable_completion() {
    bind -r "\t" 2>/dev/null || true
    unset NAV_REPL_NAMESPACE
    unset TREE_REPL_NAMESPACE
}

# Register completion function for specific nav namespace
nav_register_completion() {
    local command="$1"
    local namespace="$2"

    eval "
    _${command}_nav_complete() {
        export NAV_REPL_NAMESPACE='$namespace'
        export TREE_REPL_NAMESPACE='$namespace'
        nav_repl_completion
    }
    "

    complete -F "_${command}_nav_complete" "$command" 2>/dev/null || true
}

# =============================================================================
# TREE_* COMPATIBILITY SHIMS
# =============================================================================

tree_repl_completion() { nav_repl_completion "$@"; }
_tree_repl_complete() { _nav_repl_complete "$@"; }
tree_repl_enable_completion() { nav_repl_enable_completion "$@"; }
tree_repl_disable_completion() { nav_repl_disable_completion "$@"; }
tree_register_completion() { nav_register_completion "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f nav_repl_completion _nav_repl_complete
export -f nav_repl_enable_completion nav_repl_disable_completion
export -f nav_register_completion
export -f tree_repl_completion _tree_repl_complete
export -f tree_repl_enable_completion tree_repl_disable_completion
export -f tree_register_completion
