#!/usr/bin/env bash
# gamepak.sh - Game package manager main dispatcher
#
# Git-like workflow for HTML5 games stored in S3

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

gamepak() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Clone/sync workflow
        clone)
            gamepak_clone "$@"
            ;;
        status|st)
            gamepak_status "$@"
            ;;
        pull)
            gamepak_pull "$@"
            ;;
        push)
            gamepak_push "$@"
            ;;

        # Inspection
        inspect|i)
            gamepak_inspect "$@"
            ;;

        # Doctor (fix issues)
        doctor|doc|fix)
            gamepak_doctor "$@"
            ;;

        # Info
        info)
            gamepak_info "$@"
            ;;

        # Help
        help|-h|--help)
            gamepak_help "$@"
            ;;

        *)
            echo "Unknown command: $cmd" >&2
            echo "Run 'gamepak help' for usage" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# INFO - Show current game info
# =============================================================================

gamepak_info() {
    local game_dir="${1:-.}"

    # Resolve to absolute path
    [[ "$game_dir" != /* ]] && game_dir="$(cd "$game_dir" 2>/dev/null && pwd)"

    # Find tracking file
    local tracking_file
    tracking_file=$(find "$game_dir" -maxdepth 1 -name "*.gamepak" -type f 2>/dev/null | head -1)

    if [[ -z "$tracking_file" ]]; then
        echo "Not a gamepak directory (no *.gamepak file found)" >&2
        echo "Run 'gamepak clone <slug>' first" >&2
        return 1
    fi

    local slug=$(basename "$tracking_file" .gamepak)

    echo "Gamepak Info"
    echo "============"
    echo ""
    echo "Game:      $slug"
    echo "Directory: $game_dir"
    echo ""

    # Read tracking file
    echo "Tracking ($slug.gamepak):"
    sed 's/^/  /' "$tracking_file"
    echo ""

    # Show game.toml if exists
    if [[ -f "$game_dir/game.toml" ]]; then
        echo "Config (game.toml):"
        sed 's/^/  /' "$game_dir/game.toml"
        echo ""
    fi

    # Show index.html stats
    if [[ -f "$game_dir/index.html" ]]; then
        local size=$(wc -c < "$game_dir/index.html" | tr -d ' ')
        local lines=$(wc -l < "$game_dir/index.html" | tr -d ' ')
        echo "Index: index.html (${size} bytes, ${lines} lines)"
    fi
}

# =============================================================================
# HELP
# =============================================================================

gamepak_help() {
    cat << 'EOF'
GAMEPAK - Game Package Manager

Git-like workflow for HTML5 games stored in S3.

USAGE
  gamepak <command> [args]

CLONE/SYNC
  gamepak clone <slug>              Clone game from S3 to local
  gamepak status                    Show local vs remote diff
  gamepak pull                      Sync S3 → local
  gamepak push [--version X.Y.Z]    Sync local → S3

INSPECTION
  gamepak inspect                   Full index.html analysis
  gamepak inspect --type            Detect game engine/framework
  gamepak inspect --sdk             Check SDK presence
  gamepak inspect --css             Check iframe compatibility

DOCTOR (Fix Issues)
  gamepak doctor                    Show fixable issues
  gamepak doctor --fix              Apply all fixes
  gamepak doctor --inject-sdk       Inject PJA SDK only
  gamepak doctor --restore          Restore from backup

INFO
  gamepak info                      Show current game info

EXAMPLES
  # Clone and inspect
  gamepak clone grid-ranger
  cd ~/tetra/orgs/pixeljam-arcade/games/grid-ranger
  gamepak inspect

  # Fix issues and push
  gamepak doctor --fix
  gamepak push --version 0.1.0

  # Check status
  gamepak status

TRACKING FILE ({slug}.gamepak)
  Created by 'clone', e.g. grid-ranger.gamepak:
    remote=pja-games:grid-ranger
    version=0.0.1
    pulled_at=2025-01-10T12:00:00Z

CONTEXT
  Uses SPACES context if set:
    spaces ctx set pixeljam-arcade pja-games
  Or defaults to TETRA_ORG / pixeljam-arcade
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f gamepak
export -f gamepak_info
export -f gamepak_help
