#!/usr/bin/env bash

# TSM Core - Modular process lifecycle management
# This is the main loader that orchestrates all TSM modules

# === TSM CORE FUNCTIONS ===
# Core functions now loaded via include.sh - no internal loading needed

# === TSM MODULE DISCOVERY INTERFACE ===
# Mandatory functions for module registry compliance

# TSM Module Actions - Available commands/verbs
tsm_module_actions() {
    echo "start stop restart delete list services logs ports doctor repl monitor stream dashboard patrol"
}

# TSM Module Properties - Available data/nouns
tsm_module_properties() {
    echo "processes services logs ports status config environment registry"
}

# TSM Module Information
tsm_module_info() {
    echo "TSM - Tetra Service Manager"
    echo "Purpose: Local development process and service management"
    echo "Scope: Process lifecycle, port management, service definitions"

    # Show current state
    local process_count=$(tsm list 2>/dev/null | grep -c "TSM ID" || echo "0")
    echo "Active Processes: $process_count"

    # Show port registry status
    if tsm ports validate >/dev/null 2>&1; then
        echo "Port Registry: Valid"
    else
        echo "Port Registry: Validation errors"
    fi
}

# TSM Module Initialization
tsm_module_init() {
    # Validate core functions are available first
    if ! declare -f _tsm_init_global_state >/dev/null; then
        echo "ERROR: TSM core initialization failed - missing _tsm_init_global_state" >&2
        echo "Make sure tsm_config.sh is loaded before calling tsm_module_init" >&2
        return 1
    fi

    # Initialize TSM-specific state after validation
    _tsm_init_global_state

    # Use new lifecycle management for component initialization
    if declare -f tsm_lifecycle_init_all >/dev/null; then
        echo "🔄 Using lifecycle management for component initialization..."
        tsm_lifecycle_init_all
    else
        echo "⚠️  Lifecycle management not available, using legacy initialization"

        # Load deferred external dependencies (legacy fallback)
        if declare -f _tsm_repl_load_utils >/dev/null; then
            _tsm_repl_load_utils
        fi

        if declare -f _tsm_ports_load_toml_parser >/dev/null; then
            _tsm_ports_load_toml_parser
        fi
    fi

    echo "TSM module initialized successfully"
}

# === COMPATIBILITY EXPORTS ===

# Re-export all functions for backwards compatibility (only if they exist)
# This prevents export errors when using minimal includes

# Setup module
if declare -f tetra_tsm_setup >/dev/null; then
    export -f tetra_tsm_setup
fi

# Helpers module
if declare -f _tsm_get_next_id >/dev/null; then
    export -f _tsm_get_next_id
fi
if declare -f _tsm_validate_script >/dev/null; then
    export -f _tsm_validate_script
fi
if declare -f _tsm_generate_process_name >/dev/null; then
    export -f _tsm_generate_process_name
fi

# Files module
if declare -f _tsm_get_process_file >/dev/null; then
    export -f _tsm_get_process_file
fi
if declare -f _tsm_get_pid_file >/dev/null; then
    export -f _tsm_get_pid_file
fi
if declare -f _tsm_get_log_file >/dev/null; then
    export -f _tsm_get_log_file
fi
if declare -f _tsm_write_process_info >/dev/null; then
    export -f _tsm_write_process_info
fi
if declare -f _tsm_read_process_info >/dev/null; then
    export -f _tsm_read_process_info
fi

# Lifecycle module
if declare -f _tsm_is_process_running >/dev/null; then
    export -f _tsm_is_process_running
fi
if declare -f _tsm_get_process_by_name >/dev/null; then
    export -f _tsm_get_process_by_name
fi
if declare -f _tsm_kill_process >/dev/null; then
    export -f _tsm_kill_process
fi

# Environment module
if declare -f _tsm_load_environment >/dev/null; then
    export -f _tsm_load_environment
fi
if declare -f _tsm_extract_env_vars >/dev/null; then
    export -f _tsm_extract_env_vars
fi
if declare -f _tsm_get_env_port >/dev/null; then
    export -f _tsm_get_env_port
fi
if declare -f _tsm_get_env_name >/dev/null; then
    export -f _tsm_get_env_name
fi

# Note: _tsm_start_process is exported from tsm_interface.sh to avoid duplication