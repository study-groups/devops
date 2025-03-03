#!/bin/bash

# Sensible Defaults Using TETRA Environment Variables
HOTROD_DIR="${TETRA_DIR:-$HOME/.tetra}/hotrod"
REMOTE_SERVER="${TETRA_REMOTE:-localhost}"
REMOTE_USER="${TETRA_REMOTE_USER:-root}"
REMOTE_DIR="${TETRA_REMOTE_DIR:-/opt/hotrod}"
PORT=9999
MOUNT_POINT="${TETRA_DIR:-$HOME}/hotrod_mount"

# Function to show usage
usage() {
    echo ""
    echo " Tetra Tethered Remote Operations"
    echo ""
    echo "    Usage: tro.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  sync        Sync local files to remote"
    echo "  fetch       Sync remote files to local"
    echo "  tunnel      Create an SSH tunnel to remote"
    echo "  mount       Mount remote directory locally"
    echo "  unmount     Unmount remote directory"
    echo "  exec        Run a command remotely"
    echo "  dispatch    Send a script to execute remotely"
    echo "  help        Show this message"
    echo ""
    echo "Defaults:"
    echo "  Remote Server: $REMOTE_SERVER"
    echo "  Remote User  : $REMOTE_USER"
    echo "  Remote Dir   : $REMOTE_DIR"
    echo "  Local Mount  : $MOUNT_POINT"
    echo ""
    exit 0
}

# Function: Sync local to remote
hotrod_sync() {
    rsync -av "$HOTROD_DIR/" "$REMOTE_USER@$REMOTE_SERVER:$REMOTE_DIR"
}

# Function: Fetch remote to local
hotrod_fetch() {
    rsync -av "$REMOTE_USER@$REMOTE_SERVER:$REMOTE_DIR/" "$HOTROD_DIR"
}

# Function: Create SSH Tunnel
hotrod_tunnel() {
    echo "🔗 Creating SSH tunnel to $REMOTE_SERVER..."
    ssh -N -L $PORT:localhost:$PORT "$REMOTE_USER@$REMOTE_SERVER" &
    echo $! > /tmp/hotrod_tunnel.pid
}

# Function: Close SSH Tunnel
hotrod_tunnel_close() {
    if [[ -f /tmp/hotrod_tunnel.pid ]]; then
        kill "$(cat /tmp/hotrod_tunnel.pid)"
        rm -f /tmp/hotrod_tunnel.pid
        echo "🛑 SSH tunnel closed."
    else
        echo "❌ No active tunnel found."
    fi
}

# Function: Mount Remote Directory
hotrod_mount() {
    echo "🔗 Mounting $REMOTE_DIR to $MOUNT_POINT..."

    # Ensure the mount point directory exists
    if [[ ! -d "$MOUNT_POINT" ]]; then
        echo "📂 Creating mount point at $MOUNT_POINT..."
        mkdir -p "$MOUNT_POINT"
    fi

    # Attempt to mount with SSHFS
    sshfs "$REMOTE_USER@$REMOTE_SERVER:$REMOTE_DIR" "$MOUNT_POINT"

    # Check if mount was successful
    if mountpoint -q "$MOUNT_POINT"; then
        echo "✅ Mounted successfully."
    else
        echo "❌ Failed to mount $REMOTE_DIR at $MOUNT_POINT."
        exit 1
    fi
}


# Function: Unmount Remote Directory
hotrod_unmount() {
    echo "🛑 Unmounting $MOUNT_POINT..."
    fusermount -u "$MOUNT_POINT" || umount "$MOUNT_POINT"
}

# Function: Execute a Command on Remote
hotrod_exec() {
    ssh "$REMOTE_USER@$REMOTE_SERVER" "$@"
}

# Function: Dispatch Script to Remote and Run It
hotrod_dispatch() {
    local script="$1"
    if [[ -z "$script" ]]; then
        echo "❌ Error: No script provided."
        exit 1
    fi
    scp "$script" "$REMOTE_USER@$REMOTE_SERVER:$REMOTE_DIR/"
    ssh "$REMOTE_USER@$REMOTE_SERVER" "chmod +x $REMOTE_DIR/$(basename "$script") && $REMOTE_DIR/$(basename "$script")"
}

# Ensure at least one argument is provided
if [[ $# -eq 0 ]]; then
    usage
fi

# Parse the subcommand
case "$1" in
    sync)      hotrod_sync ;;
    fetch)     hotrod_fetch ;;
    tunnel)    hotrod_tunnel ;;
    close)     hotrod_tunnel_close ;;
    mount)     hotrod_mount ;;
    unmount)   hotrod_unmount ;;
    exec)      shift; hotrod_exec "$@" ;;
    dispatch)  shift; hotrod_dispatch "$@" ;;
    help)      usage ;;
    *)         echo "❌ Unknown command: $1"; usage ;;
esac
