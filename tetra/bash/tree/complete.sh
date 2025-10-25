#!/usr/bin/env bash
# bash/tree/complete.sh - Tab-completion from tree structure

# Source core if not already loaded
if ! declare -F tree_children >/dev/null 2>&1; then
    source "${BASH_SOURCE[0]%/*}/core.sh"
fi

# Generate completions for a tree path
# Usage: tree_complete <current_path> [current_word]
tree_complete() {
    local path="$1"
    local current_word="${2:-}"

    # Normalize path
    path=$(tree_normalize_path "$path")

    # Get children of this path
    local children
    children=$(tree_children "$path")

    # Extract just the last segment (leaf name) for completion
    local completions=()
    for child in $children; do
        local leaf="${child##*.}"
        completions+=("$leaf")
    done

    # Filter by current word if provided
    if [[ -n "$current_word" ]]; then
        local filtered=()
        for comp in "${completions[@]}"; do
            if [[ "$comp" == "$current_word"* ]]; then
                filtered+=("$comp")
            fi
        done
        completions=("${filtered[@]}")
    fi

    printf '%s\n' "${completions[@]}"
}

# Generate completions with type filter
# Usage: tree_complete_by_type <path> <type> [current_word]
tree_complete_by_type() {
    local path="$1"
    local type="$2"
    local current_word="${3:-}"

    path=$(tree_normalize_path "$path")

    local children
    children=$(tree_children "$path" --type "$type")

    local completions=()
    for child in $children; do
        local leaf="${child##*.}"
        completions+=("$leaf")
    done

    if [[ -n "$current_word" ]]; then
        local filtered=()
        for comp in "${completions[@]}"; do
            if [[ "$comp" == "$current_word"* ]]; then
                filtered+=("$comp")
            fi
        done
        completions=("${filtered[@]}")
    fi

    printf '%s\n' "${completions[@]}"
}

# Generate bash completion function for a tree namespace
# Usage: tree_generate_completion <namespace> <command_name>
# Example: tree_generate_completion "help.tdoc" "tdoc"
tree_generate_completion() {
    local namespace="$1"
    local command_name="$2"

    cat <<EOF
# Generated completion for $command_name
_${command_name}_complete() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local prev="\${COMP_WORDS[COMP_CWORD-1]}"
    local path="$namespace"

    # Build path from command words
    if [[ \${COMP_CWORD} -gt 1 ]]; then
        local i
        for ((i=1; i<\${COMP_CWORD}; i++)); do
            local word="\${COMP_WORDS[\$i]}"
            # Skip flags
            [[ "\$word" == -* ]] && continue
            path="\$path.\$word"
        done
    fi

    # Get completions from tree
    local completions
    completions=\$(tree_complete "\$path" "\$cur")

    COMPREPLY=(\$(compgen -W "\$completions" -- "\$cur"))
}

complete -F _${command_name}_complete $command_name
EOF
}

# Interactive completion helper
# Shows completions with descriptions
# Usage: tree_complete_interactive <path>
tree_complete_interactive() {
    local path=$(tree_normalize_path "$1")

    local children
    children=$(tree_children "$path")

    if [[ -z "$children" ]]; then
        echo "No completions available for: $path"
        return 1
    fi

    echo "Available options for: $path"
    echo ""

    for child in $children; do
        local leaf="${child##*.}"
        local type=$(tree_type "$child")
        local title=$(tree_get "$child" "title")
        local help=$(tree_get "$child" "help")

        # Format output
        printf "  %-20s  %-10s  %s\n" "$leaf" "[$type]" "${title:-$help}"
    done
}

# Get completion values from metadata
# Some nodes have static completion lists in metadata
# Usage: tree_complete_values <path>
tree_complete_values() {
    local path=$(tree_normalize_path "$1")

    # Check if node has completion_values metadata
    local values=$(tree_get "$path" "completion_values")
    if [[ -n "$values" ]]; then
        echo "$values" | tr ',' '\n'
        return 0
    fi

    # Check if node has completion_fn metadata
    local fn=$(tree_get "$path" "completion_fn")
    if [[ -n "$fn" ]] && declare -F "$fn" >/dev/null 2>&1; then
        "$fn"
        return 0
    fi

    # Default: complete from children
    tree_complete "$path"
}

# Utility: Build completion path from COMP_WORDS
# Usage: tree_build_path_from_words <namespace>
# Call inside bash completion function
tree_build_path_from_words() {
    local namespace="$1"
    local path="$namespace"

    if [[ ${COMP_CWORD} -gt 1 ]]; then
        local i
        for ((i=1; i<${COMP_CWORD}; i++)); do
            local word="${COMP_WORDS[$i]}"
            # Skip flags/options
            [[ "$word" == -* ]] && continue
            # Skip if looks like a value
            [[ "$word" == *=* ]] && continue
            path="$path.$word"
        done
    fi

    echo "$path"
}

# Export functions
export -f tree_complete
export -f tree_complete_by_type
export -f tree_generate_completion
export -f tree_complete_interactive
export -f tree_complete_values
export -f tree_build_path_from_words
