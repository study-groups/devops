#!/usr/bin/env bash

# Tetra Module Index System
# Defines modules with metadata, completions, and help strings

# Load custom module metadata system
TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$TETRA_SRC/bash/self/module_metadata.sh"

# Legacy compatibility wrapper for tetra_register_module_meta
tetra_register_module_meta() {
    local module="$1"
    local description="$2"
    local commands="$3"
    local completions="$4"
    local category="${5:-core}"
    local module_status="${6:-stable}"
    
    # Use new custom data structure
    tetra_add_module_metadata "$module" "$description" "$commands" "$completions" "$category" "$module_status"
}

# Load module index definitions
tetra_load_module_index() {
    # Initialize the new metadata system
    tetra_init_module_metadata
}

# Enhanced module listing with metadata
tetra_list_modules_enhanced() {
    local filter="${1:-all}"
    local show_dev="${2:-false}"
    
    # Load index if not already loaded
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
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
                    if [[ "$(tetra_get_module_metadata "$module" "category" 2>/dev/null)" == "$category" ]]; then
                        local status="○"
                        if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1 && [[ -n "${TETRA_MODULE_LOADED[$module]:-}" ]] && [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
                            status="✓"
                        fi
                        local desc="$(tetra_get_module_metadata "$module" "description" 2>/dev/null || echo "No description")"
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
    # Initialize metadata if needed
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
        tetra_load_module_index
    fi
    
    # Use new custom data structure
    tetra_get_module_info "$module"
    
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
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
        tetra_load_module_index
    fi
    
    echo "Modules matching '$pattern':"
    echo
    
    for module in $(tetra_get_available_modules); do
        local desc="$(tetra_get_module_metadata "$module" "description" 2>/dev/null || echo "")"
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
    if [[ -z "$TETRA_MODULE_METADATA" ]]; then
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

# Enhanced aliases
alias tlsm='tetra_list_modules_enhanced'
alias trm='tetra_remove_module'
alias tfm='tetra_find_module'
alias tmh='tetra_module_help'

# Lazy load module metadata on first use instead of at boot time
# The check at lines 34-36, 106-108, 157-159, 189-191 will load on demand
# tetra_load_module_index  # REMOVED: Was causing 3000+ lines to execute at boot

# Register enhanced tab completion
complete -F _tetra_enhanced_completion tlsm trm tfm tmh
