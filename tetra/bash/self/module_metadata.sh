#!/usr/bin/env bash

# Tetra Module Metadata System - Custom Data Structure
# Replaces problematic bash associative arrays with a more robust approach

# Module metadata storage using delimited strings
TETRA_MODULE_METADATA=""

# Add module metadata entry
tetra_add_module_metadata() {
    local module="$1"
    local description="$2"
    local commands="$3"
    local completions="$4"
    local category="${5:-core}"
    local module_status="${6:-stable}"
    
    # Validate inputs
    if [[ -z "$module" || -z "$description" ]]; then
        echo "Error: Module name and description are required" >&2
        return 1
    fi
    
    # Remove existing entry for this module if it exists (before escaping)
    tetra_remove_module_metadata "$module"
    
    # Escape delimiter characters in input
    module="${module//|/__PIPE__}"
    description="${description//|/__PIPE__}"
    commands="${commands//|/__PIPE__}"
    completions="${completions//|/__PIPE__}"
    category="${category//|/__PIPE__}"
    module_status="${module_status//|/__PIPE__}"
    
    # Format: module|description|commands|completions|category|status
    local entry="${module}|${description}|${commands}|${completions}|${category}|${module_status}"
    
    # Add new entry
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
        TETRA_MODULE_METADATA="$entry"
    else
        TETRA_MODULE_METADATA="${TETRA_MODULE_METADATA}"$'\n'"${entry}"
    fi
}

# Remove module metadata entry
tetra_remove_module_metadata() {
    local module="$1"
    local escaped_module="${module//|/__PIPE__}"
    
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
        return 0
    fi
    
    # Use while read to avoid IFS manipulation entirely
    local new_metadata=""
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        local entry_module="${entry%%|*}"
        if [[ "$entry_module" != "$escaped_module" ]]; then
            if [[ -z "$new_metadata" ]]; then
                new_metadata="$entry"
            else
                new_metadata="${new_metadata}"$'\n'"${entry}"
            fi
        fi
    done <<< "$TETRA_MODULE_METADATA"
    TETRA_MODULE_METADATA="$new_metadata"
}

# Get module metadata field
tetra_get_module_metadata() {
    local module="$1"
    local field="$2"
    local escaped_module="${module//|/__PIPE__}"
    
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
        return 1
    fi

    # Use while read to avoid IFS manipulation entirely
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        local entry_module="${entry%%|*}"
        if [[ "$entry_module" == "$escaped_module" ]]; then
            # Parse fields using read with IFS scoped to just the read command
            local p_mod p_desc p_cmds p_comp p_cat p_stat
            IFS='|' read -r p_mod p_desc p_cmds p_comp p_cat p_stat <<< "$entry"

            case "$field" in
                "description") echo "${p_desc//__PIPE__/|}" ;;
                "commands") echo "${p_cmds//__PIPE__/|}" ;;
                "completions") echo "${p_comp//__PIPE__/|}" ;;
                "category") echo "${p_cat//__PIPE__/|}" ;;
                "status") echo "${p_stat//__PIPE__/|}" ;;
                *) echo "Unknown field: $field" >&2; return 1 ;;
            esac
            return 0
        fi
    done <<< "$TETRA_MODULE_METADATA"
    return 1
}

# List all modules
tetra_list_all_modules_metadata() {
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
        return 0
    fi

    # Use while read to avoid IFS manipulation entirely
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        local module="${entry%%|*}"
        echo "${module//__PIPE__/|}"
    done <<< "$TETRA_MODULE_METADATA"
}

# Get module info (formatted output)
tetra_get_module_info() {
    local module="$1"
    
    if [[ -z "$module" ]]; then
        echo "Usage: tetra_get_module_info <module_name>"
        return 1
    fi
    
    local description commands completions category module_status
    
    description=$(tetra_get_module_metadata "$module" "description")
    commands=$(tetra_get_module_metadata "$module" "commands")
    completions=$(tetra_get_module_metadata "$module" "completions")
    category=$(tetra_get_module_metadata "$module" "category")
    module_status=$(tetra_get_module_metadata "$module" "status")
    
    if [[ -z "$description" ]]; then
        echo "Module '$module' not found in metadata"
        return 1
    fi
    
    echo "Module: $module"
    echo "Description: $description"
    echo "Category: $category"
    echo "Status: $module_status"
    [[ -n "$commands" ]] && echo "Commands: $commands"
    [[ -n "$completions" ]] && echo "Completions: $completions"
}

# Initialize module metadata with all known modules
tetra_init_module_metadata() {
    # Clear existing metadata
    TETRA_MODULE_METADATA=""
    
    # Core modules
    tetra_add_module_metadata "utils" \
        "Core utilities and helper functions" \
        "tetra_dns_whatsmyip tetra_linux_clean_path tetra_ufw_allow" \
        "" \
        "core" "stable"
    
    tetra_add_module_metadata "tps" \
        "Tetra Prompt System" \
        "tps tps_prompt" \
        "tps:style|toggle|multiline|color|status|help" \
        "core" "stable"
    
    tetra_add_module_metadata "python" \
        "Python environment management via pyenv" \
        "tetra_python_activate tpa tetra_python_install tetra_python_list" \
        "tetra_python_install:3.8|3.9|3.10|3.11|3.12" \
        "core" "stable"
    
    tetra_add_module_metadata "nvm" \
        "Node.js version management via nvm" \
        "tetra_nvm_activate tna" \
        "tetra_nvm_activate:node|lts|latest" \
        "core" "stable"
    
    tetra_add_module_metadata "tsm" \
        "Tetra Service Manager - native process management" \
        "tsm" \
        "tsm:start|stop|restart|list|logs|info|delete|scan-ports" \
        "core" "stable"
    
    tetra_add_module_metadata "tkm" \
        "Tetra Key Manager - SSH key and deployment management" \
        "tkm" \
        "tkm:init|add|list|deploy|status|org" \
        "deployment" "stable"
    
    tetra_add_module_metadata "pb" \
        "Process management with PM2 integration" \
        "pb" \
        "pb:start|stop|restart|list|logs|delete" \
        "deployment" "stable"
    
    tetra_add_module_metadata "sync" \
        "File synchronization and remote operations" \
        "tetra_sync tetra_remote_ls" \
        "" \
        "deployment" "stable"
    
    tetra_add_module_metadata "ssh" \
        "SSH utilities and connection management" \
        "tetra_ssh_hosts" \
        "" \
        "deployment" "stable"
    
    tetra_add_module_metadata "enc" \
        "Encryption and certificate management" \
        "tetra_enc tetra_cert" \
        "" \
        "security" "stable"
    
    tetra_add_module_metadata "deploy" \
        "Deployment automation and management" \
        "tetra_deploy" \
        "" \
        "deployment" "stable"
    
    tetra_add_module_metadata "git" \
        "Git utilities and workflow helpers" \
        "tetra_git" \
        "" \
        "development" "stable"
    
    tetra_add_module_metadata "nginx" \
        "Nginx configuration and management" \
        "tetra_nginx" \
        "" \
        "web" "stable"
    
    tetra_add_module_metadata "pm" \
        "Process monitoring and management" \
        "pm" \
        "" \
        "system" "stable"
    
    tetra_add_module_metadata "service" \
        "System service management" \
        "tetra_service" \
        "" \
        "system" "stable"
    
    tetra_add_module_metadata "sys" \
        "System utilities and monitoring" \
        "tetra_sys" \
        "" \
        "system" "stable"
    
    tetra_add_module_metadata "tmux" \
        "Tmux session management" \
        "tetra_tmux" \
        "" \
        "terminal" "stable"
    
    tetra_add_module_metadata "user" \
        "User management utilities" \
        "tetra_user" \
        "" \
        "system" "stable"
    
    tetra_add_module_metadata "hotrod" \
        "Performance optimization tools" \
        "hotrod" \
        "" \
        "performance" "stable"
    
    tetra_add_module_metadata "ml" \
        "Machine learning utilities" \
        "tetra_ml" \
        "" \
        "ai" "stable"
    
    tetra_add_module_metadata "paste" \
        "Clipboard and paste utilities" \
        "tetra_paste" \
        "" \
        "utility" "stable"
    
    tetra_add_module_metadata "pbvm" \
        "PocketBase version management" \
        "pbvm" \
        "" \
        "database" "stable"
    
    tetra_add_module_metadata "pico" \
        "Pico utilities and helpers" \
        "pico" \
        "" \
        "utility" "stable"
    
    tetra_add_module_metadata "svg" \
        "SVG processing utilities" \
        "tetra_svg" \
        "" \
        "graphics" "stable"
    
    tetra_add_module_metadata "tro" \
        "Tetra remote operations" \
        "tro" \
        "" \
        "remote" "stable"
    
    tetra_add_module_metadata "anthropic" \
        "Anthropic AI integration" \
        "anthropic" \
        "" \
        "ai" "stable"
    
    tetra_add_module_metadata "reporting" \
        "System reporting and analytics" \
        "tetra_report" \
        "" \
        "monitoring" "stable"
    
    tetra_add_module_metadata "rag" \
        "Retrieval Augmented Generation tools" \
        "rag_repl rag_load_tools" \
        "" \
        "ai" "stable"
    
    tetra_add_module_metadata "qa" \
        "Question-answering system with multiple engines" \
        "qa qq qa_query qa_status qa_help qa_repl qa_search qa_browse" \
        "qa:query|status|help|set-engine|set-apikey|set-context|last|search|browse|browse-glow|test|repl|init" \
        "ai" "stable"
    
    tetra_add_module_metadata "melvin" \
        "Utility functions for text processing and encoding" \
        "echo64" \
        "" \
        "utility" "stable"
    
    tetra_add_module_metadata "logtime" \
        "Time tracking and logging utilities" \
        "_logtime-elapsed-hms" \
        "" \
        "productivity" "stable"
}

# Export functions for use by other modules
export -f tetra_add_module_metadata
export -f tetra_remove_module_metadata
export -f tetra_get_module_metadata
export -f tetra_list_all_modules_metadata
export -f tetra_get_module_info
export -f tetra_init_module_metadata
