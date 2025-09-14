#!/usr/bin/env bash

# Tetra Module Index System
# Defines modules with metadata, completions, and help strings

# Module metadata storage
# Only declare if not already declared to prevent array type conflicts
if [[ -z "$TETRA_MODULE_META_INITIALIZED" ]]; then
    declare -A TETRA_MODULE_META_DESCRIPTION
    declare -A TETRA_MODULE_META_COMMANDS
    declare -A TETRA_MODULE_META_COMPLETIONS
    declare -A TETRA_MODULE_META_CATEGORY
    declare -A TETRA_MODULE_META_STATUS
    export TETRA_MODULE_META_INITIALIZED=true
fi

# Register module metadata
tetra_register_module_meta() {
    local module="$1"
    local description="$2"
    local commands="$3"
    local completions="$4"
    local category="${5:-core}"
    local status="${6:-stable}"
    
    TETRA_MODULE_META_DESCRIPTION["$module"]="$description"
    TETRA_MODULE_META_COMMANDS["$module"]="$commands"
    TETRA_MODULE_META_COMPLETIONS["$module"]="$completions"
    TETRA_MODULE_META_CATEGORY["$module"]="$category"
    TETRA_MODULE_META_STATUS["$module"]="$status"
}

# Load module index definitions
tetra_load_module_index() {
    # Core modules
    tetra_register_module_meta "utils" \
        "Core utilities and helper functions" \
        "tetra_dns_whatsmyip tetra_linux_clean_path tetra_ufw_allow" \
        "" \
        "core" "stable"
    
    tetra_register_module_meta "prompt" \
        "Configurable bash prompt system" \
        "tp tetra_prompt" \
        "tp:style|multiline|toggle|status|help" \
        "core" "stable"
    
    tetra_register_module_meta "python" \
        "Python environment management via pyenv" \
        "tetra_python_activate tpa tetra_python_install tetra_python_list" \
        "tetra_python_install:3.8|3.9|3.10|3.11|3.12" \
        "core" "stable"
    
    tetra_register_module_meta "nvm" \
        "Node.js version management via nvm" \
        "tetra_nvm_activate tna" \
        "tetra_nvm_activate:node|lts|latest" \
        "core" "stable"
    
    tetra_register_module_meta "tsm" \
        "Tetra Service Manager - native process management" \
        "tsm" \
        "tsm:start|stop|restart|list|logs|info|delete|scan-ports" \
        "core" "stable"
    
    tetra_register_module_meta "tkm" \
        "Tetra Key Manager - SSH key and deployment management" \
        "tkm" \
        "tkm:init|add|list|deploy|status|org" \
        "deployment" "stable"
    
    tetra_register_module_meta "pb" \
        "Process management with PM2 integration" \
        "pb" \
        "pb:start|stop|restart|list|logs|delete" \
        "deployment" "stable"
    
    tetra_register_module_meta "sync" \
        "File synchronization and remote operations" \
        "tetra_sync tetra_remote_ls" \
        "" \
        "deployment" "stable"
    
    tetra_register_module_meta "ssh" \
        "SSH utilities and connection management" \
        "tetra_ssh_hosts" \
        "" \
        "deployment" "stable"
    
    tetra_register_module_meta "enc" \
        "Encryption and certificate management" \
        "tetra_enc_pem tetra_enc_cert" \
        "" \
        "security" "stable"
    
    tetra_register_module_meta "deploy" \
        "Deployment orchestration and management" \
        "tetra_deploy" \
        "" \
        "deployment" "stable"
    
    # External modules
    tetra_register_module_meta "rag" \
        "RAG (Retrieval Augmented Generation) tools" \
        "rag_repl rag_load_tools" \
        "" \
        "ai" "stable"
    
    tetra_register_module_meta "qa" \
        "Question-answering system with multiple engines" \
        "qa_query qa_set_engine qa_status qa_help" \
        "qa_set_engine:openai|anthropic|local" \
        "ai" "stable"
    
    tetra_register_module_meta "logtime" \
        "Time tracking and logging utilities" \
        "_logtime-elapsed-hms" \
        "" \
        "productivity" "stable"
}

# Enhanced module listing with metadata
tetra_list_modules_enhanced() {
    local filter="${1:-all}"
    local show_dev="${2:-false}"
    
    # Load index if not already loaded
    if [[ ${#TETRA_MODULE_META_DESCRIPTION[@]} -eq 0 ]]; then
        tetra_load_module_index
    fi
    
    case "$filter" in
        help|h)
            cat <<'EOF'
Usage: tlsm [filter] [-dev]

Filters:
  all (default)  - Show all modules with status
  loaded|l      - Show only loaded modules
  unloaded|u    - Show only unloaded modules  
  available|a   - Show all discoverable modules
  registered|r  - Show only registered modules
  category|c    - Show modules by category
  help|h        - Show this help

Flags:
  -dev          - Include development modules

Examples:
  tlsm                    # Show all modules
  tlsm loaded             # Show loaded modules
  tlsm category           # Show by category
  tlsm -dev               # Include dev modules
EOF
            return
            ;;
        category|c)
            echo "Modules by Category:"
            echo
            for category in core deployment security ai productivity; do
                echo "[$category]"
                for module in $(tetra_get_available_modules); do
                    if [[ "${TETRA_MODULE_META_CATEGORY[$module]}" == "$category" ]]; then
                        local status="○"
                        if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1 && [[ -n "${TETRA_MODULE_LOADED[$module]:-}" ]] && [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
                            status="✓"
                        fi
                        local desc="${TETRA_MODULE_META_DESCRIPTION[$module]:-No description}"
                        printf "  %s %-12s %s\n" "$status" "$module" "$desc"
                    fi
                done
                echo
            done
            ;;
        *)
            # Original functionality with enhanced display
            tetra_list_modules "$filter"
            ;;
    esac
    
    if [[ "$show_dev" == "true" ]]; then
        echo
        tetra_list_dev_modules
    fi
}

# Module help system
tetra_module_help() {
    local module="$1"
    
    if [[ -z "$module" ]]; then
        echo "Usage: tmh <module_name>"
        echo "Available modules:"
        tetra_get_available_modules | sed 's/^/  /'
        return 1
    fi
    
    # Load index if not already loaded
    if [[ ${#TETRA_MODULE_META_DESCRIPTION[@]} -eq 0 ]]; then
        tetra_load_module_index
    fi
    
    local desc="${TETRA_MODULE_META_DESCRIPTION[$module]:-No description available}"
    local commands="${TETRA_MODULE_META_COMMANDS[$module]:-No commands listed}"
    local completions="${TETRA_MODULE_META_COMPLETIONS[$module]:-No completions defined}"
    local category="${TETRA_MODULE_META_CATEGORY[$module]:-unknown}"
    local status="${TETRA_MODULE_META_STATUS[$module]:-unknown}"
    
    echo "Module: $module"
    echo "Description: $desc"
    echo "Category: $category"
    echo "Status: $status"
    echo
    echo "Commands:"
    echo "  $commands" | tr ' ' '\n' | sed 's/^/  /'
    echo
    if [[ "$completions" != "No completions defined" ]]; then
        echo "Tab Completions:"
        echo "  $completions" | tr ' ' '\n' | sed 's/^/  /'
        echo
    fi
    
    # Show load status
    if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1 && [[ -n "${TETRA_MODULE_LOADED[$module]:-}" ]] && [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
        echo "Status: ✓ Loaded"
    else
        echo "Status: ○ Not loaded"
        echo "Load with: tlm $module"
    fi
}

# Tetra Remove Module
tetra_remove_module() {
    local module="$1"
    local dev_flag="$2"
    
    if [[ -z "$module" ]]; then
        echo "Usage: trm <module_name> [-dev]"
        echo "Loaded modules:"
        tetra_get_loaded_modules | sed 's/^/  /'
        return 1
    fi
    
    if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1 && [[ -n "${TETRA_MODULE_LOADED[$module]:-}" ]] && [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
        TETRA_MODULE_LOADED["$module"]=false
        echo "Module '$module' marked as unloaded"
        
        # Note: We can't actually unload bash functions, but we mark it as unloaded
        echo "Note: Functions remain in memory until shell restart"
    else
        echo "Module '$module' is not loaded"
    fi
}

# Tetra Find Module
tetra_find_module() {
    local pattern="$1"
    local dev_flag="$2"
    
    if [[ -z "$pattern" ]]; then
        echo "Usage: tfm <pattern> [-dev]"
        echo "Search for modules by name or description"
        return 1
    fi
    
    # Load index if not already loaded
    if [[ ${#TETRA_MODULE_META_DESCRIPTION[@]} -eq 0 ]]; then
        tetra_load_module_index
    fi
    
    echo "Modules matching '$pattern':"
    echo
    
    for module in $(tetra_get_available_modules); do
        local desc="${TETRA_MODULE_META_DESCRIPTION[$module]:-}"
        if [[ "$module" == *"$pattern"* ]] || [[ "$desc" == *"$pattern"* ]]; then
            local status="○"
            if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1 && [[ -n "${TETRA_MODULE_LOADED[$module]:-}" ]] && [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
                status="✓"
            fi
            printf "  %s %-12s %s\n" "$status" "$module" "$desc"
        fi
    done
    
    if [[ "$dev_flag" == "-dev" ]]; then
        echo
        echo "Development modules:"
        # Add dev module search here
    fi
}

# Enhanced tab completion with metadata
_tetra_enhanced_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[0]}"
    
    # Load index if not already loaded
    if [[ ${#TETRA_MODULE_META_DESCRIPTION[@]} -eq 0 ]]; then
        tetra_load_module_index
    fi
    
    case "$cmd" in
        tlsm)
            if [[ "$cur" == "-"* ]]; then
                COMPREPLY=($(compgen -W "-dev" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "all loaded unloaded available registered category help -dev" -- "$cur"))
            fi
            ;;
        trm)
            if [[ "$cur" == "-"* ]]; then
                COMPREPLY=($(compgen -W "-dev" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(tetra_get_loaded_modules)" -- "$cur"))
            fi
            ;;
        tfm)
            if [[ "$cur" == "-"* ]]; then
                COMPREPLY=($(compgen -W "-dev" -- "$cur"))
            else
                # Could add smart pattern completion here
                COMPREPLY=()
            fi
            ;;
        tmh)
            COMPREPLY=($(compgen -W "$(tetra_get_available_modules)" -- "$cur"))
            ;;
    esac
}

# Initialize module index
tetra_load_module_index

# Enhanced aliases
alias tlsm='tetra_list_modules_enhanced'
alias trm='tetra_remove_module'
alias tfm='tetra_find_module'
alias tmh='tetra_module_help'

# Register enhanced tab completion
complete -F _tetra_enhanced_completion tlsm trm tfm tmh
