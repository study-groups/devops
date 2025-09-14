#!/usr/bin/env bash

# Tetra Module Management and Tab Completion System

# Get all registered modules
tetra_get_registered_modules() {
    if [[ -v TETRA_MODULE_LOADERS ]]; then
        # Safely extract keys to avoid bad substitution
        for key in "${!TETRA_MODULE_LOADERS[@]}"; do
            # Remove any extra quotes from the key
            local clean_key="${key//\"/}"
            echo "$clean_key"
        done
    fi
}

# Get all available modules (registered + discoverable)
tetra_get_available_modules() {
    local modules=()
    
    # Add registered modules - work around the quoted keys issue
    if [[ -v TETRA_MODULE_LOADERS ]]; then
        # Parse the array dump to extract clean module names
        while IFS= read -r line; do
            if [[ "$line" =~ \[\'?\"?([^\'\"]+)\'?\"?\] ]]; then
                local module_name="${BASH_REMATCH[1]}"
                [[ -n "$module_name" ]] && modules+=("$module_name")
            fi
        done < <(declare -p TETRA_MODULE_LOADERS 2>/dev/null | tr ' ' '\n')
    fi
    
    # Discover unregistered modules in bash directory
    if [[ -d "$TETRA_SRC/bash" ]]; then
        for dir in "$TETRA_SRC/bash"/*/; do
            if [[ -d "$dir" ]]; then
                local module_name=$(basename "$dir")
                # Check if it has loadable content
                if [[ -f "$dir/includes.sh" ]] || [[ -f "$dir/$module_name.sh" ]] || [[ $(find "$dir" -name "*.sh" -not -name "includes.sh" 2>/dev/null | wc -l) -gt 0 ]]; then
                    modules+=("$module_name")
                fi
            fi
        done
    fi
    
    # Remove duplicates and sort
    printf '%s\n' "${modules[@]}" | sort -u
}

# Get loaded modules
tetra_get_loaded_modules() {
    if [[ -v TETRA_MODULE_LOADED ]]; then
        for module in "${!TETRA_MODULE_LOADED[@]}"; do
            if [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
                echo "$module"
            fi
        done
    fi
}

# Get unloaded modules
tetra_get_unloaded_modules() {
    local all_modules=($(tetra_get_available_modules))
    local loaded_modules=($(tetra_get_loaded_modules))
    
    for module in "${all_modules[@]}"; do
        local is_loaded=false
        for loaded in "${loaded_modules[@]}"; do
            if [[ "$module" == "$loaded" ]]; then
                is_loaded=true
                break
            fi
        done
        if [[ "$is_loaded" == "false" ]]; then
            echo "$module"
        fi
    done
}

# Enhanced module loading with auto-registration
tetra_smart_load_module() {
    local module_name="$1"
    
    if [[ -z "$module_name" ]]; then
        echo "Usage: tetra_smart_load_module <module_name>"
        echo "Available modules:"
        tetra_get_available_modules | sed 's/^/  /'
        return 1
    fi
    
    # If already registered, use existing loader
    if [[ -v "TETRA_MODULE_LOADERS[$module_name]" ]]; then
        tetra_load_module "$module_name"
        return $?
    fi
    
    # Auto-discover and register
    local module_path="$TETRA_SRC/bash/$module_name"
    if [[ -d "$module_path" ]]; then
        echo "Auto-registering module: $module_name"
        tetra_register_module "$module_name" "$module_path"
        tetra_load_module "$module_name"
        return $?
    fi
    
    echo "Module not found: $module_name"
    return 1
}

# Tab completion for tetra module commands
_tetra_module_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[0]}"
    
    case "$cmd" in
        tetra_load_module|tlm)
            COMPREPLY=($(compgen -W "$(tetra_get_unloaded_modules)" -- "$cur"))
            ;;
        tetra_smart_load_module|tslm)
            COMPREPLY=($(compgen -W "$(tetra_get_available_modules)" -- "$cur"))
            ;;
        tetra_list_modules|tlsm)
            # No completion needed for list command
            ;;
        *)
            COMPREPLY=()
            ;;
    esac
}

# Module status and listing
tetra_list_modules() {
    local filter="${1:-all}"
    
    case "$filter" in
        loaded|l)
            echo "Loaded modules:"
            tetra_get_loaded_modules | sed 's/^/  ✓ /'
            ;;
        unloaded|u)
            echo "Unloaded modules:"
            tetra_get_unloaded_modules | sed 's/^/  ○ /'
            ;;
        available|a)
            echo "Available modules:"
            tetra_get_available_modules | sed 's/^/  • /'
            ;;
        registered|r)
            echo "Registered modules:"
            tetra_get_registered_modules | sed 's/^/  ◆ /'
            ;;
        all|*)
            echo "Module Status:"
            echo
            echo "Loaded:"
            tetra_get_loaded_modules | sed 's/^/  ✓ /'
            echo
            echo "Unloaded:"
            tetra_get_unloaded_modules | sed 's/^/  ○ /'
            ;;
    esac
}

# Convenient aliases
alias tlm='tetra_load_module'
alias tslm='tetra_smart_load_module'
alias tlsm='tetra_list_modules'

# Register tab completion
complete -F _tetra_module_completion tetra_load_module tlm
complete -F _tetra_module_completion tetra_smart_load_module tslm
complete -F _tetra_module_completion tetra_list_modules tlsm
