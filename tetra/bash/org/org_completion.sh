#!/usr/bin/env bash
# Org Hierarchical Tab Completion
# Tree-based completion for tetra org commands

# Completion tree structure
declare -gA ORG_COMPLETION_TREE

# Initialize completion tree
org_completion_init_tree() {
    # Root level - top-level org commands
    ORG_COMPLETION_TREE['/']="list active switch create import discover validate compile refresh secrets push pull rollback history help exit"

    # /list - no subcommands
    ORG_COMPLETION_TREE["/list"]=""
    ORG_COMPLETION_TREE["/list:flags"]="--verbose --json"

    # /active - no subcommands
    ORG_COMPLETION_TREE["/active"]=""

    # /switch - organization names
    ORG_COMPLETION_TREE["/switch"]="@org"
    ORG_COMPLETION_TREE["/switch:type"]="org"

    # /create - organization name
    ORG_COMPLETION_TREE["/create"]="@string"
    ORG_COMPLETION_TREE["/create:flags"]="--from-template"
    ORG_COMPLETION_TREE["/create:--from-template"]="@template"

    # /import - import types
    ORG_COMPLETION_TREE["/import"]="nh json env"
    ORG_COMPLETION_TREE["/import:flags"]="--mapping --no-discover"

    # /import nh
    ORG_COMPLETION_TREE["/import:nh"]="@nh_dir @org"
    ORG_COMPLETION_TREE["/import:nh:type"]="nh_dir"

    # /import json
    ORG_COMPLETION_TREE["/import:json"]="@json_file @org"
    ORG_COMPLETION_TREE["/import:json:type"]="json_file"
    ORG_COMPLETION_TREE["/import:json:flags"]="--mapping"

    # /import env
    ORG_COMPLETION_TREE["/import:env"]="@env_file @org"
    ORG_COMPLETION_TREE["/import:env:type"]="env_file"

    # /discover - JSON file
    ORG_COMPLETION_TREE["/discover"]="@json_file"
    ORG_COMPLETION_TREE["/discover:type"]="json_file"
    ORG_COMPLETION_TREE["/discover:flags"]="--output --org-name"

    # /validate - organization name
    ORG_COMPLETION_TREE["/validate"]="@org"
    ORG_COMPLETION_TREE["/validate:type"]="org"
    ORG_COMPLETION_TREE["/validate:flags"]="--strict --json"

    # /compile - organization name
    ORG_COMPLETION_TREE["/compile"]="@org"
    ORG_COMPLETION_TREE["/compile:type"]="org"
    ORG_COMPLETION_TREE["/compile:flags"]="--force --dry-run"

    # /refresh - organization name
    ORG_COMPLETION_TREE["/refresh"]="@org"
    ORG_COMPLETION_TREE["/refresh:type"]="org"
    ORG_COMPLETION_TREE["/refresh:flags"]="--rediscover --json-source"

    # /secrets - secret management subcommands
    ORG_COMPLETION_TREE["/secrets"]="init validate load list copy"

    ORG_COMPLETION_TREE["/secrets:init"]="@org"
    ORG_COMPLETION_TREE["/secrets:init:type"]="org"

    ORG_COMPLETION_TREE["/secrets:validate"]="@org"
    ORG_COMPLETION_TREE["/secrets:validate:type"]="org"

    ORG_COMPLETION_TREE["/secrets:load"]="@org @env"
    ORG_COMPLETION_TREE["/secrets:load:type"]="org"

    ORG_COMPLETION_TREE["/secrets:list"]="@org"
    ORG_COMPLETION_TREE["/secrets:list:type"]="org"

    ORG_COMPLETION_TREE["/secrets:copy"]="@org @org"
    ORG_COMPLETION_TREE["/secrets:copy:type"]="org"

    # /push - deployment
    ORG_COMPLETION_TREE["/push"]="@org @env"
    ORG_COMPLETION_TREE["/push:type"]="org"
    ORG_COMPLETION_TREE["/push:flags"]="--force --dry-run"

    # /pull - pull from environment
    ORG_COMPLETION_TREE["/pull"]="@org @env"
    ORG_COMPLETION_TREE["/pull:type"]="org"

    # /rollback - rollback deployment
    ORG_COMPLETION_TREE["/rollback"]="@org @env"
    ORG_COMPLETION_TREE["/rollback:type"]="org"

    # /history - deployment history
    ORG_COMPLETION_TREE["/history"]="@org"
    ORG_COMPLETION_TREE["/history:type"]="org"
    ORG_COMPLETION_TREE["/history:flags"]="--env --limit"

    # /help - hierarchical help topics
    ORG_COMPLETION_TREE["/help"]="overview quickstart import discover secrets compile deploy workflow commands all"
    ORG_COMPLETION_TREE["/help:import"]="nh json env"
    ORG_COMPLETION_TREE["/help:deploy"]="push pull rollback"
    ORG_COMPLETION_TREE["/help:workflow"]="nodeholder-to-toml full-setup refresh"
}

# Get completions for current path in tree
org_completion_get_node() {
    local path="$1"
    echo "${ORG_COMPLETION_TREE[$path]}"
}

# Build completion path from words
org_completion_build_path() {
    local words=("$@")
    local path="/"

    for word in "${words[@]:1}"; do
        [[ "$word" =~ ^- ]] && continue  # Skip flags
        [[ -z "$word" ]] && continue

        path="${path%/}:$word"
    done

    echo "$path"
}

# Complete organization names
org_completion_orgs() {
    local orgs_dir="$TETRA_DIR/org"
    [[ ! -d "$orgs_dir" ]] && return

    local orgs=()
    for org_dir in "$orgs_dir"/*; do
        [[ -d "$org_dir" ]] && orgs+=($(basename "$org_dir"))
    done

    echo "${orgs[@]}"
}

# Complete environments
org_completion_envs() {
    echo "local dev staging prod qa"
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

# Main completion function
_org_repl_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Initialize tree if not done
    [[ -z "${ORG_COMPLETION_TREE['/']}" ]] && org_completion_init_tree

    # Build path from words
    local path=$(org_completion_build_path "${COMP_WORDS[@]:0:$COMP_CWORD}")

    # Get completions for this path
    local completions=$(org_completion_get_node "$path")

    # Handle special completion types
    if [[ "$completions" =~ @org ]]; then
        completions=$(org_completion_orgs)
    elif [[ "$completions" =~ @env ]]; then
        completions=$(org_completion_envs)
    elif [[ "$completions" =~ @nh_dir ]]; then
        completions=$(org_completion_nh_dirs)
    elif [[ "$completions" =~ @json_file ]]; then
        COMPREPLY=($(org_completion_json_files "$cur"))
        return
    elif [[ "$completions" =~ @template ]]; then
        completions=$(org_completion_templates)
    elif [[ "$completions" =~ @string ]]; then
        # No completion for arbitrary strings
        return
    fi

    # Add flags if available
    local flags=$(org_completion_get_node "${path}:flags")
    [[ -n "$flags" ]] && completions="$completions $flags"

    # Generate completion replies
    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
}

# Export completion function
export -f _org_repl_complete
export -f org_completion_init_tree
export -f org_completion_get_node
export -f org_completion_build_path
export -f org_completion_orgs
export -f org_completion_envs
export -f org_completion_nh_dirs
export -f org_completion_json_files
export -f org_completion_templates

# Register completion
complete -F _org_repl_complete org
