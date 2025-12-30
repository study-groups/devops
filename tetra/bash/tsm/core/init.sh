#!/usr/bin/env bash
# TSM Init - bootstrap, globals, and directory setup
# Requires: TETRA_SRC, TETRA_DIR to be set

# === VERSION CHECK ===

_tsm_check_version() {
    local major="${BASH_VERSINFO[0]}"
    local minor="${BASH_VERSINFO[1]}"
    if [[ $major -lt 5 ]] || [[ $major -eq 5 && $minor -lt 2 ]]; then
        echo "tsm: requires bash 5.2+ (current: $BASH_VERSION)" >&2
        return 1
    fi
    return 0
}

_tsm_check_version || return 1

# === CORE PATHS ===

export TSM_SRC="${TSM_SRC:-$TETRA_SRC/bash/tsm}"
export TSM_DIR="${TETRA_DIR}/tsm"
export TSM_PROCESSES_DIR="${TSM_DIR}/runtime/processes"
export TSM_LOGS_DIR="${TSM_DIR}/runtime/logs"
export TSM_SERVICES_DIR="${TSM_DIR}/services"

# === DIRECTORY SETUP ===

tsm_setup() {
    mkdir -p "$TSM_PROCESSES_DIR" "$TSM_LOGS_DIR" "$TSM_SERVICES_DIR"

    # macOS: ensure setsid is available
    if [[ "$TSM_PLATFORM" == "macos" ]]; then
        if ! tsm_has_setsid; then
            tsm_warn "setsid not found. Install with: brew install util-linux"
        fi
    fi
}

# Run setup on load
tsm_setup

# === ENVIRONMENT FILE HELPERS ===

# Load environment file into current shell
tsm_load_env() {
    local env_file="$1"
    [[ -f "$env_file" ]] || return 1
    set -a
    source "$env_file"
    set +a
}

# Parse env file for PORT and NAME (runs in subshell)
# Usage: eval $(tsm_parse_env "$env_file")
tsm_parse_env() {
    local env_file="$1"
    [[ -f "$env_file" ]] || return 1
    (
        source "$env_file" 2>/dev/null
        echo "ENV_PORT=${PORT:-}"
        echo "ENV_NAME=${NAME:-}"
    )
}

# Get single var from env file
tsm_env_var() {
    local env_file="$1"
    local var_name="$2"
    [[ -f "$env_file" ]] || return 1
    (source "$env_file" 2>/dev/null && echo "${!var_name}")
}

# === PROCESS NAME GENERATION ===

# Generate process name from command, port, and cwd
# Format: {project}-{port} or {project}-{timestamp}
tsm_generate_name() {
    local command="$1"
    local port="$2"
    local cwd="${3:-$PWD}"
    local custom_name="$4"

    # Use custom name if provided
    if [[ -n "$custom_name" ]]; then
        if [[ -n "$port" && "$port" != "0" ]]; then
            echo "${custom_name}-${port}"
        else
            echo "${custom_name}-$(date +%s)"
        fi
        return 0
    fi

    # Get project name from directory (skip common build dirs)
    local project=$(basename "$cwd")
    local skip_dirs="node_modules|dist|build|.git|__pycache__|venv|target"
    while [[ "$project" =~ ^($skip_dirs)$ && "$cwd" != "/" ]]; do
        cwd=$(dirname "$cwd")
        project=$(basename "$cwd")
    done

    # Sanitize project name
    project=$(echo "$project" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/^-//;s/-$//')
    [[ -z "$project" ]] && project="tsm"

    if [[ -n "$port" && "$port" != "0" ]]; then
        echo "${project}-${port}"
    else
        echo "${project}-$(date +%s)"
    fi
}

# === INTERPRETER DETECTION ===

tsm_detect_interpreter() {
    local cmd="$1"
    local first_word="${cmd%% *}"

    # Direct interpreter
    case "$first_word" in
        python|python3) echo "python"; return ;;
        node|npx) echo "node"; return ;;
        ruby) echo "ruby"; return ;;
        go) echo "go"; return ;;
        cargo|rustc) echo "rust"; return ;;
        java) echo "java"; return ;;
        php) echo "php"; return ;;
        perl) echo "perl"; return ;;
        bash|sh|zsh) echo "shell"; return ;;
    esac

    # Check for script extension
    local script="${cmd%% *}"
    case "$script" in
        *.py) echo "python"; return ;;
        *.js|*.mjs) echo "node"; return ;;
        *.rb) echo "ruby"; return ;;
        *.go) echo "go"; return ;;
        *.rs) echo "rust"; return ;;
        *.java) echo "java"; return ;;
        *.php) echo "php"; return ;;
        *.pl) echo "perl"; return ;;
        *.sh) echo "shell"; return ;;
    esac

    # Default
    echo "unknown"
}

export -f tsm_setup tsm_load_env tsm_parse_env tsm_env_var
export -f tsm_generate_name tsm_detect_interpreter
