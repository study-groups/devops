#!/usr/bin/env bash
# schema.sh - Schema management utilities
#
# Provides schema listing, viewing, and validation functions.

# Get schema directory
_tok_schema_dir() {
    echo "${TOK_SRC}/schemas"
}

# List available schemas
# Usage: tok_schema_list
tok_schema_list() {
    local schema_dir=$(_tok_schema_dir)

    if [[ ! -d "$schema_dir" ]]; then
        echo "No schemas directory at: $schema_dir"
        return 1
    fi

    echo "Available schemas:"
    echo ""

    for schema in "$schema_dir"/*.schema.json; do
        [[ -f "$schema" ]] || continue
        local name=$(basename "$schema" .schema.json)
        local title=$(jq -r '.title // empty' "$schema" 2>/dev/null)
        local desc=$(jq -r '.description // empty' "$schema" 2>/dev/null)

        printf "  %-15s %s\n" "$name" "${title:-$name}"
        [[ -n "$desc" ]] && printf "  %-15s %s\n" "" "${desc:0:60}..."
    done
}

# Show schema contents
# Usage: tok_schema_show <name>
tok_schema_show() {
    local name="$1"

    [[ -z "$name" ]] && {
        echo "Usage: tok schema show <name>"
        tok_schema_list
        return 1
    }

    local schema_dir=$(_tok_schema_dir)
    local schema_file="$schema_dir/${name}.schema.json"

    if [[ ! -f "$schema_file" ]]; then
        # Try without .schema suffix
        schema_file="$schema_dir/${name}.json"
    fi

    if [[ ! -f "$schema_file" ]]; then
        echo "Schema not found: $name"
        echo "Available schemas:"
        ls "$schema_dir"/*.schema.json 2>/dev/null | xargs -n1 basename | sed 's/.schema.json$//'
        return 1
    fi

    cat "$schema_file"
}

# Edit schema
# Usage: tok_schema_edit <name>
tok_schema_edit() {
    local name="$1"

    [[ -z "$name" ]] && {
        echo "Usage: tok schema edit <name>"
        return 1
    }

    local schema_dir=$(_tok_schema_dir)
    local schema_file="$schema_dir/${name}.schema.json"

    if [[ ! -f "$schema_file" ]]; then
        echo "Schema not found: $name"
        echo "Create new schema? (y/n)"
        read -r answer
        [[ "$answer" != "y" ]] && return 1
    fi

    ${EDITOR:-vim} "$schema_file"
}

# Validate file against schema
# Usage: tok_schema_validate <file.json> <schema-name>
tok_schema_validate() {
    local file="$1"
    local schema_name="$2"

    [[ -z "$file" || -z "$schema_name" ]] && {
        echo "Usage: tok schema validate <file.json> <schema-name>"
        return 1
    }

    _tok_require_file "$file" "JSON file" || return 1

    local schema_dir=$(_tok_schema_dir)
    local schema_file="$schema_dir/${schema_name}.schema.json"

    _tok_require_file "$schema_file" "Schema file" || return 1

    tok_validate "$file" --schema "$schema_file"
}

# Get schema for mode
# Usage: tok_schema_for_mode <mode>
tok_schema_for_mode() {
    local mode="$1"
    local schema_dir=$(_tok_schema_dir)
    local schema_file="$schema_dir/${mode}.schema.json"

    if [[ -f "$schema_file" ]]; then
        echo "$schema_file"
    else
        echo ""
    fi
}

# Schema dispatcher
# Usage: tok_schema <subcommand> [args...]
tok_schema() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls)
            tok_schema_list "$@"
            ;;
        show|get)
            tok_schema_show "$@"
            ;;
        edit)
            tok_schema_edit "$@"
            ;;
        validate|check)
            tok_schema_validate "$@"
            ;;
        *)
            echo "Unknown schema command: $cmd"
            echo "Available: list, show, edit, validate"
            return 1
            ;;
    esac
}

# Export functions
export -f _tok_schema_dir tok_schema_list tok_schema_show tok_schema_edit
export -f tok_schema_validate tok_schema_for_mode tok_schema
