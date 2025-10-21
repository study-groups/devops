#!/usr/bin/env bash
# Tetra Module Loader
# Discovers and loads modules from bash/*/

# Check if a directory is a valid module
tetra_is_module() {
    local module_dir="$1"
    local module_name="$(basename "$module_dir")"

    # Skip orchestrator itself
    [[ "$module_name" == "tetra" ]] && return 1

    # Skip libraries (they have no actions.sh)
    # Modules MUST have actions.sh to be discoverable
    [[ ! -f "$module_dir/actions.sh" ]] && return 1

    # Skip test/demo directories
    [[ "$module_name" == "demo" ]] && return 1
    [[ "$module_name" == "test" ]] && return 1

    return 0
}

# Load a single module (OLD orchestrator system - uses module path)
# Note: This is different from boot_core's tetra_load_module which uses module names
tetra_orchestrator_load_module() {
    local module_dir="$1"
    local module_name="$(basename "$module_dir")"

    # Check if module entry point exists
    local module_entry="$module_dir/${module_name}.sh"
    if [[ ! -f "$module_entry" ]]; then
        # Try alternate: includes.sh
        module_entry="$module_dir/includes.sh"
        if [[ ! -f "$module_entry" ]]; then
            echo "WARNING: Module $module_name has no entry point" >&2
            return 1
        fi
    fi

    # Source the module
    if source "$module_entry" 2>/dev/null; then
        # Register module
        TETRA_MODULES["$module_name"]="$module_dir"
        TETRA_MODULE_LIST+=("$module_name")
        return 0
    else
        echo "WARNING: Failed to load module: $module_name" >&2
        return 1
    fi
}

# Discover modules in bash/
tetra_discover_modules() {
    local bash_dir="$TETRA_SRC/bash"

    if [[ ! -d "$bash_dir" ]]; then
        echo "ERROR: bash/ directory not found: $bash_dir" >&2
        return 1
    fi

    local module_count=0
    for module_dir in "$bash_dir"/*/ ; do
        [[ ! -d "$module_dir" ]] && continue

        if tetra_is_module "$module_dir"; then
            local module_name="$(basename "$module_dir")"

            if tetra_orchestrator_load_module "$module_dir"; then
                ((module_count++))
            fi
        fi
    done

    return 0
}

# Load all modules
tetra_load_modules() {
    # Load core libraries first (no actions, but needed)
    # Color library
    if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
        source "$TETRA_SRC/bash/color/color.sh" 2>/dev/null || true
    fi

    # TDS library (if exists)
    if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
        source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
    fi

    # Discover and load modules
    tetra_discover_modules

    return 0
}

# Get loaded module list
tetra_list_loaded_modules() {
    for module in "${TETRA_MODULE_LIST[@]}"; do
        echo "$module"
    done
}

# Check if module is loaded
tetra_module_loaded() {
    local module_name="$1"
    [[ -n "${TETRA_MODULES[$module_name]}" ]]
}

# Get module path
tetra_get_module_path() {
    local module_name="$1"
    echo "${TETRA_MODULES[$module_name]}"
}

# Export functions
export -f tetra_is_module
export -f tetra_orchestrator_load_module
export -f tetra_discover_modules
export -f tetra_load_modules
export -f tetra_list_loaded_modules
export -f tetra_module_loaded
export -f tetra_get_module_path
