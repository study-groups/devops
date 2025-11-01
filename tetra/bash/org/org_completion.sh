#!/usr/bin/env bash
# Org Hierarchical Tab Completion
# Tree-based completion using bash/tree system

# Source dependencies (guard against re-sourcing)
[[ -z "${ORG_ENVIRONMENTS[@]}" ]] && source "${TETRA_SRC}/bash/org/org_constants.sh"
[[ "$(type -t tree_children)" != "function" ]] && source "${TETRA_SRC}/bash/tree/core.sh"
[[ "$(type -t tree_complete)" != "function" ]] && source "${TETRA_SRC}/bash/tree/complete.sh"
[[ "$(type -t org_tree_init)" != "function" ]] && source "${TETRA_SRC}/bash/org/org_tree.sh"

# Initialize tree on first use
_org_ensure_tree() {
    # Check if tree is initialized
    if [[ -z "$(tree_type 'help.org')" ]]; then
        org_tree_init
    fi
}

# Deprecated - for backward compatibility
# Initialize completion tree (old format)
org_completion_init_tree() {
    # Use new tree-based system instead
    _org_ensure_tree
}

# Complete organization names
org_completion_orgs() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ ! -d "$orgs_dir" ]] && return

    local orgs=()
    for org_dir in "$orgs_dir"/*; do
        [[ -d "$org_dir" ]] && orgs+=($(basename "$org_dir"))
    done

    echo "${orgs[@]}"
}

# Complete environments (using canonical names from org_constants.sh)
org_completion_envs() {
    # Convert to lowercase for completion (user types lowercase)
    local envs=()
    for env in "${ORG_ENVIRONMENTS[@]}"; do
        envs+=("${env,,}")  # Convert to lowercase
    done
    echo "${envs[@]}"
}

# Complete NodeHolder directories (containing digocean.json)
org_completion_nh_dirs() {
    # Check ../nh directory
    if [[ -d "../nh" ]]; then
        local nh_dirs=()
        for dir in ../nh/*/; do
            [[ -f "$dir/digocean.json" ]] && nh_dirs+=($(basename "$dir"))
        done
        echo "${nh_dirs[@]}"
    fi
}

# Complete JSON files
org_completion_json_files() {
    compgen -f -X '!*.json' -- "$1"
}

# Complete templates
org_completion_templates() {
    local template_dir="$TETRA_SRC/templates/organizations"
    [[ ! -d "$template_dir" ]] && return

    local templates=()
    for template in "$template_dir"/*.toml; do
        [[ -f "$template" ]] && templates+=($(basename "$template" .toml))
    done

    echo "${templates[@]}"
}

# Main completion function - Tree-based
_org_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Ensure tree is initialized
    _org_ensure_tree

    # Build path from command words
    local path="help.org"
    if [[ ${COMP_CWORD} -gt 1 ]]; then
        local i
        for ((i=1; i<${COMP_CWORD}; i++)); do
            local word="${COMP_WORDS[$i]}"
            # Skip flags
            [[ "$word" == -* ]] && continue
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

    # Check if current path has a completion function defined
    local completion_fn
    completion_fn=$(tree_get "$path" "completion_fn" 2>/dev/null)

    if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
        # Call dynamic completion function
        local dynamic_completions
        dynamic_completions=$("$completion_fn" 2>/dev/null)
        completions+=($dynamic_completions)
    fi

    # Add common flags if this is a command
    local node_type
    node_type=$(tree_type "$path" 2>/dev/null)
    if [[ "$node_type" == "command" ]]; then
        completions+=(--help -h)
    fi

    # Generate completion replies
    COMPREPLY=($(compgen -W "${completions[*]}" -- "$cur"))
}

# Backward compatibility alias
_org_repl_complete() {
    _org_complete "$@"
}

# Export functions
export -f _org_complete
export -f _org_repl_complete
export -f _org_ensure_tree
export -f org_completion_init_tree
export -f org_completion_orgs
export -f org_completion_envs
export -f org_completion_nh_dirs
export -f org_completion_json_files
export -f org_completion_templates

# Note: Completion registration happens in includes.sh
# after the org() function is defined
