#!/usr/bin/env bash
# tut.sh - Data-Driven Documentation Generator
#
# Generates two types of documentation from JSON:
#   tutorial  - Step-by-step interactive guides
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
        types)         _tut_types ;;
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
    cat <<'EOF'
TUT - Data-Driven Documentation Generator

Usage: tut <verb> <noun> [options]

Commands:
  build <json> [options]    Build docs from JSON (prompts for version bump)
  init <name> [--type]      Create new JSON template
  validate <json>           Validate JSON structure
  serve <file>              Preview in browser
  get <noun>                Get resources (schemas, docs, recordings)
  edit <noun>               Edit resources (schemas)
  types                     Explain document types

Get Nouns:
  schemas                   List available schemas
  tutorial-schema           Show tutorial schema
  reference-schema          Show reference schema
  docs                      List generated documents
  recordings                List recordings

Edit Nouns:
  tutorial-schema           Edit tutorial schema
  reference-schema          Edit reference schema

Build Options:
  --type tutorial|reference   Doc type (auto-detected if omitted)
  --format html|md|all        Output format (default: html)
  --output <file>             Custom output path
  --no-bump                   Skip version bump prompt

Examples:
  tut get schemas
  tut get tutorial-schema
  tut edit reference-schema
  tut init my-guide --type tutorial
  tut build my-guide.json
  tut serve my-guide.html

EOF
    echo "Paths:"
    echo "  TUT_SRC: $TUT_SRC"
    echo "  TUT_DIR: $TUT_DIR"
}

_tut_types() {
    cat <<'EOF'
TUT Document Types
==================

TUTORIAL (step-by-step guide)
  Structure: Linear steps with content blocks and terminal output
  Output: Interactive HTML with step navigation, terminal simulation
  Use for: Onboarding, walkthroughs, learning paths

  JSON structure:
    {
      "metadata": { "title", "version", ... },
      "steps": [
        { "id", "title", "content": [...], "terminal": [...] }
      ]
    }

REFERENCE (topic-based docs)
  Structure: Groups containing topics with content blocks
  Output: Scrollable HTML with sidebar navigation, scroll spy
  Use for: API docs, command reference, configuration guides

  JSON structure:
    {
      "metadata": { "title", "version", ... },
      "groups": [
        { "id", "title", "topics": [
          { "id", "title", "content": [...] }
        ]}
      ]
    }

Content Block Types (both doc types):
  paragraph, list, code-block, command-list, table, module-grid

API-specific (reference only):
  api-endpoint, api-function

Show schema: tut schema --type tutorial
             tut schema --type reference
EOF
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
        echo "tutorial"
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
    echo "Current version: $current_version"
    echo -n "Bump version? [p]atch [m]inor [M]ajor [n]o (p): "
    read -r response

    case "$response" in
        n|N|no)  echo "$current_version" ;;
        m)       _tut_bump_version "$current_version" "minor" ;;
        M)       _tut_bump_version "$current_version" "major" ;;
        *)       _tut_bump_version "$current_version" "patch" ;;  # default to patch
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
    local json_file=""
    local doc_type=""
    local format="html"
    local output_file=""
    local no_bump=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type|-t)     doc_type="$2"; shift 2 ;;
            --format|-f)   format="$2"; shift 2 ;;
            --output|-o)   output_file="$2"; shift 2 ;;
            --no-bump)     no_bump=true; shift ;;
            -*)            echo "Unknown option: $1"; return 1 ;;
            *)             [[ -z "$json_file" ]] && json_file="$1"; shift ;;
        esac
    done

    if [[ -z "$json_file" ]]; then
        echo "Usage: tut build <json_file> [--type tutorial|reference] [--format html|md|all]"
        return 1
    fi

    _tut_require_file "$json_file" "JSON file" || return 1

    # Auto-detect type if not specified
    if [[ -z "$doc_type" ]]; then
        doc_type=$(_tut_detect_type "$json_file")
        if [[ "$doc_type" == "unknown" ]]; then
            echo "Error: Cannot detect document type. Use --type tutorial|reference"
            return 1
        fi
        echo "Detected type: $doc_type"
    fi

    # Version bump prompt (unless --no-bump)
    if [[ "$no_bump" == false ]]; then
        local new_version=$(_tut_prompt_version "$json_file")
        local current_version=$(jq -r '.metadata.version // "0.0.0"' "$json_file")
        if [[ "$new_version" != "$current_version" ]]; then
            _tut_update_metadata "$json_file" "$new_version"
        fi
    fi

    echo ""

    # Build based on type and format
    case "$doc_type" in
        tutorial)
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

# =============================================================================
# INIT
# =============================================================================

_tut_init() {
    local name=""
    local doc_type="tutorial"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type|-t)  doc_type="$2"; shift 2 ;;
            -*)         echo "Unknown option: $1"; return 1 ;;
            *)          [[ -z "$name" ]] && name="$1"; shift ;;
        esac
    done

    if [[ -z "$name" ]]; then
        echo "Usage: tut init <name> [--type tutorial|reference]"
        return 1
    fi

    name="${name%.json}"
    local output_file="${name}.json"

    if [[ -f "$output_file" ]]; then
        echo "Error: $output_file already exists"
        return 1
    fi

    # Convert name to title (my-tutorial -> My Tutorial)
    local title=$(echo "$name" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
    local now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local author=$(whoami)

    case "$doc_type" in
        tutorial)
            _tut_init_tutorial "$output_file" "$title" "$now" "$author"
            ;;
        reference)
            _tut_init_reference "$output_file" "$title" "$now" "$author"
            ;;
        *)
            echo "Unknown type: $doc_type (use: tutorial, reference)"
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

_tut_init_tutorial() {
    local output_file="$1" title="$2" now="$3" author="$4"

    cat > "$output_file" <<EOF
{
  "metadata": {
    "title": "$title",
    "subtitle": "A step-by-step guide",
    "description": "Description of what this tutorial covers",
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
        { "type": "paragraph", "text": "Welcome to this tutorial!" },
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
        { "type": "paragraph", "text": "You've completed this tutorial!" }
      ],
      "terminal": [
        { "type": "output-success", "content": "Tutorial complete!" }
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
    local file="$1"

    if [[ -z "$file" ]]; then
        echo "Usage: tut serve <html_file>"
        return 1
    fi

    # Look in generated directory if not found
    if [[ ! -f "$file" && -f "$TUT_DIR/generated/$file" ]]; then
        file="$TUT_DIR/generated/$file"
    fi

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file"
        return 1
    fi

    echo "Opening: $file"

    if command -v open >/dev/null 2>&1; then
        open "$file"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$file"
    else
        echo "Open manually: file://$file"
    fi
}

# =============================================================================
# GET
# =============================================================================

_tut_get() {
    local noun="${1:-}"

    case "$noun" in
        "")
            echo "Usage: tut get <noun>"
            echo ""
            echo "Nouns:"
            echo "  schemas           List available schemas"
            echo "  tutorial-schema   Show tutorial schema"
            echo "  reference-schema  Show reference schema"
            echo "  docs              List generated documents"
            echo "  recordings        List recordings"
            return 0
            ;;
        schemas)
            _tut_get_schemas
            ;;
        tutorial-schema)
            _tut_get_schema "$TUT_SRC/schema.json" "tutorial"
            ;;
        reference-schema)
            _tut_get_schema "$TUT_SRC/reference-schema.json" "reference"
            ;;
        docs)
            _tut_get_docs
            ;;
        recordings)
            _tut_get_recordings
            ;;
        *)
            echo "Unknown noun: $noun"
            echo "Try: tut get"
            return 1
            ;;
    esac
}

_tut_get_schemas() {
    echo "Available Schemas"
    echo "================="
    echo ""

    local tutorial_size=$(du -h "$TUT_SRC/schema.json" 2>/dev/null | cut -f1)
    local reference_size=$(du -h "$TUT_SRC/reference-schema.json" 2>/dev/null | cut -f1)

    printf "  %-20s %6s  %s\n" "tutorial-schema" "$tutorial_size" "Step-by-step guides with terminal simulation"
    printf "  %-20s %6s  %s\n" "reference-schema" "$reference_size" "Scrollable topic-based documentation"
    echo ""
    echo "View: tut get <schema-name>"
    echo "Edit: tut edit <schema-name>"
}

_tut_get_schema() {
    local schema_file="$1"
    local schema_type="$2"

    if [[ ! -f "$schema_file" ]]; then
        echo "Schema not found: $schema_file"
        return 1
    fi

    echo "Schema: $schema_type"
    echo "File: $schema_file"
    echo ""
    jq '.' "$schema_file"
}

_tut_get_docs() {
    echo "Generated Documents"
    echo "==================="
    echo ""

    if [[ -d "$TUT_DIR/generated" ]]; then
        local count=0
        shopt -s nullglob
        for file in "$TUT_DIR/generated"/*.html "$TUT_DIR/generated"/*.md; do
            if [[ -f "$file" ]]; then
                local name=$(basename "$file")
                local size=$(du -h "$file" | cut -f1)
                printf "  %-40s %s\n" "$name" "$size"
                ((count++))
            fi
        done
        shopt -u nullglob

        [[ $count -eq 0 ]] && echo "  (none)"
        echo ""
        echo "Total: $count file(s)"
    else
        echo "  (none - no generated directory)"
    fi
}

_tut_get_recordings() {
    echo "Recordings"
    echo "=========="
    echo ""

    if [[ -d "$TUT_DIR/recordings" ]]; then
        local count=0
        shopt -s nullglob
        for dir in "$TUT_DIR/recordings"/*/; do
            if [[ -d "$dir" ]]; then
                local name=$(basename "$dir")
                local has_typescript=""
                local has_timing=""
                [[ -f "$dir/typescript.txt" ]] && has_typescript="ts"
                [[ -f "$dir/timing.txt" ]] && has_timing="tm"
                printf "  %-30s [%s %s]\n" "$name" "$has_typescript" "$has_timing"
                ((count++))
            fi
        done
        shopt -u nullglob

        [[ $count -eq 0 ]] && echo "  (none)"
        echo ""
        echo "Total: $count recording(s)"
    else
        echo "  (none - no recordings directory)"
    fi
}

# =============================================================================
# EDIT
# =============================================================================

_tut_edit() {
    local noun="${1:-}"

    case "$noun" in
        "")
            echo "Usage: tut edit <noun>"
            echo ""
            echo "Nouns:"
            echo "  tutorial-schema   Edit tutorial schema"
            echo "  reference-schema  Edit reference schema"
            return 0
            ;;
        tutorial-schema)
            _tut_edit_schema "$TUT_SRC/schema.json"
            ;;
        reference-schema)
            _tut_edit_schema "$TUT_SRC/reference-schema.json"
            ;;
        *)
            echo "Unknown noun: $noun"
            echo "Try: tut edit"
            return 1
            ;;
    esac
}

_tut_edit_schema() {
    local schema_file="$1"

    if [[ ! -f "$schema_file" ]]; then
        echo "Schema not found: $schema_file"
        return 1
    fi

    ${EDITOR:-vim} "$schema_file"
}

export -f tut
