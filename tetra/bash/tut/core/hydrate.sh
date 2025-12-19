#!/usr/bin/env bash
# hydrate.sh - TUT wrapper around tok hydration
#
# Provides TUT-specific defaults and template search paths,
# delegating to tok for actual hydration.
#
# Usage:
#   tut hydrate tkm-guide.template.json                    # Interactive
#   tut hydrate tkm-guide.template.json --org pixeljam-arcade
#   tut hydrate tkm-guide.template.json --from-org         # Use active org

# Default org for TUT templates
TUT_DEFAULT_ORG="${TUT_DEFAULT_ORG:-pixeljam-arcade}"

# =============================================================================
# TUT HYDRATION WRAPPER
# =============================================================================

# Hydrate a template file with TUT-specific defaults
# Usage: tut_hydrate <template.json> [--org <name>] [--from-org] [--output <file>] [VAR=value ...]
tut_hydrate() {
    local template=""
    local output=""
    local -a passthrough_args=()

    # Parse arguments, extracting template and output for TUT-specific handling
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output|-o)
                output="$2"
                passthrough_args+=("$1" "$2")
                shift 2
                ;;
            -*)
                passthrough_args+=("$1")
                # Check if next arg is a value for this flag
                if [[ $# -gt 1 && ! "$2" =~ ^- ]]; then
                    passthrough_args+=("$2")
                    shift
                fi
                shift
                ;;
            *=*)
                # Extra variables pass through
                passthrough_args+=("$1")
                shift
                ;;
            *)
                # First non-flag is template
                if [[ -z "$template" ]]; then
                    template="$1"
                else
                    passthrough_args+=("$1")
                fi
                shift
                ;;
        esac
    done

    # Validate template provided
    [[ -z "$template" ]] && {
        echo "Usage: tut hydrate <template.json> [--org <name>] [--from-org] [-o <output>] [VAR=value ...]"
        return 1
    }

    # TUT-specific template search paths
    local template_path=""
    if [[ -f "$template" ]]; then
        template_path="$template"
    elif [[ -f "$TUT_SRC/available/$template" ]]; then
        template_path="$TUT_SRC/available/$template"
    elif [[ -f "$TUT_SRC/available/${template}.template.json" ]]; then
        template_path="$TUT_SRC/available/${template}.template.json"
    else
        echo "Error: Template not found: $template" >&2
        echo "Searched:" >&2
        echo "  $template" >&2
        echo "  $TUT_SRC/available/$template" >&2
        echo "  $TUT_SRC/available/${template}.template.json" >&2
        return 1
    fi

    # TUT-specific output default (to available/ directory)
    if [[ -z "$output" ]]; then
        local basename=$(basename "$template_path")
        basename="${basename%.template.json}"
        basename="${basename%.json}"
        output="$TUT_SRC/available/${basename}.json"
        passthrough_args+=("--output" "$output")
    fi

    # Check if --org or --from-org was provided, if not use TUT default
    local has_org=false
    for arg in "${passthrough_args[@]}"; do
        [[ "$arg" == "--org" || "$arg" == "--from-org" ]] && has_org=true
    done

    if ! $has_org; then
        passthrough_args+=("--org" "$TUT_DEFAULT_ORG")
    fi

    # Delegate to tok
    tok_hydrate "$template_path" "${passthrough_args[@]}"
}

# =============================================================================
# EXPORTS
# =============================================================================

export TUT_DEFAULT_ORG
export -f tut_hydrate
