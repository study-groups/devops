#!/usr/bin/env bash
# TSM Utils - core utility functions

# === ERROR HELPERS ===

tsm_error() {
    if [[ "${TSM_COLORS_LOADED:-}" == "true" ]] && declare -F tc &>/dev/null; then
        printf "tsm: %b\n" "$(tc 'error' "$*")" >&2
    else
        echo "tsm: $*" >&2
    fi
}

tsm_warn() {
    if [[ "${TSM_COLORS_LOADED:-}" == "true" ]] && declare -F tc &>/dev/null; then
        printf "tsm: warning - %b\n" "$(tc 'warning' "$*")" >&2
    else
        echo "tsm: warning - $*" >&2
    fi
}

# === JSON HELPERS ===

_tsm_json_escape() {
    local str="$1"
    # Escape: backslash, double-quote, control chars (tab, newline, carriage return)
    printf '%s' "$str" | sed \
        -e 's/\\/\\\\/g' \
        -e 's/"/\\"/g' \
        -e 's/	/\\t/g' \
        -e 's/\r/\\r/g' \
        -e 's/\x0/\\u0000/g' | tr '\n' ' ' | sed 's/ $//'
}

# Export for use in other modules

tsm_json_error() {
    local message="$1" code="${2:-1}"
    printf '{"success":false,"error":{"message":"%s","code":%d}}\n' \
        "$(_tsm_json_escape "$message")" "$code"
}

tsm_json_success() {
    local message="$1" data="${2:-{}}"
    printf '{"success":true,"message":"%s","data":%s}\n' \
        "$(_tsm_json_escape "$message")" "$data"
}

# === PID/PROCESS CHECKS ===

tsm_is_pid_alive() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

tsm_is_running() {
    local name="$1"
    [[ -z "$name" ]] && return 1
    local meta="$TSM_PROCESSES_DIR/$name/meta.json"
    [[ -f "$meta" ]] || return 1
    local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
    tsm_is_pid_alive "$pid"
}

# === ID ALLOCATION ===

# Thread-safe ID allocation using flock or mkdir-based locking
tsm_get_next_id() {
    local lock_file="$TSM_PROCESSES_DIR/.id_lock"
    local lock_dir="$TSM_PROCESSES_DIR/.id_lock_dir"
    local use_flock=false

    mkdir -p "$TSM_PROCESSES_DIR"

    # Check for flock
    if command -v flock >/dev/null 2>&1; then
        use_flock=true
    fi

    # Acquire lock
    if [[ "$use_flock" == "true" ]]; then
        exec 200>"$lock_file"
        if ! flock -x -w 5 200; then
            tsm_error "failed to acquire ID lock (timeout)"
            exec 200>&-
            return 1
        fi
    else
        local attempts=0
        while ! mkdir "$lock_dir" 2>/dev/null; do
            ((attempts++))
            if [[ $attempts -ge 50 ]]; then
                # Check for stale lock
                local lock_time=$(cat "$lock_dir/.ts" 2>/dev/null || echo "0")
                if [[ $(($(date +%s) - lock_time)) -gt 30 ]]; then
                    rm -rf "$lock_dir"
                    continue
                fi
                tsm_error "failed to acquire ID lock (timeout)"
                return 1
            fi
            sleep 0.1
        done
        date +%s > "$lock_dir/.ts"
    fi

    # Collect used IDs
    local -a used_ids=()
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue
        local meta="${dir}meta.json"
        if [[ -f "$meta" ]]; then
            local id=$(jq -r '.id // empty' "$meta" 2>/dev/null)
            [[ -n "$id" ]] && used_ids+=("$id")
        fi
    done

    # Check reserved placeholders
    for rdir in "$TSM_PROCESSES_DIR"/.reserved-*/; do
        [[ -d "$rdir" ]] || continue
        local rid=$(basename "$rdir" | sed 's/^\.reserved-//')
        [[ "$rid" =~ ^[0-9]+$ ]] && used_ids+=("$rid")
    done

    # Sort and find gap
    if [[ ${#used_ids[@]} -gt 0 ]]; then
        readarray -t used_ids < <(printf '%s\n' "${used_ids[@]}" | sort -n)
    fi

    local next_id=0
    for uid in "${used_ids[@]}"; do
        [[ $next_id -eq $uid ]] && ((next_id++)) || break
    done

    # Reserve ID
    mkdir -p "$TSM_PROCESSES_DIR/.reserved-$next_id"

    # Release lock
    if [[ "$use_flock" == "true" ]]; then
        flock -u 200
        exec 200>&-
    else
        rm -rf "$lock_dir"
    fi

    echo "$next_id"
}

# === NAME RESOLUTION ===

# Resolve input (name, partial, or ID) to process name
# Returns: process name on stdout, error code indicates failure type
#   0 = success
#   1 = not found
#   2 = ambiguous (multiple matches)
#   3 = found but stopped (when include_stopped=false)
tsm_resolve_name() {
    local input="$1"
    local include_stopped="${2:-false}"

    [[ -z "$input" ]] && return 1

    # Numeric = ID lookup
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        for dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue
            local id=$(jq -r '.id // empty' "$meta" 2>/dev/null)
            if [[ "$id" == "$input" ]]; then
                local name=$(basename "$dir")
                # Check if stopped when include_stopped=false
                if [[ "$include_stopped" != "true" ]] && ! tsm_is_running "$name"; then
                    echo "$name" # Still output name for error messages
                    return 3     # Found but stopped
                fi
                echo "$name"
                return 0
            fi
        done
        return 1  # ID not found
    fi

    # Exact match
    if [[ -d "$TSM_PROCESSES_DIR/$input" ]]; then
        if [[ "$include_stopped" == "true" ]] || tsm_is_running "$input"; then
            echo "$input"
            return 0
        else
            echo "$input"  # Output name for error messages
            return 3       # Found but stopped
        fi
    fi

    # Fuzzy match
    local -a matches=()
    local -a stopped_matches=()
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue
        [[ "$name" == *"$input"* ]] || continue

        if tsm_is_running "$name"; then
            matches+=("$name")
        else
            stopped_matches+=("$name")
        fi
    done

    # Include stopped if requested
    [[ "$include_stopped" == "true" ]] && matches+=("${stopped_matches[@]}")

    case ${#matches[@]} in
        0)
            # Check if we had stopped matches
            if [[ ${#stopped_matches[@]} -gt 0 && "$include_stopped" != "true" ]]; then
                echo "${stopped_matches[0]}"
                return 3  # Found but stopped
            fi
            return 1  # Not found
            ;;
        1)
            echo "${matches[0]}"
            return 0
            ;;
        *)
            tsm_error "ambiguous: '$input' matches ${#matches[@]} processes"
            for m in "${matches[@]}"; do echo "  $m" >&2; done
            return 2
            ;;
    esac
}

# Helper to get descriptive error for resolve_name return codes
_tsm_resolve_error() {
    local input="$1"
    local code="$2"
    local name="$3"  # May be set even on failure

    case "$code" in
        1) echo "not found: '$input'" ;;
        2) echo "ambiguous: '$input' (see above)" ;;
        3) echo "'${name:-$input}' exists but is stopped (use -a to include stopped)" ;;
        *) echo "unknown error resolving '$input'" ;;
    esac
}

# === VALIDATION ===

tsm_validate_script() {
    local script="$1"
    [[ -n "$script" ]] || { tsm_error "script required"; return 64; }
    [[ -f "$script" && -x "$script" ]] || { tsm_error "'$script' not found or not executable"; return 66; }
    return 0
}

tsm_validate_env_file() {
    local env_file="$1"
    [[ -f "$env_file" ]] || { tsm_error "env file '$env_file' not found"; return 66; }
    if grep -qE 'YOUR_.*_HERE|REPLACE_.*|TODO|CHANGEME' "$env_file" 2>/dev/null; then
        tsm_error "env file '$env_file' contains placeholder values"
        return 65
    fi
    return 0
}

# Find env file - supports org-level env names and file paths
# Usage: tsm_find_env_file <script> <explicit>
#
# <explicit> can be:
#   "local"|"dev"|"staging"|"prod" → $TETRA_DIR/orgs/$TETRA_ORG/env/<name>.env
#   "/path/to/file"                 → absolute path used directly
#   "file.env"                      → resolved relative to script dir or PWD
#   ""                              → auto-detect from common locations
tsm_find_env_file() {
    local script="$1"
    local explicit="$2"

    # Explicit value provided
    if [[ -n "$explicit" ]]; then
        # Check if it's an environment name (local/dev/staging/prod)
        if [[ "$explicit" =~ ^(local|dev|staging|prod)$ ]]; then
            local org="${TETRA_ORG:-tetra}"
            local env_path="$TETRA_DIR/orgs/$org/env/${explicit}.env"
            if [[ -f "$env_path" ]]; then
                echo "$env_path"
                return 0
            else
                tsm_error "org env file not found: $env_path"
                return 66
            fi
        fi

        # Absolute path
        if [[ "$explicit" == /* ]]; then
            if [[ -f "$explicit" ]]; then
                echo "$explicit"
                return 0
            else
                tsm_error "env file '$explicit' not found"
                return 66
            fi
        fi

        # Relative path - try script dir first, then PWD
        if [[ -n "$script" && -f "$(dirname "$script")/$explicit" ]]; then
            echo "$(dirname "$script")/$explicit"
            return 0
        elif [[ -f "$explicit" ]]; then
            echo "$PWD/$explicit"
            return 0
        else
            tsm_error "env file '$explicit' not found"
            return 66
        fi
    fi

    # Auto-detect from common locations
    local dir="${script:+$(dirname "$script")}"
    local candidates=()
    [[ -n "$dir" ]] && candidates+=("$dir/.env" "$dir/env/dev.env" "$dir/env/local.env")
    candidates+=("$PWD/.env")

    for c in "${candidates[@]}"; do
        [[ -f "$c" ]] && { echo "$c"; return 0; }
    done

    echo ""  # No env file found, that's okay
    return 0
}

# === ENV PARSING ===

# Get single value from env file without full sourcing
# Usage: tsm_env_get <file> <key>
tsm_env_get() {
    local file="$1" key="$2"
    local line value

    [[ -f "$file" ]] || return 1
    [[ -n "$key" ]] || return 1

    # Match "export KEY=val" or "KEY=val"
    line=$(grep -E "^(export )?${key}=" "$file" 2>/dev/null) || return 1

    # Extract value after first =
    value="${line#*=}"

    # Strip quotes
    value="${value#\"}" ; value="${value%\"}"
    value="${value#\'}" ; value="${value%\'}"

    echo "$value"
}

# Get multiple values from env file
# Usage: tsm_env_gets <file> <key1> [key2] [key3] ...
# Output: KEY1=value1\nKEY2=value2\n...
tsm_env_gets() {
    local file="$1"; shift
    local key

    [[ -f "$file" ]] || return 1

    for key in "$@"; do
        local val
        val=$(tsm_env_get "$file" "$key") && printf "%s=%s\n" "$key" "$val"
    done
}

# Parse PORT from env file (without full sourcing)
tsm_parse_env_port() {
    local env_file="$1"
    tsm_env_get "$env_file" PORT
}

# === PATH HELPERS ===

tsm_resolve_path() {
    local path="$1"
    [[ "$path" == /* ]] && { echo "$path"; return 0; }
    echo "$PWD/$path"
}

# === SECURITY ===

_tsm_safe_remove_dir() {
    local dir="$1"
    [[ -z "$dir" ]] && { tsm_error "cannot remove empty path"; return 1; }
    [[ "$dir" =~ ^"$TSM_PROCESSES_DIR"/.+ ]] || { tsm_error "invalid path: $dir"; return 1; }
    [[ -d "$dir" ]] && rm -rf "$dir"
    return 0
}

# === TERMINAL ===

tsm_term_width() {
    local w="${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}"
    [[ "$w" =~ ^[0-9]+$ && "$w" -ge 40 ]] || w=80
    echo "$w"
}

# === UPTIME FORMATTING ===

tsm_format_uptime() {
    local seconds="$1"
    [[ -z "$seconds" || "$seconds" -le 0 ]] && { echo "-"; return; }

    if [[ $seconds -lt 60 ]]; then
        echo "${seconds}s"
    elif [[ $seconds -lt 3600 ]]; then
        echo "$((seconds/60))m"
    elif [[ $seconds -lt 86400 ]]; then
        echo "$((seconds/3600))h"
    else
        echo "$((seconds/86400))d"
    fi
}

# === EXPORTS ===

