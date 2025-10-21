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

    echo "$prompt"
}

# Built-in prompt builders

# Basic prompt
repl_prompt_basic() {
    echo "> "
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

# Execution mode prompt (shows shell/repl mode)
repl_prompt_mode() {
    local mode=$(repl_get_execution_mode)
    case "$mode" in
        augment) echo "shell" ;;
        takeover) echo "repl" ;;
        *) echo "$mode" ;;
    esac
}

export -f repl_register_prompt_builder
export -f repl_build_prompt
export -f repl_prompt_basic
export -f repl_prompt_context
export -f repl_prompt_mode
