#!/usr/bin/env bash
# deploy_games.sh - Game asset deployment to S3
#
# Syncs local game builds to DigitalOcean Spaces (S3)
# The arcade server proxies S3 to clients, so no server push needed.
#
# Usage:
#   deploy games list               # List local games
#   deploy games list --s3          # List S3 games
#   deploy games sync               # Sync all to S3
#   deploy games sync cheap-golf    # Sync single game
#   deploy games status             # Compare local vs S3

# =============================================================================
# CONFIGURATION
# =============================================================================

# Load config from tetra.toml [games] section
_deploy_games_config() {
    GAMES_LOCAL=$(org_toml_get "games.local_path" 2>/dev/null)
    GAMES_BUCKET=$(org_toml_get "games.s3_bucket" 2>/dev/null)

    # Defaults
    GAMES_LOCAL="${GAMES_LOCAL:-~/pj/pja-games}"
    GAMES_BUCKET="${GAMES_BUCKET:-pja-games}"

    # Expand ~
    GAMES_LOCAL=$(eval echo "$GAMES_LOCAL")
}

# =============================================================================
# LIST
# =============================================================================

# List local games (directories only, exclude zips and docs)
deploy_games_list() {
    local where="${1:---local}"
    _deploy_games_config

    case "$where" in
        --local|-l|"")
            echo "Local games ($GAMES_LOCAL):"
            if [[ ! -d "$GAMES_LOCAL" ]]; then
                echo "  (directory not found)"
                return 1
            fi
            for dir in "$GAMES_LOCAL"/*/; do
                [[ -d "$dir" ]] || continue
                local name=$(basename "$dir")
                [[ "$name" == "pja-docs" ]] && continue
                echo "  $name"
            done | sort
            ;;
        --s3|-s)
            echo "S3 games ($GAMES_BUCKET):"
            if ! type spaces_list &>/dev/null; then
                echo "  (spaces module not loaded)"
                return 1
            fi
            spaces_list "$GAMES_BUCKET:" 2>/dev/null | \
                awk '{print $NF}' | \
                sed 's|.*/||;s|/$||' | \
                grep -v '^$' | \
                sort | \
                sed 's/^/  /'
            ;;
        *)
            echo "Usage: deploy games list [--local|--s3]"
            return 1
            ;;
    esac
}

# =============================================================================
# SYNC
# =============================================================================

# Sync game(s) to S3
deploy_games_sync() {
    local game=""
    local dry_run=0

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n)
                dry_run=1
                shift
                ;;
            *)
                game="$1"
                shift
                ;;
        esac
    done

    _deploy_games_config

    if ! type spaces_sync &>/dev/null; then
        echo "Error: spaces module not loaded"
        echo "Source: \$TETRA_SRC/bash/spaces/includes.sh"
        return 1
    fi

    if [[ ! -d "$GAMES_LOCAL" ]]; then
        echo "Error: Games directory not found: $GAMES_LOCAL"
        return 1
    fi

    if [[ -n "$game" ]]; then
        # Single game
        local source="$GAMES_LOCAL/$game"
        if [[ ! -d "$source" ]]; then
            echo "Game not found: $source"
            return 1
        fi

        echo "Syncing: $game → s3://$GAMES_BUCKET/$game/"

        if [[ $dry_run -eq 1 ]]; then
            echo "(dry run)"
            spaces_sync "$source/" "$GAMES_BUCKET:$game/" --dry-run
        else
            spaces_sync "$source/" "$GAMES_BUCKET:$game/"
        fi
    else
        # All games
        echo "Syncing all games to S3..."
        echo ""

        local count=0
        for dir in "$GAMES_LOCAL"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")

            # Skip excluded
            [[ "$name" == "pja-docs" ]] && continue
            [[ "$name" == *.zip ]] && continue

            echo "=== $name ==="
            if [[ $dry_run -eq 1 ]]; then
                spaces_sync "$dir" "$GAMES_BUCKET:$name/" --dry-run
            else
                spaces_sync "$dir" "$GAMES_BUCKET:$name/"
            fi
            echo ""
            ((count++))
        done

        echo "Synced $count games"
    fi
}

# =============================================================================
# STATUS
# =============================================================================

# Show sync status (what differs between local and S3)
deploy_games_status() {
    _deploy_games_config

    echo "Game Status"
    echo "==========="
    echo ""
    printf "%-20s %-10s %-10s\n" "Game" "Local" "S3"
    printf "%-20s %-10s %-10s\n" "----" "-----" "--"

    # Get local games
    local local_games=""
    if [[ -d "$GAMES_LOCAL" ]]; then
        for dir in "$GAMES_LOCAL"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == "pja-docs" ]] && continue
            local_games+="$name"$'\n'
        done
    fi

    # Get S3 games
    local s3_games=""
    if type spaces_list &>/dev/null; then
        s3_games=$(spaces_list "$GAMES_BUCKET:" 2>/dev/null | \
            awk '{print $NF}' | \
            sed 's|.*/||;s|/$||' | \
            grep -v '^$')
    fi

    # Combine and report
    local all_games=$(echo -e "$local_games$s3_games" | sort -u | grep -v '^$')

    for game in $all_games; do
        local in_local="--"
        local in_s3="--"
        echo "$local_games" | grep -q "^$game$" && in_local="yes"
        echo "$s3_games" | grep -q "^$game$" && in_s3="yes"
        printf "%-20s %-10s %-10s\n" "$game" "$in_local" "$in_s3"
    done
}

# =============================================================================
# HELP
# =============================================================================

deploy_games_help() {
    cat << 'EOF'
deploy games - Game asset management

COMMANDS
    list [--local|--s3]     List games locally or in S3
    sync [game]             Sync game(s) to S3
    sync --dry-run [game]   Preview sync without uploading
    status                  Compare local vs S3

CONFIGURATION
    In tetra.toml:
    [games]
    local_path = "~/pj/pja-games"
    s3_bucket = "pja-games"

EXAMPLES
    deploy games list               # Local games
    deploy games list --s3          # S3 games
    deploy games status             # Compare local vs S3
    deploy games sync --dry-run     # Preview all
    deploy games sync               # Upload all to S3
    deploy games sync cheap-golf    # Upload single game

NOTES
    - Uses spaces module for S3 operations
    - Excludes pja-docs (local-only) and .zip files
    - Arcade server proxies S3 to clients
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_games_config
export -f deploy_games_list deploy_games_sync deploy_games_status deploy_games_help
