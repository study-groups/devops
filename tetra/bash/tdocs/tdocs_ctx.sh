#!/usr/bin/env bash
# tdocs/tdocs_ctx.sh - TPS context integration for tdocs
#
# Provides TDOCS[org:project:subject] context line in prompt
# Uses tps_context_module_init for boilerplate reduction

# =============================================================================
# STATE VARIABLES (required before tps_context_module_init)
# =============================================================================

export TDOCS_CTX_ORG="${TDOCS_CTX_ORG:-}"
export TDOCS_CTX_PROJECT="${TDOCS_CTX_PROJECT:-}"
export TDOCS_CTX_SUBJECT="${TDOCS_CTX_SUBJECT:-}"

TDOCS_CTX_FILE="${TDOCS_CTX_FILE:-$TETRA_DIR/tdocs/context}"
declare -g TDOCS_TPS_REGISTERED=0

# =============================================================================
# TPS INTEGRATION (via context_module helper)
# =============================================================================

# Initialize TPS context module - generates:
#   _tdocs_prompt_org, _tdocs_prompt_project, _tdocs_prompt_subject
#   _tdocs_register_prompt, _tdocs_unregister_prompt
#   _tdocs_ctx_save, _tdocs_ctx_load, _tdocs_has_context
if type tps_context_module_init &>/dev/null; then
    tps_context_module_init tdocs TDOCS 20 4  # blue, priority 20
fi

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set full context
# Usage: tdocs_ctx_set <org> [project] [subject]
tdocs_ctx_set() {
    local org="$1"
    local project="${2:-}"
    local subject="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: tdocs ctx set <org> [project] [subject]" >&2
        return 1
    fi

    # Validate org exists
    local org_dir="$TETRA_DIR/orgs/$org"
    if [[ ! -d "$org_dir" ]]; then
        echo "Error: Org not found: $org" >&2
        echo "  Available orgs:" >&2
        ls -1 "$TETRA_DIR/orgs/" 2>/dev/null | sed 's/^/    /' >&2
        return 1
    fi

    # Ensure PData structure exists
    pdata_ensure_org "$org"

    # Create project/subject directories if specified
    if [[ -n "$project" && -n "$subject" ]]; then
        pdata_create_subject "$org" "$project" "$subject" >/dev/null
    elif [[ -n "$project" ]]; then
        pdata_create_project "$org" "$project" >/dev/null
    fi

    # Set context
    export TDOCS_CTX_ORG="$org"
    export TDOCS_CTX_PROJECT="$project"
    export TDOCS_CTX_SUBJECT="$subject"

    # Set PData environment
    pdata_set_env "$org" "$project" "$subject"

    # Save and register
    _tdocs_ctx_save

    # Change to context directory
    local target_dir
    target_dir=$(pdata_get_cwd)
    if [[ -d "$target_dir" ]]; then
        cd "$target_dir" || true
        echo "Context: TDOCS[$org:${project:-?}:${subject:-?}]"
        echo "CWD: $target_dir"
    fi
}

# Set just org (clear project/subject)
tdocs_ctx_org() {
    local org="$1"
    tdocs_ctx_set "$org"
}

# Set project (inherit org, clear subject)
tdocs_ctx_project() {
    local project="$1"

    if [[ -z "$TDOCS_CTX_ORG" ]]; then
        echo "Error: No org set. Use 'tdocs ctx set <org> <project>' first." >&2
        return 1
    fi

    tdocs_ctx_set "$TDOCS_CTX_ORG" "$project"
}

# Set subject (inherit org and project)
tdocs_ctx_subject() {
    local subject="$1"

    if [[ -z "$TDOCS_CTX_ORG" || -z "$TDOCS_CTX_PROJECT" ]]; then
        echo "Error: No org/project set. Use 'tdocs ctx set <org> <project> <subject>' first." >&2
        return 1
    fi

    tdocs_ctx_set "$TDOCS_CTX_ORG" "$TDOCS_CTX_PROJECT" "$subject"
}

# Clear context
tdocs_ctx_clear() {
    export TDOCS_CTX_ORG=""
    export TDOCS_CTX_PROJECT=""
    export TDOCS_CTX_SUBJECT=""

    pdata_clear_env
    _tdocs_ctx_save
    _tdocs_unregister_prompt

    echo "Context cleared"
}

# Show current context
tdocs_ctx_status() {
    echo "tdocs Context"
    echo "============="
    echo ""
    echo "  Org:     ${TDOCS_CTX_ORG:-(not set)}"
    echo "  Project: ${TDOCS_CTX_PROJECT:-(not set)}"
    echo "  Subject: ${TDOCS_CTX_SUBJECT:-(not set)}"
    echo ""

    if [[ -n "$TDOCS_CTX_ORG" ]]; then
        local cwd
        cwd=$(pdata_get_cwd)
        echo "  PD_DIR:  $PD_DIR"
        echo "  CWD:     $cwd"
        echo ""
        echo "  Preview: TDOCS[${TDOCS_CTX_ORG}:${TDOCS_CTX_PROJECT:-?}:${TDOCS_CTX_SUBJECT:-?}]"
    fi
}

# Main context command dispatcher
tdocs_ctx() {
    case "$1" in
        set)
            shift
            tdocs_ctx_set "$@"
            ;;
        org)
            shift
            tdocs_ctx_org "$@"
            ;;
        project|proj)
            shift
            tdocs_ctx_project "$@"
            ;;
        subject|subj)
            shift
            tdocs_ctx_subject "$@"
            ;;
        clear)
            tdocs_ctx_clear
            ;;
        status|"")
            tdocs_ctx_status
            ;;
        *)
            cat <<'EOF'
Usage: tdocs ctx <command>

Commands:
  set <org> [project] [subject]   Set full context
  org <name>                      Set org (clears project/subject)
  project <name>                  Set project (inherits org)
  subject <name>                  Set subject (inherits org+project)
  clear                           Clear all context
  status                          Show current context

Examples:
  tdocs ctx set tetra tps refactor   # Full context
  tdocs ctx subject documentation    # Change subject only
  tdocs ctx clear                    # Clear all

Aliases: proj = project, subj = subject
EOF
            ;;
    esac
}

# =============================================================================
# INITIALIZATION
# =============================================================================

# Load persisted context on source (uses generated _tdocs_ctx_load)
if type _tdocs_ctx_load &>/dev/null; then
    _tdocs_ctx_load
    # Sync PData env if we loaded context
    if [[ -n "$TDOCS_CTX_ORG" ]] && type pdata_set_env &>/dev/null; then
        pdata_set_env "$TDOCS_CTX_ORG" "$TDOCS_CTX_PROJECT" "$TDOCS_CTX_SUBJECT"
    fi
fi

# =============================================================================
# EXPORTS
# =============================================================================

export -f tdocs_ctx_set tdocs_ctx_org tdocs_ctx_project tdocs_ctx_subject
export -f tdocs_ctx_clear tdocs_ctx_status tdocs_ctx
