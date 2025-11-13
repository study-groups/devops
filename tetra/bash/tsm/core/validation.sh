#!/usr/bin/env bash

# TSM Validation & Helper Functions
# Extracted from tsm_interface.sh during Phase 2 refactor
# Functions for validation, environment detection, and utility helpers

# NOTE: tetra_tsm_setup() is defined in core/setup.sh (canonical version)
# This file focuses on validation functions only

# === VALIDATION FUNCTIONS ===

_tsm_validate_script() {
    local script="$1"
    [[ -n "$script" ]] || {
        echo "tsm: script required" >&2
        return 64
    }
    [[ -f "$script" && -x "$script" ]] || {
        echo "tsm: '$script' not found or not executable" >&2
        return 66
    }
    return 0
}

_tsm_auto_detect_env() {
    local script="$1"
    local env_file="$2"

    # If env file explicitly provided, use it
    if [[ -n "$env_file" ]]; then
        local resolved_path
        if [[ "$env_file" == /* ]]; then
            # Absolute path
            resolved_path="$env_file"
        else
            # Relative to script directory or current directory
            local script_dir="$(dirname "$script")"
            if [[ -f "$script_dir/$env_file" ]]; then
                resolved_path="$script_dir/$env_file"
            elif [[ -f "$env_file" ]]; then
                resolved_path="$PWD/$env_file"
            else
                echo "tsm: environment file '$env_file' not found" >&2
                return 66
            fi
        fi

        _tsm_validate_env_file "$resolved_path" || return $?
        echo "$resolved_path"
        return 0
    fi

    # Auto-detection logic - check common locations
    local script_dir="$(dirname "$script")"
    local candidates=(
        "$script_dir/env/dev.env"
        "$script_dir/env/local.env"
        "$script_dir/.env"
        "$PWD/env/dev.env"
        "$PWD/env/local.env"
        "$PWD/.env"
    )

    for candidate in "${candidates[@]}"; do
        if [[ -f "$candidate" ]]; then
            if _tsm_validate_env_file "$candidate"; then
                echo "$candidate"
                return 0
            fi
        fi
    done

    # No environment file found - that's okay
    echo ""
    return 0
}

_tsm_validate_env_file() {
    local env_file="$1"
    [[ -f "$env_file" ]] || {
        echo "tsm: environment file '$env_file' not found" >&2
        return 66
    }

    # Check for common placeholder patterns that indicate incomplete setup
    if grep -q "YOUR_.*_HERE\|REPLACE_.*\|TODO.*\|CHANGEME" "$env_file" 2>/dev/null; then
        echo "tsm: environment file '$env_file' contains placeholder values" >&2
        echo "tsm: please update the file with real values before using" >&2
        return 65
    fi

    return 0
}

# === PATH RESOLUTION ===

_tsm_resolve_script_path() {
    local script="$1"

    # If absolute path, use as-is
    if [[ "$script" == /* ]]; then
        echo "$script"
        return 0
    fi

    # If relative path with directory, resolve from current directory
    if [[ "$script" == */* ]]; then
        echo "$PWD/$script"
        return 0
    fi

    # Otherwise, treat as filename in current directory
    echo "$PWD/$script"
    return 0
}

# === NAME GENERATION ===

_tsm_generate_name() {
    local script="$1"
    local custom_name="$2"
    local port="$3"
    local env_file="$4"

    if [[ -n "$custom_name" ]]; then
        echo "${custom_name}-${port}"
        return 0
    fi

    # Extract basename from script path
    local basename
    basename="$(basename "$script" .sh)"

    # Add environment suffix if present
    if [[ -n "$env_file" ]]; then
        local env_name
        env_name="$(basename "$env_file" .env)"
        env_name="${env_name%.env}"  # Remove .env extension if double
        echo "${basename}-${env_name}-${port}"
    else
        echo "${basename}-${port}"
    fi
}

# === ID MANAGEMENT ===

tetra_tsm_reset_id() {
    local id_file="$TETRA_DIR/tsm/next_id"

    # Find the maximum current TSM ID
    local max_id=0
    for metafile in "$TSM_PROCESSES_DIR"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local tsm_id=""
        eval "$(grep -o 'tsm_id=[0-9]*' "$metafile" 2>/dev/null)"
        if [[ -n "$tsm_id" && "$tsm_id" -gt "$max_id" ]]; then
            max_id="$tsm_id"
        fi
    done

    # Set next ID to max + 1
    echo $((max_id + 1)) > "$id_file"
    echo "tsm: reset ID counter to $((max_id + 1))"
}

# Export validation functions
export -f _tsm_validate_script
export -f _tsm_auto_detect_env
export -f _tsm_validate_env_file
export -f _tsm_resolve_script_path
export -f _tsm_generate_name
export -f tetra_tsm_reset_id