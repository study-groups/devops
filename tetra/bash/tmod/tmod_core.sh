#!/usr/bin/env bash

# tmod Core Functions - Module management operations

tmod_load_module() {
    local module="$1"
    local dev_flag="$2"
    
    if [[ -z "$module" ]]; then
        echo "Usage: load <module> [-dev]"
        echo "Available modules:"
        tetra_get_unloaded_modules | sed 's/^/  /'
        return 1
    fi
    
    if [[ "$dev_flag" == "-dev" ]]; then
        tetra_register_dev_modules
    fi
    
    tetra_smart_load_module "$module"
}

tmod_unload_module() {
    local module="$1"
    
    if [[ -z "$module" ]]; then
        echo "Usage: unload <module>"
        echo "Loaded modules:"
        tetra_get_loaded_modules | sed 's/^/  /'
        return 1
    fi
    
    echo "Unloading module: $module"
    tetra_remove_module "$module"
}

tmod_list_modules() {
    local filter="${1:-all}"
    local dev_flag="$2"
    
    if [[ "$filter" == "-dev" ]]; then
        dev_flag="-dev"
        filter="all"
    fi
    
    case "$filter" in
        all)
            echo "Available Modules:"
            local module_list=$(tetra_get_available_modules | sort)
            if [[ -n "$module_list" ]]; then
                echo "$module_list" | column -c 80 2>/dev/null || echo "$module_list" | sed 's/^/  /'
            else
                echo "  (none found)"
            fi
            ;;
        loaded)
            echo "Loaded Modules:"
            local module_list=$(tetra_get_loaded_modules | sort)
            if [[ -n "$module_list" ]]; then
                # Use column if available, otherwise format with sed
                if command -v column >/dev/null 2>&1; then
                    echo "$module_list" | column -c 80 2>/dev/null || echo "$module_list" | sed 's/^/  /'
                else
                    echo "$module_list" | sed 's/^/  /'
                fi
            else
                echo "  (none loaded)"
            fi
            ;;
        unloaded)
            echo "Unloaded Modules:"
            local module_list=$(tetra_get_unloaded_modules | sort)
            if [[ -n "$module_list" ]]; then
                # Use column if available, otherwise format with sed
                if command -v column >/dev/null 2>&1; then
                    echo "$module_list" | column -c 80 2>/dev/null || echo "$module_list" | sed 's/^/  /'
                else
                    echo "$module_list" | sed 's/^/  /'
                fi
            else
                echo "  (all modules loaded)"
            fi
            ;;
        *)
            tetra_list_modules_enhanced "$filter" "$([[ "$dev_flag" == "-dev" ]] && echo "true" || echo "false")"
            ;;
    esac
}

tmod_find_modules() {
    local pattern="$1"
    local dev_flag="$2"
    
    if [[ -z "$pattern" ]]; then
        echo "Usage: find <pattern> [-dev]"
        echo "Search modules by name or description"
        return 1
    fi
    
    tetra_find_module "$pattern" "$dev_flag"
}

tmod_help() {
    local module="$1"
    
    if [[ -z "$module" ]]; then
        cat <<'EOF'
tmod - Tetra Module Manager

Usage: tmod <command> [args]

Commands:
  repl|r                     Enter interactive REPL mode
  load|l <module> [-dev]     Load a module (auto-registers if needed)
  unload|rm <module>         Mark module as unloaded
  list|ls [filter] [-dev]    List modules by status/category
  find|f <pattern> [-dev]    Search modules by name/description
  help|h [module]            Show help (general or for specific module)
  status|st                  Show module system status
  enable|e|on <module>       Enable module for future sessions
  disable|d|off <module>     Disable module for future sessions
  config|c                   Show persistent module configuration
  dev                        Development module operations
  fix                        Fix missing includes.sh files
  index                      Rebuild module index

List Filters:
  all (default)  - All modules with status
  loaded         - Only loaded modules
  unloaded       - Only unloaded modules
  available      - All discoverable modules
  registered     - Only registered modules
  category       - Group by category (core, deployment, ai, etc.)

Flags:
  -dev           - Include development modules from ~/src/bash, wip/, etc.

Examples:
  tmod repl                  # Enter interactive mode
  tmod list category         # Show modules by category
  tmod load tsm              # Load tsm module
  tmod find "service"        # Find service-related modules
  tmod help tsm              # Get help for tsm module
  tmod on tkm                # Enable tkm for future sessions
  tmod off nvm               # Disable nvm for future sessions
  tmod config                # Show current module configuration

Interactive Mode:
  tmod repl                  # Start REPL
  > load tsm                 # Commands without 'tmod' prefix
  > list loaded              # Tab completion available
  > help                     # REPL-specific help
  > exit                     # Leave REPL
EOF
    else
        tetra_module_help "$module"
    fi
}

tmod_status() {
    echo "Tetra Module Status"
    echo "==================="
    echo
    
    # Show what's actually working
    echo "Core modules (always loaded):"
    for module in utils tmod prompt python nvm tsm; do
        if command -v "tetra_${module}_activate" >/dev/null 2>&1 || \
           command -v "$module" >/dev/null 2>&1 || \
           [[ "$module" == "utils" ]] || [[ "$module" == "tmod" ]] || [[ "$module" == "prompt" ]]; then
            echo "  ✓ $module"
        else
            echo "  ○ $module"
        fi
    done
    
    echo
    echo "Available modules:"
    local available_count=$(tetra_get_available_modules | wc -w)
    echo "  Total discoverable: $available_count"
    
    echo
    echo "Use 'tmod list' to see all modules"
}

tmod_dev() {
    local subcmd="${1:-help}"
    shift
    
    case "$subcmd" in
        register|reg)
            echo "Registering development modules..."
            tetra_register_dev_modules
            ;;
        list|ls)
            tetra_list_dev_modules
            ;;
        help|h)
            cat <<'EOF'
tmod dev - Development Module Operations

Commands:
  register|reg    Register development modules from configured paths
  list|ls         List development modules and their status
  help|h          Show this help

Development module paths:
  ~/src/bash/*           - External bash modules
  $TETRA_SRC/bash/wip/*  - Work in progress modules  
  $TETRA_SRC/dev-modules/* - Development modules
EOF
            ;;
        *)
            echo "Unknown dev command: $subcmd"
            echo "Use 'tmod dev help' for available commands"
            return 1
            ;;
    esac
}

tmod_fix() {
    local target_path="${1:-$TETRA_SRC/bash}"
    echo "Fixing missing includes.sh files in $target_path..."
    tetra_fix_module_includes "$target_path"
}

tmod_index() {
    echo "Rebuilding module index..."
    tetra_load_module_index
    local count=$(echo "${!TETRA_MODULE_META_DESCRIPTION[@]}" | wc -w)
    echo "Module index rebuilt with $count modules"
}
