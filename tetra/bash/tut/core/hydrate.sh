#!/usr/bin/env bash
# hydrate.sh - Variable substitution for TUT guide templates
#
# Replaces {{variables}} in guide templates with actual values from:
# 1. Command line arguments
# 2. Active organization's tetra.toml
# 3. Defaults
#
# Usage:
#   tut hydrate tkm-guide.template.json                    # Interactive
#   tut hydrate tkm-guide.template.json --org pixeljam-arcade
#   tut hydrate tkm-guide.template.json --from-org         # Use active org

# Default org
TUT_DEFAULT_ORG="pixeljam-arcade"

# =============================================================================
# VARIABLE EXTRACTION FROM tetra.toml
# =============================================================================

# Get all hydration variables for an org
# Returns associative array of key=value pairs
_tut_get_org_variables() {
    local org="$1"

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

# Substitute variables in a JSON file
# Usage: _tut_hydrate_json <template_file> <output_file> <var1=val1> <var2=val2> ...
_tut_hydrate_json() {
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
_tut_prompt_org() {
    local default="$1"
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
# Usage: tut_hydrate <template.json> [--org <name>] [--from-org] [--output <file>]
tut_hydrate() {
    local template=""
    local org=""
    local output=""
    local from_org=false
    local interactive=true

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
        echo "Usage: tut hydrate <template.json> [--org <name>] [--from-org] [-o <output>]"
        return 1
    }

    # Find template file
    local template_path=""
    if [[ -f "$template" ]]; then
        template_path="$template"
    elif [[ -f "$TUT_SRC/available/$template" ]]; then
        template_path="$TUT_SRC/available/$template"
    elif [[ -f "$TUT_SRC/available/${template}.template.json" ]]; then
        template_path="$TUT_SRC/available/${template}.template.json"
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
        org=$(_tut_prompt_org "$TUT_DEFAULT_ORG")
    elif [[ -z "$org" ]]; then
        org="$TUT_DEFAULT_ORG"
    fi

    # Determine output path
    if [[ -z "$output" ]]; then
        local basename=$(basename "$template_path")
        basename="${basename%.template.json}"
        basename="${basename%.json}"
        output="$TUT_SRC/available/${basename}.json"
    fi

    # Get variables
    echo "Hydrating with org: $org" >&2

    local -a vars
    while IFS= read -r line; do
        [[ -n "$line" ]] && vars+=("$line")
    done < <(_tut_get_org_variables "$org")

    # Show variables
    echo "Variables:" >&2
    for v in "${vars[@]}"; do
        echo "  $v" >&2
    done

    # Hydrate
    local result=$(_tut_hydrate_json "$template_path" "$output" "${vars[@]}")

    echo "" >&2
    echo "Output: $output" >&2
    echo "$output"
}

# =============================================================================
# EXPORTS
# =============================================================================

export TUT_DEFAULT_ORG
export -f _tut_get_org_variables _tut_hydrate_json _tut_prompt_org tut_hydrate
