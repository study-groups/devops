#!/usr/bin/env bash

# Tetra Bootloader - Single entry point for Tetra environment
# Replaces bootstrap.sh and tetra_env.sh with cleaner architecture

# Error tracking
export TETRA_BOOT_ERRORS=()

# Prevent multiple loads in the same shell session
if [[ "${TETRA_BOOTLOADER_LOADED:-}" == "$$" ]]; then
    return 0
fi

# Core environment setup
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"

# Bootloader components directory
BOOT_DIR="$TETRA_SRC/bash/boot"

# Error handler for component loading
_tetra_load_component() {
    local component_path="$1"
    local component_name=$(basename "$component_path")

    if [[ ! -f "$component_path" ]]; then
        TETRA_BOOT_ERRORS+=("MISSING: $component_name")
        echo "ERROR: Missing bootloader component: $component_name" >&2
        return 1
    fi

    if ! source "$component_path" 2>&1; then
        TETRA_BOOT_ERRORS+=("FAILED: $component_name - $?")
        echo "ERROR: Failed to load: $component_name" >&2
        return 1
    fi

    return 0
}

# Load bootloader components in order with error tracking
_tetra_load_component "$BOOT_DIR/boot_core.sh" || true      # Core functions and module system
_tetra_load_component "$BOOT_DIR/boot_modules.sh" || true   # Module registration and lazy loading
_tetra_load_component "$BOOT_DIR/boot_aliases.sh" || true   # Aliases and shortcuts
_tetra_load_component "$BOOT_DIR/boot_prompt.sh" || true    # Prompt and interactive setup

# Report boot errors if any
if [[ ${#TETRA_BOOT_ERRORS[@]} -gt 0 ]]; then
    echo "TETRA BOOT ERRORS DETECTED:" >&2
    for error in "${TETRA_BOOT_ERRORS[@]}"; do
        echo "  - $error" >&2
    done
fi

# Auto-load enabled modules after all components are ready (prevent recursion)
if [[ "${TETRA_AUTO_LOADING:-}" != "true" && "${TETRA_BOOTLOADER_LOADED:-}" != "$$" ]]; then
    export TETRA_AUTO_LOADING=true
    enabled_modules=$(tetra_get_enabled_modules 2>/dev/null || true)
    if [[ -n "$enabled_modules" ]]; then
        loaded_modules=()
        failed_modules=()

        # Read modules into array properly from newline-separated output
        module_array=()
        while IFS= read -r module; do
            [[ -n "$module" ]] && module_array+=("$module")
        done <<< "$enabled_modules"

        for module in "${module_array[@]}"; do
            current_module="$module"
            if tetra_smart_load_module "$current_module" >/dev/null 2>&1; then
                loaded_modules+=("$current_module")
            else
                failed_modules+=("$current_module")
            fi
        done

        if [[ ${#loaded_modules[@]} -gt 0 ]]; then
            echo "Loaded: $(IFS=','; echo "${loaded_modules[*]}")"
        fi
        if [[ ${#failed_modules[@]} -gt 0 ]]; then
            echo "Failed: $(IFS=','; echo "${failed_modules[*]}")"
        fi
    fi
    export TETRA_AUTO_LOADING=false
fi

# Mark bootloader as loaded for this shell session
export TETRA_BOOTLOADER_LOADED=$$

# Tetra reload function
tetra_reload() {
    echo "Reloading tetra environment..."
    
    # Preserve critical environment variables
    local preserved_vars=(
        "TETRA_DIR" "TETRA_SRC" "HOME" "USER" "PATH"
        "SHELL" "TERM" "DISPLAY" "SSH_AUTH_SOCK"
    )
    local preserved_tetra_vars=(
        "TETRA_PROMPT_STYLE" "TETRA_PROMPT_MULTILINE" "TETRA_PROMPT_GIT"
        "TETRA_PROMPT_PYTHON" "TETRA_PROMPT_NODE" "TETRA_PROMPT_LOGTIME"
    )
    
    # Backup preserved variables
    local backup_vars=()
    for var in "${preserved_vars[@]}"; do
        backup_vars+=("$var=${!var}")
    done
    
    # Backup Tetra-specific variables
    for var in "${preserved_tetra_vars[@]}"; do
        backup_vars+=("$var=${!var}")
    done

    # Backup currently loaded modules state
    local loaded_modules_backup=()
    if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
        for module in "${!TETRA_MODULE_LOADED[@]}"; do
            if [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
                loaded_modules_backup+=("$module")
            fi
        done
    fi

    # Debug: show what modules were backed up
    echo "DEBUG: Backed up ${#loaded_modules_backup[@]} modules: ${loaded_modules_backup[*]}" >&2

    # Prevent auto-loading during reload by preserving TETRA_AUTO_LOADING state
    local was_auto_loading="${TETRA_AUTO_LOADING:-}"
    export TETRA_AUTO_LOADING=true

    # Reset bootloader flag
    TETRA_BOOTLOADER_LOADED=""

    # Properly reset module tracking arrays (global scope)
    # First unset existing arrays completely
    if declare -p TETRA_MODULE_LOADERS >/dev/null 2>&1; then
        unset TETRA_MODULE_LOADERS
    fi
    if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
        unset TETRA_MODULE_LOADED
    fi

    # Recreate as global associative arrays
    declare -gA TETRA_MODULE_LOADERS
    declare -gA TETRA_MODULE_LOADED
    
    # Remove ALL module-related functions (both lazy stubs and actual loaded functions)
    local all_functions=($(declare -F | cut -d' ' -f3))
    local functions_to_remove=()

    for func in "${all_functions[@]}"; do
        # Skip absolutely essential functions that should never be removed
        if [[ "$func" =~ ^(tetra_reload|ttr|declare|set|unset|export|source|cd|pwd|ls|echo|printf|read|test|\[|\[\[)$ ]]; then
            continue
        fi

        # Remove functions that:
        # 1. Are lazy loading stubs (contain tetra_load_module)
        # 2. Are from specific module patterns (tmod_, rag_, tetra_cc_, _tetra_, etc.)
        # 3. Are known module functions
        if declare -f "$func" >/dev/null 2>&1; then
            local should_remove=false

            # Check for lazy loading pattern
            if declare -f "$func" | grep -q "tetra_load_module\|tetra_smart_load_module"; then
                should_remove=true
            fi

            # Check for module function patterns
            if [[ "$func" =~ ^(tmod_|rag_|tetra_cc_|tetra_rag_|_tetra_|_rag_|_tmod_|_repl_|tsm|tkm|claude|anthropic).*$ ]]; then
                should_remove=true
            fi

            # Check for specific known module functions
            if [[ "$func" =~ ^(mc|ms|mi|mf|qpatch|replace|pb|pbvm|pico|hotrod|tro)$ ]]; then
                should_remove=true
            fi

            # Also remove any function that was defined in module directories
            # by checking if it's a function likely to be from modules
            if [[ "$func" =~ ^tetra_.*_(activate|where|status|repl|help|load|init|setup)$ ]]; then
                should_remove=true
            fi

            if [[ "$should_remove" == "true" ]]; then
                functions_to_remove+=("$func")
            fi
        fi
    done

    # Remove detected module functions
    for func in "${functions_to_remove[@]}"; do
        unset -f "$func" 2>/dev/null
    done
    
    # Reload bootloader
    source "$TETRA_SRC/bash/bootloader.sh"

    # Restore preserved variables
    for var_def in "${backup_vars[@]}"; do
        export "$var_def"
    done

    # Restore loaded modules state AFTER bootloader reload
    # Ensure arrays exist before attempting restoration
    if [[ ${#loaded_modules_backup[@]} -gt 0 ]]; then
        # Verify arrays were properly recreated
        if ! declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
            declare -gA TETRA_MODULE_LOADED
        fi
        if ! declare -p TETRA_MODULE_LOADERS >/dev/null 2>&1; then
            declare -gA TETRA_MODULE_LOADERS
        fi

        # Force reload of backed up modules (don't just mark as loaded)
        for module in "${loaded_modules_backup[@]}"; do
            # First mark as unloaded to force fresh loading
            TETRA_MODULE_LOADED["$module"]="false"

            # Then force load the module to get fresh functions
            if [[ -n "${TETRA_MODULE_LOADERS[$module]:-}" ]]; then
                echo "Reloading module: $module" >&2
                tetra_load_module "$module" 2>/dev/null || echo "Failed to reload: $module" >&2
            fi
        done
    fi

    # Clean up environment variable pollution
    # Remove metadata field names and other artifacts that shouldn't be in environment
    local metadata_vars=("category" "commands" "completions" "description" "status")
    for var in "${metadata_vars[@]}"; do
        unset "$var" 2>/dev/null || true
    done

    # Clean up any orphaned TETRA_* variables that aren't in our preserve list
    while IFS= read -r var_line; do
        if [[ "$var_line" =~ ^declare[[:space:]]+.*[[:space:]]([A-Z_]+)= ]]; then
            local var_name="${BASH_REMATCH[1]}"
            # Only clean up TETRA_* vars not in our preserve list
            if [[ "$var_name" =~ ^TETRA_ ]] && ! [[ "$var_name" =~ ^(TETRA_DIR|TETRA_SRC|TETRA_AUTO_LOADING|TETRA_BOOTLOADER_LOADED|TETRA_MODULE_LOADERS|TETRA_MODULE_LOADED|TETRA_PROMPT_|TETRA_DEBUG_).*$ ]]; then
                unset "$var_name" 2>/dev/null || true
            fi
        fi
    done < <(declare -p 2>/dev/null | grep "^declare.*=" || true)

    # Restore original auto-loading state
    if [[ -z "$was_auto_loading" ]]; then
        unset TETRA_AUTO_LOADING
    else
        export TETRA_AUTO_LOADING="$was_auto_loading"
    fi

    echo "Tetra environment reloaded successfully"
}

# Quick reload alias
alias ttr='tetra_reload'
