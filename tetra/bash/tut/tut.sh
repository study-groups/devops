#!/usr/bin/env bash
# tut.sh - Data-Driven Documentation Generator
#
# doctl-style taxonomy: tut <resource> <verb> [args]
#
# Resources:
#   source      JSON source files (list, build, init, validate, edit, hydrate)
#   doc         Generated documents (list, serve, open, index, run, browse)
#   recording   Terminal recordings (list, play, capture)
#   schema      JSON schemas (list, show, edit)
#   extra       Build extras (list, show)
#
# Top-level:
#   doctor      Check environment
#   help        Show help
#   version     Show version

# =============================================================================
# MODULE LOADING
# =============================================================================

_tut_load_modules() {
    local tut_core="$TUT_SRC/core"

    # Core utilities (required)
    [[ -f "$tut_core/output.sh" ]] && source "$tut_core/output.sh"
    [[ -f "$tut_core/validators.sh" ]] && source "$tut_core/validators.sh"

    # Resource modules
    [[ -f "$tut_core/source.sh" ]] && source "$tut_core/source.sh"
    [[ -f "$tut_core/doc.sh" ]] && source "$tut_core/doc.sh"
    [[ -f "$tut_core/recording.sh" ]] && source "$tut_core/recording.sh"
    [[ -f "$tut_core/schema.sh" ]] && source "$tut_core/schema.sh"
    [[ -f "$tut_core/extra.sh" ]] && source "$tut_core/extra.sh"

    # Legacy compatibility
    [[ -f "$tut_core/legacy.sh" ]] && source "$tut_core/legacy.sh"

    # Renderers
    [[ -f "$TUT_SRC/renderers/html.sh" ]] && source "$TUT_SRC/renderers/html.sh"
    [[ -f "$TUT_SRC/renderers/markdown.sh" ]] && source "$TUT_SRC/renderers/markdown.sh"
    [[ -f "$TUT_SRC/tut_reference.sh" ]] && source "$TUT_SRC/tut_reference.sh"
    [[ -f "$TUT_SRC/tut_browse.sh" ]] && source "$TUT_SRC/tut_browse.sh"
}

# Load modules on source
_tut_load_modules

# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

tut() {
    local resource="${1:-help}"
    shift || true

    case "$resource" in
        # Resources (doctl-style)
        source|src)       _tut_source "$@" ;;
        doc|docs)         _tut_doc "$@" ;;
        recording|rec)    _tut_recording "$@" ;;
        schema)           _tut_schema "$@" ;;
        extra)            _tut_extra "$@" ;;

        # Context management
        ctx|context)      tut_ctx "$@" ;;

        # Top-level commands
        doctor|d)         _tut_doctor ;;
        version|-v|--version) _tut_version ;;
        help|--help|-h)
            if [[ -n "${1:-}" ]]; then
                _tut_help_topic "$1"
            else
                _tut_help
            fi
            ;;

        # Aliases for ergonomics
        ls)               _tut_ls "$@" ;;
        b|build)          _tut_source build "$@" ;;
        s|serve)          _tut_doc serve "$@" ;;
        open)             _tut_doc open "$@" ;;

        # Legacy commands (with deprecation warnings)
        init)             _tut_legacy_init "$@" ;;
        validate)         _tut_legacy_validate "$@" ;;
        browse)           _tut_legacy_browse "$@" ;;
        run)              _tut_legacy_run "$@" ;;
        hydrate)          _tut_legacy_hydrate "$@" ;;
        get)              _tut_legacy_get "$@" ;;
        types)            _tut_legacy_types "$@" ;;
        extras)           _tut_legacy_extras "$@" ;;
        edit)             _tut_legacy_edit "$@" ;;

        # Unknown
        "")               _tut_help ;;
        *)
            _tut_error "Unknown: $resource"
            _tut_help
            return 1
            ;;
    esac
}

# =============================================================================
# ALIASES
# =============================================================================

_tut_ls() {
    local what="${1:-sources}"
    shift 2>/dev/null || true

    case "$what" in
        sources|src)    _tut_source_list "$@" ;;
        docs|doc)       _tut_doc_list "$@" ;;
        recordings|rec) _tut_recording_list "$@" ;;
        schemas)        _tut_schema_list "$@" ;;
        extras)         _tut_extra_list "$@" ;;
        *)
            # Default: treat as source list with verbose flag check
            if [[ "$what" == "-v" || "$what" == "--verbose" ]]; then
                _tut_source_list "$what" "$@"
            else
                _tut_error "Unknown: ls $what"
                echo "  Try: tut ls [sources|docs|recordings|schemas|extras]"
                return 1
            fi
            ;;
    esac
}

# =============================================================================
# HELP
# =============================================================================

_tut_help() {
    echo -e "\033[1;36mtut\033[0m - Data-Driven Documentation Generator"
    echo
    echo -e "\033[1;34mRESOURCES\033[0m"
    echo "  source      JSON source files (list, build, init, validate, edit)"
    echo "  doc         Generated documents (list, serve, open, index, run)"
    echo "  recording   Terminal recordings (list, play, capture)"
    echo "  schema      JSON schemas (list, show, edit)"
    echo "  extra       Build extras (list, show)"
    echo
    echo -e "\033[1;34mCONTEXT\033[0m"
    echo "  ctx         Manage TUT[org:project:subject] context"
    echo "  ctx set     Set context (creates PData structure)"
    echo "  ctx clear   Clear context"
    echo
    echo -e "\033[1;34mCOMMANDS\033[0m"
    echo "  doctor      Check environment and paths"
    echo "  help        Show help for a topic"
    echo "  version     Show version"
    echo
    echo -e "\033[1;34mQUICK\033[0m"
    echo "  tut ls [src|docs]         List sources or documents"
    echo "  tut build <name>          Build a source file"
    echo "  tut serve                 Start preview server"
    echo "  tut open <name>           Open document in browser"
    echo
    echo -e "\033[0;90mHelp:\033[0m tut <resource> for resource commands"
    echo -e "\033[0;90mLegacy:\033[0m Old commands still work (with deprecation warnings)"
}

_tut_help_topic() {
    local topic="$1"
    case "$topic" in
        source)    _tut_source help ;;
        doc)       _tut_doc help ;;
        recording) _tut_recording help ;;
        schema)    _tut_schema help ;;
        extra)     _tut_extra help ;;
        ctx)       tut_ctx help ;;
        all)       _tut_help_all ;;
        *)
            _tut_error "Unknown topic: $topic"
            echo "  Try: tut help [source|doc|recording|schema|extra|ctx|all]"
            return 1
            ;;
    esac
}

_tut_help_all() {
    echo -e "\033[1;36mtut\033[0m - Data-Driven Documentation Generator"
    echo

    _tut_section "SOURCE"
    echo "  tut source list [-v]       List available sources"
    echo "  tut source build <name>    Build single source"
    echo "  tut source build --all     Build all sources"
    echo "  tut source init <name>     Create new source template"
    echo "  tut source validate <name> Validate against schema"
    echo "  tut source edit <name>     Edit source file"
    echo "  tut source hydrate <tmpl>  Substitute template variables"

    _tut_section "DOC"
    echo "  tut doc list               List generated documents"
    echo "  tut doc serve [file]       Start preview server"
    echo "  tut doc open <name>        Open document in browser"
    echo "  tut doc index              Generate landing page"
    echo "  tut doc run <guide>        Interactive mode with terminal"
    echo "  tut doc browse <file.md>   CLI step-by-step navigator"

    _tut_section "RECORDING"
    echo "  tut recording list         List recordings"
    echo "  tut recording play <name>  Play back recording"
    echo "  tut recording capture <n>  Start new recording"

    _tut_section "SCHEMA"
    echo "  tut schema list            List available schemas"
    echo "  tut schema show <type>     Show schema details"
    echo "  tut schema edit <type>     Edit schema file"

    _tut_section "EXTRA"
    echo "  tut extra list             List build extras"
    echo "  tut extra show <name>      Show extra details"

    _tut_section "PATHS"
    echo "  Source    \$TUT_SRC/available/"
    echo "  Output    \$TUT_DIR/generated/"
    echo "  Schemas   \$TUT_SRC/schemas/"
}

# =============================================================================
# VERSION
# =============================================================================

_tut_version() {
    echo "tut 2.0.0"
    echo "doctl-style taxonomy"
}

# =============================================================================
# DOCTOR
# =============================================================================

_tut_doctor() {
    echo
    _tut_heading 1 "TUT Doctor"
    _tut_section "ENVIRONMENT"
    _tut_doctor_var "TETRA_SRC" "$TETRA_SRC"
    _tut_doctor_var "TETRA_DIR" "$TETRA_DIR"
    _tut_doctor_var "TUT_SRC" "$TUT_SRC"
    _tut_doctor_var "TUT_DIR" "$TUT_DIR"
    _tut_doctor_var "TUT_HAS_TDS" "$TUT_HAS_TDS"

    _tut_section "PATHS"
    _tut_path "Schemas" "$TUT_SRC/schemas"
    _tut_path "Available" "$TUT_SRC/available"
    _tut_path "Templates" "$TUT_SRC/templates"
    _tut_path "Generated" "$TUT_DIR/generated"

    _tut_section "MODULES"
    _tut_doctor_file "core/output.sh" "$TUT_SRC/core/output.sh"
    _tut_doctor_file "core/source.sh" "$TUT_SRC/core/source.sh"
    _tut_doctor_file "core/doc.sh" "$TUT_SRC/core/doc.sh"
    _tut_doctor_file "core/schema.sh" "$TUT_SRC/core/schema.sh"
    _tut_doctor_file "core/extra.sh" "$TUT_SRC/core/extra.sh"
    _tut_doctor_file "core/legacy.sh" "$TUT_SRC/core/legacy.sh"

    _tut_section "SCHEMAS"
    _tut_doctor_file "guide" "$TUT_SRC/schemas/guide.schema.json"
    _tut_doctor_file "reference" "$TUT_SRC/schemas/reference.schema.json"

    _tut_section "BUILD EXTRAS"
    _tut_doctor_extra "design-tokens" "$TUT_SRC/dist/tut.js" "?design=true"
    _tut_doctor_extra "mindmap" "$TUT_SRC/templates/mindmap/mindmap.js" "content block"
    _tut_doctor_extra "tds" "$TETRA_SRC/bash/tds/tds.sh" "metadata.theme.tds"

    _tut_section "DEPENDENCIES"
    _tut_doctor_cmd "jq"
    _tut_doctor_cmd "open" "xdg-open"
}

_tut_doctor_var() {
    local name="$1"
    local value="$2"
    if [[ -n "$value" ]]; then
        _tut_label "  $name:" "$value"
    else
        _tut_label "  $name:" "(not set)"
    fi
}

_tut_doctor_file() {
    local label="$1"
    local path="$2"
    if [[ -f "$path" ]]; then
        _tut_success "$label"
    else
        _tut_error "$label (missing)"
    fi
}

_tut_doctor_extra() {
    local name="$1"
    local file="$2"
    local activation="$3"

    if [[ -f "$file" ]]; then
        printf "  %-16s " "$name"
        _tut_success "ready"
        _tut_dim "    activation: $activation"; echo
    else
        printf "  %-16s " "$name"
        _tut_warn "missing"
    fi
}

_tut_doctor_cmd() {
    local cmd="$1"
    local alt="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        _tut_success "$cmd -> $(command -v "$cmd")"
    elif [[ -n "$alt" ]] && command -v "$alt" >/dev/null 2>&1; then
        _tut_success "$alt -> $(command -v "$alt")"
    else
        _tut_error "$cmd (missing)"
    fi
}

# =============================================================================
# SHARED UTILITIES (used by multiple modules)
# =============================================================================

_tut_detect_type() {
    local json_file="$1"

    local has_steps=$(jq 'has("steps")' "$json_file" 2>/dev/null)
    local has_groups=$(jq 'has("groups")' "$json_file" 2>/dev/null)

    if [[ "$has_steps" == "true" ]]; then
        echo "guide"
    elif [[ "$has_groups" == "true" ]]; then
        echo "reference"
    else
        echo "unknown"
    fi
}

_tut_bump_version() {
    local version="$1"
    local bump_type="$2"

    local major minor patch
    IFS='.' read -r major minor patch <<< "$version"

    major=${major:-0}
    minor=${minor:-0}
    patch=${patch:-0}

    case "$bump_type" in
        major|M) echo "$((major + 1)).0.0" ;;
        minor|m) echo "$major.$((minor + 1)).0" ;;
        patch|p) echo "$major.$minor.$((patch + 1))" ;;
        *)       echo "$version" ;;
    esac
}

_tut_prompt_version() {
    local json_file="$1"
    local current_version=$(jq -r '.metadata.version // "0.0.0"' "$json_file")

    echo "Version: $current_version" >&2
    echo -n "New version? [enter=keep, p/m/M=bump, or type version]: " >&2
    read -r response </dev/tty

    case "$response" in
        "")      echo "$current_version" ;;
        p)       _tut_bump_version "$current_version" "patch" ;;
        m)       _tut_bump_version "$current_version" "minor" ;;
        M)       _tut_bump_version "$current_version" "major" ;;
        *)
            if [[ "$response" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "$response"
            else
                echo "Invalid version format, keeping $current_version" >&2
                echo "$current_version"
            fi
            ;;
    esac
}

_tut_update_metadata() {
    local json_file="$1"
    local new_version="$2"
    local now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local tmp_file=$(mktemp)
    jq --arg v "$new_version" --arg u "$now" '
        .metadata.version = $v |
        .metadata.updated = $u
    ' "$json_file" > "$tmp_file"

    mv "$tmp_file" "$json_file"
    echo "Updated: version=$new_version, updated=$now"
}

# =============================================================================
# INIT TEMPLATES (used by source init)
# =============================================================================

_tut_init_guide() {
    local output_file="$1" title="$2" now="$3" author="$4"

    cat > "$output_file" <<EOF
{
  "metadata": {
    "title": "$title",
    "subtitle": "A step-by-step guide",
    "description": "Description of what this guide covers",
    "version": "0.0.1",
    "author": "$author",
    "created": "$now",
    "difficulty": "beginner",
    "estimatedTime": 15
  },
  "steps": [
    {
      "id": "welcome",
      "title": "Welcome",
      "content": [
        { "type": "paragraph", "text": "Welcome to this guide!" },
        {
          "type": "learn-box",
          "title": "What You'll Learn",
          "content": [
            { "type": "list", "items": ["First concept", "Second concept"] }
          ]
        }
      ],
      "terminal": [
        { "type": "comment", "content": "# Welcome" },
        { "type": "prompt", "content": "$ ", "inline": true },
        { "type": "command", "content": "echo 'Ready!'" },
        { "type": "output-success", "content": "Ready!" }
      ]
    },
    {
      "id": "conclusion",
      "title": "Conclusion",
      "content": [
        { "type": "paragraph", "text": "You've completed this guide!" }
      ],
      "terminal": [
        { "type": "output-success", "content": "Guide complete!" }
      ]
    }
  ]
}
EOF
}

_tut_init_reference() {
    local output_file="$1" title="$2" now="$3" author="$4"

    cat > "$output_file" <<EOF
{
  "metadata": {
    "title": "$title",
    "tagline": "Reference documentation",
    "description": "Description of this reference",
    "version": "0.0.1",
    "author": "$author",
    "created": "$now"
  },
  "groups": [
    {
      "id": "getting-started",
      "title": "Getting Started",
      "topics": [
        {
          "id": "overview",
          "title": "Overview",
          "description": "Introduction to this topic.",
          "content": [
            { "type": "paragraph", "text": "This is an overview paragraph." },
            {
              "type": "command-list",
              "commands": [
                { "code": "example command", "description": "What it does" }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "api",
      "title": "API Reference",
      "collapsed": true,
      "topics": [
        {
          "id": "endpoints",
          "title": "Endpoints",
          "content": [
            {
              "type": "api-endpoint",
              "method": "GET",
              "path": "/api/example",
              "summary": "Example endpoint",
              "responses": [
                { "status": 200, "description": "Success" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
EOF
}

# =============================================================================
# EXPORT
# =============================================================================

export -f tut
