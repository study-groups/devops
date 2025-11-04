#!/usr/bin/env bash
# TDS Token Validation
# Validates that all required color tokens are defined

# Required tokens for Mode REPL system
declare -ga TDS_REQUIRED_TOKENS=(
    # REPL essentials
    "repl.prompt"
    "repl.prompt.bracket"
    "repl.prompt.separator"
    "repl.prompt.arrow"

    # Content tokens
    "content.primary"
    "content.secondary"
    "content.dim"

    # Marker tokens
    "marker.primary"
    "marker.active"

    # Status tokens
    "status.success"
    "status.error"
    "status.warning"
    "status.info"

    # Text tokens
    "text.primary"
    "text.secondary"
    "text.tertiary"
    "text.muted"
)

# Validate that a token is defined
# Args: token_name
# Returns: 0 if valid, 1 if missing
tds_validate_token() {
    local token="$1"

    if [[ -z "${TDS_COLOR_TOKENS[$token]}" ]]; then
        echo "ERROR: Required token missing: '$token'" >&2
        return 1
    fi

    # Validate token points to valid palette reference
    local ref="${TDS_COLOR_TOKENS[$token]}"

    # Check if it's a palette reference (palette:index)
    if [[ "$ref" =~ ^(env|mode|verbs|nouns):[0-7]$ ]]; then
        return 0
    fi

    # Check if it's a reference to another token
    if [[ -n "${TDS_COLOR_TOKENS[$ref]}" ]]; then
        return 0
    fi

    echo "ERROR: Token '$token' has invalid reference: '$ref'" >&2
    return 1
}

# Validate all required tokens
# Returns: 0 if all valid, 1 if any missing/invalid
tds_validate_all_tokens() {
    local all_valid=true
    local missing_count=0

    for token in "${TDS_REQUIRED_TOKENS[@]}"; do
        if ! tds_validate_token "$token" 2>/dev/null; then
            all_valid=false
            ((missing_count++))
        fi
    done

    if [[ "$all_valid" == "false" ]]; then
        echo "ERROR: $missing_count required tokens are missing or invalid" >&2
        return 1
    fi

    return 0
}

# Show token validation report
tds_show_token_validation() {
    echo "Validating TDS Tokens"
    echo "====================="
    echo

    local valid_count=0
    local invalid_count=0

    for token in "${TDS_REQUIRED_TOKENS[@]}"; do
        if tds_validate_token "$token" 2>/dev/null; then
            printf "  ✓ %-30s → %s\n" "$token" "${TDS_COLOR_TOKENS[$token]}"
            ((valid_count++))
        else
            printf "  ✗ %-30s MISSING\n" "$token"
            ((invalid_count++))
        fi
    done

    echo
    echo "Summary: $valid_count valid, $invalid_count missing"

    if [[ $invalid_count -gt 0 ]]; then
        return 1
    fi
    return 0
}

# Export functions
export -f tds_validate_token
export -f tds_validate_all_tokens
export -f tds_show_token_validation
