#!/usr/bin/env bash
# source.sh - Source JSON file operations
# Usage: tut source <verb> [args]

_tut_source() {
    local verb="${1:-help}"
    shift || true

    case "$verb" in
        list|ls)     _tut_source_list "$@" ;;
        build|b)     _tut_source_build "$@" ;;
        init|i)      _tut_source_init "$@" ;;
        validate|v)  _tut_source_validate "$@" ;;
        edit|e)      _tut_source_edit "$@" ;;
        hydrate|h)   _tut_source_hydrate "$@" ;;
        help|"")     _tut_source_help ;;
        *)
            _tut_error "Unknown: source $verb"
            _tut_source_help
            return 1
            ;;
    esac
}

_tut_source_help() {
    _tut_heading 2 "tut source"
    echo
    echo "  Manage JSON source files"
    echo
    _tut_section "COMMANDS"
    echo "  list, ls      List available sources"
    echo "  build, b      Build source to HTML"
    echo "  init, i       Create new source template"
    echo "  validate, v   Validate against schema"
    echo "  edit, e       Edit source file"
    echo "  hydrate, h    Substitute template variables"
    echo
    _tut_section "EXAMPLES"
    echo "  tut source list"
    echo "  tut source build gdocs-guide"
    echo "  tut source init my-guide --type guide"
}

# =============================================================================
# LIST
# =============================================================================

_tut_source_list() {
    local verbose=false
    [[ "$1" == "-v" || "$1" == "--verbose" ]] && verbose=true

    _tut_heading 2 "Source Files"
    _tut_dim "  $TUT_SRC/available/"; echo
    echo

    if [[ "$verbose" == true ]]; then
        _tut_label "TUT_SRC:" "$TUT_SRC"
        _tut_label "TUT_DIR:" "$TUT_DIR"
        echo
    fi

    if [[ -d "$TUT_SRC/available" ]]; then
        local count=0
        shopt -s nullglob
        for file in "$TUT_SRC/available"/*.json; do
            if [[ -f "$file" ]]; then
                local name=$(basename "$file")
                local doc_type=$(_tut_detect_type "$file")
                local title=$(jq -r '.metadata.title // "(no title)"' "$file")
                local version=$(jq -r '.metadata.version // "-"' "$file")
                _tut_row "$name" "[$doc_type] v$version" "$title" 22 20
                if [[ "$verbose" == true ]]; then
                    _tut_path_verbose "$file"
                fi
                ((count++))
            fi
        done
        shopt -u nullglob

        if [[ $count -eq 0 ]]; then
            _tut_dim "  (none)"; echo
        else
            echo
            _tut_info "Total: $count file(s)"
            echo
            _tut_label "Build:" "tut source build <name>"
        fi
    else
        _tut_warn "No available directory"
    fi
}

# =============================================================================
# BUILD
# =============================================================================

_tut_source_build() {
    local json_files=()
    local doc_type=""
    local format="html"
    local output_file=""
    local output_dir=""
    local no_bump=false
    local build_all=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type|-t)     doc_type="$2"; shift 2 ;;
            --format|-f)   format="$2"; shift 2 ;;
            --output|-o)   output_file="$2"; shift 2 ;;
            --out)         output_dir="$2"; shift 2 ;;
            --no-bump)     no_bump=true; shift ;;
            --all|-a)      build_all=true; shift ;;
            -*)            echo "Unknown option: $1"; return 1 ;;
            *)             json_files+=("$1"); shift ;;
        esac
    done

    # Set output dir globally if specified
    if [[ -n "$output_dir" ]]; then
        mkdir -p "$output_dir"
        TUT_OUTPUT_DIR="$output_dir"
    fi

    # Handle multiple files
    if [[ ${#json_files[@]} -gt 1 ]]; then
        local failed=0
        for file in "${json_files[@]}"; do
            _tut_source_build_single "$file" "$doc_type" "$format" "$no_bump" || ((failed++))
        done
        unset TUT_OUTPUT_DIR
        [[ $failed -gt 0 ]] && return 1
        return 0
    fi

    local json_file="${json_files[0]:-}"

    # Build all available sources
    if [[ "$build_all" == true ]]; then
        _tut_source_build_all "$no_bump"
        local ret=$?
        unset TUT_OUTPUT_DIR
        return $ret
    fi

    if [[ -z "$json_file" ]]; then
        echo "Usage: tut source build <name...> [--out dir] [--type guide|reference]"
        echo "       tut source build --all [--no-bump]"
        unset TUT_OUTPUT_DIR
        return 1
    fi

    _tut_source_build_single "$json_file" "$doc_type" "$format" "$no_bump" "$output_file"
    local ret=$?
    unset TUT_OUTPUT_DIR
    return $ret
}

_tut_source_build_single() {
    local json_file="$1"
    local doc_type="$2"
    local format="${3:-html}"
    local no_bump="${4:-false}"
    local output_file="$5"

    # Resolve path: check available/ if not found directly
    if [[ ! -f "$json_file" ]]; then
        # Try adding .json extension
        if [[ ! "$json_file" == *.json ]]; then
            json_file="${json_file}.json"
        fi
        # Try available/ directory
        if [[ ! -f "$json_file" && -f "$TUT_SRC/available/$json_file" ]]; then
            json_file="$TUT_SRC/available/$json_file"
        elif [[ ! -f "$json_file" && -f "$TUT_SRC/available/$(basename "$json_file")" ]]; then
            json_file="$TUT_SRC/available/$(basename "$json_file")"
        fi
    fi

    _tut_require_file "$json_file" "JSON file" || return 1

    # Auto-detect type if not specified
    if [[ -z "$doc_type" ]]; then
        doc_type=$(_tut_detect_type "$json_file")
        if [[ "$doc_type" == "unknown" ]]; then
            echo "Error: Cannot detect document type. Use --type guide|reference"
            return 1
        fi
        echo "Detected type: $doc_type"
    fi

    # Version bump prompt (unless --no-bump or batch mode)
    if [[ "$no_bump" == false && -z "$TUT_OUTPUT_DIR" ]]; then
        local new_version=$(_tut_prompt_version "$json_file")
        local current_version=$(jq -r '.metadata.version // "0.0.0"' "$json_file")
        if [[ "$new_version" != "$current_version" ]]; then
            _tut_update_metadata "$json_file" "$new_version"
        fi
    fi

    echo ""

    # Build based on type and format
    case "$doc_type" in
        guide)
            case "$format" in
                html|h)      _tut_render_html "$json_file" "$output_file" ;;
                md|markdown) _tut_render_markdown "$json_file" "$output_file" ;;
                all)
                    _tut_render_html "$json_file"
                    _tut_render_markdown "$json_file"
                    ;;
                *)
                    echo "Unknown format: $format"
                    return 1
                    ;;
            esac
            ;;
        reference)
            case "$format" in
                html|h)      _tut_render_reference "$json_file" "$output_file" ;;
                md|markdown)
                    echo "Reference markdown output not yet implemented"
                    return 1
                    ;;
                all)
                    _tut_render_reference "$json_file"
                    ;;
                *)
                    echo "Unknown format: $format"
                    return 1
                    ;;
            esac
            ;;
        *)
            echo "Unknown document type: $doc_type"
            return 1
            ;;
    esac
}

_tut_source_build_all() {
    local no_bump="$1"
    local count=0
    local failed=0

    _tut_heading 2 "Building all available sources"
    echo

    if [[ ! -d "$TUT_SRC/available" ]]; then
        _tut_error "No available directory: $TUT_SRC/available"
        return 1
    fi

    shopt -s nullglob
    for file in "$TUT_SRC/available"/*.json; do
        local name=$(basename "$file")
        _tut_info "Building $name..."

        if _tut_source_build_single "$file" "" "html" "true"; then
            ((count++))
        else
            _tut_error "Failed: $name"
            ((failed++))
        fi
        echo
    done
    shopt -u nullglob

    _tut_success "Built $count file(s)"
    [[ $failed -gt 0 ]] && _tut_warn "Failed: $failed file(s)"
}

# =============================================================================
# INIT
# =============================================================================

_tut_source_init() {
    local name=""
    local doc_type="guide"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type|-t)  doc_type="$2"; shift 2 ;;
            -*)         echo "Unknown option: $1"; return 1 ;;
            *)          [[ -z "$name" ]] && name="$1"; shift ;;
        esac
    done

    if [[ -z "$name" ]]; then
        echo "Usage: tut source init <name> [--type guide|reference]"
        return 1
    fi

    name="${name%.json}"
    local output_file="${name}.json"

    if [[ -f "$output_file" ]]; then
        echo "Error: $output_file already exists"
        return 1
    fi

    # Convert name to title (my-guide -> My Guide)
    local title=$(echo "$name" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
    local now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local author=$(whoami)

    case "$doc_type" in
        guide)
            _tut_init_guide "$output_file" "$title" "$now" "$author"
            ;;
        reference)
            _tut_init_reference "$output_file" "$title" "$now" "$author"
            ;;
        *)
            echo "Unknown type: $doc_type (use: guide, reference)"
            return 1
            ;;
    esac

    echo "Created: $output_file (type: $doc_type)"
    echo ""
    echo "Next steps:"
    echo "  1. Edit $output_file"
    echo "  2. tut source validate $output_file"
    echo "  3. tut source build $output_file"
}

# =============================================================================
# VALIDATE
# =============================================================================

_tut_source_validate() {
    local json_file="$1"

    if [[ -z "$json_file" ]]; then
        echo "Usage: tut source validate <name>"
        return 1
    fi

    # Resolve path
    if [[ ! -f "$json_file" ]]; then
        [[ ! "$json_file" == *.json ]] && json_file="${json_file}.json"
        [[ ! -f "$json_file" && -f "$TUT_SRC/available/$json_file" ]] && \
            json_file="$TUT_SRC/available/$json_file"
    fi

    _tut_validate "$json_file"
}

# =============================================================================
# EDIT
# =============================================================================

_tut_source_edit() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: tut source edit <name>"
        echo
        echo "Available sources:"
        _tut_source_list
        return 1
    fi

    # Resolve path
    local file="$name"
    if [[ ! -f "$file" ]]; then
        [[ ! "$file" == *.json ]] && file="${file}.json"
        [[ ! -f "$file" && -f "$TUT_SRC/available/$file" ]] && \
            file="$TUT_SRC/available/$file"
    fi

    if [[ ! -f "$file" ]]; then
        _tut_error "Source not found: $name"
        return 1
    fi

    ${EDITOR:-vim} "$file"
}

# =============================================================================
# HYDRATE
# =============================================================================

_tut_source_hydrate() {
    # Delegate to hydrate module
    if [[ -f "$TUT_SRC/core/hydrate.sh" ]]; then
        source "$TUT_SRC/core/hydrate.sh"
        tut_hydrate "$@"
    else
        _tut_error "Hydrate module not found"
        return 1
    fi
}
