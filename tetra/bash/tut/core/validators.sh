#!/usr/bin/env bash
# validators.sh - Tutorial JSON validation utilities

# Require jq or fail
_tut_require_jq() {
    command -v jq >/dev/null 2>&1 || {
        echo "Error: jq required. Install: brew install jq"
        return 1
    }
}

# Require file exists or fail
_tut_require_file() {
    local file="$1"
    local desc="${2:-File}"

    [[ -z "$file" ]] && {
        echo "Error: $desc required"
        return 1
    }
    [[ ! -f "$file" ]] && {
        echo "Error: $desc not found: $file"
        return 1
    }
    return 0
}

# Validate tutorial JSON structure
_tut_validate() {
    local json_file="$1"

    _tut_require_file "$json_file" "JSON file" || return 1
    _tut_require_jq || return 1

    echo "Validating: $json_file"
    echo ""

    # Basic JSON validity
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "✗ Invalid JSON syntax"
        return 1
    fi
    echo "✓ Valid JSON syntax"

    # Required fields
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

# internal functions - no exports needed
