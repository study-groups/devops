#!/usr/bin/env bash
# tut.sh - Org Documentation Wrapper for Terrain
#
# tut manages JSON documentation for an org.
# All rendering and theming is delegated to Terrain.
#
# Context: TUT[org:subject:type]
# Structure: $TETRA_DIR/orgs/<org>/tut/{src,compiled}/<subject>-<type>.{json,html}
# Types: ref, guide, thesis

# =============================================================================
# LOAD CONTEXT MODULE
# =============================================================================

if [[ -f "$TUT_SRC/tut_ctx.sh" ]]; then
    source "$TUT_SRC/tut_ctx.sh"
fi

# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

tut() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        ctx|context)      tut_ctx "$@" ;;
        list|ls)          _tut_list "$@" ;;
        build|b)          _tut_build "$@" ;;
        init|new)         _tut_init "$@" ;;
        edit|e)           _tut_edit "$@" ;;
        doctor|d)         _tut_doctor ;;
        version|-v)       echo "tut 3.0.0 (terrain wrapper)" ;;
        help|--help|-h)   _tut_help ;;
        *)
            echo "Unknown: $cmd" >&2
            _tut_help
            return 1
            ;;
    esac
}

# =============================================================================
# LIST
# =============================================================================

_tut_list() {
    local src_dir
    src_dir=$(_tut_src_dir) || { echo "No org set. Use: tut ctx set <org>" >&2; return 1; }

    if [[ ! -d "$src_dir" ]]; then
        echo "No src directory: $src_dir"
        return 1
    fi

    echo "TUT[$TUT_CTX_ORG:${TUT_CTX_SUBJECT:-}:${TUT_CTX_TYPE:-}]"
    echo "src: $src_dir"
    echo "---"

    local count=0
    for f in "$src_dir"/*.json; do
        [[ -f "$f" ]] || continue
        local name=$(basename "$f" .json)
        local subject type
        # Parse subject-type from filename
        if [[ "$name" =~ ^(.+)-([^-]+)$ ]]; then
            subject="${BASH_REMATCH[1]}"
            type="${BASH_REMATCH[2]}"
            printf "  %-20s [%s]\n" "$subject" "$type"
        else
            printf "  %-20s\n" "$name"
        fi
        ((count++))
    done

    if [[ $count -eq 0 ]]; then
        echo "  (no JSON files)"
        echo ""
        echo "Create with: tut init <subject> <type>"
    else
        echo "---"
        echo "$count file(s)"
    fi
}

# =============================================================================
# BUILD
# =============================================================================

_tut_build() {
    local theme="dark"
    local target=""

    # Parse args
    for arg in "$@"; do
        case "$arg" in
            --theme=*) theme="${arg#--theme=}" ;;
            --all)     target="all" ;;
            *)         target="$arg" ;;
        esac
    done

    local src_dir compiled_dir
    src_dir=$(_tut_src_dir) || { echo "No org set" >&2; return 1; }
    compiled_dir=$(_tut_compiled_dir) || return 1

    mkdir -p "$compiled_dir"

    # Determine what to build
    local files=()
    if [[ "$target" == "all" || -z "$target" ]]; then
        # Build all
        for f in "$src_dir"/*.json; do
            [[ -f "$f" ]] && files+=("$f")
        done
    elif [[ -n "$TUT_CTX_SUBJECT" && -n "$TUT_CTX_TYPE" && -z "$target" ]]; then
        # Build current context
        local src_file
        src_file=$(_tut_src_file)
        [[ -f "$src_file" ]] && files+=("$src_file")
    else
        # Build specific file
        local src_file="$src_dir/${target}.json"
        [[ -f "$src_file" ]] && files+=("$src_file")
    fi

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No files to build" >&2
        return 1
    fi

    echo "Building ${#files[@]} file(s) with theme: $theme"

    for src_file in "${files[@]}"; do
        local name=$(basename "$src_file" .json)
        local out_file="$compiled_dir/${name}.html"

        echo "  $name.json -> $name.html"

        # Terrain does the work
        if command -v terrain &>/dev/null; then
            terrain build "$src_file" --out="$out_file" --theme="$theme"
        else
            echo "    (terrain not found - skipping)" >&2
        fi
    done
}

# =============================================================================
# INIT
# =============================================================================

_tut_init() {
    local subject="${1:-$TUT_CTX_SUBJECT}"
    local type="${2:-$TUT_CTX_TYPE}"

    if [[ -z "$subject" || -z "$type" ]]; then
        echo "Usage: tut init <subject> <type>" >&2
        echo "Types: $TUT_VALID_TYPES" >&2
        return 1
    fi

    if ! _tut_valid_type "$type"; then
        echo "Invalid type: $type" >&2
        echo "Valid types: $TUT_VALID_TYPES" >&2
        return 1
    fi

    local src_dir
    src_dir=$(_tut_src_dir) || { echo "No org set" >&2; return 1; }
    mkdir -p "$src_dir"

    local src_file="$src_dir/${subject}-${type}.json"

    if [[ -f "$src_file" ]]; then
        echo "Already exists: $src_file" >&2
        return 1
    fi

    local now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    case "$type" in
        ref)
            cat > "$src_file" <<EOF
{
  "metadata": {
    "title": "${subject^} Reference",
    "tagline": "Reference documentation for ${subject}",
    "version": "0.0.1",
    "created": "$now"
  },
  "groups": [
    {
      "id": "overview",
      "title": "Overview",
      "topics": [
        {
          "id": "intro",
          "title": "Introduction",
          "content": [
            { "type": "paragraph", "text": "Introduction to ${subject}." }
          ]
        }
      ]
    }
  ]
}
EOF
            ;;
        guide)
            cat > "$src_file" <<EOF
{
  "metadata": {
    "title": "${subject^} Guide",
    "subtitle": "Step-by-step guide",
    "version": "0.0.1",
    "created": "$now",
    "difficulty": "beginner",
    "estimatedTime": 15
  },
  "steps": [
    {
      "id": "welcome",
      "title": "Welcome",
      "content": [
        { "type": "paragraph", "text": "Welcome to the ${subject} guide." }
      ],
      "terminal": [
        { "type": "comment", "content": "# ${subject^} Guide" }
      ]
    }
  ]
}
EOF
            ;;
        thesis)
            cat > "$src_file" <<EOF
{
  "metadata": {
    "title": "${subject^} Thesis",
    "version": "0.0.1",
    "created": "$now"
  },
  "sections": [
    {
      "id": "abstract",
      "title": "Abstract",
      "content": [
        { "type": "paragraph", "text": "Abstract for ${subject}." }
      ]
    }
  ]
}
EOF
            ;;
    esac

    echo "Created: $src_file"

    # Update context
    export TUT_CTX_SUBJECT="$subject"
    export TUT_CTX_TYPE="$type"
    _tut_ctx_save
}

# =============================================================================
# EDIT
# =============================================================================

_tut_edit() {
    local target="${1:-}"
    local src_file

    if [[ -n "$target" ]]; then
        local src_dir
        src_dir=$(_tut_src_dir) || return 1
        src_file="$src_dir/${target}.json"
    elif [[ -n "$TUT_CTX_SUBJECT" && -n "$TUT_CTX_TYPE" ]]; then
        src_file=$(_tut_src_file)
    else
        echo "Usage: tut edit <subject-type> or set context first" >&2
        return 1
    fi

    if [[ ! -f "$src_file" ]]; then
        echo "Not found: $src_file" >&2
        return 1
    fi

    ${EDITOR:-vim} "$src_file"
}

# =============================================================================
# DOCTOR
# =============================================================================

_tut_doctor() {
    echo "TUT Doctor"
    echo "=========="
    echo ""
    echo "Context:"
    echo "  Org:     ${TUT_CTX_ORG:-(not set)}"
    echo "  Subject: ${TUT_CTX_SUBJECT:-(not set)}"
    echo "  Type:    ${TUT_CTX_TYPE:-(not set)}"
    echo ""

    if [[ -n "$TUT_CTX_ORG" ]]; then
        local src_dir compiled_dir
        src_dir=$(_tut_src_dir)
        compiled_dir=$(_tut_compiled_dir)

        echo "Paths:"
        printf "  Src:      $src_dir "
        [[ -d "$src_dir" ]] && echo "(exists)" || echo "(missing)"
        printf "  Compiled: $compiled_dir "
        [[ -d "$compiled_dir" ]] && echo "(exists)" || echo "(missing)"
        echo ""

        if [[ -d "$src_dir" ]]; then
            local count=$(ls "$src_dir"/*.json 2>/dev/null | wc -l | tr -d ' ')
            echo "Files: $count JSON source(s)"
        fi
    fi

    echo ""
    echo "Dependencies:"
    printf "  terrain: "
    command -v terrain &>/dev/null && echo "$(command -v terrain)" || echo "(not found)"
    printf "  jq:      "
    command -v jq &>/dev/null && echo "$(command -v jq)" || echo "(not found)"
    echo ""
    echo "Types: $TUT_VALID_TYPES"
}

# =============================================================================
# HELP
# =============================================================================

_tut_help() {
    cat <<'EOF'
tut - Org Documentation (via Terrain)

CONTEXT
  tut ctx <org> [subject] [type]   Set context
  tut ctx                          Show context
  tut ctx clear                    Clear context

COMMANDS
  tut list                   List JSON source files
  tut init <subject> <type>  Create new source file
  tut edit [subject-type]    Edit source file
  tut build [--theme=X]      Compile via terrain
  tut doctor                 Check setup

STRUCTURE
  $TETRA_DIR/orgs/<org>/tut/
    src/<subject>-<type>.json
    compiled/<subject>-<type>.html

TYPES
  ref      Reference documentation
  guide    Step-by-step guide
  thesis   Thesis/research document

EXAMPLES
  tut ctx tetra              Set org
  tut ctx tetra api ref      Set full context
  tut init deploy guide      Create deploy-guide.json
  tut edit deploy-guide      Edit the file
  tut build --theme=dark     Compile all
EOF
}

# =============================================================================
# EXPORT
# =============================================================================

export -f tut
export -f _tut_list _tut_build _tut_init _tut_edit _tut_doctor _tut_help
