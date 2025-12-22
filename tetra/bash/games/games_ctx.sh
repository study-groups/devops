#!/usr/bin/env bash
# games/games_ctx.sh - TPS context integration for games
#
# Uses unified tps_ctx API for context management.
# Context: GAMES[org:project:subject]
# Color: magenta (5), Priority: 40

# =============================================================================
# DEPENDENCIES
# =============================================================================

if ! type tps_ctx &>/dev/null; then
    echo "games_ctx: requires tps_ctx (load tps module first)" >&2
    return 1
fi

# =============================================================================
# REGISTER WITH TPS
# =============================================================================

# Register games context line (magenta, priority 40)
tps_ctx register games GAMES 40 5

# =============================================================================
# SLOT ACCESSORS (convenience wrappers)
# =============================================================================

_games_org()     { tps_ctx get games org; }
_games_project() { tps_ctx get games project; }
_games_subject() { tps_ctx get games subject; }

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

    # Set context via tps_ctx
    tps_ctx set games "$org" "$project" "$subject"

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
    local org=$(_games_org)

    if [[ -z "$org" ]]; then
        echo "Error: No org set. Use 'games ctx set <org> <project>' first." >&2
        return 1
    fi

    games_ctx_set "$org" "$project"
}

# Set subject (inherit org and project)
games_ctx_subject() {
    local subject="$1"
    local org=$(_games_org)
    local project=$(_games_project)

    if [[ -z "$org" || -z "$project" ]]; then
        echo "Error: No org/project set. Use 'games ctx set <org> <project> <subject>' first." >&2
        return 1
    fi

    games_ctx_set "$org" "$project" "$subject"
}

# Clear context
games_ctx_clear() {
    tps_ctx clear games
    echo "Context cleared"
}

# Show current context
games_ctx_status() {
    local org=$(_games_org)
    local project=$(_games_project)
    local subject=$(_games_subject)

    echo "GAMES Context"
    echo "============="
    echo ""
    echo "  Org:     ${org:-(not set)}"
    echo "  Project: ${project:-(not set)}"
    echo "  Subject: ${subject:-(not set)}"
    echo ""

    if [[ -n "$org" ]]; then
        local games_dir="$TETRA_DIR/orgs/$org/games"
        echo "  Dir:     $games_dir"
        echo ""
        echo "  Preview: GAMES[${org}:${project:-?}:${subject:-?}]"
    fi
}

# Main context command dispatcher
games_ctx() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        set)
            games_ctx_set "$@"
            ;;
        org)
            games_ctx_org "$@"
            ;;
        project|proj)
            games_ctx_project "$@"
            ;;
        subject|subj)
            games_ctx_subject "$@"
            ;;
        clear)
            games_ctx_clear
            ;;
        status)
            games_ctx_status
            ;;
        *)
            # Convenience: games ctx tetra trax demo
            if [[ -d "$TETRA_DIR/orgs/$cmd" ]]; then
                games_ctx_set "$cmd" "$@"
            else
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
  games ctx tetra pulsar demo         # Shorthand
  games ctx subject level2            # Change subject only
  games ctx clear                     # Clear all

Aliases: proj = project, subj = subject
EOF
            fi
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _games_org _games_project _games_subject
export -f games_ctx_set games_ctx_org games_ctx_project games_ctx_subject
export -f games_ctx_clear games_ctx_status games_ctx
