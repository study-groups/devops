#!/usr/bin/env bash
# REPL Prompt Manager
# Dynamic prompt building via registered builders

# Register a prompt builder
repl_register_prompt_builder() {
    local name="$1"
    local function="$2"

    if ! command -v "$function" >/dev/null 2>&1; then
        echo "Warning: Prompt builder function not found: $function" >&2
        return 1
    fi

    REPL_PROMPT_BUILDERS+=("$function")
}

# Build prompt from all registered builders
# Sets global REPL_PROMPT variable (not via echo/command substitution)
repl_build_prompt() {
    local prompt=""

    for builder in "${REPL_PROMPT_BUILDERS[@]}"; do
        local fragment=$("$builder")
        prompt+="$fragment"
    done

    # Default if no builders registered
    if [[ -z "$prompt" ]]; then
        prompt="> "
    fi

    # Set global REPL_PROMPT (required by repl_main_loop)
    REPL_PROMPT="$prompt"
}

# Built-in prompt builders

# Basic prompt
repl_prompt_basic() {
    echo "> "
}

# Module context prompt (shows current module)
# Format: $ module>
repl_prompt_module() {
    local module=""

    # Get module from context
    if command -v repl_get_module_context >/dev/null 2>&1; then
        module=$(repl_get_module_context)
    fi

    if [[ -n "$module" ]]; then
        echo "$ ${module}> "
    else
        echo "$ > "
    fi
}

# Context-aware prompt (if context functions exist)
repl_prompt_context() {
    if command -v tetra_get_org >/dev/null 2>&1; then
        local org=$(tetra_get_org)
        local env=$(tetra_get_env)
        local mode=$(tetra_get_mode)
        echo "[${org} × ${env} × ${mode}] "
    fi
}

# Execution mode indicator (always "hybrid" now)
repl_prompt_mode() {
    echo "hybrid"
}

export -f repl_register_prompt_builder
export -f repl_build_prompt
export -f repl_prompt_basic
export -f repl_prompt_module
export -f repl_prompt_context
export -f repl_prompt_mode
