#!/usr/bin/env bash
# tok.sh - Token/JSON Utilities CLI
#
# Provides JSON validation, template hydration, and schema management.
#
# Usage:
#   tok validate <file.json>              # Validate JSON
#   tok hydrate <template> [options]      # Variable substitution
#   tok schema <subcommand> [args]        # Schema management
#   tok query <file.json> <jq-path>       # JSON querying
#   tok help                              # Show help

TOK_VERSION="1.0.0"

# =============================================================================
# HELP
# =============================================================================

_tok_help() {
    cat <<'EOF'
tok - Token/JSON Utilities

USAGE:
    tok <command> [arguments]

COMMANDS:
    validate <file.json>              Validate JSON syntax and structure
    hydrate <template> [options]      Substitute {{variables}} in templates
    schema <subcommand> [args]        Schema management
    query <file.json> <jq-path>       Query JSON with jq
    version                           Show version

VALIDATE:
    tok validate guide.json           Basic validation
    tok validate guide.json -s guide  Validate against schema

HYDRATE:
    tok hydrate template.json --org myorg      Use org's tetra.toml
    tok hydrate template.json --from-org       Use active org
    tok hydrate template.json -o output.json   Specify output
    tok hydrate template.json VAR=value        Extra variables

SCHEMA:
    tok schema list                   List available schemas
    tok schema show <name>            Show schema contents
    tok schema edit <name>            Edit schema
    tok schema validate <file> <schema>  Validate file against schema

QUERY:
    tok query file.json '.metadata.title'
    tok query file.json '.steps | length'
    tok query file.json '.steps[0].id'

EXAMPLES:
    # Validate a guide
    tok validate tut/available/gdocs-guide.json

    # Hydrate a template with org variables
    tok hydrate tkm-guide.template.json --org pixeljam-arcade

    # Query JSON
    tok query guide.json '.steps[] | .title'
EOF
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

tok() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Validation
        validate|v)
            tok_validate "$@"
            ;;

        # Hydration
        hydrate|h)
            tok_hydrate "$@"
            ;;

        # Schema management
        schema|s)
            tok_schema "$@"
            ;;

        # Query
        query|q|get)
            tok_query "$@"
            ;;

        # Set value
        set)
            tok_set "$@"
            ;;

        # List keys
        keys|k)
            tok_keys "$@"
            ;;

        # Help
        help|-h|--help)
            _tok_help
            ;;

        # Version
        version|-v|--version)
            echo "tok version $TOK_VERSION"
            ;;

        # Unknown command
        *)
            echo "Unknown command: $cmd"
            echo "Run 'tok help' for usage"
            return 1
            ;;
    esac
}

# If sourced, export; if run directly, execute
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tok "$@"
fi

export -f tok _tok_help
export TOK_VERSION
