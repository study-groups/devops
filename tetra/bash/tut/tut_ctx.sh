#!/usr/bin/env bash
# tut/tut_ctx.sh - Context for tut using unified context_kv
#
# Context: TUT[org:subject:type]
# Slots:   org=org, project=subject, subject=type
# Structure: $TETRA_DIR/orgs/<org>/tut/{src,compiled}/<subject>-<type>.{json,html}
# Types: ref, guide, thesis

# =============================================================================
# DEPENDENCIES
# =============================================================================

# Ensure context_kv is loaded
if ! type tps_ctx &>/dev/null; then
    if [[ -f "$TETRA_SRC/bash/tps/core/context_kv.sh" ]]; then
        source "$TETRA_SRC/bash/utils/kv_store.sh"
        source "$TETRA_SRC/bash/tps/core/context_kv.sh"
    else
        echo "tut_ctx: requires tps/core/context_kv.sh" >&2
        return 1
    fi
fi

# =============================================================================
# REGISTER WITH TPS
# =============================================================================

# Register tut context line (green, priority 30)
tps_ctx register tut TUT 30 2

# =============================================================================
# CONSTANTS
# =============================================================================

declare -g TUT_VALID_TYPES="ref guide thesis"

# =============================================================================
# SLOT ACCESSORS (convenience wrappers)
# =============================================================================

# Get current org
_tut_org() { tps_ctx get tut org; }

# Get current subject (stored in project slot)
_tut_subject() { tps_ctx get tut project; }

# Get current type (stored in subject slot)
_tut_type() { tps_ctx get tut subject; }

# =============================================================================
# PATH HELPERS
# =============================================================================

# Get tut root for an org
_tut_root() {
    local org="${1:-$(_tut_org)}"
    [[ -z "$org" ]] && return 1
    echo "$TETRA_DIR/orgs/$org/tut"
}

# Get src directory
_tut_src_dir() {
    local root
    root=$(_tut_root "$1") || return 1
    echo "$root/src"
}

# Get compiled directory
_tut_compiled_dir() {
    local root
    root=$(_tut_root "$1") || return 1
    echo "$root/compiled"
}

# Get src file for subject-type
_tut_src_file() {
    local org="${1:-$(_tut_org)}"
    local subject="${2:-$(_tut_subject)}"
    local type="${3:-$(_tut_type)}"

    [[ -z "$org" || -z "$subject" || -z "$type" ]] && return 1
    echo "$TETRA_DIR/orgs/$org/tut/src/${subject}-${type}.json"
}

# Get compiled file for subject-type
_tut_compiled_file() {
    local org="${1:-$(_tut_org)}"
    local subject="${2:-$(_tut_subject)}"
    local type="${3:-$(_tut_type)}"

    [[ -z "$org" || -z "$subject" || -z "$type" ]] && return 1
    echo "$TETRA_DIR/orgs/$org/tut/compiled/${subject}-${type}.html"
}

# Validate type
_tut_valid_type() {
    local type="$1"
    [[ " $TUT_VALID_TYPES " == *" $type "* ]]
}

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set context: tut ctx set <org> [subject] [type]
tut_ctx_set() {
    local org="$1"
    local subject="${2:-}"
    local type="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: tut ctx set <org> [subject] [type]" >&2
        return 1
    fi

    # Validate org exists
    if [[ ! -d "$TETRA_DIR/orgs/$org" ]]; then
        echo "Org not found: $org" >&2
        echo "Available:" >&2
        ls -1 "$TETRA_DIR/orgs/" 2>/dev/null | sed 's/^/  /' >&2
        return 1
    fi

    # Validate type if provided
    if [[ -n "$type" ]] && ! _tut_valid_type "$type"; then
        echo "Invalid type: $type" >&2
        echo "Valid types: $TUT_VALID_TYPES" >&2
        return 1
    fi

    # Ensure tut structure exists
    mkdir -p "$TETRA_DIR/orgs/$org/tut/src"
    mkdir -p "$TETRA_DIR/orgs/$org/tut/compiled"

    # Set context via tps_ctx (org:project:subject = org:subject:type)
    tps_ctx set tut "$org" "$subject" "$type"

    # Show result
    echo "TUT[$org:${subject:-?}:${type:-?}]"

    # cd to src dir
    local src_dir
    src_dir=$(_tut_src_dir "$org")
    [[ -d "$src_dir" ]] && cd "$src_dir"
    echo "src: $src_dir"
}

# Set just subject (keep org and type)
tut_ctx_subject() {
    local subject="$1"
    local org=$(_tut_org)
    local type=$(_tut_type)

    [[ -z "$org" ]] && { echo "No org set" >&2; return 1; }
    tut_ctx_set "$org" "$subject" "$type"
}

# Set just type (keep org and subject)
tut_ctx_type() {
    local type="$1"
    local org=$(_tut_org)
    local subject=$(_tut_subject)

    [[ -z "$org" ]] && { echo "No org set" >&2; return 1; }
    [[ -z "$subject" ]] && { echo "No subject set" >&2; return 1; }
    tut_ctx_set "$org" "$subject" "$type"
}

# Clear context
tut_ctx_clear() {
    tps_ctx clear tut
    echo "Context cleared"
}

# Show context
tut_ctx_status() {
    local org=$(_tut_org)
    local subject=$(_tut_subject)
    local type=$(_tut_type)

    echo "TUT Context"
    echo "==========="
    echo "  Org:     ${org:-(not set)}"
    echo "  Subject: ${subject:-(not set)}"
    echo "  Type:    ${type:-(not set)}"
    echo ""

    if [[ -n "$org" ]]; then
        local src_dir compiled_dir
        src_dir=$(_tut_src_dir)
        compiled_dir=$(_tut_compiled_dir)

        echo "  Src:      $src_dir"
        echo "  Compiled: $compiled_dir"

        if [[ -n "$subject" && -n "$type" ]]; then
            local src_file
            src_file=$(_tut_src_file)
            echo ""
            printf "  File: ${subject}-${type}.json "
            [[ -f "$src_file" ]] && echo "(exists)" || echo "(missing)"
        fi
    fi

    echo ""
    echo "  Types: $TUT_VALID_TYPES"
}

# Main dispatcher
tut_ctx() {
    local cmd="${1:-status}"
    shift || true

    case "$cmd" in
        set)     tut_ctx_set "$@" ;;
        subject) tut_ctx_subject "$@" ;;
        type)    tut_ctx_type "$@" ;;
        clear)   tut_ctx_clear ;;
        status)  tut_ctx_status ;;
        *)
            # Convenience: tut ctx tetra api ref
            if [[ -d "$TETRA_DIR/orgs/$cmd" ]]; then
                tut_ctx_set "$cmd" "$@"
            else
                cat <<'EOF'
Usage: tut ctx <command>

Commands:
  set <org> [subject] [type]   Set context
  subject <name>               Set subject (keep org+type)
  type <name>                  Set type (keep org+subject)
  clear                        Clear context
  status                       Show context

Types: ref, guide, thesis

Examples:
  tut ctx set tetra api ref    Full context
  tut ctx tetra api ref        Shorthand
  tut ctx subject deploy       Change subject
  tut ctx type guide           Change type
EOF
            fi
            ;;
    esac
}

# =============================================================================
# BACKWARD COMPAT ALIASES
# =============================================================================

# Legacy variable access (read-only, for scripts that check these)
TUT_CTX_ORG() { _tut_org; }
TUT_CTX_SUBJECT() { _tut_subject; }
TUT_CTX_TYPE() { _tut_type; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tut_org _tut_subject _tut_type
export -f _tut_root _tut_src_dir _tut_compiled_dir
export -f _tut_src_file _tut_compiled_file _tut_valid_type
export -f tut_ctx tut_ctx_set tut_ctx_subject tut_ctx_type
export -f tut_ctx_clear tut_ctx_status
