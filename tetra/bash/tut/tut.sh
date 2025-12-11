#!/usr/bin/env bash
# tut.sh - Data-Driven Documentation Generator
#
# Generates two types of documentation from JSON:
#   guide     - Step-by-step interactive guides
#   reference - Scrollable topic-based docs
#
# Type is auto-detected from JSON structure or specified with --type

# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

tut() {
    local action="${1:-help}"
    shift || true

    case "$action" in
        build|b)       _tut_build "$@" ;;
        init|i)        _tut_init "$@" ;;
        validate|v)    _tut_validate "$@" ;;
        serve|s)       _tut_serve "$@" ;;
        get)           _tut_get "$@" ;;
        edit)          _tut_edit "$@" ;;
        extras|x)      _tut_extras "$@" ;;
        doctor|d)      _tut_doctor ;;
        types|t)       _tut_types "$@" ;;
        hydrate|h)     tut_hydrate "$@" ;;
        run|r)         _tut_run "$@" ;;
        help|--help|-h|"") _tut_help ;;
        *)
            echo "Unknown command: $action"
            _tut_help
            return 1
            ;;
    esac
}

# =============================================================================
# HELP
# =============================================================================

_tut_help() {
    _tut_heading 1 "tut - Data-Driven Documentation Generator"
    _tut_section "FIRST USE"
    echo "  init <name> [--type]    Create JSON template (guide|reference)"
    echo "  get sources             List source files ready to build"
    echo "  doctor                  Show environment and paths"

    _tut_section "BUILD & PREVIEW"
    echo "  build <name>            Build from sources (tut build nh-ref)"
    echo "  build index             Generate landing page for all docs"
    echo "  build --all             Build all source files"
    echo "  serve [file]            Preview in browser"

    _tut_section "INTERACTIVE"
    echo "  hydrate <template>      Substitute {{variables}} from org"
    echo "  run <guide> [--org]     Hydrate + serve with real terminal"

    _tut_section "UNDERSTAND"
    echo "  types                   Document types overview"
    echo "  types guide             Guide schema and structure"
    echo "  types reference         Reference schema and structure"
    echo "  extras                  Build extras (design-tokens, mindmap)"

    _tut_section "QUERY"
    echo "  get sources [-v]        Source JSON files (-v for full paths)"
    echo "  get docs                Generated documents"
    echo "  get recordings          Terminal recordings"

    _tut_section "PATHS"
    echo "  Source  $TUT_SRC"
    echo "  Output  $TUT_DIR/generated"
}

_tut_types() {
    local subtype="${1:-}"

    case "$subtype" in
        "")        _tut_types_overview ;;
        guide)     _tut_types_guide ;;
        reference) _tut_types_reference ;;
        *)
            _tut_error "Unknown type: $subtype"
            _tut_info "Try: tut types [guide|reference]"
            return 1
            ;;
    esac
}

_tut_types_overview() {
    _tut_heading 1 "TUT Document Types"
    echo
    echo "  guide      Step-by-step guides with terminal simulation"
    echo "  reference  Scrollable topic-based documentation"
    echo
    echo "  Use: tut types <type> for details and schema"
}

_tut_types_guide() {
    _tut_heading 2 "Guide Type"
    echo
    echo "  Structure: Linear steps with content blocks and terminal output"
    echo "  Output:    Interactive HTML with step navigation"
    echo "  Use for:   Onboarding, walkthroughs, learning paths"
    echo
    echo "  JSON: { metadata, steps: [{ id, title, content, terminal }] }"
    echo
    _tut_heading 3 "Schema"
    echo
    if [[ -f "$TUT_SRC/schemas/guide.schema.json" ]]; then
        jq '.' "$TUT_SRC/schemas/guide.schema.json"
    else
        _tut_error "Schema not found: $TUT_SRC/schemas/guide.schema.json"
    fi
}

_tut_types_reference() {
    _tut_heading 2 "Reference Type"
    echo
    echo "  Structure: Groups containing topics with content blocks"
    echo "  Output:    Scrollable HTML with sidebar navigation"
    echo "  Use for:   API docs, command reference, configuration"
    echo
    echo "  JSON: { metadata, groups: [{ id, title, topics: [...] }] }"
    echo
    _tut_heading 3 "Schema"
    echo
    if [[ -f "$TUT_SRC/schemas/reference.schema.json" ]]; then
        jq '.' "$TUT_SRC/schemas/reference.schema.json"
    else
        _tut_error "Schema not found: $TUT_SRC/schemas/reference.schema.json"
    fi
}

# =============================================================================
# EXTRAS - Build Extras Documentation
# =============================================================================

_tut_extras() {
    local extra="${1:-}"

    case "$extra" in
        "")            _tut_extras_overview ;;
        design-tokens) _tut_extras_design_tokens ;;
        mindmap)       _tut_extras_mindmap ;;
        tds)           _tut_extras_tds ;;
        *)
            _tut_error "Unknown extra: $extra"
            _tut_info "Try: tut extras [design-tokens|mindmap|tds]"
            return 1
            ;;
    esac
}

_tut_extras_overview() {
    _tut_heading 1 "TUT Build Extras"
    echo
    echo "  Extras are optional features automatically included in built documents."
    echo "  Some are always-on, others are URL-activated or JSON-configured."
    echo

    _tut_section "ALWAYS INCLUDED"
    _tut_extras_row "design-tokens" "?design=true" "Live theme editor FAB"
    _tut_extras_row "mindmap"       "content block" "Visual concept maps"

    _tut_section "JSON-CONFIGURED"
    _tut_extras_row "tds"           "metadata.theme.tds" "Tetra Design System theme"

    _tut_section "FILES"
    echo "  Location: \$TUT_SRC/templates/"
    echo
    _tut_path "base-styles.css" "$TUT_SRC/templates/base-styles.css"
    _tut_path "base-script.js" "$TUT_SRC/templates/base-script.js"
    _tut_path "design-tokens.*" "$TUT_SRC/templates/design-tokens.css"
    _tut_path "mindmap/*" "$TUT_SRC/templates/mindmap/"

    echo
    _tut_info "Use: tut extras <name> for details"
}

_tut_extras_row() {
    local name="$1"
    local activation="$2"
    local desc="$3"
    printf "  %-16s %-20s %s\n" "$name" "$activation" "$desc"
}

_tut_extras_design_tokens() {
    _tut_heading 1 "Design Tokens Extra"
    echo
    _tut_section "OVERVIEW"
    echo "  Live theme editor for customizing document appearance."
    echo "  Provides window.TUT namespace for theme management."
    echo

    _tut_section "ACTIVATION"
    echo "  URL parameter:    ?design=true"
    echo "  Always bundled:   Yes (hidden by default)"
    echo

    _tut_section "FEATURES"
    echo "  • Floating Action Button (FAB) in bottom-right"
    echo "  • Color token editor with live preview"
    echo "  • Layout settings (border style, radius, sidebar)"
    echo "  • Typography (heading, body, code fonts)"
    echo "  • Google Fonts integration"
    echo "  • Theme save/load/export (JSON, CSS, JS)"
    echo "  • Element Inspector (Shift+hold on any element)"
    echo

    _tut_section "JAVASCRIPT API"
    echo "  TUT.Tokens.get('--bg-primary')      Get token value"
    echo "  TUT.Tokens.set('--bg-primary', x)   Set token value"
    echo "  TUT.Theme.build()                   Export current theme"
    echo "  TUT.Theme.apply(theme)              Apply theme object"
    echo "  TUT.Theme.save('name')              Save to localStorage"
    echo

    _tut_section "FILES"
    _tut_path "CSS" "$TUT_SRC/templates/design-tokens.css"
    _tut_path "HTML" "$TUT_SRC/templates/design-tokens.html"
    _tut_path "JS" "$TUT_SRC/templates/design-tokens.js"

    _tut_section "USAGE"
    echo "  # View any tut doc in design mode:"
    echo "  open \"\$TUT_DIR/generated/my-guide.html?design=true\""
}

_tut_extras_mindmap() {
    _tut_heading 1 "Mindmap Extra"
    echo
    _tut_section "OVERVIEW"
    echo "  Visual radial diagrams for concept relationships."
    echo "  Auto-included when content contains mindmap blocks."
    echo

    _tut_section "ACTIVATION"
    echo "  Content block:    { \"type\": \"mindmap\", ... }"
    echo "  Always bundled:   Yes (CSS/JS included if block present)"
    echo

    _tut_section "JSON STRUCTURE"
    cat << 'JSON'
  {
    "type": "mindmap",
    "title": "Optional caption",
    "center": { "label": "Core", "sub": "subtitle" },
    "spokes": [
      { "label": "Node 1", "sub": "detail", "path": "/path", "description": "..." },
      { "label": "Node 2", "sub": "detail" }
    ]
  }
JSON
    echo

    _tut_section "FILES"
    _tut_path "CSS" "$TUT_SRC/templates/mindmap/mindmap.css"
    _tut_path "JS" "$TUT_SRC/templates/mindmap/mindmap.js"
}

_tut_extras_tds() {
    _tut_heading 1 "TDS Theme Extra"
    echo
    _tut_section "OVERVIEW"
    echo "  Apply Tetra Design System themes to documents."
    echo "  Themes are defined in \$TETRA_SRC/bash/tds/."
    echo

    _tut_section "ACTIVATION"
    echo "  JSON metadata:    \"theme\": { \"tds\": \"theme-name\" }"
    echo "  Requires:         TDS module loaded"
    echo

    _tut_section "EXAMPLE"
    cat << 'JSON'
  {
    "metadata": {
      "title": "My Guide",
      "theme": {
        "tds": "dracula"
      }
    },
    ...
  }
JSON
    echo

    _tut_section "AVAILABLE THEMES"
    if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
        source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null
        if declare -f tds_list_themes &>/dev/null; then
            tds_list_themes 2>/dev/null | head -10
        else
            echo "  (TDS loaded but tds_list_themes not available)"
        fi
    else
        echo "  (TDS module not found)"
    fi
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

    _tut_section "SCHEMAS"
    _tut_doctor_file "guide" "$TUT_SRC/schemas/guide.schema.json"
    _tut_doctor_file "reference" "$TUT_SRC/schemas/reference.schema.json"

    _tut_section "AVAILABLE SOURCES"
    if [[ -d "$TUT_SRC/available" ]]; then
        local count=0
        shopt -s nullglob
        for file in "$TUT_SRC/available"/*.json; do
            local name=$(basename "$file")
            local doc_type=$(_tut_detect_type "$file")
            _tut_row "$name" "[$doc_type]" ""
            ((count++))
        done
        shopt -u nullglob
        [[ $count -eq 0 ]] && _tut_dim "  (none)"; echo
    else
        _tut_warn "directory missing"
    fi

    _tut_section "GENERATED DOCS"
    if [[ -d "$TUT_DIR/generated" ]]; then
        local count=0
        shopt -s nullglob
        for file in "$TUT_DIR/generated"/*.html "$TUT_DIR/generated"/*.md; do
            if [[ -f "$file" ]]; then
                local name=$(basename "$file")
                local size=$(du -h "$file" | cut -f1)
                _tut_row "$name" "$size" ""
                ((count++))
            fi
        done
        shopt -u nullglob
        [[ $count -eq 0 ]] && _tut_dim "  (none)"; echo
    else
        _tut_warn "directory missing"
    fi

    _tut_section "BUILD EXTRAS"
    _tut_doctor_extra "design-tokens" "$TUT_SRC/templates/design-tokens.js" "?design=true"
    _tut_doctor_extra "mindmap" "$TUT_SRC/templates/mindmap/mindmap.js" "content block"
    _tut_doctor_extra "tds" "$TETRA_SRC/bash/tds/tds.sh" "metadata.theme.tds"

    _tut_section "DEPENDENCIES"
    _tut_doctor_cmd "jq"
    _tut_doctor_cmd "open" "xdg-open"
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

_tut_doctor_cmd() {
    local cmd="$1"
    local alt="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        _tut_success "$cmd → $(command -v "$cmd")"
    elif [[ -n "$alt" ]] && command -v "$alt" >/dev/null 2>&1; then
        _tut_success "$alt → $(command -v "$alt")"
    else
        _tut_error "$cmd (missing)"
    fi
}

# =============================================================================
# TYPE DETECTION
# =============================================================================

_tut_detect_type() {
    local json_file="$1"

    # Check for distinguishing keys
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

# =============================================================================
# VERSION MANAGEMENT
# =============================================================================

_tut_bump_version() {
    local version="$1"
    local bump_type="$2"  # patch, minor, major

    local major minor patch
    IFS='.' read -r major minor patch <<< "$version"

    # Default to 0 if not set
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

    # Show current version and prompt
    echo "Version: $current_version" >&2
    echo -n "New version? [enter=keep, p/m/M=bump, or type version]: " >&2
    read -r response </dev/tty

    case "$response" in
        "")      echo "$current_version" ;;  # default: no change
        p)       _tut_bump_version "$current_version" "patch" ;;
        m)       _tut_bump_version "$current_version" "minor" ;;
        M)       _tut_bump_version "$current_version" "major" ;;
        *)
            # Validate semver-ish format (x.y.z)
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

    # Create temp file with updated metadata
    local tmp_file=$(mktemp)
    jq --arg v "$new_version" --arg u "$now" '
        .metadata.version = $v |
        .metadata.updated = $u
    ' "$json_file" > "$tmp_file"

    mv "$tmp_file" "$json_file"
    echo "Updated: version=$new_version, updated=$now"
}

# =============================================================================
# BUILD
# =============================================================================

_tut_build() {
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
            _tut_build_single "$file" "$doc_type" "$format" "$no_bump" || ((failed++))
        done
        unset TUT_OUTPUT_DIR
        [[ $failed -gt 0 ]] && return 1
        return 0
    fi

    local json_file="${json_files[0]:-}"

    # Build all available sources
    if [[ "$build_all" == true ]]; then
        _tut_build_all "$no_bump"
        local ret=$?
        unset TUT_OUTPUT_DIR
        return $ret
    fi

    # Handle special 'index' target
    if [[ "$json_file" == "index" ]]; then
        _tut_index
        local ret=$?
        unset TUT_OUTPUT_DIR
        return $ret
    fi

    if [[ -z "$json_file" ]]; then
        echo "Usage: tut build <name...> [--out dir] [--type guide|reference] [--format html|md|all]"
        echo "       tut build --all [--no-bump]"
        unset TUT_OUTPUT_DIR
        return 1
    fi

    _tut_build_single "$json_file" "$doc_type" "$format" "$no_bump" "$output_file"
    local ret=$?
    unset TUT_OUTPUT_DIR
    return $ret
}

# Build a single file
_tut_build_single() {
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

_tut_build_all() {
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

        local build_args=("$file")
        [[ "$no_bump" == "true" ]] && build_args+=("--no-bump")

        # Call build for each file (suppress version prompt with --no-bump for batch)
        if _tut_build "${build_args[@]}" --no-bump; then
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

_tut_init() {
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
        echo "Usage: tut init <name> [--type guide|reference]"
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
    echo "  2. tut validate $output_file"
    echo "  3. tut build $output_file"
}

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
# SERVE
# =============================================================================

_tut_serve() {
    local file="" port="" action="start"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --stop)       action="stop"; shift ;;
            --status)     action="status"; shift ;;
            --port|-p)    port="$2"; shift 2 ;;
            -*)           echo "Unknown option: $1"; return 1 ;;
            *)            file="$1"; shift ;;
        esac
    done

    local serve_dir="$TUT_DIR/generated"

    # Check TSM is available
    if ! declare -f tsm >/dev/null 2>&1; then
        _tut_error "TSM not loaded. Source tetra first."
        return 1
    fi

    case "$action" in
        start)
            # Ensure directory exists
            mkdir -p "$serve_dir"

            # Start via TSM using the tut service
            # TSM will handle port allocation and process management
            if [[ -n "$port" ]]; then
                tsm start --port "$port" tut
            else
                tsm start tut
            fi

            # Open specific file if provided
            if [[ -n "$file" ]]; then
                # Give server a moment to start
                sleep 0.5
                # Get the port from the running process
                local running_port=$(tsm ls 2>/dev/null | grep -E "tut.*online" | awk '{print $5}' | head -1)
                if [[ -n "$running_port" ]]; then
                    [[ "$file" != /* && ! -f "$file" ]] && file="$serve_dir/$file"
                    local url="http://localhost:$running_port/$(basename "$file")"
                    _tut_open_url "$url"
                fi
            fi
            ;;

        stop)
            # Find and stop tut processes
            local pids=$(tsm ls 2>/dev/null | grep -E "^\s*[0-9]+.*tut" | awk '{print $1}')
            if [[ -n "$pids" ]]; then
                for pid in $pids; do
                    tsm stop "$pid"
                done
                _tut_success "Server stopped"
            else
                _tut_info "Server not running"
            fi
            ;;

        status)
            tsm ls 2>/dev/null | grep -E "(ID|tut)" || echo "Not running"
            ;;
    esac
}

# =============================================================================
# INDEX - Generate landing page
# =============================================================================

_tut_index() {
    # Respect TUT_OUTPUT_DIR if set (from --out flag)
    local output_dir="${TUT_OUTPUT_DIR:-$TUT_DIR/generated}"
    local output_file="$output_dir/index.html"
    local now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    mkdir -p "$output_dir"

    # Collect doc info from output directory
    local docs=()
    shopt -s nullglob
    for file in "$output_dir"/*.html; do
        [[ "$(basename "$file")" == "index.html" ]] && continue
        [[ -f "$file" ]] || continue

        local name=$(basename "$file")
        local title=$(grep -o '<title>[^<]*</title>' "$file" 2>/dev/null | sed 's/<[^>]*>//g')
        local version=$(grep -o 'name="tut:version" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
        local doc_type=$(grep -o 'name="tut:type" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
        local updated=$(grep -o 'name="tut:updated" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')

        [[ -z "$title" ]] && title="$name"
        [[ -z "$doc_type" ]] && doc_type="doc"
        [[ -z "$version" ]] && version="-"

        docs+=("$name|$title|$doc_type|$version|$updated")
    done
    shopt -u nullglob

    if [[ ${#docs[@]} -eq 0 ]]; then
        _tut_warn "No documents found in $output_dir"
        return 1
    fi

    # Generate HTML
    cat > "$output_file" << 'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TUT Documentation</title>
    <style>
        :root {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-card: #0d1b2a;
            --text-title: #eaeaea;
            --text-primary: #c0c0d0;
            --text-secondary: #8a8aa0;
            --accent: #e94560;
            --border: #2a2a4a;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h1 {
            color: var(--text-title);
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }
        .doc-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
        }
        .doc-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem;
            text-decoration: none;
            transition: border-color 0.2s, transform 0.2s;
        }
        .doc-card:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
        }
        .doc-title {
            color: var(--text-title);
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        .doc-meta {
            display: flex;
            gap: 1rem;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        .doc-type {
            background: var(--bg-secondary);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            text-transform: uppercase;
            font-size: 0.7rem;
            letter-spacing: 0.5px;
        }
        .doc-type.reference { color: #60a5fa; }
        .doc-type.guide { color: #4ade80; }
        footer {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            font-size: 0.75rem;
            color: var(--text-secondary);
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Documentation</h1>
        <p class="subtitle">Generated with TUT</p>
        <div class="doc-grid">
HEADER

    # Add each doc card
    for doc in "${docs[@]}"; do
        IFS='|' read -r name title doc_type version updated <<< "$doc"
        cat >> "$output_file" << CARD
            <a href="$name" class="doc-card">
                <div class="doc-title">$title</div>
                <div class="doc-meta">
                    <span class="doc-type $doc_type">$doc_type</span>
                    <span>v$version</span>
                </div>
            </a>
CARD
    done

    # Close HTML
    cat >> "$output_file" << FOOTER
        </div>
        <footer>
            ${#docs[@]} documents • Generated $now
        </footer>
    </div>
</body>
</html>
FOOTER

    _tut_success "Generated index.html"
    echo "  ${#docs[@]} documents"
    echo "  $output_file"
}

# =============================================================================
# GET
# =============================================================================

_tut_get() {
    local noun="${1:-}"
    shift 2>/dev/null || true

    case "$noun" in
        "")
            _tut_heading 2 "tut get <noun>"
            echo
            echo "  sources [-v]  List source JSON files (-v for full paths)"
            echo "  docs          List generated documents"
            echo "  recordings    List terminal recordings"
            return 0
            ;;
        sources)
            _tut_get_sources "$@"
            ;;
        docs)
            _tut_get_docs "$@"
            ;;
        recordings)
            _tut_get_recordings "$@"
            ;;
        *)
            _tut_error "Unknown: $noun"
            _tut_info "Try: tut get"
            return 1
            ;;
    esac
}

_tut_get_sources() {
    local verbose=false
    [[ "$1" == "-v" || "$1" == "--verbose" ]] && verbose=true

    _tut_heading 2 "Source Files"
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
            _tut_label "Build:" "tut build available/<name>.json"
        fi
    else
        _tut_warn "No available directory"
    fi
}

_tut_get_docs() {
    _tut_heading 2 "Generated Documents"
    echo

    if [[ -d "$TUT_DIR/generated" ]]; then
        local count=0
        local missing_provenance=0
        shopt -s nullglob
        for file in "$TUT_DIR/generated"/*.html "$TUT_DIR/generated"/*.md; do
            if [[ -f "$file" ]]; then
                local name=$(basename "$file")
                local size=$(du -h "$file" | cut -f1)

                # Extract metadata from HTML
                local source="" version="" doc_type=""
                if [[ "$file" == *.html ]]; then
                    source=$(grep -o 'name="tut:source" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
                    version=$(grep -o 'name="tut:version" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
                    doc_type=$(grep -o 'name="tut:type" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
                fi

                # Format display
                local version_str=""
                [[ -n "$version" ]] && version_str="v$version"
                local source_str=""
                if [[ -n "$source" ]]; then
                    source_str="← $source"
                else
                    source_str="(no provenance)"
                    ((missing_provenance++))
                fi

                printf "  %-28s %6s %4s  %s\n" "$name" "$version_str" "$size" "$source_str"
                ((count++))
            fi
        done
        shopt -u nullglob

        if [[ $count -eq 0 ]]; then
            _tut_dim "  (none)"; echo
        else
            echo
            echo "  Total: $count file(s)"
            [[ $missing_provenance -gt 0 ]] && echo "  Rebuild $missing_provenance file(s) to add provenance metadata"
        fi
    else
        _tut_warn "No generated directory"
    fi
}

_tut_get_recordings() {
    _tut_heading 2 "Recordings"
    echo

    if [[ -d "$TUT_DIR/recordings" ]]; then
        local count=0
        shopt -s nullglob
        for dir in "$TUT_DIR/recordings"/*/; do
            if [[ -d "$dir" ]]; then
                local name=$(basename "$dir")
                local flags=""
                [[ -f "$dir/typescript.txt" ]] && flags+="ts "
                [[ -f "$dir/timing.txt" ]] && flags+="tm"
                _tut_row "$name" "[$flags]" ""
                ((count++))
            fi
        done
        shopt -u nullglob

        if [[ $count -eq 0 ]]; then
            _tut_dim "  (none)"; echo
        else
            echo
            _tut_info "Total: $count recording(s)"
        fi
    else
        _tut_warn "No recordings directory"
    fi
}

# =============================================================================
# EDIT
# =============================================================================

_tut_edit() {
    local noun="${1:-}"

    case "$noun" in
        "")
            _tut_heading 2 "tut edit <noun>"
            echo
            echo "  guide-schema      Edit guide schema"
            echo "  reference-schema  Edit reference schema"
            return 0
            ;;
        guide-schema)
            _tut_edit_schema "$TUT_SRC/schemas/guide.schema.json"
            ;;
        reference-schema)
            _tut_edit_schema "$TUT_SRC/schemas/reference.schema.json"
            ;;
        *)
            _tut_error "Unknown noun: $noun"
            _tut_info "Try: tut edit"
            return 1
            ;;
    esac
}

_tut_edit_schema() {
    local schema_file="$1"

    if [[ ! -f "$schema_file" ]]; then
        _tut_error "Schema not found: $schema_file"
        return 1
    fi

    ${EDITOR:-vim} "$schema_file"
}

# =============================================================================
# RUN - Interactive guide with real terminal
# =============================================================================

_tut_run() {
    local guide=""
    local org=""
    local port="4446"
    local no_browser=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org)
                org="$2"
                shift 2
                ;;
            --port)
                port="$2"
                shift 2
                ;;
            --no-browser)
                no_browser=true
                shift
                ;;
            -*)
                _tut_error "Unknown option: $1"
                return 1
                ;;
            *)
                guide="$1"
                shift
                ;;
        esac
    done

    [[ -z "$guide" ]] && {
        _tut_heading 2 "tut run - Interactive Guide"
        echo
        echo "  Usage: tut run <guide> [--org <name>] [--port <port>]"
        echo
        echo "  Examples:"
        echo "    tut run tkm-guide --org pixeljam-arcade"
        echo "    tut run tkm-guide.template.json --org myorg"
        echo
        echo "  This will:"
        echo "    1. Hydrate template with org values (if template)"
        echo "    2. Build the guide HTML"
        echo "    3. Start tut-interactive server"
        echo "    4. Open in browser with real terminal"
        return 1
    }

    _tut_heading 2 "Interactive Guide: $guide"
    echo

    # Step 1: Find and hydrate if template
    local guide_path=""
    local is_template=false

    if [[ -f "$guide" ]]; then
        guide_path="$guide"
    elif [[ -f "$TUT_SRC/available/$guide" ]]; then
        guide_path="$TUT_SRC/available/$guide"
    elif [[ -f "$TUT_SRC/available/${guide}.template.json" ]]; then
        guide_path="$TUT_SRC/available/${guide}.template.json"
        is_template=true
    elif [[ -f "$TUT_SRC/available/${guide}.json" ]]; then
        guide_path="$TUT_SRC/available/${guide}.json"
    else
        _tut_error "Guide not found: $guide"
        return 1
    fi

    # Hydrate if template
    local final_guide="$guide_path"
    if [[ "$guide_path" == *".template."* ]] || $is_template; then
        _tut_info "Hydrating template..."

        # Source hydrate module
        source "$TUT_SRC/core/hydrate.sh"

        local hydrate_args=("$guide_path")
        [[ -n "$org" ]] && hydrate_args+=(--org "$org")

        final_guide=$(tut_hydrate "${hydrate_args[@]}")
        [[ $? -ne 0 ]] && return 1
    fi

    # Step 2: Build HTML
    _tut_info "Building guide..."
    local guide_name=$(basename "$final_guide" .json)
    _tut_build "$guide_name"
    [[ $? -ne 0 ]] && return 1

    # Step 3: Start tut-interactive server
    _tut_info "Starting interactive server..."

    # Check if already running
    local running=$(tsm ls 2>/dev/null | grep -E "tut-interactive.*online" | head -1)
    if [[ -z "$running" ]]; then
        # Install dependencies if needed
        if [[ ! -d "$TUT_SRC/server/node_modules" ]]; then
            _tut_info "Installing server dependencies..."
            (cd "$TUT_SRC/server" && npm install --silent)
        fi

        # Start via TSM or directly
        if command -v tsm &>/dev/null; then
            tsm start tut-interactive 2>/dev/null || {
                # Fall back to direct start
                (cd "$TUT_SRC/server" && node tut-server.js --port "$port" &)
                sleep 1
            }
        else
            (cd "$TUT_SRC/server" && node tut-server.js --port "$port" &)
            sleep 1
        fi
    fi

    # Step 4: Open in browser
    local url="http://127.0.0.1:$port/guide/$guide_name"
    _tut_accent "Opening: $url"

    if ! $no_browser; then
        if command -v open &>/dev/null; then
            open "$url"
        elif command -v xdg-open &>/dev/null; then
            xdg-open "$url"
        else
            _tut_info "Open in browser: $url"
        fi
    fi

    echo
    _tut_info "Server running. Stop with: tsm stop tut-interactive"
}

export -f tut
