#!/usr/bin/env bash

# Tetra Module Initialization Utilities
# Provides standardized module setup following tetra conventions
#
# Usage in includes.sh:
#   source "$TETRA_SRC/bash/utils/module_init.sh"
#   tetra_module_init "mymodule" "data:cache:logs"
#
# This sets up:
#   MOD_SRC - Source directory ($TETRA_SRC/bash/mymodule)
#   MOD_DIR - Runtime data directory ($TETRA_DIR/mymodule)
#   Creates specified subdirectories under MOD_DIR

# Initialize a module with standard tetra conventions
# Args:
#   $1 - module name (e.g., "tsm", "rag", "tdocs")
#   $2 - colon-separated list of subdirectories to create (optional)
#        e.g., "data:cache:logs" or "runtime:runtime/processes:logs"
tetra_module_init() {
    local mod_name="$1"
    local subdirs="${2:-}"

    # Validate TETRA_SRC is set (required strong global)
    if [[ -z "${TETRA_SRC:-}" ]]; then
        echo "tetra_module_init: TETRA_SRC not set" >&2
        return 1
    fi

    # Set standard module paths
    # Each module must set its own paths (not preserved across modules)
    MOD_SRC="$TETRA_SRC/bash/$mod_name"
    MOD_DIR="$TETRA_DIR/$mod_name"

    # Create base runtime directory
    [[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"

    # Create requested subdirectories
    if [[ -n "$subdirs" ]]; then
        local IFS=':'
        for subdir in $subdirs; do
            [[ -n "$subdir" && ! -d "$MOD_DIR/$subdir" ]] && mkdir -p "$MOD_DIR/$subdir"
        done
    fi

    # Export for subprocesses
    export MOD_SRC MOD_DIR

    return 0
}

# Initialize module with backward-compatible aliases
# Creates both MOD_* and MODULE_* variables (e.g., TSM_SRC, TSM_DIR)
# Args:
#   $1 - module name (e.g., "tsm")
#   $2 - uppercase prefix for aliases (e.g., "TSM")
#   $3 - colon-separated subdirs (optional)
tetra_module_init_with_alias() {
    local mod_name="$1"
    local alias_prefix="$2"
    local subdirs="${3:-}"

    # Initialize standard paths
    tetra_module_init "$mod_name" "$subdirs" || return 1

    # Create uppercase aliases for backward compatibility
    # Using declare -g for explicit global scope
    declare -g "${alias_prefix}_SRC=$MOD_SRC"
    declare -g "${alias_prefix}_DIR=$MOD_DIR"

    # Export the aliases
    export "${alias_prefix}_SRC" "${alias_prefix}_DIR"

    return 0
}

# Check if a module is initialized
# Args:
#   $1 - module name
# Returns: 0 if initialized, 1 otherwise
tetra_module_is_init() {
    local mod_name="$1"
    local expected_src="$TETRA_SRC/bash/$mod_name"

    [[ "${MOD_SRC:-}" == "$expected_src" ]] && [[ -d "${MOD_DIR:-}" ]]
}

# Get module source path without initializing
# Args:
#   $1 - module name
tetra_module_src() {
    echo "$TETRA_SRC/bash/$1"
}

# Get module data path without initializing
# Args:
#   $1 - module name
tetra_module_dir() {
    echo "$TETRA_DIR/$1"
}
