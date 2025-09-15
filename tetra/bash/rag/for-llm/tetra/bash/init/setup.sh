#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Safe setup - preserve existing user data
if [[ -d "$HOME/tetra" ]]; then
    # Update tetra.sh entry point only
    cp "$SCRIPT_DIR/tetra-dir/tetra.sh" "$HOME/tetra/"
    echo "Updated $HOME/tetra/tetra.sh"
else
    # Fresh installation
    cp -r "$SCRIPT_DIR/tetra-dir" "$HOME/tetra"
    echo "Created $HOME/tetra/"
fi

echo "Add to ~/.bashrc: source \$HOME/tetra/tetra.sh"