#!/usr/bin/env bash
# games/games_ctx.sh - TPS context integration for games
#
# Provides GAMES[org:project:subject] context line in prompt
# Color: magenta (5)

# =============================================================================
# STATE
# =============================================================================

export GAMES_CTX_ORG="${GAMES_CTX_ORG:-}"
export GAMES_CTX_PROJECT="${GAMES_CTX_PROJECT:-}"
export GAMES_CTX_SUBJECT="${GAMES_CTX_SUBJECT:-}"

# Persistence file
GAMES_CTX_FILE="${GAMES_CTX_FILE:-$TETRA_DIR/games/context}"

# Registration state
declare -g GAMES_TPS_REGISTERED=0

# =============================================================================
# TPS PROVIDER FUNCTIONS
# =============================================================================

_games_prompt_org() {
    echo "${GAMES_CTX_ORG:-}"
}

_games_prompt_project() {
    echo "${GAMES_CTX_PROJECT:-}"
}

_games_prompt_subject() {
    echo "${GAMES_CTX_SUBJECT:-}"
}

# =============================================================================
# TPS REGISTRATION
# =============================================================================

_games_register_prompt() {
    [[ $GAMES_TPS_REGISTERED -eq 1 ]] && return

    if type tps_register_context_line &>/dev/null; then
        # GAMES in magenta (color 5), priority 40
        tps_register_context_line games GAMES 40 5
        tps_register_context org _games_prompt_org games
        tps_register_context project _games_prompt_project games
        tps_register_context subject _games_prompt_subject games
        GAMES_TPS_REGISTERED=1
    fi
}

_games_unregister_prompt() {
    if type tps_unregister_context_line &>/dev/null; then
        tps_unregister_context_line games
        GAMES_TPS_REGISTERED=0
    fi
}

# =============================================================================
# PERSISTENCE
# =============================================================================

_games_ctx_save() {
    mkdir -p "$(dirname "$GAMES_CTX_FILE")"
    cat > "$GAMES_CTX_FILE" <<EOF
GAMES_CTX_ORG=${GAMES_CTX_ORG}
GAMES_CTX_PROJECT=${GAMES_CTX_PROJECT}
GAMES_CTX_SUBJECT=${GAMES_CTX_SUBJECT}
EOF

    # Register TPS when we have context
    if [[ -n "$GAMES_CTX_ORG" || -n "$GAMES_CTX_PROJECT" || -n "$GAMES_CTX_SUBJECT" ]]; then
        _games_register_prompt
    else
        _games_unregister_prompt
    fi
}

_games_ctx_load() {
    [[ ! -f "$GAMES_CTX_FILE" ]] && return

    local line key value
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" == \#* ]] && continue
        case "$key" in
            GAMES_CTX_ORG)     export GAMES_CTX_ORG="$value" ;;
            GAMES_CTX_PROJECT) export GAMES_CTX_PROJECT="$value" ;;
            GAMES_CTX_SUBJECT) export GAMES_CTX_SUBJECT="$value" ;;
        esac
    done < "$GAMES_CTX_FILE"

    # Register prompt if we loaded context
    if [[ -n "$GAMES_CTX_ORG" ]]; then
        _games_register_prompt
    fi
}

# =============================================================================
# CONTEXT COMMANDS
# =============================================================================

# Set full context
# Usage: games_ctx_set <org> [project] [subject]
games_ctx_set() {
    local org="$1"
    local project="${2:-}"
    local subject="${3:-}"

    if [[ -z "$org" ]]; then
        echo "Usage: games ctx set <org> [project] [subject]" >&2
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

    # Set context
    export GAMES_CTX_ORG="$org"
    export GAMES_CTX_PROJECT="$project"
    export GAMES_CTX_SUBJECT="$subject"

    # Save and register
    _games_ctx_save

    # Change to games directory if it exists
    local games_dir="$TETRA_DIR/orgs/$org/games"
    if [[ -n "$project" ]]; then
        local target_dir="$games_dir/$project"
        [[ -n "$subject" ]] && target_dir="$target_dir/$subject"
        if [[ -d "$target_dir" ]]; then
            cd "$target_dir" || true
        elif [[ -d "$games_dir" ]]; then
            cd "$games_dir" || true
        fi
    fi

    echo "Context: GAMES[$org:${project:-?}:${subject:-?}]"
}

# Set just org (clear project/subject)
games_ctx_org() {
    local org="$1"
    games_ctx_set "$org"
}

# Set project (inherit org, clear subject)
games_ctx_project() {
    local project="$1"

    if [[ -z "$GAMES_CTX_ORG" ]]; then
        echo "Error: No org set. Use 'games ctx set <org> <project>' first." >&2
        return 1
    fi

    games_ctx_set "$GAMES_CTX_ORG" "$project"
}

# Set subject (inherit org and project)
games_ctx_subject() {
    local subject="$1"

    if [[ -z "$GAMES_CTX_ORG" || -z "$GAMES_CTX_PROJECT" ]]; then
        echo "Error: No org/project set. Use 'games ctx set <org> <project> <subject>' first." >&2
        return 1
    fi

    games_ctx_set "$GAMES_CTX_ORG" "$GAMES_CTX_PROJECT" "$subject"
}

# Clear context
games_ctx_clear() {
    export GAMES_CTX_ORG=""
    export GAMES_CTX_PROJECT=""
    export GAMES_CTX_SUBJECT=""

    _games_ctx_save
    _games_unregister_prompt

    echo "Context cleared"
}

# Show current context
games_ctx_status() {
    echo "GAMES Context"
    echo "============="
    echo ""
    echo "  Org:     ${GAMES_CTX_ORG:-(not set)}"
    echo "  Project: ${GAMES_CTX_PROJECT:-(not set)}"
    echo "  Subject: ${GAMES_CTX_SUBJECT:-(not set)}"
    echo ""

    if [[ -n "$GAMES_CTX_ORG" ]]; then
        local games_dir="$TETRA_DIR/orgs/$GAMES_CTX_ORG/games"
        echo "  Dir:     $games_dir"
        echo ""
        echo "  Preview: GAMES[${GAMES_CTX_ORG}:${GAMES_CTX_PROJECT:-?}:${GAMES_CTX_SUBJECT:-?}]"
    fi
}

# Main context command dispatcher
games_ctx() {
    case "$1" in
        set)
            shift
            games_ctx_set "$@"
            ;;
        org)
            shift
            games_ctx_org "$@"
            ;;
        project|proj)
            shift
            games_ctx_project "$@"
            ;;
        subject|subj)
            shift
            games_ctx_subject "$@"
            ;;
        clear)
            games_ctx_clear
            ;;
        status|"")
            games_ctx_status
            ;;
        *)
            cat <<'EOF'
Usage: games ctx <command>

Commands:
  set <org> [project] [subject]   Set full context
  org <name>                      Set org (clears project/subject)
  project <name>                  Set project (inherits org)
  subject <name>                  Set subject (inherits org+project)
  clear                           Clear all context
  status                          Show current context

Examples:
  games ctx set tetra pulsar demo     # Full context
  games ctx subject level2            # Change subject only
  games ctx clear                     # Clear all

Aliases: proj = project, subj = subject
EOF
            ;;
    esac
}

# =============================================================================
# INITIALIZATION
# =============================================================================

# Load persisted context on source
_games_ctx_load

# =============================================================================
# EXPORTS
# =============================================================================

export -f _games_prompt_org _games_prompt_project _games_prompt_subject
export -f _games_register_prompt _games_unregister_prompt
export -f _games_ctx_save _games_ctx_load
export -f games_ctx_set games_ctx_org games_ctx_project games_ctx_subject
export -f games_ctx_clear games_ctx_status games_ctx
