#!/usr/bin/env bash
# deploy_tsm.sh - Install and sync TSM to remote servers
#
# Usage:
#   deploy tsm install <host>   Install TSM on remote host
#   deploy tsm sync <host>      Sync bash modules to remote
#   deploy tsm status <host>    Check TSM status on remote
#   deploy tsm help             Show help

# =============================================================================
# CONFIGURATION
# =============================================================================

# Modules to sync (relative to $TETRA_SRC/bash/)
DEPLOY_TSM_MODULES=(
    "bootloader.sh"
    "tsm"
    "caddy"
    "tds"
    "tps"
    "utils"
    "color"
    "repl"
)

# Files/dirs to exclude from sync
DEPLOY_TSM_EXCLUDES=(
    ".git"
    "node_modules"
    "*.log"
    "__pycache__"
    ".DS_Store"
)

# =============================================================================
# INSTALL
# =============================================================================

# Full install of TSM on remote host
deploy_tsm_install() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy tsm install <host>" >&2
        echo "  host: SSH target (e.g., root@dev.example.com)" >&2
        return 1
    fi

    echo "=== Installing TSM on $host ==="
    echo ""

    # 1. Check SSH connectivity
    echo "[1/5] Checking SSH connectivity..."
    _deploy_check_ssh "$host" || return 1

    # 2. Check bash version
    echo "[2/5] Checking bash version..."
    local remote_bash
    remote_bash=$(ssh "$host" "bash --version | head -1")
    echo "  Remote: $remote_bash"

    if ! ssh "$host" 'bash -c "[[ ${BASH_VERSINFO[0]} -ge 5 ]]"' 2>/dev/null; then
        echo "WARNING: Remote bash may be < 5.0. TSM requires bash 5.2+" >&2
    fi

    # 3. Create directory structure
    echo "[3/5] Creating directory structure..."
    ssh "$host" 'mkdir -p ~/tetra/{bash,orgs,deploy,caddy}'

    # 4. Sync bash modules
    echo "[4/5] Syncing bash modules..."
    _deploy_tsm_sync_modules "$host"

    # 5. Create bootloader wrapper
    echo "[5/5] Creating tetra.sh bootloader..."
    ssh "$host" 'cat > ~/tetra/tetra.sh << '\''EOF'\''
#!/usr/bin/env bash
# Tetra bootloader - source this in .bashrc
export TETRA_DIR="$HOME/tetra"
export TETRA_SRC="$TETRA_DIR"
source "$TETRA_SRC/bash/bootloader.sh"
EOF
chmod +x ~/tetra/tetra.sh'

    # Add to .bashrc if not present
    ssh "$host" 'grep -q "tetra/tetra.sh" ~/.bashrc 2>/dev/null || echo "source ~/tetra/tetra.sh" >> ~/.bashrc'

    echo ""
    echo "=== Installation complete ==="
    echo ""
    echo "To verify, SSH to $host and run:"
    echo "  source ~/tetra/tetra.sh"
    echo "  tsm --help"
}

# =============================================================================
# SYNC
# =============================================================================

# Sync bash modules to remote (no full install)
deploy_tsm_sync() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy tsm sync <host>" >&2
        return 1
    fi

    echo "=== Syncing TSM to $host ==="
    _deploy_tsm_sync_modules "$host"
    echo ""
    echo "Synced. Run 'source ~/tetra/tetra.sh' on remote to reload."
}

# Internal: sync modules via rsync
_deploy_tsm_sync_modules() {
    local host="$1"
    local src_base="$TETRA_SRC/bash"

    # Build exclude args
    local exclude_args=""
    for excl in "${DEPLOY_TSM_EXCLUDES[@]}"; do
        exclude_args+=" --exclude='$excl'"
    done

    # Sync each module
    for mod in "${DEPLOY_TSM_MODULES[@]}"; do
        local src_path="$src_base/$mod"
        if [[ -e "$src_path" ]]; then
            echo "  Syncing: $mod"
            eval rsync -az --delete $exclude_args "$src_path" "$host:~/tetra/bash/"
        else
            echo "  Skipping (not found): $mod"
        fi
    done
}

# =============================================================================
# STATUS
# =============================================================================

# Check TSM status on remote
deploy_tsm_status() {
    local host="$1"

    if [[ -z "$host" ]]; then
        echo "Usage: deploy tsm status <host>" >&2
        return 1
    fi

    echo "=== TSM Status on $host ==="
    echo ""

    # Check if tetra directory exists
    echo "Directory structure:"
    ssh "$host" 'ls -la ~/tetra/ 2>/dev/null || echo "  ~/tetra not found"'
    echo ""

    # Check bash modules
    echo "Bash modules:"
    ssh "$host" 'ls ~/tetra/bash/ 2>/dev/null || echo "  No modules"'
    echo ""

    # Check if tsm is available
    echo "TSM availability:"
    ssh "$host" 'source ~/tetra/tetra.sh 2>/dev/null && type tsm &>/dev/null && echo "  tsm: available" || echo "  tsm: not loaded"'

    # Check running services
    echo ""
    echo "Running processes (tetra-related):"
    ssh "$host" 'ps aux | grep -E "tetra|tsm" | grep -v grep || echo "  None"'
}

# =============================================================================
# DISPATCHER
# =============================================================================

deploy_tsm() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        install|i)
            deploy_tsm_install "$@"
            ;;
        sync|s)
            deploy_tsm_sync "$@"
            ;;
        status|st)
            deploy_tsm_status "$@"
            ;;
        help|h|--help)
            cat << 'EOF'
deploy tsm - Install and manage TSM on remote servers

Commands:
  install <host>   Full TSM installation
  sync <host>      Sync bash modules only
  status <host>    Check TSM status

Examples:
  deploy tsm install root@dev.example.com
  deploy tsm sync root@dev.example.com
  deploy tsm status root@dev.example.com

The install command:
  1. Creates ~/tetra/{bash,orgs,deploy,caddy}
  2. Syncs core bash modules via rsync
  3. Creates bootloader (~/tetra/tetra.sh)
  4. Adds source line to ~/.bashrc
EOF
            ;;
        *)
            echo "deploy tsm: unknown command '$cmd'" >&2
            echo "Use 'deploy tsm help' for usage" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_tsm deploy_tsm_install deploy_tsm_sync deploy_tsm_status
export -f _deploy_tsm_sync_modules
