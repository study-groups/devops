#!/usr/bin/env bash
# remove.sh - Undo everything setup.sh did
# Removes ~/start-tetra.sh, ~/tetra, optionally removes source repo.
# Every destructive step requires explicit confirmation.

set -euo pipefail

TETRA_RUNTIME="$HOME/tetra"
TETRA_SRC_DIR="$HOME/src/devops"
START_SCRIPT="$HOME/start-tetra.sh"

_ask() {
    local prompt="$1"
    local reply
    printf "%s [y/N] " "$prompt"
    read -r reply
    [[ "$reply" =~ ^[Yy]$ ]]
}

echo "=== Tetra Remove ==="
echo ""
echo "This will undo the tetra installation for user: $USER"
echo "Home: $HOME"
echo ""

# --- Step 1: Remove ~/start-tetra.sh ---
echo "Step 1: Shell integration"
if [[ -f "$START_SCRIPT" ]]; then
    if _ask "Remove $START_SCRIPT?"; then
        rm "$START_SCRIPT"
        echo "  Removed $START_SCRIPT"
    else
        echo "  Skipped"
    fi
else
    echo "  $START_SCRIPT does not exist"
fi
echo ""

# --- Step 2: Remove ~/tetra runtime directory ---
echo "Step 2: Runtime directory"
if [[ -d "$TETRA_RUNTIME" ]]; then
    echo "  $TETRA_RUNTIME contains:"
    du -sh "$TETRA_RUNTIME" 2>/dev/null | sed 's/^/    /'
    if [[ -d "$TETRA_RUNTIME/orgs" ]]; then
        echo "  Orgs:"
        ls -1 "$TETRA_RUNTIME/orgs" 2>/dev/null | sed 's/^/    /'
    fi
    echo ""
    if _ask "Remove $TETRA_RUNTIME? (orgs data will be lost)"; then
        rm -rf "$TETRA_RUNTIME"
        echo "  Removed $TETRA_RUNTIME"
    else
        echo "  Skipped"
    fi
else
    echo "  $TETRA_RUNTIME does not exist"
fi
echo ""

# --- Step 3: Remove source repo ---
echo "Step 3: Source repository"
if [[ -d "$TETRA_SRC_DIR" ]]; then
    echo "  $TETRA_SRC_DIR contains:"
    du -sh "$TETRA_SRC_DIR" 2>/dev/null | sed 's/^/    /'
    echo ""
    if _ask "Remove $TETRA_SRC_DIR? (cloned repo will be deleted)"; then
        rm -rf "$TETRA_SRC_DIR"
        echo "  Removed $TETRA_SRC_DIR"
    else
        echo "  Skipped"
    fi
else
    echo "  $TETRA_SRC_DIR does not exist"
fi
echo ""

# --- Summary ---
echo "=== Remove complete ==="
echo ""
echo "To finish cleanup, open a new terminal."
echo "If you also want to remove the system user:"
echo "  user delete $USER"
