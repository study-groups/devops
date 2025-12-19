#!/usr/bin/env bash
# json.sh - JSON validation and querying utilities
#
# Provides JSON validation, querying, and manipulation functions.

# Require jq or fail
_tok_require_jq() {
    command -v jq >/dev/null 2>&1 || {
        echo "Error: jq required. Install: brew install jq"
        return 1
    }
}

# Require file exists or fail
_tok_require_file() {
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

# Validate JSON syntax
# Usage: tok_validate_syntax <file.json>
tok_validate_syntax() {
    local json_file="$1"

    _tok_require_file "$json_file" "JSON file" || return 1
    _tok_require_jq || return 1

    if jq empty "$json_file" 2>/dev/null; then
        return 0
    else
        echo "Error: Invalid JSON syntax in $json_file"
        return 1
    fi
}

# Validate JSON against schema requirements
# Usage: tok_validate <file.json> [--schema <schema.json>]
tok_validate() {
    local json_file="$1"
    local schema=""

    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --schema|-s)
                schema="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    _tok_require_file "$json_file" "JSON file" || return 1
    _tok_require_jq || return 1

    echo "Validating: $json_file"
    echo ""

    # Basic JSON validity
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "  Invalid JSON syntax"
        return 1
    fi
    echo "  Valid JSON syntax"

    # If schema provided, validate against it
    if [[ -n "$schema" ]]; then
        _tok_validate_against_schema "$json_file" "$schema"
        return $?
    fi

    # Auto-detect type and validate
    local mode=$(jq -r '.mode // empty' "$json_file")
    if [[ -n "$mode" ]]; then
        local schema_file="$TOK_SRC/schemas/${mode}.schema.json"
        if [[ -f "$schema_file" ]]; then
            _tok_validate_against_schema "$json_file" "$schema_file"
            return $?
        fi
    fi

    # Basic structure validation
    _tok_validate_basic "$json_file"
}

# Basic structure validation (no schema)
_tok_validate_basic() {
    local json_file="$1"
    local errors=0

    # Check for terrain wrapper
    local terrain_name=$(jq -r '.terrain.name // empty' "$json_file")
    local terrain_version=$(jq -r '.terrain.version // empty' "$json_file")

    if [[ -n "$terrain_name" ]]; then
        echo "  Terrain app: $terrain_name"
        [[ -n "$terrain_version" ]] && echo "  Version: $terrain_version"
    fi

    # Check mode
    local mode=$(jq -r '.mode // empty' "$json_file")
    if [[ -n "$mode" ]]; then
        echo "  Mode: $mode"
    fi

    # Check common metadata
    local title=$(jq -r '.metadata.title // empty' "$json_file")
    local description=$(jq -r '.metadata.description // empty' "$json_file")

    if [[ -n "$title" ]]; then
        echo "  Title: $title"
    fi
    if [[ -n "$description" ]]; then
        echo "  Description: ${description:0:50}..."
    fi

    # Check content based on mode
    case "$mode" in
        guide)
            local steps=$(jq -r '.steps | length' "$json_file")
            if [[ "$steps" -eq 0 ]]; then
                echo "  Warning: No steps defined for guide"
                ((errors++))
            else
                echo "  Steps: $steps"
            fi
            ;;
        reference)
            local groups=$(jq -r '.groups | length' "$json_file")
            if [[ "$groups" -eq 0 ]]; then
                echo "  Warning: No groups defined for reference"
                ((errors++))
            else
                echo "  Groups: $groups"
            fi
            ;;
        controldeck)
            local panels=$(jq -r '.panels | length' "$json_file")
            if [[ "$panels" -gt 0 ]]; then
                echo "  Panels: $panels"
            fi
            ;;
        deploy)
            local targets=$(jq -r '.targets | length' "$json_file")
            if [[ "$targets" -gt 0 ]]; then
                echo "  Targets: $targets"
            fi
            ;;
    esac

    echo ""
    if [[ $errors -eq 0 ]]; then
        echo "  Validation passed"
        return 0
    else
        echo "  Validation completed with $errors warning(s)"
        return 0
    fi
}

# Validate against schema file
_tok_validate_against_schema() {
    local json_file="$1"
    local schema_file="$2"

    _tok_require_file "$schema_file" "Schema file" || return 1

    echo "  Schema: $(basename "$schema_file")"

    # Basic schema validation using jq
    # Note: Full JSON Schema validation would require additional tooling
    local required_fields=$(jq -r '.required[]? // empty' "$schema_file" 2>/dev/null)

    if [[ -n "$required_fields" ]]; then
        local errors=0
        for field in $required_fields; do
            local value=$(jq -r ".$field // empty" "$json_file")
            if [[ -z "$value" ]]; then
                echo "    Missing required field: $field"
                ((errors++))
            fi
        done

        if [[ $errors -gt 0 ]]; then
            echo "  Schema validation failed: $errors missing field(s)"
            return 1
        fi
    fi

    echo "  Schema validation passed"
    return 0
}

# Query JSON with jq
# Usage: tok_query <file.json> <jq-path>
tok_query() {
    local json_file="$1"
    local query="$2"

    _tok_require_file "$json_file" "JSON file" || return 1
    _tok_require_jq || return 1

    [[ -z "$query" ]] && {
        echo "Usage: tok query <file.json> <jq-path>"
        echo "Example: tok query guide.json '.metadata.title'"
        return 1
    }

    jq -r "$query" "$json_file"
}

# Get JSON value at path
# Usage: tok_get <file.json> <path>
tok_get() {
    tok_query "$@"
}

# Set JSON value at path
# Usage: tok_set <file.json> <path> <value>
tok_set() {
    local json_file="$1"
    local path="$2"
    local value="$3"

    _tok_require_file "$json_file" "JSON file" || return 1
    _tok_require_jq || return 1

    [[ -z "$path" || -z "$value" ]] && {
        echo "Usage: tok set <file.json> <path> <value>"
        return 1
    }

    local tmp=$(mktemp)
    jq "$path = $value" "$json_file" > "$tmp" && mv "$tmp" "$json_file"
}

# List top-level keys
# Usage: tok_keys <file.json>
tok_keys() {
    local json_file="$1"

    _tok_require_file "$json_file" "JSON file" || return 1
    _tok_require_jq || return 1

    jq -r 'keys[]' "$json_file"
}

# =============================================================================
# String-based JSON operations (in-memory JSON, not files)
# =============================================================================

# Extract field from JSON string
# Usage: tok_str_get "$json_string" '.field' [default]
tok_str_get() {
    local json="$1" path="$2" default="${3:-}"
    local result
    result=$(echo "$json" | jq -r "$path // empty" 2>/dev/null)
    [[ -z "$result" || "$result" == "null" ]] && echo "$default" || echo "$result"
}

# Extract multiple fields from JSON string (single jq call)
# Usage: IFS=$'\t' read -r a b c <<< "$(tok_str_get_multi "$json" '.a' '.b' '.c')"
# Returns: tab-separated values
tok_str_get_multi() {
    local json="$1"; shift
    local expr=""
    for path in "$@"; do
        [[ -n "$expr" ]] && expr+=", "
        expr+="($path // empty)"
    done
    echo "$json" | jq -r "[$expr] | @tsv" 2>/dev/null
}

# Export functions
export -f _tok_require_jq _tok_require_file
export -f tok_validate_syntax tok_validate _tok_validate_basic _tok_validate_against_schema
export -f tok_query tok_get tok_set tok_keys
export -f tok_str_get tok_str_get_multi
