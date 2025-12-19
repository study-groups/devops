#!/usr/bin/env bash
# tut/tut_ctx.sh - TPS context integration for tut
#
# Provides TUT[org:project:subject] context line in prompt
# Following the deploy_ctx.sh and tdocs_ctx.sh pattern

# =============================================================================
# STATE
# =============================================================================

export TUT_CTX_ORG="${TUT_CTX_ORG:-}"
export TUT_CTX_PROJECT="${TUT_CTX_PROJECT:-}"
export TUT_CTX_SUBJECT="${TUT_CTX_SUBJECT:-}"

# Persistence file
TUT_CTX_FILE="${TUT_CTX_FILE:-$TETRA_DIR/tut/context}"

# Registration state
declare -g TUT_TPS_REGISTERED=0

# =============================================================================
# TPS PROVIDER FUNCTIONS
# =============================================================================

_tut_prompt_org() {
    echo "${TUT_CTX_ORG:-}"
}

_tut_prompt_project() {
    echo "${TUT_CTX_PROJECT:-}"
}

_tut_prompt_subject() {
    echo "${TUT_CTX_SUBJECT:-}"
}

# =============================================================================
# TPS REGISTRATION
# =============================================================================

_tut_register_prompt() {
    [[ $TUT_TPS_REGISTERED -eq 1 ]] && return

    if type tps_register_context_line &>/dev/null; then
        # TUT in green (color 2), priority 30
        tps_register_context_line tut TUT 30 2
        tps_register_context org _tut_prompt_org tut
        tps_register_context project _tut_prompt_project tut
        tps_register_context subject _tut_prompt_subject tut
        TUT_TPS_REGISTERED=1
    fi
}

_tut_unregister_prompt() {
    if type tps_unregister_context_line &>/dev/null; then
        tps_unregister_context_line tut
        TUT_TPS_REGISTERED=0
    fi
}

# =============================================================================
# PERSISTENCE
# =============================================================================

_tut_ctx_save() {
    mkdir -p "$(dirname "$TUT_CTX_FILE")"
    cat > "$TUT_CTX_FILE" <<EOF
TUT_CTX_ORG=${TUT_CTX_ORG}
TUT_CTX_PROJECT=${TUT_CTX_PROJECT}
TUT_CTX_SUBJECT=${TUT_CTX_SUBJECT}
EOF

    # Register TPS when we have context
    if [[ -n "$TUT_CTX_ORG" || -n "$TUT_CTX_PROJECT" || -n "$TUT_CTX_SUBJECT" ]]; then
        _tut_register_prompt
    else
        _tut_unregister_prompt
    fi
}

_tut_ctx_load() {
    [[ ! -f "$TUT_CTX_FILE" ]] && return

    local line key value
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" == \#* ]] && continue
        case "$key" in
            TUT_CTX_ORG)     export TUT_CTX_ORG="$value" ;;
            TUT_CTX_PROJECT) export TUT_CTX_PROJECT="$value" ;;
            TUT_CTX_SUBJECT) export TUT_CTX_SUBJECT="$value" ;;
        esac
    done < "$TUT_CTX_FILE"

    # Register prompt if we loaded context
    if [[ -n "$TUT_CTX_ORG" ]]; then
        _tut_register_prompt
    fi
}

# =============================================================================
# PDATA HELPERS
# =============================================================================

# Get PData root for an org
_tut_pd_root() {
    local org="$1"
    echo "$TETRA_DIR/orgs/$org/pd"
}

# Get data directory for context
_tut_pd_data() {
    local org="$1"
    local project="${2:-}"
    local subject="${3:-}"

    local base="$TETRA_DIR/orgs/$org/pd/data"

    if [[ -n "$project" && -n "$subject" ]]; then
        echo "$base/projects/$project/$subject"
    elif [[ -n "$project" ]]; then
        echo "$base/projects/$project"
    else
        echo "$base"
    fi
}

# Ensure PData structure exists
_tut_ensure_pdata() {
    local org="$1"
    local project="${2:-}"
    local subject="${3:-}"

    local pd_root="$TETRA_DIR/orgs/$org/pd"

    # Create base structure
    mkdir -p "$pd_root/data/projects"
    mkdir -p "$pd_root/config"
    mkdir -p "$pd_root/cache"

    # Create project/subject if specified
    if [[ -n "$project" ]]; then
        mkdir -p "$pd_root/data/projects/$project"
        if [[ -n "$subject" ]]; then
            mkdir -p "$pd_root/data/projects/$project/$subject"
        fi
    fi
}

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set full context
# Usage: tut_ctx_set <org> [project] [subject]
tut_ctx_set() {
    local org="$1"
    local project="${2:-}"
    local subject="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: tut ctx set <org> [project] [subject]" >&2
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
    _tut_ensure_pdata "$org" "$project" "$subject"

    # Set context
    export TUT_CTX_ORG="$org"
    export TUT_CTX_PROJECT="$project"
    export TUT_CTX_SUBJECT="$subject"

    # Save and register
    _tut_ctx_save

    # Change to context directory
    local target_dir
    target_dir=$(_tut_pd_data "$org" "$project" "$subject")
    if [[ -d "$target_dir" ]]; then
        cd "$target_dir" || true
        echo "Context: TUT[$org:${project:-?}:${subject:-?}]"
        echo "CWD: $target_dir"
    fi
}

# Set just org (clear project/subject)
tut_ctx_org() {
    local org="$1"
    tut_ctx_set "$org"
}

# Set project (inherit org, clear subject)
tut_ctx_project() {
    local project="$1"

    if [[ -z "$TUT_CTX_ORG" ]]; then
        echo "Error: No org set. Use 'tut ctx set <org> <project>' first." >&2
        return 1
    fi

    tut_ctx_set "$TUT_CTX_ORG" "$project"
}

# Set subject (inherit org and project)
tut_ctx_subject() {
    local subject="$1"

    if [[ -z "$TUT_CTX_ORG" || -z "$TUT_CTX_PROJECT" ]]; then
        echo "Error: No org/project set. Use 'tut ctx set <org> <project> <subject>' first." >&2
        return 1
    fi

    tut_ctx_set "$TUT_CTX_ORG" "$TUT_CTX_PROJECT" "$subject"
}

# Clear context
tut_ctx_clear() {
    export TUT_CTX_ORG=""
    export TUT_CTX_PROJECT=""
    export TUT_CTX_SUBJECT=""

    _tut_ctx_save
    _tut_unregister_prompt

    echo "Context cleared"
}

# Show current context
tut_ctx_status() {
    echo "TUT Context"
    echo "==========="
    echo ""
    echo "  Org:     ${TUT_CTX_ORG:-(not set)}"
    echo "  Project: ${TUT_CTX_PROJECT:-(not set)}"
    echo "  Subject: ${TUT_CTX_SUBJECT:-(not set)}"
    echo ""

    if [[ -n "$TUT_CTX_ORG" ]]; then
        local pd_root=$(_tut_pd_root "$TUT_CTX_ORG")
        local data_dir=$(_tut_pd_data "$TUT_CTX_ORG" "$TUT_CTX_PROJECT" "$TUT_CTX_SUBJECT")
        echo "  PD Root: $pd_root"
        echo "  CWD:     $data_dir"
        echo ""
        echo "  Preview: TUT[${TUT_CTX_ORG}:${TUT_CTX_PROJECT:-?}:${TUT_CTX_SUBJECT:-?}]"
    fi
}

# Main context command dispatcher
tut_ctx() {
    case "$1" in
        set)
            shift
            tut_ctx_set "$@"
            ;;
        org)
            shift
            tut_ctx_org "$@"
            ;;
        project|proj)
            shift
            tut_ctx_project "$@"
            ;;
        subject|subj)
            shift
            tut_ctx_subject "$@"
            ;;
        clear)
            tut_ctx_clear
            ;;
        status|"")
            tut_ctx_status
            ;;
        *)
            cat <<'EOF'
Usage: tut ctx <command>

Commands:
  set <org> [project] [subject]   Set full context
  org <name>                      Set org (clears project/subject)
  project <name>                  Set project (inherits org)
  subject <name>                  Set subject (inherits org+project)
  clear                           Clear all context
  status                          Show current context

Examples:
  tut ctx set tetra docs overview   # Full context
  tut ctx subject api               # Change subject only
  tut ctx clear                     # Clear all

Aliases: proj = project, subj = subject
EOF
            ;;
    esac
}

# =============================================================================
# INITIALIZATION
# =============================================================================

# Load persisted context on source
_tut_ctx_load

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tut_prompt_org _tut_prompt_project _tut_prompt_subject
export -f _tut_register_prompt _tut_unregister_prompt
export -f _tut_ctx_save _tut_ctx_load
export -f _tut_pd_root _tut_pd_data _tut_ensure_pdata
export -f tut_ctx_set tut_ctx_org tut_ctx_project tut_ctx_subject
export -f tut_ctx_clear tut_ctx_status tut_ctx
