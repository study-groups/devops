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
        adopt)            _tut_adopt "$@" ;;
        unadopt|rm)       _tut_unadopt "$@" ;;
        edit|e)           _tut_edit "$@" ;;
        serve|s)          _tut_serve "$@" ;;
        validate)         _tut_validate "$@" ;;
        doctor|d)         _tut_doctor ;;
        version|ver|v)    _tut_version "$@" ;;
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
    local org=$(_tut_org)
    local subject=$(_tut_subject)
    local type=$(_tut_type)

    local src_dir
    src_dir=$(_tut_src_dir) || { echo "No org set. Use: tut ctx set <org>" >&2; return 1; }

    if [[ ! -d "$src_dir" ]]; then
        echo "No src directory: $src_dir"
        return 1
    fi

    echo "TUT[${org}:${subject:-}:${type:-}]"
    echo "src: $src_dir"
    echo "---"

    local count=0
    for f in "$src_dir"/*.json; do
        [[ -f "$f" ]] || continue
        local name=$(basename "$f" .json)
        local s t
        # Parse subject-type from filename
        if [[ "$name" =~ ^(.+)-([^-]+)$ ]]; then
            s="${BASH_REMATCH[1]}"
            t="${BASH_REMATCH[2]}"
            printf "  %-20s [%s]\n" "$s" "$t"
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
    local out_dir=""
    local bump=""
    local strict=""

    # Parse args
    for arg in "$@"; do
        case "$arg" in
            --theme=*) theme="${arg#--theme=}" ;;
            --out=*)   out_dir="${arg#--out=}" ;;
            --bump)    bump="patch" ;;
            --bump=*)  bump="${arg#--bump=}" ;;
            --strict)  strict=1 ;;
            --all)     target="all" ;;
            *)         target="$arg" ;;
        esac
    done

    local files=()
    local compiled_dir

    # If target is an absolute path to a JSON file, build it directly
    if [[ -n "$target" && -f "$target" && "$target" == *.json ]]; then
        files+=("$target")
        compiled_dir="${out_dir:-$(_tut_compiled_dir 2>/dev/null || dirname "$target")}"
    else
        local src_dir
        src_dir=$(_tut_src_dir) || { echo "No org set" >&2; return 1; }
        compiled_dir="${out_dir:-$(_tut_compiled_dir)}" || return 1

        # Determine what to build
        local subject=$(_tut_subject)
        local type=$(_tut_type)

        if [[ "$target" == "all" ]]; then
            for f in "$src_dir"/*.json; do
                [[ -f "$f" ]] && files+=("$f")
            done
        elif [[ -z "$target" && -n "$subject" && -n "$type" ]]; then
            # Build current context
            local src_file
            src_file=$(_tut_src_file)
            [[ -f "$src_file" ]] && files+=("$src_file")
        elif [[ -z "$target" ]]; then
            # No target, no context subject — build all
            for f in "$src_dir"/*.json; do
                [[ -f "$f" ]] && files+=("$f")
            done
        else
            # Build specific file by name
            local src_file="$src_dir/${target}.json"
            [[ -f "$src_file" ]] && files+=("$src_file")
        fi
    fi

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No files to build" >&2
        return 1
    fi

    mkdir -p "$compiled_dir"

    # Bump versions if requested
    if [[ -n "$bump" ]]; then
        for src_file in "${files[@]}"; do
            _tut_version_bump "$bump" "$src_file"
        done
    fi

    echo "Building ${#files[@]} file(s) with theme: $theme"

    for src_file in "${files[@]}"; do
        local name=$(basename "$src_file" .json)
        local out_file="$compiled_dir/${name}.html"
        local version
        version=$(jq -r '.metadata.version // ""' "$src_file")

        echo "  $name.json${version:+ v$version} -> $name.html"

        # Validate if --strict
        if [[ -n "$strict" ]]; then
            if ! _tut_validate_file "$src_file"; then
                echo "    (validation failed - skipping)" >&2
                continue
            fi
        fi

        # Terrain does the work
        if command -v terrain &>/dev/null; then
            terrain doc "$src_file" -o "$out_file"
        else
            echo "    (terrain not found - skipping)" >&2
        fi
    done
}

# =============================================================================
# INIT
# =============================================================================

_tut_init() {
    local subject="${1:-$(_tut_subject)}"
    local type="${2:-$(_tut_type)}"

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

    local org=$(_tut_org)
    if [[ -z "$org" ]]; then
        echo "No org set. Use: tut ctx set <org>" >&2
        return 1
    fi

    local src_dir
    src_dir=$(_tut_src_dir) || return 1
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

    # Update context via TPS
    tps_ctx set tut "$org" "$subject" "$type"
}

# =============================================================================
# ADOPT - Import an existing JSON file into tut src
# =============================================================================

_tut_adopt() {
    local src_path="$1"

    if [[ -z "$src_path" ]]; then
        echo "Usage: tut adopt <path/to/file.json>" >&2
        echo "Copies a JSON file into the current org's tut/src/ directory." >&2
        echo "Filename must be <subject>-<type>.json (e.g. games-guide.json)" >&2
        return 1
    fi

    if [[ ! -f "$src_path" ]]; then
        echo "File not found: $src_path" >&2
        return 1
    fi

    local org=$(_tut_org)
    if [[ -z "$org" ]]; then
        echo "No org set. Use: tut ctx set <org>" >&2
        return 1
    fi

    local filename=$(basename "$src_path")
    local name="${filename%.json}"

    # Validate filename format: subject-type.json
    if [[ ! "$name" =~ ^(.+)-([^-]+)$ ]]; then
        echo "Filename must be <subject>-<type>.json" >&2
        echo "Got: $filename" >&2
        return 1
    fi

    local subject="${BASH_REMATCH[1]}"
    local type="${BASH_REMATCH[2]}"

    if ! _tut_valid_type "$type"; then
        echo "Invalid type from filename: $type" >&2
        echo "Valid types: $TUT_VALID_TYPES" >&2
        echo "Rename file to <subject>-{ref,guide,thesis}.json" >&2
        return 1
    fi

    local dest_dir
    dest_dir=$(_tut_src_dir) || return 1
    mkdir -p "$dest_dir"

    local dest_file="$dest_dir/$filename"

    if [[ -f "$dest_file" ]]; then
        echo "Already exists: $dest_file" >&2
        echo "Remove it first or use tut edit $name" >&2
        return 1
    fi

    cp "$src_path" "$dest_file"
    echo "Adopted: $dest_file"

    # Update context via TPS
    tps_ctx set tut "$org" "$subject" "$type"
    echo "TUT[$org:$subject:$type]"
}

# =============================================================================
# UNADOPT - Remove a file from tut src
# =============================================================================

_tut_unadopt() {
    local target="${1:-}"
    local org=$(_tut_org)

    if [[ -z "$org" ]]; then
        echo "No org set. Use: tut ctx set <org>" >&2
        return 1
    fi

    # Default to current context
    if [[ -z "$target" ]]; then
        local subject=$(_tut_subject)
        local type=$(_tut_type)
        if [[ -n "$subject" && -n "$type" ]]; then
            target="${subject}-${type}"
        else
            echo "Usage: tut unadopt <subject-type>" >&2
            echo "Or set context first with: tut ctx set <org> <subject> <type>" >&2
            return 1
        fi
    fi

    local src_dir
    src_dir=$(_tut_src_dir) || return 1
    local src_file="$src_dir/${target}.json"

    if [[ ! -f "$src_file" ]]; then
        echo "Not found: $src_file" >&2
        return 1
    fi

    # Also remove compiled HTML if present
    local compiled_dir
    compiled_dir=$(_tut_compiled_dir)
    local compiled_file="$compiled_dir/${target}.html"

    rm "$src_file"
    echo "Removed: $src_file"

    if [[ -f "$compiled_file" ]]; then
        rm "$compiled_file"
        echo "Removed: $compiled_file"
    fi

    # Clear context if it matched what we just removed
    local cur_subject=$(_tut_subject)
    local cur_type=$(_tut_type)
    if [[ "${cur_subject}-${cur_type}" == "$target" ]]; then
        tps_ctx clear tut
        echo "Context cleared"
    fi
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
    else
        local subject=$(_tut_subject)
        local type=$(_tut_type)
        if [[ -n "$subject" && -n "$type" ]]; then
            src_file=$(_tut_src_file)
        else
            echo "Usage: tut edit <subject-type> or set context first" >&2
            return 1
        fi
    fi

    if [[ ! -f "$src_file" ]]; then
        echo "Not found: $src_file" >&2
        return 1
    fi

    ${EDITOR:-vim} "$src_file"
}

# =============================================================================
# VERSION
# =============================================================================

_tut_version() {
    local subcmd="${1:-show}"
    shift 2>/dev/null || true

    case "$subcmd" in
        show|"")
            _tut_version_show "$@"
            ;;
        bump)
            _tut_version_bump "$@"
            ;;
        set)
            _tut_version_set "$@"
            ;;
        --tut)
            echo "tut 3.1.0 (terrain wrapper)"
            ;;
        *)
            echo "Usage: tut version [show|bump|set] [target]" >&2
            echo "  show [target]         Show version (default: current context)" >&2
            echo "  bump [patch|minor|major] [target]  Bump version" >&2
            echo "  set <version> [target]  Set specific version" >&2
            echo "  --tut                 Show tut module version" >&2
            return 1
            ;;
    esac
}

_tut_version_show() {
    local target="${1:-}"
    local src_file

    src_file=$(_tut_resolve_file "$target") || return 1

    local version
    version=$(jq -r '.metadata.version // "not set"' "$src_file")
    local name=$(basename "$src_file" .json)

    echo "$name: $version"
}

_tut_version_bump() {
    local level="${1:-patch}"
    local target="${2:-}"

    if [[ "$level" != "patch" && "$level" != "minor" && "$level" != "major" ]]; then
        echo "Usage: tut version bump [patch|minor|major] [target]" >&2
        return 1
    fi

    local src_file
    src_file=$(_tut_resolve_file "$target") || return 1

    local current
    current=$(jq -r '.metadata.version // "0.0.0"' "$src_file")

    # Parse semver
    local major minor patch
    IFS='.' read -r major minor patch <<< "$current"
    major="${major:-0}"
    minor="${minor:-0}"
    patch="${patch:-0}"

    # Bump
    case "$level" in
        major) ((major++)); minor=0; patch=0 ;;
        minor) ((minor++)); patch=0 ;;
        patch) ((patch++)) ;;
    esac

    local new_version="${major}.${minor}.${patch}"

    # Update JSON
    local tmp=$(mktemp)
    jq --arg v "$new_version" '.metadata.version = $v' "$src_file" > "$tmp" && mv "$tmp" "$src_file"

    local name=$(basename "$src_file" .json)
    echo "$name: $current -> $new_version"
}

_tut_version_set() {
    local version="${1:-}"
    local target="${2:-}"

    if [[ -z "$version" ]]; then
        echo "Usage: tut version set <version> [target]" >&2
        return 1
    fi

    local src_file
    src_file=$(_tut_resolve_file "$target") || return 1

    local current
    current=$(jq -r '.metadata.version // "not set"' "$src_file")

    # Update JSON
    local tmp=$(mktemp)
    jq --arg v "$version" '.metadata.version = $v' "$src_file" > "$tmp" && mv "$tmp" "$src_file"

    local name=$(basename "$src_file" .json)
    echo "$name: $current -> $version"
}

# Resolve target to source file path
_tut_resolve_file() {
    local target="${1:-}"

    if [[ -n "$target" && -f "$target" ]]; then
        # Absolute path given
        echo "$target"
        return 0
    fi

    if [[ -n "$target" ]]; then
        local src_dir
        src_dir=$(_tut_src_dir) || return 1
        local src_file="$src_dir/${target}.json"
        if [[ -f "$src_file" ]]; then
            echo "$src_file"
            return 0
        fi
        echo "Not found: $src_file" >&2
        return 1
    fi

    # Use context
    local subject=$(_tut_subject)
    local type=$(_tut_type)
    if [[ -n "$subject" && -n "$type" ]]; then
        local src_file
        src_file=$(_tut_src_file)
        if [[ -f "$src_file" ]]; then
            echo "$src_file"
            return 0
        fi
        echo "Not found: $src_file" >&2
        return 1
    fi

    echo "No target specified and no context set" >&2
    return 1
}

# =============================================================================
# SERVE
# =============================================================================

_tut_serve() {
    local action="${1:-start}"

    case "$action" in
        start)
            if command -v tsm &>/dev/null; then
                tsm start tut-server
            else
                echo "tsm not found. Start manually:" >&2
                echo "  python3 $TUT_SRC/server.py" >&2
                return 1
            fi
            ;;
        stop)
            if command -v tsm &>/dev/null; then
                tsm stop tut-server
            else
                echo "tsm not found" >&2
                return 1
            fi
            ;;
        *)
            echo "Usage: tut serve [start|stop]" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# VALIDATE
# =============================================================================

_tut_validate() {
    local target="${1:-}"
    local src_file

    src_file=$(_tut_resolve_file "$target") || return 1
    _tut_validate_file "$src_file"
}

# Validate a single JSON file against its schema
_tut_validate_file() {
    local src_file="$1"
    local name=$(basename "$src_file" .json)
    local errors=0

    # Check valid JSON
    if ! jq empty "$src_file" 2>/dev/null; then
        echo "  FAIL: $name — invalid JSON" >&2
        return 1
    fi

    # Check required metadata
    local title
    title=$(jq -r '.metadata.title // empty' "$src_file")
    if [[ -z "$title" ]]; then
        echo "  WARN: $name — missing .metadata.title" >&2
        ((errors++))
    fi

    local version
    version=$(jq -r '.metadata.version // empty' "$src_file")
    if [[ -z "$version" ]]; then
        echo "  WARN: $name — missing .metadata.version" >&2
        ((errors++))
    fi

    # Detect type and validate structure
    local type
    type=$(jq -r '.metadata.type // empty' "$src_file")
    if [[ -z "$type" ]]; then
        # Duck-type detection
        if jq -e '.steps' "$src_file" &>/dev/null; then
            type="guide"
        elif jq -e '.groups' "$src_file" &>/dev/null; then
            type="reference"
        elif jq -e '.sections' "$src_file" &>/dev/null; then
            type="thesis"
        fi
    fi

    if [[ -z "$type" ]]; then
        echo "  FAIL: $name — cannot detect type (need steps, groups, or sections)" >&2
        return 1
    fi

    # Type-specific checks
    case "$type" in
        guide)
            local step_count
            step_count=$(jq '.steps | length' "$src_file")
            if [[ "$step_count" -eq 0 ]]; then
                echo "  WARN: $name — guide has 0 steps" >&2
                ((errors++))
            fi
            # Check each step has id and title
            local bad_steps
            bad_steps=$(jq '[.steps[] | select(.id == null or .title == null)] | length' "$src_file")
            if [[ "$bad_steps" -gt 0 ]]; then
                echo "  WARN: $name — $bad_steps step(s) missing id or title" >&2
                ((errors++))
            fi
            ;;
        reference)
            local group_count
            group_count=$(jq '.groups | length' "$src_file")
            if [[ "$group_count" -eq 0 ]]; then
                echo "  WARN: $name — reference has 0 groups" >&2
                ((errors++))
            fi
            ;;
        thesis)
            local section_count
            section_count=$(jq '.sections | length' "$src_file")
            if [[ "$section_count" -eq 0 ]]; then
                echo "  WARN: $name — thesis has 0 sections" >&2
                ((errors++))
            fi
            ;;
    esac

    if [[ $errors -eq 0 ]]; then
        echo "  OK: $name ($type)"
        return 0
    else
        echo "  $name: $errors warning(s)" >&2
        return 1
    fi
}

# =============================================================================
# DOCTOR
# =============================================================================

_tut_doctor() {
    local org=$(_tut_org)
    local subject=$(_tut_subject)
    local type=$(_tut_type)

    echo "TUT Doctor"
    echo "=========="
    echo ""
    echo "Context:"
    echo "  Org:     ${org:-(not set)}"
    echo "  Subject: ${subject:-(not set)}"
    echo "  Type:    ${type:-(not set)}"
    echo ""

    if [[ -n "$org" ]]; then
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

CONTEXT (prompt: TUT[org:subject:type])
  tut ctx <org> [subject] [type]   Set context
  tut ctx                          Show context
  tut ctx clear                    Clear context

COMMANDS
  tut list                   List JSON source files
  tut init <subject> <type>  Create new source file
  tut adopt <path.json>      Import existing JSON into tut/src/
  tut unadopt [subject-type] Remove from tut/src/ (+ compiled)
  tut edit [subject-type]    Edit source file
  tut build [target]         Compile via terrain
  tut validate [target]      Validate JSON structure
  tut serve [start|stop]     Start/stop doc server via tsm
  tut doctor                 Check setup

VERSION
  tut version                Show current doc version
  tut version show [target]  Show version of specific doc
  tut version bump [level]   Bump version (patch|minor|major)
  tut version set <ver>      Set specific version
  tut version --tut          Show tut module version

BUILD OPTIONS
  tut build                  Build current context (or all)
  tut build --all            Build all in org
  tut build --bump           Bump patch version before build
  tut build --bump=minor     Bump minor version before build
  tut build --bump=major     Bump major version before build
  tut build --strict         Validate JSON before building
  tut build games-guide      Build specific file by name
  tut build /abs/path.json   Build file from any location
  --out=DIR                  Override output directory

STRUCTURE
  $TETRA_DIR/orgs/<org>/tut/
    src/<subject>-<type>.json
    compiled/<subject>-<type>.html

TYPES
  ref      Reference documentation
  guide    Step-by-step guide
  thesis   Thesis/research document

WORKFLOW
  tut ctx tetra install guide     Set context -> TUT[tetra:install:guide]
  tut init install guide          Create install-guide.json scaffold
  tut edit                        Edit current context file
  tut build --bump                Bump version and compile
  tut version                     Check version

  # Or adopt an existing file:
  tut adopt $TETRA_SRC/bash/tut/install-guide.json
  tut build                       Compile it
EOF
}

# =============================================================================
# EXPORT
# =============================================================================

export -f tut
export -f _tut_list _tut_build _tut_init _tut_adopt _tut_unadopt _tut_edit _tut_doctor _tut_help
export -f _tut_version _tut_version_show _tut_version_bump _tut_version_set _tut_resolve_file
export -f _tut_serve _tut_validate _tut_validate_file
