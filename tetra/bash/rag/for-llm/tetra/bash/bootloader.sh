#!/usr/bin/env bash

# Tetra Bootloader - Single entry point for Tetra environment
# Replaces bootstrap.sh and tetra_env.sh with cleaner architecture

# Prevent multiple loads in the same shell session
if [[ "${TETRA_BOOTLOADER_LOADED:-}" == "$$" ]]; then
    return 0
fi

# Core environment setup
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"

# Bootloader components directory
BOOT_DIR="$TETRA_SRC/bash/boot"

# Load bootloader components in order
source "$BOOT_DIR/boot_core.sh"      # Core functions and module system
source "$BOOT_DIR/boot_modules.sh"   # Module registration and lazy loading
source "$BOOT_DIR/boot_aliases.sh"   # Aliases and shortcuts
source "$BOOT_DIR/boot_prompt.sh"    # Prompt and interactive setup

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

    # Prevent auto-loading during reload by preserving TETRA_AUTO_LOADING state
    local was_auto_loading="${TETRA_AUTO_LOADING:-}"
    export TETRA_AUTO_LOADING=true

    # Reset bootloader flag
    TETRA_BOOTLOADER_LOADED=""

    # Reset module tracking arrays
    if declare -p TETRA_MODULE_LOADERS >/dev/null 2>&1; then
        declare -A TETRA_MODULE_LOADERS=()
    fi
    if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
        declare -A TETRA_MODULE_LOADED=()
    fi
    
    # Remove lazy function stubs (but keep real functions)
    local lazy_functions=("rag_repl" "rag_load_tools" "tmod" "tsm" "tkm" "tetra_python_activate" "tetra_nvm_activate" "tetra_ssh" "tetra_sync" "tetra_deploy" "tetra_git" "tetra_nginx" "pm" "tetra_service" "tetra_tmux" "tetra_user" "hotrod" "tetra_ml" "pb" "pbvm" "pico" "tetra_svg" "tro" "anthropic" "tetra_status")
    for func in "${lazy_functions[@]}"; do
        if declare -f "$func" >/dev/null 2>&1; then
            if declare -f "$func" | grep -q "tetra_load_module"; then
                unset -f "$func" 2>/dev/null
            fi
        fi
    done
    
    # Reload bootloader
    source "$TETRA_SRC/bash/bootloader.sh"
    
    # Restore preserved variables
    for var_def in "${backup_vars[@]}"; do
        export "$var_def"
    done

    # Restore loaded modules state AFTER bootloader reload
    if [[ ${#loaded_modules_backup[@]} -gt 0 ]]; then
        for module in "${loaded_modules_backup[@]}"; do
            if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
                TETRA_MODULE_LOADED["$module"]="true"
            fi
        done
    fi

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
