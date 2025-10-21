#!/usr/bin/env bash
# Tetra Orchestrator Bootstrap
# Validates environment and initializes the orchestrator

# Validate Bash version
tetra_validate_bash_version() {
    if [[ "${BASH_VERSINFO[0]}" -lt 5 || ("${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2) ]]; then
        echo "ERROR: Bash 5.2+ required (found $BASH_VERSION)" >&2
        return 1
    fi
    return 0
}

# Validate TETRA_SRC
tetra_validate_tetra_src() {
    if [[ -z "$TETRA_SRC" ]]; then
        echo "ERROR: TETRA_SRC not set" >&2
        echo "tetra ALWAYS starts by: source ~/tetra/tetra.sh" >&2
        return 1
    fi

    if [[ ! -d "$TETRA_SRC" ]]; then
        echo "ERROR: TETRA_SRC directory not found: $TETRA_SRC" >&2
        return 1
    fi

    return 0
}

# Initialize TETRA_DIR
tetra_init_tetra_dir() {
    # Default to ~/.tetra if not set
    : "${TETRA_DIR:=$HOME/.tetra}"
    export TETRA_DIR

    # Create necessary directories
    mkdir -p "$TETRA_DIR/tetra"/{actions,flows,config,logs}

    return 0
}

# Initialize orchestrator globals
tetra_init_globals() {
    # Orchestrator paths
    export TETRA_ORCHESTRATOR_DIR="$TETRA_SRC/bash/tetra"
    export TETRA_CORE_DIR="$TETRA_ORCHESTRATOR_DIR/core"
    export TETRA_INTERFACES_DIR="$TETRA_ORCHESTRATOR_DIR/interfaces"

    # Runtime paths
    export TETRA_RUNTIME_DIR="$TETRA_DIR/tetra"
    export TETRA_ACTIONS_DIR="$TETRA_RUNTIME_DIR/actions"
    export TETRA_FLOWS_DIR="$TETRA_RUNTIME_DIR/flows"
    export TETRA_CONFIG_DIR="$TETRA_RUNTIME_DIR/config"
    export TETRA_LOGS_DIR="$TETRA_RUNTIME_DIR/logs"

    # Orchestrator state
    export TETRA_ENV="${TETRA_ENV:-Local}"        # Current environment
    export TETRA_MODE="${TETRA_MODE:-}"           # Active modules (comma-separated)

    # Module registry
    declare -gA TETRA_MODULES                     # module_name → module_path
    declare -ga TETRA_MODULE_LIST                 # Array of module names

    # Action registry
    declare -gA TETRA_ACTIONS                     # action_name → module_name
    declare -ga TETRA_ACTION_LIST                 # Array of action names

    return 0
}

# Main bootstrap function
tetra_bootstrap() {
    # Validate environment
    tetra_validate_bash_version || return 1
    tetra_validate_tetra_src || return 1

    # Initialize
    tetra_init_tetra_dir || return 1
    tetra_init_globals || return 1

    return 0
}

# Export functions
export -f tetra_validate_bash_version
export -f tetra_validate_tetra_src
export -f tetra_init_tetra_dir
export -f tetra_init_globals
export -f tetra_bootstrap
