#!/usr/bin/env bash

# Tetra Module Registry - Universal module discovery and management
# Enforces mandatory discovery interface contract for all registered modules

# Global module registry arrays
declare -gA TETRA_MODULES=()           # module_name → status
declare -gA TETRA_MODULE_PATHS=()      # module_name → source_path
declare -gA TETRA_MODULE_VERSIONS=()   # module_name → version

# Module status constants
readonly MODULE_STATUS_LOADING="loading"
readonly MODULE_STATUS_ACTIVE="active"
readonly MODULE_STATUS_ERROR="error"
readonly MODULE_STATUS_UNLOADED="unloaded"

# Register module with validation of mandatory discovery interface
tetra_module_register() {
    local module_name="$1"
    local module_path="$2"
    local status="${3:-$MODULE_STATUS_LOADING}"
    local version="${4:-1.0.0}"

    if [[ -z "$module_name" || -z "$module_path" ]]; then
        echo "ERROR: tetra_module_register requires module_name and module_path" >&2
        return 1
    fi

    # Only validate discovery interface for active status
    if [[ "$status" == "$MODULE_STATUS_ACTIVE" ]]; then
        # Validate mandatory discovery interface
        if ! declare -f "${module_name}_module_actions" >/dev/null; then
            echo "ERROR: Module '$module_name' missing mandatory ${module_name}_module_actions() function" >&2
            echo "       All registered modules must implement discovery interface" >&2
            return 1
        fi

        if ! declare -f "${module_name}_module_properties" >/dev/null; then
            echo "ERROR: Module '$module_name' missing mandatory ${module_name}_module_properties() function" >&2
            echo "       All registered modules must implement discovery interface" >&2
            return 1
        fi
    fi

    # Register module in global registry
    TETRA_MODULES["$module_name"]="$status"
    TETRA_MODULE_PATHS["$module_name"]="$module_path"
    TETRA_MODULE_VERSIONS["$module_name"]="$version"

    echo "Module '$module_name' registered with status: $status"
}

# Remove module from registry
tetra_module_unregister() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "ERROR: tetra_module_unregister requires module_name" >&2
        return 1
    fi

    unset TETRA_MODULES["$module_name"]
    unset TETRA_MODULE_PATHS["$module_name"]
    unset TETRA_MODULE_VERSIONS["$module_name"]

    echo "Module '$module_name' unregistered"
}

# Get module status
tetra_module_status() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "ERROR: tetra_module_status requires module_name" >&2
        return 1
    fi

    echo "${TETRA_MODULES[$module_name]:-unregistered}"
}

# Universal module discovery - query any registered module
tetra_module_discover() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "ERROR: tetra_module_discover requires module_name" >&2
        return 1
    fi

    local status="${TETRA_MODULES[$module_name]:-unregistered}"

    if [[ "$status" == "unregistered" ]]; then
        echo "Module '$module_name' is not registered"
        return 1
    fi

    echo "Module: $module_name"
    echo "Status: $status"
    echo "Path: ${TETRA_MODULE_PATHS[$module_name]}"
    echo "Version: ${TETRA_MODULE_VERSIONS[$module_name]}"
    echo ""

    # Show discovery interface if module is active
    if [[ "$status" == "$MODULE_STATUS_ACTIVE" ]]; then
        echo "Actions:"
        if declare -f "${module_name}_module_actions" >/dev/null; then
            "${module_name}_module_actions" | sed 's/^/  /'
        else
            echo "  (discovery interface not available)"
        fi

        echo ""
        echo "Properties:"
        if declare -f "${module_name}_module_properties" >/dev/null; then
            "${module_name}_module_properties" | sed 's/^/  /'
        else
            echo "  (discovery interface not available)"
        fi
    else
        echo "Actions: (module not active)"
        echo "Properties: (module not active)"
    fi
}

# List all registered modules
tetra_module_list() {
    local filter="${1:-all}"  # all, active, loading, error, unloaded

    echo "Tetra Module Registry"
    echo "===================="
    echo ""

    if [[ ${#TETRA_MODULES[@]} -eq 0 ]]; then
        echo "No modules registered"
        return 0
    fi

    for module_name in "${!TETRA_MODULES[@]}"; do
        local status="${TETRA_MODULES[$module_name]}"

        # Apply filter
        if [[ "$filter" != "all" && "$filter" != "$status" ]]; then
            continue
        fi

        local path="${TETRA_MODULE_PATHS[$module_name]}"
        local version="${TETRA_MODULE_VERSIONS[$module_name]}"

        printf "%-15s %-10s %-8s %s\n" "$module_name" "$status" "$version" "$path"
    done
}

# List all modules with full discovery information
tetra_module_list_detailed() {
    local filter="${1:-active}"  # Default to active modules only

    echo "Tetra Module Registry - Detailed View"
    echo "===================================="
    echo ""

    if [[ ${#TETRA_MODULES[@]} -eq 0 ]]; then
        echo "No modules registered"
        return 0
    fi

    local found_modules=false

    for module_name in "${!TETRA_MODULES[@]}"; do
        local status="${TETRA_MODULES[$module_name]}"

        # Apply filter
        if [[ "$filter" != "all" && "$filter" != "$status" ]]; then
            continue
        fi

        found_modules=true
        tetra_module_discover "$module_name"
        echo ""
    done

    if [[ "$found_modules" == "false" ]]; then
        echo "No modules found matching filter: $filter"
    fi
}

# Get list of module names by status
tetra_module_get_by_status() {
    local target_status="$1"

    for module_name in "${!TETRA_MODULES[@]}"; do
        local status="${TETRA_MODULES[$module_name]}"
        if [[ "$status" == "$target_status" ]]; then
            echo "$module_name"
        fi
    done
}

# Get active modules
tetra_module_get_active() {
    tetra_module_get_by_status "$MODULE_STATUS_ACTIVE"
}

# Get loading modules
tetra_module_get_loading() {
    tetra_module_get_by_status "$MODULE_STATUS_LOADING"
}

# Get modules with errors
tetra_module_get_error() {
    tetra_module_get_by_status "$MODULE_STATUS_ERROR"
}

# Query module actions (safe wrapper)
tetra_module_actions() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "ERROR: tetra_module_actions requires module_name" >&2
        return 1
    fi

    local status="${TETRA_MODULES[$module_name]:-unregistered}"

    if [[ "$status" != "$MODULE_STATUS_ACTIVE" ]]; then
        echo "Module '$module_name' is not active (status: $status)" >&2
        return 1
    fi

    if declare -f "${module_name}_module_actions" >/dev/null; then
        "${module_name}_module_actions"
    else
        echo "Module '$module_name' does not implement actions discovery" >&2
        return 1
    fi
}

# Query module properties (safe wrapper)
tetra_module_properties() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "ERROR: tetra_module_properties requires module_name" >&2
        return 1
    fi

    local status="${TETRA_MODULES[$module_name]:-unregistered}"

    if [[ "$status" != "$MODULE_STATUS_ACTIVE" ]]; then
        echo "Module '$module_name' is not active (status: $status)" >&2
        return 1
    fi

    if declare -f "${module_name}_module_properties" >/dev/null; then
        "${module_name}_module_properties"
    else
        echo "Module '$module_name' does not implement properties discovery" >&2
        return 1
    fi
}

# Registry validation and health check
tetra_module_validate_registry() {
    echo "Validating Tetra Module Registry"
    echo "==============================="
    echo ""

    local total_modules=${#TETRA_MODULES[@]}
    local valid_modules=0
    local invalid_modules=0

    if [[ $total_modules -eq 0 ]]; then
        echo "Registry is empty"
        return 0
    fi

    for module_name in "${!TETRA_MODULES[@]}"; do
        local status="${TETRA_MODULES[$module_name]}"
        printf "Checking %-15s ... " "$module_name"

        if [[ "$status" == "$MODULE_STATUS_ACTIVE" ]]; then
            # Validate discovery interface for active modules
            if declare -f "${module_name}_module_actions" >/dev/null && \
               declare -f "${module_name}_module_properties" >/dev/null; then
                echo "✅ Valid"
                ((valid_modules++))
            else
                echo "❌ Missing discovery interface"
                ((invalid_modules++))
            fi
        else
            echo "⏳ Status: $status"
            ((valid_modules++))
        fi
    done

    echo ""
    echo "Registry Summary:"
    echo "  Total modules: $total_modules"
    echo "  Valid modules: $valid_modules"
    echo "  Invalid modules: $invalid_modules"

    if [[ $invalid_modules -gt 0 ]]; then
        echo ""
        echo "⚠️  Registry has $invalid_modules invalid modules"
        return 1
    else
        echo ""
        echo "✅ Registry validation passed"
        return 0
    fi
}