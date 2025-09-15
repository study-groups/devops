#!/usr/bin/env bash

# Boot Core - Core functions and module system

# Lazy loading registry
declare -A TETRA_MODULE_LOADERS
declare -A TETRA_MODULE_LOADED

# Function to register a module loader
tetra_register_module() {
    local module_name="$1"
    local loader_path="$2"
    
    # Prevent overwriting existing loader path
    if [[ -z "${TETRA_MODULE_LOADERS[$module_name]:-}" ]]; then
        TETRA_MODULE_LOADERS[$module_name]="$loader_path"
    fi
    
    # Only set to false if not already loaded or registered
    if [[ -z "${TETRA_MODULE_LOADED[$module_name]:-}" ]] && 
       [[ "${TETRA_MODULE_LOADED[$module_name]:-false}" != "true" ]]; then
        TETRA_MODULE_LOADED[$module_name]=false
    fi
}

# Function to load a module on demand
tetra_load_module() {
    local module_name="$1"
    
    if [[ "${TETRA_MODULE_LOADED[$module_name]}" == "true" ]]; then
        return 0  # Already loaded
    fi
    
    local loader_path="${TETRA_MODULE_LOADERS[$module_name]}"
    if [[ -z "$loader_path" ]]; then
        echo "Warning: Unknown module '$module_name'" >&2
        return 1
    fi
    
    [[ "${TETRA_DEBUG_LOADING:-false}" == "true" ]] && echo "Loading module: $module_name" >&2
    
    # Check for includes.sh first, fallback to loading main module file
    if [[ -f "$loader_path/includes.sh" ]]; then
        source "$loader_path/includes.sh"
    elif [[ -f "$loader_path/$(basename "$loader_path").sh" ]]; then
        # Load the main module file (e.g., tkm/tkm.sh)
        source "$loader_path/$(basename "$loader_path").sh"
    elif [[ -d "$loader_path" ]]; then
        # Fallback: load all .sh files except excluded ones
        for f in "$loader_path"/*.sh; do
            if [[ -f "$f" && "$f" != *"/includes.sh" && \
                  "$f" != *"/bootloader.sh" && \
                  "$f" != *"/bootstrap.sh" && \
                  "$f" != *"/tetra_env.sh" && \
                  "$f" != *"/deploy_repl.sh" && \
                  "$f" != *"/tkm_repl.sh" && \
                  "$f" != *"/tkm_ssh_inspector.sh" && \
                  "$f" != *"/tsm_repl.sh" && \
                  "$f" != *"/tmod_repl.sh" && \
                  "$f" != *"/init.sh" ]]; then
                source "$f"
            fi
        done
    else
        echo "Warning: Module path not found: $loader_path" >&2
        return 1
    fi
    
    TETRA_MODULE_LOADED[$module_name]=true
}

# Create lazy loading stub functions
tetra_create_lazy_function() {
    local func_name="$1"
    local module_name="$2"
    
    eval "
    $func_name() {
        local args=(\"\$@\")
        
        if ! tetra_load_module \"$module_name\"; then
            echo \"Error: Failed to load module $module_name for function $func_name\" >&2
            return 1
        fi
        
        # Unset the stub function first
        unset -f \"$func_name\"
        
        # Check if the real function now exists after loading
        if declare -f \"$func_name\" >/dev/null 2>&1; then
            # Real function exists, call it
            \"$func_name\" \"\${args[@]}\"
        else
            echo \"Error: Real function $func_name not found after loading module $module_name\" >&2
            return 1
        fi
    }
    "
}

# Register essential modules first
tetra_register_module "utils" "$TETRA_SRC/bash/utils"
tetra_register_module "prompt" "$TETRA_SRC/bash/prompt"
tetra_register_module "tmod" "$TETRA_SRC/bash/tmod"
tetra_register_module "qa" "$TETRA_SRC/bash/qa"

# Source module config system
source "$TETRA_SRC/bash/utils/module_config.sh"

# Load essential modules immediately
tetra_load_module "utils"
tetra_load_module "prompt"
tetra_load_module "tmod"
tetra_load_module "qa"
