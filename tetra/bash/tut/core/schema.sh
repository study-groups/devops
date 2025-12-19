#!/usr/bin/env bash
# schema.sh - JSON schema operations
# Usage: tut schema <verb> [args]

_tut_schema() {
    local verb="${1:-help}"
    shift || true

    case "$verb" in
        list|ls)     _tut_schema_list "$@" ;;
        show|s)      _tut_schema_show "$@" ;;
        edit|e)      _tut_schema_edit "$@" ;;
        help|"")     _tut_schema_help ;;
        *)
            _tut_error "Unknown: schema $verb"
            _tut_schema_help
            return 1
            ;;
    esac
}

_tut_schema_help() {
    _tut_heading 2 "tut schema"
    echo
    echo "  Manage JSON schemas"
    echo
    _tut_section "COMMANDS"
    echo "  list, ls      List available schemas"
    echo "  show, s       Show schema details"
    echo "  edit, e       Edit schema file"
    echo
    _tut_section "EXAMPLES"
    echo "  tut schema list"
    echo "  tut schema show guide"
    echo "  tut schema edit reference"
}

# =============================================================================
# LIST
# =============================================================================

_tut_schema_list() {
    _tut_heading 2 "Document Schemas"
    echo
    echo "  guide      Step-by-step guides with terminal simulation"
    echo "  reference  Scrollable topic-based documentation"
    echo
    _tut_info "Use: tut schema show <type> for details"
}

# =============================================================================
# SHOW
# =============================================================================

_tut_schema_show() {
    local schema_type="$1"

    case "$schema_type" in
        "")
            _tut_schema_list
            ;;
        guide)
            _tut_schema_show_guide
            ;;
        reference)
            _tut_schema_show_reference
            ;;
        *)
            _tut_error "Unknown schema: $schema_type"
            _tut_info "Available: guide, reference"
            return 1
            ;;
    esac
}

_tut_schema_show_guide() {
    _tut_heading 2 "Guide Schema"
    echo
    echo "  Structure: Linear steps with content blocks and terminal output"
    echo "  Output:    Interactive HTML with step navigation"
    echo "  Use for:   Onboarding, walkthroughs, learning paths"
    echo
    echo "  JSON: { metadata, steps: [{ id, title, content, terminal }] }"
    echo
    _tut_section "SCHEMA"
    if [[ -f "$TUT_SRC/schemas/guide.schema.json" ]]; then
        jq '.' "$TUT_SRC/schemas/guide.schema.json"
    else
        _tut_error "Schema not found: $TUT_SRC/schemas/guide.schema.json"
    fi
}

_tut_schema_show_reference() {
    _tut_heading 2 "Reference Schema"
    echo
    echo "  Structure: Groups containing topics with content blocks"
    echo "  Output:    Scrollable HTML with sidebar navigation"
    echo "  Use for:   API docs, command reference, configuration"
    echo
    echo "  JSON: { metadata, groups: [{ id, title, topics: [...] }] }"
    echo
    _tut_section "SCHEMA"
    if [[ -f "$TUT_SRC/schemas/reference.schema.json" ]]; then
        jq '.' "$TUT_SRC/schemas/reference.schema.json"
    else
        _tut_error "Schema not found: $TUT_SRC/schemas/reference.schema.json"
    fi
}

# =============================================================================
# EDIT
# =============================================================================

_tut_schema_edit() {
    local schema_type="$1"

    if [[ -z "$schema_type" ]]; then
        echo "Usage: tut schema edit <type>"
        echo "Types: guide, reference"
        return 1
    fi

    local schema_file=""
    case "$schema_type" in
        guide)
            schema_file="$TUT_SRC/schemas/guide.schema.json"
            ;;
        reference)
            schema_file="$TUT_SRC/schemas/reference.schema.json"
            ;;
        *)
            _tut_error "Unknown schema: $schema_type"
            return 1
            ;;
    esac

    if [[ ! -f "$schema_file" ]]; then
        _tut_error "Schema not found: $schema_file"
        return 1
    fi

    ${EDITOR:-vim} "$schema_file"
}
