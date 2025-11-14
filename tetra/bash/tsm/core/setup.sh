#!/usr/bin/env bash

# TSM Setup - Directory initialization and system setup
# This module handles TSM directory structure and system dependencies

# === DIRECTORY SETUP ===

tetra_tsm_setup() {
    # Add util-linux to PATH on macOS if installed (provides flock, setsid, etc)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local util_linux_bin=""

        # Try to detect Homebrew prefix dynamically first
        local brew_prefix=""
        if command -v brew >/dev/null 2>&1; then
            brew_prefix=$(brew --prefix 2>/dev/null)
        fi

        # Try multiple locations in order of preference
        local prefixes=()
        [[ -n "$brew_prefix" ]] && prefixes+=("$brew_prefix")
        [[ -n "$HOMEBREW_PREFIX" ]] && prefixes+=("$HOMEBREW_PREFIX")
        prefixes+=("/opt/homebrew" "/usr/local")

        for prefix in "${prefixes[@]}"; do
            if [[ -d "$prefix/opt/util-linux/bin" ]]; then
                util_linux_bin="$prefix/opt/util-linux/bin"
                break
            fi
        done

        # Add to PATH if not already there
        if [[ -n "$util_linux_bin" && -d "$util_linux_bin" ]] && [[ ":$PATH:" != *":$util_linux_bin:"* ]]; then
            PATH="$util_linux_bin:$PATH"
            export PATH
        fi
    fi

    # Create TSM directories
    local dirs=("$TSM_LOGS_DIR" "$TSM_PIDS_DIR" "$TSM_PROCESSES_DIR" "$TETRA_DIR/tsm/services-available" "$TETRA_DIR/tsm/services-enabled")
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done

    # Initialize ID counter
    local id_file="$TSM_ID_FILE"
    [[ -f "$id_file" ]] || echo "0" > "$id_file"

    echo "tsm: setup complete"
}

# Export setup function
export -f tetra_tsm_setup