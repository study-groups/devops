#!/usr/bin/env bash

# TSM Validation & Helper Functions
# Extracted from tsm_interface.sh during Phase 2 refactor
# Functions for validation, environment detection, and utility helpers

# === SYSTEM SETUP ===

tetra_tsm_setup() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Check if util-linux is available (provides setsid)
        local util_linux_bin="/opt/homebrew/opt/util-linux/bin"
        if [[ -d "$util_linux_bin" ]] && [[ ":$PATH:" != *":$util_linux_bin:"* ]]; then
            echo "tsm: added util-linux to PATH for setsid support"
            export PATH="$util_linux_bin:$PATH"
        fi

        if ! command -v setsid > /dev/null 2>&1; then
            echo "tsm: warning - setsid not found. Install with: brew install util-linux" >&2
        fi
    fi

    # Create required directories
    local dirs=("$TSM_LOGS_DIR" "$TSM_PIDS_DIR" "$TSM_PROCESSES_DIR")
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done

    echo "tsm: setup complete"
}

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

# === METADATA MANAGEMENT ===

_tsm_save_metadata() {
    local name="$1"
    local script="$2"
    local pid="$3"
    local port="$4"
    local type="$5"
    local start_dir="${6:-}"
    local cwd="${7:-}"
    local preserve_id="${8:-}"
    local is_restart="${9:-false}"
    local env_file="${10:-}"

    local tsm_id restart_count=0 last_restart_time=""
    if [[ -n "$preserve_id" ]]; then
        tsm_id="$preserve_id"
        # If preserving ID, check for existing restart count
        local existing_metafile="$TSM_PROCESSES_DIR/$name.meta"
        if [[ -f "$existing_metafile" ]] && [[ "$is_restart" == "true" ]]; then
            # Extract existing restart count
            local existing_restart_count=""
            eval "$(grep -o 'restart_count=[0-9]*' "$existing_metafile" 2>/dev/null || echo 'restart_count=0')"
            restart_count=$((existing_restart_count + 1))
            last_restart_time=$(date +%s)
        fi
    else
        tsm_id=$(tetra_tsm_get_next_id)
    fi

    local metafile="$TSM_PROCESSES_DIR/$name.meta"
    local meta_content="script='$script' pid=$pid port=$port start_time=$(date +%s) type=$type tsm_id=$tsm_id restart_count=$restart_count"
    [[ -n "$start_dir" ]] && meta_content+=" start_dir='$start_dir'"
    [[ -n "$cwd" ]] && meta_content+=" cwd='$cwd'"
    [[ -n "$last_restart_time" ]] && meta_content+=" last_restart_time=$last_restart_time"

    echo "$meta_content" > "$metafile"

    # Save environment info
    {
        echo "TSM_ENV_FILE=\"$env_file\""
        printenv
    } > "$TSM_PROCESSES_DIR/$name.env"

    echo "$tsm_id"
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
export -f tetra_tsm_setup
export -f _tsm_validate_script
export -f _tsm_auto_detect_env
export -f _tsm_validate_env_file
export -f _tsm_resolve_script_path
export -f _tsm_generate_name
export -f _tsm_save_metadata
export -f tetra_tsm_reset_id