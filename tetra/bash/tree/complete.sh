#!/usr/bin/env bash
# bash/tree/complete.sh - COMPATIBILITY SHIM
#
# This file sources bash/nav/nav.sh which includes completion functions.
# tree_complete, tree_complete_values, tree_build_path_from_words all work.
#
# For new code, prefer: nav_complete, nav_complete_values, nav_build_path, nav_options

TREE_COMPLETE_SRC="${TREE_COMPLETE_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source core (which sources nav)
source "$TREE_COMPLETE_SRC/core.sh"

# Additional shims for functions that were in complete.sh

# Generate bash completion function (compatibility)
tree_generate_completion() {
    local namespace="$1"
    local command_name="$2"

    cat <<EOF
# Generated completion for $command_name
_${command_name}_complete() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local path="$namespace"

    if [[ \${COMP_CWORD} -gt 1 ]]; then
        for ((i=1; i<\${COMP_CWORD}; i++)); do
            [[ "\${COMP_WORDS[\$i]}" == -* ]] && continue
            path="\$path.\${COMP_WORDS[\$i]}"
        done
    fi

    COMPREPLY=(\$(compgen -W "\$(nav_complete "\$path" "\$cur")" -- "\$cur"))
}

complete -F _${command_name}_complete $command_name
EOF
}

# Interactive completion display (compatibility)
tree_complete_interactive() {
    local path=$(nav_normalize_path "$1")
    local children=$(nav_children "$path")

    if [[ -z "$children" ]]; then
        echo "No completions for: $path"
        return 1
    fi

    echo "Options for: $path"
    echo ""

    for child in $children; do
        local leaf="${child##*.}"
        local type=$(nav_type "$child")
        local title=$(nav_get "$child" "title")
        printf "  %-20s  [%-8s]  %s\n" "$leaf" "$type" "$title"
    done
}

# Completion by type (compatibility)
tree_complete_by_type() {
    local path=$(nav_normalize_path "$1")
    local type="$2"
    local current="${3:-}"

    for child in $(nav_children "$path" --type "$type"); do
        local leaf="${child##*.}"
        if [[ -z "$current" ]] || [[ "$leaf" == "$current"* ]]; then
            echo "$leaf"
        fi
    done
}

export -f tree_generate_completion tree_complete_interactive tree_complete_by_type
