#!/usr/bin/env bash

# TSM Setup - Directory initialization and system setup
# This module handles TSM directory structure and system dependencies

# === DIRECTORY SETUP ===

tetra_tsm_setup() {
    # Ensure setsid is available on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local util_linux_bin="/opt/homebrew/opt/util-linux/bin"
        if [[ -d "$util_linux_bin" ]] && [[ ":$PATH:" != *":$util_linux_bin:"* ]]; then
            PATH="$util_linux_bin:$PATH"
            export PATH
            echo "tsm: added util-linux to PATH for setsid support"
        fi

        if ! command -v setsid >/dev/null 2>&1; then
            echo "tsm: warning - setsid not found. Install with: brew install util-linux" >&2
            return 1
        fi
    fi

    # Create TSM directories
    local dirs=("$TETRA_DIR/tsm/runtime/logs" "$TETRA_DIR/tsm/runtime/pids" "$TETRA_DIR/tsm/runtime/processes" "$TETRA_DIR/tsm/services-available" "$TETRA_DIR/tsm/services-enabled")
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done

    # Initialize ID counter
    local id_file="$TETRA_DIR/tsm/runtime/next_id"
    [[ -f "$id_file" ]] || echo "0" > "$id_file"

    echo "tsm: setup complete"
}

# Export setup function
export -f tetra_tsm_setup