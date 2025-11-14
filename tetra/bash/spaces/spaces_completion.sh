#!/usr/bin/env bash
# spaces_completion.sh - Tab completion for Spaces REPL

# Load dependencies
[[ "$(type -t tree_children)" != "function" ]] && source "${TETRA_SRC}/bash/tree/core.sh"
[[ "$(type -t tree_complete)" != "function" ]] && source "${TETRA_SRC}/bash/tree/complete.sh"
[[ "$(type -t spaces_tree_init)" != "function" ]] && source "${TETRA_SRC}/bash/spaces/spaces_tree.sh"

# Ensure tree is initialized
_spaces_ensure_tree() {
    if [[ -z "$(tree_type 'help.spaces' 2>/dev/null)" ]]; then
        spaces_tree_init
    fi
}

# Complete bucket names from tetra.toml
spaces_completion_buckets() {
    local buckets=()

    # Get default bucket from storage.spaces
    if [[ -n "${TETRA_ORG:-}" ]]; then
        local toml_file="$TETRA_DIR/orgs/$TETRA_ORG/tetra.toml"
        if [[ -f "$toml_file" ]]; then
            # Get default bucket
            local default_bucket
            default_bucket=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found && /^default_bucket/ {print}' "$toml_file" | cut -d'=' -f2 | tr -d ' "')
            [[ -n "$default_bucket" ]] && buckets+=("$default_bucket")

            # Get buckets from publishing sections
            local pub_buckets
            pub_buckets=$(awk '/^\[publishing\./ && /bucket/ {print}' "$toml_file" | cut -d'=' -f2 | tr -d ' "' | sort -u)
            buckets+=($pub_buckets)
        fi
    fi

    # Remove duplicates
    printf '%s\n' "${buckets[@]}" | sort -u
}

# Complete paths within current bucket (using cached ls results)
spaces_completion_paths() {
    # This would require caching the last ls output
    # For now, just return common paths
    echo "games/ docs/ assets/ config/ public/"
}

# Complete local files
spaces_completion_files() {
    local cur="$1"
    compgen -f -- "$cur"
}

# Main REPL completion function
_spaces_repl_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[0]}"

    # Ensure tree is initialized
    _spaces_ensure_tree

    # Build path from command words
    local path="help.spaces"
    if [[ ${COMP_CWORD} -gt 0 ]]; then
        local i
        for ((i=0; i<${COMP_CWORD}; i++)); do
            local word="${COMP_WORDS[$i]}"
            # Skip empty or flag-like words
            [[ -z "$word" || "$word" == -* ]] && continue
            path="$path.$word"
        done
    fi

    # Get child commands from tree
    local children
    children=$(tree_children "$path" 2>/dev/null)

    # Extract leaf names for completion
    local completions=()
    for child in $children; do
        local leaf="${child##*.}"
        completions+=("$leaf")
    done

    # Check if current path has a completion function
    local completion_fn
    completion_fn=$(tree_get "$path" "completion_fn" 2>/dev/null)

    if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
        # Call dynamic completion function
        local dynamic_completions
        dynamic_completions=$("$completion_fn" "$cur" 2>/dev/null)
        completions+=($dynamic_completions)
    fi

    # Context-aware completion based on previous command
    case "$prev" in
        use)
            # Complete bucket names
            local buckets
            buckets=$(spaces_completion_buckets)
            completions+=($buckets)
            ;;
        cd)
            # Complete paths
            local paths
            paths=$(spaces_completion_paths)
            completions+=($paths)
            ;;
        put)
            # Complete local files
            if [[ ${COMP_CWORD} -eq 1 ]]; then
                COMPREPLY=($(compgen -f -- "$cur"))
                return 0
            fi
            ;;
        get|rm|url)
            # Complete remote paths (would need caching)
            ;;
    esac

    # Generate completion replies
    COMPREPLY=($(compgen -W "${completions[*]}" -- "$cur"))
}

# Export functions
export -f _spaces_ensure_tree
export -f spaces_completion_buckets
export -f spaces_completion_paths
export -f spaces_completion_files
export -f _spaces_repl_complete

# Note: Actual completion binding happens in the REPL
# complete -F _spaces_repl_complete spaces_repl
