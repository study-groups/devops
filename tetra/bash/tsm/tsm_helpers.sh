#!/usr/bin/env bash

# TSM Helpers - Core utility functions
# This module provides essential helper functions for TSM operations

# === CORE HELPERS ===

_tsm_get_next_id() {
    local id_file="$TETRA_DIR/tsm/runtime/next_id"
    local next_id

    if [[ -f "$id_file" ]]; then
        next_id=$(cat "$id_file")
    else
        next_id=0
    fi

    echo $((next_id + 1)) > "$id_file"
    echo "$next_id"
}

_tsm_validate_script() {
    local script="$1"
    [[ -n "$script" ]] || { echo "tsm: script required" >&2; return 64; }
    [[ -f "$script" && -x "$script" ]] || { echo "tsm: '$script' not found or not executable" >&2; return 66; }
}

_tsm_generate_process_name() {
    local command="$1"
    local port="$2"
    local custom_name="$3"

    if [[ -n "$custom_name" ]]; then
        echo "$custom_name"
    elif [[ -n "$port" ]]; then
        local basename=$(basename "$command" .sh)
        echo "${basename}-${port}"
    else
        basename "$command" .sh
    fi
}

# Export helper functions
export -f _tsm_get_next_id
export -f _tsm_validate_script
export -f _tsm_generate_process_name