#!/usr/bin/env bash

# Boot Core - Core functions and module system

# Load environment variables from local.env if it exists
if [[ -f "$TETRA_SRC/env/local.env" ]]; then
    source "$TETRA_SRC/env/local.env"
fi

# Lazy loading registry - only declare if not already exist to avoid reload conflicts
if ! declare -p TETRA_MODULE_LOADERS >/dev/null 2>&1; then
    declare -gA TETRA_MODULE_LOADERS
fi
if ! declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
    declare -gA TETRA_MODULE_LOADED
fi

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
    
    # DEFENSIVE LOADING - Prevent terminal crashes by testing in subshell first
    # Check for includes.sh first, fallback to loading main module file
    if [[ -f "$loader_path/includes.sh" ]]; then
        echo "BOOT: Testing $module_name in subshell..." >> /tmp/boot_trace.log
        # Test in subshell to catch fatal errors before sourcing in parent shell
        if ! ( source "$loader_path/includes.sh" ) >/dev/null 2>&1; then
            echo "ERROR: Module '$module_name' failed safety check (includes.sh has errors)" >&2
            echo "  File: $loader_path/includes.sh" >&2
            return 1
        fi
        echo "BOOT: Subshell test passed, now sourcing in parent..." >> /tmp/boot_trace.log
        # Safe to source in parent shell
        source "$loader_path/includes.sh"
        echo "BOOT: Parent shell source complete" >> /tmp/boot_trace.log
    elif [[ -f "$loader_path/$(basename "$loader_path").sh" ]]; then
        # Load the main module file (e.g., tkm/tkm.sh)
        if ! source "$loader_path/$(basename "$loader_path").sh" 2>&1; then
            echo "ERROR: Failed to load module '$module_name' from main file" >&2
            return 1
        fi
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
                if ! source "$f" 2>&1; then
                    echo "WARNING: Failed to source $f in module '$module_name'" >&2
                fi
            fi
        done
    else
        echo "Warning: Module path not found: $loader_path" >&2
        return 1
    fi

    echo "BOOT: Setting TETRA_MODULE_LOADED[$module_name]=true" >> /tmp/boot_trace.log
    TETRA_MODULE_LOADED[$module_name]=true
    echo "BOOT: Module $module_name load COMPLETE" >> /tmp/boot_trace.log
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
        
        # Function should now be the real one (tetra_load_module replaces the stub)
        \"$func_name\" \"\${args[@]}\"
    }
    "
}

# Function to unload a module
tetra_unload_module() {
    local module_name="$1"

    if [[ "${TETRA_MODULE_LOADED[$module_name]}" != "true" ]]; then
        echo "Module '$module_name' is not loaded" >&2
        return 1
    fi

    [[ "${TETRA_DEBUG_LOADING:-false}" == "true" ]] && echo "Unloading module: $module_name" >&2

    # Mark module as unloaded
    TETRA_MODULE_LOADED[$module_name]=false

    # Note: We cannot actually undefine functions that were loaded from the module
    # This would require tracking which functions belong to which module
    echo "Module '$module_name' marked as unloaded (functions remain available)"
}

# List loaded modules
tetra_list_modules() {
    echo "=== Tetra Module Status ==="
    for module in $(echo "${!TETRA_MODULE_LOADERS[@]}" | tr ' ' '\n' | sort); do
        local status="${TETRA_MODULE_LOADED[$module]:-false}"
        local path="${TETRA_MODULE_LOADERS[$module]}"
        printf "%-15s %-8s %s\n" "$module" "[$status]" "$path"
    done
}

# Register essential modules first
tetra_register_module "utils" "$TETRA_SRC/bash/utils"
tetra_register_module "prompt" "$TETRA_SRC/bash/prompt"
tetra_register_module "tmod" "$TETRA_SRC/bash/tmod"
tetra_register_module "qa" "$TETRA_SRC/bash/qa"

# Load essential modules immediately
tetra_load_module "utils"
tetra_load_module "prompt"
tetra_load_module "tmod"
tetra_load_module "qa"
