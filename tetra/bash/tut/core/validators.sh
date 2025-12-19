#!/usr/bin/env bash
# validators.sh - TUT validation wrapper around tok
#
# Provides TUT-specific validation with guide-focused checks,
# delegating to tok for JSON validation infrastructure.

# =============================================================================
# TUT VALIDATION WRAPPER
# =============================================================================

# Validate tutorial JSON structure
# Uses tok for base validation, adds TUT-specific guide checks
_tut_validate() {
    local json_file="$1"

    _tok_require_file "$json_file" "JSON file" || return 1
    _tok_require_jq || return 1

    echo "Validating: $json_file"
    echo ""

    # Use tok for basic JSON validation
    if ! tok_validate_syntax "$json_file"; then
        echo "✗ Invalid JSON syntax"
        return 1
    fi
    echo "✓ Valid JSON syntax"

    # TUT-specific guide validation
    local title=$(jq -r '.metadata.title // empty' "$json_file")
    local description=$(jq -r '.metadata.description // empty' "$json_file")
    local version=$(jq -r '.metadata.version // empty' "$json_file")
    local steps=$(jq -r '.steps | length' "$json_file")

    local errors=0

    if [[ -z "$title" ]]; then
        echo "✗ Missing: metadata.title"
        ((errors++))
    else
        echo "✓ Title: $title"
    fi

    if [[ -z "$description" ]]; then
        echo "✗ Missing: metadata.description"
        ((errors++))
    else
        echo "✓ Description: ${description:0:50}..."
    fi

    if [[ -z "$version" ]]; then
        echo "✗ Missing: metadata.version"
        ((errors++))
    else
        echo "✓ Version: $version"
    fi

    if [[ "$steps" -eq 0 ]]; then
        echo "✗ No steps defined"
        ((errors++))
    else
        echo "✓ Steps: $steps"
    fi

    # Check each step has required fields
    for ((i=0; i<steps; i++)); do
        local step_id=$(jq -r ".steps[$i].id // empty" "$json_file")
        local step_title=$(jq -r ".steps[$i].title // empty" "$json_file")

        if [[ -z "$step_id" ]]; then
            echo "✗ Step $i missing id"
            ((errors++))
        fi
        if [[ -z "$step_title" ]]; then
            echo "✗ Step $i missing title"
            ((errors++))
        fi
    done

    echo ""
    if [[ $errors -eq 0 ]]; then
        echo "✓ Validation passed"
        return 0
    else
        echo "✗ Validation failed: $errors error(s)"
        return 1
    fi
}

# Export for internal use
export -f _tut_validate
