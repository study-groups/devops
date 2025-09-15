#!/usr/bin/env bash

# TKM Tab Completion
# Provides intelligent tab completion for TKM REPL commands

# Main completion function for TKM REPL
tkm_repl_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local line="${COMP_LINE}"
    
    # Define command lists
    local main_commands="generate deploy rotate revoke status display envs addenv rmenv audit policy logs inspect scan cleanup info history org help exit quit"
    local help_commands="generate deploy rotate revoke status envs audit inspect scan cleanup all"
    local inspect_scopes="keys config agents hosts permissions all"
    local cleanup_actions="execute"
    local rotate_options="true false immediate"
    local revoke_patterns="old all"
    
    # Get list of configured environments
    local environments=""
    if [[ -f "$TKM_CONFIG_DIR/environments.conf" ]]; then
        environments=$(grep -v '^#' "$TKM_CONFIG_DIR/environments.conf" 2>/dev/null | cut -d: -f1 | tr '\n' ' ')
    fi
    environments="$environments all"
    
    # Parse the current command context
    local cmd_parts=($line)
    local cmd="${cmd_parts[1]:-}"  # Skip "tkm>" prompt
    
    case "$cmd" in
        help)
            COMPREPLY=($(compgen -W "$help_commands" -- "$cur"))
            ;;
        generate)
            case "$prev" in
                generate)
                    COMPREPLY=($(compgen -W "$environments" -- "$cur"))
                    ;;
                *)
                    # After environment, suggest key types and expiry days
                    if [[ "$cur" =~ ^[0-9] ]]; then
                        COMPREPLY=($(compgen -W "7 14 30 60 90" -- "$cur"))
                    else
                        COMPREPLY=($(compgen -W "deploy admin" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        deploy)
            case "$prev" in
                deploy)
                    COMPREPLY=($(compgen -W "$environments" -- "$cur"))
                    ;;
                *)
                    COMPREPLY=($(compgen -W "true false force" -- "$cur"))
                    ;;
            esac
            ;;
        rotate)
            case "$prev" in
                rotate)
                    # Remove 'all' from environments for rotate (requires specific env)
                    local rotate_envs=$(echo "$environments" | sed 's/all//')
                    COMPREPLY=($(compgen -W "$rotate_envs" -- "$cur"))
                    ;;
                *)
                    COMPREPLY=($(compgen -W "$rotate_options" -- "$cur"))
                    ;;
            esac
            ;;
        revoke)
            case "$prev" in
                revoke)
                    local revoke_envs=$(echo "$environments" | sed 's/all//')
                    COMPREPLY=($(compgen -W "$revoke_envs" -- "$cur"))
                    ;;
                *)
                    COMPREPLY=($(compgen -W "$revoke_patterns" -- "$cur"))
                    ;;
            esac
            ;;
        status|audit|logs)
            COMPREPLY=($(compgen -W "$environments" -- "$cur"))
            ;;
        inspect)
            case "$prev" in
                inspect)
                    COMPREPLY=($(compgen -W "$inspect_scopes" -- "$cur"))
                    ;;
            esac
            ;;
        cleanup)
            case "$prev" in
                cleanup)
                    COMPREPLY=($(compgen -W "$cleanup_actions" -- "$cur"))
                    ;;
            esac
            ;;
        addenv)
            case "$prev" in
                addenv)
                    # Suggest common environment names
                    COMPREPLY=($(compgen -W "dev staging production test" -- "$cur"))
                    ;;
                *)
                    # After name, suggest hostnames or users
                    if [[ "${cmd_parts[3]:-}" != "" ]]; then
                        # Third arg - suggest usernames
                        COMPREPLY=($(compgen -W "tetra deploy admin" -- "$cur"))
                    else
                        # Second arg - suggest hostname patterns
                        COMPREPLY=($(compgen -W "dev.example.com staging.example.com prod.example.com" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        rmenv)
            # Suggest existing environments for removal
            COMPREPLY=($(compgen -W "$environments" -- "$cur"))
            ;;
        history)
            # Suggest common line counts
            COMPREPLY=($(compgen -W "10 20 50 100" -- "$cur"))
            ;;
        org)
            # Organization commands
            case "$prev" in
                org)
                    COMPREPLY=($(compgen -W "add remove list current set" -- "$cur"))
                    ;;
                add)
                    # After 'org add', suggest NH name format
                    COMPREPLY=($(compgen -W "myorg dev-org prod-org" -- "$cur"))
                    ;;
                remove|set)
                    # Suggest existing organizations
                    local orgs=""
                    if [[ -f "$TKM_BASE_DIR/organizations.conf" ]]; then
                        orgs=$(grep -v '^#' "$TKM_BASE_DIR/organizations.conf" 2>/dev/null | cut -d: -f1 | tr '\n' ' ')
                    fi
                    COMPREPLY=($(compgen -W "$orgs" -- "$cur"))
                    ;;
            esac
            ;;
        logs)
            case "$prev" in
                logs)
                    COMPREPLY=($(compgen -W "$environments" -- "$cur"))
                    ;;
                *)
                    COMPREPLY=($(compgen -W "10 20 50 100" -- "$cur"))
                    ;;
            esac
            ;;
        "")
            # No command yet - suggest all main commands
            COMPREPLY=($(compgen -W "$main_commands" -- "$cur"))
            ;;
        *)
            # Unknown command or empty input - suggest main commands
            if [[ -z "$cur" && ${#cmd_parts[@]} -eq 1 ]]; then
                # Blank line with just prompt - show all commands
                COMPREPLY=($main_commands)
            else
                COMPREPLY=($(compgen -W "$main_commands" -- "$cur"))
            fi
            ;;
    esac
}

# Completion function for bash commands (starting with !)
tkm_bash_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    
    # Remove the ! prefix for completion
    local bash_cur="${cur#!}"
    
    # Use default bash completion for commands
    local bash_commands="ls cd pwd cat grep find ps top htop df du free uptime whoami id groups"
    COMPREPLY=($(compgen -c -W "$bash_commands" -- "$bash_cur"))
    
    # Add ! prefix back to completions
    local i
    for ((i=0; i<${#COMPREPLY[@]}; i++)); do
        COMPREPLY[i]="!${COMPREPLY[i]}"
    done
}

# File path completion for ./ and / prefixes
tkm_file_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    
    # Use bash's built-in file completion
    COMPREPLY=($(compgen -f -- "$cur"))
    
    # Add trailing slash for directories
    local i
    for ((i=0; i<${#COMPREPLY[@]}; i++)); do
        if [[ -d "${COMPREPLY[i]}" ]]; then
            COMPREPLY[i]="${COMPREPLY[i]}/"
        fi
    done
}

# Environment status completion (@ prefix)
tkm_env_status_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local env_cur="${cur#@}"  # Remove @ prefix
    
    # Environment status commands
    local status_commands="overview keys connections health logs activity deploy-status all"
    
    # Get configured environments
    local environments=""
    if [[ -f "$TKM_CONFIG_DIR/environments.conf" ]]; then
        environments=$(grep -v '^#' "$TKM_CONFIG_DIR/environments.conf" 2>/dev/null | cut -d: -f1 | tr '\n' ' ')
    fi
    
    # If no environment specified yet, suggest environments
    if [[ "$env_cur" == "" ]]; then
        COMPREPLY=($(compgen -W "$environments" -- "$env_cur"))
    else
        # Check if we have an environment followed by a dot
        if [[ "$env_cur" =~ ^([^.]+)\.(.*)$ ]]; then
            local env="${BASH_REMATCH[1]}"
            local subcmd="${BASH_REMATCH[2]}"
            COMPREPLY=($(compgen -W "$status_commands" -- "$subcmd"))
        else
            # Suggest environment.command format
            local env_suggestions=""
            for env in $environments; do
                if [[ "$env" =~ ^$env_cur ]]; then
                    env_suggestions="$env_suggestions $env."
                fi
            done
            COMPREPLY=($(compgen -W "$env_suggestions" -- "$env_cur"))
        fi
    fi
    
    # Add @ prefix back to completions
    local i
    for ((i=0; i<${#COMPREPLY[@]}; i++)); do
        COMPREPLY[i]="@${COMPREPLY[i]}"
    done
}

# Enhanced completion that handles different input types
tkm_smart_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local line="${COMP_LINE}"
    
    # Special case: completely blank line (just prompt)
    if [[ -z "$cur" && "$line" =~ ^[[:space:]]*$ ]]; then
        local main_commands="generate deploy rotate revoke status display envs addenv rmenv audit policy logs inspect scan cleanup info history org help exit quit"
        COMPREPLY=($main_commands)
        return
    fi
    
    # Handle file paths (starting with ./ or /) - ONLY these prefixes
    if [[ "$cur" =~ ^\./ ]] || [[ "$cur" =~ ^/ ]]; then
        tkm_file_completion
        return
    fi
    
    # Handle environment status commands (starting with @)
    if [[ "$cur" =~ ^@ ]]; then
        tkm_env_status_completion
        return
    fi
    
    # Handle bash commands (starting with !)
    if [[ "$cur" =~ ^! ]]; then
        tkm_bash_completion
        return
    fi
    
    # Handle regular TKM commands - NO file completion by default
    tkm_repl_completion
}

# Function to enable completion in TKM REPL
tkm_enable_completion() {
    # Enable programmable completion
    set +o posix 2>/dev/null || true
    
    # Set up completion for the TKM REPL with our smart completion
    complete -F tkm_smart_completion tkm_repl_process_command 2>/dev/null || true
    
    # Also set up completion for direct tkm command usage
    complete -F tkm_repl_completion tkm 2>/dev/null || true
    
    # Bind tab completion to work in readline
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true
}

# Custom completion handler for REPL readline
_tkm_repl_complete() {
    local cur="${READLINE_LINE}"
    local main_commands="generate deploy rotate revoke status display envs addenv rmenv audit policy logs inspect scan cleanup info history org help exit quit"
    
    # Get current prompt (fallback if function not available)
    local prompt="tkm> "
    if declare -f _tkm_get_prompt >/dev/null 2>&1; then
        prompt="$(_tkm_get_prompt)"
    fi
    
    # If line is empty or just whitespace, show all commands
    if [[ -z "$cur" || "$cur" =~ ^[[:space:]]*$ ]]; then
        echo
        echo "Available commands:"
        printf "  %-12s %-12s %-12s %-12s\n" $main_commands
        echo
        echo -n "$prompt"
        return
    fi
    
    # For partial commands, use normal completion
    local matches=($(compgen -W "$main_commands" -- "$cur"))
    if [[ ${#matches[@]} -eq 1 ]]; then
        # Single match - complete it
        READLINE_LINE="${matches[0]} "
        READLINE_POINT=${#READLINE_LINE}
    elif [[ ${#matches[@]} -gt 1 ]]; then
        # Multiple matches - show them
        echo
        printf "  %s\n" "${matches[@]}"
        echo
        echo -n "$prompt$cur"
    fi
}

# Set up REPL-specific completion
_tkm_setup_repl_completion() {
    # Bind Tab to our custom completion function
    bind -x '"\t": _tkm_repl_complete' 2>/dev/null || true
    
    # Set readline options for better completion experience
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true
}

# Auto-enable completion when this module is loaded
tkm_enable_completion
