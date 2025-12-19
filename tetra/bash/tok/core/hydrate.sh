#!/usr/bin/env bash
# hydrate.sh - Variable substitution for JSON templates
#
# Replaces {{variables}} in templates with actual values from:
# 1. Command line arguments
# 2. Active organization's tetra.toml
# 3. Defaults
#
# Usage:
#   tok hydrate template.json                    # Interactive
#   tok hydrate template.json --org pixeljam-arcade
#   tok hydrate template.json --from-org         # Use active org

# =============================================================================
# VARIABLE EXTRACTION FROM tetra.toml
# =============================================================================

# Get all hydration variables for an org
# Returns key=value pairs, one per line
_tok_get_org_variables() {
    local org="$1"

    # Check if org module is available
    if ! command -v org_active &>/dev/null; then
        echo "org=$org"
        return 0
    fi

    # Switch to org temporarily
    local prev_org=$(org_active 2>/dev/null)
    org switch "$org" &>/dev/null

    # Core variable
    echo "org=$org"
    echo "ssh_dir=~/.ssh/$org/"

    # Environment hosts
    for env in dev staging prod; do
        local host=$(_org_get_host "$env" 2>/dev/null)
        [[ -n "$host" ]] && echo "${env}_host=$host"
    done

    # Work user (from dev environment)
    local work_user=$(_org_get_work_user "dev" 2>/dev/null)
    [[ -n "$work_user" ]] && echo "work_user=$work_user"

    # Auth user (from dev environment)
    local auth_user=$(_org_get_user "dev" 2>/dev/null)
    [[ -n "$auth_user" ]] && echo "auth_user=$auth_user"

    # Restore previous org
    [[ -n "$prev_org" && "$prev_org" != "none" ]] && org switch "$prev_org" &>/dev/null
}

# =============================================================================
# TEMPLATE PROCESSING
# =============================================================================

# Find unsubstituted variables in a file
# Usage: _tok_find_variables <file>
_tok_find_variables() {
    local file="$1"
    grep -oE '\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}' "$file" 2>/dev/null | \
        sed 's/{{//g; s/}}//g' | \
        sort -u
}

# Substitute variables in a file
# Usage: _tok_substitute <template_file> <output_file> <var1=val1> <var2=val2> ...
_tok_substitute() {
    local template="$1"
    local output="$2"
    shift 2

    [[ ! -f "$template" ]] && {
        echo "Error: Template not found: $template" >&2
        return 1
    }

    # Build sed substitution script
    local sed_script=""
    for var in "$@"; do
        local key="${var%%=*}"
        local value="${var#*=}"
        # Escape special characters for sed
        value=$(printf '%s\n' "$value" | sed 's/[&/\]/\\&/g')
        sed_script+="s/{{${key}}}/${value}/g;"
    done

    # Apply substitutions
    sed "$sed_script" "$template" > "$output"

    echo "$output"
}

# =============================================================================
# INTERACTIVE PROMPT
# =============================================================================

# Prompt for org name with default
_tok_prompt_org() {
    local default="${1:-tetra}"
    local org

    printf "Organization name [%s]: " "$default" >&2
    read -r org

    [[ -z "$org" ]] && org="$default"
    echo "$org"
}

# =============================================================================
# MAIN HYDRATION FUNCTION
# =============================================================================

# Hydrate a template file
# Usage: tok_hydrate <template> [--org <name>] [--from-org] [--output <file>] [VAR=value ...]
tok_hydrate() {
    local template=""
    local org=""
    local output=""
    local from_org=false
    local interactive=true
    local -a extra_vars=()

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org)
                org="$2"
                interactive=false
                shift 2
                ;;
            --from-org)
                from_org=true
                interactive=false
                shift
                ;;
            --output|-o)
                output="$2"
                shift 2
                ;;
            --dry-run|-n)
                local dry_run=true
                shift
                ;;
            *=*)
                extra_vars+=("$1")
                shift
                ;;
            -*)
                echo "Unknown option: $1" >&2
                return 1
                ;;
            *)
                template="$1"
                shift
                ;;
        esac
    done

    # Validate template
    [[ -z "$template" ]] && {
        echo "Usage: tok hydrate <template> [--org <name>] [--from-org] [-o <output>] [VAR=value ...]"
        return 1
    }

    # Find template file
    local template_path=""
    if [[ -f "$template" ]]; then
        template_path="$template"
    else
        echo "Error: Template not found: $template" >&2
        return 1
    fi

    # Determine org
    if $from_org; then
        org=$(org_active 2>/dev/null)
        [[ -z "$org" || "$org" == "none" ]] && {
            echo "Error: No active org. Use --org or run 'org switch <name>'" >&2
            return 1
        }
    elif [[ -z "$org" ]] && $interactive && [[ -t 0 ]]; then
        org=$(_tok_prompt_org "tetra")
    elif [[ -z "$org" ]]; then
        org="tetra"
    fi

    # Determine output path
    if [[ -z "$output" ]]; then
        local basename=$(basename "$template_path")
        basename="${basename%.template.json}"
        basename="${basename%.template}"
        local dir=$(dirname "$template_path")
        output="${dir}/${basename}.json"
    fi

    # Get variables from org
    echo "Hydrating with org: $org" >&2

    local -a vars
    while IFS= read -r line; do
        [[ -n "$line" ]] && vars+=("$line")
    done < <(_tok_get_org_variables "$org")

    # Add extra variables (override org vars)
    for v in "${extra_vars[@]}"; do
        vars+=("$v")
    done

    # Show variables
    echo "Variables:" >&2
    for v in "${vars[@]}"; do
        echo "  $v" >&2
    done

    # Check for unsubstituted variables
    local remaining=$(_tok_find_variables "$template_path")
    local missing=""
    for var in $remaining; do
        local found=false
        for v in "${vars[@]}"; do
            [[ "${v%%=*}" == "$var" ]] && found=true && break
        done
        $found || missing+=" $var"
    done

    if [[ -n "$missing" ]]; then
        echo "Warning: Missing variables:$missing" >&2
    fi

    # Dry run - just show what would happen
    if [[ "${dry_run:-false}" == "true" ]]; then
        echo "" >&2
        echo "Would write to: $output" >&2
        return 0
    fi

    # Hydrate
    local result=$(_tok_substitute "$template_path" "$output" "${vars[@]}")

    echo "" >&2
    echo "Output: $output" >&2
    echo "$output"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tok_get_org_variables _tok_find_variables _tok_substitute _tok_prompt_org tok_hydrate
