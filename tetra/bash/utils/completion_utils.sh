#!/usr/bin/env bash

# Shared Completion Utilities
# Provides consistent tab completion patterns for all Tetra modules

# Common completion for module names
_comp_tetra_modules() {
    local cur="$1"
    local modules="tsm tkm tmod deploy qa rag"
    echo "$modules"
}

# Common completion for environments
_comp_tetra_environments() {
    local cur="$1"
    local environments="local dev staging prod"

    # Try to get from TKM if available
    if [[ -f "$TETRA_DIR/tkm/config/environments.conf" ]]; then
        local tkm_envs=$(grep -v '^#' "$TETRA_DIR/tkm/config/environments.conf" 2>/dev/null | cut -d: -f1 | tr '\n' ' ')
        environments="$environments $tkm_envs"
    fi

    echo "$environments"
}

# Common completion for help commands
_comp_help_commands() {
    local cur="$1"
    echo "help commands functions status config logs history all"
}

# Generic command completion engine
_comp_commands() {
    local cur="$1"
    local commands="$2"

    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}

# File path completion with filters
_comp_files() {
    local cur="$1"
    local extensions="$2"  # e.g., "sh js py"

    if [[ -n "$extensions" ]]; then
        local pattern=""
        for ext in $extensions; do
            pattern="$pattern *.${ext}"
        done
        COMPREPLY=($(compgen -f -X "!${pattern}" -- "$cur"))
    else
        COMPREPLY=($(compgen -f -- "$cur"))
    fi
}

# Service name completion for TSM
_comp_tsm_services() {
    local cur="$1"
    local services=""

    # Get services from TSM if available
    if command -v tsm_list_service_names >/dev/null 2>&1; then
        services=$(tsm_list_service_names 2>/dev/null | tr '\n' ' ')
    fi

    # Add common service patterns
    services="$services tetra devpages webserver nginx"

    echo "$services"
}

# Key types for TKM
_comp_tkm_key_types() {
    local cur="$1"
    echo "deploy admin user"
}

# Log levels
_comp_log_levels() {
    local cur="$1"
    echo "debug info warn error"
}

# Standard bash commands for ! prefix
_comp_bash_commands() {
    local cur="$1"
    echo "ls cd pwd cat grep find ps top htop df du free uptime whoami"
}

# Process IDs for operations
_comp_process_ids() {
    local cur="$1"
    local pids=""

    # Get PIDs from ps if available
    if command -v ps >/dev/null 2>&1; then
        pids=$(ps -o pid= | tr '\n' ' ')
    fi

    echo "$pids"
}

# Port numbers (common ports)
_comp_ports() {
    local cur="$1"
    echo "3000 3001 4000 4444 5000 8000 8080 8888 9000"
}

# Branch names (git)
_comp_git_branches() {
    local cur="$1"
    local branches=""

    if git rev-parse --git-dir >/dev/null 2>&1; then
        branches=$(git branch -a 2>/dev/null | sed 's/^[* ]*//' | tr '\n' ' ')
    fi

    echo "$branches"
}

# Enhanced completion dispatcher
_comp_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"
    local module="$4"

    # Handle bash commands (starting with !)
    if [[ "$cur" =~ ^! ]]; then
        local bash_cur="${cur#!}"
        local bash_commands=$(_comp_bash_commands "$bash_cur")
        COMPREPLY=($(compgen -W "$bash_commands" -- "$bash_cur"))
        # Add ! prefix back
        local i
        for ((i=0; i<${#COMPREPLY[@]}; i++)); do
            COMPREPLY[i]="!${COMPREPLY[i]}"
        done
        return
    fi

    # Handle file paths
    if [[ "$cur" =~ ^\./|^/ ]]; then
        _comp_files "$cur"
        return
    fi

    # Module-specific completion
    case "$module" in
        tsm)
            _comp_tsm_dispatch "$cur" "$prev" "$cmd"
            ;;
        tkm)
            _comp_tkm_dispatch "$cur" "$prev" "$cmd"
            ;;
        tmod)
            _comp_tmod_dispatch "$cur" "$prev" "$cmd"
            ;;
        deploy)
            _comp_deploy_dispatch "$cur" "$prev" "$cmd"
            ;;
        qa)
            _comp_qa_dispatch "$cur" "$prev" "$cmd"
            ;;
        *)
            # Generic completion
            _comp_generic_dispatch "$cur" "$prev" "$cmd"
            ;;
    esac
}

# TSM-specific completion
_comp_tsm_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"

    case "$cmd" in
        start)
            case "$prev" in
                start)
                    _comp_files "$cur" "sh js py"
                    ;;
                *)
                    local services=$(_comp_tsm_services "$cur")
                    _comp_commands "$cur" "$services"
                    ;;
            esac
            ;;
        stop|restart|logs)
            local services=$(_comp_tsm_services "$cur")
            _comp_commands "$cur" "$services all"
            ;;
        *)
            _comp_commands "$cur" "start stop restart list ls logs ports setup help exit quit"
            ;;
    esac
}

# TKM-specific completion
_comp_tkm_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"

    case "$cmd" in
        generate|rotate|revoke)
            case "$prev" in
                generate|rotate|revoke)
                    local environments=$(_comp_tetra_environments "$cur")
                    _comp_commands "$cur" "$environments"
                    ;;
                *)
                    if [[ "$cur" =~ ^[0-9] ]]; then
                        _comp_commands "$cur" "7 14 30 60 90"
                    else
                        local key_types=$(_comp_tkm_key_types "$cur")
                        _comp_commands "$cur" "$key_types"
                    fi
                    ;;
            esac
            ;;
        deploy|status|audit|logs)
            local environments=$(_comp_tetra_environments "$cur")
            _comp_commands "$cur" "$environments"
            ;;
        *)
            _comp_commands "$cur" "generate deploy rotate revoke status envs audit logs help exit quit"
            ;;
    esac
}

# TMOD-specific completion
_comp_tmod_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"

    case "$cmd" in
        load|enable|disable)
            local modules=$(_comp_tetra_modules "$cur")
            _comp_commands "$cur" "$modules"
            ;;
        *)
            _comp_commands "$cur" "list ls load enable disable status help exit quit"
            ;;
    esac
}

# Deploy-specific completion
_comp_deploy_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"

    case "$cmd" in
        deploy)
            local environments=$(_comp_tetra_environments "$cur")
            _comp_commands "$cur" "$environments"
            ;;
        view)
            # Complete with run IDs if available
            if [[ -d "$TETRA_DIR/deploy/runs" ]]; then
                local runs=$(ls "$TETRA_DIR/deploy/runs" 2>/dev/null | tr '\n' ' ')
                _comp_commands "$cur" "$runs"
            fi
            ;;
        *)
            _comp_commands "$cur" "deploy status config runs view env vars tutorial help exit quit"
            ;;
    esac
}

# QA-specific completion
_comp_qa_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"

    case "$cmd" in
        set-engine)
            _comp_commands "$cur" "openai anthropic local"
            ;;
        set-context)
            _comp_commands "$cur" "tetra project general"
            ;;
        *)
            _comp_commands "$cur" "query search browse set-engine set-context help status exit quit"
            ;;
    esac
}

# Generic completion fallback
_comp_generic_dispatch() {
    local cur="$1"
    local prev="$2"
    local cmd="$3"

    _comp_commands "$cur" "help status config logs history exit quit"
}

# Setup completion for a module
_comp_setup_module() {
    local module="$1"
    local completion_func="_comp_${module}_completion"

    # Create module-specific completion function with proper quoting
    eval "function ${completion_func}() {
        local cur=\"\${COMP_WORDS[COMP_CWORD]}\"
        local prev=\"\${COMP_WORDS[COMP_CWORD-1]}\"
        local cmd=\"\${COMP_WORDS[1]:-}\"

        _comp_dispatch \"\$cur\" \"\$prev\" \"\$cmd\" \"${module}\"
    }"

    # Register completion
    complete -F "$completion_func" "${module}_repl" 2>/dev/null || true
    complete -F "$completion_func" "$module" 2>/dev/null || true
}

# Auto-setup completion for all modules
_comp_auto_setup() {
    local modules="tsm tkm tmod deploy qa"

    for module in $modules; do
        # Debug: ensure module is a single word
        if [[ "$module" =~ ^[a-zA-Z0-9_]+$ ]]; then
            _comp_setup_module "$module"
        fi
    done

    # Enable general completion settings
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true
}

# Manual setup function for troubleshooting
_comp_setup_safe() {
    # Only set up basic completion settings, skip function creation
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true
}

# Call safe setup by default to avoid errors
_comp_setup_safe

true