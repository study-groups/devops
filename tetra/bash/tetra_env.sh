#!/usr/bin/env bash

# This script is the single source of truth for setting up the Tetra shell environment.
# It is designed to be sourced, not executed, and is safe to be sourced multiple times.

# Prevent this script from being sourced more than once
if [ -n "${TETRA_ENV_LOADED:-}" ]; then
    return
fi

export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"

# Lazy loading registry
declare -A TETRA_MODULE_LOADERS
declare -A TETRA_MODULE_LOADED

# Function to register a module loader
tetra_register_module() {
    local module_name="$1"
    local loader_path="$2"
    TETRA_MODULE_LOADERS["$module_name"]="$loader_path"
    TETRA_MODULE_LOADED["$module_name"]=false
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
    
    # Check for includes.sh first, fallback to loading all .sh files
    if [[ -f "$loader_path/includes.sh" ]]; then
        source "$loader_path/includes.sh"
    elif [[ -d "$loader_path" ]]; then
        for f in "$loader_path"/*.sh; do
            if [[ -f "$f" && "$f" != *"/includes.sh" && \
                  "$f" != *"/tetra_env.sh" && \
                  "$f" != *"/bootstrap.sh" && \
                  "$f" != *"/deploy_repl.sh" && \
                  "$f" != *"/tkm_repl.sh" && \
                  "$f" != *"/tkm_ssh_inspector.sh" && \
                  "$f" != *"/tkm_core.sh" && \
                  "$f" != *"/tkm_security.sh" && \
                  "$f" != *"/init.sh" ]]; then
                source "$f"
            fi
        done
    else
        echo "Warning: Module path not found: $loader_path" >&2
        return 1
    fi
    
    TETRA_MODULE_LOADED["$module_name"]=true
}

# Create lazy loading stub functions
tetra_create_lazy_function() {
    local func_name="$1"
    local module_name="$2"
    
    eval "
    $func_name() {
        tetra_load_module '$module_name'
        unset -f $func_name  # Remove the stub
        if declare -f $func_name > /dev/null; then
            $func_name \"\$@\"  # Call the real function
        else
            echo 'Error: Function $func_name not found after loading module $module_name' >&2
            echo 'Available functions after loading:' >&2
            declare -F | grep -E '(tetra_|rag_|qa_)' >&2
            return 1
        fi
    }
    "
}

# Source module config system
source "$TETRA_SRC/bash/utils/module_config.sh"

# Register modules based on persistent configuration
while IFS= read -r module_name; do
    [[ -n "$module_name" ]] && tetra_register_module "$module_name" "$TETRA_SRC/bash/$module_name"
done < <(tetra_get_enabled_modules)

# Register external modules (lazy loaded)
tetra_register_module "rag" "$HOME/src/bash/rag/bash"
tetra_register_module "logtime" "$HOME/src/bash/logtime"

# Load lightweight modules immediately
if [[ -f "$HOME/src/bash/qa/includes.sh" ]]; then
    source "$HOME/src/bash/qa/includes.sh"
elif [[ -f "$HOME/src/bash/qa/qa.sh" ]]; then
    source "$HOME/src/bash/qa/qa.sh"
fi

# Load utils, tmod, prompt, python, nvm, and tsm immediately (lightweight and frequently used)
tetra_load_module "utils"
tetra_load_module "tmod"
tetra_load_module "prompt"
tetra_load_module "python"
tetra_load_module "nvm"
tetra_load_module "tsm"
tetra_load_module "tkm"

# Create lazy loading stubs for heavy modules only
tetra_create_lazy_function "rag_repl" "rag"
tetra_create_lazy_function "rag_load_tools" "rag"

# Python and NVM modules are loaded immediately, so create direct aliases
alias tpa='tetra_python_activate'
alias tna='tetra_nvm_activate'

# Always load base tetra functions immediately
for f in "$TETRA_SRC/bash"/*.sh; do
    if [[ -f "$f" && "$f" != *"/tetra_env.sh" && "$f" != *"/bootstrap.sh" ]]; then
        source "$f"
    fi
done

# --- Interactive-Only Setup ---
if [[ "$-" == *i* ]]; then
    PROMPT_COMMAND="tetra_prompt"
    ttr=${TETRA_REMOTE_USER:-}@${TETRA_REMOTE:-}:${TETRA_REMOTE_DIR:-}

    if [ -z "${TETRA_SILENT_STARTUP:-}" ]; then
        tetra_status
    fi
fi

# Tetra reload function - cleans state and reloads everything
tetra_reload() {
    echo "Reloading tetra environment..."
    
    # Clear all tetra state to force clean reload
    unset TETRA_MODULE_LOADERS
    unset TETRA_MODULE_LOADED
    unset TETRA_ENV_LOADED
    
    # Clear prompt state
    unset TETRA_PROMPT_STYLE
    unset TETRA_PROMPT_MULTILINE
    unset TETRA_PROMPT_GIT
    unset TETRA_PROMPT_PYTHON
    unset TETRA_PROMPT_NODE
    unset TETRA_PROMPT_LOGTIME
    
    # Remove lazy function stubs only
    local lazy_functions=("rag_repl" "rag_load_tools")
    for func in "${lazy_functions[@]}"; do
        if declare -f "$func" >/dev/null 2>&1; then
            if declare -f "$func" | grep -q "tetra_load_module"; then
                unset -f "$func" 2>/dev/null
            fi
        fi
    done
    
    # Reload the entire system - this will now work since TETRA_ENV_LOADED is unset
    source "$TETRA_DIR/tetra.sh"
    
    echo "Tetra environment reloaded successfully"
}

# Alias for quick reload
alias ttr='tetra_reload'

# Mark the environment as loaded
export TETRA_ENV_LOADED=1
