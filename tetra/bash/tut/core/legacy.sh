#!/usr/bin/env bash
# legacy.sh - Backward compatibility for deprecated commands
# Provides wrappers that emit deprecation warnings then delegate to new commands

_TUT_LEGACY_WARNED=()

_tut_legacy_warn() {
    local old_cmd="$1"
    local new_cmd="$2"

    # Only warn once per command per session
    local key="${old_cmd}"
    if [[ ! " ${_TUT_LEGACY_WARNED[*]} " =~ " ${key} " ]]; then
        echo -e "\033[33m! Deprecated:\033[0m 'tut $old_cmd' -> 'tut $new_cmd'" >&2
        _TUT_LEGACY_WARNED+=("$key")
    fi
}

# =============================================================================
# LEGACY COMMAND HANDLERS
# =============================================================================

# tut get <noun> -> tut <noun> list
_tut_legacy_get() {
    local noun="${1:-}"
    shift 2>/dev/null || true

    case "$noun" in
        "")
            _tut_heading 2 "tut get (deprecated)"
            echo
            echo "  Use the new resource-based commands:"
            echo
            echo "    tut get sources    ->  tut source list"
            echo "    tut get docs       ->  tut doc list"
            echo "    tut get recordings ->  tut recording list"
            return 0
            ;;
        sources)
            _tut_legacy_warn "get sources" "source list"
            _tut_source_list "$@"
            ;;
        docs)
            _tut_legacy_warn "get docs" "doc list"
            _tut_doc_list "$@"
            ;;
        recordings)
            _tut_legacy_warn "get recordings" "recording list"
            _tut_recording_list "$@"
            ;;
        *)
            _tut_error "Unknown: get $noun"
            return 1
            ;;
    esac
}

# tut build <name> -> tut source build <name>
_tut_legacy_build() {
    local first="${1:-}"

    # Special case: tut build index -> tut doc index
    if [[ "$first" == "index" ]]; then
        _tut_legacy_warn "build index" "doc index"
        shift
        _tut_doc_index "$@"
    else
        _tut_legacy_warn "build" "source build"
        _tut_source_build "$@"
    fi
}

# tut init -> tut source init
_tut_legacy_init() {
    _tut_legacy_warn "init" "source init"
    _tut_source_init "$@"
}

# tut validate -> tut source validate
_tut_legacy_validate() {
    _tut_legacy_warn "validate" "source validate"
    _tut_source_validate "$@"
}

# tut serve -> tut doc serve
_tut_legacy_serve() {
    _tut_legacy_warn "serve" "doc serve"
    _tut_doc_serve "$@"
}

# tut browse -> tut doc browse
_tut_legacy_browse() {
    _tut_legacy_warn "browse" "doc browse"
    _tut_doc_browse "$@"
}

# tut run -> tut doc run
_tut_legacy_run() {
    _tut_legacy_warn "run" "doc run"
    _tut_doc_run "$@"
}

# tut hydrate -> tut source hydrate
_tut_legacy_hydrate() {
    _tut_legacy_warn "hydrate" "source hydrate"
    _tut_source_hydrate "$@"
}

# tut types -> tut schema list/show
_tut_legacy_types() {
    local subtype="${1:-}"

    if [[ -z "$subtype" ]]; then
        _tut_legacy_warn "types" "schema list"
        _tut_schema_list
    else
        _tut_legacy_warn "types $subtype" "schema show $subtype"
        _tut_schema_show "$subtype"
    fi
}

# tut extras -> tut extra list/show
_tut_legacy_extras() {
    local extra="${1:-}"

    if [[ -z "$extra" ]]; then
        _tut_legacy_warn "extras" "extra list"
        _tut_extra_list
    else
        _tut_legacy_warn "extras $extra" "extra show $extra"
        _tut_extra_show "$extra"
    fi
}

# tut edit -> various
_tut_legacy_edit() {
    local noun="${1:-}"
    shift 2>/dev/null || true

    case "$noun" in
        "")
            _tut_heading 2 "tut edit (deprecated)"
            echo
            echo "  Use the new resource-based commands:"
            echo
            echo "    tut edit <name>           ->  tut source edit <name>"
            echo "    tut edit guide-schema     ->  tut schema edit guide"
            echo "    tut edit reference-schema ->  tut schema edit reference"
            return 0
            ;;
        guide-schema)
            _tut_legacy_warn "edit guide-schema" "schema edit guide"
            _tut_schema_edit guide
            ;;
        reference-schema)
            _tut_legacy_warn "edit reference-schema" "schema edit reference"
            _tut_schema_edit reference
            ;;
        *)
            # Assume it's a source file
            _tut_legacy_warn "edit $noun" "source edit $noun"
            _tut_source_edit "$noun"
            ;;
    esac
}
