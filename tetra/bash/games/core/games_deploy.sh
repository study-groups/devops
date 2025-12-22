#!/usr/bin/env bash

# Games Deploy Module
# Deploy games to remote servers via SSH (like arcade admin install)
#
# Usage:
#   games deploy <slug> <host>                    # Deploy to remote
#   games deploy <slug> <host> --key ~/.ssh/key   # With SSH key
#   games deploy --manifest <host>                # Deploy manifest only

# =============================================================================
# DEPLOY SINGLE GAME
# =============================================================================

games_deploy() {
    local slug=""
    local host=""
    local ssh_key=""
    local ssh_user=""
    local dest_path="/var/www/games"
    local source="local"  # local or s3
    local manifest_only=false
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --key|-i) ssh_key="$2"; shift 2 ;;
            --user|-u) ssh_user="$2"; shift 2 ;;
            --dest|-d) dest_path="$2"; shift 2 ;;
            --s3) source="s3"; shift ;;
            --manifest) manifest_only=true; shift ;;
            --dry-run|-n) dry_run=true; shift ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *)
                if [[ -z "$slug" ]]; then
                    slug="$1"
                elif [[ -z "$host" ]]; then
                    host="$1"
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$host" ]]; then
        cat << 'EOF' >&2
Usage: games deploy <slug> <host> [options]
       games deploy --manifest <host> [options]

Options:
  --key, -i <path>     SSH private key file
  --user, -u <user>    SSH username (default: from host or current user)
  --dest, -d <path>    Destination path (default: /var/www/games)
  --s3                 Deploy from S3 instead of local
  --manifest           Deploy games.json manifest only
  --dry-run, -n        Show what would be done

Examples:
  games deploy dillo-adventure arcade.example.com
  games deploy my-game user@host.com --key ~/.ssh/deploy_key
  games deploy --manifest arcade.example.com --dest /opt/pja/games
EOF
        return 1
    fi

    # Parse user from host if present
    if [[ "$host" == *@* ]]; then
        ssh_user="${host%%@*}"
        host="${host#*@}"
    fi
    ssh_user="${ssh_user:-$(whoami)}"

    # Build SSH options
    local ssh_opts="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
    [[ -n "$ssh_key" ]] && ssh_opts+=" -i $ssh_key"

    local ssh_target="${ssh_user}@${host}"

    echo "Deploy Configuration:"
    echo "  Target: $ssh_target"
    echo "  Dest:   $dest_path"
    echo "  Source: $source"
    [[ -n "$ssh_key" ]] && echo "  Key:    $ssh_key"
    echo ""

    if $dry_run; then
        echo "(dry-run mode)"
        echo ""
    fi

    # Manifest-only deploy
    if $manifest_only; then
        _games_deploy_manifest "$ssh_target" "$dest_path" "$ssh_opts" "$dry_run"
        return $?
    fi

    # Full game deploy
    if [[ -z "$slug" ]]; then
        echo "Error: slug required for game deploy" >&2
        return 1
    fi

    _games_deploy_game "$slug" "$ssh_target" "$dest_path" "$ssh_opts" "$source" "$dry_run"
}

# =============================================================================
# INTERNAL: Deploy manifest
# =============================================================================

_games_deploy_manifest() {
    local ssh_target="$1"
    local dest_path="$2"
    local ssh_opts="$3"
    local dry_run="$4"

    local manifest=$(_games_manifest_path)

    if [[ ! -f "$manifest" ]]; then
        echo "Manifest not found: $manifest" >&2
        return 1
    fi

    echo "Deploying manifest..."

    if $dry_run; then
        echo "  Would run: scp $ssh_opts $manifest $ssh_target:$dest_path/games.json"
        return 0
    fi

    # Create remote directory
    echo "  Creating remote directory..."
    ssh $ssh_opts "$ssh_target" "mkdir -p $dest_path" || {
        echo "Failed to create remote directory" >&2
        return 1
    }

    # Copy manifest
    echo "  Copying manifest..."
    scp $ssh_opts "$manifest" "$ssh_target:$dest_path/games.json" || {
        echo "Failed to copy manifest" >&2
        return 1
    }

    echo "  ✓ Manifest deployed to $ssh_target:$dest_path/games.json"
}

# =============================================================================
# INTERNAL: Deploy single game
# =============================================================================

_games_deploy_game() {
    local slug="$1"
    local ssh_target="$2"
    local dest_path="$3"
    local ssh_opts="$4"
    local source="$5"
    local dry_run="$6"

    local games_dir="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}"
    local game_dir="${games_dir}/${slug}"

    if [[ "$source" == "local" ]]; then
        if [[ ! -d "$game_dir" ]]; then
            echo "Game not found locally: $game_dir" >&2
            return 1
        fi
    fi

    echo "Deploying game: $slug"

    if $dry_run; then
        echo "  Would run: rsync -avz $game_dir/ $ssh_target:$dest_path/$slug/"
        return 0
    fi

    # Create remote directory
    echo "  Creating remote directory..."
    ssh $ssh_opts "$ssh_target" "mkdir -p $dest_path/$slug" || {
        echo "Failed to create remote directory" >&2
        return 1
    }

    # Sync game files
    echo "  Syncing files..."
    if [[ "$source" == "local" ]]; then
        # Use rsync for local source
        if command -v rsync &>/dev/null; then
            local rsync_opts="-avz --delete"
            [[ -n "$ssh_key" ]] && rsync_opts+=" -e 'ssh -i $ssh_key'"
            rsync $rsync_opts "$game_dir/" "$ssh_target:$dest_path/$slug/" || {
                echo "rsync failed" >&2
                return 1
            }
        else
            # Fallback to scp
            scp -r $ssh_opts "$game_dir/"* "$ssh_target:$dest_path/$slug/" || {
                echo "scp failed" >&2
                return 1
            }
        fi
    else
        # S3 source - download to remote directly
        local manifest=$(_games_manifest_path)
        local s3_bucket=$(jq -r '._config.storage.s3_bucket' "$manifest")
        local s3_endpoint=$(jq -r '._config.storage.s3_endpoint' "$manifest")

        echo "  Downloading from S3 to remote..."
        ssh $ssh_opts "$ssh_target" "
            cd $dest_path/$slug && \
            curl -sO ${s3_endpoint}/${s3_bucket}/${slug}/index.html
        " || {
            echo "S3 download failed" >&2
            return 1
        }
    fi

    # Verify deployment
    echo "  Verifying..."
    ssh $ssh_opts "$ssh_target" "test -f $dest_path/$slug/*/index.html || test -f $dest_path/$slug/index.html" && {
        echo "  ✓ Game deployed: $slug"
    } || {
        echo "  ⚠ Deployed but index.html not found at expected location"
    }
}

# =============================================================================
# DEPLOY ALL GAMES
# =============================================================================

games_deploy_all() {
    local host=""
    local ssh_opts=""
    local dest_path="/var/www/games"
    local dry_run=false

    # Parse arguments (same as games_deploy)
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --key|-i) ssh_opts+=" -i $2"; shift 2 ;;
            --user|-u) ssh_opts+=" -l $2"; shift 2 ;;
            --dest|-d) dest_path="$2"; shift 2 ;;
            --dry-run|-n) dry_run=true; shift ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) host="$1"; shift ;;
        esac
    done

    if [[ -z "$host" ]]; then
        echo "Usage: games deploy-all <host> [options]" >&2
        return 1
    fi

    local manifest=$(_games_manifest_path)
    if [[ ! -f "$manifest" ]]; then
        echo "Manifest not found" >&2
        return 1
    fi

    echo "Deploying all games to: $host"
    echo ""

    # Deploy manifest first
    _games_deploy_manifest "$host" "$dest_path" "$ssh_opts" "$dry_run"

    # Deploy each game
    jq -r '.games | keys[]' "$manifest" | while read -r slug; do
        echo ""
        _games_deploy_game "$slug" "$host" "$dest_path" "$ssh_opts" "local" "$dry_run"
    done

    echo ""
    echo "Deployment complete"
}

# =============================================================================
# STATUS CHECK
# =============================================================================

games_deploy_status() {
    local host="$1"
    local ssh_opts=""
    local dest_path="/var/www/games"

    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --key|-i) ssh_opts+=" -i $2"; shift 2 ;;
            --dest|-d) dest_path="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    if [[ -z "$host" ]]; then
        echo "Usage: games deploy status <host> [--key <key>] [--dest <path>]" >&2
        return 1
    fi

    echo "Checking deployment status on: $host"
    echo "Path: $dest_path"
    echo ""

    # Check remote manifest
    echo "Remote manifest:"
    ssh $ssh_opts "$host" "
        if [[ -f $dest_path/games.json ]]; then
            echo '  ✓ games.json exists'
            jq -r '.games | keys | length' $dest_path/games.json 2>/dev/null | xargs echo '  Games:'
        else
            echo '  ✗ games.json not found'
        fi
    " 2>/dev/null || echo "  ✗ Connection failed"

    echo ""
    echo "Remote games:"
    ssh $ssh_opts "$host" "
        for d in $dest_path/*/; do
            [[ -d \"\$d\" ]] || continue
            slug=\$(basename \"\$d\")
            [[ \"\$slug\" == \"games.json\" ]] && continue
            if [[ -f \"\$d/index.html\" ]] || [[ -f \"\$d/latest/index.html\" ]]; then
                echo \"  ✓ \$slug\"
            else
                echo \"  ⚠ \$slug (no index.html)\"
            fi
        done
    " 2>/dev/null || echo "  ✗ Connection failed"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_deploy
export -f games_deploy_all
export -f games_deploy_status
export -f _games_deploy_manifest
export -f _games_deploy_game
