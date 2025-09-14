#!/usr/bin/env bash

# Development Module Management
# Handles modules that are in development or external to core tetra

# Development module paths
TETRA_DEV_PATHS=(
    "$HOME/src/bash"           # External bash modules
    "$TETRA_SRC/bash/wip"      # Work in progress modules
    "$TETRA_SRC/dev-modules"   # Development modules
)

# Register development modules
tetra_register_dev_modules() {
    for dev_path in "${TETRA_DEV_PATHS[@]}"; do
        if [[ -d "$dev_path" ]]; then
            for module_dir in "$dev_path"/*/; do
                if [[ -d "$module_dir" ]]; then
                    local module_name=$(basename "$module_dir")
                    
                    # Skip if already registered
                    if [[ ! -v "TETRA_MODULE_LOADERS[$module_name]" ]]; then
                        # Check if it's a valid module
                        if [[ -f "$module_dir/includes.sh" ]] || [[ -f "$module_dir/$module_name.sh" ]]; then
                            echo "Registering dev module: $module_name"
                            tetra_register_module "$module_name" "$module_dir"
                        fi
                    fi
                fi
            done
        fi
    done
}

# List development modules
tetra_list_dev_modules() {
    echo "Development modules:"
    for dev_path in "${TETRA_DEV_PATHS[@]}"; do
        if [[ -d "$dev_path" ]]; then
            echo "  From $dev_path:"
            for module_dir in "$dev_path"/*/; do
                if [[ -d "$module_dir" ]]; then
                    local module_name=$(basename "$module_dir")
                    if [[ -f "$module_dir/includes.sh" ]] || [[ -f "$module_dir/$module_name.sh" ]]; then
                        local status="○"
                        if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1 && [[ -n "${TETRA_MODULE_LOADED[$module_name]:-}" ]] && [[ "${TETRA_MODULE_LOADED[$module_name]}" == "true" ]]; then
                            status="✓"
                        fi
                        echo "    $status $module_name"
                    fi
                fi
            done
        fi
    done
}

# Auto-create includes.sh for modules that need it
tetra_create_includes_for_module() {
    local module_path="$1"
    local module_name=$(basename "$module_path")
    
    if [[ ! -f "$module_path/includes.sh" ]]; then
        echo "Creating includes.sh for $module_name"
        
        # Find main module file
        local main_file=""
        if [[ -f "$module_path/$module_name.sh" ]]; then
            main_file="$module_name.sh"
        elif [[ -f "$module_path/main.sh" ]]; then
            main_file="main.sh"
        else
            # Find the first .sh file that's not a test or temp file
            main_file=$(find "$module_path" -maxdepth 1 -name "*.sh" -not -name "*test*" -not -name "*temp*" -not -name "includes.sh" | head -1)
            if [[ -n "$main_file" ]]; then
                main_file=$(basename "$main_file")
            fi
        fi
        
        if [[ -n "$main_file" ]]; then
            cat > "$module_path/includes.sh" <<EOF
#!/usr/bin/env bash

# $module_name module includes
source "\$(dirname "\${BASH_SOURCE[0]}")/$main_file"
EOF
            echo "Created includes.sh for $module_name -> $main_file"
        else
            echo "No suitable main file found for $module_name"
        fi
    fi
}

# Scan and fix modules without includes.sh
tetra_fix_module_includes() {
    local target_path="${1:-$TETRA_SRC/bash}"
    
    echo "Scanning for modules without includes.sh in $target_path"
    
    for module_dir in "$target_path"/*/; do
        if [[ -d "$module_dir" ]]; then
            local module_name=$(basename "$module_dir")
            
            # Skip certain directories
            case "$module_name" in
                "graveyard"|"wip"|"tests"|"temp") continue ;;
            esac
            
            if [[ ! -f "$module_dir/includes.sh" ]]; then
                echo "Missing includes.sh: $module_name"
                tetra_create_includes_for_module "$module_dir"
            fi
        fi
    done
}

# Development module aliases
alias trdm='tetra_register_dev_modules'
alias tldm='tetra_list_dev_modules'
alias tfmi='tetra_fix_module_includes'
